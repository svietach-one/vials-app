import type { Product, Routine, RoutineStep } from '@/types';
import { getMorningSpfState } from '@/utils/productProfile/morningSpfPresence';

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

describe('getMorningSpfState', () => {
  it('returns "no-morning-routine" for an empty routines array', () => {
    expect(getMorningSpfState([], [])).toBe('no-morning-routine');
  });

  it('returns "no-morning-routine" when only an evening routine exists', () => {
    const routines = [
      makeRoutine({ timeOfDay: 'evening', steps: [makeStep({ productId: 'p1' })] }),
    ];
    const products = [makeProduct({ id: 'p1', productType: 'spf' })];

    expect(getMorningSpfState(routines, products)).toBe('no-morning-routine');
  });

  it('returns "no-morning-routine" when the morning routine has steps but none resolve to a real product', () => {
    const routines = [
      makeRoutine({
        steps: [makeStep({ id: 's1', productId: null }), makeStep({ id: 's2', productId: 'missing' })],
      }),
    ];

    expect(getMorningSpfState(routines, [])).toBe('no-morning-routine');
  });

  it('returns "present" when a visible morning step resolves to an SPF product', () => {
    const routines = [makeRoutine({ steps: [makeStep({ productId: 'p1' })] })];
    const products = [makeProduct({ id: 'p1', productType: 'spf' })];

    expect(getMorningSpfState(routines, products)).toBe('present');
  });

  it('returns "present" even when the SPF product has spfValue === null — presence never depends on the number', () => {
    const routines = [makeRoutine({ steps: [makeStep({ productId: 'p1' })] })];
    const products = [makeProduct({ id: 'p1', productType: 'spf', spfValue: null })];

    expect(getMorningSpfState(routines, products)).toBe('present');
  });

  it('returns "absent" when real morning products exist but none is productType spf', () => {
    const routines = [
      makeRoutine({
        steps: [makeStep({ id: 's1', productId: 'p1' }), makeStep({ id: 's2', productId: 'p2', productType: 'cleanser' })],
      }),
    ];
    const products = [
      makeProduct({ id: 'p1', productType: 'serum' }),
      makeProduct({ id: 'p2', productType: 'cleanser' }),
    ];

    expect(getMorningSpfState(routines, products)).toBe('absent');
  });

  it('excludes a hidden step from both occupancy and SPF presence', () => {
    const routines = [
      makeRoutine({ steps: [makeStep({ productId: 'p1', hidden: true })] }),
    ];
    const products = [makeProduct({ id: 'p1', productType: 'spf' })];

    expect(getMorningSpfState(routines, products)).toBe('no-morning-routine');
  });

  it('excludes a hidden product from both occupancy and SPF presence', () => {
    const routines = [makeRoutine({ steps: [makeStep({ productId: 'p1' })] })];
    const products = [makeProduct({ id: 'p1', productType: 'spf', isHidden: true })];

    expect(getMorningSpfState(routines, products)).toBe('no-morning-routine');
  });

  it('does not crash on a dangling productId with no matching product', () => {
    const routines = [makeRoutine({ steps: [makeStep({ productId: 'ghost' })] })];

    expect(getMorningSpfState(routines, [])).toBe('no-morning-routine');
  });

  it('counts an SPF product scheduled on only one weekday as present — no day-of-week filtering', () => {
    const routines = [
      makeRoutine({ steps: [makeStep({ productId: 'p1', scheduledDays: [2] })] }), // Tuesday only
    ];
    const products = [makeProduct({ id: 'p1', productType: 'spf' })];

    expect(getMorningSpfState(routines, products)).toBe('present');
  });
});
