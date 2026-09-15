/**
 * Full onboarding-stack walk (tech design §1/FE-4/FE-5, spec Story 2 AC2).
 *
 * Complements SkinProfileSetupScreen.finishTarget.test.tsx (which only pins
 * SkinProfileSetupScreen's own navigate call) by proving the claim at the
 * NAVIGATOR level: rendering the real, default-exported `AppNavigator` with
 * `onboardingCompleted: false` and walking MarketingSlides -> SkinProfileSetup
 * (all 6 steps) -> FirstProduct using only real, un-mocked screen components
 * never shows ContributionConsentScreen's content anywhere along the way.
 *
 * This is a heavier integration test than the rest of this feature's suite —
 * it imports the whole navigator module graph. If it proves too fragile for
 * reasons unrelated to this feature (e.g. an unrelated screen's native
 * dependency needing a boundary mock), SkinProfileSetupScreen.finishTarget's
 * narrower pin already covers the core acceptance criterion on its own; treat
 * this file as the stronger, secondary proof.
 *
 * Not yet implemented — the real OnboardingStack still registers
 * `ContributionConsent` between SkinProfileSetup and FirstProduct today, so
 * this file is expected to fail red until FE-4/FE-5 land (see
 * .claude/rules/testing.md).
 */
import React from 'react';
import { Dimensions, ScrollView } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { makeProfile, mockReactNativeSvgFactory } from './fixtures';

jest.mock('react-native-svg', () => mockReactNativeSvgFactory());

jest.mock('@/hooks/useCorpusRepositories', () => ({ useProductRepository: () => null }));

// Heavy native boundary transitively pulled in by ManualProductFormScreen
// (CatalogNavigator registers it, and its module graph is imported eagerly
// even though this walk never renders it) — mirrors the module-boundary mock
// tests/contribution-consent-flow/ManualProductFormScreen.test.tsx already uses.
jest.mock('@/components/product/OcrScannerSheet', () => ({ OcrScannerSheet: () => null }));

// Root-cause mock: several catalog screens' module graphs (ManualProductForm's
// OcrScannerSheet, AddProductScreen's BarcodeSection -> CameraCaptureModal)
// eagerly import OcrEngineWebView -> react-native-webview at module scope,
// which has no native TurboModule registered under jest-expo. Mocking the
// library directly (rather than chasing every call site) keeps this test
// resilient to which catalog screen happens to pull it in.
jest.mock('react-native-webview', () => ({ __esModule: true, default: () => null, WebView: () => null }));

jest.mock('@/store/productsStore', () => {
  const state = { products: [] as unknown[], addProduct: jest.fn() };
  return { useProductsStore: (selector: (s: typeof state) => unknown) => selector(state) };
});

const mockAcceptMedicalDisclaimer = jest.fn();
jest.mock('@/store/settingsStore', () => ({
  useSettingsStore: jest.fn((selector: any) =>
    selector({ acceptMedicalDisclaimer: mockAcceptMedicalDisclaimer }),
  ),
}));

import type { UserProfile } from '@/types';

let mockProfile: UserProfile = makeProfile({ onboardingCompleted: false });
const mockUpdateProfile = jest.fn((patch: Partial<UserProfile>) => {
  mockProfile = { ...mockProfile, ...patch };
});

jest.mock('@/store/profileStore', () => ({
  useProfileStore: jest.fn((selector: any) =>
    selector({ hydrated: true, profile: mockProfile, updateProfile: mockUpdateProfile }),
  ),
}));

import AppNavigator from '@/navigation/AppNavigator';

beforeEach(() => {
  jest.clearAllMocks();
  mockProfile = makeProfile({ onboardingCompleted: false });
});

function advanceMarketingSlides() {
  const width = Dimensions.get('window').width;
  const scrollView = screen.UNSAFE_getByType(ScrollView);
  fireEvent(scrollView, 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: width } } });
  fireEvent.press(screen.getByRole('checkbox'));
  fireEvent.press(screen.getByText('Get started'));
}

function skipAllProfileSteps() {
  for (let i = 0; i < 6; i += 1) {
    fireEvent.press(screen.getByText('Skip'));
  }
}

describe('Onboarding stack — ContributionConsent is unreachable (spec Story 2 AC2)', () => {
  it('walks MarketingSlides -> SkinProfileSetup -> FirstProduct without ever showing "Help grow the Vials database"', () => {
    render(<AppNavigator />);

    expect(screen.getByText('CARE THAT ASKS LESS OF YOU')).toBeTruthy();
    advanceMarketingSlides();
    expect(screen.queryByText('Help grow the Vials database')).toBeNull();

    expect(screen.getByText('Step 1 of 6')).toBeTruthy();
    skipAllProfileSteps();

    // Landed on FirstProduct (its footer "Skip for now" button is a stable
    // marker across both the old and new FirstProductScreen implementations),
    // never on ContributionConsentScreen.
    expect(screen.queryByText('Help grow the Vials database')).toBeNull();
    expect(screen.getByText('Skip for now')).toBeTruthy();
  });
});
