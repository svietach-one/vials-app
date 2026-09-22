import { useProductsStore } from '../../store/productsStore';
import { ProductRepository } from '../../services/corpus/ProductRepository';
import { createTursoHttpClient } from '../../services/turso/httpClient';
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

/**
 * Same suggestion set as `searchBrands`, plus the full remote corpus
 * (~21k products, queried live via `ProductRepository.searchBrands` —
 * `docs/database` — not just the user's own Shelf + the static seed
 * dictionary). Deliberately a SEPARATE export, not folded into `searchBrands`
 * itself: `ExploreCompositionResultScreen.tsx`'s Save-to-Wishlist modal must
 * stay local-only (spec §3 Non-Goals — "never a corpus/ProductRepository
 * lookup", the identity-matching guardrail that flow otherwise avoids), so
 * it keeps calling plain `searchBrands`. This corpus-backed variant is for
 * screens with no such restriction, e.g. `ManualProductFormScreen.tsx` (used
 * by the ordinary "Add new" wizard as well as Explore Composition's own
 * "Put on Shelf"/"Move to Shelf" completion step, which is a genuine manual
 * product-identification step, not the composition-analysis flow itself).
 * Corpus is queried over Turso HTTP (no local SQLite file — see
 * `src/services/turso/httpClient.ts`); if `EXPO_PUBLIC_TURSO_HTTP_URL`/
 * `EXPO_PUBLIC_TURSO_TOKEN` aren't configured, `createTursoHttpClient()`
 * returns `null` and this silently falls back to the local-only result set
 * (never blocks typing a brand by hand). Local (shelf + dictionary) results
 * are listed first, then corpus results, deduped case-insensitively.
 */
export async function searchBrandsWithCorpus(query: string): Promise<string[]> {
  const local = await searchBrands(query);

  const client = createTursoHttpClient();
  if (!client) return local;

  const corpusBrands = await new ProductRepository(client).searchBrands(query);
  const seen = new Set(local.map((b) => b.toLowerCase()));
  const merged = [...local];
  for (const brand of corpusBrands) {
    const key = brand.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(brand);
  }
  return merged.slice(0, 8);
}
