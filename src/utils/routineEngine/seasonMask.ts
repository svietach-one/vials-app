import {
  SEASONS_RULESET,
  type Season,
  type SeasonMask,
} from '@/constants/rulesets/rulesetTypes';
import { getCurrentSeason, getElapsedDays, getSkincareDateString } from '@/utils/timeHelpers';

/**
 * Season-mask resolution (research §1.7): weather-driven with a mandatory
 * calendar fallback. Pure — the fetch lives in src/services/weather/; these
 * functions turn a weekly average temperature and a cached mask into the one
 * SeasonMask the engine consumes (it never knows which source produced it).
 */

/**
 * Persisted cache of the last weather-derived mask (trackingStore).
 * Placement note (2026-07-05 review): unlike its siblings CycleState/
 * ProductApplicationStats this type cannot live in src/types/index.ts — it
 * embeds SeasonMask from rulesetTypes.ts, which itself imports from
 * types/index.ts, so moving it there would create an import cycle.
 */
export interface SeasonMaskCache {
  mask: SeasonMask;
  /** Skincare date (YYYY-MM-DD) the weather reading was taken. */
  fetchedAt: string;
}

const COLD_SEASONS: Season[] = ['autumn', 'winter'];
const WARM_SEASONS: Season[] = ['spring', 'summer'];

/**
 * Maps a weekly average temperature onto a season. Below the cold threshold →
 * the autumn/winter family; above the warm threshold → spring/summer; inside
 * the 15–20 °C hysteresis band the previous mask is retained (prevents
 * week-to-week flapping in shoulder seasons). Within a family the calendar
 * season wins when it agrees, so a cold October reads "autumn", not "winter".
 */
export function deriveSeasonFromTemperature(
  weeklyAvgC: number,
  previousSeason: Season | null,
  calendarSeason: Season,
): Season {
  const { coldBelowC, warmAboveC } = SEASONS_RULESET.climate.thresholds;
  if (weeklyAvgC < coldBelowC) {
    return COLD_SEASONS.includes(calendarSeason) ? calendarSeason : 'winter';
  }
  if (weeklyAvgC > warmAboveC) {
    return WARM_SEASONS.includes(calendarSeason) ? calendarSeason : 'summer';
  }
  return previousSeason ?? calendarSeason;
}

/** True when the weekly check interval has elapsed since the last reading. */
export function isWeatherCheckDue(cache: SeasonMaskCache | null, now: Date = new Date()): boolean {
  if (!cache) return true;
  return getElapsedDays(cache.fetchedAt, now) >= SEASONS_RULESET.climate.checkIntervalDays;
}

/** True while the cached reading is younger than the staleness cutoff. */
export function isCacheUsable(cache: SeasonMaskCache | null, now: Date = new Date()): boolean {
  return (
    cache !== null && getElapsedDays(cache.fetchedAt, now) <= SEASONS_RULESET.climate.staleAfterDays
  );
}

/**
 * The mask the engine should use right now: the cached weather mask while
 * usable, otherwise the calendar season (no city / offline / fetch failures /
 * stale cache all land here — research §1.7 mandatory fallback chain).
 */
export function resolveSeasonMask(
  cache: SeasonMaskCache | null,
  now: Date = new Date(),
): SeasonMask {
  if (cache && cache.mask.source === 'weather' && isCacheUsable(cache, now)) {
    return cache.mask;
  }
  return { season: getCurrentSeason(now), source: 'calendar' };
}

/** Builds the cache entry for a fresh weather reading (hysteresis applied). */
export function buildWeatherSeasonMask(
  weeklyAvgC: number,
  previous: SeasonMaskCache | null,
  now: Date = new Date(),
): SeasonMaskCache {
  const season = deriveSeasonFromTemperature(
    weeklyAvgC,
    previous?.mask.season ?? null,
    getCurrentSeason(now),
  );
  return {
    mask: { season, source: 'weather' },
    fetchedAt: getSkincareDateString(now),
  };
}
