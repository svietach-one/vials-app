import type { RuleTargets } from '@/constants/rulesets/rulesetTypes';
import type { Product } from '@/types';
import { buildProductFacts } from '@/utils/routineEngine/productFacts';
import { matchesRuleTargets } from '@/utils/routineEngine/targeting';

const NOW = new Date('2026-07-04T12:00:00Z');

function makeFacts(overrides: Partial<Product> = {}) {
  const product: Product = {
    id: 'p1',
    name: 'Test',
    brand: null,
    productType: 'serum',
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
  return { productType: product.productType, facts: buildProductFacts(product, NOW) };
}

describe('matchesRuleTargets', () => {
  it('matches boolean property targets', () => {
    const { productType, facts } = makeFacts({ activeTags: ['aha'] });
    expect(matchesRuleTargets(productType, facts, { properties: { exfoliating: true } })).toBe(true);
    expect(matchesRuleTargets(productType, facts, { properties: { barrierRepair: true } })).toBe(false);
  });

  it('evaluates comparator strings against numeric properties', () => {
    const { productType, facts } = makeFacts({ activeTags: ['retinoid'] }); // irritancy 3
    expect(matchesRuleTargets(productType, facts, { properties: { irritancy: '>=3' } })).toBe(true);
    expect(matchesRuleTargets(productType, facts, { properties: { irritancy: '>=4' } })).toBe(false);
  });

  it('matches class list targets', () => {
    const { productType, facts } = makeFacts({ activeTags: ['retinoid'] });
    expect(matchesRuleTargets(productType, facts, { classes: ['retinoid', 'aha'] })).toBe(true);
    expect(matchesRuleTargets(productType, facts, { classes: ['aha'] })).toBe(false);
  });

  it('matches product type targets', () => {
    const { productType, facts } = makeFacts({ productType: 'spf' });
    expect(matchesRuleTargets(productType, facts, { productTypes: ['spf'] })).toBe(true);
    expect(matchesRuleTargets(productType, facts, { productTypes: ['serum'] })).toBe(false);
  });

  it('ANDs multiple selectors in one target object', () => {
    const { productType, facts } = makeFacts({ activeTags: ['aha'] });
    expect(
      matchesRuleTargets(productType, facts, {
        properties: { exfoliating: true },
        productTypes: ['serum'],
      }),
    ).toBe(true);
    expect(
      matchesRuleTargets(productType, facts, {
        properties: { exfoliating: true },
        productTypes: ['spf'],
      }),
    ).toBe(false);
  });

  it('unions nested selectors under anyOf (custom_default shape)', () => {
    const targets: RuleTargets = {
      anyOf: [
        { properties: { exfoliating: true } },
        { properties: { irritancy: '>=3' } },
      ],
    };
    // benzoyl peroxide: not exfoliating but irritancy 3 → matches via second arm
    const benzoyl = makeFacts({ activeTags: ['benzoyl_peroxide'] });
    expect(matchesRuleTargets(benzoyl.productType, benzoyl.facts, targets)).toBe(true);
    // niacinamide: neither arm
    const niacinamide = makeFacts({ activeTags: ['niacinamide'] });
    expect(matchesRuleTargets(niacinamide.productType, niacinamide.facts, targets)).toBe(false);
  });

  it('never matches an empty selector', () => {
    const { productType, facts } = makeFacts({ activeTags: ['retinoid'] });
    expect(matchesRuleTargets(productType, facts, {})).toBe(false);
  });
});
