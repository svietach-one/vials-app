import type { ActiveIngredientKey, Product } from '@/types';
import { buildShelfComparison, type ThisCompositionStats } from '@/utils/productProfile/shelfComparison';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Test Product',
    brand: 'Test Brand',
    productType: 'serum',
    imageUrl: null,
    activeIngredients: [],
    activeTags: [],
    fullIngredientText: null,
    usageTime: 'both',
    openBeautyFactsId: null,
    addedAt: '2026-01-01',
    notes: null,
    openedDate: null,
    paoMonths: null,
    ...overrides,
  };
}

const THIS_COMPOSITION: ThisCompositionStats = {
  functionalTagCount: 2,
  ingredientCount: 4,
  activeKeys: ['niacinamide'] as ActiveIngredientKey[],
};

describe('buildShelfComparison — Story 6 comparison-basis population (2026-08-26 decision batch, FE-10)', () => {
  it('filters the population to the captured category only, nothing else', () => {
    const products = [
      makeProduct({ id: 'p1', productType: 'serum', fullIngredientText: 'Aqua, Niacinamide' }),
      makeProduct({ id: 'p2', productType: 'cleanser', fullIngredientText: 'Aqua' }),
    ];

    const result = buildShelfComparison('serum', THIS_COMPOSITION, products);

    expect(result.sameCategoryCount).toBe(1);
  });

  it('returns sameCategoryCount 0 and zeroed averages when no same-category item exists — never fabricated numbers', () => {
    const products = [makeProduct({ id: 'p2', productType: 'cleanser' })];

    const result = buildShelfComparison('serum', THIS_COMPOSITION, products);

    expect(result.sameCategoryCount).toBe(0);
    expect(result.shelfFunctionalTagAverage).toBe(0);
    expect(result.shelfIngredientCountAverage).toBe(0);
    expect(result.shelfActiveTagOverlapCount).toBe(0);
  });

  it('excludes a same-category item with no recorded ingredients from the averages’ denominator, instead of averaging it in as a real 0', () => {
    const products = [
      makeProduct({ id: 'p1', productType: 'serum', fullIngredientText: null }),
      makeProduct({ id: 'p2', productType: 'serum', fullIngredientText: 'Aqua, Niacinamide, Glycerin, Ceramide NP' }),
    ];

    const result = buildShelfComparison('serum', THIS_COMPOSITION, products);

    // Population size still includes BOTH items (no secondary filter on sameCategoryCount)...
    expect(result.sameCategoryCount).toBe(2);
    // ...but only 1 of them has real ingredient data, so it alone drives the average.
    expect(result.sameCategoryWithDataCount).toBe(1);
    expect(result.shelfIngredientCountAverage).toBe(4);
  });

  it('reports 0 averages with sameCategoryWithDataCount 0 when same-category items exist but none have recorded ingredient data', () => {
    const products = [
      makeProduct({ id: 'p1', productType: 'serum', fullIngredientText: null }),
      makeProduct({ id: 'p2', productType: 'serum', fullIngredientText: '   ' }),
    ];

    const result = buildShelfComparison('serum', THIS_COMPOSITION, products);

    expect(result.sameCategoryCount).toBe(2);
    expect(result.sameCategoryWithDataCount).toBe(0);
    expect(result.shelfFunctionalTagAverage).toBe(0);
    expect(result.shelfIngredientCountAverage).toBe(0);
  });

  it('counts a same-category item toward the active-tag overlap only when it shares at least one active key with this composition', () => {
    const products = [
      makeProduct({ id: 'p1', productType: 'serum', fullIngredientText: 'Aqua, Niacinamide' }), // overlaps
      makeProduct({ id: 'p2', productType: 'serum', fullIngredientText: 'Aqua, Ceramide NP' }), // no overlap
    ];

    const result = buildShelfComparison('serum', THIS_COMPOSITION, products);

    expect(result.shelfActiveTagOverlapCount).toBe(1);
  });

  it('computes shelfFunctionalTagAverage from the same real capabilities pipeline, not new detection logic', () => {
    const products = [
      // barrierRepair: true (niacinamide) -> 1 positive capability out of the 6 modeled ones.
      makeProduct({ id: 'p1', productType: 'serum', fullIngredientText: 'Aqua, Niacinamide' }),
    ];

    const result = buildShelfComparison('serum', THIS_COMPOSITION, products);

    expect(result.shelfFunctionalTagAverage).toBeGreaterThan(0);
  });

  it('passes this-composition stats straight through unchanged', () => {
    const result = buildShelfComparison('serum', THIS_COMPOSITION, []);

    expect(result.thisFunctionalTagCount).toBe(2);
    expect(result.thisIngredientCount).toBe(4);
    expect(result.thisActiveKeys).toEqual(['niacinamide']);
    expect(result.category).toBe('serum');
  });
});
