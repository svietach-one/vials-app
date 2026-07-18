import { ACTIVES_RULESET, type SeasonMask } from '@/constants/rulesets/rulesetTypes';
import type {
  CycleState,
  Product,
  Routine,
  RoutineCycleType,
  RoutineStep,
  UserProcedureLog,
  UserProfile,
} from '@/types';
import { buildRoutineContext } from '@/utils/routineEngine/context';
import {
  DYNAMIC_UNAVAILABLE_REASON,
  isDynamicCyclingAvailable,
  resolveCyclePhase,
  type CyclePhase,
} from '@/utils/routineEngine/cycleState';
import { buildShelfFacts, type ProductFacts } from '@/utils/routineEngine/productFacts';
import { matchesRuleTargets } from '@/utils/routineEngine/targeting';
import { getSkincareDateString } from '@/utils/timeHelpers';

/**
 * Daily-mask entry point (research §1.5/§3): a cheap render-time projection
 * of SAVED routines for one date. Never mutates, never persists — logging or
 * deleting a procedure changes the mask on the next render, and freezes
 * auto-expire with zero scheduled mutations. Clinical freezes override
 * userPinned (safety beats preference). Dynamic-cycling phases and adaptation
 * status join this view in FE-6.
 */

export interface DailyViewInput {
  procedures: UserProcedureLog[];
  profile: Pick<UserProfile, 'fitzpatrick'>;
  seasonMask: SeasonMask;
  /** Dynamic-cycling mask input; absent = fixed mode (weekday scheduling only). */
  cycle?: { type: RoutineCycleType; state: CycleState };
  now?: Date;
}

/** A step masked by an active clinical freeze — rendered as a dimmed row. */
export interface FrozenStepView {
  stepId: string;
  productId: string;
  reasonCode: string;
  /** Skincare date the step silently returns. */
  until: string;
}

/** A step not on tonight's cycle phase (dynamic mode) — not frozen, just not tonight. */
export interface CycledOutStepView {
  stepId: string;
  productId: string;
  /** Tonight's phase the step is waiting behind. */
  phase: CyclePhase;
}

export interface DailyRoutineView {
  routineId: string;
  timeOfDay: 'morning' | 'evening';
  /** Skincare date (04:00 boundary) the view was computed for. */
  date: string;
  /** Steps to render today, in saved order. */
  steps: RoutineStep[];
  frozen: FrozenStepView[];
  /** Dynamic mode only: evening actives whose cycle class is off-phase tonight. */
  cycledOut: CycledOutStepView[];
}

function isScheduledOn(step: RoutineStep, dayOfWeek: number): boolean {
  return step.scheduledDays.length === 0 || step.scheduledDays.includes(dayOfWeek);
}

/** Cycle classes attributed to a product (e.g. 'retinoid', 'exfoliant'). */
function cycleClassesOf(facts: ProductFacts): Set<string> {
  const out = new Set<string>();
  for (const { key } of facts.classes) {
    const cycleClass = ACTIVES_RULESET.classes[key]?.cycleClass;
    if (cycleClass) out.add(cycleClass);
  }
  return out;
}

/**
 * Dynamic-mode phase gate for cycled actives (research §1.4): exfoliation
 * night shows exfoliants, retinoid night shows retinoids, recovery nights
 * show neither. Products without a cycle class are unaffected.
 */
function matchesPhase(cycleClasses: Set<string>, phase: CyclePhase): boolean {
  if (phase === 'exfoliation') return cycleClasses.has('exfoliant');
  if (phase === 'retinoid') return cycleClasses.has('retinoid');
  return false;
}

/**
 * Cycle classes with at least one product usable tonight (V2.1 phase-06 §6.1).
 * "Usable" = eligible (not hidden, not PAO-expired) AND not clinically frozen
 * tonight, so a PAO-expired or frozen retinoid never keeps retinoid night
 * alive. Drives resolveCyclePhase / isDynamicCyclingAvailable.
 */
export function availableCycleClasses(
  products: Product[],
  facts: Map<string, ProductFacts>,
  freezeRules: ProjectionContext['freezeRules'],
  dayOfWeek: number,
): Set<string> {
  const available = new Set<string>();
  for (const product of products) {
    const f = facts.get(product.id);
    if (!f || !f.eligible) continue;
    const frozen = freezeRules.some((rule) => matchesRuleTargets(product.productType, f, rule.targets));
    if (frozen) continue;
    for (const cls of cycleClassesOf(f)) available.add(cls);
  }
  return available;
}

/** Resolved tonight's dynamic-cycle status for the Today phase card. */
export interface DynamicCycleStatus {
  phase: CyclePhase;
  available: boolean;
  /** DYNAMIC_UNAVAILABLE_REASON when neither cycle class is on the shelf, else null. */
  reasonCode: string | null;
}

/**
 * Resolves tonight's cycle phase against the shelf and reports whether dynamic
 * cycling has anything to cycle (V2.1 phase-06). Pure; the Today screen reads
 * this instead of the raw getCyclePhaseForTonight.
 */
export function getDynamicCycleStatus(
  products: Product[],
  input: DailyViewInput,
): DynamicCycleStatus {
  const now = input.now ?? new Date();
  if (!input.cycle || input.cycle.type !== 'dynamic') {
    return { phase: 'recovery', available: false, reasonCode: null };
  }
  const facts = buildShelfFacts(products, now);
  const context = buildRoutineContext({
    procedures: input.procedures,
    profile: { fitzpatrick: input.profile.fitzpatrick },
    seasonMask: input.seasonMask,
    now,
  });
  const freezeRules = context.procedureRules.filter((rule) => rule.action === 'freeze');
  const available = availableCycleClasses(
    products,
    facts,
    freezeRules,
    new Date(getSkincareDateString(now)).getUTCDay(),
  );
  const isAvailable = isDynamicCyclingAvailable(available);
  return {
    phase: resolveCyclePhase(input.cycle.state, available),
    available: isAvailable,
    reasonCode: isAvailable ? null : DYNAMIC_UNAVAILABLE_REASON,
  };
}

/** Everything one routine projection needs, derived once per call. */
interface ProjectionContext {
  date: string;
  dayOfWeek: number;
  facts: Map<string, ProductFacts>;
  productById: Map<string, Product>;
  freezeRules: ReturnType<typeof buildRoutineContext>['procedureRules'];
  dynamicPhase: CyclePhase | null;
}

/** Projects one saved routine onto the context's date. */
function projectRoutine(routine: Routine, ctx: ProjectionContext): DailyRoutineView {
  const steps: RoutineStep[] = [];
  const frozen: FrozenStepView[] = [];
  const cycledOut: CycledOutStepView[] = [];

  for (const step of routine.steps) {
    if (step.hidden) continue;

    const product = step.productId ? ctx.productById.get(step.productId) : undefined;
    const f = product ? ctx.facts.get(product.id) : undefined;
    const cycleClasses = f ? cycleClassesOf(f) : new Set<string>();
    const isCycled =
      ctx.dynamicPhase !== null && routine.timeOfDay === 'evening' && cycleClasses.size > 0;

    // Cycled actives follow tonight's phase, not the weekday plan (§1.4:
    // dynamic mode cannot be expressed in scheduledDays); everything else
    // keeps ordinary weekday scheduling.
    if (!isCycled && !isScheduledOn(step, ctx.dayOfWeek)) continue;

    // Deleted-product steps stay visible — the UI renders its empty-slot state
    const freeze =
      product && f
        ? ctx.freezeRules.find((rule) => matchesRuleTargets(product.productType, f, rule.targets))
        : undefined;

    if (freeze && product) {
      frozen.push({
        stepId: step.id,
        productId: product.id,
        reasonCode: freeze.reasonCode,
        until: freeze.untilDate,
      });
    } else if (isCycled && product && !matchesPhase(cycleClasses, ctx.dynamicPhase as CyclePhase)) {
      cycledOut.push({ stepId: step.id, productId: product.id, phase: ctx.dynamicPhase as CyclePhase });
    } else {
      steps.push(step);
    }
  }

  return { routineId: routine.id, timeOfDay: routine.timeOfDay, date: ctx.date, steps, frozen, cycledOut };
}

/** Projects every saved routine onto one date. */
export function getDailyView(
  routines: Routine[],
  products: Product[],
  input: DailyViewInput,
): DailyRoutineView[] {
  const now = input.now ?? new Date();
  const date = getSkincareDateString(now);
  const context = buildRoutineContext({
    procedures: input.procedures,
    profile: { fitzpatrick: input.profile.fitzpatrick },
    seasonMask: input.seasonMask,
    now,
  });

  const facts = buildShelfFacts(products, now);
  const freezeRules = context.procedureRules.filter((rule) => rule.action === 'freeze');
  const dayOfWeek = new Date(date).getUTCDay();

  // phase-06: the rendered dynamic phase is resolved against shelf composition
  // — a retinoid/exfoliation night with no usable product degrades to recovery
  // rather than showing an empty night.
  const dynamicPhase =
    input.cycle?.type === 'dynamic'
      ? resolveCyclePhase(
          input.cycle.state,
          availableCycleClasses(products, facts, freezeRules, dayOfWeek),
        )
      : null;

  const ctx: ProjectionContext = {
    date,
    dayOfWeek,
    facts,
    productById: new Map(products.map((p) => [p.id, p])),
    freezeRules,
    dynamicPhase,
  };

  return routines.map((routine) => projectRoutine(routine, ctx));
}
