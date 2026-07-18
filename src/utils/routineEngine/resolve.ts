import {
  ACTIVES_RULESET,
  type PairRule,
  type Period,
  type Potency,
  type ResolutionStrategy,
} from '@/constants/rulesets/rulesetTypes';
import type { Product, SkinConcern } from '@/types';
import type { AdaptationLimit } from '@/utils/routineEngine/adaptation';
import type { DerivedLimit, RoutineContext } from '@/utils/routineEngine/context';
import {
  collectLimits,
  collectPrioritizeTargets,
  type PrioritizeTarget,
} from '@/utils/routineEngine/mandates';
import type { DecisionReasonCode } from '@/constants/decisionReasons';
import type {
  DecisionLogEntry,
  FrozenItem,
  PlannedStep,
  SlotAlternative,
} from '@/utils/routineEngine/planTypes';
import type { ProductFacts } from '@/utils/routineEngine/productFacts';
import {
  getSlotIndex,
  isTreatment,
  orderSteps,
  periodsForProduct,
  preferredPeriodFor,
} from '@/utils/routineEngine/slotting';
import { matchesRuleTargets } from '@/utils/routineEngine/targeting';

/**
 * Pipeline step 5 — Resolution (research §1.1/§1.3). Deterministic greedy
 * admission: candidates enter a period in score order; a candidate is admitted
 * only if it violates nothing already admitted, otherwise the pair rule's
 * resolution ladder runs (separate_periods → separate_days →
 * freeze_lower_priority → keep_with_note). Single pass: AM first, then PM; a
 * product relocates at most once; no fixpoint loops. Stacking caps and
 * seasonal/phototype frequency limits run inside the same admission loop.
 */

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
/** Tue/Sat — the spread used when a loser is split onto 2 nights a week. */
const SPLIT_DAY_PREFERENCE = [2, 6];
const POTENCY_RANK: Record<Potency, number> = { low: 1, medium: 2, high: 3, rx: 4 };
/** Slot index 7 ("other") is a catch-all, not a category — exempt everywhere. */
const OTHER_SLOT_INDEX = 7;

export interface ResolveInput {
  /** Pre-gated eligible products (eligibility.ts output). */
  products: Product[];
  facts: Map<string, ProductFacts>;
  context: RoutineContext;
  concerns: SkinConcern[];
  /** Per-product adaptation caps (adaptation.ts); absent = no adapting products. */
  adaptationLimits?: Map<string, AdaptationLimit>;
  /** Per-product tolerability 0|0.5|1.0 (phase-05); absent = all 0 (V2 scoring). */
  tolerability?: Map<string, number>;
  /**
   * Skeleton selection (phase-04): per-period candidate id sets + treatment
   * frequency caps. generate ALWAYS passes it; absent means raw admission
   * over every product — kept for unit tests that exercise the ladder/cap
   * machinery directly.
   */
  selection?: {
    periodCandidates: Record<Period, Set<string>>;
    treatmentCaps: Map<string, AdaptationLimit>;
  };
}

export interface ResolveResult {
  periods: { am: PlannedStep[]; pm: PlannedStep[] };
  frozen: FrozenItem[];
  decisions: DecisionLogEntry[];
  /** Same-slot losers per period/slot, ranked best-first (routine-similar-product-priority). */
  slotAlternatives: SlotAlternative[];
}

interface Candidate {
  product: Product;
  facts: ProductFacts;
  score: number;
  relocated: boolean;
}

/** An admitted step paired with its facts — the unit conflict checks run against. */
export interface AdmittedEntry {
  step: PlannedStep;
  facts: ProductFacts;
}

interface Violation {
  partner: AdmittedEntry;
  /** Rule registry id — provenance only (phase-07). */
  ruleId: string;
  /** User-facing decision reason code (phase-07), distinct from ruleId. */
  reasonCode: DecisionReasonCode;
  severity: 'avoid' | 'caution';
  resolutions: ResolutionStrategy[];
}

// ─── Day helpers ────────────────────────────────────────────────────────────

function effectiveDays(scheduledDays: number[]): number[] {
  return scheduledDays.length === 0 ? ALL_DAYS : scheduledDays;
}

function daysOverlap(a: number[], b: number[]): boolean {
  const bDays = new Set(effectiveDays(b));
  return effectiveDays(a).some((d) => bDays.has(d));
}

/** Deterministic pick preferring the Tue/Sat spread, then ascending fill. */
function pickSplitDays(pool: number[], want: number): number[] {
  const preferred = SPLIT_DAY_PREFERENCE.filter((d) => pool.includes(d));
  const rest = pool.filter((d) => !preferred.includes(d));
  return [...preferred, ...rest].slice(0, Math.max(1, Math.min(want, pool.length)));
}

/** Clamps days to a weekly cap with deterministic, spread-friendly picks. */
function clampToLimit(days: number[], maxDaysPerWeek: number): number[] {
  const eff = effectiveDays(days);
  if (eff.length <= maxDaysPerWeek) return days;
  if (maxDaysPerWeek === 1) return eff.includes(3) ? [3] : eff.slice(0, 1);
  return pickSplitDays(eff, maxDaysPerWeek);
}

// ─── Scoring ────────────────────────────────────────────────────────────────

/**
 * Admission score (V2.1 phase-04 §4.4): prioritize ("SOS") boost dominates,
 * then Step-0 goal rank, then tolerability (reserved at 0 until Phase 5 feeds
 * the usage-anchored value), then the V2 concern match, then potency. Bands
 * are disjoint (goalRank ≤ ~12 ⇒ ≤ 12000; tolerability 0|100|200;
 * concernHits ≤ 90; potency ≤ 8), and the concernHits-over-potency relative
 * order is unchanged from V2 so goal-less inputs rank identically. Ties break
 * on addedAt (newer first) then id — fully stable. Exported so substitute
 * ranking uses the exact same scale as admission.
 */
export function scoreCandidate(
  product: Product,
  facts: ProductFacts,
  period: Period,
  concerns: SkinConcern[],
  prioritize: PrioritizeTarget[],
  treatmentClassRanking: readonly string[] = [],
  tolerability = 0,
): number {
  const classConcerns = new Set<SkinConcern>();
  for (const { key } of facts.classes) {
    for (const c of ACTIVES_RULESET.classes[key]?.concerns ?? []) classConcerns.add(c);
  }
  const concernHits = concerns.filter((c) => classConcerns.has(c)).length;

  const potency = Math.max(
    0,
    ...facts.classes.map((c) => (c.potency ? POTENCY_RANK[c.potency] : 0)),
  );

  const boosted = prioritize.some(
    (p) =>
      (p.period === undefined || p.period === period) &&
      matchesRuleTargets(product.productType, facts, p.targets),
  );

  // Highest-ranked matching class wins; not ranked = 0.
  let goalRank = 0;
  for (const { key } of facts.classes) {
    const index = treatmentClassRanking.indexOf(key);
    if (index !== -1) goalRank = Math.max(goalRank, treatmentClassRanking.length - index);
  }

  // tolerability is 0 | 0.5 | 1.0 (phase-05 §5.3); *200 gives the reserved
  // 0 | 100 | 200 band, so an adapted product outranks a new one of the same
  // class without crossing the goalRank band.
  return (
    (boosted ? 100000 : 0) + goalRank * 1000 + tolerability * 200 + concernHits * 10 + potency * 2
  );
}

function compareCandidates(a: Candidate, b: Candidate): number {
  return (
    b.score - a.score ||
    (a.product.addedAt < b.product.addedAt ? 1 : a.product.addedAt > b.product.addedAt ? -1 : 0) ||
    (a.product.id < b.product.id ? -1 : a.product.id > b.product.id ? 1 : 0)
  );
}

// ─── Conflict detection ─────────────────────────────────────────────────────

function hasAnyClass(facts: ProductFacts, keys: string[]): boolean {
  return facts.classes.some((c) => keys.includes(c.key));
}

function sideKeys(side: string | string[]): string[] {
  return Array.isArray(side) ? side : [side];
}

/** 'ab' when X matches side a / Y side b; 'ba' when swapped; null otherwise. */
function matchOrientation(rule: PairRule, x: ProductFacts, y: ProductFacts): 'ab' | 'ba' | null {
  const aKeys = sideKeys(rule.a);
  const bKeys = sideKeys(rule.b);
  if (hasAnyClass(x, aKeys) && hasAnyClass(y, bKeys)) return 'ab';
  if (hasAnyClass(x, bKeys) && hasAnyClass(y, aKeys)) return 'ba';
  return null;
}

/**
 * Applies pair-rule exceptions (e.g. downgrade when the side-a product is at
 * most low potency). A class attributed without potency evidence never
 * satisfies an exception — unknown potency must not soften rules.
 */
function applyExceptions(
  rule: PairRule,
  orientation: 'ab' | 'ba',
  x: ProductFacts,
  y: ProductFacts,
): { severity: 'avoid' | 'caution'; resolutions: ResolutionStrategy[] } {
  let severity = rule.severity;
  let resolutions = rule.resolutions;

  for (const exception of rule.exceptions ?? []) {
    const bounds = Object.entries(exception.whenPotencyAtMost ?? {});
    if (bounds.length === 0) continue;
    const pass = bounds.every(([side, bound]) => {
      const facts = (side === 'a') === (orientation === 'ab') ? x : y;
      const keys = sideKeys(side === 'a' ? rule.a : rule.b);
      const matched = facts.classes.filter((c) => keys.includes(c.key));
      return (
        matched.length > 0 &&
        matched.every((c) => c.potency !== undefined && POTENCY_RANK[c.potency] <= POTENCY_RANK[bound as Potency])
      );
    });
    if (!pass) continue;
    if (exception.downgradeTo === 'avoid' || exception.downgradeTo === 'caution') {
      severity = exception.downgradeTo;
    } else if (exception.downgradeTo) {
      resolutions = [exception.downgradeTo];
    }
  }

  return { severity, resolutions };
}

/** Pair-rule violations of X (with days) against the admitted set. */
function findPairViolations(
  facts: ProductFacts,
  days: number[],
  admitted: AdmittedEntry[],
  pairRules: PairRule[],
): Violation[] {
  const out: Violation[] = [];
  for (const partner of admitted) {
    for (const rule of pairRules) {
      const orientation = matchOrientation(rule, facts, partner.facts);
      if (!orientation) continue;
      if (rule.scope !== 'anywhere' && !daysOverlap(days, partner.step.scheduledDays)) continue;
      out.push({
        partner,
        ruleId: rule.id,
        reasonCode: rule.reasonCode,
        ...applyExceptions(rule, orientation, facts, partner.facts),
      });
      break; // first matching rule per partner keeps causes single and stable
    }
  }
  return out;
}

/** Leave-on carrier of a strong active — the unit the cumulative cap counts. */
function isStrongCarrierFacts(facts: ProductFacts): boolean {
  return facts.properties.irritancy >= 3 && !facts.rinseOff;
}

/**
 * Cumulative-exposure violations (V2.1 phase-04, report §7 — replaces the
 * per-class stacking caps, which no class declares anymore): at most one
 * leave-on strong-class carrier per period ON ANY GIVEN DAY. Day-overlap
 * scoping keeps the classic day-separated pattern legal (retinoid 5 nights +
 * AHA Tue/Sat), for user-saved routines via validate as much as for
 * admission — the ladder's separate_days-first resolutions depend on it.
 * Mild classes and rinse-off carriers are exempt by definition.
 */
function findCapViolations(facts: ProductFacts, days: number[], admitted: AdmittedEntry[]): Violation[] {
  if (!isStrongCarrierFacts(facts)) return [];
  return admitted
    .filter((a) => isStrongCarrierFacts(a.facts) && daysOverlap(days, a.step.scheduledDays))
    .map((partner) => ({
      partner,
      ruleId: 'cumulative_active_cap',
      reasonCode: 'cumulative_active_cap',
      severity: 'avoid' as const,
      resolutions: ['separate_days', 'freeze_lower_priority'] as ResolutionStrategy[],
    }));
}

/** A violation reported to callers outside the admission loop (validate/substitute). */
export interface ViolationSummary {
  ruleId: string;
  reasonCode: DecisionReasonCode;
  severity: 'avoid' | 'caution';
}

/**
 * Probes a product (with its scheduled days) against an admitted set — pair
 * rules and stacking caps — without walking the resolution ladder. Used by
 * validate (findings over saved routines) and substitute (conflict-free
 * candidate check); shares every detection path with the admission loop.
 */
export function findViolationsAgainst(
  facts: ProductFacts,
  days: number[],
  admitted: AdmittedEntry[],
  pairRules: PairRule[],
): ViolationSummary[] {
  return [
    ...findPairViolations(facts, days, admitted, pairRules),
    ...findCapViolations(facts, days, admitted),
  ].map((v) => ({ ruleId: v.ruleId, reasonCode: v.reasonCode, severity: v.severity }));
}

// ─── Resolution ladder ──────────────────────────────────────────────────────

interface DaySplit {
  xDays: number[];
  shrink?: { partner: AdmittedEntry; days: number[] };
}

/**
 * Finds disjoint days clearing every violating partner. A single daily
 * partner shrinks around the loser's split nights (retinoid keeps 5 nights,
 * AHA takes Tue/Sat); otherwise the loser fits into the free days, if any.
 */
function attemptDaySplit(days: number[], violations: Violation[]): DaySplit | null {
  const partners = [...new Map(violations.map((v) => [v.partner.step.productId, v.partner])).values()];

  if (partners.length === 1 && partners[0].step.scheduledDays.length === 0) {
    const xDays = pickSplitDays(effectiveDays(days), 2);
    return { xDays, shrink: { partner: partners[0], days: ALL_DAYS.filter((d) => !xDays.includes(d)) } };
  }

  const taken = new Set(partners.flatMap((p) => effectiveDays(p.step.scheduledDays)));
  const free = effectiveDays(days).filter((d) => !taken.has(d));
  if (free.length === 0) return null;
  return { xDays: pickSplitDays(free, 2) };
}

type AdmitOutcome =
  | { kind: 'admitted'; step: PlannedStep }
  | { kind: 'relocate' }
  | { kind: 'frozen'; item: FrozenItem }
  /** A same-slot loser (routine-similar-product-priority) — never walks the
   *  pair-rule/cap ladder; recorded as an alternative onto the winner's slot. */
  | { kind: 'slot_loser'; step: PlannedStep };

interface AdmitOptions {
  canRelocate: boolean;
  pairRules: PairRule[];
  limits: DerivedLimit[];
  adaptationLimits: Map<string, AdaptationLimit>;
}

function makeStep(candidate: Candidate, days: number[]): PlannedStep {
  return {
    productId: candidate.product.id,
    productType: candidate.product.productType,
    scheduledDays: days,
    slotIndex: getSlotIndex(candidate.product.productType),
    score: candidate.score,
    addedAt: candidate.product.addedAt,
  };
}

/** Applies seasonal/phototype target caps + product-scoped adaptation caps (§2.6). */
function applyFrequencyCaps(
  candidate: Candidate,
  period: Period,
  opts: AdmitOptions,
  decisions: DecisionLogEntry[],
): number[] {
  const { facts, product } = candidate;
  let days: number[] = [];

  for (const limit of opts.limits) {
    if (!matchesRuleTargets(product.productType, facts, limit.targets)) continue;
    const clamped = clampToLimit(days, limit.maxDaysPerWeek);
    if (clamped !== days) {
      days = clamped;
      decisions.push({ action: 'limit', productId: product.id, period, reasonCode: limit.reasonCode });
    }
  }

  const adaptation = opts.adaptationLimits.get(product.id);
  if (adaptation) {
    const clamped = clampToLimit(days, adaptation.maxDaysPerWeek);
    if (clamped !== days) {
      days = clamped;
      decisions.push({ action: 'limit', productId: product.id, period, reasonCode: adaptation.reasonCode });
    }
  }

  return days;
}

/** Executes a separate_days resolution; null when no disjoint days exist. */
function resolveByDaySplit(
  candidate: Candidate,
  period: Period,
  days: number[],
  violations: Violation[],
  primary: Violation,
  decisions: DecisionLogEntry[],
): AdmitOutcome | null {
  const split = attemptDaySplit(days, violations);
  if (!split) return null;

  if (split.shrink) {
    split.shrink.partner.step.scheduledDays = split.shrink.days;
    decisions.push({
      action: 'day_split',
      productId: split.shrink.partner.step.productId,
      period,
      ruleId: primary.ruleId,
      reasonCode: primary.reasonCode,
      detail: 'shrunk to complement days',
    });
  }
  decisions.push({
    action: 'day_split',
    productId: candidate.product.id,
    period,
    ruleId: primary.ruleId,
    reasonCode: primary.reasonCode,
  });
  return { kind: 'admitted', step: makeStep(candidate, split.xDays) };
}

/** Walks the forcing rule's resolution ladder over a conflicted candidate. */
function walkResolutionLadder(
  candidate: Candidate,
  period: Period,
  days: number[],
  violations: Violation[],
  opts: AdmitOptions,
  decisions: DecisionLogEntry[],
): AdmitOutcome {
  const { facts, product } = candidate;
  // The forcing rule drives the ladder AND the attribution: an avoid-level
  // violation always wins over caution ones regardless of admission order
  // (2026-07-05 review blocker — violations[0] made the walked ladder and the
  // cited ruleId depend on which partner happened to be admitted first).
  const primary = violations.find((v) => v.severity === 'avoid') ?? violations[0];
  const frozen: AdmitOutcome = {
    kind: 'frozen',
    item: { productId: product.id, reasonCode: primary.reasonCode, ruleId: primary.ruleId },
  };
  const keepWithNote = (): AdmitOutcome => {
    decisions.push({
      action: 'keep_with_note',
      productId: product.id,
      period,
      ruleId: primary.ruleId,
      reasonCode: primary.reasonCode,
    });
    return { kind: 'admitted', step: makeStep(candidate, days) };
  };

  for (const resolution of primary.resolutions) {
    if (resolution === 'separate_periods') {
      const other: Period = period === 'am' ? 'pm' : 'am';
      if (opts.canRelocate && periodsForProduct(product.productType, facts).includes(other)) {
        return { kind: 'relocate' };
      }
    } else if (resolution === 'separate_days') {
      const outcome = resolveByDaySplit(candidate, period, days, violations, primary, decisions);
      if (outcome) return outcome;
    } else if (resolution === 'freeze_lower_priority') {
      return frozen;
    } else if (primary.severity !== 'avoid') {
      // keep_with_note is caution-only (research §3 step 5); an avoid-level
      // violation — including phototype-escalated ones — must never coexist.
      return keepWithNote();
    }
  }

  return primary.severity === 'avoid' ? frozen : keepWithNote();
}

/** Attempts to admit one candidate into a period, walking the ladder on conflict. */
function tryAdmit(
  candidate: Candidate,
  period: Period,
  admitted: AdmittedEntry[],
  opts: AdmitOptions,
  decisions: DecisionLogEntry[],
): AdmitOutcome {
  const days = applyFrequencyCaps(candidate, period, opts, decisions);
  const violations = [
    ...findPairViolations(candidate.facts, days, admitted, opts.pairRules),
    ...findCapViolations(candidate.facts, days, admitted),
  ];

  // A candidate the pair-rule/cap ladder would freeze, day-split, or relocate
  // is resolved by that mechanism exactly as before this feature — the
  // same-slot cap never double-classifies a candidate the ladder already has
  // an opinion about (keeps this feature strictly additive to
  // findPairViolations/findCapViolations, per the spec's Non-Goals; see
  // progress/routine-similar-product-priority.md for why this check order
  // deviates from the tech design's literal "before any pair/cap check"
  // phrasing — that ordering broke the existing pair-rule/stacking-cap suite
  // for same-slot products, e.g. two default-fixture "serum" products with a
  // real pair-rule relationship).
  if (violations.length > 0) {
    return walkResolutionLadder(candidate, period, days, violations, opts, decisions);
  }

  // Same-slot cap (routine-similar-product-priority): once a slot is occupied
  // and the candidate has cleared every pair-rule/cap check on its own
  // merits, a later same-slot candidate is recorded purely as an alternative
  // rather than admitted twice into one layering position. The exempt
  // `other` slot never competes.
  const slotIndex = getSlotIndex(candidate.product.productType);
  if (slotIndex !== OTHER_SLOT_INDEX && admitted.some((a) => a.step.slotIndex === slotIndex)) {
    return { kind: 'slot_loser', step: makeStep(candidate, days) };
  }

  return { kind: 'admitted', step: makeStep(candidate, days) };
}

// ─── Pool building & the period loop ────────────────────────────────────────

function buildPools(input: ResolveInput, prioritize: PrioritizeTarget[]): Record<Period, Candidate[]> {
  const pools: Record<Period, Candidate[]> = { am: [], pm: [] };
  const ranking = input.context.treatmentClassRanking;
  for (const product of input.products) {
    const facts = input.facts.get(product.id);
    if (!facts) continue;
    const allowed = periodsForProduct(product.productType, facts);
    if (allowed.length === 0) continue;

    let targets = isTreatment(facts) ? [preferredPeriodFor(facts, allowed)] : allowed;
    // Skeleton intersection: the selection stage has already assigned each
    // candidate its period(s); everything else was reserved and never pools.
    if (input.selection) {
      targets = targets.filter((p) => input.selection?.periodCandidates[p].has(product.id));
    }
    const tol = input.tolerability?.get(product.id) ?? 0;
    for (const period of targets) {
      pools[period].push({
        product,
        facts,
        relocated: false,
        score: scoreCandidate(product, facts, period, input.concerns, prioritize, ranking, tol),
      });
    }
  }
  return pools;
}

/** Internal accumulator for one period/slot's same-slot losers (pre morning/evening mapping). */
interface SlotAlternativeAccumulator {
  winnerProductId: string;
  period: Period;
  slotIndex: number;
  alternatives: PlannedStep[];
}

/** Shared mutable state of one resolution run. */
interface ResolveRun {
  admitted: Record<Period, AdmittedEntry[]>;
  frozen: FrozenItem[];
  decisions: DecisionLogEntry[];
  /** Keyed by `${period}-${slotIndex}` — one entry per contested slot. */
  slotAlternatives: Map<string, SlotAlternativeAccumulator>;
  optsFor: (relocated: boolean) => AdmitOptions;
}

/** Attaches a same-slot loser onto its slot's alternatives list, best-first
 *  (candidates already arrive score-ordered from `runPeriodPass`'s sorted pool). */
function recordSlotLoser(run: ResolveRun, period: Period, loserStep: PlannedStep): void {
  const winner = run.admitted[period].find((a) => a.step.slotIndex === loserStep.slotIndex);
  if (!winner) return; // defensive — slot_loser is only ever returned when a winner exists
  const key = `${period}-${loserStep.slotIndex}`;
  const entry = run.slotAlternatives.get(key) ?? {
    winnerProductId: winner.step.productId,
    period,
    slotIndex: loserStep.slotIndex,
    alternatives: [],
  };
  entry.alternatives.push(loserStep);
  run.slotAlternatives.set(key, entry);
}

/**
 * Runs one period's score-ordered admission pass. Relocation outcomes are
 * delegated to `onRelocate` — the AM pass defers them into the PM pool, the
 * PM pass retries them against the already-final AM set.
 */
function runPeriodPass(
  period: Period,
  pool: Candidate[],
  run: ResolveRun,
  onRelocate: (candidate: Candidate) => void,
): void {
  for (const candidate of pool.sort(compareCandidates)) {
    const outcome = tryAdmit(
      candidate,
      period,
      run.admitted[period],
      run.optsFor(candidate.relocated),
      run.decisions,
    );
    if (outcome.kind === 'admitted') {
      run.admitted[period].push({ step: outcome.step, facts: candidate.facts });
      run.decisions.push({ action: 'admit', productId: candidate.product.id, period });
    } else if (outcome.kind === 'slot_loser') {
      recordSlotLoser(run, period, outcome.step);
    } else if (outcome.kind === 'relocate') {
      run.decisions.push({
        action: 'relocate',
        productId: candidate.product.id,
        period,
        detail: `moved to ${period === 'am' ? 'pm' : 'am'}`,
      });
      onRelocate(candidate);
    } else {
      run.frozen.push(outcome.item);
      run.decisions.push({
        action: 'freeze',
        productId: candidate.product.id,
        period,
        ruleId: outcome.item.ruleId,
      });
    }
  }
}

/** PM→AM relocation: one retry against the final AM set; rejection freezes (§1.3). */
function retryRelocatedInAm(candidate: Candidate, run: ResolveRun): void {
  const retry = tryAdmit(
    { ...candidate, relocated: true },
    'am',
    run.admitted.am,
    run.optsFor(true),
    run.decisions,
  );
  if (retry.kind === 'admitted') {
    run.admitted.am.push({ step: retry.step, facts: candidate.facts });
    run.decisions.push({ action: 'admit', productId: candidate.product.id, period: 'am' });
    return;
  }
  if (retry.kind === 'slot_loser') {
    recordSlotLoser(run, 'am', retry.step);
    return;
  }
  const item: FrozenItem =
    retry.kind === 'frozen'
      ? retry.item
      : { productId: candidate.product.id, reasonCode: 'relocation_rejected' };
  run.frozen.push(item);
  run.decisions.push({ action: 'freeze', productId: candidate.product.id, period: 'am', ruleId: item.ruleId });
}

/**
 * Resolves both periods: AM first, then PM (research §1.3). AM losers
 * relocated by `separate_periods` re-enter the PM pool; PM losers relocate
 * against the already-final AM set — if that also rejects them, they freeze.
 */
export function resolvePeriods(input: ResolveInput): ResolveResult {
  const prioritize = collectPrioritizeTargets(input.context);
  const limits = collectLimits(input.context);
  const pairRules = input.context.effectiveRuleset.pairRules;
  // Adaptation caps merge with skeleton treatment caps, strictest-wins — a
  // phase-1 retinoid at 2/wk beats the reclassified 4/wk and vice versa.
  const adaptationLimits = new Map(input.adaptationLimits ?? []);
  for (const [productId, cap] of input.selection?.treatmentCaps ?? []) {
    const existing = adaptationLimits.get(productId);
    if (!existing || cap.maxDaysPerWeek < existing.maxDaysPerWeek) {
      adaptationLimits.set(productId, cap);
    }
  }
  const run: ResolveRun = {
    admitted: { am: [], pm: [] },
    frozen: [],
    decisions: [],
    slotAlternatives: new Map(),
    optsFor: (relocated) => ({ canRelocate: !relocated, pairRules, limits, adaptationLimits }),
  };

  const pools = buildPools(input, prioritize);

  runPeriodPass('am', pools.am, run, (candidate) => {
    pools.pm.push({
      ...candidate,
      relocated: true,
      score: scoreCandidate(
        candidate.product,
        candidate.facts,
        'pm',
        input.concerns,
        prioritize,
        input.context.treatmentClassRanking,
        input.tolerability?.get(candidate.product.id) ?? 0,
      ),
    });
  });
  runPeriodPass('pm', pools.pm, run, (candidate) => retryRelocatedInAm(candidate, run));

  return {
    periods: {
      am: orderSteps(run.admitted.am.map((a) => a.step)),
      pm: orderSteps(run.admitted.pm.map((a) => a.step)),
    },
    frozen: run.frozen,
    decisions: run.decisions,
    slotAlternatives: [...run.slotAlternatives.values()].map((entry) => ({
      winnerProductId: entry.winnerProductId,
      period: entry.period === 'am' ? 'morning' : 'evening',
      slotIndex: entry.slotIndex,
      alternatives: entry.alternatives,
    })),
  };
}
