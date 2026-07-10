import { formatRoutineLabel, deriveProductSchedule } from '@/utils/routineLabel';
import type { Routine } from '@/types';

// ─── formatRoutineLabel ───────────────────────────────────────────────────────

describe('formatRoutineLabel', () => {
  it('should return null when neither morning nor evening is selected', () => {
    expect(formatRoutineLabel({ morning: false, evening: false, scheduledDays: [] })).toBeNull();
  });

  it('should return null when neither morning nor evening is selected regardless of days', () => {
    expect(formatRoutineLabel({ morning: false, evening: false, scheduledDays: [1, 3] })).toBeNull();
  });

  it('should show "Everyday" when scheduledDays is empty', () => {
    const result = formatRoutineLabel({ morning: true, evening: false, scheduledDays: [] });
    expect(result).toBe('In Routine (Everyday • Morning)');
  });

  it('should show "Everyday" with both time slots', () => {
    const result = formatRoutineLabel({ morning: true, evening: true, scheduledDays: [] });
    expect(result).toBe('In Routine (Everyday • Morning, Evening)');
  });

  it('should show "Everyday" for evening only', () => {
    const result = formatRoutineLabel({ morning: false, evening: true, scheduledDays: [] });
    expect(result).toBe('In Routine (Everyday • Evening)');
  });

  it('should list specific days in Mo-Tu-We-Th-Fr-Sa-Su display order', () => {
    // Input days in arbitrary order: Sun(0), Fri(5), Mon(1)
    const result = formatRoutineLabel({ morning: true, evening: false, scheduledDays: [0, 5, 1] });
    expect(result).toBe('In Routine (Mon, Fri, Sun • Morning)');
  });

  it('should show Mon, Wed, Fri correctly', () => {
    const result = formatRoutineLabel({ morning: true, evening: true, scheduledDays: [1, 3, 5] });
    expect(result).toBe('In Routine (Mon, Wed, Fri • Morning, Evening)');
  });

  it('should show weekend days in Sa-Su display order', () => {
    const result = formatRoutineLabel({ morning: false, evening: true, scheduledDays: [0, 6] });
    expect(result).toBe('In Routine (Sat, Sun • Evening)');
  });

  it('should handle a single day selection', () => {
    const result = formatRoutineLabel({ morning: true, evening: false, scheduledDays: [3] });
    expect(result).toBe('In Routine (Wed • Morning)');
  });
});

// ─── deriveProductSchedule ────────────────────────────────────────────────────

function makeRoutines(
  morningSteps: Array<{ productId: string; scheduledDays: number[] }>,
  eveningSteps: Array<{ productId: string; scheduledDays: number[] }>,
): Routine[] {
  const makeStep = (productId: string, scheduledDays: number[], i: number) => ({
    id: `step-${i}`,
    productId,
    productType: 'serum' as const,
    hidden: false,
    scheduledDays,
  });

  return [
    {
      id: 'r-morning',
      name: 'Morning',
      timeOfDay: 'morning',
      steps: morningSteps.map((s, i) => makeStep(s.productId, s.scheduledDays, i)),
    },
    {
      id: 'r-evening',
      name: 'Evening',
      timeOfDay: 'evening',
      steps: eveningSteps.map((s, i) => makeStep(s.productId, s.scheduledDays, i + 100)),
    },
  ];
}

describe('deriveProductSchedule', () => {
  it('should return all-false schedule when product is not in any routine', () => {
    const routines = makeRoutines([], []);
    const result = deriveProductSchedule(routines, 'product-1');
    expect(result).toEqual({ morning: false, evening: false, scheduledDays: [] });
  });

  it('should detect product in morning routine only', () => {
    const routines = makeRoutines([{ productId: 'product-1', scheduledDays: [] }], []);
    const result = deriveProductSchedule(routines, 'product-1');
    expect(result).toEqual({ morning: true, evening: false, scheduledDays: [] });
  });

  it('should detect product in evening routine only', () => {
    const routines = makeRoutines([], [{ productId: 'product-1', scheduledDays: [1, 3, 5] }]);
    const result = deriveProductSchedule(routines, 'product-1');
    expect(result).toEqual({ morning: false, evening: true, scheduledDays: [1, 3, 5] });
  });

  it('should detect product in both routines and prefer morning scheduledDays', () => {
    const routines = makeRoutines(
      [{ productId: 'product-1', scheduledDays: [2, 4] }],
      [{ productId: 'product-1', scheduledDays: [2, 4] }],
    );
    const result = deriveProductSchedule(routines, 'product-1');
    expect(result).toEqual({ morning: true, evening: true, scheduledDays: [2, 4] });
  });

  it('should not match a different product in the routine', () => {
    const routines = makeRoutines([{ productId: 'other-product', scheduledDays: [] }], []);
    const result = deriveProductSchedule(routines, 'product-1');
    expect(result).toEqual({ morning: false, evening: false, scheduledDays: [] });
  });

  it('should return empty scheduledDays when routines list is empty', () => {
    const result = deriveProductSchedule([], 'product-1');
    expect(result).toEqual({ morning: false, evening: false, scheduledDays: [] });
  });
});

// ─── isInRoutine derivation pattern ──────────────────────────────────────────

describe('isInRoutine derivation', () => {
  it('should return true when a product has a matching step in at least one routine', () => {
    const routines = makeRoutines([{ productId: 'p1', scheduledDays: [] }], []);
    const isInRoutine = routines.some((r) => r.steps.some((s) => s.productId === 'p1'));
    expect(isInRoutine).toBe(true);
  });

  it('should return false when no step in any routine matches the product id', () => {
    const routines = makeRoutines([{ productId: 'other', scheduledDays: [] }], []);
    const isInRoutine = routines.some((r) => r.steps.some((s) => s.productId === 'p1'));
    expect(isInRoutine).toBe(false);
  });

  it('should return false when the routines array is empty', () => {
    const routines: Routine[] = [];
    const isInRoutine = routines.some((r) => r.steps.some((s) => s.productId === 'p1'));
    expect(isInRoutine).toBe(false);
  });
});
