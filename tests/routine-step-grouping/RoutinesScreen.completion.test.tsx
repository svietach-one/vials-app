/**
 * Integration tests — per-card completion (US-40, US-41).
 * Spec: docs/specs/routine-step-grouping/{PRD_Spec,SCREENS,USER_STORIES}.md §6
 *
 * completionStore does not exist yet (Phase 5) — this file fails to resolve
 * until the engineer creates src/store/completionStore.ts and wires it into
 * RoutinesScreen per the contract in fixtures.ts. Expected (tests-first).
 *
 * Unlike RoutinesScreen.grouping.test.tsx, PlannerBlock is left UNMOCKED
 * here — the future/past-day tests need its real per-chip Date arithmetic
 * (getWeekStart + index offset), not a stub. System time is pinned with
 * fake timers so "today"/"tomorrow"/"yesterday" are deterministic and never
 * cross a Sun/Mon week-start boundary (Wednesday is the safe midweek anchor).
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import type { Product, Routine } from '@/types';

import { getSkincareDateString } from '@/utils/timeHelpers';
import { FACE_CREAM, SPF_CREAM, SPF_STICK, makeRoutine, makeStep } from './fixtures';

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

jest.mock('@/components/routine/AddToRoutineSheet', () => ({ AddToRoutineSheet: () => null }));
jest.mock('@/components/routine/DraftPreviewScreen', () => ({ DraftPreviewScreen: () => null }));
jest.mock('@/components/routine/RemoveStepModal', () => ({ RemoveStepModal: () => null }));
jest.mock('@/components/routine/SeasonalNoticeBanner', () => ({ SeasonalNoticeBanner: () => null }));
jest.mock('@/components/routine/RehabNoticeCard', () => ({ RehabNoticeCard: () => null }));

jest.mock('@/utils/routineAccordion', () => ({
  ...jest.requireActual('@/utils/routineAccordion'),
  resolveAccordionState: () => ({ morning: true, evening: false }),
}));

// ── Store mocks ────────────────────────────────────────────────────────────────

let mockProducts: Product[] = [];
let mockRoutines: Routine[] = [];
let mockGamificationEnabled = true;
let mockCompletedKeys: Set<string> = new Set();
const mockToggleCompleted = jest.fn((productId: string, routineId: string, date: string) => {
  const key = `${productId}|${routineId}|${date}`;
  if (mockCompletedKeys.has(key)) mockCompletedKeys.delete(key);
  else mockCompletedKeys.add(key);
});
const mockIsCompleted = jest.fn(
  (productId: string, routineId: string, date: string) => mockCompletedKeys.has(`${productId}|${routineId}|${date}`),
);
const mockValidateCurrentRoutines = jest.fn(() => ({
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

jest.mock('@/store/profileStore', () => ({
  useProfileStore: jest.fn((selector: any) => selector({ profile: null, updateProfile: jest.fn() })),
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
      gamificationEnabled: mockGamificationEnabled,
    }),
  ),
}));

jest.mock('@/store/trackingStore', () => ({
  useTrackingStore: jest.fn((selector: any) => selector({ applicationStats: [] })),
}));

// Backed by a REAL Zustand store (not a plain jest.fn selector) so this
// suite can catch the routine-step-grouping re-render bug (2026-08-28):
// RoutinesScreen used to select only `isCompleted`/`toggleCompleted` —
// stable function references that never change identity — so Zustand's
// real subscription never re-rendered the screen after a toggle. A plain
// `jest.fn((selector) => selector({...}))` mock can't catch that, since it
// re-evaluates the selector fresh on every render regardless of whether the
// component actually subscribed to anything. `isCompleted`/`toggleCompleted`
// still delegate to the same `mockIsCompleted`/`mockToggleCompleted` spies
// used by the rest of this file's `toHaveBeenCalledWith` assertions;
// `toggleCompleted` additionally bumps `completions`' identity via `set()`,
// mirroring production's real completionStore.
jest.mock('@/store/completionStore', () => {
  const { create } = require('zustand');
  const useCompletionStore = create((set: any) => ({
    completions: [] as unknown[],
    isCompleted: (productId: string, routineId: string, date: string) =>
      mockIsCompleted(productId, routineId, date),
    toggleCompleted: (productId: string, routineId: string, date: string) => {
      mockToggleCompleted(productId, routineId, date);
      set((s: any) => ({ completions: [...s.completions, {}] }));
    },
  }));
  return { useCompletionStore };
});

jest.mock('@/domain/seasonActions', () => ({
  getActiveSeasonMask: jest.fn(() => ({ season: 'spring', source: 'calendar' })),
}));

jest.mock('@/domain/routinePlanActions', () => ({
  validateCurrentRoutines: (...args: unknown[]) => mockValidateCurrentRoutines(...(args as [])),
  applyRoutinePlan: jest.fn(),
  currentOverrideHash: jest.fn(() => 'hash'),
}));

import RoutinesScreen from '@/screens/RoutinesScreen';
import { useCompletionStore } from '@/store/completionStore';

function renderScreen() {
  return render(<RoutinesScreen navigation={{ navigate: jest.fn(), setOptions: jest.fn() } as any} route={{} as any} />);
}

const WEDNESDAY_10AM = '2026-08-26T10:00:00';
const TODAY_SKINCARE_DATE = getSkincareDateString(new Date(WEDNESDAY_10AM));

function makeSingleStepRoutine(routineId: string, stepId: string, product: Product): Routine[] {
  return [
    makeRoutine({
      id: routineId,
      timeOfDay: 'morning',
      steps: [makeStep({ id: stepId, productType: product.productType, productId: product.id, scheduledDays: [] })],
    }),
    makeRoutine({ id: 'routine-pm', timeOfDay: 'evening', steps: [] }),
  ];
}

beforeEach(() => {
  jest.clearAllMocks();
  mockProducts = [];
  mockRoutines = [];
  mockGamificationEnabled = true;
  mockCompletedKeys = new Set();
  (useCompletionStore as any).setState({ completions: [] });
  jest.useFakeTimers();
  jest.setSystemTime(new Date(WEDNESDAY_10AM));
});

afterEach(() => {
  jest.useRealTimers();
});

// ─── US-40: toggling completion ────────────────────────────────────────────────

describe('US-40: tapping a card toggles completion when gamification is on', () => {
  it('calls toggleCompleted with the product id, routine id, and today\'s skincare date', () => {
    mockProducts = [FACE_CREAM];
    mockRoutines = makeSingleStepRoutine('routine-am', 's1', FACE_CREAM);

    renderScreen();
    fireEvent.press(screen.getByTestId('routine-product-card'));

    expect(mockToggleCompleted).toHaveBeenCalledWith(FACE_CREAM.id, 'routine-am', TODAY_SKINCARE_DATE);
  });

  it('shows the "Completed" badge on first render when isCompleted already returns true for today', () => {
    mockProducts = [FACE_CREAM];
    mockRoutines = makeSingleStepRoutine('routine-am', 's1', FACE_CREAM);
    mockCompletedKeys = new Set([`${FACE_CREAM.id}|routine-am|${TODAY_SKINCARE_DATE}`]);

    renderScreen();
    expect(screen.getByTestId('completed-badge')).toBeTruthy();
  });
});

describe('routine-step-grouping bug fix: completion re-render + double-tap round-trip (2026-08-28)', () => {
  // Root cause: RoutinesScreen selected only `isCompleted`/`toggleCompleted`
  // from useCompletionStore — stable function references that never change
  // by Object.is — so Zustand's real subscription never re-rendered the
  // screen after a toggle; a card only appeared to update when some
  // unrelated re-render happened to fire afterward. Fixed by also
  // subscribing to `completions` (see RoutinesScreen.tsx). This exercises
  // BOTH directions of the toggle in the SAME render pass each time, not
  // just that toggleCompleted was called (a spy check alone would have
  // passed even with the bug present).
  it('shows the completed badge immediately after the first tap, and reverts it immediately after a second tap', () => {
    mockProducts = [FACE_CREAM];
    mockRoutines = makeSingleStepRoutine('routine-am', 's1', FACE_CREAM);

    renderScreen();
    expect(screen.queryByTestId('completed-badge')).toBeNull();

    fireEvent.press(screen.getByTestId('routine-product-card'));
    expect(mockToggleCompleted).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('completed-badge')).toBeTruthy();

    fireEvent.press(screen.getByTestId('routine-product-card'));
    expect(mockToggleCompleted).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('completed-badge')).toBeNull();
  });
});

describe('US-40 negative: gamificationEnabled off makes cards inert', () => {
  it('does not call toggleCompleted when tapped', () => {
    mockGamificationEnabled = false;
    mockProducts = [FACE_CREAM];
    mockRoutines = makeSingleStepRoutine('routine-am', 's1', FACE_CREAM);

    renderScreen();
    fireEvent.press(screen.getByTestId('routine-product-card'));

    expect(mockToggleCompleted).not.toHaveBeenCalled();
  });
});

// ─── US-40: the 04:00 day boundary ─────────────────────────────────────────────

describe('US-40: the day boundary is 04:00, matching getSkincareDateString', () => {
  it('records a completion made at 01:00 against the previous calendar day', () => {
    jest.setSystemTime(new Date('2026-08-26T01:00:00'));
    const expectedDate = getSkincareDateString(new Date('2026-08-26T01:00:00'));
    expect(expectedDate).toBe('2026-08-25');

    mockProducts = [FACE_CREAM];
    mockRoutines = makeSingleStepRoutine('routine-am', 's1', FACE_CREAM);

    renderScreen();
    fireEvent.press(screen.getByTestId('routine-product-card'));

    expect(mockToggleCompleted).toHaveBeenCalledWith(FACE_CREAM.id, 'routine-am', '2026-08-25');
  });
});

// ─── US-41: header dimming ──────────────────────────────────────────────────────

describe('US-41: the header dims once every card in the step is completed', () => {
  it('shows the all-done label once the step\'s only card is completed', () => {
    mockProducts = [FACE_CREAM];
    mockRoutines = makeSingleStepRoutine('routine-am', 's1', FACE_CREAM);
    mockCompletedKeys = new Set([`${FACE_CREAM.id}|routine-am|${TODAY_SKINCARE_DATE}`]);

    renderScreen();
    expect(screen.getByLabelText(/Moisturize, all done$/)).toBeTruthy();
  });

  it('does not dim while the card is uncompleted', () => {
    mockProducts = [FACE_CREAM];
    mockRoutines = makeSingleStepRoutine('routine-am', 's1', FACE_CREAM);

    renderScreen();
    expect(screen.queryByLabelText(/all done$/)).toBeNull();
  });

  it('US-38 negative: an uncompleted reapply card blocks dimming even when the inline card is completed', () => {
    mockProducts = [SPF_CREAM, SPF_STICK];
    mockRoutines = [
      makeRoutine({
        id: 'routine-am',
        timeOfDay: 'morning',
        steps: [
          makeStep({ id: 's1', productType: 'spf', productId: SPF_CREAM.id, scheduledDays: [] }),
          makeStep({ id: 's2', productType: 'spf', productId: SPF_STICK.id, scheduledDays: [] }),
        ],
      }),
      makeRoutine({ id: 'routine-pm', timeOfDay: 'evening', steps: [] }),
    ];
    // Only the inline SPF cream is completed; the reapply stick is not.
    mockCompletedKeys = new Set([`${SPF_CREAM.id}|routine-am|${TODAY_SKINCARE_DATE}`]);

    renderScreen();
    expect(screen.queryByLabelText(/Protect, all done$/)).toBeNull();
  });
});

// ─── Future/past-day tappability (real PlannerBlock date math) ────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

describe('US-40 negative: a future day is not completable', () => {
  it('does nothing when the card is tapped after selecting tomorrow (Thursday)', () => {
    mockProducts = [FACE_CREAM];
    mockRoutines = makeSingleStepRoutine('routine-am', 's1', FACE_CREAM);

    renderScreen();
    fireEvent.press(screen.getByLabelText(new RegExp(`^${DAY_NAMES[4]}`))); // Thursday
    fireEvent.press(screen.getByTestId('routine-product-card'));

    expect(mockToggleCompleted).not.toHaveBeenCalled();
  });
});

describe('US-40: a past day within the current week is completable', () => {
  it('still calls toggleCompleted when the card is tapped after selecting yesterday (Tuesday)', () => {
    mockProducts = [FACE_CREAM];
    mockRoutines = makeSingleStepRoutine('routine-am', 's1', FACE_CREAM);

    renderScreen();
    fireEvent.press(screen.getByLabelText(new RegExp(`^${DAY_NAMES[2]}`))); // Tuesday
    fireEvent.press(screen.getByTestId('routine-product-card'));

    expect(mockToggleCompleted).toHaveBeenCalled();
  });
});
