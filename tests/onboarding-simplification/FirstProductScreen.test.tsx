/**
 * FirstProductScreen (onboarding) — rewritten as a thin wrapper around the
 * shared AddProductOptionsList component (tech design FE-8, spec Story 4).
 *
 * Not yet implemented — today's screen is a bespoke, corpus-search-only
 * implementation with no Scan/Manual entry points and an immediate
 * auto-save on result tap; this file is expected to fail red until
 * FE-7/FE-8 land (see .claude/rules/testing.md).
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('@/hooks/useCorpusRepositories', () => ({ useProductRepository: () => null }));

const mockUpdateProfile = jest.fn();
jest.mock('@/store/profileStore', () => ({
  useProfileStore: jest.fn((selector: any) => selector({ updateProfile: mockUpdateProfile })),
}));

jest.mock('@/store/productsStore', () => ({
  useProductsStore: jest.fn((selector: any) => selector({ addProduct: jest.fn() })),
}));

import { makeNavigation } from './fixtures';
import FirstProductScreen from '@/screens/onboarding/FirstProductScreen';
import { SCAN_PRODUCT_ENABLED } from '@/constants/featureFlags';

function renderScreen(navigation = makeNavigation()) {
  render(<FirstProductScreen navigation={navigation as any} route={{} as any} />);
  return navigation;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("FirstProductScreen — parity with the shelf's AddProductHubScreen (spec Story 4 AC1)", () => {
  it('shows the two available entry points: Search Database and Create Product Manually', () => {
    renderScreen();

    expect(screen.getByText('Search Database')).toBeTruthy();
    expect(screen.getByLabelText('Create product manually')).toBeTruthy();
  });
});

describe('FirstProductScreen — "Scan Product" is gated behind SCAN_PRODUCT_ENABLED (product request, capture/OCR flow not ready)', () => {
  it('does not render the Scan Product entry point while the flag is off', () => {
    renderScreen();

    expect(SCAN_PRODUCT_ENABLED).toBe(false);
    expect(screen.queryByLabelText('Scan product')).toBeNull();
    expect(screen.queryByText('Scan')).toBeNull();
  });
});

describe('FirstProductScreen — header copy and no-back-button stay as today (spec §5 UX)', () => {
  it('keeps the "Add your first product" header copy', () => {
    renderScreen();

    expect(screen.getByText(/Add your first/i)).toBeTruthy();
  });

  it('renders no back action — mirrors today, there is nothing to go back to', () => {
    renderScreen();

    expect(screen.queryByLabelText('Back')).toBeNull();
  });
});

describe('FirstProductScreen — entryContext="onboarding" threads into the shared flow (tech design FE-8)', () => {
  it('navigates to AddProduct with entryContext:"onboarding" when Create Product Manually is pressed', () => {
    const navigation = renderScreen();

    fireEvent.press(screen.getByLabelText('Create product manually'));

    expect(navigation.navigate).toHaveBeenCalledWith(
      'AddProduct',
      expect.objectContaining({ entryContext: 'onboarding' }),
    );
  });
});

describe('FirstProductScreen — Skip for now still works (spec Story 1 §5 / Story 4 AC4)', () => {
  it('completes onboarding when "Skip for now" is pressed, without starting any sub-flow', () => {
    const navigation = renderScreen();

    fireEvent.press(screen.getByText('Skip for now'));

    expect(mockUpdateProfile).toHaveBeenCalledWith({ onboardingCompleted: true });
    expect(navigation.navigate).not.toHaveBeenCalled();
  });
});
