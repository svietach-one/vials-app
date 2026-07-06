import {
  applyRehabFilter,
  buildRehabWidgetState,
  getRehabDays,
} from '@/utils/routineEngine/rehabFilter';
import type {
  ActiveIngredientKey,
  Product,
  RehabWidgetState,
  Routine,
  UserProcedureLog,
} from '@/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeProcedure(overrides: Partial<UserProcedureLog> = {}): UserProcedureLog {
  return {
    id: 'proc-1',
    procedureKey: 'custom',
    customName: 'Home peel',
    customRehabDays: 7,
    datePerformed: '2026-07-01',
    status: 'rehab',
    deferralCount: 0,
    ...overrides,
  };
}

function makeProduct(id: string, keys: ActiveIngredientKey[]): Product {
  return {
    id,
    name: `Product ${id}`,
    brand: null,
    productType: 'serum',
    imageUrl: null,
    activeIngredients: keys.map((key) => ({ key, displayName: key })),
    fullIngredientText: null,
    usageTime: 'both',
    openBeautyFactsId: null,
    addedAt: '2026-06-01',
    notes: null,
    openedDate: null,
    paoMonths: null,
  };
}

function makeRoutine(productIds: (string | null)[]): Routine {
  return {
    id: 'routine-pm',
    name: 'Evening',
    timeOfDay: 'evening',
    steps: productIds.map((productId, i) => ({
      id: `step-${i}`,
      productType: 'serum',
      productId,
      hidden: false,
      scheduledDays: [],
    })),
  };
}

const PRODUCTS: Product[] = [
  makeProduct('retinol-serum', ['retinol']),
  makeProduct('aha-toner', ['aha']),
  makeProduct('moisturizer', []),
  makeProduct('niacinamide-serum', ['niacinamide']),
];

// ─── getRehabDays ─────────────────────────────────────────────────────────────

describe('getRehabDays', () => {
  it('reads customRehabDays for custom procedures and defaults to 0 when absent', () => {
    expect(getRehabDays(makeProcedure({ customRehabDays: 3 }))).toBe(3);
    expect(getRehabDays(makeProcedure({ customRehabDays: undefined }))).toBe(0);
  });

  it('reads CLINICAL_RULES_DB for pre-defined procedures', () => {
    expect(getRehabDays(makeProcedure({ procedureKey: 'botox' }))).toBe(7);
    expect(getRehabDays(makeProcedure({ procedureKey: 'chemical_peel_deep' }))).toBe(14);
  });
});

// ─── buildRehabWidgetState ────────────────────────────────────────────────────

describe('buildRehabWidgetState', () => {
  it('returns null when no procedures are logged', () => {
    expect(buildRehabWidgetState([], new Date('2026-07-04T12:00:00Z'))).toBeNull();
  });

  it('returns widget state with 1-based day counter inside the rehab window', () => {
    const state = buildRehabWidgetState(
      [makeProcedure({ datePerformed: '2026-07-01', customRehabDays: 7 })],
      new Date('2026-07-03T12:00:00Z'),
    );

    expect(state).toEqual<RehabWidgetState>({
      procedureName: 'Home peel',
      currentDay: 3,
      totalDays: 7,
      barrierStatus: 'disrupted',
      affectedZones: ['face'],
    });
  });

  it('reports barrier as sensitive in the second half of the window', () => {
    const state = buildRehabWidgetState(
      [makeProcedure({ datePerformed: '2026-07-01', customRehabDays: 7 })],
      new Date('2026-07-06T12:00:00Z'),
    );

    expect(state?.currentDay).toBe(6);
    expect(state?.barrierStatus).toBe('sensitive');
  });

  it('self-destructs on day Y + 1 after the rehab window ends', () => {
    const procedures = [makeProcedure({ datePerformed: '2026-07-01', customRehabDays: 7 })];

    const lastDay = buildRehabWidgetState(procedures, new Date('2026-07-07T12:00:00Z'));
    const dayAfter = buildRehabWidgetState(procedures, new Date('2026-07-08T12:00:00Z'));

    expect(lastDay?.currentDay).toBe(7);
    expect(dayAfter).toBeNull();
  });

  it('returns null for long-term procedures whose rehab window is over (Botox month 2)', () => {
    const state = buildRehabWidgetState(
      [makeProcedure({ procedureKey: 'botox', datePerformed: '2026-05-01' })],
      new Date('2026-07-04T12:00:00Z'),
    );

    expect(state).toBeNull();
  });

  it('returns null for Light Care presets (0 rehab days) and archived procedures', () => {
    const now = new Date('2026-07-02T12:00:00Z');

    expect(
      buildRehabWidgetState([makeProcedure({ customRehabDays: 0 })], now),
    ).toBeNull();
    expect(
      buildRehabWidgetState([makeProcedure({ status: 'archived' })], now),
    ).toBeNull();
  });

  it('picks the window ending last when rehab windows overlap', () => {
    const state = buildRehabWidgetState(
      [
        makeProcedure({ id: 'a', customName: 'Short', datePerformed: '2026-07-01', customRehabDays: 3 }),
        makeProcedure({ id: 'b', customName: 'Long', datePerformed: '2026-07-02', customRehabDays: 7 }),
      ],
      new Date('2026-07-03T12:00:00Z'),
    );

    expect(state?.procedureName).toBe('Long');
  });

  it('carries the procedure affectedZones and defaults to face when absent', () => {
    const now = new Date('2026-07-02T12:00:00Z');

    const neckOnly = buildRehabWidgetState(
      [makeProcedure({ affectedZones: ['neck'] })],
      now,
    );
    const unspecified = buildRehabWidgetState([makeProcedure()], now);

    expect(neckOnly?.affectedZones).toEqual(['neck']);
    expect(unspecified?.affectedZones).toEqual(['face']);
  });
});

// ─── applyRehabFilter ─────────────────────────────────────────────────────────

const FACE_REHAB: RehabWidgetState = {
  procedureName: 'Home peel',
  currentDay: 2,
  totalDays: 7,
  barrierStatus: 'disrupted',
  affectedZones: ['face'],
};

describe('applyRehabFilter', () => {
  it('returns the same routine reference when there is no active rehab', () => {
    const routine = makeRoutine(['retinol-serum', 'moisturizer']);

    expect(applyRehabFilter(routine, null, PRODUCTS)).toBe(routine);
  });

  it('masks photosensitizing and exfoliating steps during face rehab', () => {
    const routine = makeRoutine(['retinol-serum', 'aha-toner', 'moisturizer', 'niacinamide-serum']);

    const filtered = applyRehabFilter(routine, FACE_REHAB, PRODUCTS);

    expect(filtered.steps.map((s) => s.productId)).toEqual([
      'moisturizer',
      'niacinamide-serum',
    ]);
  });

  it('leaves the face routine unaffected when rehab covers only the neck', () => {
    const routine = makeRoutine(['retinol-serum', 'aha-toner']);
    const neckRehab: RehabWidgetState = { ...FACE_REHAB, affectedZones: ['neck'] };

    expect(applyRehabFilter(routine, neckRehab, PRODUCTS)).toBe(routine);
  });

  it('keeps empty-slot steps and steps whose product is missing from the catalog', () => {
    const routine = makeRoutine([null, 'deleted-product', 'moisturizer']);

    const filtered = applyRehabFilter(routine, FACE_REHAB, PRODUCTS);

    expect(filtered.steps).toHaveLength(3);
  });

  it('does not mutate the input routine', () => {
    const routine = makeRoutine(['retinol-serum', 'moisturizer']);

    applyRehabFilter(routine, FACE_REHAB, PRODUCTS);

    expect(routine.steps).toHaveLength(2);
  });

  it('masks a product whose restricted active is confirmed only via wizard activeTags', () => {
    // Regression for the qa-lead 2026-07-04 finding: activeTags are
    // authoritative and must drive the rehab mask like every other consumer.
    const tagOnly: Product = {
      ...makeProduct('tag-only-retinoid', []),
      activeTags: ['retinoid'],
    };
    const routine = makeRoutine(['tag-only-retinoid', 'moisturizer']);

    const filtered = applyRehabFilter(routine, FACE_REHAB, [...PRODUCTS, tagOnly]);

    expect(filtered.steps.map((s) => s.productId)).toEqual(['moisturizer']);
  });
});
