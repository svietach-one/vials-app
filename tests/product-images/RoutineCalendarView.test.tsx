/**
 * Component tests — RoutineCalendarView (img-05). `now` is injected so the
 * today-highlight never depends on the wall clock. The matrix maths itself is
 * covered in src/utils/calendarMatrix.test.ts; this file tests rendering and
 * wiring only.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Product, Routine, RoutineStep } from '@/types';

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return { Feather: ({ name }: { name: string }) => <View testID={`feather-icon-${name}`} /> };
});

jest.mock('@/components/ui/ProductThumbnail', () => {
  const { View } = require('react-native');
  return { ProductThumbnail: () => <View testID="product-thumbnail" /> };
});

import { RoutineCalendarView } from '@/components/routine/RoutineCalendarView';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
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
    ...overrides,
  };
}

function makeStep(overrides: Partial<RoutineStep> = {}): RoutineStep {
  return {
    id: 's1',
    productType: 'cleanser',
    productId: 'p1',
    hidden: false,
    scheduledDays: [],
    ...overrides,
  };
}

function makeRoutines(am: RoutineStep[], pm: RoutineStep[] = []): Routine[] {
  return [
    { id: 'r-am', name: 'Morning', timeOfDay: 'morning', steps: am },
    { id: 'r-pm', name: 'Evening', timeOfDay: 'evening', steps: pm },
  ];
}

// 15 July 2026 — a Wednesday, mid-month.
const NOW = new Date(2026, 6, 15, 9, 0, 0);

function renderView(overrides: Partial<React.ComponentProps<typeof RoutineCalendarView>> = {}) {
  const props = {
    routines: makeRoutines([makeStep()]),
    products: [makeProduct()],
    onProductPress: jest.fn(),
    onAddProduct: jest.fn(),
    now: NOW,
    ...overrides,
  };
  render(<RoutineCalendarView {...props} />);
  return props;
}

describe('RoutineCalendarView', () => {
  it('shows the month it is displaying', () => {
    renderView();
    expect(screen.getByText('July 2026')).toBeTruthy();
  });

  it('renders one identity row per scheduled product', () => {
    renderView({
      routines: makeRoutines([makeStep({ productId: 'p1' }), makeStep({ id: 's2', productId: 'p2' })]),
      products: [makeProduct(), makeProduct({ id: 'p2', name: 'Night Serum' })],
    });

    expect(screen.getByText('Gentle Cleanser')).toBeTruthy();
    expect(screen.getByText('Night Serum')).toBeTruthy();
  });

  it('renders a cell for every day of the month', () => {
    renderView();
    // July has 31 days; an every-day AM schedule fills them all.
    expect(screen.getAllByTestId('calendar-cell-am')).toHaveLength(31);
  });

  it('marks AM and PM halves independently', () => {
    renderView({
      // Mondays AM, Tuesdays PM.
      routines: makeRoutines(
        [makeStep({ id: 'a', scheduledDays: [1] })],
        [makeStep({ id: 'b', scheduledDays: [2] })],
      ),
    });

    // July 2026 has 4 Mondays and 4 Tuesdays.
    expect(screen.getAllByTestId('calendar-cell-am')).toHaveLength(4);
    expect(screen.getAllByTestId('calendar-cell-pm')).toHaveLength(4);
    // The remaining 23 days are unscheduled.
    expect(screen.getAllByTestId('calendar-cell-empty')).toHaveLength(23);
  });

  it('renders a combined cell when a product runs morning and evening the same day', () => {
    renderView({
      routines: makeRoutines(
        [makeStep({ id: 'a', scheduledDays: [1] })],
        [makeStep({ id: 'b', scheduledDays: [1] })],
      ),
    });

    expect(screen.getAllByTestId('calendar-cell-ampm')).toHaveLength(4);
  });

  it('highlights today when viewing the current month', () => {
    renderView();
    expect(screen.getByTestId('calendar-today')).toBeTruthy();
    expect(screen.getByTestId('calendar-today').props.children).toBe(15);
  });

  it('opens the action sheet for the product when its identity cell is tapped', () => {
    const props = renderView();

    fireEvent.press(screen.getByLabelText('Gentle Cleanser, open actions'));

    expect(props.onProductPress).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p1' }),
    );
  });

  it('shows an empty state with an add CTA when nothing is scheduled', () => {
    const props = renderView({ routines: makeRoutines([]) });

    expect(screen.getByText('No products scheduled this month.')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Add product to routine'));
    expect(props.onAddProduct).toHaveBeenCalledTimes(1);
  });

  it('excludes hidden steps and dangling products from the grid', () => {
    renderView({
      routines: makeRoutines([
        makeStep({ id: 'hidden', productId: 'p1', hidden: true }),
        makeStep({ id: 'dangling', productId: 'deleted' }),
      ]),
    });

    expect(screen.getByText('No products scheduled this month.')).toBeTruthy();
  });
});
