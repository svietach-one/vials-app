/**
 * Integration tests — AddProductHubScreen
 *
 * Covers:
 *   AC-11 OBF search input is rendered with focus hint
 *   AC-12 Typing < 3 chars does not trigger a search
 *   AC-13 Typing >= 3 chars (after 600 ms debounce) triggers searchProducts
 *   AC-14 OBF results render as pressable rows (name + brand)
 *   AC-15 Tapping an OBF result opens AddProductModal pre-filled with OBF data
 *   AC-16 Zero-results state shows "No results for…" text and an "Add Manually" button
 *   AC-17 OBF API failure shows the "Search unavailable" hint
 *   AC-18 "Scan Barcode" row navigates to BarcodeScanner route
 *   AC-19 "Create Product Manually" button opens AddProductModal in empty mode
 *   AC-20 Saving via AddProductModal calls addProduct + goBack
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';

// ── Mocks ──────────────────────────────────────────────────────────────────────

jest.useFakeTimers();

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockSetOptions = jest.fn();

// OBF search — controlled per test
const mockSearchProducts = jest.fn();
jest.mock('@/services/openBeautyFacts/search', () => ({
  searchProducts: (...args: any[]) => mockSearchProducts(...args),
}));

// Zustand stores
const mockAddProduct = jest.fn();
const mockUpdateRoutine = jest.fn();

jest.mock('@/store/productsStore', () => ({
  useProductsStore: jest.fn((selector: any) =>
    selector({ addProduct: mockAddProduct }),
  ),
}));

jest.mock('@/store/routinesStore', () => ({
  useRoutinesStore: jest.fn((selector: any) =>
    selector({
      routines: [
        { id: 'r-am', timeOfDay: 'morning', steps: [] },
        { id: 'r-pm', timeOfDay: 'evening', steps: [] },
      ],
      updateRoutine: mockUpdateRoutine,
    }),
  ),
}));

jest.mock('@/utils/generateId', () => ({
  generateId: () => 'generated-id',
}));

// AddProductModal stub
jest.mock('@/components/product/AddProductModal', () => {
  const { View, Pressable, Text } = require('react-native');
  return {
    AddProductModal: ({ visible, prefillOBFProduct, onSave, onClose }: any) => {
      if (!visible) return null;
      const product = {
        id: 'new-id',
        name: prefillOBFProduct ? prefillOBFProduct.name : 'Manual Product',
        brand: prefillOBFProduct?.brand ?? null,
        productType: 'serum',
        imageUrl: null,
        activeIngredients: [],
        activeTags: [],
        fullIngredientText: prefillOBFProduct?.ingredientsText ?? null,
        usageTime: 'both',
        openBeautyFactsId: prefillOBFProduct?.obfId ?? null,
        addedAt: '2026-06-20',
        notes: null,
        openedDate: null,
        paoMonths: null,
      };
      return (
        <View testID="add-product-modal">
          <Text testID="modal-prefill-name">{product.name}</Text>
          <Pressable
            testID="modal-save-btn"
            onPress={() => onSave(product, 'none')}
          />
          <Pressable testID="modal-close-btn" onPress={onClose} />
        </View>
      );
    },
  };
});

// Lightweight UI stubs
jest.mock('@/components/ui/core/Button', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({ onPress, children }: any) => (
      <Pressable onPress={onPress} testID={`btn-${String(children).replace(/\s+/g, '-').toLowerCase()}`}>
        <Text>{children}</Text>
      </Pressable>
    ),
  };
});

jest.mock('@/components/ui/forms/Input', () => {
  const { TextInput } = require('react-native');
  return {
    Input: ({ value, onChangeText, placeholder }: any) => (
      <TextInput
        testID="hub-search-input"
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
    surfaceRaised: '#f5f5f5',
    surfaceSunken: '#f0f0f0',
    surfaceCard: '#fafafa',
    borderDivider: '#eee',
  },
  space: new Proxy({}, { get: () => 8 }),
  typography: new Proxy({}, { get: () => ({}) }),
  radius: new Proxy({}, { get: () => 8 }),
  palette: { white: '#fff', black: '#000' },
}));

// ── Subject under test ─────────────────────────────────────────────────────────

import AddProductHubScreen from '@/screens/AddProductHubScreen';

// ── Helpers ───────────────────────────────────────────────────────────────────

const OBF_RESULT = {
  obfId: 'obf-123',
  name: 'Vitamin C Serum',
  brand: 'Paula\'s Choice',
  ingredientsText: 'Aqua, Ascorbic Acid',
};

function makeNavigation() {
  return {
    navigate: mockNavigate,
    goBack: mockGoBack,
    setOptions: mockSetOptions,
  } as any;
}

function renderScreen() {
  return render(<AddProductHubScreen navigation={makeNavigation()} route={{} as any} />);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockSearchProducts.mockResolvedValue({ products: [], failed: false });
});

afterAll(() => {
  jest.useRealTimers();
});

// ── AC-11: Search input rendered ──────────────────────────────────────────────

describe('AC-11: OBF search input is rendered', () => {
  it('should render the search input', () => {
    renderScreen();
    expect(screen.getByTestId('hub-search-input')).toBeTruthy();
  });

  it('should display the Search Database section label', () => {
    renderScreen();
    expect(screen.getByText('Search Database')).toBeTruthy();
  });
});

// ── AC-12: Short queries do not trigger search ────────────────────────────────

describe('AC-12: typing fewer than 3 chars does not trigger OBF search', () => {
  it('should not call searchProducts when query is 2 chars', async () => {
    renderScreen();
    fireEvent.changeText(screen.getByTestId('hub-search-input'), 'ab');
    act(() => jest.runAllTimers());
    expect(mockSearchProducts).not.toHaveBeenCalled();
  });

  it('should not call searchProducts when query is empty', async () => {
    renderScreen();
    fireEvent.changeText(screen.getByTestId('hub-search-input'), '');
    act(() => jest.runAllTimers());
    expect(mockSearchProducts).not.toHaveBeenCalled();
  });
});

// ── AC-13: Debounced search after >= 3 chars ──────────────────────────────────

describe('AC-13: search is triggered after 600 ms debounce when query >= 3 chars', () => {
  it('should call searchProducts with the trimmed query after debounce', async () => {
    mockSearchProducts.mockResolvedValue({ products: [OBF_RESULT], failed: false });
    renderScreen();
    fireEvent.changeText(screen.getByTestId('hub-search-input'), 'Vitamin C');
    act(() => jest.advanceTimersByTime(600));
    await waitFor(() => {
      expect(mockSearchProducts).toHaveBeenCalledWith('Vitamin C');
    });
  });

  it('should NOT call searchProducts before the 600 ms window elapses', async () => {
    renderScreen();
    fireEvent.changeText(screen.getByTestId('hub-search-input'), 'Vitamin C');
    act(() => jest.advanceTimersByTime(300));
    expect(mockSearchProducts).not.toHaveBeenCalled();
  });
});

// ── AC-14: OBF results render as pressable rows ────────────────────────────────

describe('AC-14: OBF results render product name and brand', () => {
  it('should display the product name returned by searchProducts', async () => {
    mockSearchProducts.mockResolvedValue({ products: [OBF_RESULT], failed: false });
    renderScreen();
    fireEvent.changeText(screen.getByTestId('hub-search-input'), 'vitamin c');
    act(() => jest.runAllTimers());
    await waitFor(() => {
      expect(screen.getByText('Vitamin C Serum')).toBeTruthy();
    });
  });

  it('should display the brand for the returned product', async () => {
    mockSearchProducts.mockResolvedValue({ products: [OBF_RESULT], failed: false });
    renderScreen();
    fireEvent.changeText(screen.getByTestId('hub-search-input'), 'vitamin c');
    act(() => jest.runAllTimers());
    await waitFor(() => {
      expect(screen.getByText("Paula's Choice")).toBeTruthy();
    });
  });
});

// ── AC-15: Tapping OBF result opens pre-filled modal ─────────────────────────

describe('AC-15: tapping an OBF result opens AddProductModal pre-filled with OBF data', () => {
  it('should open AddProductModal with the OBF product name when a result row is pressed', async () => {
    mockSearchProducts.mockResolvedValue({ products: [OBF_RESULT], failed: false });
    renderScreen();
    fireEvent.changeText(screen.getByTestId('hub-search-input'), 'vitamin c');
    act(() => jest.runAllTimers());
    await waitFor(() => screen.getByText('Vitamin C Serum'));
    fireEvent.press(screen.getByLabelText('Add Vitamin C Serum'));
    expect(screen.getByTestId('add-product-modal')).toBeTruthy();
    expect(screen.getByTestId('modal-prefill-name').props.children).toBe('Vitamin C Serum');
  });
});

// ── AC-16: Zero-results state ─────────────────────────────────────────────────

describe('AC-16: zero results state shows hint text and manual fallback', () => {
  it('should show "No results for" hint when search returns empty array', async () => {
    mockSearchProducts.mockResolvedValue({ products: [], failed: false });
    renderScreen();
    fireEvent.changeText(screen.getByTestId('hub-search-input'), 'zzznothing');
    act(() => jest.runAllTimers());
    await waitFor(() => {
      expect(screen.getByText(/No results for/)).toBeTruthy();
    });
  });

  it('should show an "Add Manually" button in the zero-results state', async () => {
    mockSearchProducts.mockResolvedValue({ products: [], failed: false });
    renderScreen();
    fireEvent.changeText(screen.getByTestId('hub-search-input'), 'zzznothing');
    act(() => jest.runAllTimers());
    await waitFor(() => {
      expect(screen.getByText('Add Manually')).toBeTruthy();
    });
  });

  it('should open AddProductModal in empty mode when "Add Manually" is pressed in zero-results state', async () => {
    mockSearchProducts.mockResolvedValue({ products: [], failed: false });
    renderScreen();
    fireEvent.changeText(screen.getByTestId('hub-search-input'), 'zzznothing');
    act(() => jest.runAllTimers());
    await waitFor(() => screen.getByText('Add Manually'));
    fireEvent.press(screen.getByText('Add Manually'));
    expect(screen.getByTestId('add-product-modal')).toBeTruthy();
    // Pre-fill name should fall back to the manual default
    expect(screen.getByTestId('modal-prefill-name').props.children).toBe('Manual Product');
  });
});

// ── AC-17: OBF API failure ────────────────────────────────────────────────────

describe('AC-17: OBF API failure shows "Search unavailable" hint', () => {
  it('should show the search-unavailable fallback hint when searchProducts returns failed:true', async () => {
    mockSearchProducts.mockResolvedValue({ products: [], failed: true });
    renderScreen();
    fireEvent.changeText(screen.getByTestId('hub-search-input'), 'vitamin c');
    act(() => jest.runAllTimers());
    await waitFor(() => {
      expect(
        screen.getByText(/Search unavailable — add your product manually below/),
      ).toBeTruthy();
    });
  });
});

// ── AC-18: Barcode scan navigation ────────────────────────────────────────────

describe('AC-18: "Scan Barcode" row navigates to BarcodeScanner', () => {
  it('should render the Scan section label', () => {
    renderScreen();
    expect(screen.getByText('Scan')).toBeTruthy();
  });

  it('should navigate to BarcodeScanner when the Scan Barcode row is pressed', () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Scan product barcode'));
    expect(mockNavigate).toHaveBeenCalledWith('BarcodeScanner');
  });
});

// ── AC-19: Manual entry button opens empty modal ──────────────────────────────

describe('AC-19: "Create Product Manually" button opens AddProductModal in empty mode', () => {
  it('should render the Manual Entry section', () => {
    renderScreen();
    expect(screen.getByText('Manual Entry')).toBeTruthy();
  });

  it('should open AddProductModal without OBF pre-fill when manual button is pressed', () => {
    renderScreen();
    fireEvent.press(screen.getByText('Create Product Manually'));
    expect(screen.getByTestId('add-product-modal')).toBeTruthy();
    expect(screen.getByTestId('modal-prefill-name').props.children).toBe('Manual Product');
  });
});

// ── AC-20: Save calls addProduct and goBack ────────────────────────────────────

describe('AC-20: saving via AddProductModal calls addProduct then goBack', () => {
  it('should call addProduct with the saved product when modal save is confirmed', () => {
    renderScreen();
    fireEvent.press(screen.getByText('Create Product Manually'));
    fireEvent.press(screen.getByTestId('modal-save-btn'));
    expect(mockAddProduct).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Manual Product' }),
    );
  });

  it('should call navigation.goBack after saving', () => {
    renderScreen();
    fireEvent.press(screen.getByText('Create Product Manually'));
    fireEvent.press(screen.getByTestId('modal-save-btn'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('should close the modal after saving', () => {
    renderScreen();
    fireEvent.press(screen.getByText('Create Product Manually'));
    fireEvent.press(screen.getByTestId('modal-save-btn'));
    expect(screen.queryByTestId('add-product-modal')).toBeNull();
  });
});
