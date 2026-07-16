import type { ProductType } from '../../types';

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
  [/\bclean(s|z)er|\bwash\b|nettoyant|\blavant\b|d[ée]maquillant|myjąc|oczyszczając/i, 'cleanser'],
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
