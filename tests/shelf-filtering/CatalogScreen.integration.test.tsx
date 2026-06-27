/**
 * Integration tests — CatalogScreen (shelf-filtering feature)
 *
 * Covers:
 *   SF-CS-1   Default state: all products rendered when no filters are active
 *   SF-CS-2   Category filter "Serums": only serum/essence/ampoule products appear
 *   SF-CS-3   Category deselect: pressing already-selected pill reverts to All
 *   SF-CS-4   Biomarker "Actives": only products with retinol/aha/bha/vitamin_c/benzoyl_peroxide
 *   SF-CS-5   AND combination: Serums + Actives narrows to serum products with actives
 *   SF-CS-6   Empty state (empty catalog): shows "Your catalog is empty"
 *   SF-CS-7   Empty state (filters no match): shows "No products match the current filters"
 *   SF-CS-8   Search query: typing narrows list by product name
 *   SF-CS-9   PAO chip visible: product expiring within 30 days renders "Expires in Xd" label
 *   SF-CS-10  PAO chip hidden: product with 31+ days remaining renders no PAO label
 *
 * Mock strategy: follows tests/catalog/hide-product.test.tsx — the most complete existing
 * reference that correctly mocks routinesStore + AsyncStorage.
 * The real CatalogFilterHeader sub-component is NOT mocked so pill interactions
 * exercise the actual integration path.
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
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
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
  ACTIVE_INGREDIENT_LABELS: {
    retinol: 'Retinol',
    aha: 'AHA',
    bha: 'BHA',
    vitamin_c: 'Vitamin C',
    niacinamide: 'Niacinamide',
    copper_peptides: 'Copper Peptides',
    benzoyl_peroxide: 'Benzoyl Peroxide',
    spf_chemical: 'SPF (Chemical)',
  },
  PRODUCT_TYPE_LABELS: {
    serum: 'Serum',
    moisturizer: 'Moisturizer',
    spf: 'SPF',
    essence: 'Essence',
    ampoule: 'Ampoule',
    toner: 'Toner',
    cleanser: 'Cleanser',
  },
}));

// ── UI component stubs ────────────────────────────────────────────────────────

jest.mock('@/components/product/DeleteProductModal', () => ({
  DeleteProductModal: () => null,
}));

jest.mock('@/components/product/ProductActionSheet', () => ({
  ProductActionSheet: () => null,
}));

jest.mock('@/components/ui/core/Button', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({ onPress, children }: any) => (
      <Pressable onPress={onPress} testID="btn">
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
      <Pressable onPress={onPress} accessibilityLabel={label} />
    ),
  };
});

jest.mock('@/components/ui/core/Tag', () => {
  const { Text } = require('react-native');
  return {
    Tag: ({ children }: any) => <Text testID="product-type-tag">{children}</Text>,
  };
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

// ── Subject under test ────────────────────────────────────────────────────────

import CatalogScreen from '@/screens/CatalogScreen';

// ── Product fixture factory ───────────────────────────────────────────────────

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: 'p-default',
    name: 'Default Product',
    brand: 'Brand',
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

const SERUM_WITH_RETINOL = makeProduct({
  id: 'p-sr',
  name: 'Retinol Night Serum',
  brand: 'Medik8',
  productType: 'serum',
  activeTags: ['retinol'],
});

const SERUM_SOOTHING = makeProduct({
  id: 'p-ss',
  name: 'Niacinamide Serum',
  brand: 'The Ordinary',
  productType: 'serum',
  activeTags: ['niacinamide'],
});

const MOISTURIZER_AHA = makeProduct({
  id: 'p-ma',
  name: 'AHA Glow Cream',
  brand: 'Sunday Riley',
  productType: 'moisturizer',
  activeTags: ['aha'],
});

const SPF_PRODUCT = makeProduct({
  id: 'p-spf',
  name: 'Ultra Light SPF50',
  brand: 'Altruist',
  productType: 'spf',
  activeTags: [],
});

const ALL_PRODUCTS = [SERUM_WITH_RETINOL, SERUM_SOOTHING, MOISTURIZER_AHA, SPF_PRODUCT];

// ── Screen render helper ──────────────────────────────────────────────────────

const mockNavigate = jest.fn();
const mockSetOptions = jest.fn();
const mockGoBack = jest.fn();

function renderScreen() {
  return render(
    <CatalogScreen
      navigation={{ navigate: mockNavigate, goBack: mockGoBack, setOptions: mockSetOptions } as any}
      route={{} as any}
    />,
  );
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockProductList = [...ALL_PRODUCTS];
});

// ── SF-CS-1: Default state ────────────────────────────────────────────────────

describe('SF-CS-1: default state renders all products when no filters are active', () => {
  it('should render all product names from the store on initial load', () => {
    renderScreen();
    expect(screen.getByText('Retinol Night Serum')).toBeTruthy();
    expect(screen.getByText('Niacinamide Serum')).toBeTruthy();
    expect(screen.getByText('AHA Glow Cream')).toBeTruthy();
    expect(screen.getByText('Ultra Light SPF50')).toBeTruthy();
  });
});

// ── SF-CS-2: Category filter "Serums" ────────────────────────────────────────

describe('SF-CS-2: pressing "Serums" pill shows only serum-type products', () => {
  it('should still show serum products after pressing the Serums filter pill', async () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Filter by Serums'));
    await waitFor(() => {
      expect(screen.getByText('Retinol Night Serum')).toBeTruthy();
      expect(screen.getByText('Niacinamide Serum')).toBeTruthy();
    });
  });

  it('should hide moisturizer and SPF products after pressing the Serums filter pill', async () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Filter by Serums'));
    await waitFor(() => {
      expect(screen.queryByText('AHA Glow Cream')).toBeNull();
      expect(screen.queryByText('Ultra Light SPF50')).toBeNull();
    });
  });
});

// ── SF-CS-3: Category deselect ────────────────────────────────────────────────

describe('SF-CS-3: pressing the already-selected category pill reverts to showing all products', () => {
  it('should restore all products after pressing the Serums pill a second time', async () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Filter by Serums'));
    await waitFor(() => expect(screen.queryByText('Ultra Light SPF50')).toBeNull());
    fireEvent.press(screen.getByLabelText('Filter by Serums'));
    await waitFor(() => {
      expect(screen.getByText('AHA Glow Cream')).toBeTruthy();
      expect(screen.getByText('Ultra Light SPF50')).toBeTruthy();
      expect(screen.getByText('Retinol Night Serum')).toBeTruthy();
    });
  });
});

// ── SF-CS-4: Biomarker "Actives" ─────────────────────────────────────────────

describe('SF-CS-4: pressing "Actives" badge shows only products with actives ingredient tags', () => {
  it('should show products tagged with retinol or aha after pressing Actives', async () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Filter by Actives'));
    await waitFor(() => {
      expect(screen.getByText('Retinol Night Serum')).toBeTruthy();
      expect(screen.getByText('AHA Glow Cream')).toBeTruthy();
    });
  });

  it('should hide the soothing serum and the SPF product after pressing Actives', async () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Filter by Actives'));
    await waitFor(() => {
      expect(screen.queryByText('Niacinamide Serum')).toBeNull();
      expect(screen.queryByText('Ultra Light SPF50')).toBeNull();
    });
  });
});

// ── SF-CS-5: AND combination (Serums + Actives) ───────────────────────────────

describe('SF-CS-5: selecting Serums and Actives together applies AND logic', () => {
  it('should show the serum with retinol when both Serums and Actives are active', async () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Filter by Serums'));
    fireEvent.press(screen.getByLabelText('Filter by Actives'));
    await waitFor(() => {
      expect(screen.getByText('Retinol Night Serum')).toBeTruthy();
    });
  });

  it('should hide the soothing serum, the moisturizer, and the SPF product when Serums + Actives are both selected', async () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Filter by Serums'));
    fireEvent.press(screen.getByLabelText('Filter by Actives'));
    await waitFor(() => {
      expect(screen.queryByText('Niacinamide Serum')).toBeNull();
      expect(screen.queryByText('AHA Glow Cream')).toBeNull();
      expect(screen.queryByText('Ultra Light SPF50')).toBeNull();
    });
  });
});

// ── SF-CS-6: Empty state — no products in catalog ─────────────────────────────

describe('SF-CS-6: empty catalog state when the store contains no products', () => {
  beforeEach(() => {
    mockProductList = [];
  });

  it('should render "Your catalog is empty" when the store is empty', () => {
    renderScreen();
    expect(screen.getByText('Your catalog is empty')).toBeTruthy();
  });

  it('should render the "Add Product" call-to-action in the empty state', () => {
    renderScreen();
    expect(screen.getByText('Add Product')).toBeTruthy();
  });
});

// ── SF-CS-7: Empty state — filters produce no results ─────────────────────────

describe('SF-CS-7: filter-empty state when active filters match no products', () => {
  beforeEach(() => {
    // Only an SPF product; filtering by Serums will yield zero results.
    mockProductList = [SPF_PRODUCT];
  });

  it('should render "No products match the current filters" when the filter combination produces zero results', async () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Filter by Serums'));
    await waitFor(() => {
      expect(screen.getByText('No products match the current filters')).toBeTruthy();
    });
  });

  it('should NOT render the "Add Product" button when filters produce zero results', async () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Filter by Serums'));
    await waitFor(() => {
      expect(screen.queryByText('Add Product')).toBeNull();
    });
  });
});

// ── SF-CS-8: Search query ─────────────────────────────────────────────────────

describe('SF-CS-8: typing in the search input narrows the product list by name', () => {
  it('should show only the product whose name matches the search query', async () => {
    renderScreen();
    fireEvent.changeText(screen.getByTestId('catalog-search-input'), 'Ultra');
    await waitFor(() => {
      expect(screen.getByText('Ultra Light SPF50')).toBeTruthy();
      expect(screen.queryByText('Retinol Night Serum')).toBeNull();
      expect(screen.queryByText('Niacinamide Serum')).toBeNull();
      expect(screen.queryByText('AHA Glow Cream')).toBeNull();
    });
  });

  it('should show "No products match the current filters" when the search query has no hits', async () => {
    renderScreen();
    fireEvent.changeText(screen.getByTestId('catalog-search-input'), 'zzznomatch');
    await waitFor(() => {
      expect(screen.getByText('No products match the current filters')).toBeTruthy();
    });
  });
});

// ── SF-CS-9 & SF-CS-10: PAO chip visibility ───────────────────────────────────
//
// Fake timers pin "today" to 2026-06-27 so date arithmetic is deterministic.

describe('SF-CS-9 / SF-CS-10: PAO expiry chip shows or hides based on days remaining', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-27T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should render the "Expires in 5d" label when the product expires in 5 days', () => {
    // opened=2026-06-02 (25 days before today), paoMonths=1 -> expiry=2026-07-02 -> daysRemaining=5
    mockProductList = [
      makeProduct({
        id: 'p-pao-soon',
        name: 'Expiring Soon Serum',
        productType: 'serum',
        openedDate: '2026-06-02',
        paoMonths: 1,
      }),
    ];
    renderScreen();
    expect(screen.getByText('Expires in 5d')).toBeTruthy();
  });

  it('should NOT render any expiry label when the product has 31 days remaining', () => {
    // opened=2026-04-28 (60 days before today), paoMonths=3 -> expiry=2026-07-28 -> daysRemaining=31
    mockProductList = [
      makeProduct({
        id: 'p-pao-safe',
        name: 'Safe Moisturizer',
        productType: 'moisturizer',
        openedDate: '2026-04-28',
        paoMonths: 3,
      }),
    ];
    renderScreen();
    expect(screen.queryByText(/Expires/)).toBeNull();
    expect(screen.queryByText('Expired')).toBeNull();
  });
});
