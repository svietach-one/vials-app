import type { RehabNoticeCollapseEntry } from '@/types';
import { getSkincareDateString } from '@/utils/timeHelpers';

/**
 * Pure logic for RehabNoticeCard's per-procedure collapse state on the
 * Routines screen. Mirrors routineAccordion.ts's day-scoped persistence: a
 * card defaults to expanded the first time it's seen on a given skincare
 * day, but any manual toggle that same day (collapse or re-expand) wins over
 * that default for every re-render/re-visit until the next skincare day.
 */

/**
 * Resolves whether a specific rehab notice should render collapsed "now": a
 * decision persisted for the current skincare day wins, whether it was set
 * by an earlier toggle this session or a previous one. No persisted entry,
 * or one from an earlier day, defaults to expanded.
 */
export function resolveRehabNoticeCollapsed(
  persisted: RehabNoticeCollapseEntry | undefined,
  now: Date = new Date(),
): boolean {
  if (persisted && persisted.date === getSkincareDateString(now)) {
    return persisted.collapsed;
  }
  return false;
}

/** Snapshots a collapse decision for persistence, tagged with today's skincare date. */
export function toRehabNoticeCollapseEntry(
  collapsed: boolean,
  now: Date = new Date(),
): RehabNoticeCollapseEntry {
  return { date: getSkincareDateString(now), collapsed };
}
