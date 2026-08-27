/**
 * Component tests — CatalogScreen's Wishlist tab, EXPLORE_COMPOSITION_ENABLED
 * OFF (the shipped default per tech design §5).
 * Spec: docs/specs/explore-composition.md §10
 * Tech design: docs/tech-design/explore-composition.md §3 FE-7, §4 Assumption 5
 *
 * Regression guard: even if `wishlistStore` already holds entries (e.g. a
 * dev build flips the flag back and forth), the Wishlist tab must render
 * exactly like it does today while the flag is off — no WishlistEntryCard
 * section, no wishlistStore reads driving anything on screen.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('@/constants/featureFlags', () => ({
  ...jest.requireActual('@/constants/featureFlags'),
  EXPLORE_COMPOSITION_ENABLED: false,
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
  const { View, Text } = require('react-native');
  return {
    WishlistEntryCard: ({ entry }: any) => (
      <View testID="wishlist-entry-card">
        <Text>{entry.name}</Text>
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
      updateProduct: jest.fn(),
      removeProduct: jest.fn(),
    }),
  ),
}));

jest.mock('@/store/routinesStore', () => ({
  useRoutinesStore: jest.fn((selector: any) =>
    selector({ routines: [], removeProductStep: jest.fn() }),
  ),
}));

// Entries exist in the store, but the flag is off — they must never surface.
const mockUseWishlistStore = jest.fn((selector: any) =>
  selector({
    entries: [
      {
        id: 'wishlist-entry-1',
        brand: 'Some Brand',
        name: 'Some Explored Serum',
        category: 'serum',
        rawIngredientsText: 'Aqua, Niacinamide',
        parsedIngredientIds: ['niacinamide'],
        sourceFlow: 'explore_composition',
        createdAt: '2026-08-01T00:00:00.000Z',
      },
    ],
    removeEntry: jest.fn(),
  }),
);
jest.mock('@/store/wishlistStore', () => ({
  useWishlistStore: (selector: any) => mockUseWishlistStore(selector),
}));

import CatalogScreen from '@/screens/CatalogScreen';
import { makeNavigation } from './fixtures';

function renderScreen() {
  render(<CatalogScreen navigation={makeNavigation()} route={{} as any} />);
}

function goToWishlistTab() {
  fireEvent.press(screen.getByText(/Wishlist ·/));
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('flag off: Wishlist tab is unaffected by this feature', () => {
  it('renders the existing WishlistProductCard but no WishlistEntryCard section', () => {
    renderScreen();
    goToWishlistTab();

    expect(screen.getByTestId('wishlist-product-card')).toBeTruthy();
    expect(screen.queryByTestId('wishlist-entry-card')).toBeNull();
    expect(screen.queryByText('Some Explored Serum')).toBeNull();
  });
});
