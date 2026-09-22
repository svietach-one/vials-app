jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockCreateTursoHttpClient = jest.fn();
jest.mock('../../services/turso/httpClient', () => ({
  createTursoHttpClient: () => mockCreateTursoHttpClient(),
}));

const mockSearchBrands = jest.fn();
jest.mock('../../services/corpus/ProductRepository', () => ({
  ProductRepository: jest.fn().mockImplementation(() => ({
    searchBrands: mockSearchBrands,
  })),
}));

import { useProductsStore } from '../../store/productsStore';
import { filterBrandPrefix, searchBrands, searchBrandsWithCorpus } from './brandLookup';
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

describe('searchBrandsWithCorpus', () => {
  beforeEach(() => {
    useProductsStore.setState({ products: [] });
    mockCreateTursoHttpClient.mockReset();
    mockSearchBrands.mockReset();
  });

  it('falls back to the local-only result set when the corpus client is not configured', async () => {
    mockCreateTursoHttpClient.mockReturnValue(null);

    const results = await searchBrandsWithCorpus('Bioder');

    expect(mockSearchBrands).not.toHaveBeenCalled();
    expect(results).toContain('Bioderma');
  });

  it('merges corpus brands after the local (shelf + dictionary) results, deduped case-insensitively', async () => {
    mockCreateTursoHttpClient.mockReturnValue({});
    mockSearchBrands.mockResolvedValue(['bioderma', 'BrandFromCorpusOnly']);

    const results = await searchBrandsWithCorpus('Bioder');

    // 'bioderma' from the corpus is a case-insensitive duplicate of the
    // dictionary's 'Bioderma' — the local spelling wins, not re-added.
    expect(results.filter((b) => b.toLowerCase() === 'bioderma')).toHaveLength(1);
    expect(results).toContain('BrandFromCorpusOnly');
  });

  it('caps the merged result list at 8 entries', async () => {
    useProductsStore.setState({
      products: [makeProduct('Cera1'), makeProduct('Cera2'), makeProduct('Cera3')],
    });
    mockCreateTursoHttpClient.mockReturnValue({});
    mockSearchBrands.mockResolvedValue(['Cera4', 'Cera5', 'Cera6', 'Cera7', 'Cera8', 'Cera9']);

    const results = await searchBrandsWithCorpus('Cera');

    expect(results.length).toBeLessThanOrEqual(8);
  });
});
