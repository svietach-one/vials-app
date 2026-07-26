/**
 * Unit tests for barrier / humectant tag parsing (PRD v1.2 §5.2). The key
 * invariant is separation: barrier keys live in their own key space and never
 * appear in an ActiveIngredientKey[].
 */

import { getProductBarrierTags, parseBarrierTags } from '@/utils/barrierTags';
import { parseActiveIngredientsFromInci } from '@/utils/ingredientParser';
import type { Product } from '@/types';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'bt-1',
    name: 'Barrier Cream',
    brand: null,
    productType: 'moisturizer',
    imageUrl: null,
    activeIngredients: [],
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

describe('parseBarrierTags', () => {
  it('detects hyaluronic acid under either INCI name', () => {
    // Arrange / Act / Assert
    expect(parseBarrierTags('Water, Hyaluronic Acid, Glycerin')).toContain('HYAL');
    expect(parseBarrierTags('Water, Sodium Hyaluronate')).toContain('HYAL');
  });

  it('detects ceramides, panthenol and niacinamide', () => {
    // Arrange
    const inci = 'Water, Niacinamide, Ceramide NP, Panthenol';
    // Act
    const tags = parseBarrierTags(inci);
    // Assert
    expect(tags).toEqual(expect.arrayContaining(['NIAC', 'CERA', 'PANT']));
  });

  it('detects zinc PCA, which the actives ruleset does not model', () => {
    expect(parseBarrierTags('Water, Zinc PCA, Glycerin')).toContain('ZPCA');
    expect(parseBarrierTags('Water, Zinc Pyrrolidone Carboxylate')).toContain('ZPCA');
  });

  it('returns nothing for a formula with no barrier ingredients', () => {
    expect(parseBarrierTags('Water, Retinol, Tocopherol')).toEqual([]);
  });

  it('keeps barrier keys out of the active-ingredient key space', () => {
    // Arrange
    const inci = 'Water, Zinc PCA, Sodium Hyaluronate';
    // Act
    const activeKeys = parseActiveIngredientsFromInci(inci);
    // Assert — no barrier key ever leaks into the conflict-grade tag array
    expect(activeKeys).not.toContain('ZPCA');
    expect(activeKeys).not.toContain('HYAL');
  });
});

describe('getProductBarrierTags', () => {
  it('reads wizard-confirmed tags as well as raw INCI text', () => {
    // Arrange
    const product = makeProduct({
      activeTags: ['ceramides'],
      fullIngredientText: 'Water, Sodium Hyaluronate',
    });
    // Act
    const tags = getProductBarrierTags(product);
    // Assert
    expect(tags).toEqual(expect.arrayContaining(['CERA', 'HYAL']));
  });

  it('de-duplicates a group declared twice', () => {
    // Arrange
    const product = makeProduct({
      activeIngredients: [{ key: 'niacinamide', displayName: 'Niacinamide' }],
      activeTags: ['niacinamide'],
      fullIngredientText: 'Water, Niacinamide',
    });
    // Act
    const tags = getProductBarrierTags(product);
    // Assert
    expect(tags.filter((t) => t === 'NIAC')).toHaveLength(1);
  });

  it('returns an empty list for a product with no ingredient data', () => {
    expect(getProductBarrierTags(makeProduct())).toEqual([]);
  });
});
