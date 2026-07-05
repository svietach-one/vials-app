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
 * True when the product is a single-placement "treatment": it carries active
 * classes with real irritation/photosensitivity/pH constraints, so generating
 * it into both periods would double exposure. Benign actives (hydrators,
 * barrier repair — irritancy 0) render in every allowed period like any
 * ordinary product.
 */
export function isTreatment(facts: ProductFacts): boolean {
  if (facts.classes.length === 0) return false;
  const p = facts.properties;
  return p.irritancy >= 1 || p.photosensitizing || p.lowPh || p.spf;
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
