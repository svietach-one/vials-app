import type { ProductType } from '../../types';

/**
 * First match wins, so ambiguous labels resolve to the earlier pattern
 * (e.g. "sunscreen serum" → 'serum', not 'spf'). Deliberately kept naive:
 * the category pill is always user-overridable, so a wrong guess costs one
 * tap. Detected types stay within the wizard's fixed 8-option pill row
 * (CategoryPillRow), which is why "cream" maps to 'moisturizer' rather
 * than the catalog's separate 'cream' type.
 */
const CATEGORY_PATTERNS: Array<[RegExp, ProductType]> = [
  [/\bserum\b/i, 'serum'],
  [/\bcream\b|moistur/i, 'moisturizer'],
  [/\bclean(s|z)er|\bwash\b/i, 'cleanser'],
  [/\btoner|tonic\b/i, 'toner'],
  [/\bspf\s?\d+|sunscreen|sun\s?screen/i, 'spf'],
  [/\bmask\b/i, 'mask'],
  [/\boil\b/i, 'oil'],
  [/\bexfoliant|peeling|scrub/i, 'peeling'],
];

export function detectCategory(rawOcrText: string): ProductType | null {
  for (const [pattern, type] of CATEGORY_PATTERNS) {
    if (pattern.test(rawOcrText)) return type;
  }
  return null;
}
