/**
 * Story 6 ("Not for me"): pure helpers (FE-11), persistence through the real
 * settings store, and clearing through the real save/reset paths.
 * Pinned by the design: gapDismissKey(p), visibleGaps(placeholders, keys),
 * keysAfterSave(keys, periods), AppSettings.dismissedGapCards,
 * settingsStore.dismissGapCard(key) / clearDismissedGapCards(periods).
 * ASSUMED: `periods` is `('am' | 'pm')[]` (the engine's Period type) and
 * keysAfterSave returns the keys that REMAIN after a save of those periods.
 */
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

import type { PlaceholderSlot } from '@/utils/routineEngine/planTypes';
import { applyRoutinePlan, resetAllRoutines, validateCurrentRoutines } from '@/domain/routinePlanActions';
import { STORAGE_KEYS } from '@/services/storage';
import { useProductsStore } from '@/store/productsStore';
import { useRoutinesStore } from '@/store/routinesStore';
import { useSettingsStore } from '@/store/settingsStore';
import { gapDismissKey, keysAfterSave, visibleGaps } from '@/utils/gapDismissal';
import { generatePlan } from '@/utils/routineEngine/generate';
import { buildLeftOutItems } from '@/utils/routineLeftOut';
import { gapKeys, makeEngineInput, makeS3, NOW, resetFixtureCounters, routinesFromPlan, shelfProduct } from './fixtures';

const ALL_KEYS = ['am:toner', 'pm:toner', 'am:eye_cream', 'pm:eye_cream'];
const FRESH = useSettingsStore.getState();

function slot(period: 'am' | 'pm', type: PlaceholderSlot['productTypes'][number], reasonCode: PlaceholderSlot['reasonCode']): PlaceholderSlot {
  return { period, productTypes: [type], reasonCode, nonSkippable: false, severity: 'caution' };
}

beforeEach(() => {
  resetFixtureCounters();
  mockDisk.clear();
  useSettingsStore.setState({ ...FRESH, hydrated: false }, true);
  useProductsStore.setState({ products: makeS3() });
  useRoutinesStore.setState({ routines: routinesFromPlan(generatePlan(makeEngineInput(makeS3()))) });
});

describe('gapDismissKey: only the generic toner and eye-cream cards can be dismissed', () => {
  it.each([
    ['am', 'toner', 'toner_recommended', 'am:toner'],
    ['pm', 'toner', 'toner_recommended', 'pm:toner'],
    ['am', 'eye_cream', 'eye_cream_recommended', 'am:eye_cream'],
    ['pm', 'eye_cream', 'eye_cream_recommended', 'pm:eye_cream'],
  ] as const)('keys the %s %s card as %s', (period, type, reasonCode, key) => {
    expect(gapDismissKey(slot(period, type, reasonCode))).toBe(key);
  });

  it.each([
    ['cleanser', 'cleanser_recommended'],
    ['moisturizer', 'moisturizer_recommended'],
    ['spf', 'spf_recommended'],
    ['spf', 'spf_required_goal'],
    ['cleanser', 'pre_cleanse_requires_followup'],
  ] as const)('refuses the %s card carrying %s', (type, reasonCode) => {
    expect(gapDismissKey(slot('am', type, reasonCode))).toBeNull();
  });

  it('refuses a mandate card that won the dedupe for a toner slot (decided by reasonCode, not by product type)', () => {
    expect(gapDismissKey(slot('am', 'toner', 'spf_required_photosensitizing'))).toBeNull();
    expect(gapDismissKey(slot('pm', 'eye_cream', 'pre_cleanse_requires_followup'))).toBeNull();
  });
});

describe('visibleGaps and keysAfterSave', () => {
  it('hides only the dismissed card and leaves the input untouched', () => {
    const plan = generatePlan(makeEngineInput(makeS3()));
    const copy = JSON.stringify(plan.placeholders);

    const shown = visibleGaps(plan.placeholders, ['am:toner']);

    expect(shown.map((p) => `${p.period}:${p.productTypes[0]}`)).not.toContain('am:toner');
    expect(shown.map((p) => `${p.period}:${p.productTypes[0]}`)).toEqual(expect.arrayContaining(['pm:toner', 'am:eye_cream', 'pm:eye_cream']));
    expect(JSON.stringify(plan.placeholders)).toBe(copy);
  });

  it('never hides a non-dismissible card even if its key is in the list', () => {
    const cards = [slot('am', 'toner', 'spf_required_goal'), slot('am', 'cleanser', 'cleanser_recommended')];

    expect(visibleGaps(cards, ['am:toner', 'am:cleanser'])).toHaveLength(2);
  });

  it('keeps the keys of periods that were not saved', () => {
    expect(keysAfterSave(ALL_KEYS, ['am'])).toEqual(['pm:toner', 'pm:eye_cream']);
    expect(keysAfterSave(ALL_KEYS, ['pm'])).toEqual(['am:toner', 'am:eye_cream']);
    expect(keysAfterSave(ALL_KEYS, ['am', 'pm'])).toEqual([]);
  });
});

describe('persistence', () => {
  it('starts with no dismissals on a fresh install', () => {
    expect(useSettingsStore.getState().dismissedGapCards).toEqual([]);
  });

  it('survives an app restart (fresh store, hydrate from storage)', async () => {
    useSettingsStore.getState().dismissGapCard('am:toner');
    useSettingsStore.setState({ ...FRESH, hydrated: false }, true); // process restart
    expect(useSettingsStore.getState().dismissedGapCards).toEqual([]);

    await useSettingsStore.getState().hydrate();

    expect(useSettingsStore.getState().dismissedGapCards).toEqual(['am:toner']);
  });

  it('hydrates to an empty list when stored settings predate the field', async () => {
    mockDisk.set(STORAGE_KEYS.settings, { gamificationEnabled: false });

    await useSettingsStore.getState().hydrate();

    expect(useSettingsStore.getState().dismissedGapCards).toEqual([]);
  });

  it('stores each key at most once, so at most four keys can exist', () => {
    const { dismissGapCard } = useSettingsStore.getState();
    for (const key of [...ALL_KEYS, ...ALL_KEYS, 'am:toner']) dismissGapCard(key);

    expect([...useSettingsStore.getState().dismissedGapCards].sort()).toEqual([...ALL_KEYS].sort());
  });
});

describe('what clears a dismissal', () => {
  beforeEach(() => {
    for (const key of ALL_KEYS) useSettingsStore.getState().dismissGapCard(key);
  });
  const keys = () => [...useSettingsStore.getState().dismissedGapCards].sort();

  it('clears every key when a draft is saved for Morning & Evening', () => {
    applyRoutinePlan(validateCurrentRoutines(NOW).proposedPlan, 'both', NOW);

    expect(keys()).toEqual([]);
  });

  it('clears only the morning keys on a Morning-only save', () => {
    applyRoutinePlan(validateCurrentRoutines(NOW).proposedPlan, 'am', NOW);

    expect(keys()).toEqual(['pm:eye_cream', 'pm:toner']);
  });

  it('clears only the evening keys on an Evening-only save', () => {
    applyRoutinePlan(validateCurrentRoutines(NOW).proposedPlan, 'pm', NOW);

    expect(keys()).toEqual(['am:eye_cream', 'am:toner']);
  });

  it('clears every key on "Reset all"', () => {
    resetAllRoutines();

    expect(keys()).toEqual([]);
  });

  it('does NOT clear on manual add, remove, hide, reorder or reschedule, shelf edits, or revalidation', () => {
    const routines = useRoutinesStore.getState();
    const cream = routines.routines[0].steps.find((s) => s.productType === 'moisturizer')!;

    routines.removeProductStep('routine-morning', cream.productId!);
    routines.upsertProductStep('routine-morning', cream.productId!, 'moisturizer', [1, 2]);
    routines.setStepHidden('routine-morning', cream.id, true);
    routines.setStepHidden('routine-morning', cream.id, false);
    routines.reorderSteps('routine-morning', [...useRoutinesStore.getState().routines[0].steps].reverse());
    routines.removeStepFromDay('routine-evening', useRoutinesStore.getState().routines[1].steps[0].id, 2);
    useProductsStore.setState({ products: [...makeS3(), shelfProduct('x', 'New Cream', 'cream')] });
    validateCurrentRoutines(NOW);

    expect(keys()).toEqual([...ALL_KEYS].sort());
  });

  it('does NOT clear on restart', async () => {
    useSettingsStore.setState({ ...FRESH, hydrated: false }, true);
    await useSettingsStore.getState().hydrate();

    expect(keys()).toEqual([...ALL_KEYS].sort());
  });
});

describe('a dismissal changes only what is drawn', () => {
  it('leaves the plan, the left-out list and the saved steps exactly as without it', () => {
    const products = makeS3();
    const snapshot = () => ({
      plan: JSON.stringify(validateCurrentRoutines(NOW).proposedPlan),
      leftOut: JSON.stringify(buildLeftOutItems(validateCurrentRoutines(NOW).proposedPlan, products, useRoutinesStore.getState().routines)),
      saved: JSON.stringify(useRoutinesStore.getState().routines),
    });
    const before = snapshot();

    for (const key of ALL_KEYS) useSettingsStore.getState().dismissGapCard(key);

    expect(snapshot()).toEqual(before);
  });

  it('hides the card of a toner the shelf gained regardless of the dismissal, while the key remains stored', () => {
    useSettingsStore.getState().dismissGapCard('am:toner');
    useProductsStore.setState({ products: [...makeS3(), shelfProduct('t', 'Toner', 'toner')] });

    const { placeholders } = validateCurrentRoutines(NOW).proposedPlan;

    expect(gapKeys({ placeholders } as never)).not.toContain('am:toner');
    expect(useSettingsStore.getState().dismissedGapCards).toEqual(['am:toner']);
  });
});
