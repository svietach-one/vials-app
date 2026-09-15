/**
 * AddProductScreen — "Help grow the Vials database" prompt insertion at the
 * save-success choke point (tech design FE-9, spec Story 3), plus the
 * `entryContext` onboarding exit branch (tech design FE-5/FE-9, spec Story 4
 * AC3). Mocking setup mirrors
 * tests/add-product-flow/AddProductScreen.integration.test.tsx, plus a
 * `profileStore` mock this task adds.
 *
 * Not yet implemented — today's `handleSave` neither reads
 * `profile.contributionConsent` nor branches on `route.params?.entryContext`;
 * this file is expected to fail red until FE-9 lands (see
 * .claude/rules/testing.md).
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => {
  const { Text: RNText } = require('react-native');
  return { Feather: ({ name }: { name: string }) => <RNText>{`icon-${name}`}</RNText> };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/components/camera/CameraCaptureModal', () => ({ CameraCaptureModal: () => null }));

jest.mock('@/services/productImage', () => ({
  pickAndStoreProductPhoto: jest.fn(),
  deleteProductPhoto: jest.fn(),
}));

jest.mock('@/utils/generateId', () => ({ generateId: () => 'fixed-product-id' }));

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

jest.mock('@/services/contributions', () => ({ submitContribution: jest.fn() }));

import { makeProfile } from './fixtures';
import type { UserProfile } from '@/types';

const mockUpdateProfile = jest.fn();
let mockProfile: UserProfile = makeProfile();

jest.mock('@/store/profileStore', () => ({
  useProfileStore: jest.fn((selector: any) =>
    selector({ profile: mockProfile, updateProfile: mockUpdateProfile }),
  ),
}));

const mockAddProduct: jest.Mock = jest.requireMock('@/store/productsStore').__state.addProduct;
const mockSubmitContribution: jest.Mock = jest.requireMock(
  '@/services/contributions',
).submitContribution;

import AddProductScreen from '@/screens/catalog/AddProductScreen';

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();

function renderScreen(routeParams: Record<string, unknown> = {}) {
  const navigation = { goBack: mockGoBack, navigate: mockNavigate } as never;
  return render(<AddProductScreen navigation={navigation} route={{ params: routeParams } as never} />);
}

function fillRequiredFields() {
  fireEvent.changeText(screen.getByLabelText('Brand'), 'CeraVe');
  fireEvent(screen.getByLabelText('Brand'), 'blur');
  fireEvent.changeText(screen.getByLabelText('Product name'), 'Foaming Cleanser');
  fireEvent.press(screen.getByLabelText('Cleanser'));
  fireEvent.press(screen.getByLabelText('Section 4: Usage details'));
  fireEvent.press(screen.getByLabelText('12M'));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSubmitContribution.mockResolvedValue({ status: 'success', withPhoto: false });
  mockProfile = makeProfile();
});

describe('grow-database prompt — first-ever save (contributionConsent.timestamp: null)', () => {
  it('saves locally first, then shows the prompt and defers navigating to Catalog', () => {
    renderScreen();
    fillRequiredFields();

    fireEvent.press(screen.getByText('Put on My Shelf'));

    expect(mockAddProduct).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Help grow the Vials database')).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalledWith('Catalog', expect.anything());
  });

  it('records granted:true with a fresh timestamp, then navigates to Catalog when "Agree and share" is pressed', () => {
    renderScreen();
    fillRequiredFields();
    fireEvent.press(screen.getByText('Put on My Shelf'));

    fireEvent.press(screen.getByText('Agree and share'));

    expect(mockUpdateProfile).toHaveBeenCalledWith({
      contributionConsent: { granted: true, timestamp: expect.any(String) },
    });
    expect(mockNavigate).toHaveBeenCalledWith(
      'Catalog',
      expect.objectContaining({ toast: expect.anything() }),
    );
  });

  it('records granted:false with a fresh timestamp, but still navigates to Catalog when "Not now" is pressed', () => {
    renderScreen();
    fillRequiredFields();
    fireEvent.press(screen.getByText('Put on My Shelf'));

    fireEvent.press(screen.getByText('Not now'));

    expect(mockUpdateProfile).toHaveBeenCalledWith({
      contributionConsent: { granted: false, timestamp: expect.any(String) },
    });
    expect(mockNavigate).toHaveBeenCalledWith(
      'Catalog',
      expect.objectContaining({ toast: expect.anything() }),
    );
  });
});

describe('grow-database prompt — already asked before (contributionConsent.timestamp set)', () => {
  it('never shows the prompt and navigates to Catalog immediately (spec Story 3 AC3)', () => {
    mockProfile = makeProfile({
      contributionConsent: { granted: true, timestamp: '2026-01-01T00:00:00.000Z' },
    });
    renderScreen();
    fillRequiredFields();

    fireEvent.press(screen.getByText('Put on My Shelf'));

    expect(screen.queryByText('Help grow the Vials database')).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith(
      'Catalog',
      expect.objectContaining({ toast: expect.anything() }),
    );
  });
});

describe('entryContext — onboarding exit branch (spec Story 4 AC3)', () => {
  it('completes onboarding instead of navigating to Catalog once the (due) prompt resolves', () => {
    renderScreen({ entryContext: 'onboarding' });
    fillRequiredFields();
    fireEvent.press(screen.getByText('Put on My Shelf'));
    expect(screen.getByText('Help grow the Vials database')).toBeTruthy();

    fireEvent.press(screen.getByText('Not now'));

    expect(mockUpdateProfile).toHaveBeenCalledWith({ onboardingCompleted: true });
    expect(mockNavigate).not.toHaveBeenCalledWith('Catalog', expect.anything());
  });

  it('completes onboarding immediately, with no prompt, when consent was already asked', () => {
    mockProfile = makeProfile({
      contributionConsent: { granted: false, timestamp: '2026-01-01T00:00:00.000Z' },
    });
    renderScreen({ entryContext: 'onboarding' });
    fillRequiredFields();

    fireEvent.press(screen.getByText('Put on My Shelf'));

    expect(screen.queryByText('Help grow the Vials database')).toBeNull();
    expect(mockUpdateProfile).toHaveBeenCalledWith({ onboardingCompleted: true });
    expect(mockNavigate).not.toHaveBeenCalledWith('Catalog', expect.anything());
  });
});
