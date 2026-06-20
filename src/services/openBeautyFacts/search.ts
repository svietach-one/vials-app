import type { OBFProduct, OBFSearchResponse } from './types';

const OBF_BASE = 'https://world.openbeautyfacts.org/cgi/search.pl';

export interface OBFSearchResult {
  products: OBFProduct[];
  /** true when the request failed (network error, non-2xx, parse error) */
  failed: boolean;
}

/**
 * Search Open Beauty Facts by name/brand query.
 * Never throws — callers must always offer a manual-entry fallback.
 */
export async function searchProducts(query: string): Promise<OBFSearchResult> {
  if (query.trim().length < 3) return { products: [], failed: false };

  try {
    const url =
      `${OBF_BASE}?search_terms=${encodeURIComponent(query.trim())}` +
      `&search_simple=1&action=process&json=1&page_size=10`;

    const response = await fetch(url);
    if (!response.ok) return { products: [], failed: true };

    const data = (await response.json()) as OBFSearchResponse;

    const products = (data.products ?? [])
      .filter(
        (p): p is Required<Pick<typeof p, 'product_name'>> & typeof p =>
          typeof p.product_name === 'string' && p.product_name.length > 0,
      )
      .slice(0, 10)
      .map((p) => ({
        obfId: p._id ?? '',
        name: p.product_name,
        brand: p.brands ?? '',
        ingredientsText: p.ingredients_text ?? '',
      }));

    return { products, failed: false };
  } catch {
    return { products: [], failed: true };
  }
}
