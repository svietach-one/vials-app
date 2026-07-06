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

  it('should return only products with exfoliation-mapped tags (aha/bha/pha/retinoid/retinol) when exfoliation benefit is selected', () => {
    const products = [
      makeProduct({ id: 'p1', activeTags: ['retinol'] }),
      makeProduct({ id: 'p2', activeTags: ['aha', 'bha'] }),
      makeProduct({ id: 'p3', activeTags: ['niacinamide'] }),
      makeProduct({ id: 'p4', activeTags: [] }),
    ];

    const result = applyFilters(products, {
      ...CATALOG_FILTER_DEFAULT,
      selectedBenefits: ['exfoliation'],
    });

    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('should apply AND logic — serum category + exfoliation returns only serum products that also have an exfoliation tag', () => {
    const products = [
      makeProduct({ id: 'p1', productType: 'serum', activeTags: ['retinol'] }),
      makeProduct({ id: 'p2', productType: 'serum', activeTags: ['niacinamide'] }),
      makeProduct({ id: 'p3', productType: 'moisturizer', activeTags: ['aha'] }),
    ];

    const result = applyFilters(products, {
      ...CATALOG_FILTER_DEFAULT,
      selectedCategory: 'serum',
      selectedBenefits: ['exfoliation'],
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p1');
  });

  it('should return only products with soothing-mapped tags (cica/panthenol/azelaic_acid/niacinamide) when soothing benefit is selected', () => {
    const products = [
      makeProduct({ id: 'p1', activeTags: ['niacinamide'] }),
      makeProduct({ id: 'p2', activeTags: ['cica'] }),
      makeProduct({ id: 'p3', activeTags: ['retinol'] }),
      makeProduct({ id: 'p4', activeTags: [] }),
    ];

    const result = applyFilters(products, {
      ...CATALOG_FILTER_DEFAULT,
      selectedBenefits: ['soothing'],
    });

    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('should return only products with hydration-mapped tags (hyaluronic_acid/panthenol/ceramides) when hydration benefit is selected — ingredient-based, not productType-based', () => {
    const products = [
      makeProduct({ id: 'p1', productType: 'moisturizer', activeTags: ['hyaluronic_acid'] }),
      makeProduct({ id: 'p2', productType: 'serum', activeTags: ['ceramides'] }),
      // Product type alone (no matching tag) must NOT match — the old HYDRATION_TYPES
      // productType heuristic is deliberately replaced with ingredient matching.
      makeProduct({ id: 'p3', productType: 'moisturizer', activeTags: [] }),
    ];

    const result = applyFilters(products, {
      ...CATALOG_FILTER_DEFAULT,
      selectedBenefits: ['hydration'],
    });

    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('should return only products with anti_acne-mapped tags (benzoyl_peroxide/azelaic_acid/bha)', () => {
    const products = [
      makeProduct({ id: 'p1', activeTags: ['benzoyl_peroxide'] }),
      makeProduct({ id: 'p2', activeTags: ['hyaluronic_acid'] }),
    ];

    const result = applyFilters(products, {
      ...CATALOG_FILTER_DEFAULT,
      selectedBenefits: ['anti_acne'],
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p1');
  });

  it('should return only products with brightening-mapped tags (vitamin_c variants/niacinamide/azelaic_acid)', () => {
    const products = [
      makeProduct({ id: 'p1', activeTags: ['vitamin_c_pure'] }),
      makeProduct({ id: 'p2', activeTags: ['cica'] }),
    ];

    const result = applyFilters(products, {
      ...CATALOG_FILTER_DEFAULT,
      selectedBenefits: ['brightening'],
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p1');
  });

  it('should map a retinoid- or retinol-tagged product to exfoliation (regression guard for the tech design coverage fix)', () => {
    const products = [
      makeProduct({ id: 'p1', activeTags: ['retinoid'] }),
      makeProduct({ id: 'p2', activeTags: ['retinol'] }),
    ];

    const result = applyFilters(products, {
      ...CATALOG_FILTER_DEFAULT,
      selectedBenefits: ['exfoliation'],
    });

    expect(result.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('should map a copper_peptides-tagged product to barrier_repair (regression guard for the tech design coverage fix)', () => {
    const products = [makeProduct({ id: 'p1', activeTags: ['copper_peptides'] })];

    const result = applyFilters(products, {
      ...CATALOG_FILTER_DEFAULT,
      selectedBenefits: ['barrier_repair'],
    });

    expect(result.map((p) => p.id)).toEqual(['p1']);
  });

  it('should map a niacinamide-tagged product to both soothing and brightening (regression guard for the tech design coverage fix)', () => {
    const products = [makeProduct({ id: 'p1', activeTags: ['niacinamide'] })];

    expect(
      applyFilters(products, { ...CATALOG_FILTER_DEFAULT, selectedBenefits: ['soothing'] }).map((p) => p.id),
    ).toEqual(['p1']);
    expect(
      applyFilters(products, { ...CATALOG_FILTER_DEFAULT, selectedBenefits: ['brightening'] }).map((p) => p.id),
    ).toEqual(['p1']);
  });

  it('should never match a benefit filter for a product with activeTags undefined', () => {
    const products = [makeProduct({ id: 'p1', activeTags: undefined })];

    const result = applyFilters(products, {
      ...CATALOG_FILTER_DEFAULT,
      selectedBenefits: ['hydration'],
    });

    expect(result).toHaveLength(0);
  });

  it('should combine multiple selected benefits with AND semantics, not OR', () => {
    const products = [
      // Matches exfoliation only.
      makeProduct({ id: 'p-exfoliation-only', activeTags: ['retinoid'] }),
      // Matches barrier_repair only.
      makeProduct({ id: 'p-barrier-only', activeTags: ['copper_peptides'] }),
      // Matches both (niacinamide is in both soothing and brightening).
      makeProduct({ id: 'p-both', activeTags: ['niacinamide'] }),
    ];

    // Under OR semantics, selecting exfoliation + barrier_repair would return both
    // single-tag products (2 results). AND semantics must return none, since no
    // product carries tags satisfying both buckets simultaneously.
    const nonOverlapping = applyFilters(products, {
      ...CATALOG_FILTER_DEFAULT,
      selectedBenefits: ['exfoliation', 'barrier_repair'],
    });
    expect(nonOverlapping).toHaveLength(0);

    // A product whose single tag satisfies both selected benefits must still pass.
    const overlapping = applyFilters(products, {
      ...CATALOG_FILTER_DEFAULT,
      selectedBenefits: ['soothing', 'brightening'],
    });
    expect(overlapping.map((p) => p.id)).toEqual(['p-both']);
  });

  it('should pass a serum product with an exfoliation tag when both serum category and exfoliation benefit are selected', () => {
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
      selectedBenefits: ['exfoliation'],
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p1');
  });
});
