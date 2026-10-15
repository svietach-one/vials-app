import type { Product, Routine, RoutineStep } from '@/types';
import type { RoutinePlan } from '@/utils/routineEngine/generate';
import type { PlannedStep } from '@/utils/routineEngine/planTypes';
import { buildLeftOutItems } from '@/utils/routineLeftOut';

function product(id: string, extra: Partial<Product> = {}): Product {
  return {
    id,
    name: id,
    brand: null,
    productType: 'toner',
    imageUrl: null,
    activeIngredients: [],
    fullIngredientText: null,
    usageTime: 'both',
    openBeautyFactsId: null,
    addedAt: '2026-01-01',
    notes: null,
    openedDate: null,
    paoMonths: null,
    ...extra,
  };
}

function step(productId: string): PlannedStep {
  return { productId, productType: 'toner', scheduledDays: [], slotIndex: 3, score: 0, addedAt: '2026-01-01' };
}

function plan(overrides: Partial<RoutinePlan> = {}): RoutinePlan {
  return {
    rulesetVersion: 'test',
    generatedFor: '2026-07-04',
    periods: { morning: [], evening: [] },
    frozen: [],
    reserve: [],
    placeholders: [],
    decisions: [],
    slotAlternatives: [],
    ...overrides,
  };
}

function savedStep(productId: string, hidden = false): RoutineStep {
  return { id: `s-${productId}`, productType: 'toner', productId, hidden, scheduledDays: [] };
}

function routines(morning: RoutineStep[], evening: RoutineStep[] = []): Routine[] {
  return [
    { id: 'm', name: 'Morning', timeOfDay: 'morning', steps: morning },
    { id: 'e', name: 'Evening', timeOfDay: 'evening', steps: evening },
  ];
}

describe('buildLeftOutItems', () => {
  it('returns nothing when every owned product has a visible saved step', () => {
    const items = buildLeftOutItems(plan(), [product('a')], routines([savedStep('a')]));

    expect(items).toEqual([]);
  });

  it('lists a product scheduled by the plan but not saved as ready', () => {
    const items = buildLeftOutItems(
      plan({ periods: { morning: [step('a')], evening: [] } }),
      [product('a')],
      routines([]),
    );

    expect(items).toEqual([{ productId: 'a', kind: 'ready', reasonCode: null }]);
  });

  it('treats a product scheduled only in the evening as ready too', () => {
    const items = buildLeftOutItems(plan({ periods: { morning: [], evening: [step('a')] } }), [product('a')], []);

    expect(items[0].kind).toBe('ready');
  });

  it('lists a reserved product with its reserve reason', () => {
    const items = buildLeftOutItems(
      plan({ reserve: [{ productId: 'a', reasonCode: 'duplicate_function' }] }),
      [product('a')],
      [],
    );

    expect(items).toEqual([{ productId: 'a', kind: 'reserve', reasonCode: 'duplicate_function' }]);
  });

  it('lists a frozen product with its reason and expiry date', () => {
    const items = buildLeftOutItems(
      plan({ frozen: [{ productId: 'a', reasonCode: 'peel_rehab_no_exfoliants', until: '2026-07-18', overridesPin: true }] }),
      [product('a')],
      [],
    );

    expect(items).toEqual([
      { productId: 'a', kind: 'frozen', reasonCode: 'peel_rehab_no_exfoliants', until: '2026-07-18' },
    ]);
  });

  it('omits the expiry key when the freeze has none', () => {
    const items = buildLeftOutItems(
      plan({ frozen: [{ productId: 'a', reasonCode: 'pregnancy_blocked', overridesPin: true }] }),
      [product('a')],
      [],
    );

    expect(items[0]).not.toHaveProperty('until');
  });

  it('lists a same-slot loser as an alternative with no reason code', () => {
    const items = buildLeftOutItems(
      plan({ slotAlternatives: [{ winnerProductId: 'w', period: 'morning', slotIndex: 3, alternatives: [step('a')] }] }),
      [product('a')],
      [],
    );

    expect(items).toEqual([{ productId: 'a', kind: 'alternative', reasonCode: null }]);
  });

  it('lets scheduled outrank reserved, reserved outrank frozen, frozen outrank alternative', () => {
    const p = plan({
      periods: { morning: [step('a')], evening: [] },
      reserve: [{ productId: 'a', reasonCode: 'duplicate_function' }, { productId: 'b', reasonCode: 'duplicate_function' }],
      frozen: [
        { productId: 'b', reasonCode: 'relocation_rejected', overridesPin: false },
        { productId: 'c', reasonCode: 'relocation_rejected', overridesPin: false },
      ],
      slotAlternatives: [{ winnerProductId: 'w', period: 'morning', slotIndex: 3, alternatives: [step('c'), step('d')] }],
    });

    const items = buildLeftOutItems(p, ['a', 'b', 'c', 'd'].map((id) => product(id)), []);

    expect(items.map((i) => [i.productId, i.kind])).toEqual([
      ['a', 'ready'],
      ['b', 'reserve'],
      ['c', 'frozen'],
      ['d', 'alternative'],
    ]);
  });

  it('orders ready, reserve, frozen, alternative and keeps shelf order within a kind', () => {
    const p = plan({
      periods: { morning: [step('z'), step('x')], evening: [] },
      reserve: [{ productId: 'r2', reasonCode: 'duplicate_function' }, { productId: 'r1', reasonCode: 'duplicate_function' }],
    });

    const items = buildLeftOutItems(p, ['r1', 'x', 'r2', 'z'].map((id) => product(id)), []);

    expect(items.map((i) => i.productId)).toEqual(['x', 'z', 'r1', 'r2']);
  });

  it('skips products hidden on the shelf and wishlist products', () => {
    const items = buildLeftOutItems(
      plan({ reserve: [{ productId: 'h', reasonCode: 'duplicate_function' }, { productId: 'w', reasonCode: 'duplicate_function' }] }),
      [product('h', { isHidden: true }), product('w', { status: 'wishlist' })],
      [],
    );

    expect(items).toEqual([]);
  });

  it('lists a product whose only step is hidden, and one whose step was removed', () => {
    const p = plan({ periods: { morning: [step('a'), step('b')], evening: [] } });

    const items = buildLeftOutItems(p, [product('a'), product('b')], routines([savedStep('a', true)]));

    expect(items.map((i) => i.productId)).toEqual(['a', 'b']);
  });

  it('does not list a product that has a visible step in only one period', () => {
    const items = buildLeftOutItems(plan(), [product('a')], routines([], [savedStep('a')]));

    expect(items).toEqual([]);
  });

  it('does not list a product that has a visible step on only some weekdays', () => {
    const partial: RoutineStep = { ...savedStep('a'), scheduledDays: [1, 3] };

    expect(buildLeftOutItems(plan(), [product('a')], routines([partial]))).toEqual([]);
  });

  it('falls back to a reserve row for a product no bucket mentions, so nothing is silently dropped', () => {
    const items = buildLeftOutItems(plan(), [product('a')], []);

    expect(items).toEqual([{ productId: 'a', kind: 'reserve', reasonCode: 'not_needed_for_goals' }]);
  });

  it('counts a step with no productId as saving nothing', () => {
    const orphan: RoutineStep = { id: 'o', productType: 'toner', productId: null, hidden: false, scheduledDays: [] };

    expect(buildLeftOutItems(plan(), [product('a')], routines([orphan]))).toHaveLength(1);
  });
});
