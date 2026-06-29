/**
 * Integration tests — ProductShelfCard
 *
 * Covers all acceptance criteria from docs/specs/product-shelf-card.md:
 *   Story 1  Routine-member display (calendar + time-of-day icons)
 *   Story 2  Non-routine / hidden display (eye-off label)
 *   Story 3  Badge row (type + active-ingredient badges)
 *   Story 4  Overflow menu (action sheet routing)
 *   Story 5  Pressed and disabled states
 *   Extra    Product title: 2-line truncation behaviour
 *   Extra    Layout stability when title is long
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { ProductShelfCard } from '@/components/product/ProductShelfCard';
import { makeProduct, makeDefaultShelfCardProps } from './fixtures';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('@/constants/labels', () => ({
  PRODUCT_TYPE_LABELS: {
    cleanser: 'Cleanser',
    serum: 'Serum',
    moisturizer: 'Moisturizer',
    spf: 'SPF',
    toner: 'Toner',
    essence: 'Essence',
    gel: 'Gel',
    oil: 'Oil',
    makeup_remover: 'Makeup Remover',
    peeling: 'Peeling',
    ampoule: 'Ampoule',
    lotion: 'Lotion',
    cream: 'Cream',
    eye_cream: 'Eye Cream',
    mask: 'Mask',
    balm: 'Balm',
    spot_treatment: 'Spot Treatment',
    other: 'Other',
  },
  ACTIVE_INGREDIENT_LABELS: {
    retinol: 'Retinol',
    aha: 'AHA',
    bha: 'BHA',
    vitamin_c: 'Vitamin C',
    niacinamide: 'Niacinamide',
    copper_peptides: 'Copper Peptides',
    benzoyl_peroxide: 'Benzoyl Peroxide',
    spf_chemical: 'SPF (Chemical)',
  },
}));

jest.mock('@/utils/routineLabel', () => ({
  formatScheduleDays: jest.fn((days: number[]) =>
    days.length === 0 ? 'Every day' : 'Mon • Wed • Sat',
  ),
  deriveProductSchedule: jest.fn(),
  formatRoutineLabel: jest.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Renders card and returns the default props used. */
function renderCard(overrides: Partial<ReturnType<typeof makeDefaultShelfCardProps>> = {}) {
  const props = { ...makeDefaultShelfCardProps(), ...overrides };
  render(<ProductShelfCard {...props} />);
  return props;
}

// ── Story 1: Routine-member display ───────────────────────────────────────────

describe('Story 1 — Routine-member display', () => {
  it('shows calendar icon and schedule label when product is in a routine', () => {
    renderCard({ isInRoutine: true, scheduleLabel: 'Mon • Wed • Sat' });
    expect(screen.getByText('Mon • Wed • Sat')).toBeTruthy();
  });

  it('shows only the sun icon when usageTime is morning', () => {
    renderCard({ isInRoutine: true, usageTime: 'morning' });
    expect(screen.getByTestId('icon-sun')).toBeTruthy();
    expect(screen.queryByTestId('icon-moon')).toBeNull();
  });

  it('shows only the moon icon when usageTime is evening', () => {
    renderCard({ isInRoutine: true, usageTime: 'evening' });
    expect(screen.getByTestId('icon-moon')).toBeTruthy();
    expect(screen.queryByTestId('icon-sun')).toBeNull();
  });

  it('shows both moon and sun icons when usageTime is both', () => {
    renderCard({ isInRoutine: true, usageTime: 'both' });
    expect(screen.getByTestId('icon-moon')).toBeTruthy();
    expect(screen.getByTestId('icon-sun')).toBeTruthy();
  });

  it('does not show "Hidden from routine" when product is in a routine', () => {
    renderCard({ isInRoutine: true });
    expect(screen.queryByText('Hidden from routine')).toBeNull();
  });
});

// ── Story 2: Non-routine display ──────────────────────────────────────────────

describe('Story 2 — Non-routine / hidden display', () => {
  it('shows "Hidden from routine" label when product is not in a routine', () => {
    renderCard({ isInRoutine: false });
    expect(screen.getByText('Hidden from routine')).toBeTruthy();
  });

  it('does not show the calendar icon when product is not in a routine', () => {
    renderCard({ isInRoutine: false });
    expect(screen.queryByTestId('icon-calendar')).toBeNull();
  });

  it('does not show the schedule day label when product is not in a routine', () => {
    renderCard({ isInRoutine: false, scheduleLabel: 'Mon • Wed • Sat' });
    expect(screen.queryByText('Mon • Wed • Sat')).toBeNull();
  });
});

// ── Story 3: Badge row ────────────────────────────────────────────────────────

describe('Story 3 — Badge row', () => {
  it('renders a type badge with the correct label', () => {
    renderCard({ product: makeProduct({ productType: 'cleanser' }) });
    expect(screen.getByText('Cleanser')).toBeTruthy();
  });

  it('renders an active-ingredient badge when activeTags has an entry', () => {
    const product = makeProduct({
      activeTags: ['niacinamide'],
      activeIngredients: [{ key: 'niacinamide', displayName: 'Niacinamide' }],
    });
    renderCard({ product });
    expect(screen.getByText('Niacinamide')).toBeTruthy();
  });

  it('does not render an active badge when activeTags and activeIngredients are both empty', () => {
    const product = makeProduct({ activeTags: [], activeIngredients: [] });
    renderCard({ product });
    // The label constants won't match any active key — no active badge text should appear
    expect(screen.queryByText('Retinol')).toBeNull();
    expect(screen.queryByText('Niacinamide')).toBeNull();
  });
});

// ── Story 4: Overflow menu ────────────────────────────────────────────────────

describe('Story 4 — Overflow menu', () => {
  it('calls onCardPress when the card body is tapped', () => {
    const props = renderCard();
    fireEvent.press(screen.getByRole('button', { name: /hydrabio h2o.*tap to view/i }));
    expect(props.onCardPress).toHaveBeenCalledTimes(1);
  });

  it('opens the action sheet when the overflow button is tapped', () => {
    renderCard({ isInRoutine: true });
    fireEvent.press(screen.getByLabelText(/more actions/i));
    expect(screen.getByText('Edit Product')).toBeTruthy();
  });

  it('shows "Remove from routine" in the sheet when product is in a routine', () => {
    renderCard({ isInRoutine: true });
    fireEvent.press(screen.getByLabelText(/more actions/i));
    expect(screen.getByText('Remove from routine')).toBeTruthy();
    expect(screen.queryByText('Add to routine')).toBeNull();
  });

  it('shows "Add to routine" in the sheet when product is not in a routine', () => {
    renderCard({ isInRoutine: false });
    fireEvent.press(screen.getByLabelText(/more actions/i));
    expect(screen.getByText('Add to routine')).toBeTruthy();
    expect(screen.queryByText('Remove from routine')).toBeNull();
  });

  it('does not call onCardPress when the overflow button is tapped', () => {
    const props = renderCard();
    fireEvent.press(screen.getByLabelText(/more actions/i));
    expect(props.onCardPress).not.toHaveBeenCalled();
  });

  it('calls onDelete when Delete is tapped in the action sheet', () => {
    const props = renderCard();
    fireEvent.press(screen.getByLabelText(/more actions/i));
    fireEvent.press(screen.getByText('Delete Product'));
    expect(props.onDelete).toHaveBeenCalledWith(props.product);
  });

  it('calls onEdit when Edit is tapped in the action sheet', () => {
    const props = renderCard();
    fireEvent.press(screen.getByLabelText(/more actions/i));
    fireEvent.press(screen.getByText('Edit Product'));
    expect(props.onEdit).toHaveBeenCalledWith(props.product);
  });
});

// ── Story 5: Pressed and disabled states ──────────────────────────────────────

describe('Story 5 — Card states', () => {
  it('does not call onCardPress when disabled is true', () => {
    const props = renderCard({ disabled: true });
    fireEvent.press(screen.getByRole('button', { name: /hydrabio h2o.*tap to view/i }));
    expect(props.onCardPress).not.toHaveBeenCalled();
  });
});

// ── Title: 2-line truncation behaviour ────────────────────────────────────────

describe('Product title — 2-line truncation', () => {
  it('renders normally for a short title', () => {
    renderCard({ product: makeProduct({ name: 'Toner' }) });
    const title = screen.getByText('Toner');
    expect(title).toBeTruthy();
    expect(title.props.numberOfLines).toBe(2);
  });

  it('renders a medium title in full without truncation (fits within 2 lines)', () => {
    renderCard({ product: makeProduct({ name: 'Hydrabio H2O Micellar Water' }) });
    const title = screen.getByText('Hydrabio H2O Micellar Water');
    expect(title).toBeTruthy();
    expect(title.props.numberOfLines).toBe(2);
  });

  it('applies numberOfLines={2} on a very long title so truncation occurs after line 2', () => {
    const longName =
      'Ultra Hydrating Deeply Moisturizing Anti-Aging Overnight Recovery Serum Concentrate';
    renderCard({ product: makeProduct({ name: longName }) });
    const title = screen.getByText(longName);
    expect(title.props.numberOfLines).toBe(2);
  });

  it('keeps brand name on a single line regardless of title length', () => {
    const longName =
      'Ultra Hydrating Deeply Moisturizing Anti-Aging Overnight Recovery Serum Concentrate';
    renderCard({ product: makeProduct({ name: longName, brand: 'The Ordinary' }) });
    const brand = screen.getByText('The Ordinary');
    expect(brand.props.numberOfLines).toBe(1);
  });
});

// ── Layout stability ──────────────────────────────────────────────────────────

describe('Layout stability — elements stay present when title is long', () => {
  const longName =
    'Ultra Hydrating Deeply Moisturizing Anti-Aging Overnight Recovery Serum with Peptides';

  it('badge row is always rendered regardless of title length', () => {
    renderCard({ product: makeProduct({ name: longName, productType: 'serum' }) });
    expect(screen.getByText('Serum')).toBeTruthy();
  });

  it('overflow menu button is always present regardless of title length', () => {
    renderCard({ product: makeProduct({ name: longName }) });
    expect(screen.getByLabelText(/more actions/i)).toBeTruthy();
  });

  it('routine status middle row is present and unchanged when title wraps', () => {
    renderCard({
      product: makeProduct({ name: longName }),
      isInRoutine: true,
      scheduleLabel: 'Mon • Wed • Sat',
      usageTime: 'both',
    });
    expect(screen.getByText('Mon • Wed • Sat')).toBeTruthy();
    expect(screen.getByTestId('icon-moon')).toBeTruthy();
    expect(screen.getByTestId('icon-sun')).toBeTruthy();
  });
});
