import { todayLocalIso } from '@/utils/dateInput';

const MS_PER_DAY = 86_400_000;

/** Midnight-UTC epoch of a calendar day, so differences are exact whole days (no DST). */
function calendarDayNumber(year: number, month: number, day: number): number {
  return Date.UTC(year, month, day) / MS_PER_DAY;
}

/**
 * Whole calendar days between a YYYY-MM-DD date and `now`'s LOCAL calendar
 * day. Both sides are plain calendar dates, so the result does not depend on
 * the time of day or the device's UTC offset.
 */
export function getElapsedDays(dateStr: string, now: Date = new Date()): number {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return (
    calendarDayNumber(now.getFullYear(), now.getMonth(), now.getDate()) -
    calendarDayNumber(y, m - 1, d)
  );
}

/**
 * Returns the current skincare date (local calendar, YYYY-MM-DD) with a day
 * boundary at 04:00. Activity logged between 00:00–03:59 counts toward the
 * previous calendar day.
 */
export function getSkincareDateString(now: Date = new Date()): string {
  if (now.getHours() < 4) {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return todayLocalIso(yesterday);
  }

  return todayLocalIso(now);
}

/**
 * Determines the current season from the device timezone (no weather API).
 * Handles Northern and Southern hemispheres.
 */
export function getCurrentSeason(
  now: Date = new Date(),
): 'summer' | 'winter' | 'autumn' | 'spring' {
  const month = now.getMonth();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const isSouthernHemisphere =
    timeZone.includes('Australia') ||
    timeZone.includes('Brazil') ||
    timeZone.includes('Africa/Johannesburg');

  const northernSeasons: ('winter' | 'spring' | 'summer' | 'autumn')[] = [
    'winter',
    'winter',
    'spring',
    'spring',
    'spring',
    'summer',
    'summer',
    'summer',
    'autumn',
    'autumn',
    'autumn',
    'winter',
  ];

  const currentNorthernSeason = northernSeasons[month];

  if (isSouthernHemisphere) {
    const southernMap: Record<string, 'summer' | 'winter' | 'autumn' | 'spring'> = {
      winter: 'summer',
      summer: 'winter',
      spring: 'autumn',
      autumn: 'spring',
    };
    return southernMap[currentNorthernSeason];
  }

  return currentNorthernSeason;
}
