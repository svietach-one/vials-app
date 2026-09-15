/**
 * MarketingSlidesScreen — "Privacy First" slide removal (tech design FE-1,
 * spec Story 1, Goal 1). Covers only what onboarding-simplification changes:
 * exactly 2 slides in the given order, with the medical-disclaimer checkbox
 * and "Get started" CTA still gating the (now 2nd, not 3rd) last slide.
 * Verbatim slide-1/slide-2 body copy is already pinned by
 * tests/onboarding-consent-copy-update/MarketingSlidesScreen.test.tsx and is
 * NOT duplicated here.
 *
 * That existing suite currently asserts a 3-slide "PRIVACY FIRST" contract
 * this task deliberately removes — its slide-2 tests (SLIDE2_KICKER ===
 * 'PRIVACY FIRST', its body, and `advanceToSlide(2)` for the consent slide)
 * will fail once FE-1 lands and must be updated/retired by the engineer as
 * part of this task (see this task's SubagentHandback report).
 *
 * Not yet implemented — today's SLIDES array still has 3 entries, so this
 * file is expected to fail red until FE-1 lands (see .claude/rules/testing.md).
 */
import React from 'react';
import { Dimensions, ScrollView } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { makeNavigation } from './fixtures';

const mockAcceptMedicalDisclaimer = jest.fn();

jest.mock('@/store/settingsStore', () => ({
  useSettingsStore: jest.fn((selector: any) =>
    selector({ acceptMedicalDisclaimer: mockAcceptMedicalDisclaimer }),
  ),
}));

import MarketingSlidesScreen from '@/screens/onboarding/MarketingSlidesScreen';

function renderScreen(navigation = makeNavigation()) {
  render(<MarketingSlidesScreen navigation={navigation as any} route={{} as any} />);
  return navigation;
}

/** Simulates the paging ScrollView settling on slide `index` (0-based). */
function advanceToSlide(index: number) {
  const width = Dimensions.get('window').width;
  const scrollView = screen.UNSAFE_getByType(ScrollView);
  fireEvent(scrollView, 'momentumScrollEnd', {
    nativeEvent: { contentOffset: { x: width * index } },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('MarketingSlidesScreen — exactly 2 slides, "Privacy First" gone (spec Goal 1 / Story 1 AC1)', () => {
  it('renders "Care that asks less of you" first, with no Privacy First slide anywhere in the tree', () => {
    renderScreen();

    expect(screen.getByText('CARE THAT ASKS LESS OF YOU')).toBeTruthy();
    expect(screen.queryByText('PRIVACY FIRST')).toBeNull();
    expect(screen.queryByText(/privacy first/i)).toBeNull();
  });

  it('renders "Safety logic" as slide index 1 — the SECOND and FINAL slide, not a 3rd one', () => {
    renderScreen();

    advanceToSlide(1);

    expect(screen.getByText('SAFETY LOGIC')).toBeTruthy();
    // Both the medical-disclaimer checkbox and the "Get started" CTA bind to
    // the LAST slide only — if a 3rd slide still existed, neither would show
    // yet at index 1.
    expect(screen.getByRole('checkbox')).toBeTruthy();
    expect(screen.getByText('Get started')).toBeTruthy();
  });

  it('reaches SkinProfileSetup directly from slide index 1 — proving there is no slide index 2 to advance to', () => {
    const navigation = renderScreen();
    advanceToSlide(1);

    fireEvent.press(screen.getByRole('checkbox'));
    fireEvent.press(screen.getByText('Get started'));

    expect(navigation.replace).toHaveBeenCalledTimes(1);
    expect(navigation.replace).toHaveBeenCalledWith('SkinProfileSetup');
  });
});

describe('MarketingSlidesScreen — medical-disclaimer checkbox still gates the final CTA (spec Story 1 AC2)', () => {
  it('does nothing while unchecked, then accepts the disclaimer and navigates once checked', () => {
    const navigation = renderScreen();
    advanceToSlide(1);

    fireEvent.press(screen.getByText('Get started'));
    expect(mockAcceptMedicalDisclaimer).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();

    fireEvent.press(screen.getByRole('checkbox'));
    fireEvent.press(screen.getByText('Get started'));

    expect(mockAcceptMedicalDisclaimer).toHaveBeenCalledTimes(1);
    expect(navigation.replace).toHaveBeenCalledWith('SkinProfileSetup');
  });
});
