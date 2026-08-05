/**
 * FE-6 — "Physical exfoliant" toggle on ManualProductFormScreen.
 * Spec: docs/specs/vials-conflict-matrix-expansion.md (Story 3, AC1/AC2)
 * Tech design: docs/tech-design/vials-conflict-matrix-expansion.md §3
 *
 * Off by default; wired to Product.isPhysicalExfoliant on load (edit mode)
 * and on save (both add and edit). Mocking pattern mirrors
 * tests/product-images/ManualProductFormShare.test.tsx and
 * tests/contribution-consent-flow/ManualProductFormScreen.test.tsx — the
 * settingsStore is pinned to `contributionConsentStatus: 'accepted'` so the
 * unrelated contribution-consent modal never blocks a save in these tests.
 *
 * Accessible-query contract assumed here (not yet built, per testing.md's
 * "query by accessibility... never by style/component internals"): a
 * `Switch` with `accessibilityLabel="Physical exfoliant"`, next to visible
 * "Physical exfoliant" label text — the same pattern ContributionToggle
 * already uses for "Share with Vials".
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => {
  const { Text: RNText } = require('react-native');
  return { Feather: ({ name }: { name: string }) => <RNText>{`icon-${name}`}</RNText> };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/components/product/OcrScannerSheet', () => ({ OcrScannerSheet: () => null }));
jest.mock('@/components/routine/RoutineSchedulerSheet', () => ({
  RoutineSchedulerSheet: () => null,
}));
jest.mock('@/components/ui/ProductThumbnail', () => {
  const { View } = require('react-native');
  return { ProductThumbnail: () => <View testID="product-thumbnail" /> };
});
jest.mock('@/hooks/useCorpusRepositories', () => ({ useProductRepository: () => null }));

jest.mock('@/services/productImage', () => ({
  pickAndStoreProductPhoto: jest.fn(),
  storeExistingPhotoAsProductPhoto: jest.fn(),
  deleteProductPhoto: jest.fn(),
  renderContributionBlob: jest.fn(async () => null),
}));

jest.mock('@/services/contributions', () => ({ submitContribution: jest.fn() }));

jest.mock('@/store/productsStore', () => {
  const state = {
    products: [] as unknown[],
    addProduct: jest.fn(),
    updateProduct: jest.fn(),
  };
  const useProductsStore = (selector: (s: typeof state) => unknown) => selector(state);
  useProductsStore.getState = () => state;
  return { useProductsStore, __state: state };
});

// Bypasses the (unrelated) contribution-consent modal so saves commit
// synchronously — same shortcut as ManualProductFormShare.test.tsx.
jest.mock('@/store/settingsStore', () => {
  const state = {
    contributionConsentStatus: 'accepted',
    declinedSaveCountSinceLastReminder: 0,
    reminderCountShown: 0,
    setContributionConsentStatus: jest.fn(),
    incrementDeclinedSaveCount: jest.fn(),
    resetDeclinedSaveCount: jest.fn(),
    incrementReminderCountShown: jest.fn(),
  };
  const useSettingsStore = (selector: (s: typeof state) => unknown) => selector(state);
  useSettingsStore.getState = () => state;
  return { useSettingsStore };
});

const productsStoreState = jest.requireMock('@/store/productsStore').__state as {
  products: unknown[];
  addProduct: jest.Mock;
  updateProduct: jest.Mock;
};

import ManualProductFormScreen from '@/screens/ManualProductFormScreen';
import type { Product } from '@/types';

function renderScreen(params: Record<string, unknown> = {}) {
  const navigation = { goBack: jest.fn(), navigate: jest.fn() } as never;
  return render(<ManualProductFormScreen navigation={navigation} route={{ params } as never} />);
}

async function saveWithName(name = 'Exfoliating Cleanser') {
  fireEvent.changeText(screen.getByPlaceholderText(/Daily Moisturiser/), name);
  fireEvent.press(screen.getByText('Add to Catalog'));
  await act(async () => Promise.resolve());
}

function makeEditableProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'existing-1',
    name: 'Gentle Scrub',
    brand: null,
    productType: 'cleanser',
    imageUrl: null,
    activeIngredients: [],
    fullIngredientText: null,
    usageTime: 'both',
    openBeautyFactsId: null,
    addedAt: '2026-01-01',
    notes: null,
    openedDate: null,
    paoMonths: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  productsStoreState.products = [];
});

describe('adding a new product', () => {
  it('shows the "Physical exfoliant" toggle off by default', () => {
    renderScreen();

    expect(screen.getByText('Physical exfoliant')).toBeTruthy();
    const toggle = screen.getByLabelText('Physical exfoliant');
    expect(toggle.props.accessibilityState?.checked).toBe(false);
  });

  it('saves isPhysicalExfoliant as falsy when the toggle is left untouched', async () => {
    renderScreen();
    await saveWithName();

    expect(productsStoreState.addProduct).toHaveBeenCalledTimes(1);
    expect(productsStoreState.addProduct.mock.calls[0][0].isPhysicalExfoliant).toBeFalsy();
  });

  it('saves isPhysicalExfoliant: true after the toggle is turned on', async () => {
    renderScreen();

    fireEvent(screen.getByLabelText('Physical exfoliant'), 'valueChange', true);
    await saveWithName();

    expect(productsStoreState.addProduct.mock.calls[0][0]).toMatchObject({
      isPhysicalExfoliant: true,
    });
  });
});

describe('editing an existing product', () => {
  it('loads isPhysicalExfoliant: true from the product into the toggle', () => {
    productsStoreState.products = [makeEditableProduct({ isPhysicalExfoliant: true })];

    renderScreen({ editingProductId: 'existing-1' });

    const toggle = screen.getByLabelText('Physical exfoliant');
    expect(toggle.props.accessibilityState?.checked).toBe(true);
  });

  it('loads isPhysicalExfoliant: false/absent from the product into the toggle', () => {
    productsStoreState.products = [makeEditableProduct()];

    renderScreen({ editingProductId: 'existing-1' });

    const toggle = screen.getByLabelText('Physical exfoliant');
    expect(toggle.props.accessibilityState?.checked).toBe(false);
  });

  it('persists a toggle flip to true on save in edit mode', async () => {
    productsStoreState.products = [makeEditableProduct()];
    renderScreen({ editingProductId: 'existing-1' });

    fireEvent(screen.getByLabelText('Physical exfoliant'), 'valueChange', true);
    fireEvent.press(screen.getByText('Save Changes'));
    await act(async () => Promise.resolve());

    expect(productsStoreState.updateProduct).toHaveBeenCalledTimes(1);
    expect(productsStoreState.updateProduct.mock.calls[0][1]).toMatchObject({
      isPhysicalExfoliant: true,
    });
  });

  it('preserves isPhysicalExfoliant: true on save when the toggle is left untouched while editing', async () => {
    productsStoreState.products = [makeEditableProduct({ isPhysicalExfoliant: true })];
    renderScreen({ editingProductId: 'existing-1' });

    fireEvent.press(screen.getByText('Save Changes'));
    await act(async () => Promise.resolve());

    expect(productsStoreState.updateProduct.mock.calls[0][1]).toMatchObject({
      isPhysicalExfoliant: true,
    });
  });
});
