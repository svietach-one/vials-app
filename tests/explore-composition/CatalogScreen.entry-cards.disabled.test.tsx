/**
 * Component tests — CatalogScreen's entry row, EXPLORE_COMPOSITION_ENABLED OFF
 * (the shipped default per tech design §5).
 * Spec: docs/specs/explore-composition.md §5
 * Tech design: docs/tech-design/explore-composition.md §3 FE-8
 *
 * Regression guard: with the flag off, "Explore new" must keep routing
 * exactly like it does today — CaptureFlow with initialStatus: 'wishlist' —
 * so shipping FE-1..FE-8 behind a default-off flag never changes production
 * behavior until product/design sign off (spec §10).
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
      <Pressable onPress={onPress} testID={testID ?? 'btn'} accessibilityRole="button">
        <Text>{children}</Text>
      </Pressable>
    ),
  };
});

jest.mock('@/components/ui/core/Card', () => {
  const { Pressable } = require('react-native');
  return {
    Card: ({ onPress, children, style }: any) => (
      <Pressable onPress={onPress} testID="catalog-card" style={style}>
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

function renderScreen() {
  const navigation = makeNavigation();
  render(<CatalogScreen navigation={navigation} route={{} as any} />);
  return navigation as { navigate: jest.Mock };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('flag off: entry row is unaffected by this feature', () => {
  it('still navigates "Explore new" to CaptureFlow with initialStatus: "wishlist"', () => {
    const navigation = renderScreen();
    fireEvent.press(screen.getByText('Explore new'));
    expect(navigation.navigate).toHaveBeenCalledWith('CaptureFlow', { initialStatus: 'wishlist' });
  });

  it('still navigates "Add new" to AddProductHub', () => {
    const navigation = renderScreen();
    fireEvent.press(screen.getByText('Add new'));
    expect(navigation.navigate).toHaveBeenCalledWith('AddProductHub');
  });

  it('never navigates to the new ExploreCompositionCapture screen', () => {
    const navigation = renderScreen();
    fireEvent.press(screen.getByText('Explore new'));
    expect(navigation.navigate).not.toHaveBeenCalledWith(
      'ExploreCompositionCapture',
      expect.anything(),
    );
  });
});
