/**
 * AddProductOptionsList (tech design FE-7) — the extracted, shared body of
 * AddProductHubScreen, taking `(navigation, initialStatus?, entryContext?)`
 * per tech design §3. The pre-existing Scan/Search/Manual tile + corpus
 * search/debounce/result contract is already pinned by
 * tests/catalog/add-product-hub.test.tsx (AC-11..AC-20) and is expected to
 * keep passing unchanged once extracted (tech design FE-7: "'My Shelf'
 * behavior is unchanged") — NOT duplicated here.
 *
 * This file covers only what onboarding-simplification adds on top: the
 * `entryContext` param threading into every downstream navigate call, and
 * the "search-result tap opens ManualProductForm for confirmation, never
 * auto-saves" contract (tech design Assumption 5) that onboarding needs to
 * share with the shelf.
 *
 * Not yet implemented — the module doesn't exist yet (FE-7 extracts it from
 * AddProductHubScreen), so this file is expected to fail to resolve until
 * FE-7 lands (see .claude/rules/testing.md: red before green).
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

jest.useFakeTimers();

const mockSearch = jest.fn();
let mockProductRepository: { search: typeof mockSearch } | null = { search: mockSearch };
jest.mock('@/hooks/useCorpusRepositories', () => ({
  useProductRepository: () => mockProductRepository,
}));

jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));

import { makeCorpusProduct, makeNavigation } from './fixtures';
import { AddProductOptionsList } from '@/components/addProduct/AddProductOptionsList';
import { SCAN_PRODUCT_ENABLED } from '@/constants/featureFlags';

const CORPUS_RESULT = makeCorpusProduct({
  uid: 'corpus-onb-1',
  name: 'Vitamin C Serum',
  brand: "Paula's Choice",
});

function renderList(overrides: { initialStatus?: never; entryContext?: 'catalog' | 'onboarding' } = {}) {
  const navigation = makeNavigation();
  render(<AddProductOptionsList navigation={navigation as any} {...overrides} />);
  return navigation;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockProductRepository = { search: mockSearch };
  mockSearch.mockResolvedValue([]);
});

afterAll(() => {
  jest.useRealTimers();
});

describe('AddProductOptionsList — same entry points as the shelf (spec Story 4 AC1)', () => {
  it('renders Search Database and Create Product Manually', () => {
    renderList();

    expect(screen.getByText('Search Database')).toBeTruthy();
    expect(screen.getByLabelText('Create product manually')).toBeTruthy();
  });
});

describe('AddProductOptionsList — "Scan Product" is gated behind SCAN_PRODUCT_ENABLED (product request, capture/OCR flow not ready)', () => {
  it('renders the Scan Product row and lets it navigate only while the flag is on', () => {
    renderList();

    if (SCAN_PRODUCT_ENABLED) {
      expect(screen.getByLabelText('Scan product')).toBeTruthy();
    } else {
      // Scan Product still rough (OCR capture-quality follow-up) — hidden by
      // default, alongside the also-off BARCODE_HUB_ENTRY_ENABLED (see
      // tests/catalog/add-product-hub.test.tsx AC-18) — so no "Scan" section
      // renders at all while both flags are off.
      expect(screen.queryByText('Scan')).toBeNull();
      expect(screen.queryByLabelText('Scan product')).toBeNull();
    }
  });
});

describe('AddProductOptionsList — search-result tap confirms via ManualProductForm, never auto-saves (tech design Assumption 5)', () => {
  it('navigates to ManualProductForm with a prefill on tap, instead of saving directly', async () => {
    mockSearch.mockResolvedValue([CORPUS_RESULT]);
    const navigation = renderList();

    fireEvent.changeText(screen.getByPlaceholderText(/Search by name or brand/), 'vitamin c');
    act(() => jest.advanceTimersByTime(200));
    await waitFor(() => screen.getByText('Vitamin C Serum'));

    fireEvent.press(screen.getByLabelText('Add Vitamin C Serum'));

    expect(navigation.navigate).toHaveBeenCalledWith(
      'ManualProductForm',
      expect.objectContaining({ prefillCorpusProduct: CORPUS_RESULT }),
    );
  });
});

describe('AddProductOptionsList — entryContext threading (tech design FE-6/FE-7)', () => {
  it('threads entryContext into the Scan Product navigation, when the flag is on', () => {
    if (!SCAN_PRODUCT_ENABLED) return;
    const navigation = renderList({ entryContext: 'onboarding' });

    fireEvent.press(screen.getByLabelText('Scan product'));

    expect(navigation.navigate).toHaveBeenCalledWith(
      'CaptureFlow',
      expect.objectContaining({ entryContext: 'onboarding' }),
    );
  });

  it('threads entryContext into the Create Product Manually navigation', () => {
    const navigation = renderList({ entryContext: 'onboarding' });

    fireEvent.press(screen.getByLabelText('Create product manually'));

    expect(navigation.navigate).toHaveBeenCalledWith(
      'AddProduct',
      expect.objectContaining({ entryContext: 'onboarding' }),
    );
  });

  it('threads entryContext into a search-result tap navigation', async () => {
    mockSearch.mockResolvedValue([CORPUS_RESULT]);
    const navigation = renderList({ entryContext: 'onboarding' });

    fireEvent.changeText(screen.getByPlaceholderText(/Search by name or brand/), 'vitamin c');
    act(() => jest.advanceTimersByTime(200));
    await waitFor(() => screen.getByText('Vitamin C Serum'));
    fireEvent.press(screen.getByLabelText('Add Vitamin C Serum'));

    expect(navigation.navigate).toHaveBeenCalledWith(
      'ManualProductForm',
      expect.objectContaining({ prefillCorpusProduct: CORPUS_RESULT, entryContext: 'onboarding' }),
    );
  });

  it('omits entryContext from the navigate call when not supplied — defaults to catalog behaviour (tech design Assumption 5)', () => {
    const navigation = renderList();

    fireEvent.press(screen.getByLabelText('Create product manually'));

    const [, params] = navigation.navigate.mock.calls[0];
    expect(params?.entryContext).toBeUndefined();
  });
});
