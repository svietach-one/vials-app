jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { useProductsStore } from '../../store/productsStore';
import { filterBrandPrefix, searchBrands } from './brandLookup';
import type { Product } from '../../types';

function makeProduct(brand: string): Product {
  return { id: brand, brand } as Product;
}

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

describe('searchBrands', () => {
  beforeEach(() => {
    useProductsStore.setState({ products: [] });
  });

  it('suggests a Cyrillic dictionary brand from the first letter, with no matching shelf product', async () => {
    expect(await searchBrands('Бел')).toContain('Белита');
  });

  it('suggests a Latin dictionary brand from the first letter', async () => {
    expect(await searchBrands('Bioder')).toContain('Bioderma');
  });

  it('never offers a Cyrillic dictionary brand for a Latin query', async () => {
    const results = await searchBrands('Vit');
    expect(results.some((b) => /[а-яё]/i.test(b))).toBe(false);
  });

  it('lists the user\'s own shelf brand before the dictionary spelling of the same prefix', async () => {
    useProductsStore.setState({ products: [makeProduct('Bioderma')] });
    const results = await searchBrands('Bioder');
    expect(results[0]).toBe('Bioderma');
  });
});
