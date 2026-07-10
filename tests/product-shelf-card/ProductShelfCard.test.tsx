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
 *
 * Also covers docs/specs/multi-active-badges.md (all 4 user stories) at the
 * bottom of this file — see "Multi-active badges" describe blocks. These
 * exercise src/utils/activeBadges.ts (getProductActiveKeys /
 * getActiveBadgeCategory) indirectly through the rendered card and are
 * EXPECTED TO FAIL until the engineer implements per
 * docs/tech-design/multi-active-badges.md (that util module + the
 * ProductShelfCard.tsx badge-row rewrite do not exist yet).
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ProductShelfCard } from '@/components/product/ProductShelfCard';
import { palette } from '@/constants/tokens';
import {
  makeProduct,
  makeDefaultShelfCardProps,
  makeMultiActiveProduct,
  makeFallbackActiveProduct,
  makeExplicitNoActivesProduct,
  makeSingleActiveProduct,
  makeFourActiveProduct,
} from './fixtures';

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
    retinoid: 'Retinoids',
    aha: 'AHA',
    bha: 'BHA',
    vitamin_c: 'Vitamin C',
    vitamin_c_derivative: 'Vitamin C (Derivative)',
    niacinamide: 'Niacinamide',
    copper_peptides: 'Copper Peptides',
    benzoyl_peroxide: 'Benzoyl Peroxide',
    spf_chemical: 'SPF (Chemical)',
    spf_filters: 'UV Filters (SPF)',
    ceramides: 'Ceramides',
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

// ════════════════════════════════════════════════════════════════════════════
// Multi-active badges — docs/specs/multi-active-badges.md
// docs/tech-design/multi-active-badges.md
//
// New testIDs introduced by the tech design: `active-badge-${key}` on each
// active-ingredient badge container (one per ActiveIngredientKey rendered).
// Implemented by src/utils/activeBadges.ts (getProductActiveKeys,
// getActiveBadgeCategory) + a ProductShelfCard.tsx badge-row rewrite —
// neither exists yet, so every test below is expected to FAIL (red) against
// the current component and turn green once FE-1..FE-3 are implemented.
// ════════════════════════════════════════════════════════════════════════════

/** Flattens an RN style prop (array or object) into a single plain object. */
function flattenStyle(style: unknown): Record<string, unknown> {
  return (StyleSheet.flatten(style as never) ?? {}) as Record<string, unknown>;
}

// ── Story 1: See every active ingredient on a multi-active product ───────────

describe('Multi-active badges — Story 1: every active renders', () => {
  it('renders a badge for every key in activeTags when it has 2+ entries', () => {
    renderCard({ product: makeMultiActiveProduct() });

    expect(screen.getByTestId('active-badge-bha')).toBeTruthy();
    expect(screen.getByTestId('active-badge-niacinamide')).toBeTruthy();
    expect(screen.getByText('BHA')).toBeTruthy();
    expect(screen.getByText('Niacinamide')).toBeTruthy();
  });

  it('falls back to the FULL activeIngredients array (not just index 0) when activeTags is undefined', () => {
    renderCard({ product: makeFallbackActiveProduct() });

    expect(screen.getByTestId('active-badge-retinoid')).toBeTruthy();
    expect(screen.getByTestId('active-badge-ceramides')).toBeTruthy();
    expect(screen.getByText('Retinoids')).toBeTruthy();
    expect(screen.getByText('Ceramides')).toBeTruthy();
  });

  it('renders zero active badges when activeTags is explicitly empty, even with non-empty activeIngredients', () => {
    renderCard({ product: makeExplicitNoActivesProduct() });

    expect(screen.queryByTestId('active-badge-bha')).toBeNull();
    expect(screen.queryAllByTestId(/^active-badge-/)).toHaveLength(0);
    expect(screen.queryByText('BHA')).toBeNull();
  });

  it('renders zero active badges and an unchanged layout when neither array has actives', () => {
    const product = makeProduct({ activeTags: [], activeIngredients: [] });
    renderCard({ product });

    expect(screen.queryAllByTestId(/^active-badge-/)).toHaveLength(0);
    // Layout unchanged: type badge and overflow button are still present.
    expect(screen.getByText('Cleanser')).toBeTruthy();
    expect(screen.getByLabelText(/more actions/i)).toBeTruthy();
  });
});

// ── Story 2: Distinguish active categories by color ───────────────────────────

describe('Multi-active badges — Story 2: category colors', () => {
  it('renders an exfoliant/treatment-acid active (bha) in the amber category color', () => {
    renderCard({ product: makeSingleActiveProduct('bha') });

    const badge = screen.getByTestId('active-badge-bha');
    const label = screen.getByText('BHA');
    expect(flattenStyle(badge.props.style).borderColor).toBe(palette.amberLine);
    expect(flattenStyle(label.props.style).color).toBe(palette.amber);
  });

  it('renders a vitamin C active (vitamin_c_derivative) in the amber category color too', () => {
    renderCard({ product: makeSingleActiveProduct('vitamin_c_derivative') });

    const badge = screen.getByTestId('active-badge-vitamin_c_derivative');
    const label = screen.getByText('Vitamin C (Derivative)');
    expect(flattenStyle(badge.props.style).borderColor).toBe(palette.amberLine);
    expect(flattenStyle(label.props.style).color).toBe(palette.amber);
  });

  it('renders a soothing/brightening active (niacinamide) in the bottle-green category color', () => {
    renderCard({ product: makeSingleActiveProduct('niacinamide') });

    const badge = screen.getByTestId('active-badge-niacinamide');
    const label = screen.getByText('Niacinamide');
    expect(flattenStyle(badge.props.style).borderColor).toBe(palette.bottleGreenLine);
    expect(flattenStyle(label.props.style).color).toBe(palette.bottleGreen);
  });

  it('renders a hydrating/barrier active (ceramides) in the cobalt category color', () => {
    renderCard({ product: makeSingleActiveProduct('ceramides') });

    const badge = screen.getByTestId('active-badge-ceramides');
    const label = screen.getByText('Ceramides');
    expect(flattenStyle(badge.props.style).borderColor).toBe(palette.cobaltLine);
    expect(flattenStyle(label.props.style).color).toBe(palette.cobalt);
  });

  it('renders an active outside all three buckets (spf_filters) with the existing neutral zinc/black look', () => {
    renderCard({ product: makeSingleActiveProduct('spf_filters') });

    const badge = screen.getByTestId('active-badge-spf_filters');
    const label = screen.getByText('UV Filters (SPF)');
    expect(flattenStyle(badge.props.style).borderColor).toBe(palette.zinc300);
    expect(flattenStyle(label.props.style).color).toBe(palette.black);
  });
});

// ── Story 3: Tell the product-type badge apart from active badges ────────────

describe('Multi-active badges — Story 3: type badge vs. active badge styling', () => {
  it('keeps the type badge on a solid tint fill, unchanged from today', () => {
    renderCard({ product: makeProduct({ productType: 'cream' }) });

    const typeLabel = screen.getByText('Cream');
    const typeBadgeContainer = typeLabel.parent?.parent;
    expect(flattenStyle(typeBadgeContainer?.props.style).backgroundColor).toBe(
      palette.bottleGreenTint,
    );
  });

  it('never gives the active badge the same solid-fill recipe as the type badge, even in the same hue family', () => {
    // "mask" type badge is amber (palette.amberTint solid fill); "bha" active
    // badge is also amber-family (exfoliant) — this is the exact same-hue
    // collision called out in the tech design's Assumptions section.
    const product = makeProduct({ productType: 'mask', activeTags: ['bha'], activeIngredients: [] });
    renderCard({ product });

    const typeBadgeContainer = screen.getByText('Mask').parent?.parent;
    const activeBadgeContainer = screen.getByTestId('active-badge-bha');

    const typeStyle = flattenStyle(typeBadgeContainer?.props.style);
    const activeStyle = flattenStyle(activeBadgeContainer.props.style);

    // Type badge: solid amber tint fill, no meaningful border color assertion needed here.
    expect(typeStyle.backgroundColor).toBe(palette.amberTint);
    // Active badge: outlined recipe — must NOT reuse the type badge's solid fill,
    // and must carry a colored border instead.
    expect(activeStyle.backgroundColor).not.toBe(palette.amberTint);
    expect(activeStyle.borderColor).toBe(palette.amberLine);
  });
});

// ── Story 4: Cards with many actives stay fully readable ─────────────────────

describe('Multi-active badges — Story 4: many actives, no "+N" overflow', () => {
  it('renders all 4 badges for a 4-active product with no badge hidden', () => {
    renderCard({ product: makeFourActiveProduct() });

    expect(screen.getByTestId('active-badge-bha')).toBeTruthy();
    expect(screen.getByTestId('active-badge-niacinamide')).toBeTruthy();
    expect(screen.getByTestId('active-badge-ceramides')).toBeTruthy();
    expect(screen.getByTestId('active-badge-spf_filters')).toBeTruthy();
    expect(screen.queryAllByTestId(/^active-badge-/)).toHaveLength(4);
  });

  it('never shows a "+N" or similar numeric overflow indicator, regardless of active count', () => {
    renderCard({ product: makeFourActiveProduct() });

    expect(screen.queryAllByText(/\+\s*\d+/)).toHaveLength(0);
  });

  it('keeps the overflow ("more actions") button present and tappable when the badge row is at its widest', () => {
    renderCard({ product: makeFourActiveProduct(), isInRoutine: true });

    const overflowButton = screen.getByLabelText(/more actions/i);
    expect(overflowButton).toBeTruthy();

    fireEvent.press(overflowButton);
    expect(screen.getByText('Edit Product')).toBeTruthy();
  });
});
