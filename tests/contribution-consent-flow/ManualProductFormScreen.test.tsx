/**
 * Integration tests — product-contribution consent wiring in
 * ManualProductFormScreen (US-24, docs/specs/contribution-consent-flow/).
 * Uses the real settingsStore (reset per test) so the cadence state machine
 * is exercised for real, not just through the pure-function unit tests.
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
  const state = { products: [] as unknown[], addProduct: jest.fn(), updateProduct: jest.fn() };
  const useProductsStore = (selector: (s: typeof state) => unknown) => selector(state);
  useProductsStore.getState = () => state;
  return { useProductsStore, __state: state };
});

const mockAddProduct: jest.Mock = jest.requireMock('@/store/productsStore').__state.addProduct;
const mockSubmit: jest.Mock = jest.requireMock('@/services/contributions').submitContribution;

import ManualProductFormScreen from '@/screens/ManualProductFormScreen';
import { useSettingsStore } from '@/store/settingsStore';

function renderScreen() {
  const navigation = { goBack: jest.fn(), navigate: jest.fn() } as never;
  return render(
    <ManualProductFormScreen navigation={navigation} route={{ params: {} } as never} />,
  );
}

async function saveWithName(name = 'Night Serum') {
  fireEvent.changeText(screen.getByPlaceholderText(/Daily Moisturiser/), name);
  fireEvent.press(screen.getByText('Add to Catalog'));
  await act(async () => Promise.resolve());
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSubmit.mockResolvedValue({ status: 'success', withPhoto: false });
  // Real settingsStore is a module-level singleton — reset the cadence state
  // fresh for every test instead of mocking it, so the state machine runs for real.
  useSettingsStore.setState({
    contributionConsentStatus: 'unset',
    declinedSaveCountSinceLastReminder: 0,
    reminderCountShown: 0,
  });
});

describe('first manual save ever (status: unset)', () => {
  it('shows the first-time modal and does not share before it resolves', async () => {
    renderScreen();
    await saveWithName();

    expect(screen.getByText('Make adding products easier for everyone.')).toBeTruthy();
    expect(mockAddProduct).toHaveBeenCalledTimes(1);
    expect(mockAddProduct.mock.calls[0][0]).toMatchObject({ contributionOptIn: false });
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('accepting the modal sets status to accepted and shares the product', async () => {
    renderScreen();
    await saveWithName();

    fireEvent.press(screen.getByText('Continue'));
    await act(async () => Promise.resolve());

    expect(useSettingsStore.getState().contributionConsentStatus).toBe('accepted');
    expect(mockSubmit).toHaveBeenCalledTimes(1);
  });

  it('declining the modal sets status to declined and never shares', async () => {
    renderScreen();
    await saveWithName();

    fireEvent.press(screen.getByText('Not now'));
    await act(async () => Promise.resolve());

    expect(useSettingsStore.getState().contributionConsentStatus).toBe('declined');
    expect(mockSubmit).not.toHaveBeenCalled();
  });
});

describe('subsequent saves while declined', () => {
  it('shows only the inline toggle (no modal) below the reminder threshold, and counts the decline', async () => {
    useSettingsStore.setState({ contributionConsentStatus: 'declined' });
    renderScreen();
    await saveWithName();

    expect(screen.getByText('Share with Vials')).toBeTruthy();
    expect(screen.queryByText('Still building the Vials shelf.')).toBeNull();
    expect(useSettingsStore.getState().declinedSaveCountSinceLastReminder).toBe(1);
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('shows the reminder modal on the 5th declined save and resets the counters', async () => {
    useSettingsStore.setState({
      contributionConsentStatus: 'declined',
      declinedSaveCountSinceLastReminder: 4,
      reminderCountShown: 0,
    });
    renderScreen();
    await saveWithName();

    expect(screen.getByText('Still building the Vials shelf.')).toBeTruthy();
    expect(useSettingsStore.getState().declinedSaveCountSinceLastReminder).toBe(0);
    expect(useSettingsStore.getState().reminderCountShown).toBe(1);
  });

  it('turning the inline toggle on shares immediately and flips status to accepted', async () => {
    useSettingsStore.setState({ contributionConsentStatus: 'declined' });
    renderScreen();

    fireEvent(screen.getByLabelText('Share with Vials'), 'valueChange', true);
    await saveWithName();

    expect(mockSubmit).toHaveBeenCalledTimes(1);
    expect(useSettingsStore.getState().contributionConsentStatus).toBe('accepted');
  });
});

describe('disabled status', () => {
  it('hides the toggle, shows no modal, and never shares', async () => {
    useSettingsStore.setState({ contributionConsentStatus: 'disabled' });
    renderScreen();
    await saveWithName();

    expect(screen.queryByText('Share with Vials')).toBeNull();
    expect(screen.queryByText('Make adding products easier for everyone.')).toBeNull();
    expect(mockAddProduct.mock.calls[0][0]).toMatchObject({ contributionOptIn: false });
    expect(mockSubmit).not.toHaveBeenCalled();
  });
});
