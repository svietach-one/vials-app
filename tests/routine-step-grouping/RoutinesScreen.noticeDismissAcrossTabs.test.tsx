/**
 * Field report 2026-10-16: close the orange "Ingredient conflict" notice on the
 * Morning tab, switch to Evening and back, and it is shown again - and closing
 * it on Evening brings it back on Morning.
 *
 * Cause: the dismissal is stored as ONE routine-content hash per notice key, and
 * the screen computed that hash from the steps of the ACTIVE TAB only (it hands
 * ConflictWarningInline `morningSteps` or `eveningSteps`, never both). The same
 * conflict row therefore carried a different hash on each tab, and each tab's
 * dismissal overwrote the other's. A pairwise conflict is about the whole
 * routine, so its dismissal must be keyed to the whole saved routine.
 *
 * Same mocking playbook as RoutinesScreen.conflictCrossPeriod.test.tsx, except
 * the settings store is the REAL one - the bug lives in what gets persisted.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import type { Product, Routine, UserProfile } from '@/types';

import { PEELING, RETINOID_TREATMENT, makeRoutine, makeStep } from './fixtures';

// ── Navigation / focus mocks ──────────────────────────────────────────────────

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

// ── Draggable flat list — renders `data` synchronously via renderItem ────────

jest.mock('react-native-draggable-flatlist', () => {
  const { View } = require('react-native');
  const ScaleDecorator = ({ children }: any) => children;
  const NestableScrollContainer = ({ children }: any) => <View>{children}</View>;
  const NestableDraggableFlatList = ({ data, renderItem, keyExtractor }: any) => (
    <View>
      {data.map((item: any, index: number) => (
        <View key={keyExtractor ? keyExtractor(item, index) : index}>
          {renderItem({ item, drag: () => {}, isActive: false, getIndex: () => index })}
        </View>
      ))}
    </View>
  );
  return { __esModule: true, ScaleDecorator, NestableScrollContainer, NestableDraggableFlatList };
});

// ── Heavy / irrelevant siblings ───────────────────────────────────────────────

jest.mock('@/components/routine/AddToRoutineSheet', () => ({ AddToRoutineSheet: () => null }));
jest.mock('@/components/routine/DraftPreviewScreen', () => ({ DraftPreviewScreen: () => null }));
jest.mock('@/components/routine/RemoveStepModal', () => ({ RemoveStepModal: () => null }));
jest.mock('@/components/routine/SeasonalNoticeBanner', () => ({ SeasonalNoticeBanner: () => null }));
jest.mock('@/components/routine/RehabNoticeCard', () => ({ RehabNoticeCard: () => null }));
jest.mock('@/components/routine/PlannerBlock', () => ({ PlannerBlock: () => null }));
jest.mock('@/components/routine/GoalCoverageBanner', () => ({ GoalCoverageBanner: () => null }));

// Deterministic accordion seed: Morning selected first (same convention as
// RoutinesScreen.grouping.test.tsx).
jest.mock('@/utils/routineAccordion', () => ({
  ...jest.requireActual('@/utils/routineAccordion'),
  resolveAccordionState: () => ({ morning: true, evening: false }),
}));

// ── Store mocks ────────────────────────────────────────────────────────────────

let mockProducts: Product[] = [];
let mockRoutines: Routine[] = [];
const mockValidateCurrentRoutines = jest.fn(() => ({
  findings: [],
  hasBlockingFindings: false,
  proposedPlan: {
    rulesetVersion: 'test',
    generatedFor: '2026-01-01',
    periods: { morning: [], evening: [] },
    frozen: [],
    reserve: [],
    placeholders: [] as unknown[],
    decisions: [],
  },
  diff: [],
}));

jest.mock('@/store/productsStore', () => ({
  useProductsStore: jest.fn((selector: any) => selector({ products: mockProducts })),
}));

jest.mock('@/store/routinesStore', () => ({
  useRoutinesStore: jest.fn((selector: any) =>
    selector({
      routines: mockRoutines,
      reorderSteps: jest.fn(),
      removeStepFromDay: jest.fn(),
      removeProductStep: jest.fn(),
      setStepHidden: jest.fn(),
    }),
  ),
}));

jest.mock('@/store/proceduresStore', () => ({
  useProceduresStore: jest.fn((selector: any) => selector({ procedures: [] })),
}));

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'local-user',
    gender: null,
    age: null,
    skinType: null,
    phototype: null,
    fitzpatrick: null,
    city: null,
    concerns: [],
    skinConditions: [],
    primaryGoal: 'maintenance',
    secondaryGoal: null,
    goalNeedsConfirmation: false,
    phototypeNeedsConfirmation: false,
    spfSensitivity: false,
    onboardingCompleted: true,
    individualDurationMonths: {},
    contributionConsent: { granted: false, timestamp: null },
    hormoneTherapy: false,
    pregnantOrBreastfeeding: false,
    sensitive: false,
    ...overrides,
  } as UserProfile;
}

const mockProfile = makeProfile();

jest.mock('@/store/profileStore', () => ({
  useProfileStore: jest.fn((selector: any) => selector({ profile: mockProfile, updateProfile: jest.fn() })),
}));

jest.mock('@/store/trackingStore', () => ({
  useTrackingStore: jest.fn((selector: any) => selector({ applicationStats: [] })),
}));

jest.mock('@/domain/seasonActions', () => ({
  getActiveSeasonMask: jest.fn(() => ({ season: 'spring', source: 'calendar' })),
}));

jest.mock('@/domain/routinePlanActions', () => ({
  validateCurrentRoutines: (...args: unknown[]) => mockValidateCurrentRoutines(...(args as [])),
  applyRoutinePlan: jest.fn(),
  currentOverrideHash: jest.fn(() => 'hash'),
}));

import RoutinesScreen from '@/screens/RoutinesScreen';
import { useSettingsStore } from '@/store/settingsStore';

function renderScreen() {
  const navigate = jest.fn();
  const utils = render(
    <RoutinesScreen navigation={{ navigate, setOptions: jest.fn() } as any} route={{} as any} />,
  );
  return { ...utils, navigate };
}

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({ routineNoticeDismissedAt: {}, routineNoticeCollapsed: {} });
  mockProducts = [];
  mockRoutines = [];
  mockValidateCurrentRoutines.mockReturnValue({
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
  });
});

const DISMISS = 'Dismiss ingredient conflict notice';

function seedCrossPeriodConflict() {
  // Retinoid in the morning, AHA in the evening: a real pairwise conflict.
  mockProducts = [RETINOID_TREATMENT, PEELING];
  mockRoutines = [
    makeRoutine({
      id: 'routine-am',
      timeOfDay: 'morning',
      steps: [makeStep({ id: 's-am-retinoid', productType: 'serum', productId: RETINOID_TREATMENT.id })],
    }),
    makeRoutine({
      id: 'routine-pm',
      timeOfDay: 'evening',
      steps: [makeStep({ id: 's-pm-peeling', productType: 'peeling', productId: PEELING.id })],
    }),
  ];
}

describe('a closed conflict notice stays closed across the Morning / Evening tabs', () => {
  it('stays closed after switching to Evening and back to Morning', () => {
    seedCrossPeriodConflict();
    renderScreen();
    expect(screen.getByText('Ingredient conflict')).toBeTruthy();

    fireEvent.press(screen.getByLabelText(DISMISS));
    expect(screen.queryByText('Ingredient conflict')).toBeNull();

    fireEvent.press(screen.getByRole('tab', { name: 'Evening' }));
    expect(screen.queryByText('Ingredient conflict')).toBeNull();

    fireEvent.press(screen.getByRole('tab', { name: 'Morning' }));
    expect(screen.queryByText('Ingredient conflict')).toBeNull();
  });

  it('does not come back on Morning after it is closed on Evening', () => {
    seedCrossPeriodConflict();
    renderScreen();

    fireEvent.press(screen.getByRole('tab', { name: 'Evening' }));
    fireEvent.press(screen.getByLabelText(DISMISS));
    expect(screen.queryByText('Ingredient conflict')).toBeNull();

    fireEvent.press(screen.getByRole('tab', { name: 'Morning' }));
    expect(screen.queryByText('Ingredient conflict')).toBeNull();
  });

  it('still re-surfaces once the routine genuinely changes', () => {
    seedCrossPeriodConflict();
    const { rerender } = renderScreen();
    fireEvent.press(screen.getByLabelText(DISMISS));
    expect(screen.queryByText('Ingredient conflict')).toBeNull();

    // A real edit: the evening routine gains a step.
    mockRoutines[1] = makeRoutine({
      id: 'routine-pm',
      timeOfDay: 'evening',
      steps: [
        makeStep({ id: 's-pm-peeling', productType: 'peeling', productId: PEELING.id }),
        makeStep({ id: 's-pm-extra', productType: 'serum', productId: RETINOID_TREATMENT.id, scheduledDays: [1] }),
      ],
    });
    rerender(<RoutinesScreen navigation={{ navigate: jest.fn(), setOptions: jest.fn() } as any} route={{} as any} />);

    expect(screen.getByText('Ingredient conflict')).toBeTruthy();
  });
});
