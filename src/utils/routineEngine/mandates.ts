import {
  ACTIVES_RULESET,
  SEASONS_RULESET,
  type Period,
  type RuleTargets,
  type Season,
  type SeasonRule,
} from '@/constants/rulesets/rulesetTypes';
import type { RoutineContext, DerivedLimit } from '@/utils/routineEngine/context';
import type {
  DecisionLogEntry,
  PlaceholderSlot,
  PlannedStep,
} from '@/utils/routineEngine/planTypes';
import type { ProductFacts } from '@/utils/routineEngine/productFacts';

/**
 * Pipeline step 6 — Mandates, plus the collectors that fold the three rule
 * sources (clinical procedure phases, seasonal rules, phototype modifiers)
 * into flat action lists the resolution loop consumes. Downstream code never
 * needs to know which source produced an action.
 */

/** Season rules active under the current mask. */
export function getActiveSeasonRules(season: Season): SeasonRule[] {
  return SEASONS_RULESET.rules.filter((rule) => rule.seasons.includes(season));
}

/** All frequency caps in force: phototype tighten-limits + seasonal limits. */
export function collectLimits(context: RoutineContext): DerivedLimit[] {
  const seasonal: DerivedLimit[] = getActiveSeasonRules(context.seasonMask.season)
    .filter((rule) => rule.then.action === 'limit' && rule.then.targets && rule.then.maxDaysPerWeek)
    .map((rule) => ({
      targets: rule.then.targets as RuleTargets,
      maxDaysPerWeek: rule.then.maxDaysPerWeek as number,
      reasonCode: rule.reasonCode,
    }));
  return [...context.effectiveRuleset.limits, ...seasonal];
}

/** A score-boost target ("SOS" items), optionally scoped to one period. */
export interface PrioritizeTarget {
  targets: RuleTargets;
  period?: Period;
  reasonCode: string;
}

/** All prioritize actions in force: clinical (rehab recovery) + seasonal. */
export function collectPrioritizeTargets(context: RoutineContext): PrioritizeTarget[] {
  const clinical: PrioritizeTarget[] = context.procedureRules
    .filter((rule) => rule.action === 'prioritize')
    .map((rule) => ({ targets: rule.targets, period: rule.period, reasonCode: rule.reasonCode }));
  const seasonal: PrioritizeTarget[] = getActiveSeasonRules(context.seasonMask.season)
    .filter((rule) => rule.then.action === 'prioritize' && rule.then.targets)
    .map((rule) => ({
      targets: rule.then.targets as RuleTargets,
      period: rule.then.period,
      reasonCode: rule.reasonCode,
    }));
  return [...clinical, ...seasonal];
}

/** A require action, normalized across its three sources. */
export interface RequireMandate {
  period: Period;
  targets: RuleTargets;
  reasonCode: string;
  nonSkippable: boolean;
  /** Finding severity when unmet, from the source rule's declaration. */
  severity: 'avoid' | 'caution';
  /** Only applies when some admitted product has this property (e.g. photosensitizing). */
  planContainsProperty?: string;
}

/** All require actions in force: clinical + seasonal + phototype mandates. */
export function collectRequireMandates(context: RoutineContext): RequireMandate[] {
  const clinical: RequireMandate[] = context.procedureRules
    .filter((rule) => rule.action === 'require' && rule.period)
    .map((rule) => ({
      period: rule.period as Period,
      targets: rule.targets,
      reasonCode: rule.reasonCode,
      nonSkippable: false,
      severity: 'caution' as const,
    }));

  const seasonal: RequireMandate[] = getActiveSeasonRules(context.seasonMask.season)
    .filter((rule) => rule.then.action === 'require' && rule.then.targets)
    .map((rule) => ({
      period: rule.then.period ?? 'am',
      targets: rule.then.targets as RuleTargets,
      reasonCode: rule.reasonCode,
      nonSkippable: false,
      // The season rule's own severity declaration drives the finding level
      severity: rule.severity ?? ('caution' as const),
      planContainsProperty: rule.if?.planContainsProperty,
    }));

  const phototype: RequireMandate[] = context.effectiveRuleset.mandates
    .filter((mandate) => mandate.action === 'require' && mandate.targets)
    .map((mandate) => ({
      period: mandate.period ?? 'am',
      targets: mandate.targets as RuleTargets,
      reasonCode: mandate.reasonCode,
      nonSkippable: mandate.nonSkippable,
      // Non-skippable mandates are avoid-level by definition (research §2.4)
      severity: mandate.nonSkippable ? ('avoid' as const) : ('caution' as const),
      planContainsProperty: mandate.condition?.planContainsProperty,
    }));

  // Base mandates (actives.json `mandates`): always in force, independent of
  // phototype, season, and clinical state — e.g. SPF whenever the plan carries
  // a photosensitizer, for every user (spec phase-02 §2.1). Read directly from
  // the ruleset like the seasonal source above. A `goalIn` condition matches
  // the user's primary OR secondary goal (phase-03 §3.3) and is resolved here
  // — unlike planContainsProperty it does not depend on the admitted plan.
  const base: RequireMandate[] = (ACTIVES_RULESET.mandates ?? [])
    .filter((mandate) => mandate.then.action === 'require' && mandate.then.targets)
    .filter((mandate) => {
      const goalIn = mandate.if?.goalIn;
      if (!goalIn) return true;
      return (
        goalIn.includes(context.goals.primary) ||
        (context.goals.secondary !== null && goalIn.includes(context.goals.secondary))
      );
    })
    .map((mandate) => ({
      period: mandate.then.period ?? 'am',
      targets: mandate.then.targets as RuleTargets,
      reasonCode: mandate.reasonCode,
      nonSkippable: mandate.nonSkippable ?? false,
      severity: mandate.severity ?? ('caution' as const),
      planContainsProperty: mandate.if?.planContainsProperty,
    }));

  return [...clinical, ...seasonal, ...phototype, ...base];
}

export interface MandateResult {
  placeholders: PlaceholderSlot[];
  decisions: DecisionLogEntry[];
}

/** True when any admitted product carries the property (truthy / irritancy > 0). */
function planContains(
  periods: { am: PlannedStep[]; pm: PlannedStep[] },
  facts: Map<string, ProductFacts>,
  property: string,
): boolean {
  return [...periods.am, ...periods.pm].some((step) => {
    const f = facts.get(step.productId);
    if (!f) return false;
    const value = (f.properties as unknown as Record<string, boolean | number>)[property];
    return typeof value === 'number' ? value > 0 : value === true;
  });
}

/**
 * Applies require mandates over the resolved periods. A mandate whose target
 * product types are absent from its period produces a placeholder — at most
 * one per period (research §3 step 6), merging product types across
 * triggering mandates; nonSkippable wins over skippable.
 */
export function applyMandates(
  periods: { am: PlannedStep[]; pm: PlannedStep[] },
  facts: Map<string, ProductFacts>,
  context: RoutineContext,
): MandateResult {
  const decisions: DecisionLogEntry[] = [];
  const byPeriod = new Map<Period, PlaceholderSlot>();

  for (const mandate of collectRequireMandates(context)) {
    if (
      mandate.planContainsProperty &&
      !planContains(periods, facts, mandate.planContainsProperty)
    ) {
      continue;
    }

    const targetTypes = mandate.targets.productTypes ?? [];
    if (targetTypes.length === 0) continue;
    const satisfied = periods[mandate.period].some((step) =>
      targetTypes.includes(step.productType),
    );
    if (satisfied) continue;

    decisions.push({
      action: 'placeholder',
      period: mandate.period,
      reasonCode: mandate.reasonCode,
    });

    const existing = byPeriod.get(mandate.period);
    if (existing) {
      existing.productTypes = [...new Set([...existing.productTypes, ...targetTypes])];
      existing.nonSkippable = existing.nonSkippable || mandate.nonSkippable;
      if (mandate.severity === 'avoid') existing.severity = 'avoid';
    } else {
      byPeriod.set(mandate.period, {
        period: mandate.period,
        productTypes: [...targetTypes],
        reasonCode: mandate.reasonCode,
        nonSkippable: mandate.nonSkippable,
        severity: mandate.severity,
      });
    }
  }

  return { placeholders: [...byPeriod.values()], decisions };
}
