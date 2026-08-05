import type { ActiveIngredientKey, BarrierIngredientKey } from '@/types';
import { normalizeActiveKey, parseActiveIngredientDetails } from '@/utils/ingredientParser';

/**
 * Barrier / humectant ingredient detection (PRD v1.2 §5.2).
 *
 * Deliberately a SEPARATE function with a SEPARATE output type from
 * `parseActiveIngredientsFromInci`: barrier tags are presence-only signals for
 * the recommendation layer (density insights, "no penalty for" documentation,
 * the Hydration shelf pill) and must never be merged into an
 * ActiveIngredientKey[] that could reach the pairwise conflict matrix.
 *
 * Most barrier groups already exist as classes in actives.json, so their
 * patterns — and their INCI position gates — are reused rather than
 * re-declared; only Zinc PCA, which the ruleset does not model, carries a local
 * matcher here.
 */

/** actives.json classes that ARE barrier groups, mapped to the barrier key space. */
const ACTIVE_KEY_TO_BARRIER: Partial<Record<ActiveIngredientKey, BarrierIngredientKey>> = {
  ceramides: 'CERA',
  panthenol: 'PANT',
  glycerin_class: 'GLYC',
  niacinamide: 'NIAC',
  hyaluronic_acid: 'HYAL',
};

/**
 * Zinc PCA has no actives.json class: it is neither a conflict-grade active
 * nor a routine-engine input, and it only matters as a "no penalty for"
 * ingredient under seborrheic dermatitis (§4.2.2). Kept local so adding it
 * cannot perturb the routine engine's class table.
 */
const ZINC_PCA_PATTERN = /\bzinc\s+(pca|pyrrolidone\s+carboxylate)\b/i;

/** Parses INCI text into presence-only barrier ingredient keys. */
export function parseBarrierTags(inci: string): BarrierIngredientKey[] {
  const found = new Set<BarrierIngredientKey>();

  for (const detail of parseActiveIngredientDetails(inci)) {
    const barrier = ACTIVE_KEY_TO_BARRIER[detail.key];
    if (barrier) found.add(barrier);
  }

  if (ZINC_PCA_PATTERN.test(inci)) found.add('ZPCA');

  return [...found];
}

/**
 * Barrier keys for a product, from its wizard-confirmed tags and its raw INCI
 * text. Mirrors `getProductActiveKeys`'s contract (confirmed tags are
 * authoritative, parsed text is additive) in the barrier key space.
 */
export function getProductBarrierTags(product: {
  activeIngredients: { key: ActiveIngredientKey }[];
  activeTags?: ActiveIngredientKey[];
  fullIngredientText: string | null;
}): BarrierIngredientKey[] {
  const found = new Set<BarrierIngredientKey>();

  const declared = [
    ...product.activeIngredients.map((ing) => ing.key),
    ...(product.activeTags ?? []),
  ];
  for (const key of declared) {
    const barrier = ACTIVE_KEY_TO_BARRIER[normalizeActiveKey(key)];
    if (barrier) found.add(barrier);
  }

  if (product.fullIngredientText) {
    for (const key of parseBarrierTags(product.fullIngredientText)) found.add(key);
  }

  return [...found];
}
