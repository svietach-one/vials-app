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
import { colors, palette } from '@/constants/tokens';
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

describe('Story 1 — Routine-member display (superseded 2026-07-22: icons moved onto the photo)', () => {
  it('shows only the sun icon (over the photo) when usageTime is morning', () => {
    renderCard({ isInRoutine: true, usageTime: 'morning' });
    expect(screen.getByTestId('icon-sun')).toBeTruthy();
    expect(screen.queryByTestId('icon-moon')).toBeNull();
  });

  it('shows only the moon icon (over the photo) when usageTime is evening', () => {
    renderCard({ isInRoutine: true, usageTime: 'evening' });
    expect(screen.getByTestId('icon-moon')).toBeTruthy();
    expect(screen.queryByTestId('icon-sun')).toBeNull();
  });

  it('shows both moon and sun icons (over the photo) when usageTime is both', () => {
    renderCard({ isInRoutine: true, usageTime: 'both' });
    expect(screen.getByTestId('icon-moon')).toBeTruthy();
    expect(screen.getByTestId('icon-sun')).toBeTruthy();
  });

  it('does not show the "hidden from routine" icon when product is in a routine', () => {
    renderCard({ isInRoutine: true });
    expect(screen.queryByTestId('icon-hidden-from-routine')).toBeNull();
  });

  it('renders the sun icon on an orange-on-light-yellow circle', () => {
    renderCard({ isInRoutine: true, usageTime: 'morning' });
    const circle = flattenStyle(screen.getByTestId('icon-sun').props.style);
    expect(circle.backgroundColor).toBe(palette.citronTint);
  });

  it('renders the moon icon on a blue-on-light-blue circle', () => {
    renderCard({ isInRoutine: true, usageTime: 'evening' });
    const circle = flattenStyle(screen.getByTestId('icon-moon').props.style);
    expect(circle.backgroundColor).toBe(palette.cobaltTint);
  });
});

// ── Story 2: Non-routine display ──────────────────────────────────────────────

describe('Story 2 — Non-routine / hidden display (superseded 2026-07-22: icon moved onto the photo)', () => {
  it('shows the "hidden from routine" icon (over the photo) when product is not in a routine', () => {
    renderCard({ isInRoutine: false });
    expect(screen.getByTestId('icon-hidden-from-routine')).toBeTruthy();
  });

  it('renders the "hidden from routine" icon on a dark-gray-on-light-gray circle', () => {
    renderCard({ isInRoutine: false });
    const circle = flattenStyle(screen.getByTestId('icon-hidden-from-routine').props.style);
    expect(circle.backgroundColor).toBe(palette.zinc100);
  });

  it('does not show the sun/moon icons when product is not in a routine', () => {
    renderCard({ isInRoutine: false });
    expect(screen.queryByTestId('icon-sun')).toBeNull();
    expect(screen.queryByTestId('icon-moon')).toBeNull();
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

describe('Product title — single-line truncation', () => {
  it('renders normally for a short title', () => {
    renderCard({ product: makeProduct({ name: 'Toner' }) });
    const title = screen.getByText('Toner');
    expect(title).toBeTruthy();
    expect(title.props.numberOfLines).toBe(1);
  });

  it('keeps a medium title on one line', () => {
    renderCard({ product: makeProduct({ name: 'Hydrabio H2O Micellar Water' }) });
    const title = screen.getByText('Hydrabio H2O Micellar Water');
    expect(title).toBeTruthy();
    expect(title.props.numberOfLines).toBe(1);
  });

  it('truncates a very long title with an ellipsis instead of wrapping', () => {
    const longName =
      'Ultra Hydrating Deeply Moisturizing Anti-Aging Overnight Recovery Serum Concentrate';
    renderCard({ product: makeProduct({ name: longName }) });
    const title = screen.getByText(longName);
    // One line, tail-ellipsized (RN's default ellipsizeMode) — the card height
    // stays constant regardless of product-name length.
    expect(title.props.numberOfLines).toBe(1);
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

  it('sun/moon overlay icons are present and unchanged when title wraps', () => {
    renderCard({
      product: makeProduct({ name: longName }),
      isInRoutine: true,
      usageTime: 'both',
    });
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

// ── Story 2: Actives share one uniform neutral color (superseded 2026-07-22 — see below) ──

describe('Multi-active badges — Story 2: uniform neutral color', () => {
  it('renders every active badge with the same neutral gray fill, regardless of category', () => {
    renderCard({ product: makeSingleActiveProduct('bha') });
    const bhaBadge = flattenStyle(screen.getByTestId('active-badge-bha').props.style);

    renderCard({ product: makeSingleActiveProduct('niacinamide') });
    const niacinamideBadge = flattenStyle(screen.getByTestId('active-badge-niacinamide').props.style);

    renderCard({ product: makeSingleActiveProduct('ceramides') });
    const ceramidesBadge = flattenStyle(screen.getByTestId('active-badge-ceramides').props.style);

    expect(bhaBadge.backgroundColor).toBe(colors.surfaceSunken);
    expect(niacinamideBadge.backgroundColor).toBe(colors.surfaceSunken);
    expect(ceramidesBadge.backgroundColor).toBe(colors.surfaceSunken);
  });

  it('renders an active outside all category buckets (spf_filters) with the same neutral fill too', () => {
    renderCard({ product: makeSingleActiveProduct('spf_filters') });

    const badge = flattenStyle(screen.getByTestId('active-badge-spf_filters').props.style);
    expect(badge.backgroundColor).toBe(colors.surfaceSunken);
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
    // badge is neutral gray — the two recipes must never collide.
    const product = makeProduct({ productType: 'mask', activeTags: ['bha'], activeIngredients: [] });
    renderCard({ product });

    const typeBadgeContainer = screen.getByText('Mask').parent?.parent;
    const activeBadgeContainer = screen.getByTestId('active-badge-bha');

    const typeStyle = flattenStyle(typeBadgeContainer?.props.style);
    const activeStyle = flattenStyle(activeBadgeContainer.props.style);

    // Type badge: solid amber tint fill.
    expect(typeStyle.backgroundColor).toBe(palette.amberTint);
    // Active badge: neutral gray fill — must NOT reuse the type badge's amber fill.
    expect(activeStyle.backgroundColor).not.toBe(palette.amberTint);
    expect(activeStyle.backgroundColor).toBe(colors.surfaceSunken);
  });
});

// ── Story 4: Cards with many actives collapse the rest into "+N" ─────────────
// (superseded 2026-07-22: no more fixed cap of 3 — pills must never render
// partially cut off, and there's no live layout measurement to check actual
// fit against, so the rule is estimated-width-based: try the first 2 actives,
// then 1. Critically, whenever there's a hidden remainder, the trailing "+N"
// badge's own width must ALSO fit the budget — two badges that would fit on
// their own can still force a fall back to 1 once the "+N" that follows them
// is accounted for. Whatever doesn't make it in rolls into that "+N" badge —
// still visible on the product's own detail page.)

describe('Multi-active badges — Story 4: "+N" overflow (superseded 2026-07-22)', () => {
  it('falls back to 1 badge plus "+N" when a 4-active product would otherwise need to also fit an overflow badge', () => {
    // "BHA" + "Niacinamide" alone would fit as 2 badges, but once the
    // trailing "+N" badge (needed since there are 4 actives total) is
    // budgeted for too, they no longer fit together — so this shows just 1.
    renderCard({ product: makeFourActiveProduct() });

    expect(screen.getByTestId('active-badge-bha')).toBeTruthy();
    expect(screen.queryByTestId('active-badge-niacinamide')).toBeNull();
    expect(screen.queryByTestId('active-badge-ceramides')).toBeNull();
    expect(screen.queryByTestId('active-badge-spf_filters')).toBeNull();
    expect(screen.queryAllByTestId(/^active-badge-(?!overflow)/)).toHaveLength(1);
    expect(screen.getByTestId('active-badge-overflow')).toBeTruthy();
    expect(screen.getByText('+3')).toBeTruthy();
  });

  it('shows no overflow badge when there are only 2 actives and both fit', () => {
    renderCard({ product: makeMultiActiveProduct() });

    expect(screen.getByTestId('active-badge-bha')).toBeTruthy();
    expect(screen.getByTestId('active-badge-niacinamide')).toBeTruthy();
    expect(screen.queryByTestId('active-badge-overflow')).toBeNull();
  });

  it('falls back to showing just 1 badge when the first 2 combined labels are too long to fit', () => {
    const product = makeProduct({
      activeTags: ['vitamin_c_derivative', 'spf_filters'],
      activeIngredients: [],
    });
    renderCard({ product });

    expect(screen.getByTestId('active-badge-vitamin_c_derivative')).toBeTruthy();
    expect(screen.queryByTestId('active-badge-spf_filters')).toBeNull();
    expect(screen.queryAllByTestId(/^active-badge-(?!overflow)/)).toHaveLength(1);
    expect(screen.getByTestId('active-badge-overflow')).toBeTruthy();
    expect(screen.getByText('+1')).toBeTruthy();
  });

  it('never truncates a rendered active badge label', () => {
    renderCard({ product: makeMultiActiveProduct() });

    expect(screen.getByText('BHA')).toBeTruthy();
    expect(screen.getByText('Niacinamide')).toBeTruthy();
  });

  it('keeps the overflow ("more actions") button present and tappable alongside a "+N" active-overflow badge', () => {
    renderCard({ product: makeFourActiveProduct(), isInRoutine: true });

    const overflowButton = screen.getByLabelText(/more actions/i);
    expect(overflowButton).toBeTruthy();

    fireEvent.press(overflowButton);
    expect(screen.getByText('Edit Product')).toBeTruthy();
  });
});

// ── Story 5: Uniform card size regardless of actives ─────────────────────────

describe('Multi-active badges — Story 5: uniform card size (added 2026-07-22)', () => {
  it('keeps the actives row present (reserving its height) even with zero actives', () => {
    const product = makeProduct({ activeTags: [], activeIngredients: [] });
    renderCard({ product });

    const activesRow = screen.getByTestId('shelf-card-actives-row');
    expect(flattenStyle(activesRow.props.style).minHeight).toBeGreaterThan(0);
  });
});
