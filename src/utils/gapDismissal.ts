import type { Period } from '@/constants/rulesets/rulesetTypes';
import type { PlaceholderSlot } from '@/utils/routineEngine/planTypes';

/**
 * "Not for me" on a gap card (intermediate-routine, spec Story 6). Only the two
 * OPTIONAL steps the fuller routine adds — toner and eye cream — can be waved
 * off; the cleanser, moisturiser and SPF cards, the pre-cleanse follow-up and
 * every mandate card have no dismissal. A dismissal is presentation only: it
 * hides one (period × type) card until the next save of that period, and never
 * touches the plan, the draft or the left-out list. The rules are pure so they
 * are testable without the screen or the store.
 */

/** Every key that can ever be stored: period × {toner, eye cream}. */
export const GAP_DISMISS_KEYS = ['am:toner', 'pm:toner', 'am:eye_cream', 'pm:eye_cream'] as const;

/**
 * The key a placeholder is dismissed under, or null when it is not dismissible.
 * Decided by the REASON CODE, not by the product type: after the engine's
 * (period, type) dedupe a mandate or follow-up card can occupy a toner/eye-cream
 * slot, and that card must stay.
 */
export function gapDismissKey(placeholder: PlaceholderSlot): string | null {
  const type = placeholder.productTypes[0];
  if (placeholder.reasonCode === 'toner_recommended' && type === 'toner') {
    return `${placeholder.period}:toner`;
  }
  if (placeholder.reasonCode === 'eye_cream_recommended' && type === 'eye_cream') {
    return `${placeholder.period}:eye_cream`;
  }
  return null;
}

/** The placeholders to draw: dismissible ones whose key is stored are hidden. */
export function visibleGaps(placeholders: PlaceholderSlot[], dismissedKeys: readonly string[]): PlaceholderSlot[] {
  return placeholders.filter((placeholder) => {
    const key = gapDismissKey(placeholder);
    return key === null || !dismissedKeys.includes(key);
  });
}

/** The keys that REMAIN after a save of `periods`: a save brings those periods' cards back. */
export function keysAfterSave(keys: readonly string[], periods: readonly Period[]): string[] {
  return keys.filter((key) => !periods.some((period) => key.startsWith(`${period}:`)));
}

/**
 * Persisted data is untrusted: keep only the known keys, once each, so the
 * "at most four keys" invariant survives a corrupt or hand-edited settings file.
 */
export function sanitizeDismissedKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return GAP_DISMISS_KEYS.filter((key) => value.includes(key));
}
