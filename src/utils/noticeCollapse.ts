import type { NoticeCollapseEntry } from '@/types';
import { getSkincareDateString } from '@/utils/timeHelpers';

/**
 * Pure logic for per-row collapse state on the Routines screen's advisory
 * cards (RehabNoticeCard, ConflictWarningInline's rows). A row defaults to
 * expanded the first time it's seen on a given skincare day, but any manual
 * toggle that same day (collapse or re-expand) wins over that default for
 * every re-render/re-visit until the next skincare day.
 */

/**
 * Resolves whether a specific row should render collapsed "now": a decision
 * persisted for the current skincare day wins, whether it was set by an
 * earlier toggle this session or a previous one. No persisted entry, or one
 * from an earlier day, defaults to expanded.
 */
export function resolveNoticeCollapsed(
  persisted: NoticeCollapseEntry | undefined,
  now: Date = new Date(),
): boolean {
  if (persisted && persisted.date === getSkincareDateString(now)) {
    return persisted.collapsed;
  }
  return false;
}

/** Snapshots a collapse decision for persistence, tagged with today's skincare date. */
export function toNoticeCollapseEntry(
  collapsed: boolean,
  now: Date = new Date(),
): NoticeCollapseEntry {
  return { date: getSkincareDateString(now), collapsed };
}
