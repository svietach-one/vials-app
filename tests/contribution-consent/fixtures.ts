/**
 * Shared fixtures for the contribution-consent feature (see
 * docs/tech-design/contribution-consent.md FE-3/FE-5/FE-6).
 *
 * `ContributionConsent` and the `contributionConsent` field on `UserProfile`
 * are added by the engineer per FE-1 — until that lands, importing them here
 * fails tsc/type-check the same way importing the not-yet-written screen and
 * banner components does. That is expected red-before-green per
 * .claude/rules/testing.md.
 */
import type { ContributionConsent, UserProfile } from '@/types';

// ─── contributionConsent ───────────────────────────────────────────────────────

export function makeContributionConsent(
  overrides: Partial<ContributionConsent> = {},
): ContributionConsent {
  return {
    granted: false,
    timestamp: null,
    ...overrides,
  };
}

// ─── UserProfile ────────────────────────────────────────────────────────────────

export function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'local-user',
    gender: null,
    age: null,
    skinType: null,
    phototype: null,
    fitzpatrick: null,
    city: null,
    concerns: [],
    primaryGoal: 'maintenance',
    secondaryGoal: null,
    goalNeedsConfirmation: false,
    phototypeNeedsConfirmation: false,
    spfSensitivity: false,
    onboardingCompleted: true,
    individualDurationMonths: {},
    contributionConsent: makeContributionConsent(),
    ...overrides,
  };
}

// ─── ContributionConsentMigrationBanner (FE-6) ─────────────────────────────────
// Dumb presenter, props per tech design: { onGoToSettings, onDismiss }. The
// component doesn't exist yet, so this interface is the contract the
// engineer implements against rather than a re-export of the real one.

export interface ContributionConsentMigrationBannerProps {
  onGoToSettings: () => void;
  onDismiss: () => void;
}

export function makeMigrationBannerProps(
  overrides: Partial<ContributionConsentMigrationBannerProps> = {},
): ContributionConsentMigrationBannerProps {
  return {
    onGoToSettings: jest.fn(),
    onDismiss: jest.fn(),
    ...overrides,
  };
}

// ─── ContributionConsentScreen navigation mock (FE-3) ──────────────────────────
// The screen is typed as NativeStackScreenProps<OnboardingStackParamList,
// 'ContributionConsent'> per the tech design, but 'ContributionConsent' isn't
// added to OnboardingStackParamList until FE-3 lands — so, like
// SkinProfileSetupScreen/FirstProductScreen callers elsewhere in this repo,
// the test casts a minimal mock `as any` rather than importing that type.

export interface ContributionConsentScreenNavigationMock {
  replace: jest.Mock;
}

export function makeConsentScreenNavigation(
  overrides: Partial<ContributionConsentScreenNavigationMock> = {},
): ContributionConsentScreenNavigationMock {
  return {
    replace: jest.fn(),
    ...overrides,
  };
}
