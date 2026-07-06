/**
 * Integration test — Story 9 UI AC: the vitamin C auto-migration infobox.
 * Spec: docs/specs/2026-07-04-routine-engine.md §4 Story 9
 *
 * FE-9 shipped the infobox on ProductDetailScreen (progress/routine-engine.md,
 * 2026-07-05 "SURROUNDING UX" entry): a one-tap in-place reclassification
 * instead of a tag-wizard deep link (documented deviation — no wizard route
 * exists for a return trip).
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import type { Product } from '@/types';

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return {
    Feather: ({ name, testID }: { name: string; testID?: string }) => (
      <View testID={testID ?? `feather-icon-${name}`} />
    ),
  };
});

jest.mock('@/components/product/DeleteProductModal', () => ({ DeleteProductModal: () => null }));
jest.mock('@/components/product/ProductActionSheet', () => ({ ProductActionSheet: () => null }));
jest.mock('@/components/routine/RemoveRoutineActionSheet', () => ({ RemoveRoutineActionSheet: () => null }));
jest.mock('@/components/routine/RoutineSchedulerSheet', () => ({ RoutineSchedulerSheet: () => null }));

jest.mock('@/store/routinesStore', () => ({
  useRoutinesStore: jest.fn((selector: any) => selector({ routines: [] })),
}));

const mockUpdateProduct = jest.fn();
let mockProducts: Product[] = [];

jest.mock('@/store/productsStore', () => ({
  useProductsStore: jest.fn((selector: any) => selector({ products: mockProducts, updateProduct: mockUpdateProduct })),
}));

import ProductDetailScreen from '@/screens/ProductDetailScreen';

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: 'p1',
    name: 'Brightening Serum',
    brand: 'Vials Lab',
    productType: 'serum',
    imageUrl: null,
    activeIngredients: [],
    activeTags: ['vitamin_c_pure'],
    fullIngredientText: null,
    usageTime: 'morning',
    openBeautyFactsId: null,
    addedAt: '2026-01-01',
    notes: null,
    openedDate: null,
    paoMonths: null,
    ...overrides,
  };
}

function renderScreen(productId: string) {
  return render(
    <ProductDetailScreen
      navigation={{ navigate: jest.fn(), goBack: jest.fn() } as any}
      route={{ params: { productId } } as any}
    />,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Story 9 AC: the migrated product detail card shows a subtle, non-blocking infobox', () => {
  it('renders the infobox only when vitaminCAutoMigrated is true and the product is still tagged pure', () => {
    const migrated = makeProduct({ id: 'p-migrated', vitaminCAutoMigrated: true });
    mockProducts = [migrated];

    renderScreen('p-migrated');

    expect(screen.UNSAFE_getAllByProps({ children: 'Treated as pure vitamin C' }).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Mark as a vitamin C derivative')).toBeTruthy();
  });

  it('does not render the infobox for a non-migrated pure-vitamin-C product', () => {
    const notMigrated = makeProduct({ id: 'p-clean' });
    mockProducts = [notMigrated];

    renderScreen('p-clean');

    expect(screen.UNSAFE_queryAllByProps({ children: 'Treated as pure vitamin C' })).toHaveLength(0);
  });

  it('reclassifies to a derivative and clears the marker on one tap — a non-blocking, in-place action', () => {
    const migrated = makeProduct({ id: 'p-migrated', vitaminCAutoMigrated: true });
    mockProducts = [migrated];

    renderScreen('p-migrated');
    fireEvent.press(screen.getByLabelText('Mark as a vitamin C derivative'));

    expect(mockUpdateProduct).toHaveBeenCalledWith('p-migrated', {
      activeTags: ['vitamin_c_derivative'],
      vitaminCAutoMigrated: false,
    });
  });
});
