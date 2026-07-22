/**
 * Component tests — RoutineStepActionSheet (img-03). Contract: exactly four
 * actions, each dispatching for the current product and closing the sheet;
 * hidden entirely when no product is set.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Product } from '@/types';

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return { Feather: ({ name }: { name: string }) => <View testID={`feather-icon-${name}`} /> };
});

import { RoutineStepActionSheet } from '@/components/routine/RoutineStepActionSheet';

const PRODUCT: Product = {
  id: 'p1',
  name: 'Gentle Cleanser',
  brand: 'Vials',
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
};

function renderSheet(overrides: Partial<React.ComponentProps<typeof RoutineStepActionSheet>> = {}) {
  const props = {
    product: PRODUCT,
    onViewDetails: jest.fn(),
    onEdit: jest.fn(),
    onRemoveFromRoutine: jest.fn(),
    onHide: jest.fn(),
    onClose: jest.fn(),
    ...overrides,
  };
  render(<RoutineStepActionSheet {...props} />);
  return props;
}

describe('RoutineStepActionSheet', () => {
  it('renders exactly the four routine-step actions', () => {
    renderSheet();
    expect(screen.getByText('View product details')).toBeTruthy();
    expect(screen.getByText('Edit product')).toBeTruthy();
    expect(screen.getByText('Remove from routine')).toBeTruthy();
    expect(screen.getByText('Hide from routine')).toBeTruthy();
  });

  it('renders nothing when no product is set', () => {
    renderSheet({ product: null });
    expect(screen.queryByText('View product details')).toBeNull();
  });

  it.each([
    ['View product details', 'onViewDetails'],
    ['Edit product', 'onEdit'],
    ['Remove from routine', 'onRemoveFromRoutine'],
    ['Hide from routine', 'onHide'],
  ] as const)('dispatches %s for the product and closes', (label, handler) => {
    const props = renderSheet();
    fireEvent.press(screen.getByText(label));
    expect(props[handler]).toHaveBeenCalledWith(PRODUCT);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
