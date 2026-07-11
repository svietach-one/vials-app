import type { Period } from '@/constants/rulesets/rulesetTypes';
import type { Product, RoutineStep, SkinConcern } from '@/types';
import type { RoutineContext } from '@/utils/routineEngine/context';
import { collectPrioritizeTargets } from '@/utils/routineEngine/mandates';
import type { ProductFacts } from '@/utils/routineEngine/productFacts';
import { scoreCandidate } from '@/utils/routineEngine/resolve';
import { getSlotIndex } from '@/utils/routineEngine/slotting';

/**
 * Routine-similar-product-priority (Story 1 + Story 3): pure detection and
 * ranking of products that share a layering slot (`LAYERING_ORDER` in
 * slotting.ts). The exempt `other` slot (index 7) never participates — it is
 * a catch-all bucket, not a category, per spec §5.
 *
 * Two call shapes are deliberately NOT unified (tech design Assumption 3):
 * this module operates on already-saved `RoutineStep`s (render time); the
 * engine's own same-slot cap inside `resolve.ts` operates on in-flight
 * `Candidate`/`AdmittedEntry` records during generation. Both reuse
 * `getSlotIndex`/`LAYERING_ORDER` as the single shared similarity primitive.
 */

const OTHER_SLOT_INDEX = 7;

function isSlotEligible(productType: RoutineStep['productType']): boolean {
  return getSlotIndex(productType) !== OTHER_SLOT_INDEX;
}

/**
 * Story 1 pre-check: the first non-hidden step already occupying the same
 * layering slot as `productType`, excluding `excludeProductId` (an exact
 * re-add of the same product must never count as a conflict) and the exempt
 * `other` slot. Null when nothing shares the slot.
 */
export function findSameSlotStep(
  steps: RoutineStep[],
  productType: RoutineStep['productType'],
  excludeProductId?: string,
): RoutineStep | null {
  if (!isSlotEligible(productType)) return null;
  const slotIndex = getSlotIndex(productType);

  return (
    steps.find(
      (step) =>
        !step.hidden &&
        step.productId != null &&
        step.productId !== excludeProductId &&
        isSlotEligible(step.productType) &&
        getSlotIndex(step.productType) === slotIndex,
    ) ?? null
  );
}

/**
 * Story 3 grouping: every set of 2+ non-hidden, product-bearing steps in
 * `steps` sharing a layering slot (the exempt `other` slot never groups).
 * Scoped to ONE routine's steps — duplicate groups never merge across
 * routines/periods (a single moisturizer in AM plus a single moisturizer in
 * PM is not a duplicate). Same hidden/null-productId skip pattern as
 * `dailyView.ts`/`validate.ts`. Ranking is a separate concern (rankSlotGroup).
 */
export function findSlotDuplicateGroups(steps: RoutineStep[]): RoutineStep[][] {
  const bySlot = new Map<number, RoutineStep[]>();

  for (const step of steps) {
    if (step.hidden || step.productId == null) continue;
    if (!isSlotEligible(step.productType)) continue;
    const slotIndex = getSlotIndex(step.productType);
    const group = bySlot.get(slotIndex) ?? [];
    group.push(step);
    bySlot.set(slotIndex, group);
  }

  return [...bySlot.values()].filter((group) => group.length >= 2);
}

/**
 * Story 3 ranking: the group's products ordered best-first on the exact same
 * scale admission uses (`scoreCandidate`: SOS/prioritize boost → concern
 * match → potency → addedAt → id — tie order mirrors `resolve.ts`'s
 * `compareCandidates`). A group member missing from `products` or `facts` is
 * dropped rather than crashing (fail-open, consistent with spec §5's
 * unknown-productType handling). `period` defaults to 'am': the prioritize
 * boost is the only score component it scopes, and existing-duplicate groups
 * are rendered read-only outside the AM/PM resolution loop that owns that
 * context — a reasonable default, not a claim about the group's real period.
 */
export function rankSlotGroup(
  group: RoutineStep[],
  products: Product[],
  facts: Map<string, ProductFacts>,
  context: RoutineContext,
  concerns: SkinConcern[],
  period: Period = 'am',
): Product[] {
  const prioritize = collectPrioritizeTargets(context);

  const scored = group.flatMap((step) => {
    if (!step.productId) return [];
    const product = products.find((p) => p.id === step.productId);
    if (!product) return [];
    const productFacts = facts.get(product.id);
    const score = productFacts
      ? scoreCandidate(product, productFacts, period, concerns, prioritize)
      : 0;
    return [{ product, score }];
  });

  return scored
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.product.addedAt < b.product.addedAt ? 1 : a.product.addedAt > b.product.addedAt ? -1 : 0) ||
        (a.product.id < b.product.id ? -1 : a.product.id > b.product.id ? 1 : 0),
    )
    .map((s) => s.product);
}
