/**
 * Integration tests for timeHelpers
 *
 * Verifies season boundary dates, the skincare 04:00 day boundary rule,
 * and northern vs southern hemisphere hemisphere detection.
 *
 * Note: getCurrentSeason() reads Intl.DateTimeFormat().resolvedOptions().timeZone
 * for hemisphere detection. In the CI/test environment the timezone is typically
 * a northern hemisphere zone, so southern-hemisphere tests mock Intl explicitly.
 *
 * getSkincareDateString() uses getHours() for the boundary check (local time) but
 * toISOString() for the returned date string (UTC). Tests use relative helpers to
 * stay timezone-agnostic.
 */

import { getCurrentSeason, getSkincareDateString } from '@/utils/timeHelpers';

// ─── Helpers for timezone-agnostic date assertions ────────────────────────────

/**
 * Returns the ISO date string (YYYY-MM-DD) that `toISOString()` produces for the
 * given Date — identical to what getSkincareDateString() returns when getHours() >= 4.
 */
function isoDateOf(d: Date): string {
  return d.toISOString().split('T')[0];
}

/**
 * Returns the ISO date string for the previous local calendar day, then accessed
 * via toISOString() — identical to what getSkincareDateString() returns when
 * getHours() < 4 (i.e., before the skincare day boundary).
 */
function isoDateOfPreviousLocalDay(d: Date): string {
  const yesterday = new Date(d);
  yesterday.setDate(d.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

// ─── getCurrentSeason — northern hemisphere boundary dates ────────────────────

describe('getCurrentSeason — northern hemisphere', () => {
  // month index 0-based: 0=Jan,1=Feb,2=Mar,3=Apr,4=May,5=Jun,
  //                      6=Jul,7=Aug,8=Sep,9=Oct,10=Nov,11=Dec
  // Season map used in source:
  //   winter: 0,1,11
  //   spring: 2,3,4
  //   summer: 5,6,7
  //   autumn: 8,9,10

  it('should return summer for June 1 (first day of summer)', () => {
    const june1 = new Date(2026, 5, 1, 12, 0, 0); // month 5 = June
    expect(getCurrentSeason(june1)).toBe('summer');
  });

  it('should return summer for July 15 (mid-summer)', () => {
    const july15 = new Date(2026, 6, 15, 12, 0, 0);
    expect(getCurrentSeason(july15)).toBe('summer');
  });

  it('should return summer for August 31 (last day of summer)', () => {
    const aug31 = new Date(2026, 7, 31, 12, 0, 0);
    expect(getCurrentSeason(aug31)).toBe('summer');
  });

  it('should return autumn for September 1 (first day of autumn)', () => {
    const sep1 = new Date(2026, 8, 1, 12, 0, 0); // month 8 = September
    expect(getCurrentSeason(sep1)).toBe('autumn');
  });

  it('should return autumn for October 15 (mid-autumn)', () => {
    const oct15 = new Date(2026, 9, 15, 12, 0, 0);
    expect(getCurrentSeason(oct15)).toBe('autumn');
  });

  it('should return autumn for November 30 (last day of autumn)', () => {
    const nov30 = new Date(2026, 10, 30, 12, 0, 0);
    expect(getCurrentSeason(nov30)).toBe('autumn');
  });

  it('should return winter for December 1 (first day of winter)', () => {
    const dec1 = new Date(2026, 11, 1, 12, 0, 0); // month 11 = December
    expect(getCurrentSeason(dec1)).toBe('winter');
  });

  it('should return winter for January 15 (mid-winter)', () => {
    const jan15 = new Date(2026, 0, 15, 12, 0, 0);
    expect(getCurrentSeason(jan15)).toBe('winter');
  });

  it('should return winter for February 28 (last day of winter)', () => {
    const feb28 = new Date(2026, 1, 28, 12, 0, 0);
    expect(getCurrentSeason(feb28)).toBe('winter');
  });

  it('should return spring for March 1 (first day of spring)', () => {
    const mar1 = new Date(2026, 2, 1, 12, 0, 0); // month 2 = March
    expect(getCurrentSeason(mar1)).toBe('spring');
  });

  it('should return spring for April 15 (mid-spring)', () => {
    const apr15 = new Date(2026, 3, 15, 12, 0, 0);
    expect(getCurrentSeason(apr15)).toBe('spring');
  });

  it('should return spring for May 31 (last day of spring)', () => {
    const may31 = new Date(2026, 4, 31, 12, 0, 0);
    expect(getCurrentSeason(may31)).toBe('spring');
  });
});

// ─── getCurrentSeason — southern hemisphere ───────────────────────────────────

describe('getCurrentSeason — southern hemisphere (Australia timezone mock)', () => {
  const originalIntl = Intl.DateTimeFormat;

  beforeEach(() => {
    // Patch Intl so the function believes it is in Australia
    (global as any).Intl = {
      ...Intl,
      DateTimeFormat: function (...args: any[]) {
        const instance = new originalIntl(...args);
        return {
          ...instance,
          resolvedOptions: () => ({
            ...instance.resolvedOptions(),
            timeZone: 'Australia/Sydney',
          }),
          format: instance.format.bind(instance),
          formatToParts: instance.formatToParts.bind(instance),
          formatRange: instance.formatRange?.bind(instance),
          formatRangeToParts: instance.formatRangeToParts?.bind(instance),
        };
      },
    };
    (global as any).Intl.DateTimeFormat.supportedLocalesOf = originalIntl.supportedLocalesOf;
  });

  afterEach(() => {
    (global as any).Intl = originalIntl;
  });

  it('should return winter for June 1 in Australia (opposite of northern summer)', () => {
    const june1 = new Date(2026, 5, 1, 12, 0, 0);
    expect(getCurrentSeason(june1)).toBe('winter');
  });

  it('should return summer for December 1 in Australia (opposite of northern winter)', () => {
    const dec1 = new Date(2026, 11, 1, 12, 0, 0);
    expect(getCurrentSeason(dec1)).toBe('summer');
  });

  it('should return spring for September 1 in Australia (opposite of northern autumn)', () => {
    const sep1 = new Date(2026, 8, 1, 12, 0, 0);
    expect(getCurrentSeason(sep1)).toBe('spring');
  });

  it('should return autumn for March 1 in Australia (opposite of northern spring)', () => {
    const mar1 = new Date(2026, 2, 1, 12, 0, 0);
    expect(getCurrentSeason(mar1)).toBe('autumn');
  });
});

// ─── getSkincareDateString — 04:00 day boundary ───────────────────────────────

describe('getSkincareDateString', () => {
  it('should return the current date when the local time is 04:00 exactly (boundary is inclusive)', () => {
    const at0400 = new Date(2026, 5, 15, 4, 0, 0);
    const result = getSkincareDateString(at0400);
    // 04:00 >= 04:00, so returns toISOString().split('T')[0] of the input date
    expect(result).toBe(isoDateOf(at0400));
  });

  it('should return the current date when the local time is midday', () => {
    const midday = new Date(2026, 5, 15, 12, 0, 0);
    const result = getSkincareDateString(midday);
    expect(result).toBe(isoDateOf(midday));
  });

  it('should return the current date when the local time is 23:59', () => {
    const almostMidnight = new Date(2026, 5, 15, 23, 59, 59);
    const result = getSkincareDateString(almostMidnight);
    expect(result).toBe(isoDateOf(almostMidnight));
  });

  it('should return the previous local day when the local time is 00:00 (before skincare boundary)', () => {
    // 00:00 local — getHours()=0, which is < 4, so still the previous skincare day
    const midnight = new Date(2026, 5, 15, 0, 0, 0);
    const result = getSkincareDateString(midnight);
    expect(result).toBe(isoDateOfPreviousLocalDay(midnight));
  });

  it('should return the previous local day when the local time is 01:30', () => {
    const earlyMorning = new Date(2026, 5, 15, 1, 30, 0);
    const result = getSkincareDateString(earlyMorning);
    expect(result).toBe(isoDateOfPreviousLocalDay(earlyMorning));
  });

  it('should return the previous local day when the local time is 03:59 (one minute before boundary)', () => {
    const justBeforeBoundary = new Date(2026, 5, 15, 3, 59, 0);
    const result = getSkincareDateString(justBeforeBoundary);
    expect(result).toBe(isoDateOfPreviousLocalDay(justBeforeBoundary));
  });

  it('should correctly roll back across a month boundary when 00:30 local falls on the first of the month', () => {
    // Local 00:30 on June 1 — before 04:00, so rolls to the previous local day (May 31)
    const midnightOnFirstOfMonth = new Date(2026, 5, 1, 0, 30, 0);
    const result = getSkincareDateString(midnightOnFirstOfMonth);
    expect(result).toBe(isoDateOfPreviousLocalDay(midnightOnFirstOfMonth));
  });

  it('should return a string matching the YYYY-MM-DD format', () => {
    const date = new Date(2026, 0, 5, 12, 0, 0);
    const result = getSkincareDateString(date);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should return different dates for a time before and after the 04:00 boundary on the same local calendar day', () => {
    const before = new Date(2026, 5, 15, 3, 0, 0); // 03:00 — previous skincare day
    const after = new Date(2026, 5, 15, 5, 0, 0);  // 05:00 — current skincare day

    const resultBefore = getSkincareDateString(before);
    const resultAfter = getSkincareDateString(after);

    expect(resultBefore).not.toBe(resultAfter);
  });
});
