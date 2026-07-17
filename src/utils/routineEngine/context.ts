import {
  ACTIVES_RULESET,
  PROCEDURES_RULESET,
  type ActiveClass,
  type PairRule,
  type Period,
  type RuleAction,
  type RuleTargets,
  type SeasonMask,
} from '@/constants/rulesets/rulesetTypes';
import type {
  ActiveIngredientKey,
  FitzpatrickType,
  ProcedureLogKey,
  SkinGoal,
  UserProcedureLog,
  UserProfile,
} from '@/types';
import { getProcedureDisplayName } from '@/utils/procedureLifespanHelpers';
import type { DecisionLogEntry } from '@/utils/routineEngine/planTypes';
import { getRehabDays } from '@/utils/routineEngine/rehabFilter';
import { getElapsedDays, getSkincareDateString } from '@/utils/timeHelpers';

/**
 * Pipeline step 2 — Context. Pure, deterministic derivation of everything the
 * downstream stages consume for a given date: active clinical freeze/require/
 * prioritize/limit windows, the phototype-modified effective ruleset, and the
 * resolved season mask. No React, no stores, no AsyncStorage; `now` is injected.
 */

const MS_PER_DAY = 86_400_000;

// ─── Comparators & side helpers ─────────────────────────────────────────────

/**
 * Evaluates a ruleset property condition against a concrete value. `expected`
 * may be a literal boolean/number or a comparator string (">=2", "<3", "=1").
 * Returns false when the actual value is missing.
 */
export function matchesComparator(
  actual: boolean | number | undefined,
  expected: boolean | number | string,
): boolean {
  if (actual === undefined) return false;
  if (typeof expected === 'boolean') return actual === expected;
  if (typeof expected === 'number') return actual === expected;

  const match = /^(>=|<=|>|<|=)?\s*(-?\d+(?:\.\d+)?)$/.exec(expected.trim());
  if (!match || typeof actual !== 'number') return false;
  const operator = match[1] ?? '=';
  const bound = Number(match[2]);
  switch (operator) {
    case '>=':
      return actual >= bound;
    case '<=':
      return actual <= bound;
    case '>':
      return actual > bound;
    case '<':
      return actual < bound;
    default:
      return actual === bound;
  }
}

function sideKeys(side: string | string[]): string[] {
  return Array.isArray(side) ? side : [side];
}

/** True when every class on a pair-rule side satisfies the property condition. */
function sideMeetsProperty(
  side: string | string[],
  classes: Record<string, ActiveClass>,
  property: string,
  expected: boolean | number | string,
): boolean {
  return sideKeys(side).every((key) => {
    const cls = classes[key];
    if (!cls) return false;
    const value = (cls.properties as Record<string, boolean | number | undefined>)[property];
    return matchesComparator(value, expected);
  });
}

// ─── Effective ruleset (phototype modifiers) ────────────────────────────────

/** A frequency cap derived from a phototype `tightenLimit` effect. */
export interface DerivedLimit {
  targets: RuleTargets;
  maxDaysPerWeek: number;
  reasonCode: string;
}

/** A mandate derived from a phototype `addMandate` effect. */
export interface DerivedMandate {
  action: RuleAction;
  targets?: RuleTargets;
  period?: Period;
  /** Guard: only applies when the plan contains this property. */
  condition?: { planContainsProperty?: string };
  nonSkippable: boolean;
  reasonCode: string;
}

/**
 * The base actives ruleset after phototype modifiers are baked in: pair
 * severities escalated, plus phototype-derived limits and mandates collected
 * for the mandate/resolution stages. Downstream stages never re-check phototype.
 */
export interface EffectiveRuleset {
  version: string;
  classes: Record<string, ActiveClass>;
  pairRules: PairRule[];
  limits: DerivedLimit[];
  mandates: DerivedMandate[];
}

/**
 * Applies the phototype modifiers for `fitzpatrick` to the base actives
 * ruleset. Type 3 / null get the baseline ruleset (no modifiers). Escalation
 * only fires when BOTH pair sides meet the irritancy condition — single-bottle
 * self-conflicts are handled at product-aggregation time, not here.
 */
export function buildEffectiveRuleset(fitzpatrick: FitzpatrickType | null): EffectiveRuleset {
  const base = ACTIVES_RULESET;
  const modifiers =
    fitzpatrick === null
      ? []
      : (base.phototypeModifiers ?? []).filter((m) => m.types.includes(fitzpatrick));

  let pairRules = base.pairRules;
  const limits: DerivedLimit[] = [];
  const mandates: DerivedMandate[] = [];

  for (const modifier of modifiers) {
    for (const effect of modifier.effects) {
      if (effect.effect === 'escalatePairSeverity') {
        pairRules = pairRules.map((rule) => {
          if (rule.severity !== effect.from) return rule;
          const meetsBoth = Object.entries(effect.when.bothProductsProperties).every(
            ([prop, expected]) =>
              sideMeetsProperty(rule.a, base.classes, prop, expected) &&
              sideMeetsProperty(rule.b, base.classes, prop, expected),
          );
          return meetsBoth ? { ...rule, severity: effect.to } : rule;
        });
      } else if (effect.effect === 'tightenLimit') {
        limits.push({
          targets: effect.targets,
          maxDaysPerWeek: effect.maxDaysPerWeek,
          reasonCode: effect.reasonCode,
        });
      } else {
        mandates.push({
          action: effect.then.action,
          targets: effect.then.targets,
          period: effect.then.period,
          condition: effect.if,
          nonSkippable: effect.nonSkippable ?? false,
          reasonCode: effect.reasonCode,
        });
      }
    }
  }

  return { version: base.version, classes: base.classes, pairRules, limits, mandates };
}

// ─── Procedure phase resolution (clinical freeze context) ───────────────────

/** A procedure product rule whose phase currently contains the target date. */
export interface ActiveProcedureRule {
  procedureId: string;
  procedureKey: ProcedureLogKey;
  procedureName: string;
  action: RuleAction;
  targets: RuleTargets;
  period?: Period;
  reasonCode: string;
  /** Resolved half-open window [fromDay, toDay) in skincare days from datePerformed. */
  fromDay: number;
  toDay: number;
  /** Skincare date (YYYY-MM-DD) the rule stops applying. */
  untilDate: string;
}

function addDays(datePerformed: string, days: number): string {
  const base = new Date(datePerformed).getTime();
  return new Date(base + days * MS_PER_DAY).toISOString().split('T')[0];
}

/**
 * Collects every procedure product rule whose resolved phase contains the
 * current day offset. Custom procedures use the `custom_default` profile with
 * `rehabEnd` resolved from `customRehabDays`. Rules with identical
 * action/targets/period are merged, keeping the one that ends latest
 * (overlapping procedures → union with max(toDay)).
 */
export function resolveActiveProcedureRules(
  procedures: UserProcedureLog[],
  now: Date = new Date(),
): ActiveProcedureRule[] {
  const active: ActiveProcedureRule[] = [];

  for (const proc of procedures) {
    if (proc.status === 'archived') continue;
    // Phase 1 routines are implicitly face routines: a procedure scoped to
    // other zones (e.g. a neck-only peel) never constrains them (research V3).
    const zones = proc.affectedZones ?? ['face'];
    if (!zones.includes('face')) continue;
    const profileKey = proc.procedureKey === 'custom' ? 'custom_default' : proc.procedureKey;
    const profile = PROCEDURES_RULESET.procedures[profileKey];
    if (!profile) continue;

    const rehabEnd = getRehabDays(proc);
    const dayOffset = getElapsedDays(proc.datePerformed, now);

    for (const rule of profile.productRules) {
      const toDay = rule.phase.toDay === 'rehabEnd' ? rehabEnd : rule.phase.toDay;
      if (dayOffset < rule.phase.fromDay || dayOffset >= toDay) continue;

      active.push({
        procedureId: proc.id,
        procedureKey: proc.procedureKey,
        procedureName: getProcedureDisplayName(proc),
        action: rule.action,
        targets: rule.targets,
        period: rule.period,
        reasonCode: rule.reasonCode,
        fromDay: rule.phase.fromDay,
        toDay,
        untilDate: addDays(proc.datePerformed, toDay),
      });
    }
  }

  return mergeProcedureRules(active);
}

/** Collapses rules with the same action/targets/period, keeping the latest untilDate. */
function mergeProcedureRules(rules: ActiveProcedureRule[]): ActiveProcedureRule[] {
  const byTarget = new Map<string, ActiveProcedureRule>();
  for (const rule of rules) {
    const key = `${rule.action}|${rule.period ?? ''}|${JSON.stringify(rule.targets)}`;
    const existing = byTarget.get(key);
    if (!existing || rule.untilDate > existing.untilDate) byTarget.set(key, rule);
  }
  return [...byTarget.values()];
}

// ─── Step 0 — Goals ─────────────────────────────────────────────────────────

/** The user's resolved goal pair (Step 0). Absent profile fields ⇒ maintenance. */
export interface GoalContext {
  primary: SkinGoal;
  secondary: SkinGoal | null;
}

export interface ResolvedGoals {
  goals: GoalContext;
  /**
   * Ordered treatment candidates: goals[primary] ++ goals[secondary], deduped,
   * modifiers applied. Phase 4's skeleton build-up selects the 0-or-1
   * treatment per period from this ranking; empty (maintenance) means the
   * treatment slot deliberately stays empty.
   */
  treatmentClassRanking: ActiveIngredientKey[];
  /** Step-0 exclusions, prepended into plan.decisions by generatePlan. */
  decisions: DecisionLogEntry[];
}

/** Moves the listed keys (keeping their relative order) directly ahead of `before`. */
function promoteAhead(
  ranking: ActiveIngredientKey[],
  keys: ActiveIngredientKey[],
  before: ActiveIngredientKey,
): ActiveIngredientKey[] {
  const anchor = ranking.indexOf(before);
  if (anchor === -1) return ranking;
  const promoted = ranking.filter((k) => keys.includes(k) && ranking.indexOf(k) > anchor);
  if (promoted.length === 0) return ranking;
  const rest = ranking.filter((k) => !promoted.includes(k));
  const at = rest.indexOf(before);
  return [...rest.slice(0, at), ...promoted, ...rest.slice(at)];
}

/**
 * Pipeline Step 0 — resolves the goal pair into an ordered treatment-class
 * ranking (V2.1 phase-03). Runs BEFORE facts; downstream stages read the
 * result from RoutineContext. Pure and deterministic: array order comes from
 * the ruleset's `goals` block, modifiers are stable transforms.
 *
 * Modifiers:
 * - barrier_repair as EITHER goal drops classes with flat irritancy >= 3
 *   (repair the barrier first; logged `barrier_repair_excludes_irritants`).
 * - Fitzpatrick 4–6 with a pigmentation goal promotes azelaic_acid and
 *   niacinamide ahead of aha (PIH risk from irritation).
 */
export function resolveGoalContext(
  profile: Pick<UserProfile, 'fitzpatrick'> &
    Partial<Pick<UserProfile, 'primaryGoal' | 'secondaryGoal'>>,
): ResolvedGoals {
  const primary = profile.primaryGoal ?? 'maintenance';
  const secondary = profile.secondaryGoal ?? null;
  const decisions: DecisionLogEntry[] = [];

  const merged: ActiveIngredientKey[] = [];
  for (const goal of [primary, secondary]) {
    if (!goal) continue;
    for (const key of ACTIVES_RULESET.goals[goal] ?? []) {
      if (!merged.includes(key)) merged.push(key);
    }
  }

  let ranking = merged;
  if (primary === 'barrier_repair' || secondary === 'barrier_repair') {
    const dropped = ranking.filter(
      (key) => (ACTIVES_RULESET.classes[key]?.properties.irritancy ?? 0) >= 3,
    );
    for (const key of dropped) {
      decisions.push({
        action: 'goal_exclude',
        reasonCode: 'barrier_repair_excludes_irritants',
        detail: key,
      });
    }
    ranking = ranking.filter((key) => !dropped.includes(key));
  }

  const highMelanin = profile.fitzpatrick !== null && (profile.fitzpatrick ?? 0) >= 4;
  if (highMelanin && (primary === 'pigmentation' || secondary === 'pigmentation')) {
    ranking = promoteAhead(ranking, ['azelaic_acid', 'niacinamide'], 'aha');
  }

  return { goals: { primary, secondary }, treatmentClassRanking: ranking, decisions };
}

// ─── Context assembly ───────────────────────────────────────────────────────

export interface RoutineContextInput {
  procedures: UserProcedureLog[];
  /** Goal fields optional so pre-goal callers keep compiling; absent ⇒ maintenance. */
  profile: Pick<UserProfile, 'fitzpatrick'> &
    Partial<Pick<UserProfile, 'primaryGoal' | 'secondaryGoal'>>;
  seasonMask: SeasonMask;
  now?: Date;
}

export interface RoutineContext {
  /** Skincare date (04:00 boundary) the context was built for. */
  date: string;
  fitzpatrick: FitzpatrickType | null;
  seasonMask: SeasonMask;
  procedureRules: ActiveProcedureRule[];
  effectiveRuleset: EffectiveRuleset;
  /** Step-0 goal resolution (V2.1 phase-03). */
  goals: GoalContext;
  treatmentClassRanking: ActiveIngredientKey[];
  /** Step-0 decisions, surfaced into the plan by generatePlan. */
  goalDecisions: DecisionLogEntry[];
}

/**
 * Assembles the full render-time context for a date. Deterministic: same
 * procedures + profile + seasonMask + now ⇒ identical context.
 */
export function buildRoutineContext(input: RoutineContextInput): RoutineContext {
  const now = input.now ?? new Date();
  const resolved = resolveGoalContext(input.profile);
  return {
    date: getSkincareDateString(now),
    fitzpatrick: input.profile.fitzpatrick,
    seasonMask: input.seasonMask,
    procedureRules: resolveActiveProcedureRules(input.procedures, now),
    effectiveRuleset: buildEffectiveRuleset(input.profile.fitzpatrick),
    goals: resolved.goals,
    treatmentClassRanking: resolved.treatmentClassRanking,
    goalDecisions: resolved.decisions,
  };
}
