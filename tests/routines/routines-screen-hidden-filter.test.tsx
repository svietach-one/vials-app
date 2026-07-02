/**
 * Integration tests — RoutinesScreen hidden-product filtering
 * (hide-vial-bottomshield / tech-design FE-5)
 *
 * Spec: docs/specs/hide-vial-bottomshield.md
 * Tech design: docs/tech-design/hide-vial-bottomshield.md
 *
 * Covers Story 1 AC bullet 2 ("no step referencing that [hidden] product appears
 * in the step list") and Story 2 AC bullet 2 (un-hiding restores the step).
 *
 * Note: `RoutinesScreen.amSteps` / `pmSteps` already filter on
 * `products.find(p => p.id === step.productId)?.isHidden` at the time this
 * suite was written, so most of these tests should already pass — they exist
 * to lock the behaviour in as a regression guard, since no test previously
 * covered this screen for the hide-vial-bottomshield feature.
 *
 * AC-R1  AM steps: a step for a hidden product does not appear
 * AC-R2  AM steps: a step for a visible product appears
 * AC-R3  AM steps: a step for a legacy product (isHidden undefined) appears
 * AC-R4  AM steps: a step already excluded via step.hidden stays excluded regardless
 *        of the product's isHidden value (no double-counting / regression check)
 * AC-R5  PM steps: a step for a hidden product does not appear
 * AC-R6  Un-hiding a product (isHidden: true -> false) restores its step to the list
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import type { Product, Routine } from '@/types';

// ── Navigation mocks ──────────────────────────────────────────────────────────

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

// ── Icon mock ─────────────────────────────────────────────────────────────────

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return {
    Feather: ({ name, testID }: { name: string; testID?: string }) => (
      <View testID={testID ?? `feather-icon-${name}`} />
    ),
  };
});

// ── DraggableFlatList mock — renders `data` synchronously via renderItem ──────

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

// ── Heavy / irrelevant child components ───────────────────────────────────────

jest.mock('@/components/routine/AddToRoutineSheet', () => ({
  AddToRoutineSheet: () => null,
}));

jest.mock('@/components/routine/RemoveStepModal', () => ({
  RemoveStepModal: () => null,
}));

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

// ── Store mocks ────────────────────────────────────────────────────────────────

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

// ── Subject under test ────────────────────────────────────────────────────────

import RoutinesScreen from '@/screens/RoutinesScreen';

// ── Fixtures ──────────────────────────────────────────────────────────────────

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

const VISIBLE_PRODUCT = makeProduct({ id: 'p1', name: 'Gentle Cleanser', isHidden: false });
const HIDDEN_PRODUCT = makeProduct({ id: 'p2', name: 'Retinol Serum', isHidden: true });
const LEGACY_PRODUCT = makeProduct({ id: 'p3', name: 'Vitamin C Serum' });
const ROUTINE_HIDDEN_STEP_PRODUCT = makeProduct({ id: 'p4', name: 'Peptide Cream', isHidden: false });

delete (LEGACY_PRODUCT as { isHidden?: boolean }).isHidden;

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

function makeRoutines(): Routine[] {
  return [
    {
      id: 'routine-am',
      name: 'Morning',
      timeOfDay: 'morning',
      steps: [
        makeStep({ id: 'step-am-visible', productId: VISIBLE_PRODUCT.id }),
        makeStep({ id: 'step-am-hidden-product', productId: HIDDEN_PRODUCT.id }),
        makeStep({ id: 'step-am-legacy', productId: LEGACY_PRODUCT.id }),
        makeStep({ id: 'step-am-hidden-step', productId: ROUTINE_HIDDEN_STEP_PRODUCT.id, hidden: true }),
      ],
    },
    {
      id: 'routine-pm',
      name: 'Evening',
      timeOfDay: 'evening',
      steps: [
        makeStep({ id: 'step-pm-visible', productId: VISIBLE_PRODUCT.id }),
        makeStep({ id: 'step-pm-hidden-product', productId: HIDDEN_PRODUCT.id }),
      ],
    },
  ];
}

function renderScreen() {
  return render(
    <RoutinesScreen navigation={{ navigate: jest.fn(), setOptions: jest.fn() } as any} route={{} as any} />,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockProducts = [VISIBLE_PRODUCT, HIDDEN_PRODUCT, LEGACY_PRODUCT, ROUTINE_HIDDEN_STEP_PRODUCT];
  mockRoutines = makeRoutines();
});

// ── AC-R1 / AC-R2 / AC-R3 / AC-R4 — AM step filtering ─────────────────────────

describe('AC-R1: a step for a hidden product does not appear in the AM list', () => {
  it('should not render the hidden product name in the morning step list', () => {
    renderScreen();
    expect(screen.queryByText('Retinol Serum')).toBeNull();
  });
});

describe('AC-R2: a step for a visible product appears in the AM list', () => {
  it('should render the visible product name in the morning step list', () => {
    renderScreen();
    expect(screen.getByText('Gentle Cleanser')).toBeTruthy();
  });
});

describe('AC-R3: a step for a legacy product (isHidden undefined) appears in the AM list', () => {
  it('should render the legacy product name in the morning step list', () => {
    renderScreen();
    expect(screen.getByText('Vitamin C Serum')).toBeTruthy();
  });
});

describe('AC-R4: a step already excluded via step.hidden stays excluded regardless of product.isHidden', () => {
  it('should not render the routine-hidden step even though its product is visible', () => {
    renderScreen();
    expect(screen.queryByText('Peptide Cream')).toBeNull();
  });
});

// ── AC-R5 — PM step filtering ──────────────────────────────────────────────────

describe('AC-R5: a step for a hidden product does not appear in the PM list', () => {
  it('should not render the hidden product name after switching to the evening period', () => {
    renderScreen();
    fireEvent.press(screen.getByTestId('switch-to-evening'));
    expect(screen.getByText('Gentle Cleanser')).toBeTruthy();
    expect(screen.queryByText('Retinol Serum')).toBeNull();
  });
});

// ── AC-R6 — un-hiding restores the step ────────────────────────────────────────

describe('AC-R6: un-hiding a product restores its step to the AM list', () => {
  it('should render the previously-hidden product name after isHidden flips to false', () => {
    const { rerender } = renderScreen();
    expect(screen.queryByText('Retinol Serum')).toBeNull();

    mockProducts = mockProducts.map((p) => (p.id === HIDDEN_PRODUCT.id ? { ...p, isHidden: false } : p));
    rerender(
      <RoutinesScreen navigation={{ navigate: jest.fn(), setOptions: jest.fn() } as any} route={{} as any} />,
    );

    expect(screen.getByText('Retinol Serum')).toBeTruthy();
  });
});
