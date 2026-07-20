import { buildCalendarMatrix, getDaysInMonth } from '@/utils/calendarMatrix';
import { isScheduledOnDay } from '@/utils/routineSchedule';
import type { Product, Routine, RoutineStep } from '@/types';

/**
 * Unit tests — calendar matrix builder (img-05). The month is always injected,
 * never read from the clock (testing.md).
 */

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Gentle Cleanser',
    brand: 'Vials',
    productType: 'cleanser',
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

function makeStep(overrides: Partial<RoutineStep> = {}): RoutineStep {
  return {
    id: 's1',
    productType: 'cleanser',
    productId: 'p1',
    hidden: false,
    scheduledDays: [],
    ...overrides,
  };
}

function makeRoutines(am: RoutineStep[], pm: RoutineStep[] = []): Routine[] {
  return [
    { id: 'r-am', name: 'Morning', timeOfDay: 'morning', steps: am },
    { id: 'r-pm', name: 'Evening', timeOfDay: 'evening', steps: pm },
  ];
}

// July 2026: the 1st is a Wednesday; 31 days.
const JULY_2026 = new Date(2026, 6, 1);

describe('getDaysInMonth', () => {
  it('returns 31 for July and 30 for June', () => {
    expect(getDaysInMonth(2026, 6)).toBe(31);
    expect(getDaysInMonth(2026, 5)).toBe(30);
  });

  it('returns 28 for a common-year February and 29 for a leap-year February', () => {
    expect(getDaysInMonth(2026, 1)).toBe(28);
    expect(getDaysInMonth(2028, 1)).toBe(29);
  });
});

describe('buildCalendarMatrix', () => {
  it('fills every day for an empty scheduledDays array ("every day")', () => {
    const matrix = buildCalendarMatrix(
      makeRoutines([makeStep({ scheduledDays: [] })]),
      [makeProduct()],
      JULY_2026,
    );

    expect(matrix.daysInMonth).toBe(31);
    expect(matrix.rows).toHaveLength(1);
    expect(matrix.rows[0].cells.every((c) => c.am)).toBe(true);
    expect(matrix.rows[0].cells.every((c) => !c.pm)).toBe(true);
  });

  it('fills only the scheduled weekdays for a specific-days schedule', () => {
    // Mondays only. July 2026 starts on a Wednesday, so the 6th is the first Monday.
    const matrix = buildCalendarMatrix(
      makeRoutines([makeStep({ scheduledDays: [1] })]),
      [makeProduct()],
      JULY_2026,
    );

    const filledDays = matrix.rows[0].cells
      .map((cell, i) => (cell.am ? i + 1 : null))
      .filter((d): d is number => d !== null);

    expect(filledDays).toEqual([6, 13, 20, 27]);
  });

  it('marks AM and PM independently for a product used in both periods', () => {
    const matrix = buildCalendarMatrix(
      makeRoutines(
        [makeStep({ id: 'am1', scheduledDays: [1] })],
        [makeStep({ id: 'pm1', scheduledDays: [2] })],
      ),
      [makeProduct()],
      JULY_2026,
    );

    expect(matrix.rows).toHaveLength(1);
    // 6 July = Monday → AM only; 7 July = Tuesday → PM only.
    expect(matrix.rows[0].cells[5]).toEqual({ am: true, pm: false });
    expect(matrix.rows[0].cells[6]).toEqual({ am: false, pm: true });
  });

  it('excludes steps hidden from the routine', () => {
    const matrix = buildCalendarMatrix(
      makeRoutines([makeStep({ hidden: true })]),
      [makeProduct()],
      JULY_2026,
    );

    expect(matrix.rows).toEqual([]);
  });

  it('excludes steps whose product was deleted (dangling productId)', () => {
    const matrix = buildCalendarMatrix(
      makeRoutines([makeStep({ productId: 'gone' })]),
      [makeProduct()],
      JULY_2026,
    );

    expect(matrix.rows).toEqual([]);
  });

  it('excludes steps whose product is hidden from routines', () => {
    const matrix = buildCalendarMatrix(
      makeRoutines([makeStep()]),
      [makeProduct({ isHidden: true })],
      JULY_2026,
    );

    expect(matrix.rows).toEqual([]);
  });

  it('produces one row per product, morning-first, in first-appearance order', () => {
    const cleanser = makeProduct({ id: 'p1', name: 'Cleanser' });
    const serum = makeProduct({ id: 'p2', name: 'Serum' });

    const matrix = buildCalendarMatrix(
      makeRoutines(
        [makeStep({ id: 'am1', productId: 'p1' })],
        [makeStep({ id: 'pm1', productId: 'p2' }), makeStep({ id: 'pm2', productId: 'p1' })],
      ),
      [cleanser, serum],
      JULY_2026,
    );

    expect(matrix.rows.map((r) => r.product.id)).toEqual(['p1', 'p2']);
    // p1 appears in both periods, so its row carries AM and PM.
    expect(matrix.rows[0].cells[0]).toEqual({ am: true, pm: true });
  });

  it('keeps a day filled when two steps in the same period overlap', () => {
    const matrix = buildCalendarMatrix(
      // Every day, then Mondays only — the second must not clear the first.
      makeRoutines([
        makeStep({ id: 'a', scheduledDays: [] }),
        makeStep({ id: 'b', scheduledDays: [1] }),
      ]),
      [makeProduct()],
      JULY_2026,
    );

    expect(matrix.rows[0].cells.every((c) => c.am)).toBe(true);
  });

  it('sizes the row to a leap-year February', () => {
    const matrix = buildCalendarMatrix(
      makeRoutines([makeStep()]),
      [makeProduct()],
      new Date(2028, 1, 1),
    );

    expect(matrix.daysInMonth).toBe(29);
    expect(matrix.rows[0].cells).toHaveLength(29);
  });

  it('returns no rows when the routine is empty', () => {
    const matrix = buildCalendarMatrix(makeRoutines([]), [makeProduct()], JULY_2026);

    expect(matrix.rows).toEqual([]);
    expect(matrix.daysInMonth).toBe(31);
  });

  it('reports the year and month it was built for', () => {
    const matrix = buildCalendarMatrix(makeRoutines([]), [], JULY_2026);

    expect(matrix.year).toBe(2026);
    expect(matrix.month).toBe(6);
  });
});

// ── Acceptance: the grid must agree with the Today checklist ─────────────────

describe('parity with the list view', () => {
  /**
   * Reproduces the RoutinesScreen filter for one day, via the SAME shared
   * helper the screen uses. If the calendar and the checklist ever diverge,
   * this fails — the guarantee the AC asks to spot-verify.
   */
  function productsVisibleOnDay(
    routines: Routine[],
    products: Product[],
    period: 'morning' | 'evening',
    dow: number,
  ): string[] {
    const routine = routines.find((r) => r.timeOfDay === period);
    return (routine?.steps ?? [])
      .filter((s) => !s.hidden)
      .filter((s) => isScheduledOnDay(s.scheduledDays, dow))
      .map((s) => s.productId)
      .filter((id): id is string => id !== null)
      .filter((id) => {
        const product = products.find((p) => p.id === id);
        return !!product && !product.isHidden;
      });
  }

  const products = [
    makeProduct({ id: 'p1', name: 'Cleanser' }),
    makeProduct({ id: 'p2', name: 'Retinol' }),
    makeProduct({ id: 'p3', name: 'Hidden One', isHidden: true }),
  ];

  const routines = makeRoutines(
    [
      makeStep({ id: 'am1', productId: 'p1', scheduledDays: [] }), // every day
      makeStep({ id: 'am2', productId: 'p3', scheduledDays: [] }), // product hidden
    ],
    [
      makeStep({ id: 'pm1', productId: 'p2', scheduledDays: [1, 4] }), // Mon + Thu
      makeStep({ id: 'pm2', productId: 'p1', scheduledDays: [0] }), // Sun
    ],
  );

  // Three spot-check dates in July 2026: a Monday, a Thursday, and a Sunday.
  it.each([
    ['Monday', 6],
    ['Thursday', 9],
    ['Sunday', 12],
  ])('matches the checklist for %s the %ith', (_label, dayOfMonth) => {
    const matrix = buildCalendarMatrix(routines, products, JULY_2026);
    const dow = new Date(2026, 6, dayOfMonth).getDay();
    const cellIndex = dayOfMonth - 1;

    const amFromGrid = matrix.rows
      .filter((r) => r.cells[cellIndex].am)
      .map((r) => r.product.id)
      .sort();
    const pmFromGrid = matrix.rows
      .filter((r) => r.cells[cellIndex].pm)
      .map((r) => r.product.id)
      .sort();

    expect(amFromGrid).toEqual([...new Set(productsVisibleOnDay(routines, products, 'morning', dow))].sort());
    expect(pmFromGrid).toEqual([...new Set(productsVisibleOnDay(routines, products, 'evening', dow))].sort());
  });
});
