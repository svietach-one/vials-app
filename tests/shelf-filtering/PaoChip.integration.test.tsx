/**
 * Integration tests — PaoChip sub-component (shelf-filtering feature)
 *
 * PaoChip is defined as a module-level function inside CatalogScreen.tsx and
 * cannot be imported in isolation. These tests render the full CatalogScreen
 * with a single controlled product and assert on the chip text that appears
 * (or does not appear) in the rendered output.
 *
 * "Today" is pinned to 2026-06-27T12:00:00.000Z via jest fake timers for all
 * tests so date arithmetic is deterministic and independent of when the suite runs.
 *
 * Covers:
 *   SF-PAO-1  Chip shows "Expires in 5d" when daysRemaining = 5
 *   SF-PAO-2  Chip shows "Expires today" when daysRemaining = 0
 *   SF-PAO-3  Chip shows "Expired" when daysRemaining = -1 (already past expiry)
 *   SF-PAO-4  No chip when paoMonths is null
 *   SF-PAO-5  No chip when openedDate is null
 *   SF-PAO-6  No chip when daysRemaining = 31 (outside the 30-day warning window)
 */

// Must appear before any import that triggers the native-module chain.
jest.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve()),
  },
  __esModule: true,
}));

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { Product } from '@/types';

// ── Store mocks ────────────────────────────────────────────────────────────────

const mockUpdateProduct = jest.fn();
const mockRemoveProduct = jest.fn();
let mockProductList: Product[] = [];

jest.mock('@/store/productsStore', () => ({
  useProductsStore: jest.fn((selector: any) =>
    selector({
      products: mockProductList,
      updateProduct: mockUpdateProduct,
      removeProduct: mockRemoveProduct,
    }),
  ),
}));

jest.mock('@/store/routinesStore', () => ({
  useRoutinesStore: jest.fn((selector: any) =>
    selector({ routines: [] }),
  ),
}));

// ── Navigation mock ────────────────────────────────────────────────────────────

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: jest.fn(),
}));

// ── Icon mock ─────────────────────────────────────────────────────────────────

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return {
    Feather: ({ name, testID }: { name: string; testID?: string }) => (
      <View testID={testID ?? `feather-icon-${name}`} />
    ),
  };
});

// ── Design tokens mock ────────────────────────────────────────────────────────

jest.mock('@/constants/tokens', () => ({
  colors: {
    bgBase: '#F5F2EB',
    textPrimary: '#2F4F4F',
    textSecondary: '#6B7280',
    textTertiary: '#9CA3AF',
    textOnDark: '#FFFFFF',
    borderDivider: '#E5E2D8',
    borderStrong: '#C8C4BA',
    surfaceCard: '#FFFFFF',
    surfaceRaised: '#FAFAF8',
    surfaceSunken: '#EDE9DF',
    statusSOS: '#DC2626',
  },
  space: new Proxy({} as Record<string | number, number>, {
    get: (_: any, key: string | symbol) => (key === 'gutterScreen' ? 16 : 8),
  }),
  typography: new Proxy({}, { get: () => ({}) }),
  radius: new Proxy({}, { get: () => 8 }),
  palette: { white: '#FFFFFF', black: '#000000' },
}));

jest.mock('@/constants/labels', () => ({
  ACTIVE_INGREDIENT_LABELS: {},
  PRODUCT_TYPE_LABELS: { serum: 'Serum', moisturizer: 'Moisturizer' },
}));

// ── UI component stubs ────────────────────────────────────────────────────────

jest.mock('@/components/product/DeleteProductModal', () => ({
  DeleteProductModal: () => null,
}));

jest.mock('@/components/product/ProductActionSheet', () => ({
  ProductActionSheet: () => null,
}));

jest.mock('@/components/catalog/CatalogFilterTrigger', () => ({
  CatalogFilterTrigger: () => null,
}));

jest.mock('@/components/catalog/FilterSheet', () => ({
  FilterSheet: () => null,
}));

jest.mock('@/components/ui/core/Button', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({ onPress, children }: any) => (
      <Pressable onPress={onPress}>
        <Text>{children}</Text>
      </Pressable>
    ),
  };
});

jest.mock('@/components/ui/core/Card', () => {
  const { Pressable } = require('react-native');
  return {
    Card: ({ children, style }: any) => (
      <Pressable testID="catalog-card" style={style}>
        {children}
      </Pressable>
    ),
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
  return {
    Tag: ({ children }: any) => <Text>{children}</Text>,
  };
});

jest.mock('@/components/ui/forms/Input', () => {
  const { TextInput } = require('react-native');
  return {
    Input: ({ value, onChangeText, placeholder }: any) => (
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} />
    ),
  };
});

// ── Subject under test ────────────────────────────────────────────────────────

import CatalogScreen from '@/screens/CatalogScreen';

// ── Product fixture factory ───────────────────────────────────────────────────

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: 'p-pao-test',
    name: 'Test Product',
    brand: null,
    productType: 'serum',
    imageUrl: null,
    activeIngredients: [],
    activeTags: [],
    fullIngredientText: null,
    usageTime: 'morning',
    openBeautyFactsId: null,
    addedAt: '2026-01-01',
    notes: null,
    openedDate: null,
    paoMonths: null,
    ...overrides,
  };
}

// ── Screen render helper ──────────────────────────────────────────────────────

function renderScreen() {
  return render(
    <CatalogScreen
      navigation={{ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() } as any}
      route={{} as any}
    />,
  );
}

// ── Setup / teardown ──────────────────────────────────────────────────────────
//
// All tests pin "today" to 2026-06-27 so PAO calculations are deterministic.

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-06-27T12:00:00.000Z'));
});

afterEach(() => {
  jest.useRealTimers();
});

// ── SF-PAO-1: "Expires in 5d" ─────────────────────────────────────────────────

describe('SF-PAO-1: chip shows "Expires in 5d" when 5 days remain until expiry', () => {
  it('should render the text "Expires in 5d" on the product card', () => {
    // today=2026-06-27, opened=2026-06-02 (25 days ago), paoMonths=1
    // expiry = 2026-06-02 + 1 month = 2026-07-02
    // daysRemaining = ceil((July 2 - June 27) / ms_per_day) = 5
    mockProductList = [
      makeProduct({ openedDate: '2026-06-02', paoMonths: 1 }),
    ];
    renderScreen();
    expect(screen.getByText('Expires in 5d')).toBeTruthy();
  });
});

// ── SF-PAO-2: "Expires today" ─────────────────────────────────────────────────

describe('SF-PAO-2: chip shows "Expires today" when daysRemaining is 0', () => {
  it('should render the text "Expires today" on the product card', () => {
    // today=2026-06-27, opened=2026-05-27, paoMonths=1
    // expiry = 2026-05-27 + 1 month = 2026-06-27
    // daysRemaining = ceil((June 27 - June 27) / ms_per_day) = 0
    mockProductList = [
      makeProduct({ openedDate: '2026-05-27', paoMonths: 1 }),
    ];
    renderScreen();
    expect(screen.getByText('Expires today')).toBeTruthy();
  });
});

// ── SF-PAO-3: "Expired" ───────────────────────────────────────────────────────

describe('SF-PAO-3: chip shows "Expired" when daysRemaining is negative', () => {
  it('should render the text "Expired" on the product card', () => {
    // today=2026-06-27, opened=2026-05-26, paoMonths=1
    // expiry = 2026-05-26 + 1 month = 2026-06-26
    // daysRemaining = ceil((June 26 - June 27) / ms_per_day) = -1
    mockProductList = [
      makeProduct({ openedDate: '2026-05-26', paoMonths: 1 }),
    ];
    renderScreen();
    expect(screen.getByText('Expired')).toBeTruthy();
  });
});

// ── SF-PAO-4: No chip when paoMonths is null ──────────────────────────────────

describe('SF-PAO-4: no chip rendered when paoMonths is null', () => {
  it('should not render any expiry label when the product has no paoMonths value', () => {
    mockProductList = [
      makeProduct({ openedDate: '2026-06-02', paoMonths: null }),
    ];
    renderScreen();
    expect(screen.queryByText(/Expires/)).toBeNull();
    expect(screen.queryByText('Expired')).toBeNull();
  });
});

// ── SF-PAO-5: No chip when openedDate is null ─────────────────────────────────

describe('SF-PAO-5: no chip rendered when openedDate is null', () => {
  it('should not render any expiry label when the product has no openedDate value', () => {
    mockProductList = [
      makeProduct({ openedDate: null, paoMonths: 1 }),
    ];
    renderScreen();
    expect(screen.queryByText(/Expires/)).toBeNull();
    expect(screen.queryByText('Expired')).toBeNull();
  });
});

// ── SF-PAO-6: No chip when 31+ days remain ────────────────────────────────────

describe('SF-PAO-6: no chip rendered when 31 or more days remain until expiry', () => {
  it('should not render any expiry label when the product has 31 days remaining', () => {
    // today=2026-06-27, opened=2026-04-28 (60 days ago), paoMonths=3
    // expiry = 2026-04-28 + 3 months = 2026-07-28
    // daysRemaining = ceil((July 28 - June 27) / ms_per_day) = 31
    // isExpiringSoon = 31 <= 30 = false -> no chip
    mockProductList = [
      makeProduct({ openedDate: '2026-04-28', paoMonths: 3 }),
    ];
    renderScreen();
    expect(screen.queryByText(/Expires/)).toBeNull();
    expect(screen.queryByText('Expired')).toBeNull();
  });
});
