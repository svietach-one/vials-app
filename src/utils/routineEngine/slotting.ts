import { ACTIVES_RULESET, type Period } from '@/constants/rulesets/rulesetTypes';
import type { ProductType } from '@/types';
import type { PlannedStep } from '@/utils/routineEngine/planTypes';
import type { ProductFacts } from '@/utils/routineEngine/productFacts';

/**
 * Pipeline step 4 (slotting) + step 7 (ordering) — the static layering
 * template per period (research §3 step 4). Products sharing an index share a
 * slot ("serum/gel", "lotion/cream/moisturizer") and compete during
 * resolution; ordering ties break on admission score, then addedAt, then id.
 */
export const LAYERING_ORDER: Record<ProductType, number> = {
  makeup_remover: 0,
  cleanser: 1,
  peeling: 2,
  toner: 3,
  essence: 4,
  ampoule: 5,
  serum: 6,
  gel: 6,
  other: 7, // slots after serums per research
  spot_treatment: 8,
  eye_cream: 9,
  mask: 10,
  lotion: 11,
  cream: 11,
  moisturizer: 11,
  oil: 12,
  balm: 12,
  spf: 13, // AM only, always last
};

export function getSlotIndex(productType: ProductType): number {
  return LAYERING_ORDER[productType];
}

/**
 * Periods a product may be placed in: class constraints ∩ usageTime (already
 * folded into facts.allowedPeriods) further restricted by product type — an
 * SPF product is AM-only even when its INCI parse found no filter class.
 */
export function periodsForProduct(productType: ProductType, facts: ProductFacts): Period[] {
  if (productType === 'spf') return facts.allowedPeriods.filter((p) => p === 'am');
  return facts.allowedPeriods;
}

/**
 * The build-order skeleton (V2.1 phase-04 §4.1): which product types may fill
 * each structural slot. Treatment is not listed — it is selected by class
 * ranking, not by format. Types outside this map and outside the treatment
 * ranking do not enter a generated routine at all (minimalism).
 *
 * `pre_cleanse` (micellar water, cleansing oils/balms) is a distinct PM-only
 * step ordered BEFORE `cleanser` (the double-cleanse pattern). It is a
 * surfactant-based makeup/SPF remover, NOT a standalone cleanse: a makeup
 * remover never satisfies the cleanse slot, and its presence triggers a
 * follow-up gentle-cleanser requirement (see `pre_cleanse_requires_followup`).
 * The AM skeleton has no pre_cleanse slot — makeup_remover defaults to PM.
 */
export const SKELETON_SLOTS = {
  pre_cleanse: ['makeup_remover'],
  cleanser: ['cleanser'],
  moisturizer: ['moisturizer', 'cream', 'lotion'],
  spf: ['spf'],
} as const satisfies Record<string, readonly ProductType[]>;

export type SkeletonSlotName = keyof typeof SKELETON_SLOTS;

/** The structural slot a product type can fill, if any. */
export function structuralSlotFor(productType: ProductType): SkeletonSlotName | null {
  for (const [slot, types] of Object.entries(SKELETON_SLOTS)) {
    if ((types as readonly ProductType[]).includes(productType)) return slot as SkeletonSlotName;
  }
  return null;
}

/**
 * True when the product is a single-placement "treatment" under the
 * cumulative rule: a leave-on carrier of a strong active (irritancy >= 3).
 * Tightened in phase-04 from the V2 `irritancy >= 1` boundary — mild
 * bioactives (peptides, niacinamide, vitamin C derivatives) carry no
 * cumulative restriction and may render in every allowed period, per the
 * 2026-07-17 directive (report §7).
 */
export function isTreatment(facts: ProductFacts): boolean {
  return facts.properties.irritancy >= 3 && !facts.rinseOff;
}

/**
 * Deterministic placement period for a single-placement treatment: the only
 * allowed period when there is one; otherwise the first attributed class's
 * declared convention (classes are key-sorted); otherwise PM — actives
 * default to evening.
 */
export function preferredPeriodFor(facts: ProductFacts, allowed: Period[]): Period {
  if (allowed.length === 1) return allowed[0];
  for (const { key } of facts.classes) {
    const preferred = ACTIVES_RULESET.classes[key]?.preferredPeriod;
    if (preferred && allowed.includes(preferred)) return preferred;
  }
  return allowed.includes('pm') ? 'pm' : allowed[0];
}

/** Step 7 — stable layering sort: slot index, then score, then addedAt, then id. */
export function orderSteps(steps: PlannedStep[]): PlannedStep[] {
  return [...steps].sort(
    (a, b) =>
      a.slotIndex - b.slotIndex ||
      b.score - a.score ||
      (a.addedAt < b.addedAt ? 1 : a.addedAt > b.addedAt ? -1 : 0) ||
      (a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0),
  );
}
