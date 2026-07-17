import type { ActiveIngredientKey, FunctionalBenefit, ProductType } from '@/types';

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  cleanser: 'Cleanser',
  toner: 'Toner',
  essence: 'Essence',
  serum: 'Serum',
  gel: 'Gel',
  moisturizer: 'Moisturizer',
  oil: 'Oil',
  spf: 'SPF',
  makeup_remover: 'Makeup Remover',
  peeling: 'Peeling',
  ampoule: 'Ampoule',
  lotion: 'Lotion',
  cream: 'Cream',
  eye_cream: 'Eye Cream',
  mask: 'Mask',
  balm: 'Balm',
  spot_treatment: 'Spot Treatment',
  other: 'Other',
};

/**
 * Human-friendly, singular category name per layering slot (routine-similar-
 * product-priority spec §5) — several productTypes share one slot
 * (lotion/cream/moisturizer; serum/gel; oil/balm) and get one canonical label,
 * distinct from the raw per-type PRODUCT_TYPE_LABELS above. `other` is exempt
 * from duplicate-slot detection everywhere else; its label is never surfaced.
 */
export const SLOT_CATEGORY_LABELS: Record<ProductType, string> = {
  makeup_remover: 'makeup remover',
  cleanser: 'cleanser',
  peeling: 'peeling',
  toner: 'toner',
  essence: 'essence',
  ampoule: 'ampoule',
  serum: 'serum',
  gel: 'serum',
  other: 'other',
  spot_treatment: 'spot treatment',
  eye_cream: 'eye cream',
  mask: 'mask',
  lotion: 'moisturizer',
  cream: 'moisturizer',
  moisturizer: 'moisturizer',
  oil: 'oil',
  balm: 'oil',
  spf: 'SPF',
};

/** Singular human-readable slot/category name, e.g. "moisturizer", "SPF". */
export function getSlotCategoryLabel(productType: ProductType): string {
  return SLOT_CATEGORY_LABELS[productType] ?? PRODUCT_TYPE_LABELS[productType];
}

/** Naive pluralization ("moisturizer" -> "moisturizers", "SPF" -> "SPFs"). */
export function getSlotCategoryLabelPlural(productType: ProductType): string {
  const label = getSlotCategoryLabel(productType);
  return label.endsWith('s') ? label : `${label}s`;
}

export const ACTIVE_INGREDIENT_LABELS: Record<ActiveIngredientKey, string> = {
  // Canonical (actives.json classes)
  retinoid: 'Retinoids',
  aha: 'AHA',
  bha: 'BHA',
  pha: 'PHA',
  vitamin_c_pure: 'Vitamin C (Pure)',
  vitamin_c_derivative: 'Vitamin C (Derivative)',
  niacinamide: 'Niacinamide',
  benzoyl_peroxide: 'Benzoyl Peroxide',
  azelaic_acid: 'Azelaic Acid',
  copper_peptides: 'Copper Peptides',
  peptide_signal: 'Signal Peptides',
  peptide_neuro: 'Neuro Peptides',
  spf_filters: 'UV Filters (SPF)',
  ceramides: 'Ceramides',
  hyaluronic_acid: 'Hyaluronic Acid',
  panthenol: 'Panthenol',
  cica: 'Centella (Cica)',
  // Legacy (pre-ruleset persisted tags)
  retinol: 'Retinol',
  vitamin_c: 'Vitamin C',
  spf_chemical: 'SPF (Chemical)',
};

export const FUNCTIONAL_BENEFIT_LABELS: Record<FunctionalBenefit, string> = {
  hydration: 'Hydration',
  exfoliation: 'Exfoliation',
  soothing: 'Soothing',
  anti_acne: 'Anti-Acne',
  barrier_repair: 'Barrier Repair',
  brightening: 'Brightening',
};

/**
 * Maps each "what it does" benefit to the activeTags it matches on. Every key
 * covered by the old ACTIVES_KEYS/SOOTHING_KEYS/HYDRATION_TYPES biomarker lists
 * (see progress/shelf-filtering.md) is preserved here — several keys deliberately
 * appear in more than one bucket (see docs/tech-design/my-shelf-filter-bottomsheet.md
 * Assumptions): retinoid/retinol -> exfoliation, copper_peptides -> barrier_repair,
 * niacinamide -> soothing + brightening. spf_filters/spf_chemical are intentionally
 * excluded — SPF is protection, not a treatment benefit.
 */
export const FUNCTIONAL_BENEFIT_INGREDIENTS: Record<FunctionalBenefit, ActiveIngredientKey[]> = {
  hydration: ['hyaluronic_acid', 'panthenol', 'ceramides'],
  exfoliation: ['aha', 'bha', 'pha', 'retinoid', 'retinol'],
  soothing: ['cica', 'panthenol', 'azelaic_acid', 'niacinamide'],
  anti_acne: ['benzoyl_peroxide', 'azelaic_acid', 'bha'],
  barrier_repair: [
    'ceramides',
    'cica',
    'copper_peptides',
    'peptide_signal',
    'peptide_neuro',
    'panthenol',
  ],
  brightening: ['vitamin_c_pure', 'vitamin_c_derivative', 'vitamin_c', 'niacinamide', 'azelaic_acid'],
};
