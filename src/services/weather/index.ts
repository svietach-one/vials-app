/**
 * Open-Meteo weekly forecast client (tech-design §2). Keyless and free — no
 * EXPO_PUBLIC_* secret to manage. Called at most once per check interval by
 * the season domain action; every failure path returns null so the caller
 * falls back to the calendar season silently (research §1.7: the weather
 * layer never blocks and never surfaces errors to the UI).
 */

const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const REQUEST_TIMEOUT_MS = 5000;

interface OpenMeteoDailyResponse {
  daily?: { temperature_2m_mean?: unknown };
}

/**
 * Fetches the 7-day mean temperature (°C) for a coordinate. Returns null on
 * timeout (5 s), non-2xx, malformed payloads, or any network error — never
 * throws.
 */
export async function fetchWeeklyAverageTemperatureC(
  lat: number,
  lon: number,
): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const url =
      `${OPEN_METEO_FORECAST_URL}?latitude=${lat}&longitude=${lon}` +
      '&daily=temperature_2m_mean&forecast_days=7&timezone=UTC';
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;

    const data = (await response.json()) as OpenMeteoDailyResponse;
    const temps = data.daily?.temperature_2m_mean;
    if (!Array.isArray(temps)) return null;

    const valid = temps.filter((t): t is number => typeof t === 'number' && Number.isFinite(t));
    if (valid.length === 0) return null;
    return valid.reduce((sum, t) => sum + t, 0) / valid.length;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
