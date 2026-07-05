import type { Product, ProductApplicationStats } from '@/types';
import {
  applicationCountFor,
  collectAdaptationLimits,
  getAdaptationStatus,
  virtualApplicationCount,
} from '@/utils/routineEngine/adaptation';
import { buildShelfFacts, buildProductFacts } from '@/utils/routineEngine/productFacts';

const NOW = new Date('2026-07-04T12:00:00Z');

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Test',
    brand: null,
    productType: 'serum',
    imageUrl: null,
    activeIngredients: [],
    fullIngredientText: null,
    usageTime: 'both',
    openBeautyFactsId: null,
    addedAt: '2026-07-01',
    notes: null,
    openedDate: null,
    paoMonths: null,
    ...overrides,
  };
}

function stats(productId: string, count: number): ProductApplicationStats[] {
  return [{ productId, count, lastAppliedDate: '2026-07-03' }];
}

describe('virtualApplicationCount', () => {
  it('assumes 2 applications per week for the first two weeks', () => {
    expect(virtualApplicationCount('2026-07-04', NOW)).toBe(0); // added today
    expect(virtualApplicationCount('2026-06-27', NOW)).toBe(2); // 1 full week
    expect(virtualApplicationCount('2026-06-20', NOW)).toBe(4); // 2 full weeks
  });

  it('assumes 4 per week from week 3 (phase 2 pace)', () => {
    expect(virtualApplicationCount('2026-06-13', NOW)).toBe(8); // 3 weeks
    expect(virtualApplicationCount('2026-06-06', NOW)).toBe(12); // 4 weeks → phase 3
  });

  it('never returns a negative count for a future addedAt', () => {
    expect(virtualApplicationCount('2026-08-01', NOW)).toBe(0);
  });
});

describe('applicationCountFor', () => {
  it('uses the tracked counter in dynamic mode', () => {
    const product = makeProduct({ addedAt: '2026-01-01' }); // virtual would be huge
    expect(applicationCountFor(product, stats('p1', 3), 'dynamic', NOW)).toBe(3);
  });

  it('falls back to the virtual count in dynamic mode for untracked products', () => {
    const product = makeProduct({ addedAt: '2026-06-20' });
    expect(applicationCountFor(product, [], 'dynamic', NOW)).toBe(4);
  });

  it('always uses the virtual count in fixed mode', () => {
    const product = makeProduct({ addedAt: '2026-06-20' });
    expect(applicationCountFor(product, stats('p1', 99), 'fixed', NOW)).toBe(4);
  });
});

describe('getAdaptationStatus', () => {
  const retinoid = makeProduct({ activeTags: ['retinoid'] });
  const facts = buildProductFacts(retinoid, NOW);

  it('reports phase 1 (2×/week, week 1–2) through the fourth application', () => {
    const status = getAdaptationStatus(retinoid, facts, stats('p1', 2), 'dynamic', NOW);
    expect(status).toEqual({
      phaseIndex: 0,
      maxDaysPerWeek: 2,
      week: 1,
      reasonCode: 'adaptation_phase_1',
    });
    expect(getAdaptationStatus(retinoid, facts, stats('p1', 4), 'dynamic', NOW)?.week).toBe(2);
  });

  it('reports phase 2 (4×/week, week 3–4) for applications five through eight', () => {
    const status = getAdaptationStatus(retinoid, facts, stats('p1', 5), 'dynamic', NOW);
    expect(status).toEqual({
      phaseIndex: 1,
      maxDaysPerWeek: 4,
      week: 3,
      reasonCode: 'adaptation_phase_2',
    });
    expect(getAdaptationStatus(retinoid, facts, stats('p1', 8), 'dynamic', NOW)?.week).toBe(4);
  });

  it('reports phase 3 with no cap past the eighth application', () => {
    const status = getAdaptationStatus(retinoid, facts, stats('p1', 9), 'dynamic', NOW);
    expect(status).toEqual({
      phaseIndex: 2,
      maxDaysPerWeek: undefined,
      week: null,
      reasonCode: 'adaptation_phase_3',
    });
  });

  it('returns null for products without an adapting class', () => {
    const hydrator = makeProduct({ activeTags: ['hyaluronic_acid'] });
    const status = getAdaptationStatus(
      hydrator,
      buildProductFacts(hydrator, NOW),
      [],
      'fixed',
      NOW,
    );
    expect(status).toBeNull();
  });
});

describe('collectAdaptationLimits', () => {
  it('caps a fresh retinoid at 2 days/week and leaves adapted products uncapped', () => {
    const fresh = makeProduct({ id: 'fresh', activeTags: ['retinoid'], addedAt: '2026-07-01' });
    const adapted = makeProduct({ id: 'adapted', activeTags: ['retinoid'], addedAt: '2026-01-01' });
    const plain = makeProduct({ id: 'plain' });
    const products = [fresh, adapted, plain];

    const limits = collectAdaptationLimits(products, buildShelfFacts(products, NOW), [], 'fixed', NOW);

    expect(limits.get('fresh')).toEqual({ maxDaysPerWeek: 2, reasonCode: 'adaptation_phase_1' });
    expect(limits.has('adapted')).toBe(false); // 5+ weeks old → phase 3 via virtual count
    expect(limits.has('plain')).toBe(false);
  });
});
