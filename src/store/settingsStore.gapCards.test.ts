/**
 * Dismissed gap cards in the settings store (intermediate-routine FE-11): the
 * parts tests/intermediate-routine/gap-dismissal.test.ts does not pin —
 * rejecting unknown keys and sanitising corrupt stored data on hydrate.
 */
const mockDisk = new Map<string, unknown>();
jest.mock('@/services/storage', () => {
  const actual = jest.requireActual('@/services/storage');
  return {
    ...actual,
    loadJson: jest.fn(async (key: string, fallback: unknown) => (mockDisk.has(key) ? mockDisk.get(key) : fallback)),
    saveJson: jest.fn(async (key: string, value: unknown) => {
      mockDisk.set(key, value);
    }),
    loadSchemaVersion: jest.fn(async () => 99),
    persistSchemaVersionIfBehind: jest.fn(),
  };
});

import { STORAGE_KEYS } from '@/services/storage';
import { useSettingsStore } from '@/store/settingsStore';

const FRESH = useSettingsStore.getState();

beforeEach(() => {
  mockDisk.clear();
  useSettingsStore.setState({ ...FRESH, hydrated: false }, true);
});

describe('dismissGapCard', () => {
  it('ignores a key that is not one of the four toner / eye-cream keys', () => {
    useSettingsStore.getState().dismissGapCard('am:spf');
    useSettingsStore.getState().dismissGapCard('nonsense');

    expect(useSettingsStore.getState().dismissedGapCards).toEqual([]);
    expect(mockDisk.has(STORAGE_KEYS.settings)).toBe(false);
  });

  it('does not write storage again for a key that is already stored', () => {
    useSettingsStore.getState().dismissGapCard('am:toner');
    mockDisk.clear();

    useSettingsStore.getState().dismissGapCard('am:toner');

    expect(mockDisk.has(STORAGE_KEYS.settings)).toBe(false);
  });
});

describe('clearDismissedGapCards', () => {
  it('keeps the other period and writes the remainder', () => {
    useSettingsStore.getState().dismissGapCard('am:toner');
    useSettingsStore.getState().dismissGapCard('pm:toner');

    useSettingsStore.getState().clearDismissedGapCards(['am']);

    expect(useSettingsStore.getState().dismissedGapCards).toEqual(['pm:toner']);
    expect((mockDisk.get(STORAGE_KEYS.settings) as { dismissedGapCards: string[] }).dismissedGapCards).toEqual(['pm:toner']);
  });
});

describe('hydrate', () => {
  it('drops unknown and duplicate keys from stored data', async () => {
    mockDisk.set(STORAGE_KEYS.settings, { dismissedGapCards: ['pm:eye_cream', 'am:spf', 'pm:eye_cream', 7] });

    await useSettingsStore.getState().hydrate();

    expect(useSettingsStore.getState().dismissedGapCards).toEqual(['pm:eye_cream']);
  });

  it('falls back to an empty list when the stored value is not an array', async () => {
    mockDisk.set(STORAGE_KEYS.settings, { dismissedGapCards: 'am:toner' });

    await useSettingsStore.getState().hydrate();

    expect(useSettingsStore.getState().dismissedGapCards).toEqual([]);
  });
});
