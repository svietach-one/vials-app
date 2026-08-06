/**
 * Product-type-keyed data (not per-active-class data, so it lives alongside
 * `rulesetTypes.ts` rather than inside `actives.json`'s per-class schema).
 *
 * Relocated here (tech-design product-profile-m1.md FE-2, spec Goal 2) from
 * `src/utils/routineEngine/slotting.ts` (`LAYERING_ORDER`) and
 * `src/utils/routineEngine/productFacts.ts` (`RINSE_OFF_TYPES`,
 * `DEFAULT_PERIOD_BY_TYPE`, `DEFAULT_TAG_POTENCY`) so `src/utils/productProfile/`
 * can read this data without importing routine-engine-internal files
 * (architecture-review.md §2 — utils/services must not import each other's
 * private modules across feature boundaries). Mechanical data move only —
 * zero behavior change; `routineEngine/slotting.ts` and
 * `routineEngine/productFacts.ts` now import from here instead of declaring
 * local consts.
 */
import type { ProductType } from '@/types';
import type { Period, Potency } from '@/constants/rulesets/rulesetTypes';

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

/**
 * Only these two product types are unambiguously washed off. `peeling` and
 * `mask` are deliberately excluded: peel gels rinse but peel pads do not, and
 * sleeping masks are leave-on — do-no-harm means an ambiguous product consumes
 * the cumulative cap rather than escaping it (tech design Assumption 3).
 */
export const RINSE_OFF_TYPES: readonly ProductType[] = ['cleanser', 'makeup_remover'];

/**
 * Product types whose SAFE default period is narrower than the usageTime band.
 * makeup_remover (micellar/oil/balm) is a PM-only pre-cleanse: the safe
 * behavior is the default, not an opt-in. Applies only when usageTime is left
 * at 'both' (unset) — an explicit per-product 'morning'/'evening' still wins.
 */
export const DEFAULT_PERIOD_BY_TYPE: Partial<Record<ProductType, Period[]>> = {
  makeup_remover: ['pm'],
};

/**
 * Conservative default for wizard-confirmed classes without INCI evidence —
 * a class is trusted to be present (the user confirmed it), but its potency
 * is not, so this must never be softer than the class's strongest declared
 * tier: unknown must not soften rules (do-no-harm). Consumed by both
 * `routineEngine/productFacts.ts`'s `attributeClasses` and
 * `productProfile/resolve.ts`'s `resolveFromProduct` — a single shared
 * constant so a tag-only strong active (e.g. a wizard-confirmed retinoid
 * with no INCI text) can't score differently depending on which pipeline
 * computed it.
 */
export const DEFAULT_TAG_POTENCY: Potency = 'high';
