/**
 * Component tests — ManualProductFormScreen's new `explorePrefill` mode (FE-6).
 * Spec: docs/specs/explore-composition.md §4 Story 4 (AC1-2), Story 5 (AC1-3)
 * Tech design: docs/tech-design/explore-composition.md §3 FE-6, §4 (last assumption)
 *
 * `route.params.explorePrefill` does not exist on ManualProductFormScreen yet
 * — this file is EXPECTED to fail until FE-6 lands.
 *
 * Mocking pattern mirrors
 * tests/conflict-matrix-expansion/ManualProductFormScreen.physical-exfoliant-toggle.test.tsx
 * and tests/contribution-consent-flow/ManualProductFormScreen.test.tsx.
 *
 * Judgment call (flagged, not silently invented): `explorePrefill`'s save
 * path shares with `prefillCorpusProduct`'s pattern — `addProduct` then an
 * UNCONDITIONAL `submitContribution` call, no consent modal — because tech
 * design FE-6 says "same as AddProductScreen.tsx's pattern", and
 * `AddProductScreen.tsx` (docs/tech-design/explore-composition.md
 * Assumption 4) itself shares unconditionally with no consent gating.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => {
  const { Text: RNText } = require('react-native');
  return { Feather: ({ name }: { name: string }) => <RNText>{`icon-${name}`}</RNText> };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/components/product/OcrScannerSheet', () => ({ OcrScannerSheet: () => null }));
jest.mock('@/components/routine/RoutineSchedulerSheet', () => ({
  RoutineSchedulerSheet: () => null,
}));
jest.mock('@/components/ui/ProductThumbnail', () => {
  const { View } = require('react-native');
  return { ProductThumbnail: () => <View testID="product-thumbnail" /> };
});
jest.mock('@/hooks/useCorpusRepositories', () => ({ useProductRepository: () => null }));

jest.mock('@/services/productImage', () => ({
  pickAndStoreProductPhoto: jest.fn(),
  storeExistingPhotoAsProductPhoto: jest.fn(),
  deleteProductPhoto: jest.fn(),
  renderContributionBlob: jest.fn(async () => null),
}));

jest.mock('@/services/contributions', () => ({ submitContribution: jest.fn() }));

jest.mock('@/store/productsStore', () => {
  const state = { products: [] as unknown[], addProduct: jest.fn(), updateProduct: jest.fn() };
  const useProductsStore = (selector: (s: typeof state) => unknown) => selector(state);
  useProductsStore.getState = () => state;
  return { useProductsStore, __state: state };
});

jest.mock('@/store/settingsStore', () => {
  const state = {
    contributionConsentStatus: 'unset',
    declinedSaveCountSinceLastReminder: 0,
    reminderCountShown: 0,
    setContributionConsentStatus: jest.fn(),
    incrementDeclinedSaveCount: jest.fn(),
    resetDeclinedSaveCount: jest.fn(),
    incrementReminderCountShown: jest.fn(),
  };
  const useSettingsStore = (selector: (s: typeof state) => unknown) => selector(state);
  useSettingsStore.getState = () => state;
  return { useSettingsStore };
});

const mockRemoveEntry = jest.fn();
// NOTE: this project's `@/*` jest moduleNameMapper cannot resolve ANY
// mock (real or virtual) for a path with no file on disk (verified
// precedent: tests/inci-attribution-highlighting/DetectedActiveBadgeWiring
// .test.tsx NOTE 2). So this whole suite fails to even resolve until
// FE-5 creates src/store/wishlistStore.ts — expected, not a bug here.
jest.mock('@/store/wishlistStore', () => ({
  useWishlistStore: jest.fn((selector: any) =>
    selector({ entries: [], addEntry: jest.fn(), removeEntry: mockRemoveEntry }),
  ),
}));

const productsStoreState = jest.requireMock('@/store/productsStore').__state as {
  products: unknown[];
  addProduct: jest.Mock;
  updateProduct: jest.Mock;
};
const mockSubmit: jest.Mock = jest.requireMock('@/services/contributions').submitContribution;

import ManualProductFormScreen from '@/screens/ManualProductFormScreen';

function renderScreen(params: Record<string, unknown> = {}) {
  const navigation = { goBack: jest.fn(), navigate: jest.fn() } as never;
  return render(<ManualProductFormScreen navigation={navigation} route={{ params } as never} />);
}

async function saveWithName(name = 'Night Serum', brand = 'Some Brand') {
  fireEvent.changeText(screen.getByPlaceholderText(/Daily Moisturiser/), name);
  fireEvent.changeText(screen.getByPlaceholderText(/La Roche-Posay/), brand);
  // BrandAutocompleteInput (2026-08-27) only commits the typed value to this
  // screen's state on blur/submit, not on every keystroke — same pattern
  // already established in
  // tests/add-product-flow/AddProductScreen.integration.test.tsx and
  // tests/explore-composition/ExploreCompositionResultScreen.test.tsx.
  fireEvent(screen.getByPlaceholderText(/La Roche-Posay/), 'blur');
  fireEvent.press(screen.getByText('Put on My Shelf'));
  await act(async () => Promise.resolve());
}

const EXPLORE_PREFILL = {
  rawIngredientsText: 'Aqua, Niacinamide, Glycerin',
  activeKeys: ['niacinamide'],
  brand: null,
  name: null,
  category: 'serum',
  wishlistEntryId: undefined,
};

beforeEach(() => {
  jest.clearAllMocks();
  productsStoreState.products = [];
  mockSubmit.mockResolvedValue({ status: 'success', withPhoto: false });
});

describe('Story 4 AC1: opening from the result screen asks only for genuinely missing fields', () => {
  it('starts with empty brand and name fields', () => {
    renderScreen({ explorePrefill: EXPLORE_PREFILL });

    expect(screen.getByPlaceholderText(/Daily Moisturiser/).props.value).toBe('');
    expect(screen.getByPlaceholderText(/La Roche-Posay/).props.value).toBe('');
  });

  it('prefills the INCI text with the already-captured raw ingredients text', () => {
    renderScreen({ explorePrefill: EXPLORE_PREFILL });
    expect(screen.getByPlaceholderText(/Paste INCI text here/).props.value).toBe(
      'Aqua, Niacinamide, Glycerin',
    );
  });

  it('pre-selects the already-captured category', () => {
    renderScreen({ explorePrefill: EXPLORE_PREFILL });
    // Product-type chips use FilterChip's accessibilityState.checked contract
    // (see PRODUCT_TYPE_OPTIONS in ManualProductFormScreen.tsx).
    const serumChip = screen.getByText('Serum');
    expect(serumChip).toBeTruthy();
  });

  it('never re-asks for the ingredients photo — the photo slot starts empty ("Add photo", not "Change photo")', () => {
    renderScreen({ explorePrefill: EXPLORE_PREFILL });
    expect(screen.getByText('Add photo')).toBeTruthy();
    expect(screen.queryByText('Change photo')).toBeNull();
  });
});

describe('Story 4 AC2: saving creates a full catalog product and shares it, same as AddProductScreen.tsx', () => {
  it('saves activeTags from the already-resolved activeKeys, not a re-parse of the text', async () => {
    renderScreen({ explorePrefill: EXPLORE_PREFILL });
    await saveWithName();

    expect(productsStoreState.addProduct).toHaveBeenCalledTimes(1);
    const saved = productsStoreState.addProduct.mock.calls[0][0];
    expect(saved.activeTags).toEqual(['niacinamide']);
    expect(saved.fullIngredientText).toBe('Aqua, Niacinamide, Glycerin');
    expect(saved.productType).toBe('serum');
  });

  it('shares the product unconditionally, with no consent modal shown', async () => {
    renderScreen({ explorePrefill: EXPLORE_PREFILL });
    await saveWithName();

    expect(mockSubmit).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Make adding products easier for everyone.')).toBeNull();
  });
});

describe('Story 5 AC1: promoting a WishlistEntry pre-fills whatever it already has', () => {
  it('pre-fills brand and name when the WishlistEntry already has them (real "Move to Shelf" promote)', () => {
    renderScreen({
      explorePrefill: {
        ...EXPLORE_PREFILL,
        brand: 'CeraVe',
        name: 'Hydrating Cleanser',
        wishlistEntryId: 'wishlist-entry-1',
      },
    });

    expect(screen.getByPlaceholderText(/Daily Moisturiser/).props.value).toBe(
      'Hydrating Cleanser',
    );
    expect(screen.getByPlaceholderText(/La Roche-Posay/).props.value).toBe('CeraVe');
  });
});

describe('Story 5: promoting a WishlistEntry removes it only after a successful save', () => {
  it('does not remove the WishlistEntry before the form is submitted', () => {
    renderScreen({ explorePrefill: { ...EXPLORE_PREFILL, wishlistEntryId: 'wishlist-entry-1' } });
    expect(mockRemoveEntry).not.toHaveBeenCalled();
  });

  it('leaves the WishlistEntry untouched if the user backs out without saving', () => {
    const navigation = { goBack: jest.fn(), navigate: jest.fn() };
    render(
      <ManualProductFormScreen
        navigation={navigation as never}
        route={{
          params: { explorePrefill: { ...EXPLORE_PREFILL, wishlistEntryId: 'wishlist-entry-1' } },
        } as never}
      />,
    );

    fireEvent.press(screen.getByLabelText('Back'));

    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(mockRemoveEntry).not.toHaveBeenCalled();
  });

  it('removes the WishlistEntry only after a successful save, never before/instead of creating the product', async () => {
    renderScreen({ explorePrefill: { ...EXPLORE_PREFILL, wishlistEntryId: 'wishlist-entry-1' } });
    await saveWithName();

    expect(productsStoreState.addProduct).toHaveBeenCalledTimes(1);
    expect(mockRemoveEntry).toHaveBeenCalledTimes(1);
    expect(mockRemoveEntry).toHaveBeenCalledWith('wishlist-entry-1');
  });

  it('does not remove any WishlistEntry when no wishlistEntryId is present (opened straight from the result screen)', async () => {
    renderScreen({ explorePrefill: EXPLORE_PREFILL });
    await saveWithName();

    expect(mockRemoveEntry).not.toHaveBeenCalled();
  });
});
