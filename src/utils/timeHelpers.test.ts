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
 * getSkincareDateString() and getElapsedDays() work on the LOCAL calendar, so
 * their tests assert literal dates built from local components and hold in
 * any TZ (run with TZ=Europe/Warsaw / America/Los_Angeles to check).
 */

import { getCurrentSeason, getElapsedDays, getSkincareDateString } from '@/utils/timeHelpers';

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
  it.each([
    ['04:00 exactly (boundary is inclusive)', new Date(2026, 5, 15, 4, 0), '2026-06-15'],
    ['midday', new Date(2026, 5, 15, 12, 0), '2026-06-15'],
    ['23:59', new Date(2026, 5, 15, 23, 59, 59), '2026-06-15'],
    ['18:00 (evening, west of UTC)', new Date(2026, 9, 16, 18, 0), '2026-10-16'],
    ['00:00 (before the boundary)', new Date(2026, 5, 15, 0, 0), '2026-06-14'],
    ['01:00 (two hours past midnight in UTC+2)', new Date(2026, 9, 16, 1, 0), '2026-10-15'],
    ['01:30', new Date(2026, 5, 15, 1, 30), '2026-06-14'],
    ['03:59 (one minute before the boundary)', new Date(2026, 5, 15, 3, 59), '2026-06-14'],
    ['00:30 on the 1st of a month', new Date(2026, 5, 1, 0, 30), '2026-05-31'],
    ['00:30 on 1 January', new Date(2026, 0, 1, 0, 30), '2025-12-31'],
  ])('returns the local skincare day at %s', (_label, now, expected) => {
    expect(getSkincareDateString(now)).toBe(expected);
  });

  it('returns different dates before and after the 04:00 boundary on the same calendar day', () => {
    expect(getSkincareDateString(new Date(2026, 5, 15, 3, 0))).not.toBe(
      getSkincareDateString(new Date(2026, 5, 15, 5, 0)),
    );
  });
});

// ─── getElapsedDays — whole local calendar days ───────────────────────────────

describe('getElapsedDays', () => {
  it.each([
    ['00:30 the next day', new Date(2026, 9, 16, 0, 30), 1],
    ['01:00 the next day', new Date(2026, 9, 16, 1, 0), 1],
    ['12:00 the next day', new Date(2026, 9, 16, 12, 0), 1],
    ['18:00 the same day', new Date(2026, 9, 15, 18, 0), 0],
    ['23:59 the same day', new Date(2026, 9, 15, 23, 59), 0],
    ['noon a week later', new Date(2026, 9, 22, 12, 0), 7],
  ])('counts whole days from 2026-10-15 at %s', (_label, now, expected) => {
    expect(getElapsedDays('2026-10-15', now)).toBe(expected);
  });

  it('counts across a DST change as whole calendar days', () => {
    // EU clocks go back on 2026-10-25; the 25th has 25 hours
    expect(getElapsedDays('2026-10-24', new Date(2026, 9, 26, 0, 30))).toBe(2);
  });

  it('counts across the spring DST change (a 23-hour day) as whole calendar days', () => {
    // EU clocks go forward on 2026-03-29; US on 2026-03-08
    expect(getElapsedDays('2026-03-28', new Date(2026, 2, 30, 0, 30))).toBe(2);
    expect(getElapsedDays('2026-03-07', new Date(2026, 2, 9, 0, 30))).toBe(2);
  });

  it('returns a negative count for a future date', () => {
    expect(getElapsedDays('2026-10-17', new Date(2026, 9, 16, 12, 0))).toBe(-1);
  });
});
