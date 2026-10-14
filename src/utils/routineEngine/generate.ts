import { ACTIVES_RULESET, type PairRule, type SeasonMask } from '@/constants/rulesets/rulesetTypes';
import { STEP_NOTE_TEXT } from '@/constants/decisionReasons';
import type {
  Product,
  ProductApplicationStats,
  RoutineCycleType,
  UserProcedureLog,
  UserProfile,
} from '@/types';
import { normalizeProductType } from '@/utils/productForm/categoryDetector';
import { collectAdaptationLimits, collectTolerability } from '@/utils/routineEngine/adaptation';
import { buildRoutineContext } from '@/utils/routineEngine/context';
import { applyEligibilityGates, isSafetyFreezeGate } from '@/utils/routineEngine/eligibility';
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
import {
  findViolationsAgainst,
  resolvePeriods,
  type AdmittedEntry,
} from '@/utils/routineEngine/resolve';
import { selectSkeleton } from '@/utils/routineEngine/skeleton';
import { getSlotIndex, orderSteps, structuralSlotFor } from '@/utils/routineEngine/slotting';
import { getSkincareDateString } from '@/utils/timeHelpers';

/** 0 = Sunday … 6 = Saturday — the Routine schema's full week. */
const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6];

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
  /** Goal/pregnancy fields optional (absent ⇒ maintenance / not pregnant) so
   * pre-existing callers/fixtures keep compiling. */
  profile: Pick<UserProfile, 'fitzpatrick' | 'concerns'> &
    Partial<Pick<UserProfile, 'primaryGoal' | 'secondaryGoal' | 'pregnantOrBreastfeeding'>>;
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

/** Same as {@link scheduleFullyCovers} but across ALL cleanser steps: two
 *  alternating cleansers (e.g. a BHA foam on some days, a gentle gel on the
 *  rest) together follow the pre_cleanse step on every day, even though
 *  neither does alone. Any cleanser scheduled every day covers outright. */
export function schedulesFullyCover(coverSchedules: number[][], neededDays: number[]): boolean {
  if (coverSchedules.length === 0) return false;
  if (coverSchedules.some((days) => days.length === 0)) return true;
  const union = new Set(coverSchedules.flat());
  const needed = neededDays.length === 0 ? [0, 1, 2, 3, 4, 5, 6] : neededDays;
  return needed.every((d) => union.has(d));
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
  const cleansers = pmSteps.filter((s) => structuralSlotFor(s.productType) === 'cleanser');
  const covered = schedulesFullyCover(
    cleansers.map((c) => c.scheduledDays),
    preCleanse.scheduledDays,
  );
  return { preCleanseProductId: preCleanse.productId, covered };
}

/** Days a pre_cleanse/cleanser step actually runs — `[]` is "every day". */
function daysOf(step: PlannedStep): number[] {
  return step.scheduledDays.length === 0 ? [...ALL_WEEK] : step.scheduledDays;
}

/**
 * Promotes a same-slot LOSER cleanser onto the evening days the winning
 * cleanser doesn't run (routine-engine ruling 2026-10-14).
 *
 * The cap ladder can day-split an acid cleanser down to two nights while the
 * user's plain cleanser sits in `slotAlternatives` — owned, eligible, and
 * beaten only on ranking. Leaving those nights empty made the engine ask for
 * a cleanser the user already had. Double-cleansing is only coherent if a
 * rinse-off step exists on EVERY night the pre_cleanse step runs, so the gap
 * is filled from the shelf rather than reported.
 *
 * The promoted step is intersected with its OWN resolved schedule, never
 * widened past it: an alternative day-split for a safety reason keeps that
 * limit, and any night still uncovered falls through to the existing
 * note/placeholder pair unchanged.
 *
 * Every candidate night is re-checked against the nights actually admitted,
 * because a slot loser was only ever tested against the products admitted
 * BEFORE it (resolve.ts records it the moment it loses). Re-adding its stale
 * snapshot unchecked could co-schedule an `avoid` pair the plan's own
 * validator then flags — e.g. a PHA wash promoted onto a night already
 * holding copper peptides (tech-lead review 2026-10-14, B1). A night that
 * cannot be cleared is simply left uncovered.
 */
function fillPreCleanseGapFromAlternatives(
  pmSteps: PlannedStep[],
  slotAlternatives: SlotAlternative[],
  facts: ReturnType<typeof buildShelfFacts>,
  pairRules: PairRule[],
): { steps: PlannedStep[]; promotedIds: Set<string> } {
  const unchanged = { steps: pmSteps, promotedIds: new Set<string>() };
  const preCleanse = pmSteps.find((s) => structuralSlotFor(s.productType) === 'pre_cleanse');
  if (!preCleanse) return unchanged;

  const cleansers = pmSteps.filter((s) => structuralSlotFor(s.productType) === 'cleanser');
  if (cleansers.some((c) => c.scheduledDays.length === 0)) return unchanged;

  const covered = new Set(cleansers.flatMap(daysOf));
  const uncovered = daysOf(preCleanse).filter((d) => !covered.has(d));
  if (uncovered.length === 0) return unchanged;

  const scheduledIds = new Set(pmSteps.map((s) => s.productId));
  const candidates = slotAlternatives
    .filter((a) => a.period === 'evening')
    .flatMap((a) => a.alternatives)
    .filter((s) => structuralSlotFor(s.productType) === 'cleanser' && !scheduledIds.has(s.productId));

  // Grows as promotions land, so a second promoted cleanser is checked against
  // the first and not just against the original plan.
  const admitted: AdmittedEntry[] = pmSteps.flatMap((step) => {
    const f = facts.get(step.productId);
    return f ? [{ step, facts: f }] : [];
  });

  const added: PlannedStep[] = [];
  const promotedIds = new Set<string>();
  let remaining = uncovered;
  for (const candidate of candidates) {
    if (remaining.length === 0) break;
    const candidateFacts = facts.get(candidate.productId);
    if (!candidateFacts) continue;
    const allowed = new Set(daysOf(candidate));
    const days = remaining.filter(
      (d) =>
        allowed.has(d) &&
        findViolationsAgainst(candidateFacts, [d], admitted, pairRules).length === 0,
    );
    if (days.length === 0) continue;
    const step = { ...candidate, scheduledDays: days.length === ALL_WEEK.length ? [] : days };
    added.push(step);
    promotedIds.add(candidate.productId);
    admitted.push({ step, facts: candidateFacts });
    remaining = remaining.filter((d) => !days.includes(d));
  }
  if (added.length === 0) return unchanged;

  return { steps: orderSteps([...pmSteps, ...added]), promotedIds };
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
 *  so the two mechanisms are structurally incapable of both staying silent.
 *  Reached only after fillPreCleanseGapFromAlternatives has already spent the
 *  shelf, so a surviving gap really is a missing product. */
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

/**
 * One placeholder per (period, product type). The FIRST occurrence wins, so
 * callers pass the stricter source (mandates — `nonSkippable`, `avoid`) ahead
 * of the generic structural gap: a missing SPF under a peel must keep the
 * mandate's severity, not be softened to a recommendation.
 */
function dedupePlaceholders(placeholders: PlaceholderSlot[]): PlaceholderSlot[] {
  const seen = new Set<string>();
  const result: PlaceholderSlot[] = [];
  for (const placeholder of placeholders) {
    const key = `${placeholder.period}|${[...placeholder.productTypes].sort().join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(placeholder);
  }
  // Precedence decided which placeholder SURVIVES; build order decides how the
  // survivors read on screen. A gap-only group has no persisted step to take
  // its position from, so `attachPlaceholderGaps` emits them in array order —
  // leaving an all-gaps morning numbered "1. Protect, 2. Cleanse, 3.
  // Moisturize" (tech-lead review 2026-10-14, W2). Sorting by LAYERING_ORDER
  // keeps SCREENS.md §3.1's "1, 2, 3 reads as the routine" without introducing
  // the hand-written action-order table stepActions.ts deliberately refuses.
  return result.sort(
    (a, b) =>
      (a.period === b.period ? 0 : a.period === 'am' ? -1 : 1) ||
      getSlotIndex(a.productTypes[0]) - getSlotIndex(b.productTypes[0]),
  );
}

export function generatePlan(input: EngineInput): RoutinePlan {
  const now = input.now ?? new Date();
  // Read-time classification guard: a mistyped micellar/oil/balm cleanser is
  // normalized to makeup_remover before facts/skeleton see it, so DB imports
  // inherit the pre_cleanse slot + follow-up rule. Pure (same ref when no-op).
  const products = input.products.map(normalizeProductType);
  const facts = buildShelfFacts(products, now);
  const context = buildRoutineContext({
    procedures: input.procedures,
    profile: {
      fitzpatrick: input.profile.fitzpatrick,
      primaryGoal: input.profile.primaryGoal,
      secondaryGoal: input.profile.secondaryGoal,
      pregnantOrBreastfeeding: input.profile.pregnantOrBreastfeeding,
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
      cycleSplitPairs: skeleton.cycleSplitPairs,
    },
  });
  const mandates = applyMandates(resolved.periods, facts, context);

  // Hidden products are the user's own choice — excluded silently, not frozen.
  const gatedOut = gates.rejections.filter((r) => r.gate !== 'hidden');
  const gateFrozen: FrozenItem[] = gatedOut.map((r) => ({
    productId: r.productId,
    reasonCode: r.reasonCode,
    ...(r.until ? { until: r.until } : {}),
    overridesPin: isSafetyFreezeGate(r.gate),
  }));
  const gateDecisions: DecisionLogEntry[] = gatedOut.map((r) => ({
    action: 'freeze',
    productId: r.productId,
    reasonCode: r.reasonCode,
  }));

  const { steps: pmWithFollowup, promotedIds } = fillPreCleanseGapFromAlternatives(
    resolved.periods.pm,
    resolved.slotAlternatives,
    facts,
    context.effectiveRuleset.pairRules,
  );
  const preCleanseCoverage = pmCleanseCoverage(pmWithFollowup);

  // A promoted product is a SCHEDULED step now, so it must stop being offered
  // as an evening alternative: Draft Preview's "Change" would otherwise splice
  // its stale every-day snapshot in beside the step it already owns, producing
  // a duplicate product and a duplicate persisted step id (tech-lead review
  // 2026-10-14, B2). Entries emptied by the prune are dropped so no dead
  // "Change" affordance is left behind.
  const slotAlternatives = resolved.slotAlternatives
    .map((entry) =>
      entry.period === 'evening'
        ? { ...entry, alternatives: entry.alternatives.filter((a) => !promotedIds.has(a.productId)) }
        : entry,
    )
    .filter((entry) => entry.alternatives.length > 0);

  return {
    rulesetVersion: ACTIVES_RULESET.version,
    generatedFor: getSkincareDateString(now),
    periods: {
      morning: resolved.periods.am,
      evening: attachPreCleanseNotes(pmWithFollowup, preCleanseCoverage),
    },
    frozen: [...gateFrozen, ...resolved.frozen],
    reserve: skeleton.reserve,
    // Skeleton structural gaps merge with mandate placeholders (SPF) and the
    // pre-cleanse follow-up (computed post-admission, same source as the note
    // above). These DO collide now that a structural gap is reported
    // unconditionally — a shelf with no SPF raises both the generic
    // `spf_recommended` gap and, under a peel, the `spf_required_photosensitizing`
    // mandate. dedupePlaceholders keeps the stricter one so the user sees one
    // card per missing product, not two.
    // Ordered most-specific-first, because dedupePlaceholders keeps the first
    // of a colliding pair: a safety mandate outranks everything, the
    // pre-cleanse follow-up outranks the generic cleanser gap (it explains WHY
    // one is needed — micellar water doesn't rinse clean), and the structural
    // gaps are the catch-all.
    placeholders: dedupePlaceholders([
      ...mandates.placeholders,
      ...preCleanseFollowupPlaceholder(preCleanseCoverage),
      ...skeleton.placeholders,
    ]),
    // Step-0 goal decisions lead: they explain the ranking every later
    // selection/admit/freeze decision was made against.
    decisions: [
      ...context.goalDecisions,
      ...gateDecisions,
      ...skeleton.decisions,
      ...resolved.decisions,
      ...mandates.decisions,
    ],
    slotAlternatives,
  };
}
