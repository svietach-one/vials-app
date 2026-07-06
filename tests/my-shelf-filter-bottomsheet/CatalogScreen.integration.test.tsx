/**
 * Integration tests — CatalogScreen wired to CatalogFilterTrigger + FilterSheet
 * (FE-13-6, not yet implemented).
 * Spec: docs/specs/my-shelf-filter-bottomsheet.md — Stories 1, 2, 3
 * Tech design: docs/tech-design/my-shelf-filter-bottomsheet.md §1, §3 (FE-13-6)
 *
 * Covers, at the full-screen level (complementing the isolated component
 * suites in CatalogFilterTrigger.test.tsx and FilterSheet.test.tsx):
 *   FE13-CS-1  No badge on the trigger when no filters are active (Story 1 AC1)
 *   FE13-CS-2  Badge appears on the trigger once a filter is committed (Story 1 AC2)
 *   FE13-CS-3  Reopening the sheet after a commit still shows that committed
 *              selection, not a fresh default (Story 1 AC3, full round trip)
 *   FE13-CS-4  Selecting a Product Type + benefit and tapping Apply narrows the
 *              visible shelf list (Story 2 AC1-3 wired end to end)
 *   FE13-CS-5  Dismissing the sheet without tapping Apply leaves the shelf list
 *              and the badge unchanged (Story 2 AC5)
 *   FE13-CS-6  Clear All + Apply restores the full catalog and removes the badge
 *              (Story 3 AC2-3)
 *   FE13-CS-7  Empty-catalog state still renders "Your catalog is empty"
 *              (regression — hasActiveFilters now reads selectedBenefits)
 *   FE13-CS-8  Filters-produce-no-match state renders the existing empty-filter
 *              copy (regression — same hasActiveFilters field rename)
 *
 * Mock strategy follows tests/catalog/hide-product.test.tsx (AsyncStorage +
 * routinesStore mocked) and tests/shelf-filtering/CatalogScreen.integration.test.tsx
 * (same UI-atom stubs), extended with the @gorhom/bottom-sheet + safe-area-context
 * mocks FilterSheet now requires. CatalogFilterTrigger and FilterSheet themselves
 * are NOT mocked, so their real logic is exercised end to end through CatalogScreen.
 *
 * Until FE-13-1..FE-13-7 land, this file fails at import/render time (missing
 * `selectedBenefits` field, missing `CatalogFilterTrigger`/`FilterSheet` modules,
 * `CatalogScreen` still importing the now-deleted `CatalogFilterHeader`) —
 * expected TDD red state, see progress/my-shelf-filter-bottomsheet.md.
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
  useRoutinesStore: jest.fn((selector: any) => selector({ routines: [] })),
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

// ── Safe area + bottom sheet mocks (required transitively by FilterSheet) ────

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

jest.mock('@gorhom/bottom-sheet', () => {
  const ReactActual = require('react');
  const { View, Pressable } = require('react-native');
  const BottomSheetModal = ReactActual.forwardRef(
    (
      { children, onDismiss }: { children: React.ReactNode; onDismiss?: () => void },
      ref: React.Ref<unknown>,
    ) => {
      ReactActual.useImperativeHandle(ref, () => ({
        present: () => {},
        dismiss: () => onDismiss?.(),
      }));
      return (
        <View>
          <Pressable testID="mock-bottom-sheet-backdrop" onPress={() => onDismiss?.()} />
          {children}
        </View>
      );
    },
  );
  const BottomSheetScrollView = ({ children }: { children: React.ReactNode }) => <View>{children}</View>;
  const BottomSheetFlatList = ({ data, renderItem, ListEmptyComponent }: any) => (
    <View>
      {data && data.length > 0
        ? data.map((item: any, index: number) => <View key={index}>{renderItem({ item, index })}</View>)
        : ListEmptyComponent}
    </View>
  );
  const BottomSheetBackdrop = () => null;
  return { BottomSheetModal, BottomSheetScrollView, BottomSheetFlatList, BottomSheetBackdrop };
});

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
      <Pressable onPress={onPress}>
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
    IconButton: ({ onPress, label }: any) => <Pressable onPress={onPress} accessibilityLabel={label} />,
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

const RETINOID_SERUM = makeProduct({
  id: 'p-retinoid',
  name: 'Retinoid Renewal Serum',
  productType: 'serum',
  activeTags: ['retinoid'],
});

const NIACINAMIDE_SERUM = makeProduct({
  id: 'p-niacinamide',
  name: 'Niacinamide 10% Serum',
  productType: 'serum',
  activeTags: ['niacinamide'],
});

const HYALURONIC_MOISTURIZER = makeProduct({
  id: 'p-hyaluronic',
  name: 'Hyaluronic Acid Moisturizer',
  productType: 'moisturizer',
  activeTags: ['hyaluronic_acid'],
});

const COPPER_PEPTIDE_CLEANSER = makeProduct({
  id: 'p-copper',
  name: 'Copper Peptide Repair Cleanser',
  productType: 'cleanser',
  activeTags: ['copper_peptides'],
});

const UNTAGGED_SPF = makeProduct({
  id: 'p-spf',
  name: 'Mineral SPF50',
  productType: 'spf',
  activeTags: [],
});

const ALL_PRODUCTS = [
  RETINOID_SERUM,
  NIACINAMIDE_SERUM,
  HYALURONIC_MOISTURIZER,
  COPPER_PEPTIDE_CLEANSER,
  UNTAGGED_SPF,
];

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

function pressBackdrop() {
  fireEvent.press(screen.getByTestId('mock-bottom-sheet-backdrop'));
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockProductList = [...ALL_PRODUCTS];
});

// ── FE13-CS-1: no badge by default ────────────────────────────────────────────

describe('FE13-CS-1: the filter trigger shows no badge when no filters are active', () => {
  it('should render the trigger with the no-active-filters accessibility label', () => {
    renderScreen();
    expect(screen.getByLabelText('Open filters')).toBeTruthy();
  });
});

// ── FE13-CS-2: badge appears once a filter is committed ───────────────────────

describe('FE13-CS-2: the filter trigger shows a badge once a filter is committed via Apply', () => {
  it('should switch to the active-count accessibility label after selecting Serum and tapping Apply', async () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Open filters'));
    fireEvent.press(screen.getByLabelText('Filter by Serum'));
    fireEvent.press(screen.getByText(/Apply Filters/));

    await waitFor(() => {
      expect(screen.getByLabelText('Open filters, 1 active')).toBeTruthy();
    });
  });
});

// ── FE13-CS-3: reopening shows the committed selection ────────────────────────

describe('FE13-CS-3: reopening the sheet after a commit shows that committed selection, not a fresh default', () => {
  it('should keep the Serum chip checked when the sheet is reopened after committing it', async () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Open filters'));
    fireEvent.press(screen.getByLabelText('Filter by Serum'));
    fireEvent.press(screen.getByText(/Apply Filters/));

    await waitFor(() => expect(screen.getByLabelText('Open filters, 1 active')).toBeTruthy());

    // Reopen.
    fireEvent.press(screen.getByLabelText('Open filters, 1 active'));
    expect(screen.getByLabelText('Filter by Serum').props.accessibilityState.checked).toBe(true);
  });
});

// ── FE13-CS-4: Apply narrows the visible shelf list ───────────────────────────

describe('FE13-CS-4: selecting a Product Type + benefit and tapping Apply narrows the visible shelf list', () => {
  it('should show only the serum with a matching benefit tag after Apply', async () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Open filters'));
    fireEvent.press(screen.getByLabelText('Filter by Serum'));
    fireEvent.press(screen.getByLabelText('Filter by Exfoliation'));
    fireEvent.press(screen.getByText(/Apply Filters/));

    await waitFor(() => {
      expect(screen.getByText('Retinoid Renewal Serum')).toBeTruthy();
      expect(screen.queryByText('Niacinamide 10% Serum')).toBeNull();
      expect(screen.queryByText('Hyaluronic Acid Moisturizer')).toBeNull();
    });
  });
});

// ── FE13-CS-5: dismiss without Apply leaves the list and badge unchanged ─────

describe('FE13-CS-5: dismissing the sheet without tapping Apply leaves the shelf list and badge unchanged', () => {
  it('should keep showing every product after selecting a type but dismissing instead of applying', async () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Open filters'));
    fireEvent.press(screen.getByLabelText('Filter by Serum'));
    pressBackdrop();

    await waitFor(() => {
      expect(screen.getByText('Retinoid Renewal Serum')).toBeTruthy();
      expect(screen.getByText('Niacinamide 10% Serum')).toBeTruthy();
      expect(screen.getByText('Hyaluronic Acid Moisturizer')).toBeTruthy();
      expect(screen.getByText('Copper Peptide Repair Cleanser')).toBeTruthy();
      expect(screen.getByText('Mineral SPF50')).toBeTruthy();
    });
  });

  it('should NOT show a badge on the trigger after a dismiss-without-Apply', async () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Open filters'));
    fireEvent.press(screen.getByLabelText('Filter by Serum'));
    pressBackdrop();

    await waitFor(() => {
      expect(screen.getByLabelText('Open filters')).toBeTruthy();
      expect(screen.queryByLabelText(/Open filters, \d+ active/)).toBeNull();
    });
  });
});

// ── FE13-CS-6: Clear All + Apply restores the full catalog ────────────────────

describe('FE13-CS-6: Clear All followed by Apply restores the full catalog and removes the badge', () => {
  it('should show every product again and drop the badge', async () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Open filters'));
    fireEvent.press(screen.getByLabelText('Filter by Serum'));
    fireEvent.press(screen.getByText(/Apply Filters/));
    await waitFor(() => expect(screen.getByLabelText('Open filters, 1 active')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('Open filters, 1 active'));
    fireEvent.press(screen.getByText('Clear All'));
    fireEvent.press(screen.getByText(/Apply Filters/));

    await waitFor(() => {
      expect(screen.getByText('Retinoid Renewal Serum')).toBeTruthy();
      expect(screen.getByText('Niacinamide 10% Serum')).toBeTruthy();
      expect(screen.getByText('Mineral SPF50')).toBeTruthy();
      expect(screen.getByLabelText('Open filters')).toBeTruthy();
      expect(screen.queryByLabelText(/Open filters, \d+ active/)).toBeNull();
    });
  });
});

// ── FE13-CS-7 / FE13-CS-8: empty states (regression on hasActiveFilters) ────

describe('FE13-CS-7: empty catalog state when the store contains no products', () => {
  beforeEach(() => {
    mockProductList = [];
  });

  it('should render "Your catalog is empty" when the store is empty', () => {
    renderScreen();
    expect(screen.getByText('Your catalog is empty')).toBeTruthy();
  });
});

describe('FE13-CS-8: filter-empty state when a committed filter combination matches no products', () => {
  beforeEach(() => {
    mockProductList = [UNTAGGED_SPF];
  });

  it('should render "No products match the current filters" after committing a non-matching Product Type', async () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Open filters'));
    fireEvent.press(screen.getByLabelText('Filter by Serum'));
    fireEvent.press(screen.getByText(/Apply Filters/));

    await waitFor(() => {
      expect(screen.getByText('No products match the current filters')).toBeTruthy();
    });
  });
});
