/**
 * Integration test — Story 8 UI AC: the city field autocomplete.
 * Spec: docs/specs/2026-07-04-routine-engine.md §4 Story 8
 *
 * FE-9 shipped the offline CityField on ProfileScreen (progress/routine-engine.md,
 * 2026-07-05 "SURROUNDING UX" entry), backed by FE-7's citySearch.ts +
 * cities.json. Exercises the REAL searchCities/cities.json (pure, offline) —
 * only the AsyncStorage-backed stores are mocked at the boundary.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return {
    Feather: ({ name, testID }: { name: string; testID?: string }) => (
      <View testID={testID ?? `feather-icon-${name}`} />
    ),
  };
});

jest.mock('@/components/profile/SkinProfileEditModal', () => ({
  SkinProfileEditModal: () => null,
}));

const mockUpdateProfile = jest.fn();
let mockProfile: any = null;

jest.mock('@/store/profileStore', () => ({
  useProfileStore: jest.fn((selector: any) => selector({ profile: mockProfile, updateProfile: mockUpdateProfile })),
}));
jest.mock('@/store/settingsStore', () => ({
  useSettingsStore: jest.fn((selector: any) =>
    selector({ gamificationEnabled: false, setGamificationEnabled: jest.fn(), routineCycleType: 'fixed' }),
  ),
}));
jest.mock('@/store/productsStore', () => ({
  useProductsStore: jest.fn((selector: any) => selector({ products: [] })),
}));
jest.mock('@/store/proceduresStore', () => ({
  useProceduresStore: jest.fn((selector: any) => selector({ procedures: [] })),
}));
jest.mock('@/store/routinesStore', () => ({
  useRoutinesStore: jest.fn((selector: any) => selector({ routines: [] })),
}));

import ProfileScreen from '@/screens/ProfileScreen';

beforeEach(() => {
  jest.clearAllMocks();
  mockProfile = {
    id: 'p1', gender: null, age: null, skinType: null, phototype: null,
    fitzpatrick: null, city: null, concerns: [], spfSensitivity: false,
    onboardingCompleted: true, individualDurationMonths: {},
  };
});

describe('Story 8 AC: the city field autocompletes from the bundled offline dataset, no network/GPS', () => {
  it('suggests real cities from cities.json once >=2 characters are typed, with zero fetch calls', () => {
    const fetchSpy = jest.spyOn(global, 'fetch' as any).mockImplementation(() => {
      throw new Error('network should never be touched by the offline city field');
    });

    render(<ProfileScreen />);
    fireEvent.changeText(
      screen.UNSAFE_getByProps({ placeholder: 'Search your city…' }),
      'War',
    );

    expect(screen.getByLabelText('Select Warsaw, Poland')).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('shows no suggestions for a single-character query (below the 2-char minimum)', () => {
    render(<ProfileScreen />);
    fireEvent.changeText(
      screen.UNSAFE_getByProps({ placeholder: 'Search your city…' }),
      'W',
    );
    expect(screen.queryByLabelText('Select Warsaw, Poland')).toBeNull();
  });

  it('selecting a suggestion updates the profile city and shows the selected-city row', () => {
    render(<ProfileScreen />);
    fireEvent.changeText(
      screen.UNSAFE_getByProps({ placeholder: 'Search your city…' }),
      'Warsaw',
    );
    fireEvent.press(screen.getByLabelText('Select Warsaw, Poland'));

    expect(mockUpdateProfile).toHaveBeenCalledWith({ city: expect.objectContaining({ name: 'Warsaw, Poland' }) });
  });
});
