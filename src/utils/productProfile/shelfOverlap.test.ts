import type { Product } from '@/types';
import { buildShelfOverlap } from '@/utils/productProfile/shelfOverlap';

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

describe('buildShelfOverlap', () => {
  it('returns [] for an empty Shelf', () => {
    expect(buildShelfOverlap(['niacinamide'], [])).toEqual([]);
  });

  it('returns [] when nothing on the Shelf shares an active with this composition', () => {
    const products = [makeProduct({ fullIngredientText: 'Aqua, Ceramide NP' })];

    expect(buildShelfOverlap(['niacinamide'], products)).toEqual([]);
  });

  it('matches across categories — a niacinamide moisturiser duplicates a niacinamide serum', () => {
    const products = [
      makeProduct({
        id: 'moisturiser-1',
        productType: 'moisturizer',
        brand: 'CeraVe',
        name: 'PM Lotion',
        fullIngredientText: 'Aqua, Niacinamide',
      }),
    ];

    const result = buildShelfOverlap(['niacinamide'], products);

    expect(result).toEqual([
      { key: 'niacinamide', products: [{ id: 'moisturiser-1', label: 'CeraVe PM Lotion' }] },
    ]);
  });

  it('contributes nothing for a product with no fullIngredientText and no activeTags', () => {
    const products = [
      makeProduct({ id: 'blank-1', fullIngredientText: null, activeTags: [] }),
      makeProduct({ id: 'has-it', fullIngredientText: 'Niacinamide' }),
    ];

    const result = buildShelfOverlap(['niacinamide'], products);

    expect(result).toEqual([{ key: 'niacinamide', products: [{ id: 'has-it', label: 'Test Brand Test Product' }] }]);
  });

  it('falls back to name alone when brand is null', () => {
    const products = [
      makeProduct({ id: 'no-brand', brand: null, name: 'Mystery Serum', fullIngredientText: 'Niacinamide' }),
    ];

    const result = buildShelfOverlap(['niacinamide'], products);

    expect(result[0].products[0].label).toBe('Mystery Serum');
  });

  it('orders by products.length descending, then alphabetically by key as the tiebreak', () => {
    const products = [
      makeProduct({ id: 'p1', fullIngredientText: 'Niacinamide' }),
      makeProduct({ id: 'p2', fullIngredientText: 'Ceramide NP' }),
      makeProduct({ id: 'p3', fullIngredientText: 'Ceramide NP' }),
      makeProduct({ id: 'p4', fullIngredientText: 'Hyaluronic Acid' }),
      makeProduct({ id: 'p5', fullIngredientText: 'Hyaluronic Acid' }),
    ];

    const result = buildShelfOverlap(['niacinamide', 'ceramides', 'hyaluronic_acid'], products);

    // ceramides and hyaluronic_acid both have 2 matching products (tie) —
    // alphabetical tiebreak puts ceramides before hyaluronic_acid; niacinamide
    // has only 1 match and sorts last.
    expect(result.map((r) => r.key)).toEqual(['ceramides', 'hyaluronic_acid', 'niacinamide']);
  });

  it('never returns an entry with an empty products array', () => {
    const products = [makeProduct({ fullIngredientText: 'Aqua' })];

    const result = buildShelfOverlap(['niacinamide', 'ceramides'], products);

    expect(result.every((entry) => entry.products.length > 0)).toBe(true);
  });
});
