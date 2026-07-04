import type { ActiveIngredientKey, ProductType } from '@/types';

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
