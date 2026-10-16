/**
 * Story 7: the calendar's product rows are discoverable (caption, highlight,
 * per-mode accessibility hint). RoutineCalendarView stays presentational and
 * takes `editMode` as a prop (FE-10). `now` is injected.
 *
 * PINNED BY THIS SUITE (the design leaves them to qa-lead, the engineer matches):
 *   - the frozen product column carries testID "calendar-product-column" in BOTH
 *     modes (so "not highlighted" is observable);
 *   - highlighted = its flattened style has backgroundColor colors.statusInfoTint
 *     and carries colors.statusInfoLine as its edge colour; never a plum tint.
 * The existing row label "<name>, open actions" must not change.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { CALENDAR_HINT_COPY } from '@/constants/routineScreenCopy';
import { colors, palette } from '@/constants/tokens';
import type { Product, Routine } from '@/types';
import { RoutineCalendarView, type RoutineCalendarViewProps } from '@/components/routine/RoutineCalendarView';

jest.mock('@/components/ui/Icon', () => {
  const { View } = require('react-native');
  return { Icon: ({ name }: { name: string }) => <View testID={`icon-${name}`} /> };
});
jest.mock('@/components/ui/ProductThumbnail', () => {
  const { View } = require('react-native');
  return { ProductThumbnail: () => <View testID="product-thumbnail" /> };
});

const NOW_FIXED = new Date('2026-07-15T12:00:00Z');

const CLEANSER: Product = {
  id: 'p1', name: 'Gentle Cleanser', brand: 'Vials', productType: 'cleanser', imageUrl: null,
  activeIngredients: [], activeTags: [], fullIngredientText: null, usageTime: 'both',
  openBeautyFactsId: null, addedAt: '2026-01-01', notes: null, openedDate: null, paoMonths: null,
};

const ROUTINES: Routine[] = [
  { id: 'r-am', name: 'Morning', timeOfDay: 'morning', steps: [{ id: 's1', productType: 'cleanser', productId: 'p1', hidden: false, scheduledDays: [] }] },
  { id: 'r-pm', name: 'Evening', timeOfDay: 'evening', steps: [] },
];
const EMPTY: Routine[] = [
  { id: 'r-am', name: 'Morning', timeOfDay: 'morning', steps: [] },
  { id: 'r-pm', name: 'Evening', timeOfDay: 'evening', steps: [] },
];

function makeProps(overrides: Partial<RoutineCalendarViewProps> = {}): RoutineCalendarViewProps {
  return { routines: ROUTINES, products: [CLEANSER], onProductPress: jest.fn(), onAddProduct: jest.fn(), now: NOW_FIXED, editMode: false, ...overrides };
}

const columnStyle = () => StyleSheet.flatten(screen.getByTestId('calendar-product-column').props.style) ?? {};
const rowButton = () => screen.getByRole('button', { name: 'Gentle Cleanser, open actions' });

describe('edit mode off', () => {
  it('shows the neutral view caption and does not highlight the product column', () => {
    render(<RoutineCalendarView {...makeProps()} />);

    expect(screen.getByText(CALENDAR_HINT_COPY.view)).toBeTruthy();
    expect(screen.queryByText(CALENDAR_HINT_COPY.edit)).toBeNull();
    expect(Object.values(columnStyle())).not.toContain(colors.statusInfoTint);
  });

  it('announces the row with the view hint and keeps the existing label', () => {
    render(<RoutineCalendarView {...makeProps()} />);

    expect(rowButton().props.accessibilityHint).toBe(CALENDAR_HINT_COPY.rowHintView);
  });
});

describe('edit mode on', () => {
  it('shows the edit caption and highlights the product column with the information tint and edge', () => {
    render(<RoutineCalendarView {...makeProps({ editMode: true })} />);

    expect(screen.getByText(CALENDAR_HINT_COPY.edit)).toBeTruthy();
    expect(screen.queryByText(CALENDAR_HINT_COPY.view)).toBeNull();
    const style = columnStyle();
    expect(style.backgroundColor).toBe(colors.statusInfoTint);
    expect(Object.values(style)).toContain(colors.statusInfoLine);
    expect(Object.values(style)).not.toContain(palette.plumTint);
  });

  it('announces the row with the edit hint', () => {
    render(<RoutineCalendarView {...makeProps({ editMode: true })} />);

    expect(rowButton().props.accessibilityHint).toBe(CALENDAR_HINT_COPY.rowHintEdit);
  });
});

describe('toggling the pencil while the calendar is open', () => {
  it('switches caption, highlight and hint at once, without remounting the rows', () => {
    const props = makeProps();
    const { rerender } = render(<RoutineCalendarView {...props} />);
    expect(screen.getByText(CALENDAR_HINT_COPY.view)).toBeTruthy();

    rerender(<RoutineCalendarView {...props} editMode />);
    expect(screen.getByText(CALENDAR_HINT_COPY.edit)).toBeTruthy();
    expect(columnStyle().backgroundColor).toBe(colors.statusInfoTint);
    expect(rowButton().props.accessibilityHint).toBe(CALENDAR_HINT_COPY.rowHintEdit);

    rerender(<RoutineCalendarView {...props} editMode={false} />);
    expect(screen.getByText(CALENDAR_HINT_COPY.view)).toBeTruthy();
    expect(Object.values(columnStyle())).not.toContain(colors.statusInfoTint);
  });
});

describe('rows and the empty state', () => {
  it('still opens the product when a row is pressed', () => {
    const props = makeProps();
    render(<RoutineCalendarView {...props} />);

    fireEvent.press(rowButton());

    expect(props.onProductPress).toHaveBeenCalledWith(CLEANSER);
  });

  it.each([false, true])('shows neither caption nor highlight with no scheduled products (editMode=%s)', (editMode) => {
    render(<RoutineCalendarView {...makeProps({ routines: EMPTY, editMode })} />);

    expect(screen.queryByText(CALENDAR_HINT_COPY.view)).toBeNull();
    expect(screen.queryByText(CALENDAR_HINT_COPY.edit)).toBeNull();
    expect(screen.queryByTestId('calendar-product-column')).toBeNull();
    expect(screen.getByText('No products scheduled')).toBeTruthy();
  });

  it('draws the caption at 14px or more', () => {
    render(<RoutineCalendarView {...makeProps()} />);

    const size = StyleSheet.flatten(screen.getByText(CALENDAR_HINT_COPY.view).props.style)?.fontSize;
    expect(size).toBeGreaterThanOrEqual(14);
  });
});

describe('copy lives in one module', () => {
  it('provides a non-empty caption and hint for each mode', () => {
    for (const text of Object.values(CALENDAR_HINT_COPY)) expect(text.trim().length).toBeGreaterThan(0);
  });
});
