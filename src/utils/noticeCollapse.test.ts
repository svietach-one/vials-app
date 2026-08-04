import { resolveNoticeCollapsed, toNoticeCollapseEntry } from '@/utils/noticeCollapse';
import { getSkincareDateString } from '@/utils/timeHelpers';
import type { NoticeCollapseEntry } from '@/types';

/**
 * Unit tests — the Routines screen advisory rows' per-day collapse
 * persistence (RehabNoticeCard, ConflictWarningInline).
 * Dates are injected, never read from the clock (testing.md).
 */

function at(hour: number): Date {
  return new Date(2026, 6, 19, hour, 0, 0);
}

describe('resolveNoticeCollapsed', () => {
  it('defaults to expanded when there is no persisted entry for this row', () => {
    expect(resolveNoticeCollapsed(undefined, at(9))).toBe(false);
  });

  it('reuses a manual collapse persisted earlier the same skincare day', () => {
    const persisted: NoticeCollapseEntry = {
      date: getSkincareDateString(at(9)),
      collapsed: true,
    };

    expect(resolveNoticeCollapsed(persisted, at(18))).toBe(true);
  });

  it('reuses a manual re-expand persisted earlier the same skincare day', () => {
    const persisted: NoticeCollapseEntry = {
      date: getSkincareDateString(at(9)),
      collapsed: false,
    };

    expect(resolveNoticeCollapsed(persisted, at(18))).toBe(false);
  });

  it('discards a snapshot from a previous skincare day and defaults back to expanded', () => {
    const yesterday = new Date(2026, 6, 18, 20, 0, 0);
    const persisted: NoticeCollapseEntry = {
      date: getSkincareDateString(yesterday),
      collapsed: true,
    };

    expect(resolveNoticeCollapsed(persisted, at(9))).toBe(false);
  });
});

describe('toNoticeCollapseEntry', () => {
  it('tags the given collapsed value with the skincare date for "now"', () => {
    expect(toNoticeCollapseEntry(true, at(16))).toEqual({
      date: getSkincareDateString(at(16)),
      collapsed: true,
    });
  });
});
