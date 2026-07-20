/**
 * RoutinesScreen ↔ GoalConfirmBanner integration (V2.1 phase-03 AC: "prompt
 * shown exactly once"). The one-time behavior is host-owned: the banner
 * renders only while profile.goalNeedsConfirmation is true; Confirm clears
 * the flag through the store, so the next render drops it for good.
 *
 * Mock scaffold mirrors tests/routines/routines-screen-hidden-filter.test.tsx
 * (same module boundaries), with a STATEFUL profile-store mock so the
 * confirm → flag-cleared → banner-gone loop runs against real host logic.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { UserProfile } from '@/types';

jest.mock('@react-navigation/native', () => {
  const ReactActual = require('react');
  return {
    useFocusEffect: (cb: () => void | (() => void)) => {
      ReactActual.useEffect(() => {
        const cleanup = cb();
        return typeof cleanup === 'function' ? cleanup : undefined;
      }, []);
    },
  };
});

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return {
    Feather: ({ name, testID }: { name: string; testID?: string }) => (
      <View testID={testID ?? `feather-icon-${name}`} />
    ),
  };
});

jest.mock('react-native-draggable-flatlist', () => {
  const { View } = require('react-native');
  function DraggableFlatList({ data, renderItem, keyExtractor, ListEmptyComponent, ListHeaderComponent, ListFooterComponent }: any) {
    return (
      <View testID="draggable-flat-list">
        {ListHeaderComponent}
        {data.length === 0
          ? ListEmptyComponent
          : data.map((item: any, index: number) => (
              <View key={keyExtractor ? keyExtractor(item, index) : index}>
                {renderItem({ item, drag: () => {}, isActive: false, getIndex: () => index })}
              </View>
            ))}
        {ListFooterComponent}
      </View>
    );
  }
  const ScaleDecorator = ({ children }: any) => children;
  return { __esModule: true, default: DraggableFlatList, ScaleDecorator };
});

jest.mock('@/components/routine/AddToRoutineSheet', () => ({ AddToRoutineSheet: () => null }));
jest.mock('@/components/routine/DraftPreviewSheet', () => ({ DraftPreviewSheet: () => null }));
jest.mock('@/components/routine/RemoveStepModal', () => ({ RemoveStepModal: () => null }));
jest.mock('@/components/routine/ClinicalRestrictionsBlock', () => ({ ClinicalRestrictionsBlock: () => null }));
jest.mock('@/components/routine/SeasonalNoticeBanner', () => ({ SeasonalNoticeBanner: () => null }));
jest.mock('@/components/routine/PlannerBlock', () => ({ PlannerBlock: () => null }));
jest.mock('@/components/routine/RoutineStepCard', () => ({ RoutineStepCard: () => null }));

jest.mock('@/domain/routinePlanActions', () => ({
  validateCurrentRoutines: jest.fn(() => ({
    findings: [],
    hasBlockingFindings: false,
    proposedPlan: {
      rulesetVersion: 'test',
      generatedFor: '2026-01-01',
      periods: { morning: [], evening: [] },
      frozen: [],
      reserve: [],
      placeholders: [],
      decisions: [],
    },
    diff: [],
  })),
  applyRoutinePlan: jest.fn(),
}));
jest.mock('@/domain/seasonActions', () => ({
  getActiveSeasonMask: jest.fn(() => ({ season: 'spring', source: 'calendar' })),
}));

jest.mock('@/store/productsStore', () => ({
  useProductsStore: jest.fn((selector: any) => selector({ products: [] })),
}));
jest.mock('@/store/routinesStore', () => ({
  useRoutinesStore: jest.fn((selector: any) =>
    selector({
      routines: [],
      reorderSteps: jest.fn(),
      removeStepFromDay: jest.fn(),
      removeProductStep: jest.fn(),
    }),
  ),
}));
jest.mock('@/store/proceduresStore', () => ({
  useProceduresStore: jest.fn((selector: any) => selector({ procedures: [] })),
}));
jest.mock('@/store/settingsStore', () => ({
  useSettingsStore: jest.fn((selector: any) => selector({ routineCycleType: 'fixed' })),
}));
jest.mock('@/store/trackingStore', () => ({
  useTrackingStore: jest.fn((selector: any) => selector({ applicationStats: [] })),
}));

// Stateful profile mock: updateProfile really mutates, so a rerender reflects
// the cleared flag exactly like the zustand store would.
let mockProfile: UserProfile;
const mockUpdateProfile = jest.fn((patch: Partial<UserProfile>) => {
  mockProfile = { ...mockProfile, ...patch };
});
jest.mock('@/store/profileStore', () => ({
  useProfileStore: jest.fn((selector: any) =>
    selector({ profile: mockProfile, updateProfile: mockUpdateProfile }),
  ),
}));

import RoutinesScreen from '@/screens/RoutinesScreen';

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'local-user',
    gender: null,
    age: null,
    skinType: null,
    phototype: null,
    fitzpatrick: null,
    city: null,
    concerns: ['wrinkles'],
    primaryGoal: 'aging',
    secondaryGoal: null,
    goalNeedsConfirmation: true,
    phototypeNeedsConfirmation: false,
    spfSensitivity: false,
    onboardingCompleted: true,
    individualDurationMonths: {},
    contributionConsent: { granted: false, timestamp: null },
    ...overrides,
  };
}

function renderScreen(navigate = jest.fn()) {
  return {
    navigate,
    ...render(
      <RoutinesScreen
        navigation={{ navigate, setOptions: jest.fn() } as any}
        route={{} as any}
      />,
    ),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockProfile = makeProfile();
});

describe('RoutinesScreen — goal confirmation banner', () => {
  it('shows the banner with the derived goal label while confirmation is pending', () => {
    renderScreen();

    expect(screen.getByText('Confirm your care goal')).toBeTruthy();
    expect(screen.getByText(/Anti-aging/)).toBeTruthy();
  });

  it('does not show the banner when the goal is already confirmed', () => {
    mockProfile = makeProfile({ goalNeedsConfirmation: false });
    renderScreen();

    expect(screen.queryByText('Confirm your care goal')).toBeNull();
  });

  it('clears the flag on Confirm and never shows the banner again', () => {
    const { rerender, navigate } = renderScreen();

    fireEvent.press(screen.getByText('Confirm'));

    expect(mockUpdateProfile).toHaveBeenCalledWith({ goalNeedsConfirmation: false });
    rerender(
      <RoutinesScreen
        navigation={{ navigate, setOptions: jest.fn() } as any}
        route={{} as any}
      />,
    );
    expect(screen.queryByText('Confirm your care goal')).toBeNull();
  });

  it('routes to the Profile tab on Change', () => {
    const { navigate } = renderScreen();

    fireEvent.press(screen.getByText('Change'));

    expect(navigate).toHaveBeenCalledWith('Profile');
  });
});
