/**
 * ProfileScreen — "Share my photos with Vials" Settings toggle (tech design
 * FE-5, spec Story 4). No ProfileScreen.test.tsx exists yet in this repo
 * (checked tests/ before writing this file), so this is the first coverage
 * of the screen — heavy siblings (debug cards, skin-profile edit modal) are
 * stubbed at the module boundary since they are out of scope here.
 *
 * The toggle itself, and the `contributionConsent` field it reads/writes,
 * don't exist on ProfileScreen/UserProfile yet — expected to fail to compile
 * until FE-1 and FE-5 land.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { UserProfile } from '@/types';

import { makeProfile } from './fixtures';

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return {
    Feather: ({ name, testID }: { name: string; testID?: string }) => (
      <View testID={testID ?? `feather-icon-${name}`} />
    ),
  };
});

jest.mock('@/components/debug/DebugAccountSyncCard', () => ({
  DebugAccountSyncCard: () => null,
}));
jest.mock('@/components/debug/DebugOnboardingPreview', () => ({
  DebugOnboardingPreview: () => null,
}));
jest.mock('@/components/profile/SkinProfileEditModal', () => ({
  SkinProfileEditModal: () => null,
}));

jest.mock('@/store/productsStore', () => ({
  useProductsStore: jest.fn((selector: any) => selector({ products: [] })),
}));
jest.mock('@/store/proceduresStore', () => ({
  useProceduresStore: jest.fn((selector: any) => selector({ procedures: [] })),
}));
jest.mock('@/store/routinesStore', () => ({
  useRoutinesStore: { getState: jest.fn(() => ({ routines: [] })) },
}));
jest.mock('@/store/settingsStore', () => ({
  useSettingsStore: jest.fn((selector: any) =>
    selector({
      gamificationEnabled: false,
      setGamificationEnabled: jest.fn(),
      routineCycleType: 'fixed',
    }),
  ),
}));

// Stateful profile mock: updateProfile really mutates and re-selects, so a
// rerender reflects the flipped toggle exactly like the zustand store would
// (mirrors tests/routine-engine/goal-confirm-routines-screen.test.tsx).
let mockProfile: UserProfile;
const mockUpdateProfile = jest.fn((patch: Partial<UserProfile>) => {
  mockProfile = { ...mockProfile, ...patch };
});
jest.mock('@/store/profileStore', () => ({
  useProfileStore: jest.fn((selector: any) =>
    selector({ profile: mockProfile, updateProfile: mockUpdateProfile }),
  ),
}));

import ProfileScreen from '@/screens/ProfileScreen';

const SWITCH_LABEL = 'Share my photos with Vials';

function renderScreen() {
  return render(<ProfileScreen />);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockProfile = makeProfile();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('ProfileScreen — contribution photo-sharing toggle (spec Story 4)', () => {
  it('renders the helper text under the Settings card', () => {
    renderScreen();

    expect(
      screen.getByText('Previously shared photos remain in the database.'),
    ).toBeTruthy();
  });

  it('is off when contributionConsent.granted is false', () => {
    mockProfile = makeProfile({
      contributionConsent: { granted: false, timestamp: null },
    });
    renderScreen();

    const toggle = screen.getByLabelText(SWITCH_LABEL);
    expect(toggle.props.accessibilityState?.checked).toBe(false);
  });

  it('is on when contributionConsent.granted is true', () => {
    mockProfile = makeProfile({
      contributionConsent: { granted: true, timestamp: '2026-01-01T00:00:00.000Z' },
    });
    renderScreen();

    const toggle = screen.getByLabelText(SWITCH_LABEL);
    expect(toggle.props.accessibilityState?.checked).toBe(true);
  });

  it('queries this exact switch by its accessibilityLabel, not by position, on a screen with several undifferentiated switches', () => {
    renderScreen();

    // Story 4 / tech-design assumption 5: getAllByRole('switch')[n] is
    // explicitly called out as fragile — this must resolve to exactly one
    // element via its dedicated label.
    expect(screen.getAllByLabelText(SWITCH_LABEL)).toHaveLength(1);
  });

  it('flips granted and records a new timestamp on toggle', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    mockProfile = makeProfile({
      contributionConsent: { granted: false, timestamp: null },
    });
    renderScreen();

    fireEvent.press(screen.getByLabelText(SWITCH_LABEL));

    expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
    const patch = mockUpdateProfile.mock.calls[0][0];
    expect(patch.contributionConsent!.granted).toBe(true);
    expect(patch.contributionConsent!.timestamp).toBe('2026-01-01T00:00:00.000Z');
  });

  it('updates the timestamp again on a second, later toggle change', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    mockProfile = makeProfile({
      contributionConsent: { granted: true, timestamp: '2025-06-01T00:00:00.000Z' },
    });
    const { rerender } = renderScreen();

    jest.setSystemTime(new Date('2026-02-02T12:00:00.000Z'));
    fireEvent.press(screen.getByLabelText(SWITCH_LABEL));

    expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
    const patch = mockUpdateProfile.mock.calls[0][0];
    expect(patch.contributionConsent!.granted).toBe(false);
    // Distinct from the profile's prior timestamp — every change is
    // timestamped, per spec Story 4.
    expect(patch.contributionConsent!.timestamp).toBe('2026-02-02T12:00:00.000Z');
    expect(patch.contributionConsent!.timestamp).not.toBe('2025-06-01T00:00:00.000Z');

    rerender(<ProfileScreen />);
  });
});
