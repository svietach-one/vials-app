import type { SeasonMask } from '@/constants/rulesets/rulesetTypes';
import {
  buildWeatherSeasonMask,
  deriveSeasonFromTemperature,
  isCacheUsable,
  isWeatherCheckDue,
  resolveSeasonMask,
  type SeasonMaskCache,
} from '@/utils/routineEngine/seasonMask';
import { getCurrentSeason } from '@/utils/timeHelpers';

// July 4 noon — calendar season is summer for a Northern-hemisphere runner,
// but tests never assume the hemisphere: they compare against getCurrentSeason.
const NOW = new Date('2026-07-04T12:00:00');
const CALENDAR = getCurrentSeason(NOW);

function makeCache(mask: SeasonMask, fetchedAt: string): SeasonMaskCache {
  return { mask, fetchedAt };
}

describe('deriveSeasonFromTemperature', () => {
  it('maps cold weeks (< 15°C) to the winter family', () => {
    expect(deriveSeasonFromTemperature(10, null, 'summer')).toBe('winter');
    expect(deriveSeasonFromTemperature(14.9, null, 'spring')).toBe('winter');
  });

  it('keeps the calendar season within the cold family (cold October reads autumn)', () => {
    expect(deriveSeasonFromTemperature(10, null, 'autumn')).toBe('autumn');
    expect(deriveSeasonFromTemperature(10, null, 'winter')).toBe('winter');
  });

  it('maps warm weeks (> 20°C) to the summer family, honoring a spring calendar', () => {
    expect(deriveSeasonFromTemperature(25, null, 'winter')).toBe('summer');
    expect(deriveSeasonFromTemperature(20.1, null, 'spring')).toBe('spring');
  });

  it('retains the previous mask inside the 15–20°C hysteresis band', () => {
    expect(deriveSeasonFromTemperature(17, 'winter', 'summer')).toBe('winter');
    expect(deriveSeasonFromTemperature(17, 'summer', 'winter')).toBe('summer');
  });

  it('treats the exact thresholds as inside the band (strict comparisons)', () => {
    expect(deriveSeasonFromTemperature(15, 'summer', 'winter')).toBe('summer');
    expect(deriveSeasonFromTemperature(20, 'winter', 'summer')).toBe('winter');
  });

  it('falls back to the calendar season inside the band with no previous mask', () => {
    expect(deriveSeasonFromTemperature(17, null, 'autumn')).toBe('autumn');
  });
});

describe('isWeatherCheckDue', () => {
  it('is due with no cache at all', () => {
    expect(isWeatherCheckDue(null, NOW)).toBe(true);
  });

  it('is not due within the 7-day interval', () => {
    const cache = makeCache({ season: 'summer', source: 'weather' }, '2026-07-01');
    expect(isWeatherCheckDue(cache, NOW)).toBe(false);
  });

  it('becomes due once 7 days have elapsed', () => {
    const cache = makeCache({ season: 'summer', source: 'weather' }, '2026-06-27');
    expect(isWeatherCheckDue(cache, NOW)).toBe(true);
  });
});

describe('isCacheUsable', () => {
  it('accepts a reading up to 14 days old and rejects older ones', () => {
    expect(isCacheUsable(makeCache({ season: 'summer', source: 'weather' }, '2026-06-20'), NOW)).toBe(true); // 14 d
    expect(isCacheUsable(makeCache({ season: 'summer', source: 'weather' }, '2026-06-19'), NOW)).toBe(false); // 15 d
    expect(isCacheUsable(null, NOW)).toBe(false);
  });
});

describe('resolveSeasonMask', () => {
  it('returns the cached weather mask while usable', () => {
    const cache = makeCache({ season: 'winter', source: 'weather' }, '2026-07-01');
    expect(resolveSeasonMask(cache, NOW)).toEqual({ season: 'winter', source: 'weather' });
  });

  it('falls back to the calendar season when the cache is stale (> 14 days)', () => {
    const cache = makeCache({ season: 'winter', source: 'weather' }, '2026-06-01');
    expect(resolveSeasonMask(cache, NOW)).toEqual({ season: CALENDAR, source: 'calendar' });
  });

  it('falls back to the calendar season with no cache', () => {
    expect(resolveSeasonMask(null, NOW)).toEqual({ season: CALENDAR, source: 'calendar' });
  });
});

describe('buildWeatherSeasonMask', () => {
  it('stamps a weather-source mask with the skincare date of the reading', () => {
    const cache = buildWeatherSeasonMask(10, null, NOW);
    expect(cache).toEqual({
      mask: { season: expect.stringMatching(/winter|autumn/), source: 'weather' },
      fetchedAt: '2026-07-04',
    });
  });

  it('applies hysteresis against the previous cached mask', () => {
    const previous = makeCache({ season: 'winter', source: 'weather' }, '2026-06-27');
    const next = buildWeatherSeasonMask(17, previous, NOW); // inside the band
    expect(next.mask.season).toBe('winter'); // retained, no flapping
  });

  it('crosses to the warm family once the average exceeds the threshold', () => {
    const previous = makeCache({ season: 'winter', source: 'weather' }, '2026-06-27');
    const next = buildWeatherSeasonMask(23, previous, NOW);
    expect(['spring', 'summer']).toContain(next.mask.season);
  });
});
