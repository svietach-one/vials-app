/**
 * Integration tests — CatalogScreen hide/show wiring
 * (hide-vial-bottomshield / tech-design FE-2, FE-3)
 *
 * Spec: docs/specs/hide-vial-bottomshield.md
 * Tech design: docs/tech-design/hide-vial-bottomshield.md
 *
 * KNOWN CONFLICT — flag for tech-lead / planner before engineer starts:
 * The tech design's assumption "The hide toggle row is always rendered in
 * ProductActionSheet (not conditionally)" is currently violated by the
 * product-shelf-card feature, which was merged after this design was approved.
 * `CatalogScreen` unconditionally supplies `onAddToRoutine` to `ProductShelfCard`,
 * which forwards exactly one of `onAddToRoutine` / `onRemoveFromRoutine` to
 * `ProductActionSheet` depending on `isInRoutine`. `ProductActionSheet`'s
 * Hide/Show branch is an `else` that only renders when BOTH of those props are
 * undefined — so it is unreachable through the real CatalogScreen -> ProductShelfCard
 * -> ProductActionSheet flow today. These tests assert the literal spec behaviour
 * (Story 1 AC bullet 1, Story 2 AC bullet 1) and are EXPECTED TO FAIL until this
 * contradiction is resolved (either make the toggle additive, or fold hide/show
 * semantics into the add/remove-from-routine rows).
 *
 * AC-W1  Visible product -> overflow menu shows "Hide Product"
 * AC-W2  Tapping "Hide Product" calls updateProduct(id, { isHidden: true }) and closes the sheet
 * AC-W3  Hidden product -> overflow menu shows "Show Product"
 * AC-W4  Tapping "Show Product" calls updateProduct(id, { isHidden: false }) and closes the sheet
 * AC-W5  Legacy product (isHidden undefined) -> overflow menu shows "Hide Product"
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
import { render, screen, fireEvent } from '@testing-library/react-native';
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

// No routines for any product -> isInRoutine is false for every card, which
// exercises the "Add to routine" branch of ProductActionSheet (the branch that
// currently shadows the Hide/Show toggle) most directly.
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

// ── Label mock ────────────────────────────────────────────────────────────────

jest.mock('@/constants/labels', () => ({
  ACTIVE_INGREDIENT_LABELS: {},
  PRODUCT_TYPE_LABELS: { serum: 'Serum', cleanser: 'Cleanser' },
}));

jest.mock('@/utils/routineLabel', () => ({
  formatScheduleDays: jest.fn(() => 'Every day'),
  deriveProductSchedule: jest.fn(),
  formatRoutineLabel: jest.fn(),
}));

// ── Heavy / irrelevant child screens ──────────────────────────────────────────

jest.mock('@/components/product/DeleteProductModal', () => ({
  DeleteProductModal: () => null,
}));

jest.mock('@/components/routine/RoutineSchedulerSheet', () => ({
  RoutineSchedulerSheet: () => null,
}));

jest.mock('@/components/catalog/CatalogFilterTrigger', () => {
  const { View } = require('react-native');
  return { CatalogFilterTrigger: () => <View testID="catalog-filter-trigger" /> };
});

jest.mock('@/components/catalog/FilterSheet', () => ({
  FilterSheet: () => null,
}));

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

// ProductShelfCard and ProductActionSheet are intentionally left REAL — this
// suite exercises the full wiring chain from CatalogScreen down to the sheet.

// ── Subject under test ────────────────────────────────────────────────────────

import CatalogScreen from '@/screens/CatalogScreen';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: 'p1',
    name: 'Niacinamide 10%',
    brand: 'The Ordinary',
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
    isHidden: false,
    ...overrides,
  };
}

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

beforeEach(() => {
  jest.clearAllMocks();
});

// ── AC-W1 / AC-W2 — visible product hide flow ─────────────────────────────────

describe('AC-W1: visible product shows "Hide Product" in the overflow menu', () => {
  it('should render "Hide Product" after opening the overflow menu for a visible product', () => {
    mockProductList = [makeProduct({ id: 'p1', name: 'Niacinamide 10%', isHidden: false })];
    renderScreen();
    fireEvent.press(screen.getByLabelText('More actions for Niacinamide 10%'));
    expect(screen.getByText('Hide Product')).toBeTruthy();
  });
});

describe('AC-W2: tapping "Hide Product" persists isHidden:true and closes the sheet', () => {
  it('should call updateProduct(id, { isHidden: true }) when "Hide Product" is tapped', () => {
    mockProductList = [makeProduct({ id: 'p1', name: 'Niacinamide 10%', isHidden: false })];
    renderScreen();
    fireEvent.press(screen.getByLabelText('More actions for Niacinamide 10%'));
    fireEvent.press(screen.getByText('Hide Product'));
    expect(mockUpdateProduct).toHaveBeenCalledWith('p1', { isHidden: true });
  });

  it('should close the action sheet after "Hide Product" is tapped', () => {
    mockProductList = [makeProduct({ id: 'p1', name: 'Niacinamide 10%', isHidden: false })];
    renderScreen();
    fireEvent.press(screen.getByLabelText('More actions for Niacinamide 10%'));
    fireEvent.press(screen.getByText('Hide Product'));
    expect(screen.queryByText('Hide Product')).toBeNull();
  });
});

// ── AC-W3 / AC-W4 — hidden product show flow ──────────────────────────────────

describe('AC-W3: hidden product shows "Show Product" in the overflow menu', () => {
  it('should render "Show Product" after opening the overflow menu for a hidden product', () => {
    mockProductList = [makeProduct({ id: 'p2', name: 'Retinol Serum', isHidden: true })];
    renderScreen();
    fireEvent.press(screen.getByLabelText('More actions for Retinol Serum'));
    expect(screen.getByText('Show Product')).toBeTruthy();
  });
});

describe('AC-W4: tapping "Show Product" persists isHidden:false and closes the sheet', () => {
  it('should call updateProduct(id, { isHidden: false }) when "Show Product" is tapped', () => {
    mockProductList = [makeProduct({ id: 'p2', name: 'Retinol Serum', isHidden: true })];
    renderScreen();
    fireEvent.press(screen.getByLabelText('More actions for Retinol Serum'));
    fireEvent.press(screen.getByText('Show Product'));
    expect(mockUpdateProduct).toHaveBeenCalledWith('p2', { isHidden: false });
  });
});

// ── AC-W5 — legacy product treated as visible ─────────────────────────────────

describe('AC-W5: legacy product (isHidden undefined) shows "Hide Product"', () => {
  it('should render "Hide Product" (not "Show Product") when isHidden is absent from the record', () => {
    const legacyProduct = makeProduct({ id: 'p3', name: 'Vitamin C Serum' });
    delete (legacyProduct as { isHidden?: boolean }).isHidden;
    mockProductList = [legacyProduct];
    renderScreen();
    fireEvent.press(screen.getByLabelText('More actions for Vitamin C Serum'));
    expect(screen.getByText('Hide Product')).toBeTruthy();
    expect(screen.queryByText('Show Product')).toBeNull();
  });
});
