/**
 * Product Profile builder — whole-Shelf active-ingredient overlap.
 * docs/tasks/explore_insights/04-shelf-duplicates.md
 *
 * Unlike `shelfComparison.ts`, this scans the ENTIRE Shelf regardless of
 * category — a niacinamide serum duplicates a niacinamide moisturiser just
 * as surely as it duplicates another serum. Kept as its own module rather
 * than widening `buildShelfComparison` so that function's documented
 * category-filtered contract (spec Story 6 AC2/AC7) stays untouched.
 *
 * Reuses `resolveFromProduct` per Shelf product — the same call
 * `buildShelfComparison` already makes — so there is no new detection logic
 * anywhere in this file.
 *
 * Pure module: no React, no react-native, no store, no I/O
 * (.claude/rules/architecture-review.md §2).
 */
import type { ActiveIngredientKey, Product } from '@/types';
import { resolveFromProduct } from '@/utils/productProfile/resolve';

export interface OverlappingProduct {
  id: string;
  /** Display label: brand + name, trimmed; falls back to name alone when brand is null. */
  label: string;
}

export interface SharedActive {
  key: ActiveIngredientKey;
  products: OverlappingProduct[];
}

function labelFor(product: Product): string {
  return product.brand ? `${product.brand} ${product.name}`.trim() : product.name;
}

/**
 * Which of this composition's actives already appear somewhere on the Shelf,
 * and in which products. Scans the entire Shelf regardless of category. A
 * product with no `fullIngredientText` and no `activeTags` resolves to no
 * keys via `resolveFromProduct` and simply contributes nothing — not
 * special-cased here.
 *
 * Ordering: by `products.length` descending (most-duplicated first), then
 * alphabetically by key ascending as the tiebreak — chosen over an
 * INCI-position tiebreak because there is no single "this composition's
 * position" to compare a Shelf-wide overlap against; alphabetical is stable
 * and requires no extra parameter.
 */
export function buildShelfOverlap(
  activeKeys: ActiveIngredientKey[],
  products: Product[],
): SharedActive[] {
  const activeKeySet = new Set(activeKeys);
  const byKey = new Map<ActiveIngredientKey, OverlappingProduct[]>();

  for (const product of products) {
    const resolved = resolveFromProduct(product);
    for (const key of resolved.resolvedActiveKeys) {
      if (!activeKeySet.has(key)) continue;
      const entry: OverlappingProduct = { id: product.id, label: labelFor(product) };
      const existing = byKey.get(key);
      if (existing) existing.push(entry);
      else byKey.set(key, [entry]);
    }
  }

  const result: SharedActive[] = [...byKey.entries()].map(([key, overlapProducts]) => ({
    key,
    products: overlapProducts,
  }));

  result.sort((a, b) => {
    if (a.products.length !== b.products.length) return b.products.length - a.products.length;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });

  return result;
}
