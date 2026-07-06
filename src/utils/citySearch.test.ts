import citiesDataset from '@/constants/cities.json';
import { searchCities } from '@/utils/citySearch';

describe('cities.json dataset integrity', () => {
  it('holds unique names with valid coordinates', () => {
    const names = citiesDataset.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    for (const city of citiesDataset) {
      expect(city.name.length).toBeGreaterThan(2);
      expect(city.lat).toBeGreaterThanOrEqual(-90);
      expect(city.lat).toBeLessThanOrEqual(90);
      expect(city.lon).toBeGreaterThanOrEqual(-180);
      expect(city.lon).toBeLessThanOrEqual(180);
    }
  });
});

describe('searchCities', () => {
  it('returns nothing for queries under two characters', () => {
    expect(searchCities('')).toEqual([]);
    expect(searchCities('w')).toEqual([]);
    expect(searchCities('  w  ')).toEqual([]);
  });

  it('matches case-insensitively by prefix', () => {
    const results = searchCities('war');
    expect(results[0]?.name).toBe('Warsaw, Poland');
  });

  it('ranks prefix matches ahead of substring matches', () => {
    // "york" prefixes nothing but is contained in "New York, USA"
    const contains = searchCities('york');
    expect(contains.map((c) => c.name)).toContain('New York, USA');

    // "san" prefixes San Diego/San Francisco and is contained in Santiago
    const results = searchCities('san');
    const names = results.map((c) => c.name);
    expect(names.indexOf('San Diego, USA')).toBeLessThan(names.indexOf('Santiago, Chile'));
  });

  it('caps the result list at the limit', () => {
    expect(searchCities('a', 5)).toEqual([]); // too short
    expect(searchCities('an', 5).length).toBeLessThanOrEqual(5);
  });

  it('returns full CityLocation records usable as profile.city', () => {
    const [berlin] = searchCities('berlin');
    expect(berlin).toEqual({ name: 'Berlin, Germany', lat: 52.52, lon: 13.41 });
  });
});
