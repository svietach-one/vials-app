/**
 * MarketingSlidesScreen — onboarding copy correction + medical disclaimer
 * consent gate (docs/tech-design/onboarding-consent-copy-update.md FE-3,
 * spec docs/specs/onboarding-consent-copy-update.md Stories 1 & 2).
 *
 * Screen not yet updated by the engineer (FE-2/FE-3 unimplemented) — this
 * file is expected to fail at runtime against today's copy/CTA/no-checkbox
 * screen until those land. Red before green, per .claude/rules/testing.md.
 *
 * `settingsStore` is mocked at the selector boundary, matching every other
 * `useSettingsStore` call site + its existing test convention (see
 * tests/contribution-consent/ProfileScreenContributionToggle.test.tsx).
 * `acceptMedicalDisclaimer` itself (FE-2) is out of scope here — it has no
 * co-located unit test per the tech design (§3, "engineer (unit tests, both
 * scopes)"), so this suite only asserts the screen calls it with the right
 * argument, not what it does internally.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import {
  CONSENT_LABEL,
  CURRENT_MEDICAL_DISCLAIMER_VERSION,
  OLD_FALSE_PRIVACY_CLAIM,
  SLIDE1_BODY,
  SLIDE1_CTA,
  SLIDE1_HEADLINE,
  SLIDE1_KICKER,
  SLIDE2_BODY,
  SLIDE2_CTA,
  SLIDE2_HEADLINE,
  SLIDE2_KICKER,
  SLIDE3_BODY,
  SLIDE3_CTA,
  SLIDE3_HEADLINE,
  SLIDE3_KICKER,
  advanceToConsentSlide,
  advanceToSlide,
  makeMarketingSlidesNavigation,
} from './fixtures';

const mockAcceptMedicalDisclaimer = jest.fn();

jest.mock('@/store/settingsStore', () => ({
  useSettingsStore: jest.fn((selector: any) =>
    selector({ acceptMedicalDisclaimer: mockAcceptMedicalDisclaimer }),
  ),
}));

import MarketingSlidesScreen from '@/screens/onboarding/MarketingSlidesScreen';

function renderScreen(navigation = makeMarketingSlidesNavigation()) {
  render(
    <MarketingSlidesScreen navigation={navigation as any} route={{} as any} />,
  );
  return navigation;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Story 1: slide 1 & 2 verbatim copy ────────────────────────────────────

describe('MarketingSlidesScreen — slide 1 verbatim copy (spec Story 1)', () => {
  it('renders the exact kicker, headline, body, and CTA on a fresh render', () => {
    renderScreen();

    expect(screen.getByText(SLIDE1_KICKER)).toBeTruthy();
    expect(screen.getByText(SLIDE1_HEADLINE)).toBeTruthy();
    expect(screen.getByText(SLIDE1_BODY)).toBeTruthy();
    expect(screen.getByText(SLIDE1_CTA)).toBeTruthy();
  });
});

describe('MarketingSlidesScreen — slide 2 verbatim copy (spec Story 1)', () => {
  it('renders the exact kicker, headline, and body (mounted regardless of active slide)', () => {
    renderScreen();

    expect(screen.getByText(SLIDE2_KICKER)).toBeTruthy();
    expect(screen.getByText(SLIDE2_HEADLINE)).toBeTruthy();
    expect(screen.getByText(SLIDE2_BODY)).toBeTruthy();
  });

  it('renders the exact CTA once slide 2 becomes the active slide', () => {
    renderScreen();

    advanceToSlide(1);

    expect(screen.getByText(SLIDE2_CTA)).toBeTruthy();
  });
});

describe('MarketingSlidesScreen — stale privacy claim removed (spec Goal 1)', () => {
  it('does not render the outdated "no cloud, no tracking" claim anywhere on the screen', () => {
    // This exact sentence contradicts the shipped crowdsourcing pipeline
    // (PRD_Spec.md §4.3) — the whole reason this task exists. It must be
    // gone once slide 1/2's copy is corrected, regardless of the new
    // wording chosen.
    renderScreen();

    expect(screen.queryByText(OLD_FALSE_PRIVACY_CLAIM)).toBeNull();
  });
});

// ─── Story 2: slide 3 consent gate ──────────────────────────────────────────

describe('MarketingSlidesScreen — slide 3 verbatim copy (spec §5)', () => {
  it('renders the exact kicker, headline, body, and consent checkbox label', () => {
    renderScreen();
    advanceToConsentSlide();

    expect(screen.getByText(SLIDE3_KICKER)).toBeTruthy();
    expect(screen.getByText(SLIDE3_HEADLINE)).toBeTruthy();
    expect(screen.getByText(SLIDE3_BODY)).toBeTruthy();
    expect(screen.getByText(CONSENT_LABEL)).toBeTruthy();
  });
});

describe('MarketingSlidesScreen — consent checkbox default state (spec Story 2 AC1)', () => {
  it('renders the checkbox unchecked by default', () => {
    renderScreen();
    advanceToConsentSlide();

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox.props.accessibilityState.checked).toBe(false);
  });
});

describe('MarketingSlidesScreen — CTA disabled while unchecked (spec Story 2 AC1/AC2)', () => {
  it('does nothing when the CTA is pressed while the checkbox is still unchecked', () => {
    const navigation = renderScreen();
    advanceToConsentSlide();

    fireEvent.press(screen.getByText(SLIDE3_CTA));

    expect(mockAcceptMedicalDisclaimer).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});

describe('MarketingSlidesScreen — checking the box enables the CTA (spec Story 2 AC3)', () => {
  it('checks the box on tap, with no other control able to check it', () => {
    renderScreen();
    advanceToConsentSlide();

    fireEvent.press(screen.getByRole('checkbox'));

    expect(screen.getByRole('checkbox').props.accessibilityState.checked).toBe(true);
  });

  it('records acceptance and navigates once the box is checked and the CTA is pressed', () => {
    const navigation = renderScreen();
    advanceToConsentSlide();

    fireEvent.press(screen.getByRole('checkbox'));
    fireEvent.press(screen.getByText(SLIDE3_CTA));

    expect(mockAcceptMedicalDisclaimer).toHaveBeenCalledTimes(1);
    expect(mockAcceptMedicalDisclaimer).toHaveBeenCalledWith(
      CURRENT_MEDICAL_DISCLAIMER_VERSION,
    );
    expect(navigation.replace).toHaveBeenCalledTimes(1);
    expect(navigation.replace).toHaveBeenCalledWith('SkinProfileSetup');
  });
});

describe('MarketingSlidesScreen — unchecking re-disables the CTA (spec Story 2 AC4)', () => {
  it('disables the CTA again after the box is checked then unchecked', () => {
    const navigation = renderScreen();
    advanceToConsentSlide();

    fireEvent.press(screen.getByRole('checkbox')); // check
    fireEvent.press(screen.getByRole('checkbox')); // uncheck
    expect(screen.getByRole('checkbox').props.accessibilityState.checked).toBe(false);

    fireEvent.press(screen.getByText(SLIDE3_CTA));

    expect(mockAcceptMedicalDisclaimer).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});

describe('MarketingSlidesScreen — no skip path on slide 3 (spec Story 2 AC6)', () => {
  it('renders no "Skip" action of any kind once the consent slide is active', () => {
    renderScreen();
    advanceToConsentSlide();

    expect(screen.queryByText(/skip/i)).toBeNull();
  });
});
