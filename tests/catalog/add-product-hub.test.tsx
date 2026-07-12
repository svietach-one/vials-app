/**
 * Integration tests — AddProductHubScreen
 *
 * Covers:
 *   AC-11 Corpus search input is rendered with focus hint
 *   AC-12 Typing < 3 chars does not trigger a search
 *   AC-13 Typing >= 3 chars (after 600 ms debounce) triggers ProductRepository.search
 *   AC-14 Corpus results render as pressable rows (name + brand)
 *   AC-15 Tapping a result navigates to ManualProductForm with a corpus prefill
 *   AC-16 Zero-results state shows "No results for…" text and an "Add Manually" button
 *   AC-17 No configured/reachable corpus degrades to the zero-results state (never crashes)
 *   AC-18 "Scan Barcode" row navigates to BarcodeScanner route
 *   AC-19 "Create Product Manually" navigates to the accordion AddProduct screen
 *   AC-20 Open Beauty Facts attribution shows when a result's source is obf_import
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';

// ── Mocks ──────────────────────────────────────────────────────────────────────

jest.useFakeTimers();

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockSetOptions = jest.fn();

// Corpus product repository — controlled per test
const mockSearch = jest.fn();
let mockProductRepository: { search: typeof mockSearch } | null = { search: mockSearch };
jest.mock('@/hooks/useCorpusRepositories', () => ({
  useProductRepository: () => mockProductRepository,
}));

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

const CORPUS_RESULT = {
  uid: 'corpus-123',
  barcode: null,
  name: 'Vitamin C Serum',
  brand: 'Paula\'s Choice',
  type: 'serum',
  inciRaw: 'Aqua, Ascorbic Acid',
  imageUrl: null,
  source: 'vials_seed' as const,
};

const OBF_RESULT = { ...CORPUS_RESULT, uid: 'corpus-obf-1', source: 'obf_import' as const };

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
  mockProductRepository = { search: mockSearch };
  mockSearch.mockResolvedValue([]);
});

afterAll(() => {
  jest.useRealTimers();
});

// ── AC-11: Search input rendered ──────────────────────────────────────────────

describe('AC-11: corpus search input is rendered', () => {
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

describe('AC-12: typing fewer than 3 chars does not trigger a corpus search', () => {
  it('should not call search when query is 2 chars', async () => {
    renderScreen();
    fireEvent.changeText(screen.getByTestId('hub-search-input'), 'ab');
    act(() => jest.runAllTimers());
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('should not call search when query is empty', async () => {
    renderScreen();
    fireEvent.changeText(screen.getByTestId('hub-search-input'), '');
    act(() => jest.runAllTimers());
    expect(mockSearch).not.toHaveBeenCalled();
  });
});

// ── AC-13: Debounced search after >= 3 chars ──────────────────────────────────

describe('AC-13: search is triggered after 600 ms debounce when query >= 3 chars', () => {
  it('should call search with the trimmed query after debounce', async () => {
    mockSearch.mockResolvedValue([CORPUS_RESULT]);
    renderScreen();
    fireEvent.changeText(screen.getByTestId('hub-search-input'), 'Vitamin C');
    act(() => jest.advanceTimersByTime(600));
    await waitFor(() => {
      expect(mockSearch).toHaveBeenCalledWith('Vitamin C');
    });
  });

  it('should NOT call search before the 600 ms window elapses', async () => {
    renderScreen();
    fireEvent.changeText(screen.getByTestId('hub-search-input'), 'Vitamin C');
    act(() => jest.advanceTimersByTime(300));
    expect(mockSearch).not.toHaveBeenCalled();
  });
});

// ── AC-14: Corpus results render as pressable rows ─────────────────────────────

describe('AC-14: corpus results render product name and brand', () => {
  it('should display the product name returned by search', async () => {
    mockSearch.mockResolvedValue([CORPUS_RESULT]);
    renderScreen();
    fireEvent.changeText(screen.getByTestId('hub-search-input'), 'vitamin c');
    act(() => jest.runAllTimers());
    await waitFor(() => {
      expect(screen.getByText('Vitamin C Serum')).toBeTruthy();
    });
  });

  it('should display the brand for the returned product', async () => {
    mockSearch.mockResolvedValue([CORPUS_RESULT]);
    renderScreen();
    fireEvent.changeText(screen.getByTestId('hub-search-input'), 'vitamin c');
    act(() => jest.runAllTimers());
    await waitFor(() => {
      expect(screen.getByText("Paula's Choice")).toBeTruthy();
    });
  });
});

// ── AC-15: Tapping a result navigates to ManualProductForm ────────────────────

describe('AC-15: tapping a result navigates to ManualProductForm with a corpus prefill', () => {
  it('should navigate to ManualProductForm with prefillCorpusProduct when a result row is pressed', async () => {
    mockSearch.mockResolvedValue([CORPUS_RESULT]);
    renderScreen();
    fireEvent.changeText(screen.getByTestId('hub-search-input'), 'vitamin c');
    act(() => jest.runAllTimers());
    await waitFor(() => screen.getByText('Vitamin C Serum'));
    fireEvent.press(screen.getByLabelText('Add Vitamin C Serum'));
    expect(mockNavigate).toHaveBeenCalledWith('ManualProductForm', {
      prefillCorpusProduct: CORPUS_RESULT,
    });
  });
});

// ── AC-16: Zero-results state ─────────────────────────────────────────────────

describe('AC-16: zero results state shows hint text and manual fallback', () => {
  it('should show "No results for" hint when search returns empty array', async () => {
    mockSearch.mockResolvedValue([]);
    renderScreen();
    fireEvent.changeText(screen.getByTestId('hub-search-input'), 'zzznothing');
    act(() => jest.runAllTimers());
    await waitFor(() => {
      expect(screen.getByText(/No results for/)).toBeTruthy();
    });
  });

  it('should show an "Add Manually" button in the zero-results state', async () => {
    mockSearch.mockResolvedValue([]);
    renderScreen();
    fireEvent.changeText(screen.getByTestId('hub-search-input'), 'zzznothing');
    act(() => jest.runAllTimers());
    await waitFor(() => {
      expect(screen.getByText('Add Manually')).toBeTruthy();
    });
  });

  it('should navigate to the accordion AddProduct screen when "Add Manually" is pressed in zero-results state', async () => {
    mockSearch.mockResolvedValue([]);
    renderScreen();
    fireEvent.changeText(screen.getByTestId('hub-search-input'), 'zzznothing');
    act(() => jest.runAllTimers());
    await waitFor(() => screen.getByText('Add Manually'));
    fireEvent.press(screen.getByText('Add Manually'));
    // The manual/not-found entry path is the accordion wizard
    // (docs/specs/add-product-flow/08); the OBF-prefill path (AC-15)
    // stays on ManualProductForm.
    expect(mockNavigate).toHaveBeenCalledWith('AddProduct');
  });
});

// ── AC-17: No configured/reachable corpus ─────────────────────────────────────

describe('AC-17: an unconfigured corpus degrades to the zero-results state', () => {
  it('should show the zero-results fallback instead of crashing when the repository is null', async () => {
    mockProductRepository = null;
    renderScreen();
    fireEvent.changeText(screen.getByTestId('hub-search-input'), 'vitamin c');
    act(() => jest.runAllTimers());
    await waitFor(() => {
      expect(screen.getByText(/No results for/)).toBeTruthy();
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

// ── AC-19: Manual entry navigates to form screen ─────────────────────────────

describe('AC-19: "Create Product Manually" navigates to the accordion AddProduct screen', () => {
  it('should render the Manual Entry section', () => {
    renderScreen();
    expect(screen.getByText('Manual Entry')).toBeTruthy();
  });

  it('should navigate to AddProduct when "Create Product Manually" is pressed', () => {
    renderScreen();
    fireEvent.press(screen.getByText('Create Product Manually'));
    // The manual/not-found entry path is the accordion wizard
    // (docs/specs/add-product-flow/08); the OBF-prefill path (AC-15)
    // stays on ManualProductForm.
    expect(mockNavigate).toHaveBeenCalledWith('AddProduct');
  });
});

// ── AC-20: OBF attribution ────────────────────────────────────────────────────

describe('AC-20: Open Beauty Facts attribution shows for obf_import results', () => {
  it('should show the ODbL attribution line when a result is source=obf_import', async () => {
    mockSearch.mockResolvedValue([OBF_RESULT]);
    renderScreen();
    fireEvent.changeText(screen.getByTestId('hub-search-input'), 'vitamin c');
    act(() => jest.runAllTimers());
    await waitFor(() => {
      expect(screen.getByText('Product data from Open Beauty Facts (ODbL)')).toBeTruthy();
    });
  });

  it('should NOT show the attribution line when no result is source=obf_import', async () => {
    mockSearch.mockResolvedValue([CORPUS_RESULT]);
    renderScreen();
    fireEvent.changeText(screen.getByTestId('hub-search-input'), 'vitamin c');
    act(() => jest.runAllTimers());
    await waitFor(() => screen.getByText('Vitamin C Serum'));
    expect(screen.queryByText('Product data from Open Beauty Facts (ODbL)')).toBeNull();
  });
});
