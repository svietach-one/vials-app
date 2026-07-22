import type { RoutineStep } from '@/types';

/**
 * Pure logic for the Routine list view's Morning/Evening accordions (img-03).
 * Kept out of the screen so the 15:00 rule and the drag-validation rules are
 * unit-testable without rendering.
 */

export type RoutinePeriod = 'morning' | 'evening';

/** Hour (local) at which the screen's default focus flips from AM to PM. */
export const EVENING_SWITCH_HOUR = 15;

export interface AccordionState {
  morning: boolean;
  evening: boolean;
}

/**
 * Initial expanded/collapsed state, decided ONLY on screen mount:
 * before 15:00 → Morning open, Evening closed; from 15:00 → the reverse.
 * Manual toggles win for the rest of the session — the caller must never
 * re-run this on re-render.
 */
export function getInitialAccordionState(now: Date = new Date()): AccordionState {
  const isEvening = now.getHours() >= EVENING_SWITCH_HOUR;
  return { morning: !isEvening, evening: isEvening };
}

// ─── Rows (single-list model) ─────────────────────────────────────────────────

export type RoutineRow =
  | { kind: 'section'; period: RoutinePeriod; count: number; expanded: boolean }
  | { kind: 'step'; period: RoutinePeriod; step: RoutineStep };

/** Stable list key for a row. */
export function routineRowKey(row: RoutineRow): string {
  return row.kind === 'section' ? `section-${row.period}` : row.step.id;
}

/**
 * Flattens both periods into ONE list: a section header per period, followed
 * by its steps when expanded. A single list (rather than two nested ones)
 * keeps exactly one VirtualizedList on screen, so long-press drag never fights
 * an outer scroll container.
 */
export function buildRoutineRows(
  amSteps: RoutineStep[],
  pmSteps: RoutineStep[],
  expanded: AccordionState,
): RoutineRow[] {
  const rows: RoutineRow[] = [];
  rows.push({ kind: 'section', period: 'morning', count: amSteps.length, expanded: expanded.morning });
  if (expanded.morning) {
    for (const step of amSteps) rows.push({ kind: 'step', period: 'morning', step });
  }
  rows.push({ kind: 'section', period: 'evening', count: pmSteps.length, expanded: expanded.evening });
  if (expanded.evening) {
    for (const step of pmSteps) rows.push({ kind: 'step', period: 'evening', step });
  }
  return rows;
}

/**
 * Validates a post-drop row order and extracts the new per-period step order.
 *
 * A step's period after the drop is the period of the nearest section header
 * above it. Cross-section moves (AM→PM) are out of scope, so any step that
 * landed under a different header — or above every header — rejects the whole
 * drop (returns null) and the caller keeps the previous order.
 */
export function resolveDragResult(
  rows: RoutineRow[],
): { morning: RoutineStep[]; evening: RoutineStep[] } | null {
  const result: { morning: RoutineStep[]; evening: RoutineStep[] } = { morning: [], evening: [] };
  let current: RoutinePeriod | null = null;

  for (const row of rows) {
    if (row.kind === 'section') {
      current = row.period;
      continue;
    }
    // A step dragged above the first header, or into the other period.
    if (current === null || current !== row.period) return null;
    result[current].push(row.step);
  }

  return result;
}

/**
 * Merges a reordered VISIBLE subset back into the routine's full step list,
 * leaving steps filtered out of the view (hidden, clinically frozen, or not
 * scheduled for the selected day) at their original positions. Returns null
 * when the subset doesn't line up, so the caller can skip the write.
 */
export function mergeReorderedSteps(
  allSteps: RoutineStep[],
  reorderedVisible: RoutineStep[],
): RoutineStep[] | null {
  const visibleIds = new Set(reorderedVisible.map((s) => s.id));
  const merged: RoutineStep[] = [];
  let idx = 0;

  for (const step of allSteps) {
    if (visibleIds.has(step.id)) {
      merged.push(reorderedVisible[idx++]);
    } else {
      merged.push(step);
    }
  }

  return idx === reorderedVisible.length ? merged : null;
}
