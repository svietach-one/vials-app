import { ACTIVES_RULESET, type SeasonMask } from '@/constants/rulesets/rulesetTypes';
import { STEP_NOTE_TEXT } from '@/constants/decisionReasons';
import type {
  Product,
  ProductApplicationStats,
  RoutineCycleType,
  UserProcedureLog,
  UserProfile,
} from '@/types';
import { reclassifyMakeupRemover } from '@/utils/productForm/categoryDetector';
import { collectAdaptationLimits, collectTolerability } from '@/utils/routineEngine/adaptation';
import { buildRoutineContext } from '@/utils/routineEngine/context';
import { applyEligibilityGates } from '@/utils/routineEngine/eligibility';
import { applyMandates } from '@/utils/routineEngine/mandates';
import type {
  DecisionLogEntry,
  FrozenItem,
  PlaceholderSlot,
  PlannedStep,
  ReserveItem,
  SlotAlternative,
} from '@/utils/routineEngine/planTypes';
import { buildShelfFacts } from '@/utils/routineEngine/productFacts';
import { resolvePeriods } from '@/utils/routineEngine/resolve';
import { selectSkeleton } from '@/utils/routineEngine/skeleton';
import { structuralSlotFor } from '@/utils/routineEngine/slotting';
import { getSkincareDateString } from '@/utils/timeHelpers';

/**
 * Generate entry point (research §3, mode "generate"): whole eligible shelf →
 * a full AM+PM draft. Pure and deterministic; NEVER writes anything — the
 * caller (Draft Preview → src/domain/routinePlanActions.ts, FE-8) owns the
 * save. Same input ⇒ byte-identical plan.
 */

/** Tracking state feeding the adaptation pipeline (research §2.6). */
export interface TrackingInput {
  cycleType: RoutineCycleType;
  applicationStats: ProductApplicationStats[];
  /**
   * productId → skincare date the product first appeared in a saved plan
   * (phase-05 usage anchor). Absent map / missing entry ⇒ the product's
   * virtual adaptation count starts at phase 1.
   */
  firstScheduledDates?: Record<string, string>;
}

/** Everything the engine needs for one run — no store access, injected `now`. */
export interface EngineInput {
  products: Product[];
  procedures: UserProcedureLog[];
  /** Goal fields optional (absent ⇒ maintenance) so pre-goal callers/fixtures keep compiling. */
  profile: Pick<UserProfile, 'fitzpatrick' | 'concerns'> &
    Partial<Pick<UserProfile, 'primaryGoal' | 'secondaryGoal'>>;
  seasonMask: SeasonMask;
  /** Absent = fixed mode with no counters (virtual counts drive adaptation). */
  tracking?: TrackingInput;
  /**
   * Product ids the user forced back in past a skeleton reserve (phase-07
   * "add anyway"). They re-enter their ELIGIBLE periods only — retinoid-in-AM
   * stays structurally impossible. Admission still applies pair/cap resolution
   * (override bypasses minimalism, not same-day safety). Absent = none.
   */
  userOverrides?: string[];
  now?: Date;
}

/** The draft plan (research §3 step 8). */
export interface RoutinePlan {
  /** actives.json version stamp — a rules update prompts revalidation. */
  rulesetVersion: string;
  /** Skincare date the plan was generated for. */
  generatedFor: string;
  periods: { morning: PlannedStep[]; evening: PlannedStep[] };
  /** Dimmed rows: clinical freezes (with expiry), PAO-expired, unplaceable. */
  frozen: FrozenItem[];
  /**
   * Healthy shelf products the skeleton deliberately left out (phase-04),
   * each with a reason code — "in reserve", not paused. Required (empty when
   * everything scheduled) so the Phase 9 explainability invariant can count
   * every product exactly once.
   */
  reserve: ReserveItem[];
  placeholders: PlaceholderSlot[];
  decisions: DecisionLogEntry[];
  /**
   * Same-slot losers per period/slot, ranked best-first (routine-similar-
   * product-priority, Story 2) — optional so pre-existing plan fixtures built
   * before this field existed keep typechecking; `resolvePeriods` always
   * populates it (possibly empty) for plans generated after this feature.
   */
  slotAlternatives?: SlotAlternative[];
}

/**
 * Resolves the pre-cleanse follow-up note against the FINAL resolved PM
 * period (post-admission, not skeleton candidacy) — this is the shelf state
 * the user actually sees. A gentle cleanser scheduled alongside a pre_cleanse
 * step earns the "follow with your cleanser" note; no cleanser earns no note
 * text at all — the unmet cleanse-slot placeholder (pre_cleanse_requires_followup,
 * skeleton.ts) is the sole mechanism communicating the requirement then. Pure
 * and deterministic: same resolved PM steps ⇒ same notes.
 */
function attachPreCleanseNotes(pmSteps: PlannedStep[]): PlannedStep[] {
  const hasCleanser = pmSteps.some((s) => structuralSlotFor(s.productType) === 'cleanser');
  return pmSteps.map((step) => {
    if (structuralSlotFor(step.productType) !== 'pre_cleanse') return step;
    return {
      ...step,
      stepNote: hasCleanser ? STEP_NOTE_TEXT.pre_cleanse_follow_with_cleanser : null,
    };
  });
}

export function generatePlan(input: EngineInput): RoutinePlan {
  const now = input.now ?? new Date();
  // Read-time classification guard: a mistyped micellar/oil/balm cleanser is
  // normalized to makeup_remover before facts/skeleton see it, so DB imports
  // inherit the pre_cleanse slot + follow-up rule. Pure (same ref when no-op).
  const products = input.products.map(reclassifyMakeupRemover);
  const facts = buildShelfFacts(products, now);
  const context = buildRoutineContext({
    procedures: input.procedures,
    profile: {
      fitzpatrick: input.profile.fitzpatrick,
      primaryGoal: input.profile.primaryGoal,
      secondaryGoal: input.profile.secondaryGoal,
    },
    seasonMask: input.seasonMask,
    now,
  });

  const gates = applyEligibilityGates(products, facts, context);
  const skeleton = selectSkeleton({
    products: gates.eligible,
    facts,
    context,
    userOverrides: input.userOverrides,
  });
  const stats = input.tracking?.applicationStats ?? [];
  const cycleType = input.tracking?.cycleType ?? 'fixed';
  const firstScheduledDates = input.tracking?.firstScheduledDates ?? {};
  const resolved = resolvePeriods({
    products: gates.eligible,
    facts,
    context,
    concerns: input.profile.concerns,
    adaptationLimits: collectAdaptationLimits(gates.eligible, facts, stats, cycleType, now, firstScheduledDates),
    tolerability: collectTolerability(gates.eligible, facts, stats, cycleType, now, firstScheduledDates),
    selection: {
      periodCandidates: skeleton.periodCandidates,
      treatmentCaps: skeleton.treatmentCaps,
    },
  });
  const mandates = applyMandates(resolved.periods, facts, context);

  // Hidden products are the user's own choice — excluded silently, not frozen.
  const gatedOut = gates.rejections.filter((r) => r.gate !== 'hidden');
  const gateFrozen: FrozenItem[] = gatedOut.map((r) => ({
    productId: r.productId,
    reasonCode: r.reasonCode,
    ...(r.until ? { until: r.until } : {}),
  }));
  const gateDecisions: DecisionLogEntry[] = gatedOut.map((r) => ({
    action: 'freeze',
    productId: r.productId,
    reasonCode: r.reasonCode,
  }));

  return {
    rulesetVersion: ACTIVES_RULESET.version,
    generatedFor: getSkincareDateString(now),
    periods: { morning: resolved.periods.am, evening: attachPreCleanseNotes(resolved.periods.pm) },
    frozen: [...gateFrozen, ...resolved.frozen],
    reserve: skeleton.reserve,
    // Skeleton placeholders (neutral moisturizer) merge with mandate
    // placeholders (SPF); different periods/types never collide.
    placeholders: [...skeleton.placeholders, ...mandates.placeholders],
    // Step-0 goal decisions lead: they explain the ranking every later
    // selection/admit/freeze decision was made against.
    decisions: [
      ...context.goalDecisions,
      ...gateDecisions,
      ...skeleton.decisions,
      ...resolved.decisions,
      ...mandates.decisions,
    ],
    slotAlternatives: resolved.slotAlternatives,
  };
}
