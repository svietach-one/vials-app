/**
 * Component tests — CatalogScreen's two entry cards, EXPLORE_COMPOSITION_ENABLED ON.
 * Spec: docs/specs/explore-composition.md §4 Story 1 (AC1), §5
 * Tech design: docs/tech-design/explore-composition.md §3 FE-1/FE-8/FE-15
 *
 * `EXPLORE_COMPOSITION_ENABLED` does not exist in
 * `src/constants/featureFlags.ts` yet, and CatalogScreen's `entryPointRow`
 * still renders plain Buttons (not cards) that both route through the old
 * pipeline — this file is EXPECTED to fail until FE-1/FE-8 land.
 *
 * Mocking pattern (explicit per-file flag override via jest.mock +
 * jest.requireActual) mirrors
 * tests/pregnancy-safety-handling/AddProcedureModal.pregnancy-enabled.test.tsx.
 *
 * Card titles stay the existing English "Add new" copy for the `Add new`
 * card — spec §5 explicitly says the existing buttons "become two full-card
 * tap targets (title + subtitle)", not the Russian source-brief concept
 * names (`Добавить средство` / `Исследовать состав`), which describe the
 * *product idea*, not shipped UI copy (CLAUDE.md: English-only UI).
 *
 * **2026-08-26 decision batch (FE-15):** the `Explore new` card's title
 * changed to "Explore ingredients" (spec §5/§10, tech design FE-15).
 *
 * **2026-08-27 update:** BOTH cards' subtitle copy is now FINAL, not
 * placeholder — `Add new` → "You already own it", `Explore ingredients` →
 * "Before you buy" (shorter, replaces the 2026-08-26 longer subtitle). Both
 * cards' leading icon-wrap is removed — title + subtitle only. The
 * `Explore ingredients` card's title is also shortened to just "Explore".
 * The card row itself moved from a bottom-pinned position (below the list)
 * to directly under the Owned/Wishlist tabs, and shrunk to a more compact
 * size to match. This is an intentional, documented UPDATE to this test
 * file's own prior assertions — not a silent drift.
 */
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react-native';

jest.mock('@/constants/featureFlags', () => ({
  ...jest.requireActual('@/constants/featureFlags'),
  EXPLORE_COMPOSITION_ENABLED: true,
}));

jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('@/components/ui/Icon', () => ({ Icon: () => null }));

jest.mock('@/components/ui/core/Button', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({ onPress, children, testID }: any) => (
      <Pressable onPress={onPress} testID={testID ?? 'btn'} accessibilityRole="button">
        <Text>{children}</Text>
      </Pressable>
    ),
  };
});

jest.mock('@/components/ui/core/Card', () => {
  const { Pressable } = require('react-native');
  return {
    Card: ({ onPress, children, style, accessibilityLabel }: any) => (
      <Pressable
        onPress={onPress}
        testID="catalog-card"
        style={style}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </Pressable>
    ),
  };
});

jest.mock('@/components/ui/core/IconButton', () => {
  const { Pressable } = require('react-native');
  return {
    IconButton: ({ onPress, label }: any) => (
      <Pressable onPress={onPress} accessibilityLabel={label} testID={`icon-btn-${label}`} />
    ),
  };
});

jest.mock('@/components/ui/core/Tag', () => {
  const { Text } = require('react-native');
  return { Tag: ({ children }: any) => <Text>{children}</Text> };
});

jest.mock('@/components/ui/forms/Input', () => {
  const { TextInput } = require('react-native');
  return {
    Input: ({ value, onChangeText, placeholder }: any) => (
      <TextInput
        testID="catalog-search-input"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
      />
    ),
  };
});

jest.mock('@/components/product/DeleteProductModal', () => ({ DeleteProductModal: () => null }));
jest.mock('@/components/product/ProductActionSheet', () => ({ ProductActionSheet: () => null }));
jest.mock('@/components/catalog/CatalogFilterTrigger', () => ({
  CatalogFilterTrigger: () => null,
}));
jest.mock('@/components/catalog/FilterSheet', () => ({ FilterSheet: () => null }));
jest.mock('@/components/routine/RoutineSchedulerSheet', () => ({
  RoutineSchedulerSheet: () => null,
}));

jest.mock('@/constants/tokens', () => ({
  colors: new Proxy({}, { get: () => '#000' }),
  space: new Proxy({}, { get: () => 8 }),
  typography: new Proxy({}, { get: () => ({}) }),
  radius: new Proxy({}, { get: () => 8 }),
  palette: { white: '#fff', black: '#000' },
  shadow: new Proxy({}, { get: () => ({}) }),
}));

jest.mock('@/store/productsStore', () => ({
  useProductsStore: jest.fn((selector: any) =>
    selector({ products: [], updateProduct: jest.fn(), removeProduct: jest.fn() }),
  ),
}));

jest.mock('@/store/routinesStore', () => ({
  useRoutinesStore: jest.fn((selector: any) =>
    selector({ routines: [], removeProductStep: jest.fn() }),
  ),
}));

// Empty by default — the Wishlist tab's own rendering of these entries is
// covered in CatalogScreen.wishlist-tab-rendering.test.tsx. Mocked here only
// so importing CatalogScreen (which imports wishlistStore once FE-7 lands)
// resolves.
// NOTE: this project's `@/*` jest moduleNameMapper cannot resolve ANY
// mock (real or virtual) for a path with no file on disk (verified
// precedent: tests/inci-attribution-highlighting/DetectedActiveBadgeWiring
// .test.tsx NOTE 2). So this whole suite fails to even resolve until
// FE-5 creates src/store/wishlistStore.ts — expected, not a bug here.
jest.mock('@/store/wishlistStore', () => ({
  useWishlistStore: jest.fn((selector: any) => selector({ entries: [], removeEntry: jest.fn() })),
}));

import CatalogScreen from '@/screens/CatalogScreen';
import { makeNavigation } from './fixtures';

const ADD_SUBTITLE = 'You already own it';
const EXPLORE_TITLE = 'Explore'; // shortened from "Explore ingredients" 2026-08-27
const EXPLORE_SUBTITLE = 'Before you buy';

function renderScreen() {
  const navigation = makeNavigation();
  render(<CatalogScreen navigation={navigation} route={{} as any} />);
  return navigation as { navigate: jest.Mock };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AC1 (Story 1): two full-card tap targets render, each with a title and a subtitle', () => {
  it('renders "Add new" as a card with its FINAL, human-confirmed subtitle (2026-08-27, no longer PLACEHOLDER)', () => {
    renderScreen();
    const cards = screen.getAllByTestId('catalog-card');
    const addCard = cards.find((c) => within(c).queryByText('Add new'));
    expect(addCard).toBeTruthy();
    expect(within(addCard!).getByText(ADD_SUBTITLE)).toBeTruthy();
  });

  it('renders the "Explore new" entry point as a card with its FINAL, human-confirmed title and subtitle (2026-08-26 decision batch, FE-15 — no longer PLACEHOLDER)', () => {
    renderScreen();
    const cards = screen.getAllByTestId('catalog-card');
    const exploreCard = cards.find((c) => within(c).queryByText(EXPLORE_TITLE));
    expect(exploreCard).toBeTruthy();
    expect(within(exploreCard!).getByText(EXPLORE_TITLE)).toBeTruthy();
    expect(within(exploreCard!).getByText(EXPLORE_SUBTITLE)).toBeTruthy();
  });

  it('never renders the old "Explore new" title copy — the card was retitled, not just re-subtitled', () => {
    renderScreen();
    expect(screen.queryByText('Explore new')).toBeNull();
  });
});

describe('"Add new" card routing stays unchanged', () => {
  it('navigates to AddProductHub, exactly as the pre-existing button did', () => {
    const navigation = renderScreen();
    fireEvent.press(screen.getByText('Add new'));
    expect(navigation.navigate).toHaveBeenCalledWith('AddProductHub');
  });
});

describe('"Explore new" entry point is retargeted to the new capture screen', () => {
  it('navigates to ExploreCompositionCapture, never the old brand-OCR CaptureFlow', () => {
    const navigation = renderScreen();
    fireEvent.press(screen.getByText(EXPLORE_TITLE));

    expect(navigation.navigate).toHaveBeenCalledWith(
      'ExploreCompositionCapture',
      expect.anything(),
    );
    expect(navigation.navigate).not.toHaveBeenCalledWith(
      'CaptureFlow',
      expect.objectContaining({ initialStatus: 'wishlist' }),
    );
  });
});
