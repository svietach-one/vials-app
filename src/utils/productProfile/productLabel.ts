/**
 * Product Profile builder — shared display-label rule.
 * Extracted from `shelfOverlap.ts` (task 04) so task 06's routine-occupancy
 * labels use the exact same rule instead of a second copy.
 *
 * Pure module: no React, no react-native, no store, no I/O
 * (.claude/rules/architecture-review.md §2).
 */
import type { Product } from '@/types';

/** Display label: brand + name, trimmed; falls back to name alone when brand is null. */
export function labelForProduct(product: Product): string {
  return product.brand ? `${product.brand} ${product.name}`.trim() : product.name;
}
