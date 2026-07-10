import type { SeasonMask } from '@/constants/rulesets/rulesetTypes';
import { fetchWeeklyAverageTemperatureC } from '@/services/weather';
import { useProfileStore } from '@/store/profileStore';
import { useTrackingStore } from '@/store/trackingStore';
import {
  buildWeatherSeasonMask,
  isWeatherCheckDue,
  resolveSeasonMask,
} from '@/utils/routineEngine/seasonMask';

/**
 * Season-mask domain actions (research §1.7). The engine consumes one
 * SeasonMask and never knows its source; these actions own the weather
 * refresh cadence and the mandatory calendar fallback chain (no city /
 * offline / API error / stale cache → calendar, silently).
 */

/** The mask to use right now — synchronous, from the hydrated cache. */
export function getActiveSeasonMask(now: Date = new Date()): SeasonMask {
  return resolveSeasonMask(useTrackingStore.getState().seasonMaskCache, now);
}

/**
 * Runs the weekly weather check when due (city set + interval elapsed),
 * persists the refreshed cache, and returns the mask now in force. Fetch
 * failures leave the cache untouched and fall back silently. Fire on app
 * open; ≤1 network request per check interval by construction.
 */
export async function refreshSeasonMaskIfDue(now: Date = new Date()): Promise<SeasonMask> {
  const city = useProfileStore.getState().profile?.city ?? null;
  const cache = useTrackingStore.getState().seasonMaskCache;

  // No city → weather layer is inert; calendar season drives everything.
  if (!city) return resolveSeasonMask(cache, now);
  if (!isWeatherCheckDue(cache, now)) return resolveSeasonMask(cache, now);

  const weeklyAvgC = await fetchWeeklyAverageTemperatureC(city.lat, city.lon);
  if (weeklyAvgC === null) return resolveSeasonMask(cache, now);

  const next = buildWeatherSeasonMask(weeklyAvgC, cache, now);
  useTrackingStore.getState().setSeasonMaskCache(next);
  return next.mask;
}
