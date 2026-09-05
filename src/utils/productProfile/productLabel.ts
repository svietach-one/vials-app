/**
 * Product Profile builder — shared display-label rules.
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

/**
 * At most `max` labels, then a `+{n} more` suffix — the shared "cap and
 * summarize" rule behind both `CompositionComparisonMatrix.tsx`'s shelf
 * overlap rows (max 3) and `RoutinePlacementCard.tsx`'s occupancy row (max
 * 2). Extracted after the two components shipped near-identical private
 * copies differing only in the cap, so a future copy/wording change has one
 * place to land instead of two that can silently drift.
 */
export function formatLabelList(labels: string[], max: number): string {
  const shown = labels.slice(0, max);
  const remainder = labels.length - shown.length;
  return remainder > 0 ? [...shown, `+${remainder} more`].join(', ') : shown.join(', ');
}
