/**
 * ManualProductFormScreen — "Help grow the Vials database" prompt insertion
 * at the `finishSave` choke point (tech design FE-9, spec Story 3), scoped to
 * genuinely manual saves only and sequenced strictly AFTER the pre-existing
 * per-product cadence modal (`ContributionConsentModal`) resolves — "only one
 * modal is ever visible at a time" (spec §5). Also covers the `entryContext`
 * onboarding exit branch (spec Story 4 AC3).
 *
 * Base mocking mirrors
 * tests/contribution-consent-flow/ManualProductFormScreen.test.tsx, except
 * `RoutineSchedulerSheet` is mocked here as an INTERACTIVE stand-in (a
 * pressable "close scheduler" trigger for its `onClose`) rather than `() =>
 * null`, because `finishSave` — the choke point this task modifies — is only
 * reached from the scheduler sheet's `onClose`, never directly from
 * `handleSave`.
 *
 * Not yet implemented — `finishSave` doesn't read `profile.contributionConsent`
 * or branch on `route.params?.entryContext` today; this file is expected to
 * fail red until FE-9 lands (see .claude/rules/testing.md).
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

jest.mock('@/components/routine/RoutineSchedulerSheet', () => {
  const { Pressable, Text } = require('react-native');
  return {
    RoutineSchedulerSheet: ({ visible, onClose }: { visible: boolean; onClose: () => void }) =>
      visible ? (
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="close scheduler">
          <Text>close-scheduler</Text>
        </Pressable>
      ) : null,
  };
});

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

import { makeCorpusProduct, makeProfile } from './fixtures';
import type { UserProfile } from '@/types';

const mockUpdateProfile = jest.fn();
let mockProfile: UserProfile = makeProfile();

jest.mock('@/store/profileStore', () => ({
  useProfileStore: jest.fn((selector: any) =>
    selector({ profile: mockProfile, updateProfile: mockUpdateProfile }),
  ),
}));

const mockSubmit: jest.Mock = jest.requireMock('@/services/contributions').submitContribution;

import ManualProductFormScreen from '@/screens/ManualProductFormScreen';
import { useSettingsStore } from '@/store/settingsStore';

const mockNavigate = jest.fn();

function renderScreen(params: Record<string, unknown> = {}) {
  const navigation = { goBack: jest.fn(), navigate: mockNavigate } as never;
  return render(<ManualProductFormScreen navigation={navigation} route={{ params } as never} />);
}

async function saveWithName(name = 'Night Serum') {
  fireEvent.changeText(screen.getByPlaceholderText(/Daily Moisturiser/), name);
  fireEvent.press(screen.getByText('Put on My Shelf'));
  await act(async () => Promise.resolve());
}

function closeScheduler() {
  fireEvent.press(screen.getByText('close-scheduler'));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSubmit.mockResolvedValue({ status: 'success', withPhoto: false });
  mockProfile = makeProfile();
  // 'disabled' keeps the PER-PRODUCT cadence modal out of the way so most
  // cases below isolate the NEW grow-database-prompt behaviour; the
  // sequencing describe block below re-enables it deliberately.
  useSettingsStore.setState({
    contributionConsentStatus: 'disabled',
    declinedSaveCountSinceLastReminder: 0,
    reminderCountShown: 0,
  });
});

describe('grow-database prompt — first-ever genuinely manual save (contributionConsent.timestamp: null)', () => {
  it('does not appear before the scheduler sheet closes', async () => {
    renderScreen();
    await saveWithName();

    expect(screen.getByText('close-scheduler')).toBeTruthy();
    expect(screen.queryByText('Help grow the Vials database')).toBeNull();
  });

  it('appears once the scheduler closes, and defers navigating to Catalog', async () => {
    renderScreen();
    await saveWithName();

    closeScheduler();

    expect(screen.getByText('Help grow the Vials database')).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalledWith('Catalog', expect.anything());
  });

  it('records granted:true, then navigates to Catalog with the usual toast when "Agree and share" is pressed', async () => {
    renderScreen();
    await saveWithName();
    closeScheduler();

    fireEvent.press(screen.getByText('Agree and share'));

    expect(mockUpdateProfile).toHaveBeenCalledWith({
      contributionConsent: { granted: true, timestamp: expect.any(String) },
    });
    expect(mockNavigate).toHaveBeenCalledWith(
      'Catalog',
      expect.objectContaining({ toast: expect.anything() }),
    );
  });

  it('records granted:false, but still navigates to Catalog when "Not now" is pressed', async () => {
    renderScreen();
    await saveWithName();
    closeScheduler();

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

describe('grow-database prompt — sequencing with the pre-existing per-product cadence modal (spec §5, Non-Goals)', () => {
  it('shows the cadence modal first, then the grow-database prompt only after it resolves — never both at once', async () => {
    useSettingsStore.setState({ contributionConsentStatus: 'unset' });
    renderScreen();
    await saveWithName();

    expect(screen.getByText('Make adding products easier for everyone.')).toBeTruthy();
    expect(screen.queryByText('Help grow the Vials database')).toBeNull();

    fireEvent.press(screen.getByText('Continue'));
    await act(async () => Promise.resolve());

    // Scheduler now open; the grow-database prompt still must not race ahead of it.
    expect(screen.queryByText('Help grow the Vials database')).toBeNull();

    closeScheduler();

    expect(screen.getByText('Help grow the Vials database')).toBeTruthy();
    expect(screen.queryByText('Make adding products easier for everyone.')).toBeNull();
  });
});

describe('grow-database prompt — corpus-prefilled saves never trigger it (spec Story 3 AC4)', () => {
  it('never shows the prompt for a search/corpus-prefilled save, even on a first-ever save', async () => {
    renderScreen({ prefillCorpusProduct: makeCorpusProduct() });
    await saveWithName();
    closeScheduler();

    expect(screen.queryByText('Help grow the Vials database')).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith(
      'Catalog',
      expect.objectContaining({ toast: expect.anything() }),
    );
  });
});

describe('grow-database prompt — already asked before (contributionConsent.timestamp set)', () => {
  it('never appears; closing the scheduler navigates straight to Catalog', async () => {
    mockProfile = makeProfile({
      contributionConsent: { granted: true, timestamp: '2026-01-01T00:00:00.000Z' },
    });
    renderScreen();
    await saveWithName();
    closeScheduler();

    expect(screen.queryByText('Help grow the Vials database')).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith(
      'Catalog',
      expect.objectContaining({ toast: expect.anything() }),
    );
  });
});

describe('entryContext — onboarding exit branch (spec Story 4 AC3)', () => {
  it('completes onboarding instead of navigating to Catalog once the (due) prompt resolves', async () => {
    renderScreen({ entryContext: 'onboarding' });
    await saveWithName();
    closeScheduler();
    expect(screen.getByText('Help grow the Vials database')).toBeTruthy();

    fireEvent.press(screen.getByText('Not now'));

    expect(mockUpdateProfile).toHaveBeenCalledWith({ onboardingCompleted: true });
    expect(mockNavigate).not.toHaveBeenCalledWith('Catalog', expect.anything());
  });

  it('completes onboarding immediately once the scheduler closes, with no prompt, when consent was already asked', async () => {
    mockProfile = makeProfile({
      contributionConsent: { granted: false, timestamp: '2026-01-01T00:00:00.000Z' },
    });
    renderScreen({ entryContext: 'onboarding' });
    await saveWithName();
    closeScheduler();

    expect(screen.queryByText('Help grow the Vials database')).toBeNull();
    expect(mockUpdateProfile).toHaveBeenCalledWith({ onboardingCompleted: true });
    expect(mockNavigate).not.toHaveBeenCalledWith('Catalog', expect.anything());
  });
});
