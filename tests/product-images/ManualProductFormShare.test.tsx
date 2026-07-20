/**
 * Integration tests — community-share states in ManualProductFormScreen
 * (US-3 MVP). Contract: the local shelf save is committed synchronously and is
 * never rolled back by a share outcome, and each share outcome gets its own
 * honest, distinguishable surface.
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
  const state = { products: [], addProduct: jest.fn(), updateProduct: jest.fn() };
  const useProductsStore = (selector: (s: typeof state) => unknown) => selector(state);
  useProductsStore.getState = () => state;
  return { useProductsStore, __state: state };
});

const mockAddProduct: jest.Mock = jest.requireMock('@/store/productsStore').__state.addProduct;
const mockSubmit: jest.Mock = jest.requireMock('@/services/contributions').submitContribution;
const mockRenderBlob: jest.Mock =
  jest.requireMock('@/services/productImage').renderContributionBlob;

import ManualProductFormScreen from '@/screens/ManualProductFormScreen';

function renderScreen() {
  const navigation = { goBack: jest.fn(), navigate: jest.fn() } as never;
  return render(
    <ManualProductFormScreen navigation={navigation} route={{ params: {} } as never} />,
  );
}

async function saveWithName(name = 'Night Serum') {
  // The Input's `label` renders as plain Text, so target the field itself.
  fireEvent.changeText(screen.getByPlaceholderText(/Daily Moisturiser/), name);
  fireEvent.press(screen.getByText('Add to Catalog'));
  await act(async () => Promise.resolve());
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRenderBlob.mockResolvedValue(null);
  mockSubmit.mockResolvedValue({ status: 'success', withPhoto: false });
});

describe('community share states', () => {
  it('confirms a successful share that included a photo', async () => {
    mockSubmit.mockResolvedValue({ status: 'success', withPhoto: true });
    renderScreen();

    await saveWithName();

    expect(screen.getByTestId('share-status-success')).toBeTruthy();
    expect(screen.getByText(/with your photo/)).toBeTruthy();
  });

  it('says so explicitly when the product was shared without a photo', async () => {
    mockSubmit.mockResolvedValue({ status: 'success', withPhoto: false });
    renderScreen();

    await saveWithName();

    expect(screen.getByText(/text only, no photo attached/)).toBeTruthy();
  });

  it('shows a failure state with a retry — never a fake success', async () => {
    mockSubmit.mockResolvedValue({ status: 'error', message: 'network down' });
    renderScreen();

    await saveWithName();

    expect(screen.getByTestId('share-status-error')).toBeTruthy();
    expect(screen.queryByTestId('share-status-success')).toBeNull();
    expect(screen.getByText('Try again')).toBeTruthy();
  });

  it('distinguishes "unavailable in this build" from a failure, with no retry', async () => {
    mockSubmit.mockResolvedValue({ status: 'unavailable' });
    renderScreen();

    await saveWithName();

    expect(screen.getByTestId('share-status-unavailable')).toBeTruthy();
    expect(screen.queryByTestId('share-status-error')).toBeNull();
    // Retrying cannot help here, so it is not offered.
    expect(screen.queryByText('Try again')).toBeNull();
  });

  it('commits the local shelf save even when the share fails', async () => {
    mockSubmit.mockResolvedValue({ status: 'error', message: 'network down' });
    renderScreen();

    await saveWithName('Retinol Serum');

    // The local save is synchronous and independent of the share outcome.
    expect(mockAddProduct).toHaveBeenCalledTimes(1);
    expect(mockAddProduct.mock.calls[0][0]).toMatchObject({ name: 'Retinol Serum' });
    expect(screen.getByTestId('share-status-error')).toBeTruthy();
  });

  it('commits the local shelf save even when the share throws', async () => {
    mockSubmit.mockRejectedValue(new Error('boom'));
    renderScreen();

    await saveWithName();

    expect(mockAddProduct).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('share-status-error')).toBeTruthy();
  });

  it('retries the share on demand after a failure', async () => {
    mockSubmit.mockResolvedValue({ status: 'error', message: 'network down' });
    renderScreen();
    await saveWithName();

    mockSubmit.mockResolvedValue({ status: 'success', withPhoto: false });
    fireEvent.press(screen.getByText('Try again'));
    await act(async () => Promise.resolve());

    expect(mockSubmit).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('share-status-success')).toBeTruthy();
  });

  it('never sends a device file path as the photo', async () => {
    renderScreen();
    await saveWithName();

    // The blob comes from the EXIF-stripping manipulator, and localImageUri
    // is not part of the outbound payload.
    const [payload, blob] = mockSubmit.mock.calls[0];
    expect(payload).not.toHaveProperty('localImageUri');
    expect(typeof blob === 'string').toBe(false);
  });
});
