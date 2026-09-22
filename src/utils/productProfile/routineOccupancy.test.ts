import type { Product, Routine, RoutineStep } from '@/types';
import { findRoutineOccupants } from '@/utils/productProfile/routineOccupancy';

function makeStep(overrides: Partial<RoutineStep> = {}): RoutineStep {
  return {
    id: 'step-1',
    productType: 'serum',
    productId: 'p1',
    hidden: false,
    scheduledDays: [],
    ...overrides,
  };
}

function makeRoutine(overrides: Partial<Routine> = {}): Routine {
  return {
    id: 'r1',
    name: 'Morning',
    timeOfDay: 'morning',
    steps: [],
    ...overrides,
  };
}

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

describe('findRoutineOccupants', () => {
  it('returns [] when targetPhase is null — no phase to match against', () => {
    const routines = [makeRoutine({ steps: [makeStep({ productId: 'p1' })] })];
    const products = [makeProduct({ id: 'p1', productType: 'serum' })];

    expect(findRoutineOccupants(null, routines, products)).toEqual([]);
  });

  it('matches by shared layering slot, not exact ProductType (serum/gel both slot 6)', () => {
    const routines = [makeRoutine({ steps: [makeStep({ productId: 'p1', productType: 'gel' })] })];
    const products = [makeProduct({ id: 'p1', brand: 'CeraVe', name: 'PM Lotion', productType: 'gel' })];

    expect(findRoutineOccupants(6, routines, products)).toEqual([{ id: 'p1', label: 'CeraVe PM Lotion' }]);
  });

  it('excludes a step whose productType maps to a different phase', () => {
    const routines = [makeRoutine({ steps: [makeStep({ productId: 'p1', productType: 'cleanser' })] })];
    const products = [makeProduct({ id: 'p1', productType: 'cleanser' })];

    expect(findRoutineOccupants(6, routines, products)).toEqual([]);
  });

  it('contributes nothing for a step with a null productId, and does not crash', () => {
    const routines = [makeRoutine({ steps: [makeStep({ productId: null })] })];

    expect(findRoutineOccupants(6, routines, [])).toEqual([]);
  });

  it('does not crash on a dangling productId with no matching product', () => {
    const routines = [makeRoutine({ steps: [makeStep({ productId: 'ghost' })] })];

    expect(findRoutineOccupants(6, routines, [])).toEqual([]);
  });

  it('excludes a hidden step', () => {
    const routines = [makeRoutine({ steps: [makeStep({ productId: 'p1', hidden: true })] })];
    const products = [makeProduct({ id: 'p1', productType: 'serum' })];

    expect(findRoutineOccupants(6, routines, products)).toEqual([]);
  });

  it('excludes a hidden product', () => {
    const routines = [makeRoutine({ steps: [makeStep({ productId: 'p1' })] })];
    const products = [makeProduct({ id: 'p1', productType: 'serum', isHidden: true })];

    expect(findRoutineOccupants(6, routines, products)).toEqual([]);
  });

  it('scans across all routines, not just the first', () => {
    const routines = [
      makeRoutine({ id: 'r1', timeOfDay: 'morning', steps: [makeStep({ productId: 'p1' })] }),
      makeRoutine({ id: 'r2', timeOfDay: 'evening', steps: [makeStep({ productId: 'p2' })] }),
    ];
    const products = [
      makeProduct({ id: 'p1', productType: 'serum' }),
      makeProduct({ id: 'p2', productType: 'gel' }),
    ];

    expect(findRoutineOccupants(6, routines, products).map((o) => o.id)).toEqual(['p1', 'p2']);
  });
});
