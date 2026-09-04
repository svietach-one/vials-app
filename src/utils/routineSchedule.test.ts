import { dateForDow, getWeekStart, isScheduledOnDay } from '@/utils/routineSchedule';

describe('isScheduledOnDay', () => {
  it('treats an empty scheduledDays array as every day', () => {
    expect(isScheduledOnDay([], 3)).toBe(true);
  });

  it('treats undefined scheduledDays as every day', () => {
    expect(isScheduledOnDay(undefined, 3)).toBe(true);
  });

  it('returns true only for days explicitly listed', () => {
    expect(isScheduledOnDay([1, 3, 5], 3)).toBe(true);
    expect(isScheduledOnDay([1, 3, 5], 2)).toBe(false);
  });
});

describe('getWeekStart', () => {
  it('returns the same Monday for every day of a Mon-start week', () => {
    // 2026-08-24 is a Monday, 2026-08-30 is the following Sunday.
    const monday = new Date('2026-08-24T10:00:00');
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      expect(getWeekStart(d).toDateString()).toBe(monday.toDateString());
    }
  });
});

describe('dateForDow', () => {
  const WEDNESDAY = new Date('2026-08-26T10:00:00'); // mid-week anchor

  it('returns today for the current day-of-week', () => {
    expect(dateForDow(WEDNESDAY.getDay(), WEDNESDAY).toDateString()).toBe(WEDNESDAY.toDateString());
  });

  it('returns a date earlier in the same week for an earlier day-of-week', () => {
    const tuesday = dateForDow(2, WEDNESDAY); // Tue = dow 2
    expect(tuesday.getTime()).toBeLessThan(WEDNESDAY.getTime());
    expect(WEDNESDAY.getTime() - tuesday.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('returns a date later in the same week for a later day-of-week', () => {
    const thursday = dateForDow(4, WEDNESDAY); // Thu = dow 4
    expect(thursday.getTime()).toBeGreaterThan(WEDNESDAY.getTime());
    expect(thursday.getTime() - WEDNESDAY.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('places Sunday (dow 0) at the END of the Mon-start week, not the start', () => {
    const sunday = dateForDow(0, WEDNESDAY);
    expect(sunday.getTime()).toBeGreaterThan(WEDNESDAY.getTime());
  });

  it('preserves the time-of-day of `now`, so it composes with a plain Date comparison', () => {
    const tuesday = dateForDow(2, WEDNESDAY);
    expect(tuesday.getHours()).toBe(WEDNESDAY.getHours());
    expect(tuesday.getMinutes()).toBe(WEDNESDAY.getMinutes());
  });
});
