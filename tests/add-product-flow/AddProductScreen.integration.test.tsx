/**
 * Integration tests — AddProductScreen (tasks 08/09, QA task 10).
 * Covers: accordion single-expansion, save-validation UX (expand first
 * incomplete section + inline message, no dialog), the local-first save
 * contract (synchronous store write → immediate goBack, suggest fired but
 * never awaited, failures silent), and discard confirmation.
 */
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => {
  const { Text: RNText } = require('react-native');
  return {
    Feather: ({ name }: { name: string }) => <RNText>{`icon-${name}`}</RNText>,
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Heavy native boundary — the camera modal is out of scope here.
jest.mock('@/components/camera/CameraCaptureModal', () => ({
  CameraCaptureModal: () => null,
}));

// State lives INSIDE each factory (module-body variables are unreliable in
// hoisted factories); tests reach it back out via jest.requireMock.
jest.mock('@/store/productsStore', () => {
  const state = { products: [], addProduct: jest.fn() };
  const useProductsStore = (selector: (s: typeof state) => unknown) => selector(state);
  useProductsStore.getState = () => state;
  return { useProductsStore, __state: state };
});

jest.mock('@/store/settingsStore', () => {
  const state = { communityContributionCount: 0, incrementCommunityContribution: jest.fn() };
  return {
    useSettingsStore: (selector: (s: typeof state) => unknown) => selector(state),
    __state: state,
  };
});

jest.mock('@/services/contributions', () => ({
  submitContribution: jest.fn(),
}));

const mockAddProduct: jest.Mock = jest.requireMock('@/store/productsStore').__state.addProduct;
const mockSubmitContribution: jest.Mock = jest.requireMock(
  '@/services/contributions',
).submitContribution;

import AddProductScreen from '@/screens/catalog/AddProductScreen';

const mockGoBack = jest.fn();
function renderScreen() {
  const navigation = { goBack: mockGoBack, navigate: jest.fn() } as never;
  return render(<AddProductScreen navigation={navigation} route={{} as never} />);
}

/** Drives the UI through Section 1 + PAO so canSave passes. */
function fillRequiredFields() {
  fireEvent.changeText(screen.getByLabelText('Brand'), 'CeraVe');
  fireEvent(screen.getByLabelText('Brand'), 'blur');
  fireEvent.changeText(screen.getByLabelText('Product name'), 'Foaming Cleanser');
  fireEvent.press(screen.getByLabelText('Cleanser'));
  // Open Section 4 and pick a PAO preset.
  fireEvent.press(screen.getByLabelText('Section 4: Usage details'));
  fireEvent.press(screen.getByLabelText('12M'));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSubmitContribution.mockResolvedValue({ status: 'success', withPhoto: false });
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

describe('accordion behaviour', () => {
  it('renders all four sections with Section 1 expanded initially', () => {
    renderScreen();

    expect(screen.getByLabelText('Section 1: Brand, name, and category')).toBeTruthy();
    expect(screen.getByLabelText('Section 2: Barcode')).toBeTruthy();
    expect(screen.getByLabelText('Section 3: Ingredients')).toBeTruthy();
    expect(screen.getByLabelText('Section 4: Usage details')).toBeTruthy();
    // Section 1 body is visible, Section 3's is not.
    expect(screen.getByLabelText('Brand')).toBeTruthy();
    expect(screen.queryByLabelText('Scan INCI list')).toBeNull();
  });

  it('keeps a single section expanded at a time', () => {
    renderScreen();

    fireEvent.press(screen.getByLabelText('Section 3: Ingredients'));

    expect(screen.getByLabelText('Scan INCI list')).toBeTruthy();
    expect(screen.queryByLabelText('Brand')).toBeNull();
  });
});

describe('save validation UX', () => {
  it('expands Section 1 with an inline message when saving an empty draft', () => {
    renderScreen();
    // Move away from Section 1 first so the auto-expand is observable.
    fireEvent.press(screen.getByLabelText('Section 3: Ingredients'));

    fireEvent.press(screen.getByText('Save and put on shelf'));

    expect(screen.getByText('Add a brand, name, and category to continue.')).toBeTruthy();
    expect(screen.getByLabelText('Brand')).toBeTruthy();
    expect(mockAddProduct).not.toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
    // No dialog — inline only.
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('targets Section 4 when only the PAO is missing', () => {
    renderScreen();
    fireEvent.changeText(screen.getByLabelText('Brand'), 'CeraVe');
    fireEvent(screen.getByLabelText('Brand'), 'blur');
    fireEvent.changeText(screen.getByLabelText('Product name'), 'Foaming Cleanser');
    fireEvent.press(screen.getByLabelText('Cleanser'));

    fireEvent.press(screen.getByText('Save and put on shelf'));

    expect(screen.getByText('Pick a period-after-opening (PAO) to continue.')).toBeTruthy();
    expect(mockAddProduct).not.toHaveBeenCalled();
  });
});

describe('local-first save', () => {
  it('writes to productsStore synchronously and leaves before the suggest call resolves', () => {
    // A suggest promise that never resolves during the test: goBack firing
    // proves nothing in the save path awaits the network.
    mockSubmitContribution.mockReturnValue(new Promise(() => undefined));
    renderScreen();
    fillRequiredFields();

    fireEvent.press(screen.getByText('Save and put on shelf'));

    expect(mockAddProduct).toHaveBeenCalledTimes(1);
    const saved = mockAddProduct.mock.calls[0][0];
    expect(saved).toMatchObject({
      name: 'Foaming Cleanser',
      brand: 'CeraVe',
      productType: 'cleanser',
      paoMonths: 12,
      openedDate: null,
      barcode: null,
      source: 'user_local',
    });
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(mockSubmitContribution).toHaveBeenCalledTimes(1);
  });

  it('saves with zero actives and no barcode — neither is an error state', () => {
    renderScreen();
    fillRequiredFields();

    fireEvent.press(screen.getByText('Save and put on shelf'));

    const saved = mockAddProduct.mock.calls[0][0];
    expect(saved.activeTags).toEqual([]);
    expect(saved.barcode).toBeNull();
    expect(mockGoBack).toHaveBeenCalled();
  });

  // Contribution failures are SURFACED, not swallowed. The old behaviour
  // (console.warn only) told the user nothing had gone wrong when it had.
  it('surfaces a failed contribution while leaving the local save intact', async () => {
    mockSubmitContribution.mockResolvedValue({ status: 'error', message: 'offline' });
    renderScreen();
    fillRequiredFields();

    fireEvent.press(screen.getByText('Save and put on shelf'));
    await act(async () => Promise.resolve());

    // Local save and navigation are unaffected…
    expect(mockAddProduct).toHaveBeenCalledTimes(1);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    // …and the failure is reported rather than hidden.
    expect(Alert.alert).toHaveBeenCalledWith(
      expect.stringContaining('share'),
      expect.stringContaining('saved on your shelf'),
    );
  });

  it('stays silent when sharing is unavailable in this build', async () => {
    mockSubmitContribution.mockResolvedValue({ status: 'unavailable' });
    renderScreen();
    fillRequiredFields();

    fireEvent.press(screen.getByText('Save and put on shelf'));
    await act(async () => Promise.resolve());

    // Nothing the user did failed, and this screen has already closed — the
    // edit form states it explicitly instead.
    expect(mockAddProduct).toHaveBeenCalledTimes(1);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('does not send any identifying field in the contribution payload', async () => {
    renderScreen();
    fillRequiredFields();

    fireEvent.press(screen.getByText('Save and put on shelf'));
    await act(async () => Promise.resolve());

    const [payload, blob] = mockSubmitContribution.mock.calls[0];
    // Product metadata only — the anonymity rule (PRD architecture constraint).
    expect(Object.keys(payload).sort()).toEqual(
      ['barcode', 'brand', 'inciRaw', 'name', 'productType', 'status'].sort(),
    );
    // Local-only fields must never leave the device.
    expect(payload).not.toHaveProperty('openedDate');
    expect(payload).not.toHaveProperty('paoMonths');
    expect(payload).not.toHaveProperty('localImageUri');
    // The wizard carries no photo.
    expect(blob).toBeNull();
  });
});

describe('discard confirmation', () => {
  it('closes immediately when the draft is still empty', () => {
    renderScreen();

    fireEvent.press(screen.getByLabelText('Close'));

    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('asks for confirmation once any field is filled', () => {
    renderScreen();
    fireEvent.changeText(screen.getByLabelText('Product name'), 'Foaming Cleanser');

    fireEvent.press(screen.getByLabelText('Close'));

    expect(mockGoBack).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Discard this product?',
      expect.any(String),
      expect.any(Array),
    );
  });
});
