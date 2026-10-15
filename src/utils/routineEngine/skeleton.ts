import type { DecisionReasonCode } from '@/constants/decisionReasons';
import { ACTIVES_RULESET, type Period } from '@/constants/rulesets/rulesetTypes';
import type { ActiveIngredientKey, Product, ProductType } from '@/types';
import type { AdaptationLimit } from '@/utils/routineEngine/adaptation';
import type { RoutineContext } from '@/utils/routineEngine/context';
import type {
  DecisionLogEntry,
  PlaceholderSlot,
  ReserveItem,
} from '@/utils/routineEngine/planTypes';
import type { ProductFacts } from '@/utils/routineEngine/productFacts';
import {
  isTreatment,
  periodsForProduct,
  preferredPeriodFor,
  structuralSlotFor,
  type SkeletonSlotName,
} from '@/utils/routineEngine/slotting';

/**
 * Pipeline step 4.5 — Skeleton selection (V2.1 phase-04). Decides WHO may
 * enter each period's admission pass; the admission machinery downstream
 * (resolve.ts ladder, caps, slot alternatives) is unchanged. The question
 * flips from "does this product violate anything?" to "does this product
 * serve the goal?" — absence of a violation stops being a reason to include.
 *
 * Skeleton (build order): AM cleanse → tone → eye → treatment? → moisturize →
 * SPF; PM cleanse → tone → eye → treatment? → moisturize (toner and eye cream
 * joined with intermediate-routine). Products outside the structural slots and
 * the treatment ranking go to `reserve` with a reason code.
 *
 * Cumulative active exposure (report §7): at most ONE leave-on strong-class
 * carrier per period across all slots; strong carriers are treatment
 * candidates regardless of format; rinse-off carriers are exempt and only
 * produce an info note. Deterministic throughout: ranking order comes from
 * Step 0, ties break on addedAt (newer first) then id.
 */

export interface SkeletonInput {
  /** Pre-gated eligible products (eligibility.ts output). */
  products: Product[];
  facts: Map<string, ProductFacts>;
  context: RoutineContext;
  /** Product ids the user forced back in (phase-07); reserved products in this
   *  set re-enter their eligible periods instead of being reserved. */
  userOverrides?: string[];
}

/** An accepted cycle-class rivalry (day-split-alternation): the rival's id
 *  was already in `userOverrides`, so it's admitted alongside the winner
 *  instead of reserved — `resolve.ts`'s admission loop resolves the pair via
 *  `computeCycleSplitDays` instead of the generic ladder. */
export interface CycleSplitPair {
  winnerProductId: string;
  rivalProductId: string;
}

export interface SkeletonSelection {
  /** Product ids allowed into each period's admission pool. */
  periodCandidates: Record<Period, Set<string>>;
  reserve: ReserveItem[];
  decisions: DecisionLogEntry[];
  placeholders: PlaceholderSlot[];
  /** Frequency caps for selected treatments (reclassified/exfoliant), merged
   *  strictest-wins with adaptation caps by the admission pass. */
  treatmentCaps: Map<string, AdaptationLimit>;
  /** Accepted cycle-class rivalries (day-split-alternation FE-2), threaded to
   *  resolve.ts. Empty when no rival has been overridden back in. */
  cycleSplitPairs: CycleSplitPair[];
}

/** Draft cap values — consultant review items (tech design Phase 4, Assumption 4). */
const EXFOLIANT_TREATMENT_MAX_DAYS = 2;
const RECLASSIFIED_TREATMENT_MAX_DAYS = 4;
/** Enzyme exfoliants (papain, bromelain, subtilisin) run a few mornings a week —
 *  gentler than the acids' two nights, never daily. Draft value awaiting the
 *  post-MVP clinical review (spec Q3). The summer and phototype 4-6 caps (1 day)
 *  still clamp it further through the ordinary frequency-cap pipeline. */
const ENZYME_EXFOLIANT_MAX_DAYS = 3;

/** The serum/gel band — the formats a treatment is "expected" in; anything
 *  else carrying a strong class is a reclassified format (acid toner/cream). */
const TREATMENT_NATIVE_TYPES: Product['productType'][] = ['serum', 'gel', 'ampoule', 'essence'];

interface Entry {
  product: Product;
  facts: ProductFacts;
}

/** Leave-on carrier of a strong active — the unit the cumulative cap counts. */
export function isStrongCarrier(facts: ProductFacts): boolean {
  return facts.properties.irritancy >= 3 && !facts.rinseOff;
}

/**
 * A non-strong carrier of an enzyme exfoliant, in ANY product format. It is
 * placed by its own rule (`selectExfoliants`), not by its format's slot: an
 * enzyme toner or cream leaves the toner/moisturiser slot (the gap card may
 * then appear) because scheduling it daily would defeat the weekly cap. A
 * STRONG carrier that also lists an enzyme (an AHA product with papain) stays a
 * treatment under the stricter strong-active rules.
 */
export function isEnzymeExfoliant(facts: ProductFacts): boolean {
  return !isStrongCarrier(facts) && facts.classes.some((c) => c.key === 'enzyme_exfoliant');
}

/** Newest first, then id — the same stable tiebreak the admission pass uses. */
function compareEntries(a: Entry, b: Entry): number {
  return (
    (a.product.addedAt < b.product.addedAt ? 1 : a.product.addedAt > b.product.addedAt ? -1 : 0) ||
    (a.product.id < b.product.id ? -1 : a.product.id > b.product.id ? 1 : 0)
  );
}

function classKeys(facts: ProductFacts): ActiveIngredientKey[] {
  return facts.classes.map((c) => c.key);
}

/** Cycle classes attributed to a product (e.g. 'retinoid', 'exfoliant') —
 *  same derivation as dailyView.ts's cycleClassesOf, this feature's first
 *  live consumer for auto-generation. */
function cycleClassesOf(facts: ProductFacts): Set<string> {
  const out = new Set<string>();
  for (const { key } of facts.classes) {
    const cycleClass = ACTIVES_RULESET.classes[key]?.cycleClass;
    if (cycleClass) out.add(cycleClass);
  }
  return out;
}

/** Native format first, then the stable addedAt/id tiebreak — the same
 *  ordering pickTreatment's own `ofClass` ranking uses, so "best-ranked
 *  rival" reads consistently with "best-ranked same-class candidate". */
function compareTreatmentCandidates(a: Entry, b: Entry): number {
  const aNative = TREATMENT_NATIVE_TYPES.includes(a.product.productType) ? 0 : 1;
  const bNative = TREATMENT_NATIVE_TYPES.includes(b.product.productType) ? 0 : 1;
  return aNative - bNative || compareEntries(a, b);
}

/**
 * The single best-ranked treatment-pool loser whose cycleClass differs from
 * the period's winner (Story 1 AC1/AC3): only candidates carrying at least
 * one cycleClass the winner doesn't share are eligible — a candidate with no
 * cycleClass, or the same cycleClass as the winner (already handled as a
 * `duplicate_function` sameClassLoser), never qualifies. No-op when the
 * winner itself carries no cycleClass.
 */
function findCycleClassRival(winner: Entry, pool: Entry[], used: Set<string>): Entry | null {
  const winnerClasses = cycleClassesOf(winner.facts);
  if (winnerClasses.size === 0) return null;
  const rivals = pool
    .filter((e) => !used.has(e.product.id))
    .filter((e) => {
      const classes = cycleClassesOf(e.facts);
      return classes.size > 0 && [...classes].some((c) => !winnerClasses.has(c));
    })
    .sort(compareTreatmentCandidates);
  return rivals[0] ?? null;
}

/**
 * Selects the 0-or-1 treatment for one period: walks the Step-0 ranking and
 * returns the first class that has a candidate preferring this period, with
 * that class's best candidate. Same-class runners-up are reported so the
 * caller can reserve them as duplicate_function.
 */
function pickTreatment(
  period: Period,
  ranking: ActiveIngredientKey[],
  candidates: Entry[],
  used: Set<string>,
): { winner: Entry; sameClassLosers: Entry[] } | null {
  for (const rankedClass of ranking) {
    const ofClass = candidates
      .filter((e) => !used.has(e.product.id) && classKeys(e.facts).includes(rankedClass))
      .filter((e) => {
        const allowed = periodsForProduct(e.product.productType, e.facts);
        return allowed.includes(period) && preferredPeriodFor(e.facts, allowed) === period;
      })
      .sort((a, b) => {
        // Native treatment formats beat reclassified ones (an acid serum wins
        // over an acid cream), then the stable addedAt/id tiebreak.
        const aNative = TREATMENT_NATIVE_TYPES.includes(a.product.productType) ? 0 : 1;
        const bNative = TREATMENT_NATIVE_TYPES.includes(b.product.productType) ? 0 : 1;
        return aNative - bNative || compareEntries(a, b);
      });
    if (ofClass.length > 0) {
      return { winner: ofClass[0], sameClassLosers: ofClass.slice(1) };
    }
  }
  return null;
}

/** The frequency cap a selected treatment inherits, if any. */
function treatmentCapFor(entry: Entry): AdaptationLimit | null {
  // Checked on NON-strong carriers only (isEnzymeExfoliant): an AHA+papain
  // product keeps the acids' stricter two-night cap below, never this looser one.
  if (isEnzymeExfoliant(entry.facts)) {
    return { maxDaysPerWeek: ENZYME_EXFOLIANT_MAX_DAYS, reasonCode: 'enzyme_exfoliant_cap' };
  }
  if (!isStrongCarrier(entry.facts)) return null;
  if (entry.facts.properties.exfoliating) {
    return { maxDaysPerWeek: EXFOLIANT_TREATMENT_MAX_DAYS, reasonCode: 'exfoliant_treatment_cap' };
  }
  if (!TREATMENT_NATIVE_TYPES.includes(entry.product.productType)) {
    // Reclassified format (acid/retinoid toner or cream): never inherits a
    // structural slot's daily frequency (report §7 assumption 8.3).
    return {
      maxDaysPerWeek: RECLASSIFIED_TREATMENT_MAX_DAYS,
      reasonCode: 'reclassified_treatment_cap',
    };
  }
  return null;
}

interface Classified {
  /** Cleanser/moisturizer/SPF products — every candidate enters its slot. */
  structural: Entry[];
  /** Strong carriers (any format) + mild ranked candidates — 0-or-1/period. */
  treatmentPool: Entry[];
  /** Neither structural nor goal-relevant — always reserved. */
  rest: Entry[];
  /** Non-strong enzyme carriers of any format — placed by `selectExfoliants`. */
  exfoliants: Entry[];
}

/** Splits eligible entries into structural / treatment-pool / rest, emitting
 *  the rinse-off info note as a side effect (a BHA cleanser is exempt but
 *  worth surfacing). */
function classifyEntries(entries: Entry[], ranking: readonly ActiveIngredientKey[], decisions: DecisionLogEntry[]): Classified {
  const structural: Entry[] = [];
  const treatmentPool: Entry[] = [];
  const rest: Entry[] = [];
  const exfoliants: Entry[] = [];
  for (const entry of entries) {
    if (isStrongCarrier(entry.facts)) {
      treatmentPool.push(entry); // reclassified to treatment regardless of format
      continue;
    }
    if (isEnzymeExfoliant(entry.facts)) {
      exfoliants.push(entry); // its own weekly slot, whatever its format
      continue;
    }
    if (structuralSlotFor(entry.product.productType) !== null) {
      structural.push(entry);
      if (entry.facts.rinseOff && entry.facts.properties.irritancy >= 3) {
        decisions.push({ action: 'info', productId: entry.product.id, reasonCode: 'rinse_off_active_note' });
      }
      continue;
    }
    if (ranking.length > 0 && classKeys(entry.facts).some((k) => ranking.includes(k))) {
      treatmentPool.push(entry); // mild ranked candidate (peptide serum, HA toner…)
    } else {
      rest.push(entry);
    }
  }
  return { structural, treatmentPool, rest, exfoliants };
}

/**
 * The build-order slots a period is expected to have filled, with the product
 * type a gap card should ask for and the reason code explaining it.
 * `pre_cleanse` is absent on purpose — a makeup remover is optional, and
 * prompting for one would nag every user who doesn't wear makeup.
 */
const REQUIRED_SLOTS: Record<
  Period,
  readonly { slot: SkeletonSlotName; productType: ProductType; reasonCode: DecisionReasonCode }[]
> = {
  am: [
    { slot: 'cleanser', productType: 'cleanser', reasonCode: 'cleanser_recommended' },
    { slot: 'toner', productType: 'toner', reasonCode: 'toner_recommended' },
    { slot: 'eye_cream', productType: 'eye_cream', reasonCode: 'eye_cream_recommended' },
    { slot: 'moisturizer', productType: 'moisturizer', reasonCode: 'moisturizer_recommended' },
    { slot: 'spf', productType: 'spf', reasonCode: 'spf_recommended' },
  ],
  pm: [
    { slot: 'cleanser', productType: 'cleanser', reasonCode: 'cleanser_recommended' },
    { slot: 'toner', productType: 'toner', reasonCode: 'toner_recommended' },
    { slot: 'eye_cream', productType: 'eye_cream', reasonCode: 'eye_cream_recommended' },
    { slot: 'moisturizer', productType: 'moisturizer', reasonCode: 'moisturizer_recommended' },
  ],
};

/**
 * One placeholder per REQUIRED slot no shelf product can fill in that period
 * (2026-10-14). Previously only the moisturiser was reported, and only when a
 * treatment had been selected — so a shelf with no actives at all, or one
 * whose only cream carried a strong active (reclassified into the treatment
 * pool, then reserved as not_needed_for_goals), lost that step with no step,
 * no reserve row the UI shows and no prompt. A structural gap is a fact about
 * the shelf, not about whether a treatment happened to win a slot.
 */
function structuralGapPlaceholders(structural: Entry[]): PlaceholderSlot[] {
  const placeholders: PlaceholderSlot[] = [];
  for (const period of ['am', 'pm'] as const) {
    for (const required of REQUIRED_SLOTS[period]) {
      const filled = structural.some(
        (e) =>
          structuralSlotFor(e.product.productType) === required.slot &&
          periodsForProduct(e.product.productType, e.facts).includes(period),
      );
      if (filled) continue;
      placeholders.push({
        period,
        productTypes: [required.productType],
        reasonCode: required.reasonCode,
        nonSkippable: false,
        severity: 'caution',
      });
    }
  }
  return placeholders;
}

/** True when barrier repair is either goal — exfoliation is deferred then. */
function isBarrierRepairGoal(context: RoutineContext): boolean {
  return context.goals.primary === 'barrier_repair' || context.goals.secondary === 'barrier_repair';
}

/**
 * Enzyme exfoliants (intermediate-routine): at most ONE per period, in the
 * period the product prefers (morning unless it can only run in the evening),
 * capped at ENZYME_EXFOLIANT_MAX_DAYS. A second product preferring the same
 * period is `duplicate_function`; with barrier repair as either goal every
 * enzyme product is deferred. Never raises a placeholder: exfoliation depends
 * on skin state, so the app never asks the user to buy one (spec Q2). Mutates
 * the candidate sets and caps like the treatment selection above.
 */
function selectExfoliants(
  exfoliants: Entry[],
  context: RoutineContext,
  periodCandidates: Record<Period, Set<string>>,
  treatmentCaps: Map<string, AdaptationLimit>,
): ReserveItem[] {
  if (isBarrierRepairGoal(context)) {
    return exfoliants.map((e) => ({ productId: e.product.id, reasonCode: 'exfoliant_deferred_barrier_repair' }));
  }
  const reserve: ReserveItem[] = [];
  for (const period of ['am', 'pm'] as const) {
    const ranked = exfoliants
      .filter((e) => {
        const allowed = periodsForProduct(e.product.productType, e.facts);
        return allowed.length > 0 && preferredPeriodFor(e.facts, allowed) === period;
      })
      .sort(compareEntries);
    ranked.forEach((entry, index) => {
      if (index > 0) {
        reserve.push({ productId: entry.product.id, reasonCode: 'duplicate_function' });
        return;
      }
      periodCandidates[period].add(entry.product.id);
      const cap = treatmentCapFor(entry);
      if (cap) treatmentCaps.set(entry.product.id, cap);
    });
  }
  return reserve;
}

/**
 * Override (phase-07): a reserved product the user forced back in re-enters
 * its ELIGIBLE periods instead of reserving. periodsForProduct enforces
 * period eligibility, so a retinoid override lands in PM only — never AM.
 * The admission pass still resolves any resulting conflict, so an override
 * bypasses minimalism, not same-day safety. An enzyme exfoliant re-enters its
 * PREFERRED period only and with its weekly cap: unguarded, "Add anyway" ran it
 * in both periods every day.
 */
function applyUserOverrides(
  reserve: ReserveItem[],
  entries: Entry[],
  userOverrides: string[] | undefined,
  periodCandidates: Record<Period, Set<string>>,
  treatmentCaps: Map<string, AdaptationLimit>,
  decisions: DecisionLogEntry[],
): { finalReserve: ReserveItem[]; cycleSplitPairs: CycleSplitPair[] } {
  const overrides = new Set(userOverrides ?? []);
  const finalReserve: ReserveItem[] = [];
  const cycleSplitPairs: CycleSplitPair[] = [];
  const entryFor = new Map(entries.map((e) => [e.product.id, e]));
  for (const item of reserve) {
    const entry = entryFor.get(item.productId);
    if (!overrides.has(item.productId) || !entry) {
      finalReserve.push(item);
      continue;
    }
    const allowed = periodsForProduct(entry.product.productType, entry.facts);
    const isEnzyme = isEnzymeExfoliant(entry.facts);
    const periods = isEnzyme && allowed.length > 0 ? [preferredPeriodFor(entry.facts, allowed)] : allowed;
    for (const period of periods) periodCandidates[period].add(item.productId);
    decisions.push({ action: 'admit', productId: item.productId, detail: 'user override' });
    // A forced-in enzyme never won a selection slot, so it never received its cap.
    const cap = treatmentCapFor(entry);
    if (isEnzyme && cap) treatmentCaps.set(item.productId, cap);
    // Cycle-class rivalry accepted (day-split-alternation, Story 3): the
    // rival re-enters like any other override, plus resolve.ts needs to
    // know the pair AND the rival's own frequency cap (a rival never won
    // its period's treatment slot, so it never received one via
    // treatmentCapFor above) to compute a complementary split.
    if (item.reasonCode === 'cycle_class_rival' && item.rivalOfProductId) {
      cycleSplitPairs.push({ winnerProductId: item.rivalOfProductId, rivalProductId: item.productId });
      if (cap) treatmentCaps.set(item.productId, cap);
    }
  }
  return { finalReserve, cycleSplitPairs };
}

export function selectSkeleton(input: SkeletonInput): SkeletonSelection {
  const ranking = input.context.treatmentClassRanking;
  const periodCandidates: Record<Period, Set<string>> = { am: new Set(), pm: new Set() };
  const reserve: ReserveItem[] = [];
  const decisions: DecisionLogEntry[] = [];
  const treatmentCaps = new Map<string, AdaptationLimit>();

  const entries: Entry[] = [];
  for (const product of input.products) {
    const facts = input.facts.get(product.id);
    if (!facts) continue;
    if (periodsForProduct(product.productType, facts).length === 0) continue; // gate-frozen upstream
    entries.push({ product, facts });
  }

  const { structural, treatmentPool, rest, exfoliants } = classifyEntries(entries, ranking, decisions);

  // Structural slots: every type-matching candidate enters; the admission
  // pass's same-slot cap picks the winner and keeps swap alternatives.
  for (const entry of structural) {
    for (const period of periodsForProduct(entry.product.productType, entry.facts)) {
      periodCandidates[period].add(entry.product.id);
    }
  }

  // Treatment slot: 0-or-1 per period by ranking walk.
  const used = new Set<string>();
  const selectedTreatments: Record<Period, Entry | null> = { am: null, pm: null };
  for (const period of ['am', 'pm'] as const) {
    const picked = pickTreatment(period, ranking, treatmentPool, used);
    if (!picked) continue;
    selectedTreatments[period] = picked.winner;
    used.add(picked.winner.product.id);
    periodCandidates[period].add(picked.winner.product.id);
    const cap = treatmentCapFor(picked.winner);
    if (cap) treatmentCaps.set(picked.winner.product.id, cap);
    for (const loser of picked.sameClassLosers) {
      used.add(loser.product.id);
      reserve.push({ productId: loser.product.id, reasonCode: 'duplicate_function' });
    }
  }

  // Cycle-class rivalry (day-split-alternation, Story 1): the single
  // best-ranked cross-cycleClass loser per period is tagged distinguishably
  // instead of falling into the generic cumulative_active_cap reserve below —
  // default behavior is unchanged (still reserved), just with richer data the
  // Draft Preview prompt card can act on.
  for (const period of ['am', 'pm'] as const) {
    const winner = selectedTreatments[period];
    if (!winner) continue;
    const rival = findCycleClassRival(winner, treatmentPool, used);
    if (!rival) continue;
    used.add(rival.product.id);
    reserve.push({
      productId: rival.product.id,
      reasonCode: 'cycle_class_rival',
      rivalOfProductId: winner.product.id,
      period,
    });
  }

  // Everything else in the treatment pool loses with a precise reason: a strong
  // carrier was blocked by the one-strong-per-period cap (or, under an empty
  // maintenance ranking, simply not needed — the cap owns strong exclusions
  // either way, report §7); a mild candidate just wasn't needed.
  for (const entry of treatmentPool) {
    if (used.has(entry.product.id)) continue;
    used.add(entry.product.id);
    reserve.push({
      productId: entry.product.id,
      reasonCode:
        isStrongCarrier(entry.facts) && ranking.length > 0
          ? 'cumulative_active_cap'
          : 'not_needed_for_goals',
    });
  }
  for (const entry of rest) {
    reserve.push({ productId: entry.product.id, reasonCode: 'not_needed_for_goals' });
  }
  reserve.push(...selectExfoliants(exfoliants, input.context, periodCandidates, treatmentCaps));

  const { finalReserve, cycleSplitPairs } = applyUserOverrides(
    reserve,
    entries,
    input.userOverrides,
    periodCandidates,
    treatmentCaps,
    decisions,
  );
  for (const item of finalReserve) {
    decisions.push({ action: 'reserve', productId: item.productId, reasonCode: item.reasonCode });
  }

  const placeholders = structuralGapPlaceholders(structural);
  return { periodCandidates, reserve: finalReserve, decisions, placeholders, treatmentCaps, cycleSplitPairs };
}
