import { fetchWeeklyAverageTemperatureC } from '@/services/weather';

/**
 * Service-boundary tests with a mocked global fetch — no network ever leaves
 * the test (testing.md). The contract under test: a number on success, null
 * on EVERY failure path, never a throw.
 */

const originalFetch = global.fetch;

function mockFetchResponse(body: unknown, ok = true): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(body),
  }) as unknown as typeof fetch;
}

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('fetchWeeklyAverageTemperatureC', () => {
  it('averages the 7 daily mean temperatures', async () => {
    mockFetchResponse({ daily: { temperature_2m_mean: [10, 12, 14, 16, 18, 20, 22] } });
    await expect(fetchWeeklyAverageTemperatureC(52.52, 13.41)).resolves.toBe(16);
  });

  it('requests the Open-Meteo daily mean for the given coordinates', async () => {
    mockFetchResponse({ daily: { temperature_2m_mean: [15] } });
    await fetchWeeklyAverageTemperatureC(52.52, 13.41);
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('api.open-meteo.com');
    expect(url).toContain('latitude=52.52');
    expect(url).toContain('longitude=13.41');
    expect(url).toContain('temperature_2m_mean');
  });

  it('ignores null gaps in the series and averages the valid readings', async () => {
    mockFetchResponse({ daily: { temperature_2m_mean: [10, null, 20, null] } });
    await expect(fetchWeeklyAverageTemperatureC(0, 0)).resolves.toBe(15);
  });

  it('returns null on a non-2xx response', async () => {
    mockFetchResponse({}, false);
    await expect(fetchWeeklyAverageTemperatureC(0, 0)).resolves.toBeNull();
  });

  it('returns null on a malformed payload', async () => {
    mockFetchResponse({ daily: { temperature_2m_mean: 'not-an-array' } });
    await expect(fetchWeeklyAverageTemperatureC(0, 0)).resolves.toBeNull();
    mockFetchResponse({});
    await expect(fetchWeeklyAverageTemperatureC(0, 0)).resolves.toBeNull();
  });

  it('returns null on an empty or all-invalid series', async () => {
    mockFetchResponse({ daily: { temperature_2m_mean: [] } });
    await expect(fetchWeeklyAverageTemperatureC(0, 0)).resolves.toBeNull();
    mockFetchResponse({ daily: { temperature_2m_mean: [null, NaN] } });
    await expect(fetchWeeklyAverageTemperatureC(0, 0)).resolves.toBeNull();
  });

  it('returns null instead of throwing on a network error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
    await expect(fetchWeeklyAverageTemperatureC(0, 0)).resolves.toBeNull();
  });
});
