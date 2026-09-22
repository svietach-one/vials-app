/**
 * SkinProfileSetupScreen — `sensitive` plumbing only (tech design FE-7).
 * Spec: docs/specs/vials-onboarding-quizzes.md Story 1 AC1 (profile shape)
 * and Story 4 (manual toggle reachable from onboarding).
 *
 * This file deliberately does NOT re-cover the full 6-step flow, Back/Skip
 * semantics, or per-step copy — that's already owned by
 * tests/onboarding-5-step-redesign/SkinProfileSetupScreen.test.tsx. It only
 * pins the one line of new container wiring FE-7 adds: passing
 * `initialSensitive={profile?.sensitive ?? false}` into `SkinTypeStep`, end
 * to end through the real container + real step 1.
 *
 * `SkinProfileSetupScreen.tsx` already exists and compiles today; this
 * suite's assertions are expected to fail at runtime ("unable to find
 * element") until FE-5/FE-7 land — red-before-green.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  const stub = (name: string) => {
    const Stub = (props: Record<string, unknown>) => (
      <View testID={(props.testID as string) ?? `svg-${name}`} />
    );
    Stub.displayName = name;
    return Stub;
  };
  const KNOWN_EXPORTS = [
    'Svg', 'Circle', 'Path', 'Line', 'Rect', 'Polyline', 'Polygon', 'Ellipse',
    'G', 'Defs', 'ClipPath', 'Mask', 'LinearGradient', 'RadialGradient',
    'Stop', 'Use', 'Symbol', 'Text', 'TSpan',
  ];
  const target: Record<string, unknown> = { __esModule: true, default: stub('Svg') };
  KNOWN_EXPORTS.forEach((name) => {
    target[name] = stub(name);
  });
  return new Proxy(target, {
    get: (t: Record<string, unknown>, prop: string) => (prop in t ? t[prop] : stub(prop)),
  });
});

import { SENSITIVE_LABEL } from '@/constants/labels';
import { makeProfile } from './fixtures';
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

function renderScreen() {
  const navigation = { replace: jest.fn() };
  render(<SkinProfileSetupScreen navigation={navigation as any} route={{} as any} />);
  return navigation;
}

beforeEach(() => {
  mockProfile = makeProfile();
  mockUpdateProfile.mockClear();
});

describe('SkinProfileSetupScreen — passes profile.sensitive into step 1 as initialSensitive (FE-7)', () => {
  it('shows the Sensitive switch off by default for a fresh (sensitive: false) profile', () => {
    renderScreen();

    expect(
      screen.getByRole('switch', { name: SENSITIVE_LABEL }).props.accessibilityState.checked,
    ).toBe(false);
  });

  it('shows the Sensitive switch pre-checked when the stored profile already has sensitive: true', () => {
    mockProfile = makeProfile({ sensitive: true });

    renderScreen();

    expect(
      screen.getByRole('switch', { name: SENSITIVE_LABEL }).props.accessibilityState.checked,
    ).toBe(true);
  });

  it('commits both skinType and the manually-toggled sensitive value in the same Next patch on step 1', () => {
    renderScreen();

    fireEvent.press(screen.getByText('Combination'));
    fireEvent.press(screen.getByRole('switch', { name: SENSITIVE_LABEL }));
    fireEvent.press(screen.getByText('Next'));

    expect(mockUpdateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ skinType: 'combination', sensitive: true }),
    );
  });
});
