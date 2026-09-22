/**
 * Regression test for the ConflictWarningInline period-scoping bug
 * (progress/routine-step-grouping.md, bug-fix round 2026-08-31).
 *
 * Since Phase 7 replaced the always-both-visible accordion with a
 * single-active-period `PillToggle` (only `selectedPeriod`'s cards are ever
 * rendered), `listHeader`'s call to `ConflictWarningInline` must only feed it
 * the CURRENTLY SELECTED period's steps. Before the fix it always passed
 * both `amSteps` and `pmSteps` regardless of `selectedPeriod`, so a product
 * with only an evening step still showed its condition advisory while the
 * Morning tab was selected — even though the product itself is correctly
 * absent from the rendered morning list.
 *
 * Mocking follows the established playbook in
 * tests/routine-step-grouping/RoutinesScreen.grouping.test.tsx. Unlike that
 * file, ConflictWarningInline is deliberately NOT mocked — it is the
 * component under test here, driven for real by whatever steps the screen
 * passes it.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import type { Product, Routine, UserProfile } from '@/types';

import { CLEANSER, RETINOID_TREATMENT, makeRoutine, makeStep } from './fixtures';

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
// RoutinesScreen.grouping.test.tsx), so every test starts on the Morning tab
// and switches to Evening via the real PillToggle.
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
    // Eczema is one of the two condition modifiers whose advisory table
    // flags `retinoid` (src/utils/skinConditionModifiers.ts) — the exact
    // mechanism behind the live-device "Sensitivity note" bug report.
    skinConditions: ['eczema'],
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

jest.mock('@/store/settingsStore', () => ({
  useSettingsStore: jest.fn((selector: any) =>
    selector({
      routineCycleType: 'fixed',
      routineAccordion: null,
      setRoutineAccordion: jest.fn(),
      rehabNoticeCollapsed: {},
      setRehabNoticeCollapsed: jest.fn(),
      routineNoticeCollapsed: {},
      setRoutineNoticeCollapsed: jest.fn(),
      gamificationEnabled: true,
      dismissedBanners: [],
      dismissBanner: jest.fn(),
    }),
  ),
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

function renderScreen() {
  const navigate = jest.fn();
  const utils = render(
    <RoutinesScreen navigation={{ navigate, setOptions: jest.fn() } as any} route={{} as any} />,
  );
  return { ...utils, navigate };
}

beforeEach(() => {
  jest.clearAllMocks();
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

describe('ConflictWarningInline is scoped to the currently selected period', () => {
  it('hides an evening-only retinoid advisory while Morning is selected, and shows it after switching to Evening', () => {
    mockProducts = [CLEANSER, RETINOID_TREATMENT];
    mockRoutines = [
      makeRoutine({
        id: 'routine-am',
        timeOfDay: 'morning',
        steps: [makeStep({ id: 's-am-cleanse', productType: 'cleanser', productId: CLEANSER.id })],
      }),
      makeRoutine({
        id: 'routine-pm',
        timeOfDay: 'evening',
        // The retinoid ONLY has an evening step — no morning presence at all.
        steps: [makeStep({ id: 's-pm-retinoid', productType: 'serum', productId: RETINOID_TREATMENT.id })],
      }),
    ];

    renderScreen();

    // Morning tab is selected by default (resolveAccordionState mock above).
    // The retinoid card itself is correctly absent from the morning list...
    expect(screen.queryByText(RETINOID_TREATMENT.name)).toBeNull();
    // ...and so must its condition advisory be — this is the bug: before the
    // fix, ConflictWarningInline was fed both periods' steps unconditionally.
    expect(screen.queryByText(/Sensitivity note/)).toBeNull();

    // Switch to Evening via the real PillToggle.
    fireEvent.press(screen.getByRole('tab', { name: 'Evening' }));

    // Now the retinoid card and its advisory are both visible.
    expect(screen.getByText(RETINOID_TREATMENT.name)).toBeTruthy();
    expect(screen.getByText(/Sensitivity note/)).toBeTruthy();
  });

  it('shows a morning-only retinoid advisory while Morning is selected, and hides it after switching to Evening', () => {
    mockProducts = [CLEANSER, RETINOID_TREATMENT];
    mockRoutines = [
      makeRoutine({
        id: 'routine-am',
        timeOfDay: 'morning',
        steps: [
          makeStep({ id: 's-am-cleanse', productType: 'cleanser', productId: CLEANSER.id }),
          makeStep({ id: 's-am-retinoid', productType: 'serum', productId: RETINOID_TREATMENT.id }),
        ],
      }),
      makeRoutine({ id: 'routine-pm', timeOfDay: 'evening', steps: [] }),
    ];

    renderScreen();

    expect(screen.getByText(RETINOID_TREATMENT.name)).toBeTruthy();
    expect(screen.getByText(/Sensitivity note/)).toBeTruthy();

    fireEvent.press(screen.getByRole('tab', { name: 'Evening' }));

    expect(screen.queryByText(RETINOID_TREATMENT.name)).toBeNull();
    expect(screen.queryByText(/Sensitivity note/)).toBeNull();
  });
});
