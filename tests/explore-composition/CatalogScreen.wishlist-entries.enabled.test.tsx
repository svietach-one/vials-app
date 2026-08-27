/**
 * Component tests — CatalogScreen's Wishlist tab rendering WishlistEntry
 * rows alongside existing fully-identified wishlist products (FE-7),
 * EXPLORE_COMPOSITION_ENABLED ON.
 * Spec: docs/specs/explore-composition.md §4 Story 3 (AC2), §5, §10, Story 9
 *       (AC1 — tapping the card navigates to the new detail screen)
 * Tech design: docs/tech-design/explore-composition.md §3 FE-7, §4 Assumption 5;
 *       §3 FE-23 (CatalogScreen's onCardPress wiring, 2026-08-27)
 *
 * `src/store/wishlistStore.ts` and `src/components/product/
 * WishlistEntryCard.tsx` do not exist yet, and CatalogScreen's Wishlist tab
 * does not render them — this file is EXPECTED to fail until FE-5/FE-7 land.
 *
 * Per tech design Assumption 5, `WishlistEntry` rows render as a distinct,
 * separately-labeled section within the existing "Wishlist · N" tab — NOT
 * merged into one list/card type with the pre-existing `catalogStore`
 * (`status: 'wishlist'`) products. This suite asserts that separation
 * structurally (a dedicated section container, `WishlistEntryCard` vs.
 * `WishlistProductCard`) rather than by exact section-heading copy, since
 * that copy is an open product/design question (spec §10) not yet decided.
 *
 * `WishlistProductCard` and `WishlistEntryCard` are both mocked as thin
 * stubs — this file tests CatalogScreen's WIRING (which store feeds which
 * section, which callback fires on which action), not either card's own
 * internal rendering (covered by WishlistEntryCard.test.tsx and existing
 * WishlistProductCard usage elsewhere).
 *
 * **Story 9 addition (2026-08-27):** `CatalogScreen.tsx`'s
 * `onCardPress={() => {}}` on `WishlistEntryCard` — flagged as intentionally
 * inert by the first-slice tech-lead review, since no detail screen existed
 * yet — is replaced by FE-23 with real navigation to the new
 * `WishlistEntryDetail` route. The `WishlistEntryCard` mock below is
 * EXTENDED (not replaced) to also capture `onCardPress`, alongside its two
 * pre-existing `onDelete`/`onPromote` pressables/testIDs, which are
 * untouched — every pre-existing assertion in this file keeps passing
 * unmodified.
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
      <Pressable onPress={onPress} testID={testID ?? 'btn'}>
        <Text>{children}</Text>
      </Pressable>
    ),
  };
});

jest.mock('@/components/ui/core/Card', () => {
  const { Pressable } = require('react-native');
  return {
    Card: ({ onPress, children }: any) => <Pressable onPress={onPress}>{children}</Pressable>,
  };
});
jest.mock('@/components/ui/core/IconButton', () => {
  const { Pressable } = require('react-native');
  return {
    IconButton: ({ onPress, label }: any) => (
      <Pressable onPress={onPress} accessibilityLabel={label} />
    ),
  };
});
jest.mock('@/components/ui/core/Tag', () => {
  const { Text } = require('react-native');
  return { Tag: ({ children }: any) => <Text>{children}</Text> };
});
jest.mock('@/components/ui/forms/Input', () => {
  const { TextInput } = require('react-native');
  return { Input: (props: any) => <TextInput testID="catalog-search-input" {...props} /> };
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

// NOTE: this project's `@/*` jest moduleNameMapper cannot resolve ANY
// mock (real or virtual) for a path with no file on disk (verified
// precedent: tests/inci-attribution-highlighting/DetectedActiveBadgeWiring
// .test.tsx NOTE 2). So this whole suite fails to even resolve until
// FE-5 (src/store/wishlistStore.ts) AND FE-7
// (src/components/product/WishlistEntryCard.tsx) both exist — expected,
// not a bug here.
jest.mock('@/components/product/WishlistProductCard', () => {
  const { View, Text } = require('react-native');
  return {
    WishlistProductCard: ({ product }: any) => (
      <View testID="wishlist-product-card">
        <Text>{product.name}</Text>
      </View>
    ),
  };
});

jest.mock('@/components/product/WishlistEntryCard', () => {
  const { View, Pressable, Text } = require('react-native');
  return {
    // onCardPress capture added (Story 9, FE-23 regression) alongside the
    // pre-existing onDelete/onPromote pressables — this mock's shape is
    // EXTENDED, not replaced; the two pre-existing pressables/testIDs below
    // are untouched so every pre-existing assertion in this file keeps
    // passing unmodified.
    WishlistEntryCard: ({ entry, onCardPress, onDelete, onPromote }: any) => (
      <View testID="wishlist-entry-card">
        <Text>{entry.name}</Text>
        <Pressable testID={`entry-card-press-${entry.id}`} onPress={() => onCardPress(entry)} />
        <Pressable testID={`entry-delete-${entry.id}`} onPress={() => onDelete(entry)} />
        <Pressable testID={`entry-promote-${entry.id}`} onPress={() => onPromote(entry)} />
      </View>
    ),
  };
});

jest.mock('@/constants/tokens', () => ({
  colors: new Proxy({}, { get: () => '#000' }),
  space: new Proxy({}, { get: () => 8 }),
  typography: new Proxy({}, { get: () => ({}) }),
  radius: new Proxy({}, { get: () => 8 }),
  palette: { white: '#fff', black: '#000' },
  shadow: new Proxy({}, { get: () => ({}) }),
}));

const mockUpdateProduct = jest.fn();
const mockRemoveProduct = jest.fn();
const identifiedWishlistProduct = {
  id: 'p-wishlist-1',
  name: 'Fully Identified Wishlist Product',
  brand: 'Known Brand',
  productType: 'serum',
  imageUrl: null,
  activeIngredients: [],
  activeTags: [],
  fullIngredientText: null,
  usageTime: 'both',
  openBeautyFactsId: null,
  addedAt: '2026-01-01',
  notes: null,
  openedDate: null,
  paoMonths: null,
  status: 'wishlist',
};

jest.mock('@/store/productsStore', () => ({
  useProductsStore: jest.fn((selector: any) =>
    selector({
      products: [identifiedWishlistProduct],
      updateProduct: mockUpdateProduct,
      removeProduct: mockRemoveProduct,
    }),
  ),
}));

jest.mock('@/store/routinesStore', () => ({
  useRoutinesStore: jest.fn((selector: any) =>
    selector({ routines: [], removeProductStep: jest.fn() }),
  ),
}));

const mockRemoveEntry = jest.fn();
const wishlistEntry = {
  id: 'wishlist-entry-1',
  brand: 'Some Brand',
  name: 'Some Explored Serum',
  category: 'serum',
  rawIngredientsText: 'Aqua, Niacinamide',
  parsedIngredientIds: ['niacinamide'],
  sourceFlow: 'explore_composition',
  createdAt: '2026-08-01T00:00:00.000Z',
};

jest.mock('@/store/wishlistStore', () => ({
  useWishlistStore: jest.fn((selector: any) =>
    selector({ entries: [wishlistEntry], removeEntry: mockRemoveEntry }),
  ),
}));

import CatalogScreen from '@/screens/CatalogScreen';
import { makeNavigation } from './fixtures';

function renderScreen() {
  const navigation = makeNavigation();
  render(<CatalogScreen navigation={navigation} route={{} as any} />);
  return navigation as { navigate: jest.Mock };
}

function goToWishlistTab() {
  fireEvent.press(screen.getByText(/Wishlist ·/));
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Assumption 5: WishlistEntry rows render as a distinct section, not merged', () => {
  it('renders both the existing WishlistProductCard AND the new WishlistEntryCard in the Wishlist tab', () => {
    renderScreen();
    goToWishlistTab();

    expect(screen.getByTestId('wishlist-product-card')).toBeTruthy();
    expect(screen.getByTestId('wishlist-entry-card')).toBeTruthy();
    expect(screen.getByText('Fully Identified Wishlist Product')).toBeTruthy();
    expect(screen.getByText('Some Explored Serum')).toBeTruthy();
  });

  it('renders the two card types as visually/structurally distinct items, not one merged card type', () => {
    renderScreen();
    goToWishlistTab();

    const productCards = screen.getAllByTestId('wishlist-product-card');
    const entryCards = screen.getAllByTestId('wishlist-entry-card');
    expect(productCards).toHaveLength(1);
    expect(entryCards).toHaveLength(1);
  });
});

describe('Wishlist entry delete: no confirmation, and never through DeleteProductModal', () => {
  it('calls wishlistStore.removeEntry directly on Delete, never productsStore.removeProduct', () => {
    renderScreen();
    goToWishlistTab();

    fireEvent.press(screen.getByTestId('entry-delete-wishlist-entry-1'));

    expect(mockRemoveEntry).toHaveBeenCalledWith('wishlist-entry-1');
    expect(mockRemoveProduct).not.toHaveBeenCalled();
  });
});

describe('"Move to Shelf" navigates to the shared completion form, pre-filled', () => {
  it('navigates to ManualProductForm with an explorePrefill built from the entry, including its wishlistEntryId', () => {
    const navigation = renderScreen();
    goToWishlistTab();

    fireEvent.press(screen.getByTestId('entry-promote-wishlist-entry-1'));

    expect(navigation.navigate).toHaveBeenCalledWith('ManualProductForm', {
      explorePrefill: expect.objectContaining({
        brand: 'Some Brand',
        name: 'Some Explored Serum',
        category: 'serum',
        rawIngredientsText: 'Aqua, Niacinamide',
        activeKeys: ['niacinamide'],
        wishlistEntryId: 'wishlist-entry-1',
      }),
    });
  });
});

// ── Story 9 / FE-23: onCardPress regression ───────────────────────────────────
//
// Previously `onCardPress={() => {}}` — an intentionally inert no-op flagged
// by the first-slice tech-lead review, since no detail screen existed yet.
// Now that `WishlistEntryDetailScreen` exists (Story 9), tapping the card
// must navigate there instead of silently doing nothing.
describe('Story 9: tapping the WishlistEntryCard now navigates to WishlistEntryDetail, no longer a no-op', () => {
  it('navigates to WishlistEntryDetail with { wishlistEntryId } when the card is pressed', () => {
    const navigation = renderScreen();
    goToWishlistTab();

    fireEvent.press(screen.getByTestId('entry-card-press-wishlist-entry-1'));

    expect(navigation.navigate).toHaveBeenCalledWith('WishlistEntryDetail', {
      wishlistEntryId: 'wishlist-entry-1',
    });
  });

  it('never navigates to the pre-existing ProductDetail screen for a bare WishlistEntry (distinct entity, distinct screen)', () => {
    const navigation = renderScreen();
    goToWishlistTab();

    fireEvent.press(screen.getByTestId('entry-card-press-wishlist-entry-1'));

    expect(navigation.navigate).not.toHaveBeenCalledWith(
      'ProductDetail',
      expect.anything(),
    );
  });
});
