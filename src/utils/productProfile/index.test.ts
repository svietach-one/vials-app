import type { Product } from '@/types';
import {
  BUILDER_VERSION,
  buildProductProfileFromActiveKeys,
  buildProductProfileFromProduct,
} from '@/utils/productProfile';

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

describe('buildProductProfileFromProduct — malformed input', () => {
  it('throws a TypeError when productId is empty', () => {
    expect(() => buildProductProfileFromProduct(makeProduct({ id: '' }))).toThrow(TypeError);
  });
});

describe('buildProductProfileFromActiveKeys — malformed input', () => {
  it('throws a TypeError when productId is empty', () => {
    expect(() =>
      buildProductProfileFromActiveKeys({
        productId: '',
        productType: 'serum',
        brand: null,
        name: 'Test',
        activeKeys: [],
      }),
    ).toThrow(TypeError);
  });
});

describe('build metadata', () => {
  it('stamps the current builderVersion and a valid ISO builtAt timestamp', () => {
    const profile = buildProductProfileFromProduct(makeProduct());

    expect(profile.builderVersion).toBe(BUILDER_VERSION);
    expect(() => new Date(profile.builtAt).toISOString()).not.toThrow();
    expect(new Date(profile.builtAt).toISOString()).toBe(profile.builtAt);
  });
});

describe('overallConfidence rollup', () => {
  it('is the worst tier among capabilities/irritation/sensitivity/routinePosition, not an average', () => {
    // A well-resolved product still rolls up to insufficient_data this
    // milestone because sensitivityCompatibility is unconditionally
    // insufficient_data and folds into the worst-tier rollup (spec §7,
    // tech-design FE-5/FE-7) — asserted here as a builder-level unit-test
    // companion to the qa-lead integration suite's AC-9.
    const profile = buildProductProfileFromProduct(
      makeProduct({ activeTags: ['ceramides'], fullIngredientText: 'Ceramide NP' }),
    );

    expect(profile.overallConfidence).toBe('insufficient_data');
    expect(profile.sensitivityCompatibility.confidence).toBe('insufficient_data');
    expect(profile.capabilities.barrierRepair.confidence).toBe('deterministic');
  });
});

describe('tag-only potency defaulting (regression — 2026-08-06 review finding)', () => {
  it('scores irritation at the high-potency tier for a wizard-confirmed retinoid tag with no INCI text, matching routineEngine/productFacts.ts\'s DEFAULT_TAG_POTENCY convention', () => {
    const profile = buildProductProfileFromProduct(
      makeProduct({ activeTags: ['retinoid'], fullIngredientText: null }),
    );

    // actives.json: irritancy (flat) = 3, irritancyByPotency.high = 4.
    // Before the fix this scored 3 (flat fallback for potency: undefined).
    expect(profile.irritation.score).toBe(4);
  });
});

describe('primaryFunctions / strengthsWeaknesses — Milestone 1 deferral', () => {
  it('always ships an empty primaryFunctions array and a null strengthsWeaknesses', () => {
    const profile = buildProductProfileFromProduct(
      makeProduct({ activeTags: ['ceramides'], fullIngredientText: 'Ceramide NP' }),
    );

    expect(profile.primaryFunctions).toEqual([]);
    expect(profile.strengthsWeaknesses).toBeNull();
  });
});
