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

/** Empty array is the Routine schema's "every day" (tests/routine-engine/fixtures.ts
 *  `daysOverlap` uses the same convention). True when `coverDays` schedules on
 *  EVERY day `neededDays` requires — not merely "some overlap": a cleanser
 *  day-split away from the pre_cleanse step's own days doesn't actually follow
 *  it on the uncovered days, so partial overlap must read as "not covered". */
export function scheduleFullyCovers(coverDays: number[], neededDays: number[]): boolean {
  if (coverDays.length === 0) return true;
  if (neededDays.length === 0) return false;
  return neededDays.every((d) => coverDays.includes(d));
}

/**
 * Whether the PM cleanse slot genuinely satisfies a scheduled pre_cleanse
 * step, computed ONCE against the FINAL resolved PM period (post-admission,
 * not skeleton candidacy) — the shelf state the user actually sees. Both the
 * follow-up note and the follow-up placeholder derive from this single
 * predicate so they can never disagree: a pre-admission "a cleanser candidate
 * exists" check (as skeleton.ts used to run) can diverge from what the
 * pair-rule/cap ladder actually admits — e.g. a cleanser carrying an active
 * that collides with a co-scheduled treatment can get day-split or fully
 * frozen by the SAME ladder every other candidate goes through (resolve.ts
 * findPairViolations does not exempt rinse-off products). Requiring full
 * schedule coverage (not just "a cleanser is scheduled at all") closes both
 * that divergence and the narrower case of a day-split cleanser that simply
 * doesn't run on the same days as the pre_cleanse step.
 */
function pmCleanseCoverage(
  pmSteps: PlannedStep[],
): { preCleanseProductId: string; covered: boolean } | null {
  const preCleanse = pmSteps.find((s) => structuralSlotFor(s.productType) === 'pre_cleanse');
  if (!preCleanse) return null;
  const cleanser = pmSteps.find((s) => structuralSlotFor(s.productType) === 'cleanser');
  const covered = cleanser ? scheduleFullyCovers(cleanser.scheduledDays, preCleanse.scheduledDays) : false;
  return { preCleanseProductId: preCleanse.productId, covered };
}

/** No fallback instruction is ever substituted when uncovered — the placeholder
 *  (below) is the sole mechanism then, per the pre_cleanse ruling. */
function attachPreCleanseNotes(pmSteps: PlannedStep[], coverage: ReturnType<typeof pmCleanseCoverage>): PlannedStep[] {
  if (!coverage) return pmSteps;
  return pmSteps.map((step) =>
    step.productId === coverage.preCleanseProductId
      ? { ...step, stepNote: coverage.covered ? STEP_NOTE_TEXT.pre_cleanse_follow_with_cleanser : null }
      : step,
  );
}

/** Fires exactly when the note above would NOT — same coverage predicate,
 *  so the two mechanisms are structurally incapable of both staying silent. */
function preCleanseFollowupPlaceholder(coverage: ReturnType<typeof pmCleanseCoverage>): PlaceholderSlot[] {
  if (!coverage || coverage.covered) return [];
  return [
    {
      period: 'pm',
      productTypes: ['cleanser'],
      reasonCode: 'pre_cleanse_requires_followup',
      nonSkippable: false,
      severity: 'caution',
    },
  ];
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

  const preCleanseCoverage = pmCleanseCoverage(resolved.periods.pm);

  return {
    rulesetVersion: ACTIVES_RULESET.version,
    generatedFor: getSkincareDateString(now),
    periods: {
      morning: resolved.periods.am,
      evening: attachPreCleanseNotes(resolved.periods.pm, preCleanseCoverage),
    },
    frozen: [...gateFrozen, ...resolved.frozen],
    reserve: skeleton.reserve,
    // Skeleton placeholders (neutral moisturizer) merge with mandate
    // placeholders (SPF) and the pre-cleanse follow-up (computed post-admission,
    // same source as the note above); different periods/types never collide.
    placeholders: [
      ...skeleton.placeholders,
      ...mandates.placeholders,
      ...preCleanseFollowupPlaceholder(preCleanseCoverage),
    ],
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
