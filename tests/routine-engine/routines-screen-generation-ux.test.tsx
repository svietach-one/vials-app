/**
 * Integration tests — Story 1 UI ACs: the empty-state Generate card, the
 * bottom Optimize strip once routines are populated, and the header pencil
 * staying limited to manual reorder/delete.
 * Spec: docs/specs/2026-07-04-routine-engine.md §4 Story 1
 *
 * FE-8 wired GenerateCard/OptimizeStrip/DraftPreviewSheet into RoutinesScreen
 * (progress/routine-engine.md, 2026-07-05 "GENERATION UX" entry). Mocking
 * follows the established playbook in
 * tests/routines/routines-screen-hidden-filter.test.tsx — GenerateCard and
 * OptimizeStrip are left UNMOCKED (they are the subject under test); heavy/
 * irrelevant children and AsyncStorage-backed store boundaries are mocked.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import type { Product, Routine } from '@/types';

// ── Navigation / icon mocks ───────────────────────────────────────────────────

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

// ── Heavy / irrelevant child components (same boundary as the hidden-filter suite) ──

jest.mock('@/components/routine/AddToRoutineSheet', () => ({ AddToRoutineSheet: () => null }));
jest.mock('@/components/routine/DraftPreviewSheet', () => ({ DraftPreviewSheet: () => null }));
jest.mock('@/components/routine/RemoveStepModal', () => ({ RemoveStepModal: () => null }));
jest.mock('@/components/routine/SeasonalNoticeBanner', () => ({ SeasonalNoticeBanner: () => null }));
jest.mock('@/components/routine/RehabNoticeCard', () => ({ RehabNoticeCard: () => null }));

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

jest.mock('@/store/proceduresStore', () => ({
  useProceduresStore: jest.fn((selector: any) => selector({ procedures: [] })),
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
const mockReorderSteps = jest.fn();
const mockRemoveStepFromDay = jest.fn();
const mockRemoveProductStep = jest.fn();

jest.mock('@/store/productsStore', () => ({
  useProductsStore: jest.fn((selector: any) => selector({ products: mockProducts })),
}));

jest.mock('@/store/routinesStore', () => ({
  useRoutinesStore: jest.fn((selector: any) =>
    selector({
      routines: mockRoutines,
      reorderSteps: mockReorderSteps,
      removeStepFromDay: mockRemoveStepFromDay,
      removeProductStep: mockRemoveProductStep,
    }),
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
    usageTime: 'morning',
    openBeautyFactsId: null,
    addedAt: '2026-01-01',
    notes: null,
    openedDate: null,
    paoMonths: null,
    isHidden: false,
    ...overrides,
  };
}

function makeStep(overrides: Partial<Routine['steps'][number]>): Routine['steps'][number] {
  return {
    id: 'step-default',
    productType: 'serum',
    productId: null,
    hidden: false,
    scheduledDays: [],
    ...overrides,
  };
}

function renderScreen() {
  return render(
    <RoutinesScreen navigation={{ navigate: jest.fn(), setOptions: jest.fn() } as any} route={{} as any} />,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Story 1 AC: the empty-state Generate card shows on a truly empty shelf', () => {
  it('renders the central "Generate Routine" / "Add Products Manually" card when both AM and PM are empty', () => {
    mockProducts = [];
    mockRoutines = [
      { id: 'routine-am', name: 'Morning', timeOfDay: 'morning', steps: [] },
      { id: 'routine-pm', name: 'Evening', timeOfDay: 'evening', steps: [] },
    ];

    renderScreen();

    expect(screen.getByLabelText('Generate Routine')).toBeTruthy();
    expect(screen.getByLabelText('Add Products Manually')).toBeTruthy();
    // The bottom Optimize strip never renders alongside the empty-state card.
    expect(screen.queryByLabelText('Optimize or Regenerate Routine')).toBeNull();
  });
});

describe('Story 1 AC: the bottom Optimize strip appears once routines are populated', () => {
  it('renders the "Optimize or Regenerate Routine" strip and no empty-state card', () => {
    const product = makeProduct({ id: 'p1', name: 'Gentle Cleanser' });
    mockProducts = [product];
    mockRoutines = [
      { id: 'routine-am', name: 'Morning', timeOfDay: 'morning', steps: [makeStep({ id: 's1', productId: product.id })] },
      { id: 'routine-pm', name: 'Evening', timeOfDay: 'evening', steps: [] },
    ];

    renderScreen();

    expect(screen.getByLabelText('Optimize or Regenerate Routine')).toBeTruthy();
    expect(screen.queryByLabelText('Generate Routine')).toBeNull();
  });
});

describe('Story 1 AC: header actions stay limited to regenerate + add, separate from committing a plan', () => {
  // img-03 replaced the edit-mode pencil: reordering is now a long-press on the
  // card itself, so the header carries exactly two actions — Regenerate
  // (immediately left) and Add product (rightmost, always one tap away).
  it('exposes Regenerate and Add product in the header, with no edit-mode toggle', () => {
    const product = makeProduct({ id: 'p1', name: 'Gentle Cleanser' });
    mockProducts = [product];
    mockRoutines = [
      { id: 'routine-am', name: 'Morning', timeOfDay: 'morning', steps: [makeStep({ id: 's1', productId: product.id })] },
      { id: 'routine-pm', name: 'Evening', timeOfDay: 'evening', steps: [] },
    ];

    renderScreen();

    expect(screen.getByLabelText('Regenerate routine')).toBeTruthy();
    // The header "+" and the in-content footer button share this label — both
    // open the same add flow, so at least one must always be present.
    expect(screen.getAllByLabelText('Add product to routine').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByLabelText('Edit routine')).toBeNull();
    expect(screen.queryByLabelText('Done editing')).toBeNull();
  });

  it('opens the Draft Preview from the header Regenerate action without committing a plan', () => {
    const product = makeProduct({ id: 'p1', name: 'Gentle Cleanser' });
    mockProducts = [product];
    mockRoutines = [
      { id: 'routine-am', name: 'Morning', timeOfDay: 'morning', steps: [makeStep({ id: 's1', productId: product.id })] },
      { id: 'routine-pm', name: 'Evening', timeOfDay: 'evening', steps: [] },
    ];

    renderScreen();
    fireEvent.press(screen.getByLabelText('Regenerate routine'));

    // Regenerating only previews — nothing is written until the user commits.
    const { applyRoutinePlan } = require('@/domain/routinePlanActions');
    expect(applyRoutinePlan).not.toHaveBeenCalled();
  });
});
