import { useProductsStore } from '../../store/productsStore';
import { detectScript } from './brandCorrection';
import { CYRILLIC_BRAND_DICTIONARY, LATIN_BRAND_DICTIONARY } from './brandDictionary';

/** Pure prefix filter over a brand list — the unit-testable core. */
export function filterBrandPrefix(brands: Array<string | null>, query: string): string[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];
  const unique = [
    ...new Set(brands.filter((b): b is string => b !== null && b.trim().length > 0)),
  ];
  return unique.filter((b) => b.toLowerCase().startsWith(q)).slice(0, 5);
}

/**
 * Brand autocomplete source: the user's own shelf brands (most relevant —
 * products they already own) plus the script-matching seed dictionary
 * (LATIN_BRAND_DICTIONARY / CYRILLIC_BRAND_DICTIONARY, per
 * docs/specs/ocr-brand-dictionary-reference.md), so typing a known brand
 * — Cyrillic or Latin — surfaces a suggestion from the first letter even
 * before the user has ever added a matching product. Shelf brands are
 * listed first (filterBrandPrefix dedupes case-insensitively, keeping
 * whichever spelling appears first). No local SQLite product database is
 * wired up yet; the async signature is kept so a local-DB
 * `SELECT DISTINCT brand` implementation can swap in later without
 * touching any calling component. Debounce at the call site (150ms), not
 * here.
 */
export async function searchBrands(query: string): Promise<string[]> {
  const shelfBrands = useProductsStore.getState().products.map((p) => p.brand);
  const script = detectScript(query);
  const dictionary =
    script === 'cyrillic' ? CYRILLIC_BRAND_DICTIONARY : script === 'latin' ? LATIN_BRAND_DICTIONARY : [];
  return filterBrandPrefix([...shelfBrands, ...dictionary], query);
}
