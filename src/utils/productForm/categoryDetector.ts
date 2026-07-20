import type { Product, ProductType } from '../../types';

/**
 * A surfactant-based makeup/SPF remover (micellar water, cleansing oil/balm,
 * démaquillant). These are pre-cleanse products — they do not rinse clean and
 * are not a standalone cleanse — so they must be classified apart from a
 * gentle rinse-off cleanser. Matched ahead of the generic cleanser pattern.
 */
const MAKEUP_REMOVER_PATTERN =
  /\bmicellar\b|cleansing\s+(oil|balm|water)|makeup\s*-?\s*remov|make-?up\s*-?\s*remov|d[ée]maquillant/i;

/** True when a product's name reads as a makeup remover / pre-cleanse. */
export function isMakeupRemoverName(text: string): boolean {
  return MAKEUP_REMOVER_PATTERN.test(text);
}

/**
 * Read-time classification guard: a product typed as a plain `cleanser` whose
 * name reads as a micellar water / cleansing oil / cleansing balm / makeup
 * remover is reclassified to `makeup_remover`. Catches mistyped DB/corpus
 * imports so the pre_cleanse slot + follow-up rule are not silently missed.
 * Pure — returns the same reference when no change is needed.
 */
export function reclassifyMakeupRemover(product: Product): Product {
  if (product.productType !== 'cleanser') return product;
  if (!isMakeupRemoverName(product.name)) return product;
  return { ...product, productType: 'makeup_remover' };
}

/**
 * First match wins, so ambiguous labels resolve to the earlier pattern
 * (e.g. "sunscreen serum" → 'serum', not 'spf'). Deliberately kept naive:
 * the category pill is always user-overridable, so a wrong guess costs one
 * tap. Detected types stay within the wizard's fixed 8-option pill row
 * (CategoryPillRow), which is why "cream" maps to 'moisturizer' rather
 * than the catalog's separate 'cream' type.
 *
 * French/Polish keywords come from LATIN_COMMON_TERMS (brandDictionary.ts,
 * spec section 5) mapped onto the same 8 pills — the flat per-language term
 * lists carry no category mapping, so that mapping is encoded here. Stems
 * are used where the language inflects ("nawilżając" covers "nawilżający"/
 * "nawilżająca"), and \b is kept away from non-ASCII letters, where JS's
 * ASCII-only word boundary misbehaves.
 */
const CATEGORY_PATTERNS: Array<[RegExp, ProductType]> = [
  [/\bs[ée]rum\b/i, 'serum'],
  [/\bcream\b|moistur|cr[èe]me|hydratant|\bkrem\b|nawilżając/i, 'moisturizer'],
  // Makeup removers before the generic cleanser rule — a pre-cleanse, not a cleanse.
  [MAKEUP_REMOVER_PATTERN, 'makeup_remover'],
  [/\bclean(s|z)er|\bwash\b|nettoyant|\blavant\b|myjąc|oczyszczając/i, 'cleanser'],
  [/\btoner|toni(c|k|que)\b/i, 'toner'],
  [/\bspf\s?\d+|sunscreen|sun\s?screen|[ée]cran solaire|przeciwsłoneczn/i, 'spf'],
  [/\bmask\b|\bmask[aęi]\b|\bmasque\b|maseczk/i, 'mask'],
  [/\boil\b|\bhuile\b|\bolej/i, 'oil'],
  [/\bexfoliant|peeling|scrub|gommage|złuszczając/i, 'peeling'],
];

export function detectCategory(rawOcrText: string): ProductType | null {
  for (const [pattern, type] of CATEGORY_PATTERNS) {
    if (pattern.test(rawOcrText)) return type;
  }
  return null;
}
