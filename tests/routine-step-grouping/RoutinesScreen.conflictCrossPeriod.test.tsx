/**
 * Regression test for the ConflictWarningInline cross-period conflict
 * regression (progress/routine-step-grouping.md, code-review round
 * 2026-08-31, Priority 1 item 1).
 *
 * `RoutinesScreen.conflictBannerPeriodScope.test.tsx` proves condition
 * advisories/density findings are correctly scoped to the currently selected
 * period only. This file proves the OTHER half of the same fix: a real
 * pairwise ingredient conflict split across AM and PM (a retinoid used in
 * the morning, an AHA acid used in the evening) must still fire regardless
 * of which tab (`selectedPeriod`) is active — product-pair chemistry doesn't
 * care which tab is open. Scoping `ConflictWarningInline`'s conflict
 * detection to only the active tab (as a prior fix for the advisory-scoping
 * bug briefly did) would silently disable this safety-relevant detection
 * entirely, since one side of the pair is always in the inactive period.
 *
 * Same mocking playbook as RoutinesScreen.conflictBannerPeriodScope.test.tsx.
 * ConflictWarningInline is deliberately NOT mocked — it is driven for real.
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

describe('ConflictWarningInline detects a cross-period ingredient conflict regardless of the active tab', () => {
  it('fires the retinoid/AHA conflict while Morning is selected, even though the AHA product is only in Evening', () => {
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

    renderScreen();

    // Morning tab is selected by default. The AHA card itself is correctly
    // absent from the rendered morning list...
    expect(screen.queryByText(PEELING.name)).toBeNull();
    // ...but the pairwise conflict between the two must still fire, since it
    // is not a "what's on screen" concern — it is real product chemistry.
    expect(screen.getByText('Ingredient conflict')).toBeTruthy();
  });

  it('keeps firing after switching to Evening (retinoid card no longer shown, conflict still shown)', () => {
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

    renderScreen();
    expect(screen.getByText('Ingredient conflict')).toBeTruthy();

    fireEvent.press(screen.getByRole('tab', { name: 'Evening' }));

    expect(screen.queryByText(RETINOID_TREATMENT.name)).toBeNull();
    expect(screen.getByText('Ingredient conflict')).toBeTruthy();
  });

  it('does not fire when the two conflicting products are not both scheduled (sanity control)', () => {
    mockProducts = [RETINOID_TREATMENT];
    mockRoutines = [
      makeRoutine({
        id: 'routine-am',
        timeOfDay: 'morning',
        steps: [makeStep({ id: 's-am-retinoid', productType: 'serum', productId: RETINOID_TREATMENT.id })],
      }),
      makeRoutine({ id: 'routine-pm', timeOfDay: 'evening', steps: [] }),
    ];

    renderScreen();

    expect(screen.queryByText('Ingredient conflict')).toBeNull();
  });
});
