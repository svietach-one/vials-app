/**
 * Integration test — Story 3/4 wiring: RoutinesScreen wires the Draft
 * Preview cycle-split prompt's two new callbacks to the phase-07 override
 * mechanism (accept) and a local, ephemeral dismissed-pairs set (decline).
 *
 * Spec: docs/specs/day-split-alternation.md §4 Stories 3, 4
 * Tech design: docs/tech-design/day-split-alternation.md (FE-6)
 *
 * Mocking follows the established playbook in
 * tests/routine-similar-product-priority/routines-screen-duplicate-wiring.test.tsx
 * and tests/routine-engine/routines-screen-generation-ux.test.tsx.
 * DraftPreviewScreen's OWN rendering behaviour (the prompt card itself) is
 * covered by DraftPreviewScreen.cycle-split-prompt.test.tsx — here it is
 * mocked to a stub exposing the two new callback props directly, so this
 * suite only asserts the SCREEN'S wiring, matching the "wiring, not
 * rendering" subject-boundary convention of the duplicate-slot precedent.
 *
 * Written BEFORE the engineer's implementation — `onAcceptCycleSplit`/
 * `onDeclineCycleSplit`/`dismissedCycleSplitRivalIds` do not exist on
 * RoutinesScreen's real DraftPreviewScreen usage yet, so the mock stub below
 * never actually receives them from the real screen until FE-6 ships; every
 * assertion here is EXPECTED TO FAIL (red) until then.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import type { Product, Routine } from '@/types';

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
  return { __esModule: true, default: DraggableFlatList, ScaleDecorator, NestableScrollContainer, NestableDraggableFlatList };
});

jest.mock('@/components/routine/AddToRoutineSheet', () => ({ AddToRoutineSheet: () => null }));
jest.mock('@/components/routine/RemoveStepModal', () => ({ RemoveStepModal: () => null }));
jest.mock('@/components/routine/SeasonalNoticeBanner', () => ({ SeasonalNoticeBanner: () => null }));
jest.mock('@/components/routine/RehabNoticeCard', () => ({ RehabNoticeCard: () => null }));
jest.mock('@/components/routine/PlannerBlock', () => ({ PlannerBlock: () => null }));
jest.mock('@/components/routine/RoutineStepCard', () => ({ RoutineStepCard: () => null }));

// ─── Subject boundary: DraftPreviewScreen is stubbed to expose the two new
// callback props (+ dismissedCycleSplitRivalIds) directly, so this suite can
// assert exactly what RoutinesScreen passes/calls without re-testing the
// card's own rendering (covered separately). ──────────────────────────────
const RIVAL_ID = 'p-aha-rival';
const mockDraftPreviewProps = jest.fn();
jest.mock('@/components/routine/DraftPreviewScreen', () => {
  const ReactActual = require('react');
  const { Pressable } = require('react-native');
  return {
    DraftPreviewScreen: (props: any) => {
      mockDraftPreviewProps(props);
      if (!props.visible) return null;
      return ReactActual.createElement(
        ReactActual.Fragment,
        null,
        ReactActual.createElement(Pressable, {
          testID: 'mock-accept-cycle-split',
          onPress: () => props.onAcceptCycleSplit?.(RIVAL_ID),
        }),
        ReactActual.createElement(Pressable, {
          testID: 'mock-decline-cycle-split',
          onPress: () => props.onDeclineCycleSplit?.(RIVAL_ID),
        }),
      );
    },
  };
});

const mockValidateCurrentRoutines = jest.fn();
const mockApplyRoutinePlan = jest.fn();
const mockCurrentOverrideHash = jest.fn(() => 'hash-1');

function buildValidationResult() {
  return {
    findings: [],
    hasBlockingFindings: false,
    proposedPlan: {
      rulesetVersion: 'test',
      generatedFor: '2026-01-01',
      periods: { morning: [], evening: [] },
      frozen: [],
      reserve: [{ productId: RIVAL_ID, reasonCode: 'cycle_class_rival', rivalOfProductId: 'p-retinoid-winner', period: 'pm' }],
      placeholders: [],
      decisions: [],
    },
    diff: [],
  };
}

jest.mock('@/domain/routinePlanActions', () => ({
  validateCurrentRoutines: (...args: unknown[]) => mockValidateCurrentRoutines(...args),
  applyRoutinePlan: (...args: unknown[]) => mockApplyRoutinePlan(...args),
  currentOverrideHash: () => mockCurrentOverrideHash(),
}));

jest.mock('@/domain/seasonActions', () => ({
  getActiveSeasonMask: jest.fn(() => ({ season: 'spring', source: 'calendar' })),
}));

jest.mock('@/store/profileStore', () => ({
  useProfileStore: jest.fn((selector: any) => selector({ profile: null })),
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
    }),
  ),
}));

const mockAddOverride = jest.fn();
jest.mock('@/store/trackingStore', () => {
  const hook: any = jest.fn((selector: any) => selector({ applicationStats: [] }));
  hook.getState = jest.fn(() => ({ addOverride: mockAddOverride }));
  return { useTrackingStore: hook };
});

jest.mock('@/store/proceduresStore', () => ({
  useProceduresStore: jest.fn((selector: any) => selector({ procedures: [] })),
}));

let mockProducts: Product[] = [];
let mockRoutines: Routine[] = [];

jest.mock('@/store/productsStore', () => ({
  useProductsStore: jest.fn((selector: any) => selector({ products: mockProducts })),
}));

jest.mock('@/store/routinesStore', () => ({
  useRoutinesStore: jest.fn((selector: any) =>
    selector({ routines: mockRoutines, reorderSteps: jest.fn(), removeStepFromDay: jest.fn(), removeProductStep: jest.fn() }),
  ),
}));

import RoutinesScreen from '@/screens/RoutinesScreen';

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: 'p-default',
    name: 'Default Product',
    brand: null,
    productType: 'serum',
    imageUrl: null,
    activeIngredients: [],
    activeTags: [],
    fullIngredientText: null,
    usageTime: 'both',
    openBeautyFactsId: null,
    addedAt: '2026-01-01',
    notes: null,
    openedDate: null,
    paoMonths: null,
    isHidden: false,
    ...overrides,
  };
}

const PRODUCT_A = makeProduct({ id: 'p-a', name: 'Retinol Serum' });

function renderScreen() {
  return render(
    <RoutinesScreen navigation={{ navigate: jest.fn(), setOptions: jest.fn() } as any} route={{} as any} />,
  );
}

function openDraftPreview() {
  fireEvent.press(screen.getByLabelText('Optimize or Regenerate Routine'));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockValidateCurrentRoutines.mockImplementation(buildValidationResult);
  mockCurrentOverrideHash.mockReturnValue('hash-1');
  mockProducts = [PRODUCT_A];
  mockRoutines = [
    {
      id: 'routine-am',
      name: 'Morning',
      timeOfDay: 'morning',
      steps: [{ id: 'step-a', productType: 'serum', productId: PRODUCT_A.id, hidden: false, scheduledDays: [] }],
    },
    { id: 'routine-pm', name: 'Evening', timeOfDay: 'evening', steps: [] },
  ];
});

describe('Story 3 wiring: "Alternate automatically" reuses the phase-07 override mechanism', () => {
  it('calls addOverride(rivalProductId, currentOverrideHash()) then regenerates the draft', () => {
    renderScreen();
    openDraftPreview();
    const callsBeforeAccept = mockValidateCurrentRoutines.mock.calls.length;

    fireEvent.press(screen.getByTestId('mock-accept-cycle-split'));

    expect(mockAddOverride).toHaveBeenCalledWith(RIVAL_ID, 'hash-1');
    expect(mockValidateCurrentRoutines.mock.calls.length).toBeGreaterThan(callsBeforeAccept);
  });

  it('never writes to the saved routines directly (draft-only, same as every other Draft Preview action)', () => {
    renderScreen();
    openDraftPreview();

    fireEvent.press(screen.getByTestId('mock-accept-cycle-split'));

    expect(mockApplyRoutinePlan).not.toHaveBeenCalled();
  });
});

describe('Story 4 wiring: "Keep only [winner]" is a local, ephemeral dismissal', () => {
  it('never calls addOverride or applyRoutinePlan', () => {
    renderScreen();
    openDraftPreview();

    fireEvent.press(screen.getByTestId('mock-decline-cycle-split'));

    expect(mockAddOverride).not.toHaveBeenCalled();
    expect(mockApplyRoutinePlan).not.toHaveBeenCalled();
  });

  it('does not trigger a regeneration (no new validateCurrentRoutines call)', () => {
    renderScreen();
    openDraftPreview();
    const callsBeforeDecline = mockValidateCurrentRoutines.mock.calls.length;

    fireEvent.press(screen.getByTestId('mock-decline-cycle-split'));

    expect(mockValidateCurrentRoutines.mock.calls.length).toBe(callsBeforeDecline);
  });

  it('threads the declined rival id into dismissedCycleSplitRivalIds on the next render, suppressing the prompt for this session', () => {
    renderScreen();
    openDraftPreview();

    fireEvent.press(screen.getByTestId('mock-decline-cycle-split'));

    const lastCallProps = mockDraftPreviewProps.mock.calls.at(-1)?.[0];
    expect(lastCallProps.dismissedCycleSplitRivalIds).toContain(RIVAL_ID);
  });
});
