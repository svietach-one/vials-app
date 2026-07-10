/**
 * Integration test — Story 3 UI AC: an in-window custom_default match renders
 * as a dimmed "Paused until <date>" row on the Routines screen.
 * Spec: docs/specs/2026-07-04-routine-engine.md §4 Story 3
 *
 * FE-9/FE-10 wired getDailyView's frozen rows into RoutinesScreen's footer
 * PausedSteps block (progress/routine-engine.md, 2026-07-05 entries). Mocking
 * follows the same boundary playbook as
 * tests/routine-engine/routines-screen-generation-ux.test.tsx, except
 * proceduresStore is seeded with a REAL custom procedure log (the subject).
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import type { Product, Routine, UserProcedureLog } from '@/types';

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

jest.mock('@/components/routine/PlannerBlock', () => {
  const { Pressable } = require('react-native');
  return {
    PlannerBlock: ({ onPeriodChange }: any) => (
      <Pressable testID="switch-to-evening" onPress={() => onPeriodChange('evening')} />
    ),
  };
});

jest.mock('@/components/routine/RoutineStepCard', () => {
  const { Pressable, Text } = require('react-native');
  return {
    RoutineStepCard: ({ product, onCardPress }: any) => (
      <Pressable onPress={onCardPress} accessibilityRole="button" accessibilityLabel={product.name}>
        <Text>{product.name}</Text>
      </Pressable>
    ),
  };
});

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

let mockProducts: Product[] = [];
let mockRoutines: Routine[] = [];
let mockProcedures: UserProcedureLog[] = [];

jest.mock('@/store/productsStore', () => ({
  useProductsStore: jest.fn((selector: any) => selector({ products: mockProducts })),
}));

jest.mock('@/store/routinesStore', () => ({
  useRoutinesStore: jest.fn((selector: any) =>
    selector({ routines: mockRoutines, reorderSteps: jest.fn(), removeStepFromDay: jest.fn(), removeProductStep: jest.fn() }),
  ),
}));

jest.mock('@/store/proceduresStore', () => ({
  useProceduresStore: jest.fn((selector: any) => selector({ procedures: mockProcedures })),
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
    usageTime: 'evening',
    openBeautyFactsId: null,
    addedAt: '2026-01-01',
    notes: null,
    openedDate: null,
    paoMonths: null,
    isHidden: false,
    ...overrides,
  };
}

function renderScreen() {
  return render(
    <RoutinesScreen navigation={{ navigate: jest.fn(), setOptions: jest.fn() } as any} route={{} as any} />,
  );
}

describe('Story 3 AC: an in-window custom_default match renders as a dimmed "Paused until <date>" row', () => {
  it('shows the frozen exfoliant as a paused row instead of a draggable step', () => {
    const aha = makeProduct({ id: 'aha-serum', name: 'AHA Resurfacing Serum', activeTags: ['aha'] });
    mockProducts = [aha];
    mockRoutines = [
      { id: 'routine-am', name: 'Morning', timeOfDay: 'morning', steps: [] },
      {
        id: 'routine-pm',
        name: 'Evening',
        timeOfDay: 'evening',
        steps: [{ id: 'step-aha', productType: 'serum', productId: aha.id, hidden: false, scheduledDays: [] }],
      },
    ];
    // A "Trauma / Laser" preset (7 days), logged today — well inside its window.
    mockProcedures = [
      {
        id: 'proc-1',
        procedureKey: 'custom',
        customName: 'Laser resurfacing',
        customRehabDays: 7,
        datePerformed: new Date().toISOString().split('T')[0],
        status: 'rehab',
        deferralCount: 0,
      },
    ];

    renderScreen();
    fireEvent.press(screen.getByTestId('switch-to-evening'));

    // Not a normal draggable step card...
    expect(screen.queryByLabelText('AHA Resurfacing Serum')).toBeNull();
    // ...instead a dimmed paused row naming the product and its return date.
    expect(screen.getByText(/AHA Resurfacing Serum — paused until/)).toBeTruthy();
  });
});
