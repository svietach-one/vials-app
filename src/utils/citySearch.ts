import citiesDataset from '@/constants/cities.json';
import type { CityLocation } from '@/types';

/**
 * Offline city autocomplete over the bundled dataset (research §1.7: no GPS,
 * no network — a text field backed by src/constants/cities.json). Pure.
 */

const CITIES = citiesDataset as CityLocation[];

/** Minimum query length before suggestions appear. */
const MIN_QUERY_LENGTH = 2;

/**
 * Case-insensitive match over city names: prefix matches rank first, then
 * substring matches; both groups keep the dataset's alphabetical order.
 */
export function searchCities(query: string, limit = 8): CityLocation[] {
  const q = query.trim().toLowerCase();
  if (q.length < MIN_QUERY_LENGTH) return [];

  const prefixed: CityLocation[] = [];
  const contained: CityLocation[] = [];
  for (const city of CITIES) {
    const name = city.name.toLowerCase();
    if (name.startsWith(q)) prefixed.push(city);
    else if (name.includes(q)) contained.push(city);
  }
  return [...prefixed, ...contained].slice(0, limit);
}
