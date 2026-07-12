/**
 * Integration test — Story 3 wiring: RoutinesScreen renders
 * DuplicateSlotWarningInline beside the existing ConflictWarningInline, and
 * tapping a duplicate group opens DuplicateSlotResolutionSheet with the
 * ranked product list for that group.
 * Spec: docs/specs/2026-07-11-routine-similar-product-priority.md §4 Story 3
 * Tech design: docs/tech-design/routine-similar-product-priority.md (FE-8, FE-9)
 *
 * Mocking follows the established playbook in
 * tests/routine-engine/routines-screen-generation-ux.test.tsx.
 * DuplicateSlotWarningInline and DuplicateSlotResolutionSheet are mocked here
 * (their own internal behaviour is covered by
 * duplicate-slot-warning-inline.test.tsx and
 * duplicate-slot-resolution-sheet.test.tsx) — this file only asserts the
 * SCREEN'S wiring: which props each receives and how a tap on one drives the
 * other. rankSlotGroup (a pure util, engineer's unit-test territory) is
 * stubbed so this suite never depends on real ranking math.
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
  return { __esModule: true, default: DraggableFlatList, ScaleDecorator };
});

jest.mock('@/components/routine/AddToRoutineSheet', () => ({ AddToRoutineSheet: () => null }));
jest.mock('@/components/routine/DraftPreviewSheet', () => ({ DraftPreviewSheet: () => null }));
jest.mock('@/components/routine/RemoveStepModal', () => ({ RemoveStepModal: () => null }));
jest.mock('@/components/routine/ClinicalRestrictionsBlock', () => ({ ClinicalRestrictionsBlock: () => null }));
jest.mock('@/components/routine/SeasonalNoticeBanner', () => ({ SeasonalNoticeBanner: () => null }));
jest.mock('@/components/routine/RehabWidget', () => ({ RehabWidget: () => null }));
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

jest.mock('@/store/profileStore', () => ({
  useProfileStore: jest.fn((selector: any) => selector({ profile: null })),
}));
jest.mock('@/store/settingsStore', () => ({
  useSettingsStore: jest.fn((selector: any) => selector({ routineCycleType: 'fixed' })),
}));
jest.mock('@/store/trackingStore', () => ({
  useTrackingStore: jest.fn((selector: any) => selector({ applicationStats: [] })),
}));
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

// Subject boundaries: DuplicateSlotWarningInline/DuplicateSlotResolutionSheet's
// OWN behaviour is covered elsewhere — here they are simple prop-inspection stubs.
jest.mock('@/components/routine/DuplicateSlotWarningInline', () => {
  const { Pressable } = require('react-native');
  return {
    DuplicateSlotWarningInline: ({ onPressGroup }: any) => (
      <Pressable
        testID="mock-duplicate-warning"
        accessibilityRole="button"
        accessibilityLabel="mock duplicate warning row"
        onPress={() => onPressGroup({ routineId: 'routine-am', slotIndex: 11, productIds: ['p-a', 'p-b'] })}
      />
    ),
  };
});

jest.mock('@/components/routine/DuplicateSlotResolutionSheet', () => {
  const { Text, View } = require('react-native');
  return {
    DuplicateSlotResolutionSheet: ({ visible, routineId, rankedProducts }: any) =>
      visible ? (
        <View testID="mock-duplicate-resolution-sheet">
          <Text testID="mock-resolution-routine-id">{routineId}</Text>
          <Text testID="mock-resolution-ranked-names">
            {rankedProducts.map((p: Product) => p.name).join(',')}
          </Text>
        </View>
      ) : null,
  };
});

const mockRankSlotGroup = jest.fn();
jest.mock('@/utils/routineEngine/duplicateSlot', () => ({
  rankSlotGroup: (...args: unknown[]) => mockRankSlotGroup(...args),
}));

import RoutinesScreen from '@/screens/RoutinesScreen';

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: 'p-default',
    name: 'Default Product',
    brand: null,
    productType: 'moisturizer',
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

const PRODUCT_A = makeProduct({ id: 'p-a', name: 'Barrier Repair Cream' });
const PRODUCT_B = makeProduct({ id: 'p-b', name: 'Ceramide Moisturizer' });

function renderScreen() {
  return render(
    <RoutinesScreen navigation={{ navigate: jest.fn(), setOptions: jest.fn() } as any} route={{} as any} />,
  );
}

beforeEach(() => {
  mockRankSlotGroup.mockReset();
  mockProducts = [PRODUCT_A, PRODUCT_B];
  mockRoutines = [
    {
      id: 'routine-am',
      name: 'Morning',
      timeOfDay: 'morning',
      steps: [
        { id: 'step-a', productType: 'moisturizer', productId: PRODUCT_A.id, hidden: false, scheduledDays: [] },
        { id: 'step-b', productType: 'moisturizer', productId: PRODUCT_B.id, hidden: false, scheduledDays: [] },
      ],
    },
    { id: 'routine-pm', name: 'Evening', timeOfDay: 'evening', steps: [] },
  ];
});

describe('Story 3 wiring: RoutinesScreen renders the duplicate-slot banner', () => {
  it('renders DuplicateSlotWarningInline in the routine content', () => {
    renderScreen();
    expect(screen.getByTestId('mock-duplicate-warning')).toBeTruthy();
  });

  it('the resolution sheet is closed until a duplicate group is tapped', () => {
    renderScreen();
    expect(screen.queryByTestId('mock-duplicate-resolution-sheet')).toBeNull();
  });
});

describe('Story 3 wiring: tapping a duplicate group opens the resolution sheet, ranked', () => {
  it('calls rankSlotGroup and forwards its result + routineId into DuplicateSlotResolutionSheet', () => {
    mockRankSlotGroup.mockReturnValue([PRODUCT_B, PRODUCT_A]);

    renderScreen();
    fireEvent.press(screen.getByTestId('mock-duplicate-warning'));

    expect(mockRankSlotGroup).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('mock-duplicate-resolution-sheet')).toBeTruthy();
    expect(screen.getByTestId('mock-resolution-routine-id').props.children).toBe('routine-am');
    expect(screen.getByTestId('mock-resolution-ranked-names').props.children).toBe(
      `${PRODUCT_B.name},${PRODUCT_A.name}`,
    );
  });
});
