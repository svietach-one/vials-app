import type { DecisionReasonCode } from '@/constants/decisionReasons';
import type { Product, Routine } from '@/types';
import { isOwnedProduct } from '@/utils/productOwnership';
import type { RoutinePlan } from '@/utils/routineEngine/generate';

/**
 * "Not in your routine" (intermediate-routine, spec Story 4): every owned
 * shelf product that has no visible saved step, with the reason it is not one.
 *
 * Pure — it reads the plan the Routines screen already derives from the owned
 * shelf and the saved routines it is handed; it owns no state. That makes the
 * list agree with the Draft Preview by construction (same buckets).
 *
 * Kinds, in precedence order (also the list order):
 *   ready       a fresh draft would schedule it (in either period)
 *   reserve     the engine kept it back, with a reason code
 *   frozen      paused (clinical, pregnancy, expired, pair rule), maybe with an expiry
 *   alternative the loser of a same-slot contest — a backup for the winner
 */
export type LeftOutKind = 'ready' | 'reserve' | 'frozen' | 'alternative';

export interface LeftOutItem {
  productId: string;
  kind: LeftOutKind;
  /** Reserve/frozen reason; null for `ready` and `alternative`. */
  reasonCode: DecisionReasonCode | null;
  /** Skincare date a frozen item's pause ends, when it has one. */
  until?: string;
}

const KIND_ORDER: LeftOutKind[] = ['ready', 'reserve', 'frozen', 'alternative'];

/** Product ids with at least one VISIBLE (non-hidden) step in any routine. */
function visiblySavedIds(routines: Routine[]): Set<string> {
  const saved = new Set<string>();
  for (const routine of routines) {
    for (const step of routine.steps) {
      if (step.productId && !step.hidden) saved.add(step.productId);
    }
  }
  return saved;
}

function classify(plan: RoutinePlan, productId: string): LeftOutItem {
  const scheduled =
    plan.periods.morning.some((s) => s.productId === productId) ||
    plan.periods.evening.some((s) => s.productId === productId);
  if (scheduled) return { productId, kind: 'ready', reasonCode: null };

  const reserve = plan.reserve.find((r) => r.productId === productId);
  if (reserve) return { productId, kind: 'reserve', reasonCode: reserve.reasonCode };

  const frozen = plan.frozen.find((f) => f.productId === productId);
  if (frozen) {
    return {
      productId,
      kind: 'frozen',
      reasonCode: frozen.reasonCode,
      ...(frozen.until ? { until: frozen.until } : {}),
    };
  }

  const isBackup = (plan.slotAlternatives ?? []).some((entry) =>
    entry.alternatives.some((alt) => alt.productId === productId),
  );
  if (isBackup) return { productId, kind: 'alternative', reasonCode: null };

  // Unreachable while the Phase 9 accountability invariant holds (every
  // non-hidden product lands in a plan bucket); a total function keeps a future
  // engine regression visible as a row instead of a silent omission.
  return { productId, kind: 'reserve', reasonCode: 'not_needed_for_goals' };
}

/**
 * A product is listed iff it is owned, not hidden on the shelf, and has no
 * non-hidden saved step in either routine on any weekday. A removed step and a
 * hidden step both count as "no step" (owner decision Q6): after a removal the
 * product shows here as "ready" again. The list is per product, so a product
 * that is saved in one period, or on some weekdays only, is not listed.
 */
export function buildLeftOutItems(
  plan: RoutinePlan,
  products: Product[],
  routines: Routine[],
): LeftOutItem[] {
  const saved = visiblySavedIds(routines);
  const items = products
    .filter((p) => isOwnedProduct(p) && p.isHidden !== true && !saved.has(p.id))
    .map((p) => classify(plan, p.id));
  // Stable sort: shelf order is preserved within a kind.
  return KIND_ORDER.flatMap((kind) => items.filter((i) => i.kind === kind));
}
