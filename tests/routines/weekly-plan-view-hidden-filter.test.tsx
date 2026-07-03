/**
 * Integration tests — WeeklyPlanView hidden-product filtering
 * (hide-vial-bottomshield / tech-design FE-5 + tech-lead review note)
 *
 * Spec: docs/specs/hide-vial-bottomshield.md
 * Tech design: docs/tech-design/hide-vial-bottomshield.md
 *
 * The approved tech-lead review (progress/hide-vial-bottomshield-handoff.json)
 * flagged that WeeklyPlanView derives its own step list and must apply the same
 * isHidden filter as RoutinesScreen. `WeeklyPlanView.visibleSteps` already
 * filters on `products.find(p => p.id === s.productId)?.isHidden` at the time
 * this suite was written; these tests lock that behaviour in as a regression
 * guard, since no test previously covered it for this feature.
 *
 * AC-WP1  A step for a hidden product does not appear in the AM weekly plan list
 * AC-WP2  A step for a visible product appears in the AM weekly plan list
 * AC-WP3  A step for a legacy product (isHidden undefined) appears in the list
 * AC-WP4  A step for a hidden product does not appear in the PM weekly plan list
 * AC-WP5  Un-hiding a product restores its step to the weekly plan list
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { Product, Routine } from '@/types';

// ── Icon mock ─────────────────────────────────────────────────────────────────

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return {
    Feather: ({ name, testID }: { name: string; testID?: string }) => (
      <View testID={testID ?? `feather-icon-${name}`} />
    ),
  };
});

jest.mock('@/constants/labels', () => ({
  PRODUCT_TYPE_LABELS: { serum: 'Serum', cleanser: 'Cleanser' },
}));

// ── DraggableFlatList mock — renders `data` synchronously via renderItem ──────

jest.mock('react-native-draggable-flatlist', () => {
  const { View } = require('react-native');
  function DraggableFlatList({ data, renderItem, keyExtractor, ListEmptyComponent }: any) {
    return (
      <View testID="weekly-draggable-flat-list">
        {data.length === 0
          ? ListEmptyComponent
          : data.map((item: any, index: number) => (
              <View key={keyExtractor ? keyExtractor(item, index) : index}>
                {renderItem({ item, drag: () => {}, isActive: false, getIndex: () => index })}
              </View>
            ))}
      </View>
    );
  }
  const ScaleDecorator = ({ children }: any) => children;
  return { __esModule: true, default: DraggableFlatList, ScaleDecorator };
});

// ── Store mocks ────────────────────────────────────────────────────────────────

let mockProducts: Product[] = [];
let mockRoutines: Routine[] = [];
const mockUpdateRoutine = jest.fn();

jest.mock('@/store/productsStore', () => ({
  useProductsStore: jest.fn((selector: any) => selector({ products: mockProducts })),
}));

jest.mock('@/store/routinesStore', () => ({
  useRoutinesStore: jest.fn((selector: any) =>
    selector({ routines: mockRoutines, updateRoutine: mockUpdateRoutine }),
  ),
}));

// ── Subject under test ────────────────────────────────────────────────────────

import { WeeklyPlanView } from '@/components/routine/WeeklyPlanView';

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
        makeStep({ id: 'step-am-hidden', productId: HIDDEN_PRODUCT.id }),
        makeStep({ id: 'step-am-legacy', productId: LEGACY_PRODUCT.id }),
      ],
    },
    {
      id: 'routine-pm',
      name: 'Evening',
      timeOfDay: 'evening',
      steps: [
        makeStep({ id: 'step-pm-visible', productId: VISIBLE_PRODUCT.id }),
        makeStep({ id: 'step-pm-hidden', productId: HIDDEN_PRODUCT.id }),
      ],
    },
  ];
}

beforeEach(() => {
  jest.clearAllMocks();
  mockProducts = [VISIBLE_PRODUCT, HIDDEN_PRODUCT, LEGACY_PRODUCT];
  mockRoutines = makeRoutines();
});

// ── AC-WP1 / AC-WP2 / AC-WP3 — AM filtering ────────────────────────────────────

describe('AC-WP1: a step for a hidden product does not appear in the AM weekly plan', () => {
  it('should not render the hidden product name', () => {
    render(<WeeklyPlanView initialPeriod="morning" />);
    expect(screen.queryByText('Retinol Serum')).toBeNull();
  });
});

describe('AC-WP2: a step for a visible product appears in the AM weekly plan', () => {
  it('should render the visible product name', () => {
    render(<WeeklyPlanView initialPeriod="morning" />);
    expect(screen.getByText('Gentle Cleanser')).toBeTruthy();
  });
});

describe('AC-WP3: a step for a legacy product (isHidden undefined) appears in the weekly plan', () => {
  it('should render the legacy product name', () => {
    render(<WeeklyPlanView initialPeriod="morning" />);
    expect(screen.getByText('Vitamin C Serum')).toBeTruthy();
  });
});

// ── AC-WP4 — PM filtering ──────────────────────────────────────────────────────

describe('AC-WP4: a step for a hidden product does not appear in the PM weekly plan', () => {
  it('should not render the hidden product name when initialPeriod is evening', () => {
    render(<WeeklyPlanView initialPeriod="evening" />);
    expect(screen.getByText('Gentle Cleanser')).toBeTruthy();
    expect(screen.queryByText('Retinol Serum')).toBeNull();
  });
});

// ── AC-WP5 — un-hiding restores the step ───────────────────────────────────────

describe('AC-WP5: un-hiding a product restores its step to the AM weekly plan', () => {
  it('should render the previously-hidden product name after isHidden flips to false', () => {
    const { rerender } = render(<WeeklyPlanView initialPeriod="morning" />);
    expect(screen.queryByText('Retinol Serum')).toBeNull();

    mockProducts = mockProducts.map((p) => (p.id === HIDDEN_PRODUCT.id ? { ...p, isHidden: false } : p));
    rerender(<WeeklyPlanView initialPeriod="morning" />);

    expect(screen.getByText('Retinol Serum')).toBeTruthy();
  });
});
