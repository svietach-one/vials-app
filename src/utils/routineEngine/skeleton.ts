import type { Period } from '@/constants/rulesets/rulesetTypes';
import type { ActiveIngredientKey, Product } from '@/types';
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
} from '@/utils/routineEngine/slotting';

/**
 * Pipeline step 4.5 — Skeleton selection (V2.1 phase-04). Decides WHO may
 * enter each period's admission pass; the admission machinery downstream
 * (resolve.ts ladder, caps, slot alternatives) is unchanged. The question
 * flips from "does this product violate anything?" to "does this product
 * serve the goal?" — absence of a violation stops being a reason to include.
 *
 * Skeleton (build order): AM cleanse → treatment? → moisturize → SPF;
 * PM cleanse → treatment? → moisturize. Products outside the structural
 * slots and the treatment ranking go to `reserve` with a reason code.
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
}

/** Draft cap values — consultant review items (tech design Phase 4, Assumption 4). */
const EXFOLIANT_TREATMENT_MAX_DAYS = 2;
const RECLASSIFIED_TREATMENT_MAX_DAYS = 4;

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
}

/** Splits eligible entries into structural / treatment-pool / rest, emitting
 *  the rinse-off info note as a side effect (a BHA cleanser is exempt but
 *  worth surfacing). */
function classifyEntries(entries: Entry[], ranking: readonly ActiveIngredientKey[], decisions: DecisionLogEntry[]): Classified {
  const structural: Entry[] = [];
  const treatmentPool: Entry[] = [];
  const rest: Entry[] = [];
  for (const entry of entries) {
    if (isStrongCarrier(entry.facts)) {
      treatmentPool.push(entry); // reclassified to treatment regardless of format
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
  return { structural, treatmentPool, rest };
}

/** A treatment-selected period lacking a structural moisturizer needs one
 *  recommended (its own moisturizer may have been reclassified as the treatment). */
function neutralMoisturizerPlaceholders(
  selected: Record<Period, Entry | null>,
  structural: Entry[],
): PlaceholderSlot[] {
  const placeholders: PlaceholderSlot[] = [];
  for (const period of ['am', 'pm'] as const) {
    if (!selected[period]) continue;
    const hasMoisturizer = structural.some(
      (e) =>
        structuralSlotFor(e.product.productType) === 'moisturizer' &&
        periodsForProduct(e.product.productType, e.facts).includes(period),
    );
    if (!hasMoisturizer) {
      placeholders.push({
        period,
        productTypes: ['moisturizer'],
        reasonCode: 'moisturizer_recommended',
        nonSkippable: false,
        severity: 'caution',
      });
    }
  }
  return placeholders;
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

  const { structural, treatmentPool, rest } = classifyEntries(entries, ranking, decisions);

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
  for (const item of reserve) {
    decisions.push({ action: 'reserve', productId: item.productId, reasonCode: item.reasonCode });
  }

  const placeholders = neutralMoisturizerPlaceholders(selectedTreatments, structural);
  return { periodCandidates, reserve, decisions, placeholders, treatmentCaps };
}
