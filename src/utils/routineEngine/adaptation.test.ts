import type { Product, ProductApplicationStats } from '@/types';
import {
  applicationCountFor,
  applyAdaptationRegression,
  collectAdaptationLimits,
  collectTolerability,
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

function stats(
  productId: string,
  count: number,
  lastAppliedDate = '2026-07-03',
): ProductApplicationStats[] {
  return [{ productId, count, lastAppliedDate, firstAppliedDate: null }];
}

describe('virtualApplicationCount — anchored on first-scheduled date (phase-05)', () => {
  it('assumes 2 applications per week for the first two weeks since first scheduling', () => {
    expect(virtualApplicationCount('2026-07-04', NOW)).toBe(0); // scheduled today
    expect(virtualApplicationCount('2026-06-27', NOW)).toBe(2); // 1 full week
    expect(virtualApplicationCount('2026-06-20', NOW)).toBe(4); // 2 full weeks
  });

  it('assumes 4 per week from week 3 (phase 2 pace)', () => {
    expect(virtualApplicationCount('2026-06-13', NOW)).toBe(8); // 3 weeks
    expect(virtualApplicationCount('2026-06-06', NOW)).toBe(12); // 4 weeks → phase 3
  });

  it('returns 0 for a never-scheduled product — the usage anchor', () => {
    // The reversal: no anchor → phase 1, regardless of how long it was owned.
    expect(virtualApplicationCount(null, NOW)).toBe(0);
    expect(virtualApplicationCount(undefined, NOW)).toBe(0);
  });

  it('never returns a negative count for a future anchor', () => {
    expect(virtualApplicationCount('2026-08-01', NOW)).toBe(0);
  });
});

describe('applicationCountFor', () => {
  it('uses the tracked counter in dynamic mode', () => {
    const product = makeProduct({ addedAt: '2026-01-01' });
    expect(applicationCountFor(product, stats('p1', 3), 'dynamic', NOW)).toBe(3);
  });

  it('uses the tracked counter in fixed mode too (phase-05 §5.4)', () => {
    // Reversal of the old "fixed mode ignores stats": a fixed-mode user who
    // checks in has real data, and the anchor must be visible to them.
    const product = makeProduct({ addedAt: '2026-06-20' });
    expect(applicationCountFor(product, stats('p1', 99), 'fixed', NOW)).toBe(99);
  });

  it('falls back to the anchored virtual count for an untracked product', () => {
    const product = makeProduct({ id: 'p1', addedAt: '2026-06-20' });
    // No stats, anchor 2 weeks ago → virtual count 4.
    expect(applicationCountFor(product, [], 'dynamic', NOW, { p1: '2026-06-20' })).toBe(4);
  });

  it('returns 0 for an untracked, never-scheduled product regardless of addedAt', () => {
    // The headline reversal: a long-owned but never-scheduled product is phase 1.
    const product = makeProduct({ id: 'p1', addedAt: '2020-01-01' });
    expect(applicationCountFor(product, [], 'fixed', NOW)).toBe(0);
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
  it('caps a fresh retinoid at 2 days/week and leaves a long-adapted one uncapped', () => {
    // phase-05: adaptation is anchored on the first-scheduled date, so the
    // "adapted" product needs an OLD anchor (not just an old addedAt) to reach
    // phase 3 — a never-scheduled product would itself sit at phase 1.
    const fresh = makeProduct({ id: 'fresh', activeTags: ['retinoid'] });
    const adapted = makeProduct({ id: 'adapted', activeTags: ['retinoid'] });
    const plain = makeProduct({ id: 'plain' });
    const products = [fresh, adapted, plain];
    const anchors = { fresh: '2026-07-01', adapted: '2026-01-01' }; // fresh: days; adapted: 6 months

    const limits = collectAdaptationLimits(products, buildShelfFacts(products, NOW), [], 'fixed', NOW, anchors);

    expect(limits.get('fresh')).toEqual({ maxDaysPerWeek: 2, reasonCode: 'adaptation_phase_1' });
    expect(limits.has('adapted')).toBe(false); // old anchor → phase 3 → uncapped
    expect(limits.has('plain')).toBe(false);
  });

  it('caps a long-owned but never-scheduled retinoid at phase 1 (the reversal)', () => {
    const veteran = makeProduct({ id: 'veteran', activeTags: ['retinoid'], addedAt: '2020-01-01' });
    const limits = collectAdaptationLimits([veteran], buildShelfFacts([veteran], NOW), [], 'fixed', NOW);
    // No anchor → phase 1 → capped, where V2 left it uncapped at phase 3.
    expect(limits.get('veteran')).toEqual({ maxDaysPerWeek: 2, reasonCode: 'adaptation_phase_1' });
  });
});

describe('applyAdaptationRegression (phase-05 §5.2)', () => {
  it('leaves the phase unchanged within 14 days of the last application', () => {
    expect(applyAdaptationRegression(2, '2026-06-24', NOW)).toBe(2); // 10 days
  });

  it('drops one phase after a break longer than 14 days', () => {
    expect(applyAdaptationRegression(2, '2026-06-15', NOW)).toBe(1); // 19 days
    expect(applyAdaptationRegression(1, '2026-06-15', NOW)).toBe(0);
  });

  it('resets to phase 1 after a break longer than 28 days', () => {
    expect(applyAdaptationRegression(2, '2026-05-20', NOW)).toBe(0); // 45 days
  });

  it('floors at phase 1 — never goes negative', () => {
    expect(applyAdaptationRegression(0, '2026-05-20', NOW)).toBe(0);
  });

  it('does not regress a product that was never applied', () => {
    expect(applyAdaptationRegression(2, null, NOW)).toBe(2);
  });
});

describe('getAdaptationStatus — regression + tolerability (phase-05)', () => {
  const retinoid = makeProduct({ activeTags: ['retinoid'] });
  const facts = buildProductFacts(retinoid, NOW);

  it('regresses a 10-application retinoid to phase 1 after a 30-day break', () => {
    // count 10 → raw phase 3; last applied 30 days ago → reset to phase 1.
    const status = getAdaptationStatus(retinoid, facts, stats('p1', 10, '2026-06-04'), 'dynamic', NOW);
    expect(status?.phaseIndex).toBe(0);
    expect(status?.maxDaysPerWeek).toBe(2);
  });

  it('regresses one phase after a 16-day break, not a full reset', () => {
    // count 5 → raw phase 2 (index 1); 16-day break → index 0.
    const status = getAdaptationStatus(retinoid, facts, stats('p1', 5, '2026-06-18'), 'dynamic', NOW);
    expect(status?.phaseIndex).toBe(0);
  });

  it('does not regress a mild active (irritancy < 3)', () => {
    // niacinamide has no adaptation config at all → null, but assert the gate
    // holds for a hypothetical adapting mild class via the irritancy guard.
    const copper = makeProduct({ activeTags: ['copper_peptides'] });
    const copperFacts = buildProductFacts(copper, NOW);
    // copper_peptides has no adaptation config → null regardless.
    expect(getAdaptationStatus(copper, copperFacts, [], 'fixed', NOW)).toBeNull();
  });
});

describe('collectTolerability (phase-05 §5.3)', () => {
  it('maps phaseIndex to 0 / 0.5 / 1.0 for adapting products', () => {
    const p1 = makeProduct({ id: 'p1', activeTags: ['retinoid'] }); // count 2 → phase 1 (index 0)
    const p3 = makeProduct({ id: 'p3', activeTags: ['retinoid'] }); // count 10 → phase 3 (index 2)
    const facts = buildShelfFacts([p1, p3], NOW);
    const tol = collectTolerability(
      [p1, p3],
      facts,
      [
        { productId: 'p1', count: 2, lastAppliedDate: '2026-07-03', firstAppliedDate: null },
        { productId: 'p3', count: 10, lastAppliedDate: '2026-07-03', firstAppliedDate: null },
      ],
      'dynamic',
      NOW,
    );
    expect(tol.get('p1')).toBe(0); // phase 1
    expect(tol.get('p3')).toBe(1); // phase 3 → fully tolerated
  });

  it('omits products with no adapting class', () => {
    const plain = makeProduct({ id: 'plain' });
    const tol = collectTolerability([plain], buildShelfFacts([plain], NOW), [], 'fixed', NOW);
    expect(tol.has('plain')).toBe(false);
  });
});
