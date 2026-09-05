/**
 * Product Profile builder — routine phase occupancy.
 * docs/tasks/explore_insights/06-routine-gap-spf.md
 *
 * Which real, visible Shelf products already occupy the layering phase a
 * captured composition maps to (`RoutinePosition.layeringOrder`). A phase
 * question, not a single-`ProductType` one — several `ProductType`s share a
 * slot (e.g. serum/gel both slot 6, per `LAYERING_ORDER`).
 *
 * Extracted out of `useCompositionInsights.ts` (originally inlined there) so
 * this rule has the same direct, independent unit-test surface as its
 * siblings in this folder (`buildShelfOverlap`, `getMorningSpfState`) rather
 * than being reachable only via `renderHook` + mocked Zustand stores.
 *
 * Pure module: no React, no react-native, no store, no I/O
 * (.claude/rules/architecture-review.md §2).
 */
import { LAYERING_ORDER } from '@/constants/rulesets/productFacts';
import type { Product, Routine } from '@/types';
import { labelForProduct } from '@/utils/productProfile/productLabel';

export interface RoutineOccupant {
  id: string;
  label: string;
}

/**
 * Steps across ALL routines whose `productType` shares `targetPhase`'s
 * layering slot, resolved against a real, non-hidden Shelf product. A
 * hidden step, a null `productId`, a dangling `productId`, and a hidden
 * product all contribute nothing. `targetPhase === null` (the composition's
 * own type/classes aren't represented in the layering table) always yields
 * no occupants — there is no phase to match against.
 */
export function findRoutineOccupants(
  targetPhase: number | null,
  routines: Routine[],
  products: Product[],
): RoutineOccupant[] {
  if (targetPhase === null) return [];

  const occupants: RoutineOccupant[] = [];
  for (const routine of routines) {
    for (const step of routine.steps) {
      if (step.hidden || !step.productId) continue;
      if (LAYERING_ORDER[step.productType] !== targetPhase) continue;
      const product = products.find((p) => p.id === step.productId);
      if (!product || product.isHidden) continue;
      occupants.push({ id: product.id, label: labelForProduct(product) });
    }
  }
  return occupants;
}
