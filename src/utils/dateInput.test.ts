import { todayLocalIso } from './dateInput';

describe('todayLocalIso', () => {
  it('returns the local calendar date at 01:00 regardless of timezone offset', () => {
    // Arrange: 01:00 local is the previous day in UTC for zones east of London
    const now = new Date(2026, 9, 16, 1, 0);

    // Act / Assert
    expect(todayLocalIso(now)).toBe('2026-10-16');
  });

  it('returns the same date at 00:00 and at 23:59 local time', () => {
    expect(todayLocalIso(new Date(2026, 9, 16, 0, 0))).toBe('2026-10-16');
    expect(todayLocalIso(new Date(2026, 9, 16, 23, 59))).toBe('2026-10-16');
  });

  it('rolls over the month boundary', () => {
    expect(todayLocalIso(new Date(2026, 0, 31, 23, 59))).toBe('2026-01-31');
    expect(todayLocalIso(new Date(2026, 1, 1, 0, 0))).toBe('2026-02-01');
  });

  it('rolls over the year boundary', () => {
    expect(todayLocalIso(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
    expect(todayLocalIso(new Date(2027, 0, 1, 0, 0))).toBe('2027-01-01');
  });

  it('zero-pads single-digit months and days', () => {
    expect(todayLocalIso(new Date(2026, 2, 5, 12, 0))).toBe('2026-03-05');
  });

  it('sorts lexicographically so string comparison matches calendar order', () => {
    const today = todayLocalIso(new Date(2026, 9, 16, 1, 0));
    expect('2026-10-17' > today).toBe(true);
    expect('2026-10-16' > today).toBe(false);
    expect('2026-09-30' > today).toBe(false);
  });
});
