import type { RoutineStep } from '@/types';

/**
 * Pure logic for ConflictWarningInline's per-row dismissal on the Routines
 * screen. Unlike collapse (day-scoped, see noticeCollapse.ts), a dismissed
 * row stays hidden only while the routine's own content hasn't changed —
 * the step cards' own reason text still explains the situation once the
 * notice is gone, so nothing is lost, but a real edit (add/remove/reschedule
 * a step) is treated as a fresh situation worth re-surfacing.
 */

/** Order-independent signature for one period's visible steps. */
function periodSignature(steps: RoutineStep[]): string {
  return steps
    .filter((step) => !step.hidden && step.productId)
    .map((step) => `${step.productId}:${[...(step.scheduledDays ?? [])].sort((a, b) => a - b).join('-')}`)
    .sort()
    .join(',');
}

/**
 * Deterministic hash of the routine's current content (both periods).
 * Sorted/order-independent within each period — a manual reorder alone
 * (no product/day change) is not treated as a change worth re-surfacing a
 * dismissed notice for.
 */
export function routineContentHash(morningSteps: RoutineStep[], eveningSteps: RoutineStep[]): string {
  return `${periodSignature(morningSteps)}|${periodSignature(eveningSteps)}`;
}

/** Whether a row dismissed at `dismissedHash` should stay hidden for `currentHash`. */
export function isNoticeDismissed(
  dismissedHash: string | undefined,
  currentHash: string,
): boolean {
  return dismissedHash != null && dismissedHash === currentHash;
}
