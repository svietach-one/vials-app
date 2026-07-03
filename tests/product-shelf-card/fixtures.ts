import type { ProductShelfCardProps } from '@/components/product/ProductShelfCard';
import type { Product, RoutineStep } from '@/types';

export function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Hydrabio H2O',
    brand: 'Bioderma',
    productType: 'cleanser',
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

export function makeRoutineStep(overrides: Partial<RoutineStep> = {}): RoutineStep {
  return {
    id: 'step-1',
    productType: 'cleanser',
    productId: 'p1',
    hidden: false,
    scheduledDays: [1, 3, 6],
    ...overrides,
  };
}

export function makeDefaultShelfCardProps(): ProductShelfCardProps {
  return {
    product: makeProduct(),
    isInRoutine: true,
    scheduleLabel: 'Mon • Wed • Sat',
    usageTime: 'both',
    onCardPress: jest.fn(),
    onEdit: jest.fn(),
    onAddToRoutine: jest.fn(),
    onRemoveFromRoutine: jest.fn(),
    onDelete: jest.fn(),
    onToggleHidden: jest.fn(),
  };
}
