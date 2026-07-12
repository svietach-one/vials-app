import { useProductsStore } from '../../store/productsStore';

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
 * Brand autocomplete source. No local SQLite product database is wired up
 * yet, so this filters the in-memory shelf brands (per task 03's fallback
 * path). The async signature is kept so a local-DB `SELECT DISTINCT brand`
 * implementation can swap in later without touching any calling component.
 * Debounce at the call site (150ms), not here.
 */
export async function searchBrands(query: string): Promise<string[]> {
  const brands = useProductsStore.getState().products.map((p) => p.brand);
  return filterBrandPrefix(brands, query);
}
