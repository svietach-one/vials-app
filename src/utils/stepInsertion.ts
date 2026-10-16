import type { RoutineStep } from '@/types';
import { getSlotIndex } from '@/utils/routineEngine/slotting';

/**
 * Where a manually added step lands in a routine.
 *
 * `upsertProductStep` used to append every new step at the END, so adding an
 * SPF first and then a toner and a moisturizer left the SPF in the middle of
 * the routine (field report 2026-10-16). The step now goes BEFORE the first
 * existing step whose layering index is higher than its own, and at the end
 * when none is — so an SPF (the last layer) is always last, a toner lands
 * before the creams, and steps on the same layer keep add-order.
 *
 * Only the NEW step is positioned. Existing steps are never re-sorted, so a
 * manual drag-reorder the user already made is left exactly as it is.
 * Pure — returns a new array.
 */
export function insertStepByLayering(steps: RoutineStep[], step: RoutineStep): RoutineStep[] {
  const layer = getSlotIndex(step.productType);
  const at = steps.findIndex((existing) => getSlotIndex(existing.productType) > layer);
  if (at === -1) return [...steps, step];
  return [...steps.slice(0, at), step, ...steps.slice(at)];
}
