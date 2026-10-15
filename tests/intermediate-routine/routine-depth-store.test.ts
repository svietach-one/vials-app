/**
 * Persistence and wiring of the routine style (tech design FE-1, FE-5).
 * Spec Story 1: default Balanced on a fresh install, persisted choice survives
 * a restart, no migration (hydrate merges defaults), and the engine input
 * built from the stores carries the style. Storage is mocked at the module
 * boundary (an in-memory map standing in for AsyncStorage).
 * Written against a DRAFT spec.
 */
import { DEFAULT_ROUTINE_DEPTH } from '@/constants/routineDepth';

const mockDisk = new Map<string, unknown>();
jest.mock('@/services/storage', () => {
  const actual = jest.requireActual('@/services/storage');
  return {
    ...actual,
    loadJson: jest.fn(async (key: string, fallback: unknown) => (mockDisk.has(key) ? mockDisk.get(key) : fallback)),
    saveJson: jest.fn(async (key: string, value: unknown) => { mockDisk.set(key, value); }),
    loadSchemaVersion: jest.fn(async () => 99),
    persistSchemaVersionIfBehind: jest.fn(),
  };
});

import { STORAGE_KEYS } from '@/services/storage';
import { activeOverrides, buildEngineInputFromStores, currentOverrideHash, generateDraftPlan } from '@/domain/routinePlanActions';
import { useProductsStore } from '@/store/productsStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTrackingStore } from '@/store/trackingStore';
import { ids, makeR9, NOW, R9 } from './fixtures';

const FRESH = useSettingsStore.getState();

beforeEach(() => {
  mockDisk.clear();
  useSettingsStore.setState({ ...FRESH, hydrated: false }, true);
  useProductsStore.setState({ products: makeR9() });
  useTrackingStore.setState({ overrides: [], overrideHash: null } as never);
});

describe('default and persistence', () => {
  it('starts on Balanced on a fresh install', () => {
    expect(DEFAULT_ROUTINE_DEPTH).toBe('balanced');
    expect(useSettingsStore.getState().routineDepth).toBe('balanced');
  });

  it('writes the chosen style to settings storage', () => {
    useSettingsStore.getState().setRoutineDepth('essential');

    expect(useSettingsStore.getState().routineDepth).toBe('essential');
    expect((mockDisk.get(STORAGE_KEYS.settings) as { routineDepth: string }).routineDepth).toBe('essential');
  });

  it('restores Essential after an app restart (fresh store, hydrate from storage)', async () => {
    useSettingsStore.getState().setRoutineDepth('essential');
    useSettingsStore.setState({ ...FRESH, hydrated: false }, true); // process restart: defaults again
    expect(useSettingsStore.getState().routineDepth).toBe('balanced');

    await useSettingsStore.getState().hydrate();

    expect(useSettingsStore.getState().routineDepth).toBe('essential');
  });

  it('fills in Balanced when stored settings predate the field (no migration needed)', async () => {
    mockDisk.set(STORAGE_KEYS.settings, { gamificationEnabled: true, routineCycleType: 'fixed' });

    await useSettingsStore.getState().hydrate();

    expect(useSettingsStore.getState().routineDepth).toBe('balanced');
    expect(useSettingsStore.getState().gamificationEnabled).toBe(true);
  });
});

describe('engine wiring', () => {
  it('passes the persisted style into the engine input', () => {
    expect(buildEngineInputFromStores(NOW).depth).toBe('balanced');

    useSettingsStore.getState().setRoutineDepth('essential');

    expect(buildEngineInputFromStores(NOW).depth).toBe('essential');
  });

  it('generates the Balanced draft by default and the Essential draft after switching', () => {
    expect(ids(generateDraftPlan(NOW).periods.morning)).toContain(R9.toner);

    useSettingsStore.getState().setRoutineDepth('essential');

    expect(ids(generateDraftPlan(NOW).periods.morning)).not.toContain(R9.toner);
  });

  it('keeps an "Add anyway" override valid across a style switch (the style is not part of the override hash)', () => {
    useTrackingStore.getState().addOverride(R9.essence, currentOverrideHash());
    expect(activeOverrides()).toEqual([R9.essence]);

    useSettingsStore.getState().setRoutineDepth('essential');

    expect(activeOverrides()).toEqual([R9.essence]);
  });
});
