import type { OBFProduct, OBFRawProduct, OBFSearchResponse } from './types';

const OBF_BASE = 'https://world.openbeautyfacts.org/cgi/search.pl';
const OBF_PRODUCT_BASE = 'https://world.openbeautyfacts.org/api/v2/product';

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

/**
 * Look up a single product by its barcode (EAN-13, EAN-8, UPC-A, etc.).
 * Uses the OBF product endpoint directly — faster and more accurate than text search.
 * Never throws — caller must offer a manual-entry fallback.
 */
export async function lookupByBarcode(barcode: string): Promise<OBFSearchResult> {
  const clean = barcode.trim();
  if (!clean) return { products: [], failed: false };

  try {
    const response = await fetch(`${OBF_PRODUCT_BASE}/${encodeURIComponent(clean)}.json`);
    if (!response.ok) return { products: [], failed: true };

    const data = (await response.json()) as { status: number; product?: OBFRawProduct };

    // OBF returns status=1 for found, status=0 for not found
    if (data.status !== 1 || !data.product) return { products: [], failed: false };

    const p = data.product;
    if (!p.product_name) return { products: [], failed: false };

    return {
      products: [{
        obfId: p._id ?? clean,
        name: p.product_name,
        brand: p.brands ?? '',
        ingredientsText: p.ingredients_text ?? '',
      }],
      failed: false,
    };
  } catch {
    return { products: [], failed: true };
  }
}
