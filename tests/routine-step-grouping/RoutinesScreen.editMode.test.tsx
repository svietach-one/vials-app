/**
 * Integration tests — edit mode (US-42).
 * Spec: docs/specs/routine-step-grouping/{PRD_Spec,SCREENS,USER_STORIES}.md §7
 *
 * RoutinesScreen has no edit-mode toggle today — this file fails until the
 * engineer adds the pencil/checkmark header control and wires
 * RoutineProductCard's editMode prop through it (Phase 4). Expected
 * (tests-first).
 *
 * RoutineStepActionSheet already exists and is left unmocked: its own
 * "Remove from routine" row (RoutineStepActionSheet.tsx) is the existing,
 * real contract this suite checks the edit-mode body-tap opens.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import type { Product, Routine } from '@/types';

import { FACE_CREAM, makeRoutine, makeStep } from './fixtures';

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

// Draggable list mock exposes a "trigger-drag-end" Pressable per rendered
// item so tests can simulate a completed drag without a real gesture — the
// established workaround for react-native-draggable-flatlist in RNTL.
jest.mock('react-native-draggable-flatlist', () => {
  const { Pressable, View } = require('react-native');
  const ScaleDecorator = ({ children }: any) => children;
  const NestableScrollContainer = ({ children }: any) => <View>{children}</View>;
  const NestableDraggableFlatList = ({ data, renderItem, keyExtractor, onDragEnd }: any) => (
    <View>
      {data.map((item: any, index: number) => (
        <View key={keyExtractor ? keyExtractor(item, index) : index}>
          {renderItem({ item, drag: () => {}, isActive: false, getIndex: () => index })}
        </View>
      ))}
      <Pressable
        testID="trigger-drag-end"
        onPress={() => onDragEnd({ data: [...data].reverse() })}
      />
    </View>
  );
  return { __esModule: true, ScaleDecorator, NestableScrollContainer, NestableDraggableFlatList };
});

jest.mock('@/components/routine/AddToRoutineSheet', () => ({ AddToRoutineSheet: () => null }));
jest.mock('@/components/routine/DraftPreviewScreen', () => ({ DraftPreviewScreen: () => null }));
jest.mock('@/components/routine/RemoveStepModal', () => ({ RemoveStepModal: () => null }));
jest.mock('@/components/routine/SeasonalNoticeBanner', () => ({ SeasonalNoticeBanner: () => null }));
jest.mock('@/components/routine/RehabNoticeCard', () => ({ RehabNoticeCard: () => null }));
jest.mock('@/components/routine/PlannerBlock', () => ({ PlannerBlock: () => null }));

jest.mock('@/utils/routineAccordion', () => ({
  ...jest.requireActual('@/utils/routineAccordion'),
  resolveAccordionState: () => ({ morning: true, evening: false }),
}));

let mockProducts: Product[] = [];
let mockRoutines: Routine[] = [];
const mockReorderSteps = jest.fn();
const mockSetStepHidden = jest.fn();
const mockToggleCompleted = jest.fn();

jest.mock('@/store/productsStore', () => ({
  useProductsStore: jest.fn((selector: any) => selector({ products: mockProducts })),
}));

jest.mock('@/store/routinesStore', () => ({
  useRoutinesStore: jest.fn((selector: any) =>
    selector({
      routines: mockRoutines,
      reorderSteps: mockReorderSteps,
      removeStepFromDay: jest.fn(),
      removeProductStep: jest.fn(),
      setStepHidden: mockSetStepHidden,
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
      gamificationEnabled: true,
    }),
  ),
}));

jest.mock('@/store/trackingStore', () => ({
  useTrackingStore: jest.fn((selector: any) => selector({ applicationStats: [] })),
}));

jest.mock('@/store/completionStore', () => ({
  useCompletionStore: jest.fn((selector: any) =>
    selector({ isCompleted: () => false, toggleCompleted: mockToggleCompleted }),
  ),
}));

jest.mock('@/domain/seasonActions', () => ({
  getActiveSeasonMask: jest.fn(() => ({ season: 'spring', source: 'calendar' })),
}));

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
  currentOverrideHash: jest.fn(() => 'hash'),
}));

import RoutinesScreen from '@/screens/RoutinesScreen';

function renderScreen() {
  return render(<RoutinesScreen navigation={{ navigate: jest.fn(), setOptions: jest.fn() } as any} route={{} as any} />);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockProducts = [FACE_CREAM];
  mockRoutines = [
    makeRoutine({
      id: 'routine-am',
      timeOfDay: 'morning',
      steps: [makeStep({ id: 's1', productType: 'cream', productId: FACE_CREAM.id, scheduledDays: [] })],
    }),
    makeRoutine({ id: 'routine-pm', timeOfDay: 'evening', steps: [] }),
  ];
});

describe('US-42: entering and exiting edit mode', () => {
  it('the pencil enters edit mode; the checkmark exits it', () => {
    renderScreen();

    expect(screen.getByLabelText('Edit routine')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Edit routine'));

    expect(screen.queryByLabelText('Edit routine')).toBeNull();
    expect(screen.getByLabelText('Done editing')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Done editing'));
    expect(screen.getByLabelText('Edit routine')).toBeTruthy();
  });
});

describe('US-42: card controls in edit mode', () => {
  it('shows exactly the Pause and Schedule icons on the card', () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Edit routine'));

    expect(screen.getByTestId('pause-icon')).toBeTruthy();
    expect(screen.getByTestId('schedule-icon')).toBeTruthy();
  });

  it('renders no trash/remove icon directly on the card', () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Edit routine'));

    expect(screen.queryByTestId('remove-icon')).toBeNull();
    expect(screen.queryByLabelText(/remove/i)).toBeNull();
  });

  it('tapping the card body opens the action sheet, where "Remove from routine" lives', () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Edit routine'));
    fireEvent.press(screen.getByTestId('routine-product-card'));

    expect(screen.getByText('Remove from routine')).toBeTruthy();
  });

  it('negative: tapping the card body in edit mode never toggles completion', () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Edit routine'));
    fireEvent.press(screen.getByTestId('routine-product-card'));

    expect(mockToggleCompleted).not.toHaveBeenCalled();
  });

  it('the Pause icon sets hidden: true on the step via setStepHidden', () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Edit routine'));
    fireEvent.press(screen.getByTestId('pause-icon'));

    expect(mockSetStepHidden).toHaveBeenCalledWith('routine-am', 's1', true);
  });
});

describe('US-42: dragging a step persists the new order via reorderSteps', () => {
  it('calls reorderSteps with the routine id and the full, same-length steps array', () => {
    mockProducts = [FACE_CREAM];
    const secondProduct = { ...FACE_CREAM, id: 'p-second', name: 'Second Product', productType: 'serum' as const };
    mockProducts.push(secondProduct);
    mockRoutines = [
      makeRoutine({
        id: 'routine-am',
        timeOfDay: 'morning',
        steps: [
          makeStep({ id: 's1', productType: 'cream', productId: FACE_CREAM.id, scheduledDays: [] }),
          makeStep({ id: 's2', productType: 'serum', productId: secondProduct.id, scheduledDays: [] }),
        ],
      }),
      makeRoutine({ id: 'routine-pm', timeOfDay: 'evening', steps: [] }),
    ];

    renderScreen();
    fireEvent.press(screen.getByLabelText('Edit routine'));
    fireEvent.press(screen.getByTestId('trigger-drag-end'));

    expect(mockReorderSteps).toHaveBeenCalledTimes(1);
    const [routineId, newSteps] = mockReorderSteps.mock.calls[0];
    expect(routineId).toBe('routine-am');
    expect(newSteps).toHaveLength(2);
  });
});
