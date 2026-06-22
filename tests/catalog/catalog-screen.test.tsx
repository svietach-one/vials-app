/**
 * Integration tests — CatalogScreen
 *
 * Covers:
 *   AC-1  Products render as Card rows (name + type Tag + brand)
 *   AC-2  Search filters by name, brand, and activeTags
 *   AC-3  Empty catalog state is shown when no products exist
 *   AC-4  "No matching products" state is shown when search has no hits
 *   AC-5  Tapping "+" header button navigates to AddProductHub
 *   AC-6  Tapping a Card navigates to ProductDetail with productId param
 *   AC-7  Three-dot button opens ProductActionSheet for the tapped product
 *   AC-8  Action sheet "Edit" navigates to ManualProductForm with editingProductId
 *   AC-9  Action sheet "Delete" opens DeleteProductModal; confirm calls removeProduct
 *   AC-10 Search field is rendered in the list header
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

// ── Mocks ──────────────────────────────────────────────────────────────────────

// Navigation
const mockNavigate = jest.fn();
const mockSetOptions = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: jest.fn(),
}));

// Zustand store
const mockProducts = [
  {
    id: 'p1',
    name: 'Hydra Boost Serum',
    brand: 'CeraVe',
    productType: 'serum',
    imageUrl: null,
    activeIngredients: [{ key: 'niacinamide', displayName: 'Niacinamide' }],
    activeTags: ['niacinamide'],
    fullIngredientText: null,
    usageTime: 'both',
    openBeautyFactsId: null,
    addedAt: '2026-01-01',
    notes: null,
    openedDate: null,
    paoMonths: null,
  },
  {
    id: 'p2',
    name: 'Retinol Night Cream',
    brand: 'The Ordinary',
    productType: 'moisturizer',
    imageUrl: null,
    activeIngredients: [{ key: 'retinol', displayName: 'Retinol' }],
    activeTags: ['retinol'],
    fullIngredientText: null,
    usageTime: 'evening',
    openBeautyFactsId: null,
    addedAt: '2026-01-02',
    notes: null,
    openedDate: null,
    paoMonths: null,
  },
];

const mockUpdateProduct = jest.fn();
const mockRemoveProduct = jest.fn();

jest.mock('@/store/productsStore', () => ({
  useProductsStore: jest.fn((selector: (s: any) => any) => {
    const state = {
      products: mockProducts,
      updateProduct: mockUpdateProduct,
      removeProduct: mockRemoveProduct,
    };
    return selector(state);
  }),
}));

jest.mock('@/components/product/DeleteProductModal', () => {
  const { View, Pressable } = require('react-native');
  return {
    DeleteProductModal: ({ product, onConfirm, onCancel }: any) => {
      if (!product) return null;
      return (
        <View testID="delete-product-modal">
          <Pressable testID="delete-confirm-btn" onPress={onConfirm} />
          <Pressable testID="delete-cancel-btn" onPress={onCancel} />
        </View>
      );
    },
  };
});

jest.mock('@/components/product/ProductActionSheet', () => {
  const { View, Pressable } = require('react-native');
  return {
    ProductActionSheet: ({ product, onEdit, onDelete, onClose }: any) => {
      if (!product) return null;
      return (
        <View testID="product-action-sheet">
          <Pressable testID="action-edit-btn" onPress={() => onEdit(product)} />
          <Pressable testID="action-delete-btn" onPress={() => onDelete(product)} />
          <Pressable testID="action-cancel-btn" onPress={onClose} />
        </View>
      );
    },
  };
});

// Lightweight UI stubs (avoid native rendering complexity in tests)
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
    IconButton: ({ onPress, label, style }: any) => (
      <Pressable onPress={onPress} accessibilityLabel={label} style={style} testID={`icon-btn-${label?.replace(/\s+/g, '-').toLowerCase()}`} />
    ),
  };
});

jest.mock('@/components/ui/core/Tag', () => {
  const { Text } = require('react-native');
  return {
    Tag: ({ children }: any) => <Text testID="tag">{children}</Text>,
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

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
}));

jest.mock('@/constants/tokens', () => ({
  colors: {
    bgBase: '#fff',
    textPrimary: '#000',
    textSecondary: '#666',
    textTertiary: '#999',
    textOnDark: '#fff',
    borderDivider: '#eee',
    surfaceCard: '#fafafa',
    surfaceRaised: '#f5f5f5',
    surfaceSunken: '#f0f0f0',
    statusSOS: '#720626',
  },
  space: new Proxy({}, { get: () => 8 }),
  typography: new Proxy({}, { get: () => ({}) }),
  radius: new Proxy({}, { get: () => 8 }),
}));

// ── Subject under test ─────────────────────────────────────────────────────────

import CatalogScreen from '@/screens/CatalogScreen';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeNavigation(overrides: Partial<typeof navigation> = {}) {
  return {
    navigate: mockNavigate,
    goBack: mockGoBack,
    setOptions: mockSetOptions,
    ...overrides,
  };
}

const navigation = makeNavigation() as any;

function renderScreen() {
  return render(<CatalogScreen navigation={navigation} route={{} as any} />);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ── AC-1: Cards render product data ───────────────────────────────────────────

describe('AC-1: product cards render name, type tag, and brand', () => {
  it('should render both product names from the store', () => {
    renderScreen();
    expect(screen.getByText('Hydra Boost Serum')).toBeTruthy();
    expect(screen.getByText('Retinol Night Cream')).toBeTruthy();
  });

  it('should render product type labels as tags', () => {
    renderScreen();
    expect(screen.getByText('Serum')).toBeTruthy();
    expect(screen.getByText('Moisturizer')).toBeTruthy();
  });

  it('should render brand names', () => {
    renderScreen();
    expect(screen.getByText('CeraVe')).toBeTruthy();
    expect(screen.getByText('The Ordinary')).toBeTruthy();
  });
});

// ── AC-2: Search filtering ─────────────────────────────────────────────────────

describe('AC-2: search bar filters products', () => {
  it('should filter by product name (case-insensitive)', async () => {
    renderScreen();
    fireEvent.changeText(screen.getByTestId('catalog-search-input'), 'hydra');
    await waitFor(() => {
      expect(screen.getByText('Hydra Boost Serum')).toBeTruthy();
      expect(screen.queryByText('Retinol Night Cream')).toBeNull();
    });
  });

  it('should filter by brand name (case-insensitive)', async () => {
    renderScreen();
    fireEvent.changeText(screen.getByTestId('catalog-search-input'), 'ordinary');
    await waitFor(() => {
      expect(screen.getByText('Retinol Night Cream')).toBeTruthy();
      expect(screen.queryByText('Hydra Boost Serum')).toBeNull();
    });
  });

  it('should filter by activeTag ingredient label', async () => {
    renderScreen();
    fireEvent.changeText(screen.getByTestId('catalog-search-input'), 'niacinamide');
    await waitFor(() => {
      expect(screen.getByText('Hydra Boost Serum')).toBeTruthy();
      expect(screen.queryByText('Retinol Night Cream')).toBeNull();
    });
  });

  it('should show all products when search text is cleared', async () => {
    renderScreen();
    fireEvent.changeText(screen.getByTestId('catalog-search-input'), 'hydra');
    fireEvent.changeText(screen.getByTestId('catalog-search-input'), '');
    await waitFor(() => {
      expect(screen.getByText('Hydra Boost Serum')).toBeTruthy();
      expect(screen.getByText('Retinol Night Cream')).toBeTruthy();
    });
  });
});

// ── AC-3: Empty catalog state ──────────────────────────────────────────────────

describe('AC-3: empty catalog state when store has no products', () => {
  beforeEach(() => {
    const { useProductsStore } = require('@/store/productsStore');
    useProductsStore.mockImplementation((selector: any) =>
      selector({ products: [], updateProduct: jest.fn(), removeProduct: jest.fn() }),
    );
  });

  afterEach(() => {
    const { useProductsStore } = require('@/store/productsStore');
    useProductsStore.mockImplementation((selector: any) =>
      selector({
        products: mockProducts,
        updateProduct: mockUpdateProduct,
        removeProduct: mockRemoveProduct,
      }),
    );
  });

  it('should render "Your catalog is empty" title', () => {
    renderScreen();
    expect(screen.getByText('Your catalog is empty')).toBeTruthy();
  });

  it('should render the "Add Product" primary CTA in empty state', () => {
    renderScreen();
    expect(screen.getByText('Add Product')).toBeTruthy();
  });

  it('should navigate to AddProductHub when "Add Product" CTA is pressed', () => {
    renderScreen();
    fireEvent.press(screen.getByText('Add Product'));
    expect(mockNavigate).toHaveBeenCalledWith('AddProductHub');
  });
});

// ── AC-4: No matching products state ──────────────────────────────────────────

describe('AC-4: "No matching products" empty state when search yields zero results', () => {
  it('should show "No matching products" when search query has no hits', async () => {
    renderScreen();
    fireEvent.changeText(screen.getByTestId('catalog-search-input'), 'zzznomatch');
    await waitFor(() => {
      expect(screen.getByText('No matching products')).toBeTruthy();
    });
  });

  it('should NOT show the Add Product button in the no-results state', async () => {
    renderScreen();
    fireEvent.changeText(screen.getByTestId('catalog-search-input'), 'zzznomatch');
    await waitFor(() => {
      expect(screen.queryByText('Add Product')).toBeNull();
    });
  });
});

// ── AC-5: Header "+" navigates to AddProductHub ───────────────────────────────

describe('AC-5: header "+" button navigates to AddProductHub', () => {
  it('should call navigation.setOptions with a headerRight component on mount', () => {
    renderScreen();
    expect(mockSetOptions).toHaveBeenCalled();
    const call = mockSetOptions.mock.calls[0][0];
    expect(call).toHaveProperty('headerRight');
  });

  it('should navigate to AddProductHub when the header button is pressed', () => {
    renderScreen();
    // Extract the headerRight component from setOptions call and render it
    const { headerRight } = mockSetOptions.mock.calls[0][0];
    const { getByLabelText } = render(headerRight());
    fireEvent.press(getByLabelText('Add product'));
    expect(mockNavigate).toHaveBeenCalledWith('AddProductHub');
  });
});

// ── AC-6: Card tap navigates to ProductDetail ─────────────────────────────────

describe('AC-6: tapping a product card navigates to ProductDetail', () => {
  it('should navigate to ProductDetail with the correct productId when first card is tapped', () => {
    renderScreen();
    const cards = screen.getAllByTestId('catalog-card');
    fireEvent.press(cards[0]);
    expect(mockNavigate).toHaveBeenCalledWith('ProductDetail', { productId: 'p1' });
  });

  it('should navigate to ProductDetail with the second productId when second card is tapped', () => {
    renderScreen();
    const cards = screen.getAllByTestId('catalog-card');
    fireEvent.press(cards[1]);
    expect(mockNavigate).toHaveBeenCalledWith('ProductDetail', { productId: 'p2' });
  });
});

// ── AC-7: Three-dot button opens ProductActionSheet ───────────────────────────

describe('AC-7: three-dot icon button opens ProductActionSheet for the tapped product', () => {
  it('should not show the action sheet before any three-dot is tapped', () => {
    renderScreen();
    expect(screen.queryByTestId('product-action-sheet')).toBeNull();
  });

  it('should show ProductActionSheet after pressing the three-dot button', () => {
    renderScreen();
    // The three-dot buttons have accessibility labels like "Options for <name>"
    fireEvent.press(screen.getByLabelText('Options for Hydra Boost Serum'));
    expect(screen.getByTestId('product-action-sheet')).toBeTruthy();
  });

  it('should close the action sheet when cancel is pressed', () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Options for Hydra Boost Serum'));
    fireEvent.press(screen.getByTestId('action-cancel-btn'));
    expect(screen.queryByTestId('product-action-sheet')).toBeNull();
  });
});

// ── AC-8: Edit flow via action sheet ─────────────────────────────────────────

describe('AC-8: action sheet Edit navigates to ManualProductForm with editingProductId', () => {
  it('should navigate to ManualProductForm with the product id when Edit is selected', () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Options for Hydra Boost Serum'));
    fireEvent.press(screen.getByTestId('action-edit-btn'));
    expect(mockNavigate).toHaveBeenCalledWith('ManualProductForm', { editingProductId: 'p1' });
  });

  it('should close the action sheet after pressing Edit', () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Options for Hydra Boost Serum'));
    fireEvent.press(screen.getByTestId('action-edit-btn'));
    expect(screen.queryByTestId('product-action-sheet')).toBeNull();
  });
});

// ── AC-9: Delete flow via action sheet ───────────────────────────────────────

describe('AC-9: action sheet Delete opens DeleteProductModal and confirm calls removeProduct', () => {
  it('should show DeleteProductModal when Delete is selected in the action sheet', () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Options for Hydra Boost Serum'));
    fireEvent.press(screen.getByTestId('action-delete-btn'));
    expect(screen.getByTestId('delete-product-modal')).toBeTruthy();
  });

  it('should call removeProduct with the correct id when delete is confirmed', () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Options for Hydra Boost Serum'));
    fireEvent.press(screen.getByTestId('action-delete-btn'));
    fireEvent.press(screen.getByTestId('delete-confirm-btn'));
    expect(mockRemoveProduct).toHaveBeenCalledWith('p1');
  });

  it('should dismiss the delete modal when cancel is pressed', () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Options for Hydra Boost Serum'));
    fireEvent.press(screen.getByTestId('action-delete-btn'));
    fireEvent.press(screen.getByTestId('delete-cancel-btn'));
    expect(screen.queryByTestId('delete-product-modal')).toBeNull();
  });
});

// ── AC-10: Search input is visible ────────────────────────────────────────────

describe('AC-10: search input is rendered in the list header', () => {
  it('should render the search input with placeholder text', () => {
    renderScreen();
    expect(screen.getByTestId('catalog-search-input')).toBeTruthy();
    expect(
      screen.getByPlaceholderText('Search by name, brand or ingredient…'),
    ).toBeTruthy();
  });
});
