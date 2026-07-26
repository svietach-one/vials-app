import { resolveRehabNoticeCollapsed, toRehabNoticeCollapseEntry } from '@/utils/rehabNoticeCollapse';
import { getSkincareDateString } from '@/utils/timeHelpers';
import type { RehabNoticeCollapseEntry } from '@/types';

/**
 * Unit tests — RehabNoticeCard's per-day collapse persistence. Dates are
 * injected, never read from the clock (testing.md).
 */

function at(hour: number): Date {
  return new Date(2026, 6, 19, hour, 0, 0);
}

describe('resolveRehabNoticeCollapsed', () => {
  it('defaults to expanded when there is no persisted entry for this notice', () => {
    expect(resolveRehabNoticeCollapsed(undefined, at(9))).toBe(false);
  });

  it('reuses a manual collapse persisted earlier the same skincare day', () => {
    const persisted: RehabNoticeCollapseEntry = {
      date: getSkincareDateString(at(9)),
      collapsed: true,
    };

    expect(resolveRehabNoticeCollapsed(persisted, at(18))).toBe(true);
  });

  it('reuses a manual re-expand persisted earlier the same skincare day', () => {
    const persisted: RehabNoticeCollapseEntry = {
      date: getSkincareDateString(at(9)),
      collapsed: false,
    };

    expect(resolveRehabNoticeCollapsed(persisted, at(18))).toBe(false);
  });

  it('discards a snapshot from a previous skincare day and defaults back to expanded', () => {
    const yesterday = new Date(2026, 6, 18, 20, 0, 0);
    const persisted: RehabNoticeCollapseEntry = {
      date: getSkincareDateString(yesterday),
      collapsed: true,
    };

    expect(resolveRehabNoticeCollapsed(persisted, at(9))).toBe(false);
  });
});

describe('toRehabNoticeCollapseEntry', () => {
  it('tags the given collapsed value with the skincare date for "now"', () => {
    expect(toRehabNoticeCollapseEntry(true, at(16))).toEqual({
      date: getSkincareDateString(at(16)),
      collapsed: true,
    });
  });
});
