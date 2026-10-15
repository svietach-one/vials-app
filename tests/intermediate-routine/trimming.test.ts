/**
 * Story 5 (trimming) and G6: removal is deliberate, validation never re-adds a
 * step, and a Draft Preview save restores a removed/hidden step iff the fresh
 * plan schedules it. Real stores + real engine; only storage is mocked.
 * (The edit-mode gating of the action sheet is in step-action-sheet.test.tsx and
 * routines-screen.test.tsx.)
 */
const mockDisk = new Map<string, unknown>();
const mockSaveJson = jest.fn(async (key: string, value: unknown) => { mockDisk.set(key, value); });
jest.mock('@/services/storage', () => {
  const actual = jest.requireActual('@/services/storage');
  return {
    ...actual,
    loadJson: jest.fn(async (key: string, fallback: unknown) => (mockDisk.has(key) ? mockDisk.get(key) : fallback)),
    saveJson: (key: string, value: unknown) => mockSaveJson(key, value),
    loadSchemaVersion: jest.fn(async () => 99),
    persistSchemaVersionIfBehind: jest.fn(),
  };
});

import type { Product, Routine, RoutineStep } from '@/types';
import { applyRoutinePlan, validateCurrentRoutines } from '@/domain/routinePlanActions';
import { useProductsStore } from '@/store/productsStore';
import { useRoutinesStore } from '@/store/routinesStore';
import { generatePlan } from '@/utils/routineEngine/generate';
import { buildLeftOutItems } from '@/utils/routineLeftOut';
import {
  gapKeys,
  makeEngineInput,

  makeRoutineStep,
  makeS3,
  NOW,
  resetFixtureCounters,
  routinesFromPlan,
  S3,
  shelfProduct,
} from './fixtures';

function seed(products: Product[], routines?: Routine[]): Routine[] {
  useProductsStore.setState({ products });
  const saved = routines ?? routinesFromPlan(generatePlan(makeEngineInput(products)));
  useRoutinesStore.setState({ routines: saved });
  return saved;
}

const stepOf = (routineId: string, productId: string): RoutineStep | undefined =>
  useRoutinesStore.getState().routines.find((r) => r.id === routineId)?.steps.find((s) => s.productId === productId);

beforeEach(() => {
  resetFixtureCounters();
  mockDisk.clear();
  mockSaveJson.mockClear();
});

describe('nothing but a save or a manual action writes steps', () => {
  it('leaves the stored routines byte-identical when the screen only revalidates after a removal', () => {
    seed(makeS3());
    useRoutinesStore.getState().removeProductStep('routine-morning', S3.cream);
    const before = JSON.stringify(useRoutinesStore.getState().routines);
    mockSaveJson.mockClear();

    validateCurrentRoutines(NOW);
    validateCurrentRoutines(NOW);

    expect(JSON.stringify(useRoutinesStore.getState().routines)).toBe(before);
    expect(mockSaveJson).not.toHaveBeenCalled();
  });

  it('leaves the stored routines byte-identical after a hide, an added shelf product and a shelf edit', () => {
    seed(makeS3());
    const step = stepOf('routine-morning', S3.cream)!;
    useRoutinesStore.getState().setStepHidden('routine-morning', step.id, true);
    const before = JSON.stringify(useRoutinesStore.getState().routines);

    useProductsStore.setState({ products: [...makeS3(), shelfProduct('t', 'Toner', 'toner')] });
    validateCurrentRoutines(NOW);
    useProductsStore.setState({ products: [...makeS3(), shelfProduct('t', 'Renamed Toner', 'toner')] });
    validateCurrentRoutines(NOW);

    expect(JSON.stringify(useRoutinesStore.getState().routines)).toBe(before);
  });
});

describe('a Draft Preview save after a removal or hide', () => {
  it('re-creates an all-days-removed step with the plan\'s weekdays when the plan schedules the product', () => {
    seed(makeS3());
    useRoutinesStore.getState().removeProductStep('routine-morning', S3.cream);
    expect(stepOf('routine-morning', S3.cream)).toBeUndefined();

    applyRoutinePlan(validateCurrentRoutines(NOW).proposedPlan, 'both', NOW);

    expect(stepOf('routine-morning', S3.cream)).toMatchObject({ hidden: false, scheduledDays: [] });
  });

  it('restores the weekdays of a step removed for one weekday only', () => {
    seed(makeS3());
    const step = stepOf('routine-morning', S3.cream)!;
    useRoutinesStore.getState().removeStepFromDay('routine-morning', step.id, 3);
    expect(stepOf('routine-morning', S3.cream)?.scheduledDays).toEqual([0, 1, 2, 4, 5, 6]);

    applyRoutinePlan(validateCurrentRoutines(NOW).proposedPlan, 'both', NOW);

    expect(stepOf('routine-morning', S3.cream)?.scheduledDays).toEqual([]);
  });

  it('un-hides a hidden step the plan schedules, keeping its id and pin', () => {
    seed(makeS3());
    const step = stepOf('routine-morning', S3.cream)!;
    useRoutinesStore.setState({
      routines: useRoutinesStore.getState().routines.map((r) => ({
        ...r,
        steps: r.steps.map((s) => (s.id === step.id ? { ...s, hidden: true, userPinned: true } : s)),
      })),
    });

    applyRoutinePlan(validateCurrentRoutines(NOW).proposedPlan, 'both', NOW);

    expect(stepOf('routine-morning', S3.cream)).toMatchObject({ id: step.id, hidden: false, userPinned: true });
  });

  it('keeps a hidden step hidden and a removed step gone when the plan does not schedule that product', () => {
    const products = [...makeS3(), shelfProduct('oil', 'Face Oil', 'oil'), shelfProduct('ess', 'Essence', 'essence')]; // reserve products
    const plan = generatePlan(makeEngineInput(products));
    const saved = routinesFromPlan(plan);
    saved[0].steps.push(makeRoutineStep(products[3], { hidden: true, id: 'hidden-oil' }));
    seed(products, saved);

    applyRoutinePlan(validateCurrentRoutines(NOW).proposedPlan, 'both', NOW);

    expect(stepOf('routine-morning', 'oil')).toMatchObject({ id: 'hidden-oil', hidden: true });
    expect(stepOf('routine-morning', 'ess')).toBeUndefined();
  });

  it('restores only the period it was saved for (Morning only leaves an evening removal alone)', () => {
    seed(makeS3());
    useRoutinesStore.getState().removeProductStep('routine-morning', S3.cream);
    useRoutinesStore.getState().removeProductStep('routine-evening', S3.cream);

    applyRoutinePlan(validateCurrentRoutines(NOW).proposedPlan, 'am', NOW);

    expect(stepOf('routine-morning', S3.cream)).toBeDefined();
    expect(stepOf('routine-evening', S3.cream)).toBeUndefined();
  });
});

describe('gap cards never depend on saved steps (Story 5, G6)', () => {
  it('produces the same placeholders before and after removing, hiding or re-adding other steps', () => {
    seed(makeS3());
    const placeholders = () => JSON.stringify(validateCurrentRoutines(NOW).proposedPlan.placeholders);
    const baseline = placeholders();

    useRoutinesStore.getState().removeProductStep('routine-morning', S3.cream);
    expect(placeholders()).toBe(baseline);
    useRoutinesStore.getState().removeProductStep('routine-evening', S3.cleanser);
    expect(placeholders()).toBe(baseline);
    useRoutinesStore.getState().upsertProductStep('routine-morning', S3.cream, 'moisturizer', []);
    expect(placeholders()).toBe(baseline);
    expect(gapKeys(validateCurrentRoutines(NOW).proposedPlan)).toEqual(
      expect.arrayContaining(['am:toner', 'pm:toner', 'am:eye_cream', 'pm:eye_cream']),
    );
  });

  it('raises no toner gap for an owned toner whose step was removed, and lists the toner as ready', () => {
    const products = [...makeS3(), shelfProduct('t', 'Toner', 'toner')];
    seed(products);
    useRoutinesStore.getState().removeProductStep('routine-morning', 't');
    useRoutinesStore.getState().removeProductStep('routine-evening', 't');

    const { proposedPlan } = validateCurrentRoutines(NOW);

    expect(gapKeys(proposedPlan)).not.toContain('am:toner');
    expect(gapKeys(proposedPlan)).not.toContain('pm:toner');
    const row = buildLeftOutItems(proposedPlan, products, useRoutinesStore.getState().routines).find((i) => i.productId === 't');
    expect(row?.kind).toBe('ready');
  });

  it('raises the toner gaps once the removed toner is also deleted from the shelf', () => {
    const products = [...makeS3(), shelfProduct('t', 'Toner', 'toner')];
    seed(products);
    useRoutinesStore.getState().removeProductStep('routine-morning', 't');
    useProductsStore.setState({ products: makeS3() });

    expect(gapKeys(validateCurrentRoutines(NOW).proposedPlan)).toEqual(expect.arrayContaining(['am:toner', 'pm:toner']));
  });
});

