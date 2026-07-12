jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { filterBrandPrefix } from './brandLookup';

describe('filterBrandPrefix', () => {
  const brands = ['CeraVe', 'Cetaphil', 'La Roche-Posay', 'CeraVe', null, 'Ceramedx', '  '];

  it('matches case-insensitively by prefix', () => {
    expect(filterBrandPrefix(brands, 'cera')).toEqual(['CeraVe', 'Ceramedx']);
  });

  it('dedupes brands and drops null or blank entries', () => {
    expect(filterBrandPrefix(brands, 'c')).toEqual(['CeraVe', 'Cetaphil', 'Ceramedx']);
  });

  it('returns empty list for an empty or whitespace query', () => {
    expect(filterBrandPrefix(brands, '')).toEqual([]);
    expect(filterBrandPrefix(brands, '   ')).toEqual([]);
  });

  it('does not match on substrings that are not prefixes', () => {
    expect(filterBrandPrefix(brands, 'rave')).toEqual([]);
  });

  it('caps results at five suggestions', () => {
    const many = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'];
    expect(filterBrandPrefix(many, 'c')).toHaveLength(5);
  });
});
