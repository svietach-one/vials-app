import type { Product } from '@/types';
import type { PlannedStep } from '@/utils/routineEngine/planTypes';
import { buildProductFacts } from '@/utils/routineEngine/productFacts';
import {
  getSlotIndex,
  isTreatment,
  orderSteps,
  periodsForProduct,
  preferredPeriodFor,
} from '@/utils/routineEngine/slotting';

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
  return buildProductFacts(product, NOW);
}

function makeStep(overrides: Partial<PlannedStep>): PlannedStep {
  return {
    productId: 'p1',
    productType: 'serum',
    scheduledDays: [],
    slotIndex: 6,
    score: 0,
    addedAt: '2026-01-01',
    ...overrides,
  };
}

describe('getSlotIndex', () => {
  it('orders the canonical layering chain cleanser → serum → moisturizer → spf', () => {
    expect(getSlotIndex('cleanser')).toBeLessThan(getSlotIndex('toner'));
    expect(getSlotIndex('toner')).toBeLessThan(getSlotIndex('serum'));
    expect(getSlotIndex('serum')).toBeLessThan(getSlotIndex('moisturizer'));
    expect(getSlotIndex('moisturizer')).toBeLessThan(getSlotIndex('spf'));
  });

  it('shares a slot between serum and gel, and between lotion/cream/moisturizer', () => {
    expect(getSlotIndex('gel')).toBe(getSlotIndex('serum'));
    expect(getSlotIndex('lotion')).toBe(getSlotIndex('cream'));
    expect(getSlotIndex('cream')).toBe(getSlotIndex('moisturizer'));
  });

  it('slots other after serums', () => {
    expect(getSlotIndex('other')).toBeGreaterThan(getSlotIndex('serum'));
    expect(getSlotIndex('other')).toBeLessThan(getSlotIndex('moisturizer'));
  });
});

describe('periodsForProduct', () => {
  it('restricts spf product types to am regardless of parsed classes', () => {
    const facts = makeFacts({ productType: 'spf' }); // no classes → allowedPeriods both
    expect(periodsForProduct('spf', facts)).toEqual(['am']);
  });

  it('passes facts periods through for other product types', () => {
    const facts = makeFacts({ activeTags: ['retinoid'] });
    expect(periodsForProduct('serum', facts)).toEqual(['pm']);
  });
});

describe('isTreatment', () => {
  it('classifies strong-carrier actives as treatments — mild ones render freely', () => {
    // phase-04 tightened the boundary to the cumulative rule (irritancy >= 3):
    // mild bioactives like niacinamide carry no cumulative restriction and
    // may render in every allowed period (2026-07-17 directive, report §7).
    expect(isTreatment(makeFacts({ activeTags: ['retinoid'] }))).toBe(true);
    expect(isTreatment(makeFacts({ activeTags: ['niacinamide'] }))).toBe(false);
  });

  it('classifies benign hydrators and products without actives as non-treatments', () => {
    expect(isTreatment(makeFacts({ activeTags: ['hyaluronic_acid'] }))).toBe(false);
    expect(isTreatment(makeFacts({ activeTags: ['ceramides'] }))).toBe(false);
    expect(isTreatment(makeFacts())).toBe(false);
  });
});

describe('preferredPeriodFor', () => {
  it('returns the only allowed period when there is one', () => {
    const facts = makeFacts({ activeTags: ['retinoid'] });
    expect(preferredPeriodFor(facts, ['pm'])).toBe('pm');
  });

  it('uses the class convention when both periods are allowed (vitamin C → am)', () => {
    const facts = makeFacts({ activeTags: ['vitamin_c_pure'] });
    expect(preferredPeriodFor(facts, ['am', 'pm'])).toBe('am');
  });

  it('defaults treatments without a convention to pm', () => {
    const facts = makeFacts({ activeTags: ['azelaic_acid'] });
    expect(preferredPeriodFor(facts, ['am', 'pm'])).toBe('pm');
  });
});

describe('orderSteps', () => {
  it('sorts by slot index first', () => {
    const steps = [
      makeStep({ productId: 'spf', productType: 'spf', slotIndex: 13 }),
      makeStep({ productId: 'cleanser', productType: 'cleanser', slotIndex: 1 }),
      makeStep({ productId: 'serum', productType: 'serum', slotIndex: 6 }),
    ];
    expect(orderSteps(steps).map((s) => s.productId)).toEqual(['cleanser', 'serum', 'spf']);
  });

  it('breaks slot ties by score, then newer addedAt, then id', () => {
    const steps = [
      makeStep({ productId: 'c', score: 10, addedAt: '2026-01-01' }),
      makeStep({ productId: 'b', score: 10, addedAt: '2026-02-01' }),
      makeStep({ productId: 'a', score: 50, addedAt: '2026-01-01' }),
    ];
    expect(orderSteps(steps).map((s) => s.productId)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the input array', () => {
    const steps = [makeStep({ productId: 'b', slotIndex: 9 }), makeStep({ productId: 'a', slotIndex: 1 })];
    orderSteps(steps);
    expect(steps[0].productId).toBe('b');
  });
});
