import type { ContributionConsent } from '@/types';

/**
 * Pure gating + write helpers for the GDPR Art. 7(4) photo-sharing consent
 * (docs/specs/contribution-consent.md). No React/react-native imports — this
 * is business logic, consumed by screens/stores per the layer rule in
 * .claude/rules/architecture-review.md.
 */

/**
 * Whether a product photo may be included in a community contribution.
 * Only an explicit `granted: true` unlocks the photo blob — an absent
 * consent object (not yet migrated/hydrated) or `granted: false` both gate it.
 */
export function canShareContributionPhoto(consent?: ContributionConsent): boolean {
  return consent?.granted === true;
}

/**
 * Builds a freshly timestamped consent value. The single write path used by
 * both the onboarding screen and the Settings toggle, so timestamp semantics
 * never drift between the two call sites.
 */
export function setContributionConsent(
  granted: boolean,
  now: Date = new Date(),
): ContributionConsent {
  return { granted, timestamp: now.toISOString() };
}
