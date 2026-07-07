import type { ActiveBadgeCategory, ActiveIngredientKey, Product } from '@/types';

/**
 * Category buckets, each listing every key that belongs to it. Doubles as the
 * fixed render-priority order consumed by getProductActiveBadgeKeys() so a
 * product's badges render in the same left-to-right order on every render,
 * regardless of the insertion order of its source arrays.
 *
 * NOTE: this module's getProductActiveBadgeKeys() is intentionally named
 * differently from the existing src/utils/ingredientParser.ts:getProductActiveKeys().
 * That function unions activeIngredients + activeTags + INCI-text parsing
 * (safety-first, used by the conflict engine) — a different, broader
 * question than "what should render as a badge." This module answers a
 * narrower display-only question: activeTags-wins-when-defined precedence,
 * no INCI parsing, so a user's explicit "zero confirmed actives" (activeTags:
 * []) renders zero badges even when stale activeIngredients data lingers
 * (spec Story 1 AC3). Reusing the same name across the two modules would
 * invite accidentally importing the wrong one for the wrong purpose.
 */
const CATEGORY_KEYS: Record<ActiveBadgeCategory, ActiveIngredientKey[]> = {
  exfoliant: [
    'retinoid',
    'retinol',
    'aha',
    'bha',
    'pha',
    'benzoyl_peroxide',
    'azelaic_acid',
    'vitamin_c_pure',
    'vitamin_c_derivative',
    'vitamin_c',
  ],
  soothing: ['niacinamide', 'copper_peptides', 'cica', 'panthenol'],
  hydrator: ['ceramides', 'hyaluronic_acid'],
  other: ['spf_filters', 'spf_chemical'],
};

const CATEGORY_ORDER: ActiveBadgeCategory[] = ['exfoliant', 'soothing', 'hydrator', 'other'];

/** key -> category, built once from CATEGORY_KEYS so the mapping stays single-sourced. */
const KEY_TO_CATEGORY = new Map<ActiveIngredientKey, ActiveBadgeCategory>();
for (const category of CATEGORY_ORDER) {
  for (const key of CATEGORY_KEYS[category]) {
    KEY_TO_CATEGORY.set(key, category);
  }
}

/** key -> fixed sort priority, built once from CATEGORY_KEYS's category-then-key order. */
const KEY_PRIORITY = new Map<ActiveIngredientKey, number>();
let priorityIndex = 0;
for (const category of CATEGORY_ORDER) {
  for (const key of CATEGORY_KEYS[category]) {
    KEY_PRIORITY.set(key, priorityIndex);
    priorityIndex += 1;
  }
}

/** Any key outside the exfoliant/soothing/hydrator buckets falls into 'other'. */
export function getActiveBadgeCategory(key: ActiveIngredientKey): ActiveBadgeCategory {
  return KEY_TO_CATEGORY.get(key) ?? 'other';
}

/**
 * Returns the active-ingredient keys a shelf card should render one badge
 * for. Preserves the existing precedence rule (previously applied only to
 * index [0]): activeTags wins whenever it is defined, even when empty —
 * activeIngredients is read only when activeTags is undefined. Deduped and
 * sorted by a fixed category-then-key priority so output is stable across
 * renders regardless of source-array insertion order.
 */
export function getProductActiveBadgeKeys(
  product: Pick<Product, 'activeTags' | 'activeIngredients'>,
): ActiveIngredientKey[] {
  const rawKeys =
    product.activeTags !== undefined
      ? product.activeTags
      : product.activeIngredients.map((ingredient) => ingredient.key);

  const dedupedKeys = [...new Set(rawKeys)];

  return dedupedKeys.sort((a, b) => {
    const priorityA = KEY_PRIORITY.get(a) ?? Number.MAX_SAFE_INTEGER;
    const priorityB = KEY_PRIORITY.get(b) ?? Number.MAX_SAFE_INTEGER;
    return priorityA - priorityB;
  });
}
