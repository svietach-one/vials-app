import {
  contributedProductsCount,
  decideManualSave,
  getReminderThreshold,
  type ContributionCadenceState,
} from '@/utils/contributionConsentFlow';
import type { Product } from '@/types';

function makeState(overrides: Partial<ContributionCadenceState> = {}): ContributionCadenceState {
  return {
    status: 'declined',
    declinedSaveCountSinceLastReminder: 0,
    reminderCountShown: 0,
    ...overrides,
  };
}

// ─── getReminderThreshold ───────────────────────────────────────────────────────

describe('getReminderThreshold', () => {
  it('returns 5 before any reminder has been shown', () => {
    expect(getReminderThreshold(0)).toBe(5);
  });

  it('returns 15 after the 1st reminder', () => {
    expect(getReminderThreshold(1)).toBe(15);
  });

  it('returns 30 after the 2nd reminder', () => {
    expect(getReminderThreshold(2)).toBe(30);
  });

  it('returns 30 for the 4th and every subsequent reminder', () => {
    expect(getReminderThreshold(3)).toBe(30);
    expect(getReminderThreshold(10)).toBe(30);
  });
});

// ─── decideManualSave ───────────────────────────────────────────────────────────

describe('decideManualSave', () => {
  it('stays silent with contributionOptIn false when status is disabled', () => {
    const state = makeState({ status: 'disabled' });
    const result = decideManualSave(state, true);
    expect(result).toEqual({
      contributionOptIn: false,
      showModal: null,
      nextStatus: null,
      incrementDeclinedCount: false,
      resetDeclinedCount: false,
      incrementReminderCount: false,
    });
  });

  it('shows the first-time modal and defers contributionOptIn when status is unset', () => {
    const state = makeState({ status: 'unset' });
    const result = decideManualSave(state, true);
    expect(result.showModal).toBe('first-time');
    expect(result.contributionOptIn).toBe(false);
    expect(result.nextStatus).toBeNull();
  });

  it('saves with the toggle value and shows no modal when status is accepted', () => {
    const state = makeState({ status: 'accepted' });
    expect(decideManualSave(state, true).contributionOptIn).toBe(true);
    expect(decideManualSave(state, false).contributionOptIn).toBe(false);
    expect(decideManualSave(state, false).showModal).toBeNull();
  });

  it('flips status to accepted when the inline toggle is on while declined', () => {
    const state = makeState({ status: 'declined', declinedSaveCountSinceLastReminder: 3 });
    const result = decideManualSave(state, true);
    expect(result.contributionOptIn).toBe(true);
    expect(result.nextStatus).toBe('accepted');
    expect(result.showModal).toBeNull();
    expect(result.incrementDeclinedCount).toBe(false);
  });

  it('increments the declined counter without showing a reminder below the 1st threshold', () => {
    const state = makeState({ status: 'declined', declinedSaveCountSinceLastReminder: 3, reminderCountShown: 0 });
    const result = decideManualSave(state, false);
    expect(result.contributionOptIn).toBe(false);
    expect(result.incrementDeclinedCount).toBe(true);
    expect(result.resetDeclinedCount).toBe(false);
    expect(result.showModal).toBeNull();
  });

  it('shows the 1st reminder on the 5th declined save and resets the counters', () => {
    const state = makeState({ status: 'declined', declinedSaveCountSinceLastReminder: 4, reminderCountShown: 0 });
    const result = decideManualSave(state, false);
    expect(result.showModal).toBe('reminder');
    expect(result.resetDeclinedCount).toBe(true);
    expect(result.incrementReminderCount).toBe(true);
  });

  it('shows the 2nd reminder on the 15th declined save since the 1st reminder', () => {
    const state = makeState({ status: 'declined', declinedSaveCountSinceLastReminder: 14, reminderCountShown: 1 });
    const result = decideManualSave(state, false);
    expect(result.showModal).toBe('reminder');
  });

  it('does not show the 2nd reminder before 15 declined saves since the 1st reminder', () => {
    const state = makeState({ status: 'declined', declinedSaveCountSinceLastReminder: 13, reminderCountShown: 1 });
    const result = decideManualSave(state, false);
    expect(result.showModal).toBeNull();
  });

  it('shows the 3rd reminder on the 30th declined save since the 2nd reminder', () => {
    const state = makeState({ status: 'declined', declinedSaveCountSinceLastReminder: 29, reminderCountShown: 2 });
    const result = decideManualSave(state, false);
    expect(result.showModal).toBe('reminder');
  });

  it('shows every 30th declined save as a reminder after the 3rd tier', () => {
    const state = makeState({ status: 'declined', declinedSaveCountSinceLastReminder: 29, reminderCountShown: 6 });
    const result = decideManualSave(state, false);
    expect(result.showModal).toBe('reminder');
  });
});

// ─── contributedProductsCount ───────────────────────────────────────────────────

describe('contributedProductsCount', () => {
  function makeProduct(contributionOptIn?: boolean): Product {
    return {
      id: 'p1',
      name: 'Test',
      brand: null,
      productType: 'serum',
      imageUrl: null,
      activeIngredients: [],
      fullIngredientText: null,
      usageTime: 'both',
      openBeautyFactsId: null,
      addedAt: '2026-01-01T00:00:00.000Z',
      notes: null,
      openedDate: null,
      paoMonths: null,
      contributionOptIn,
    };
  }

  it('counts only products explicitly opted in', () => {
    const products = [makeProduct(true), makeProduct(false), makeProduct(undefined), makeProduct(true)];
    expect(contributedProductsCount(products)).toBe(2);
  });

  it('returns 0 for an empty product list', () => {
    expect(contributedProductsCount([])).toBe(0);
  });
});
