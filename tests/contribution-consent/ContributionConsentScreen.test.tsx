/**
 * ContributionConsentScreen (tech design FE-3, spec Stories 1 & 2).
 * New 3rd-of-4 onboarding step, inserted between SkinProfileSetup and
 * FirstProduct. Both actions must be equally weighted and non-blocking: the
 * core acceptance criterion is that "Agree and share" and "Not now" persist a
 * different `granted` value but always land on the identical next screen,
 * with zero disabled/gated state.
 *
 * Screen not yet written by the engineer — this file is expected to fail to
 * import/compile until FE-3 lands (see .claude/rules/testing.md: red before
 * green for the not-yet-implemented layer).
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { makeConsentScreenNavigation } from './fixtures';

const mockUpdateProfile = jest.fn();

jest.mock('@/store/profileStore', () => ({
  useProfileStore: jest.fn((selector: any) =>
    selector({ updateProfile: mockUpdateProfile }),
  ),
}));

import ContributionConsentScreen from '@/screens/onboarding/ContributionConsentScreen';

const TITLE = 'Help grow the Vials database';

const BODY_PARAGRAPHS = [
  "When you add a product we don't recognize, you can choose to share it with the Vials community — so the next person who scans it gets instant results too.",
  'Sharing includes the product photo and details you enter. No personal data, location, or device info is ever included.',
  "A person reviews every submission before it's added. You can change this anytime in Settings.",
];

function renderScreen(navigation = makeConsentScreenNavigation()) {
  render(
    <ContributionConsentScreen navigation={navigation as any} route={{} as any} />,
  );
  return navigation;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ContributionConsentScreen — verbatim copy (spec §5)', () => {
  it('renders the exact title', () => {
    renderScreen();

    expect(screen.getByText(TITLE)).toBeTruthy();
  });

  it.each(BODY_PARAGRAPHS)('renders the exact body paragraph: %s', (paragraph) => {
    renderScreen();

    expect(screen.getByText(paragraph)).toBeTruthy();
  });

  it('renders both action labels exactly', () => {
    renderScreen();

    expect(screen.getByText('Agree and share')).toBeTruthy();
    expect(screen.getByText('Not now')).toBeTruthy();
  });
});

describe('ContributionConsentScreen — Story 1: agree to share', () => {
  it('grants consent with a non-null timestamp and advances to FirstProduct', () => {
    const navigation = renderScreen();

    fireEvent.press(screen.getByText('Agree and share'));

    expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
    const patch = mockUpdateProfile.mock.calls[0][0];
    expect(patch.contributionConsent.granted).toBe(true);
    expect(patch.contributionConsent.timestamp).not.toBeNull();
    expect(typeof patch.contributionConsent.timestamp).toBe('string');

    expect(navigation.replace).toHaveBeenCalledWith('FirstProduct');
  });
});

describe('ContributionConsentScreen — Story 2: decline, same destination', () => {
  it('records granted:false with a non-null timestamp and advances to the SAME FirstProduct screen', () => {
    const navigation = renderScreen();

    fireEvent.press(screen.getByText('Not now'));

    expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
    const patch = mockUpdateProfile.mock.calls[0][0];
    expect(patch.contributionConsent.granted).toBe(false);
    expect(patch.contributionConsent.timestamp).not.toBeNull();
    expect(typeof patch.contributionConsent.timestamp).toBe('string');

    // Identical destination to "Agree and share" — declining must never
    // fork the user onto a different path (GDPR: no functional penalty).
    expect(navigation.replace).toHaveBeenCalledWith('FirstProduct');
  });
});

describe('ContributionConsentScreen — non-blocking core acceptance criterion', () => {
  it('lets "Agree and share" be tapped immediately on a fresh render, no precondition required', () => {
    const navigation = renderScreen();

    // No setup beyond a bare render — if this were gated behind some other
    // piece of state, the press below would be a no-op.
    fireEvent.press(screen.getByText('Agree and share'));

    expect(navigation.replace).toHaveBeenCalledTimes(1);
  });

  it('lets "Not now" be tapped immediately on a fresh render, no precondition required', () => {
    const navigation = renderScreen();

    fireEvent.press(screen.getByText('Not now'));

    expect(navigation.replace).toHaveBeenCalledTimes(1);
  });
});
