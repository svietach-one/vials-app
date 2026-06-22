import { getProductRoutineStatus } from './routineStatus';
import type { Routine } from '@/types';

const PRODUCT_ID = 'prod-1';
const OTHER_ID = 'prod-2';
const MONDAY = 1;
const SUNDAY = 0;

function makeRoutine(
  timeOfDay: 'morning' | 'evening',
  steps: { productId: string | null; hidden?: boolean; scheduledDays?: number[] }[],
): Routine {
  return {
    id: `routine-${timeOfDay}`,
    name: timeOfDay === 'morning' ? 'Morning' : 'Evening',
    timeOfDay,
    steps: steps.map((s, i) => ({
      id: `step-${i}`,
      productId: s.productId,
      productType: 'serum',
      hidden: s.hidden ?? false,
      scheduledDays: s.scheduledDays ?? [],
    })),
  };
}

describe('getProductRoutineStatus', () => {
  it('should return none when routines are empty', () => {
    expect(getProductRoutineStatus(PRODUCT_ID, [], MONDAY)).toBe('none');
  });

  it('should return none when product is not in any routine', () => {
    const routines = [
      makeRoutine('morning', [{ productId: OTHER_ID }]),
      makeRoutine('evening', [{ productId: OTHER_ID }]),
    ];
    expect(getProductRoutineStatus(PRODUCT_ID, routines, MONDAY)).toBe('none');
  });

  it('should return morning when product is only in morning routine', () => {
    const routines = [
      makeRoutine('morning', [{ productId: PRODUCT_ID }]),
      makeRoutine('evening', [{ productId: OTHER_ID }]),
    ];
    expect(getProductRoutineStatus(PRODUCT_ID, routines, MONDAY)).toBe('morning');
  });

  it('should return evening when product is only in evening routine', () => {
    const routines = [
      makeRoutine('morning', [{ productId: OTHER_ID }]),
      makeRoutine('evening', [{ productId: PRODUCT_ID }]),
    ];
    expect(getProductRoutineStatus(PRODUCT_ID, routines, MONDAY)).toBe('evening');
  });

  it('should return both when product is in morning and evening routines', () => {
    const routines = [
      makeRoutine('morning', [{ productId: PRODUCT_ID }]),
      makeRoutine('evening', [{ productId: PRODUCT_ID }]),
    ];
    expect(getProductRoutineStatus(PRODUCT_ID, routines, MONDAY)).toBe('both');
  });

  it('should return none when the only matching step is hidden', () => {
    const routines = [
      makeRoutine('morning', [{ productId: PRODUCT_ID, hidden: true }]),
    ];
    expect(getProductRoutineStatus(PRODUCT_ID, routines, MONDAY)).toBe('none');
  });

  it('should return morning when product has both hidden and visible steps in morning', () => {
    const routines = [
      makeRoutine('morning', [
        { productId: PRODUCT_ID, hidden: true },
        { productId: PRODUCT_ID, hidden: false },
      ]),
    ];
    expect(getProductRoutineStatus(PRODUCT_ID, routines, MONDAY)).toBe('morning');
  });

  it('should treat null productId steps as absent', () => {
    const routines = [
      makeRoutine('morning', [{ productId: null }]),
      makeRoutine('evening', [{ productId: null }]),
    ];
    expect(getProductRoutineStatus(PRODUCT_ID, routines, MONDAY)).toBe('none');
  });

  // ── Day-aware scheduling ───────────────────────────────────────────────────

  it('should return none when step is not scheduled for the given day', () => {
    const routines = [
      makeRoutine('morning', [{ productId: PRODUCT_ID, scheduledDays: [MONDAY] }]),
    ];
    expect(getProductRoutineStatus(PRODUCT_ID, routines, SUNDAY)).toBe('none');
  });

  it('should return morning when step is scheduled for the given day', () => {
    const routines = [
      makeRoutine('morning', [{ productId: PRODUCT_ID, scheduledDays: [MONDAY] }]),
    ];
    expect(getProductRoutineStatus(PRODUCT_ID, routines, MONDAY)).toBe('morning');
  });

  it('should return morning when scheduledDays is empty (runs every day)', () => {
    const routines = [
      makeRoutine('morning', [{ productId: PRODUCT_ID, scheduledDays: [] }]),
    ];
    expect(getProductRoutineStatus(PRODUCT_ID, routines, SUNDAY)).toBe('morning');
  });

  it('should return only the routine that is scheduled when both differ by day', () => {
    const routines = [
      makeRoutine('morning', [{ productId: PRODUCT_ID, scheduledDays: [MONDAY] }]),
      makeRoutine('evening', [{ productId: PRODUCT_ID, scheduledDays: [SUNDAY] }]),
    ];
    expect(getProductRoutineStatus(PRODUCT_ID, routines, MONDAY)).toBe('morning');
    expect(getProductRoutineStatus(PRODUCT_ID, routines, SUNDAY)).toBe('evening');
  });
});
