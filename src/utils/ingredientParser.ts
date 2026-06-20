import { INCI_INGREDIENT_MAP } from '@/constants/conflictRulesDb';
import { ActiveIngredientKey } from '@/types';

/** Parses INCI ingredient text and returns matched active ingredient keys. */
export function parseActiveIngredientsFromInci(inciText: string): ActiveIngredientKey[] {
  const lower = inciText.toLowerCase();
  const found = new Set<ActiveIngredientKey>();

  for (const [inci, key] of Object.entries(INCI_INGREDIENT_MAP)) {
    if (lower.includes(inci)) {
      found.add(key);
    }
  }

  return [...found];
}

/** Returns active ingredient keys from a product's parsed list and full INCI text. */
export function getProductActiveKeys(product: {
  activeIngredients: { key: ActiveIngredientKey }[];
  fullIngredientText: string | null;
}): ActiveIngredientKey[] {
  const keys = new Set<ActiveIngredientKey>(
    product.activeIngredients.map((ing) => ing.key),
  );

  if (product.fullIngredientText) {
    for (const key of parseActiveIngredientsFromInci(product.fullIngredientText)) {
      keys.add(key);
    }
  }

  return [...keys];
}
