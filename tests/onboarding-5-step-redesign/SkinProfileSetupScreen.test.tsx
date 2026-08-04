/**
 * SkinProfileSetupScreen — 5-step container (tech design §1, FE-9).
 * Spec: docs/specs/onboarding-5-step-redesign.md Stories 1-2, 6.
 *
 * The screen is rewritten from a single scrolling form into a thin
 * container: `step: 1..5` state + `OnboardingProgressRing` + one of the 5
 * new step components. It is the SOLE `useProfileStore` caller — steps
 * receive `onNext(patch)` / `onSkip()` / `onBack()` and never touch the
 * store directly (tech design Assumption 3).
 *
 * Not yet rewritten — this file (and the 5 step components it exercises
 * transitively through the real, un-mocked screen) is expected to fail until
 * FE-4..FE-9 land (see .claude/rules/testing.md: red before green).
 *
 * NOTE for whoever runs this before FE-9 lands: unlike the 5 step-component
 * test files (which fail tsc/jest with "Cannot find module" because their
 * files don't exist at all yet), `SkinProfileSetupScreen.tsx` itself already
 * exists today as the pre-redesign single-screen implementation, so this
 * import resolves fine at both tsc and runtime. Every assertion below still
 * fails at runtime (there is no "Step 1 of 5" text, no "Next"/"Skip" copy,
 * no ContributionConsent-only navigation target yet in the old screen) — a
 * legitimate red state for a rewrite-in-place task, just surfaced as failing
 * `it()` blocks rather than a module-resolution error.
 *
 * react-native-svg is mocked (OnboardingProgressRing renders inside this
 * screen — first usage of that dependency in src/, tech design Assumption 6).
 *
 * `useProfileStore` is mocked so `updateProfile` is a spy; the spy also
 * mutates the shared `mockProfile` object so that a later render (e.g. after
 * Back) reflects data an EARLIER Next already committed — this simulates
 * Zustand's real "write, then re-render with fresh state" behaviour closely
 * enough to test Assumption 8 (re-seed from current profile on remount)
 * without needing the real store.
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
  // Real own properties (not just a Proxy `get` trap) so lucide-react-native's
  // internal namespace-import enumeration (`Object.keys(...)`) finds them — a
  // `get`-only Proxy stubs direct property access fine but is invisible to
  // `Object.keys`, which otherwise silently drops every SVG primitive the
  // Icon component's lucide glyphs render through (Circle, Path, etc.),
  // making any icon inside the ring resolve to `undefined`.
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

import { makeProfile, makeSetupScreenNavigation } from './fixtures';
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

function renderScreen(navigation = makeSetupScreenNavigation()) {
  render(<SkinProfileSetupScreen navigation={navigation as any} route={{} as any} />);
  return navigation;
}

beforeEach(() => {
  mockProfile = makeProfile();
  mockUpdateProfile.mockClear();
});

// ── Helpers to advance through a step via its real, rendered UI ────────────────

function advanceSkinType() {
  fireEvent.press(screen.getByText('Oily'));
  fireEvent.press(screen.getByText('Next'));
}

function advanceGoals() {
  fireEvent.press(screen.getByText('Clear acne'));
  fireEvent.press(screen.getByText('Fade pigmentation'));
  fireEvent.press(screen.getByText('Next'));
}

function advancePhototype() {
  fireEvent.press(screen.getByLabelText(/Type three/));
  fireEvent.press(screen.getByText('Next'));
}

function advanceAboutYou() {
  fireEvent.press(screen.getByRole('switch', { name: 'Currently on hormone therapy' }));
  fireEvent.press(screen.getByText('Next'));
}

function advanceAdditionalInfo() {
  fireEvent.press(screen.getByRole('switch', { name: 'Pregnant or breastfeeding' }));
  fireEvent.press(screen.getByText('Next'));
}

function finishCityStep() {
  fireEvent.press(screen.getByText('Finish'));
}

// ── Story 1: step order and progress ────────────────────────────────────────────

describe('SkinProfileSetupScreen — renders the 6 steps in order with a live progress indicator (Story 1)', () => {
  it('shows step 1 (Skin type) with "Step 1 of 6" on first render', () => {
    renderScreen();

    expect(screen.getByText('Step 1 of 6')).toBeTruthy();
    expect(screen.getByText("What's your skin type?")).toBeTruthy();
  });

  it('advances through all 6 steps in order, updating the progress text on every Next', () => {
    renderScreen();

    expect(screen.getByText('Step 1 of 6')).toBeTruthy();
    advanceSkinType();

    expect(screen.getByText('Step 2 of 6')).toBeTruthy();
    expect(screen.getByText('What would you like to improve?')).toBeTruthy();
    advanceGoals();

    expect(screen.getByText('Step 3 of 6')).toBeTruthy();
    expect(screen.getByText('How does your skin react to the sun?')).toBeTruthy();
    advancePhototype();

    expect(screen.getByText('Step 4 of 6')).toBeTruthy();
    expect(screen.getByText('A little about you')).toBeTruthy();
    advanceAboutYou();

    expect(screen.getByText('Step 5 of 6')).toBeTruthy();
    expect(screen.getByText('Anything we should know?')).toBeTruthy();
    advanceAdditionalInfo();

    expect(screen.getByText('Step 6 of 6')).toBeTruthy();
    expect(screen.getByText('Where are you based?')).toBeTruthy();
  });
});

// ── Story 1 AC2: Back navigation ────────────────────────────────────────────────

describe('SkinProfileSetupScreen — Back returns to the previous step and updates the ring (Story 1 AC2)', () => {
  it('re-shows step 1 and "Step 1 of 6" when Back is pressed from step 2, without persisting anything new', () => {
    renderScreen();
    advanceSkinType();
    expect(screen.getByText('Step 2 of 6')).toBeTruthy();
    const callsBeforeBack = mockUpdateProfile.mock.calls.length;

    fireEvent.press(screen.getByLabelText('Back'));

    expect(screen.getByText('Step 1 of 6')).toBeTruthy();
    expect(screen.getByText("What's your skin type?")).toBeTruthy();
    expect(mockUpdateProfile).toHaveBeenCalledTimes(callsBeforeBack);
  });

  it('re-seeds the skin type step from the already-committed profile value on remount (tech design Assumption 8)', () => {
    renderScreen();
    advanceSkinType(); // commits skinType: 'oily'
    fireEvent.press(screen.getByLabelText('Back'));

    expect(screen.getByRole('checkbox', { name: 'Oily' }).props.accessibilityState.checked).toBe(true);
  });
});

// ── Story 2: per-step Skip ───────────────────────────────────────────────────────

describe('SkinProfileSetupScreen — Skip advances without persisting that step\'s field (Story 2)', () => {
  it('advances to step 2 without calling updateProfile when Skip is pressed on step 1', () => {
    renderScreen();

    fireEvent.press(screen.getByText('Oily')); // choose a value, then Skip anyway
    fireEvent.press(screen.getByText('Skip'));

    expect(screen.getByText('Step 2 of 6')).toBeTruthy();
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it('still persists steps 2-6 correctly after step 1 was skipped — skipping never discards later data (Story 2 AC2)', () => {
    renderScreen();

    fireEvent.press(screen.getByText('Skip')); // skip step 1 entirely
    expect(mockUpdateProfile).not.toHaveBeenCalled();

    advanceGoals();
    advancePhototype();
    advanceAboutYou();
    advanceAdditionalInfo();
    finishCityStep();

    // Exactly 5 commits — one per step 2-6 — step 1 never contributed a call.
    expect(mockUpdateProfile).toHaveBeenCalledTimes(5);
    mockUpdateProfile.mock.calls.forEach(([patch]) => {
      expect(patch).not.toHaveProperty('skinType');
    });

    const patches = mockUpdateProfile.mock.calls.map(([patch]) => patch);
    expect(patches.some((p) => p.primaryGoal === 'acne')).toBe(true);
    expect(patches.some((p) => p.fitzpatrick === 3)).toBe(true);
    expect(patches.some((p) => p.hormoneTherapy === true)).toBe(true);
    expect(patches.some((p) => p.pregnantOrBreastfeeding === true)).toBe(true);
    expect(patches.some((p) => p.city === null)).toBe(true);
  });
});

// ── Regression pin: Step 6 Finish target (tech design Assumption 4) ─────────────

describe('SkinProfileSetupScreen — Finish navigates to ContributionConsent, never FirstProduct or onboardingCompleted (tech design Assumption 4)', () => {
  it('calls navigation.replace("ContributionConsent") when Finish is pressed on step 6', () => {
    const navigation = renderScreen();

    advanceSkinType();
    advanceGoals();
    advancePhototype();
    advanceAboutYou();
    advanceAdditionalInfo();
    finishCityStep();

    expect(navigation.replace).toHaveBeenCalledWith('ContributionConsent');
    expect(navigation.replace).not.toHaveBeenCalledWith('FirstProduct');
  });

  it('never writes onboardingCompleted in any updateProfile call across the whole flow', () => {
    renderScreen();

    advanceSkinType();
    advanceGoals();
    advancePhototype();
    advanceAboutYou();
    advanceAdditionalInfo();
    finishCityStep();

    mockUpdateProfile.mock.calls.forEach(([patch]) => {
      expect(patch).not.toHaveProperty('onboardingCompleted');
    });
  });

  it('lands on ContributionConsent even when every step was skipped', () => {
    const navigation = renderScreen();

    fireEvent.press(screen.getByText('Skip'));
    fireEvent.press(screen.getByText('Skip'));
    fireEvent.press(screen.getByText('Skip'));
    fireEvent.press(screen.getByText('Skip'));
    fireEvent.press(screen.getByText('Skip'));
    fireEvent.press(screen.getByText('Skip'));

    expect(mockUpdateProfile).not.toHaveBeenCalled();
    expect(navigation.replace).toHaveBeenCalledWith('ContributionConsent');
  });
});

// ── CityStep (step 6 of 6) — weather-driven seasonal rules ──────────────────────

describe('SkinProfileSetupScreen — CityStep persists the selected city (Story 6, tech design §1.7)', () => {
  it('commits the selected city and finishes onto ContributionConsent', () => {
    const navigation = renderScreen();

    advanceSkinType();
    advanceGoals();
    advancePhototype();
    advanceAboutYou();
    advanceAdditionalInfo();

    fireEvent.changeText(
      screen.UNSAFE_getByProps({ placeholder: 'Search your city…' }),
      'Warsaw',
    );
    fireEvent.press(screen.getByLabelText('Select Warsaw, Poland'));
    fireEvent.press(screen.getByText('Finish'));

    expect(mockUpdateProfile).toHaveBeenCalledWith({
      city: expect.objectContaining({ name: 'Warsaw, Poland' }),
    });
    expect(navigation.replace).toHaveBeenCalledWith('ContributionConsent');
  });
});
