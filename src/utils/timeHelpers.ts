/**
 * Returns the current skincare date with a day boundary at 04:00.
 * Activity logged between 00:00–03:59 counts toward the previous calendar day.
 */
export function getSkincareDateString(now: Date = new Date()): string {
  const currentHour = now.getHours();

  if (currentHour < 4) {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }

  return now.toISOString().split('T')[0];
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
