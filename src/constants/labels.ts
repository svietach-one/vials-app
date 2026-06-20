import type { ActiveIngredientKey } from '@/types';

export const PRODUCT_TYPE_LABELS: Record<string, string> = {
  cleanser: 'Cleanser',
  toner: 'Toner',
  essence: 'Essence',
  serum: 'Serum',
  gel: 'Gel',
  moisturizer: 'Moisturizer',
  oil: 'Oil',
  spf: 'SPF',
};

export const ACTIVE_INGREDIENT_LABELS: Record<ActiveIngredientKey, string> = {
  retinol: 'Retinol',
  aha: 'AHA',
  bha: 'BHA',
  vitamin_c: 'Vitamin C',
  niacinamide: 'Niacinamide',
  copper_peptides: 'Copper Peptides',
  benzoyl_peroxide: 'Benzoyl Peroxide',
  spf_chemical: 'SPF (Chemical)',
};
