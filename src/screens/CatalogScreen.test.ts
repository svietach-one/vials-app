// Mock AsyncStorage before any imports that trigger the native module chain
jest.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve()),
  },
  __esModule: true,
}));

import { applyFilters } from '@/screens/CatalogScreen';
import type { Product } from '@/types';
import { CATALOG_FILTER_DEFAULT } from '@/types';

// ─── Product factory ──────────────────────────────────────────────────────────

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: 'p1',
    name: 'Test Product',
    brand: null,
    productType: 'serum',
    imageUrl: null,
    activeIngredients: [],
    activeTags: [],
    fullIngredientText: null,
    usageTime: 'morning',
    openBeautyFactsId: null,
    addedAt: '2026-01-01',
    notes: null,
    openedDate: null,
    paoMonths: null,
    ...overrides,
  };
}

// ─── applyFilters ─────────────────────────────────────────────────────────────

describe('applyFilters', () => {
  it('should return all products unchanged when all filters are at their defaults', () => {
    const products = [
      makeProduct({ id: 'p1', name: 'Alpha', productType: 'serum' }),
      makeProduct({ id: 'p2', name: 'Beta', productType: 'moisturizer' }),
      makeProduct({ id: 'p3', name: 'Gamma', productType: 'spf' }),
    ];

    const result = applyFilters(products, CATALOG_FILTER_DEFAULT);

    expect(result).toHaveLength(3);
    expect(result).toEqual(products);
  });

  it('should match products by name case-insensitively when searchQuery is set', () => {
    const products = [
      makeProduct({ id: 'p1', name: 'Niacinamide Serum' }),
      makeProduct({ id: 'p2', name: 'Vitamin C Brightener' }),
    ];

    const result = applyFilters(products, { ...CATALOG_FILTER_DEFAULT, searchQuery: 'niacin' });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p1');
  });

  it('should return an empty array when no products match the search query', () => {
    const products = [
      makeProduct({ id: 'p1', name: 'Retinol Night Cream' }),
      makeProduct({ id: 'p2', name: 'SPF 50 Fluid' }),
    ];

    const result = applyFilters(products, { ...CATALOG_FILTER_DEFAULT, searchQuery: 'zzznomatch' });

    expect(result).toHaveLength(0);
  });

  it('should return only serum products when category is serum', () => {
    const products = [
      makeProduct({ id: 'p1', productType: 'serum' }),
      makeProduct({ id: 'p2', productType: 'essence' }),
      makeProduct({ id: 'p3', productType: 'ampoule' }),
      makeProduct({ id: 'p4', productType: 'moisturizer' }),
      makeProduct({ id: 'p5', productType: 'spf' }),
    ];

    const result = applyFilters(products, { ...CATALOG_FILTER_DEFAULT, selectedCategory: 'serum' });

    expect(result).toHaveLength(1);
    expect(result.map((p) => p.id)).toEqual(['p1']);
  });

  it('should return only spf products when category is spf', () => {
    const products = [
      makeProduct({ id: 'p1', productType: 'spf' }),
      makeProduct({ id: 'p2', productType: 'serum' }),
      makeProduct({ id: 'p3', productType: 'moisturizer' }),
    ];

    const result = applyFilters(products, { ...CATALOG_FILTER_DEFAULT, selectedCategory: 'spf' });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p1');
  });

  it('should return only cream products when category is cream', () => {
    const products = [
      makeProduct({ id: 'p1', productType: 'cream' }),
      makeProduct({ id: 'p2', productType: 'lotion' }),
      makeProduct({ id: 'p3', productType: 'moisturizer' }),
    ];

    const result = applyFilters(products, { ...CATALOG_FILTER_DEFAULT, selectedCategory: 'cream' });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p1');
  });

  it('should return only products with actives tags when Actives biomarker is selected', () => {
    const products = [
      makeProduct({ id: 'p1', activeTags: ['retinol'] }),
      makeProduct({ id: 'p2', activeTags: ['aha', 'bha'] }),
      makeProduct({ id: 'p3', activeTags: ['niacinamide'] }),
      makeProduct({ id: 'p4', activeTags: [] }),
    ];

    const result = applyFilters(products, {
      ...CATALOG_FILTER_DEFAULT,
      selectedBiomarkers: ['Actives'],
    });

    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('should apply AND logic — serum category + Actives returns only serum products that also have actives tags', () => {
    const products = [
      makeProduct({ id: 'p1', productType: 'serum', activeTags: ['retinol'] }),
      makeProduct({ id: 'p2', productType: 'serum', activeTags: ['niacinamide'] }),
      makeProduct({ id: 'p3', productType: 'moisturizer', activeTags: ['aha'] }),
    ];

    const result = applyFilters(products, {
      ...CATALOG_FILTER_DEFAULT,
      selectedCategory: 'serum',
      selectedBiomarkers: ['Actives'],
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p1');
  });

  it('should return only products with niacinamide or copper_peptides when Soothing biomarker is selected', () => {
    const products = [
      makeProduct({ id: 'p1', activeTags: ['niacinamide'] }),
      makeProduct({ id: 'p2', activeTags: ['copper_peptides'] }),
      makeProduct({ id: 'p3', activeTags: ['retinol'] }),
      makeProduct({ id: 'p4', activeTags: [] }),
    ];

    const result = applyFilters(products, {
      ...CATALOG_FILTER_DEFAULT,
      selectedBiomarkers: ['Soothing'],
    });

    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('should return only moisturizer, cream, lotion, oil, essence and toner products when Hydration biomarker is selected', () => {
    const products = [
      makeProduct({ id: 'p1', productType: 'moisturizer' }),
      makeProduct({ id: 'p2', productType: 'cream' }),
      makeProduct({ id: 'p3', productType: 'lotion' }),
      makeProduct({ id: 'p4', productType: 'oil' }),
      makeProduct({ id: 'p5', productType: 'essence' }),
      makeProduct({ id: 'p6', productType: 'toner' }),
      makeProduct({ id: 'p7', productType: 'serum' }),
      makeProduct({ id: 'p8', productType: 'spf' }),
    ];

    const result = applyFilters(products, {
      ...CATALOG_FILTER_DEFAULT,
      selectedBiomarkers: ['Hydration'],
    });

    expect(result).toHaveLength(6);
    expect(result.map((p) => p.id)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
  });

  it('should pass a serum product with actives tags when both serum category and Actives biomarker are selected', () => {
    const products = [
      makeProduct({
        id: 'p1',
        name: 'Retinol Booster',
        productType: 'serum',
        activeTags: ['retinol', 'vitamin_c'],
      }),
    ];

    const result = applyFilters(products, {
      ...CATALOG_FILTER_DEFAULT,
      selectedCategory: 'serum',
      selectedBiomarkers: ['Actives'],
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p1');
  });
});
