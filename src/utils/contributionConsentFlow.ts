import type { ContributionConsentStatus, Product } from '@/types';

/**
 * Pure decision logic for the product-contribution consent flow
 * (docs/specs/contribution-consent-flow/). No React/react-native imports —
 * business logic only, per the layer rule in .claude/rules/architecture-review.md.
 * Screens call these functions with current store state and apply the
 * returned instructions to settingsStore/productsStore themselves.
 */

export interface ContributionCadenceState {
  status: ContributionConsentStatus;
  declinedSaveCountSinceLastReminder: number;
  reminderCountShown: number;
}

export interface ManualSaveDecision {
  /** Value to write on the product record being saved right now. */
  contributionOptIn: boolean;
  /** Which modal variant to show, if any — deferred until the modal resolves. */
  showModal: 'first-time' | 'reminder' | null;
  /** Global status to transition to as a direct result of this save. Null = no change. */
  nextStatus: ContributionConsentStatus | null;
  /** Store action instructions — applied in this order by the caller. */
  incrementDeclinedCount: boolean;
  resetDeclinedCount: boolean;
  incrementReminderCount: boolean;
}

/**
 * Reminder cadence: 1st at 5 declined-saves, 2nd at 15 more, 3rd (and every
 * one after) at 30 more. reminderCountShown is 0 before any reminder has
 * been shown, 1 after the 1st, 2 after the 2nd, 3+ for the 3rd/every-30 tier.
 */
export function getReminderThreshold(reminderCountShown: number): number {
  if (reminderCountShown === 0) return 5;
  if (reminderCountShown === 1) return 15;
  return 30;
}

/**
 * Decides what should happen for a single manual product save, given the
 * current cadence state and the inline toggle's value (ignored while a
 * modal is about to be shown instead). Mirrors
 * docs/specs/contribution-consent-flow/01-copy-and-consent-states.md §2 exactly.
 */
export function decideManualSave(
  state: ContributionCadenceState,
  formToggleValue: boolean,
): ManualSaveDecision {
  const noCounterChange = {
    incrementDeclinedCount: false,
    resetDeclinedCount: false,
    incrementReminderCount: false,
  };

  if (state.status === 'disabled') {
    return { contributionOptIn: false, showModal: null, nextStatus: null, ...noCounterChange };
  }

  if (state.status === 'unset') {
    // Save happens instantly (local-first), but the contribution decision —
    // and whether the product ever reaches the server — waits on the modal.
    return { contributionOptIn: false, showModal: 'first-time', nextStatus: null, ...noCounterChange };
  }

  if (state.status === 'accepted') {
    return { contributionOptIn: formToggleValue, showModal: null, nextStatus: null, ...noCounterChange };
  }

  // status === 'declined'
  if (formToggleValue) {
    return {
      contributionOptIn: true,
      showModal: null,
      nextStatus: 'accepted',
      ...noCounterChange,
    };
  }

  const nextCount = state.declinedSaveCountSinceLastReminder + 1;
  const threshold = getReminderThreshold(state.reminderCountShown);
  const crossed = nextCount >= threshold;

  return {
    contributionOptIn: false,
    showModal: crossed ? 'reminder' : null,
    nextStatus: null,
    incrementDeclinedCount: true,
    resetDeclinedCount: crossed,
    incrementReminderCount: crossed,
  };
}

/**
 * Running count of products actually shared — counts `contributionOptIn`
 * at time of save, independent of the user's *current* global status (so
 * later switching to `disabled` never shrinks the counter).
 */
export function contributedProductsCount(products: Product[]): number {
  return products.filter((p) => p.contributionOptIn === true).length;
}
