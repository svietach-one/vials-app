/**
 * SkinProfileSetupScreen — Finish target after onboarding-simplification
 * (tech design FE-4, spec Story 2 AC1).
 *
 * SUPERSEDES the "Finish navigates to ContributionConsent, never
 * FirstProduct" regression pin in
 * tests/onboarding-5-step-redesign/SkinProfileSetupScreen.test.tsx (its
 * "Regression pin: Step 6 Finish target" describe block, all 3 `it()`s) —
 * that suite pins the OLD contract this task deliberately reverses. Those 3
 * tests will fail once FE-4 lands and must be updated/removed by the
 * engineer as part of this task (see this task's SubagentHandback report;
 * they are not touched here since they belong to a different, already-shipped
 * feature's test suite).
 *
 * Not yet implemented — SkinProfileSetupScreen still calls
 * navigation.replace('ContributionConsent') on Finish today, so this file is
 * expected to fail red until FE-4 lands (see .claude/rules/testing.md).
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { makeNavigation, makeProfile, mockReactNativeSvgFactory } from './fixtures';

jest.mock('react-native-svg', () => mockReactNativeSvgFactory());

import type { UserProfile } from '@/types';

let mockProfile: UserProfile = makeProfile();
const mockUpdateProfile = jest.fn((patch: Partial<UserProfile>) => {
  mockProfile = { ...mockProfile, ...patch };
});

jest.mock('@/store/profileStore', () => ({
  useProfileStore: jest.fn((selector: any) =>
    selector({ profile: mockProfile, updateProfile: mockUpdateProfile }),
  ),
}));

import SkinProfileSetupScreen from '@/screens/onboarding/SkinProfileSetupScreen';

function renderScreen(navigation = makeNavigation()) {
  render(<SkinProfileSetupScreen navigation={navigation as any} route={{} as any} />);
  return navigation;
}

beforeEach(() => {
  mockProfile = makeProfile();
  mockUpdateProfile.mockClear();
});

function skipAllSteps() {
  for (let i = 0; i < 6; i += 1) {
    fireEvent.press(screen.getByText('Skip'));
  }
}

function advanceAllStepsWithData() {
  fireEvent.press(screen.getByText('Oily'));
  fireEvent.press(screen.getByText('Next'));

  fireEvent.press(screen.getByText('Clear acne'));
  fireEvent.press(screen.getByText('Next'));

  fireEvent.press(screen.getByLabelText(/Type three/));
  fireEvent.press(screen.getByText('Next'));

  fireEvent.press(screen.getByRole('switch', { name: 'Currently on hormone therapy' }));
  fireEvent.press(screen.getByText('Next'));

  fireEvent.press(screen.getByRole('switch', { name: 'Pregnant or breastfeeding' }));
  fireEvent.press(screen.getByText('Next'));

  fireEvent.press(screen.getByText('Finish'));
}

describe('SkinProfileSetupScreen — Finish navigates to FirstProduct, never ContributionConsent (tech design FE-4)', () => {
  it('calls navigation.replace("FirstProduct") when every step is skipped', () => {
    const navigation = renderScreen();

    skipAllSteps();

    expect(navigation.replace).toHaveBeenCalledWith('FirstProduct');
    expect(navigation.replace).not.toHaveBeenCalledWith('ContributionConsent');
  });

  it('calls navigation.replace("FirstProduct") when every step is filled in via Next/Finish', () => {
    const navigation = renderScreen();

    advanceAllStepsWithData();

    expect(navigation.replace).toHaveBeenCalledTimes(1);
    expect(navigation.replace).toHaveBeenCalledWith('FirstProduct');
    expect(navigation.replace).not.toHaveBeenCalledWith('ContributionConsent');
  });
});
