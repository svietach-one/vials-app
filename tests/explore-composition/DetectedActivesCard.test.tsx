/**
 * Component test — DetectedActivesCard (explore-insights-v2 task 03).
 * Position ordering, ordinal formatting, and the below-the-1%-line note.
 *
 * Extended by explore-actives-order-info (FE-2): the "info tooltip trigger"
 * describe block below covers the new info icon + InfoTooltip wiring. See
 * that block's own header comment for spec/tech-design references — none of
 * the pre-existing describe blocks above it were changed.
 */
import React from 'react';
import { render, screen, within, fireEvent } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('@/components/ui/Icon', () => ({ Icon: () => null }));
jest.mock('@/components/ui/core/Card', () => {
  const { View } = require('react-native');
  return { Card: ({ children }: any) => <View>{children}</View> };
});

import { DetectedActivesCard } from '@/components/catalog/DetectedActivesCard';
import type { ActiveIngredientKey } from '@/types';
import type { OnePercentLineResult } from '@/utils/productProfile/onePercentLine';

const TOKENS_42 = Array.from({ length: 42 }, (_, i) => `Ingredient ${i + 1}`);

function renderCard(props: {
  resolvedActiveKeys: ActiveIngredientKey[];
  ingredientTokens?: string[];
  positionByKey?: Partial<Record<ActiveIngredientKey, number>>;
  onePercentLine?: OnePercentLineResult | null;
}) {
  return render(
    <DetectedActivesCard
      resolvedActiveKeys={props.resolvedActiveKeys}
      ingredientTokens={props.ingredientTokens ?? TOKENS_42}
      positionByKey={props.positionByKey ?? {}}
      onePercentLine={props.onePercentLine ?? null}
    />,
  );
}

describe('DetectedActivesCard — position ordering', () => {
  it('orders actives by INCI position ascending, earliest first', () => {
    renderCard({
      resolvedActiveKeys: ['hyaluronic_acid', 'niacinamide', 'retinoid'],
      positionByKey: { hyaluronic_acid: 20, niacinamide: 6, retinoid: 2 },
    });

    const section = screen.getByTestId('detected-actives');
    const rows = within(section).getAllByTestId(/^active-row-/);
    expect(rows.map((r) => r.props.testID)).toEqual([
      'active-row-retinoid',
      'active-row-niacinamide',
      'active-row-hyaluronic_acid',
    ]);
  });

  it('sorts a mixed known/unknown-position case — unknown positions go last', () => {
    renderCard({
      resolvedActiveKeys: ['ceramides', 'niacinamide'],
      positionByKey: { niacinamide: 6 }, // ceramides has no recorded position
    });

    const section = screen.getByTestId('detected-actives');
    const rows = within(section).getAllByTestId(/^active-row-/);
    expect(rows.map((r) => r.props.testID)).toEqual(['active-row-niacinamide', 'active-row-ceramides']);
    expect(within(section).getByText('6th of 42')).toBeTruthy();
  });

  it('renders an active with no position without an ordinal', () => {
    renderCard({
      resolvedActiveKeys: ['niacinamide'],
      positionByKey: {},
    });

    expect(screen.queryByText(/of 42/)).toBeNull();
  });
});

describe('DetectedActivesCard — ordinal formatting', () => {
  const cases: Array<[number, string]> = [
    [1, '1st of 42'],
    [2, '2nd of 42'],
    [3, '3rd of 42'],
    [4, '4th of 42'],
    [11, '11th of 42'],
    [21, '21st of 42'],
    [42, '42nd of 42'],
  ];

  it.each(cases)('formats position %i as "%s"', (position, expected) => {
    renderCard({
      resolvedActiveKeys: ['niacinamide'],
      positionByKey: { niacinamide: position },
    });

    expect(screen.getByText(expected)).toBeTruthy();
  });
});

describe('DetectedActivesCard — below-the-1%-line note', () => {
  const LINE: OnePercentLineResult = { lineIndex: 20, markerToken: 'Phenoxyethanol', confidence: 'high' };

  it('shows the note for the active at the boundary token itself (position === lineIndex + 1)', () => {
    renderCard({
      resolvedActiveKeys: ['niacinamide'],
      positionByKey: { niacinamide: 21 }, // lineIndex 20 -> 1-based boundary is 21
      onePercentLine: LINE,
    });

    expect(screen.getByText('Below the 1% line — likely a small amount')).toBeTruthy();
  });

  it('shows the note for an active one index after the boundary', () => {
    renderCard({
      resolvedActiveKeys: ['niacinamide'],
      positionByKey: { niacinamide: 22 },
      onePercentLine: LINE,
    });

    expect(screen.getByText('Below the 1% line — likely a small amount')).toBeTruthy();
  });

  it('does not show the note for an active one index before the boundary', () => {
    renderCard({
      resolvedActiveKeys: ['niacinamide'],
      positionByKey: { niacinamide: 20 },
      onePercentLine: LINE,
    });

    expect(screen.queryByText(/below the 1% line/i)).toBeNull();
  });

  it('shows no note anywhere when findOnePercentLine returned null, even for a late position', () => {
    renderCard({
      resolvedActiveKeys: ['niacinamide'],
      positionByKey: { niacinamide: 40 },
      onePercentLine: null,
    });

    expect(screen.queryByText(/below the 1% line/i)).toBeNull();
    expect(screen.getByText('40th of 42')).toBeTruthy();
  });

  it('uses the medium-confidence wording when the line was inferred from a fragrance allergen', () => {
    renderCard({
      resolvedActiveKeys: ['niacinamide'],
      positionByKey: { niacinamide: 21 },
      onePercentLine: { lineIndex: 20, markerToken: 'Limonene', confidence: 'medium' },
    });

    expect(screen.getByText('Probably below the 1% line — likely a small amount')).toBeTruthy();
    expect(screen.queryByText('Below the 1% line — likely a small amount')).toBeNull();
  });
});

describe('DetectedActivesCard — subtitle and empty state', () => {
  it('shows the plain ingredient-token count as the subtitle, not a coverage figure', () => {
    renderCard({ resolvedActiveKeys: ['niacinamide'], ingredientTokens: TOKENS_42 });

    expect(screen.getByText('42 ingredients in this list')).toBeTruthy();
    expect(screen.queryByText(/recognised/i)).toBeNull();
    expect(screen.queryByText(/of 42 ingredients/i)).toBeNull();
  });

  it('renders the unchanged empty-state string when no actives are detected', () => {
    renderCard({ resolvedActiveKeys: [] });

    expect(
      screen.getByText('No known active ingredients detected in this composition.'),
    ).toBeTruthy();
    expect(screen.queryByText(/ingredients in this list/)).toBeNull();
  });
});

// ── Info tooltip trigger (explore-actives-order-info) ────────────────────────
// Spec: docs/specs/explore-actives-order-info.md — Story 1 (all ACs).
// Tech design: docs/tech-design/explore-actives-order-info.md — FE-1/FE-2.
// The tooltip's own open/close/backdrop mechanics are covered standalone in
// InfoTooltip.test.tsx; this block only asserts the trigger wiring on
// DetectedActivesCard itself: the icon always renders (including the
// empty-actives state), tapping it opens InfoTooltip with the expected
// title/body, and closing (either control) returns to the card underneath —
// without disturbing any of the position/1%-line rendering covered above.
//
// `src/components/catalog/DetectedActivesCard.tsx` does not render this icon
// yet (FE-2 not implemented) — every test below is EXPECTED to fail until it
// lands, same test-first convention as the rest of this task's suite.
//
// Copy asserted here is the CURRENT placeholder wording (spec §5, marked
// PLACEHOLDER pending design review) — assertions target meaningful
// substrings only, not full-string/whitespace equality, so a copy-only
// tweak from design review won't break this suite (per this task's own
// instructions to qa-lead).
//
// IconButton is NOT mocked in this file (real component, as before) — its
// testID passes through via its own `{...rest}` spread untouched.
describe('DetectedActivesCard — info tooltip trigger', () => {
  it('always renders the info icon in the header, even in the empty-actives state', () => {
    renderCard({ resolvedActiveKeys: [] });

    expect(screen.getByTestId('detected-actives-info-icon')).toBeTruthy();
  });

  it('renders the info icon alongside populated rows too', () => {
    renderCard({
      resolvedActiveKeys: ['niacinamide'],
      positionByKey: { niacinamide: 6 },
    });

    expect(screen.getByTestId('detected-actives-info-icon')).toBeTruthy();
  });

  it('does not render the tooltip until the icon is tapped', () => {
    renderCard({ resolvedActiveKeys: ['niacinamide'] });

    expect(screen.queryByTestId('info-tooltip')).toBeNull();
  });

  it('opens the tooltip with the expected title and body when the icon is tapped', () => {
    renderCard({ resolvedActiveKeys: ['niacinamide'] });

    fireEvent.press(screen.getByTestId('detected-actives-info-icon'));

    const tooltip = screen.getByTestId('info-tooltip');
    expect(within(tooltip).getByText('What ingredient order means')).toBeTruthy();
    expect(
      within(tooltip).getByText(/ordered by concentration, from highest to lowest/i),
    ).toBeTruthy();
    expect(within(tooltip).getByText(/reliable down to about the 1% mark/i)).toBeTruthy();
    expect(
      within(tooltip).getByText(/isn't a measured percentage for this specific product/i),
    ).toBeTruthy();
  });

  it('closes the tooltip and leaves the card underneath when the close control is tapped', () => {
    renderCard({ resolvedActiveKeys: ['niacinamide'] });

    fireEvent.press(screen.getByTestId('detected-actives-info-icon'));
    expect(screen.getByTestId('info-tooltip')).toBeTruthy();

    fireEvent.press(screen.getByTestId('info-tooltip-close'));

    expect(screen.queryByTestId('info-tooltip')).toBeNull();
    expect(screen.getByTestId('detected-actives')).toBeTruthy();
  });

  it('closes the tooltip when its backdrop is tapped', () => {
    renderCard({ resolvedActiveKeys: ['niacinamide'] });

    fireEvent.press(screen.getByTestId('detected-actives-info-icon'));
    fireEvent.press(screen.getByTestId('info-tooltip-backdrop'));

    expect(screen.queryByTestId('info-tooltip')).toBeNull();
  });

  it('does not disturb any existing row content while the tooltip is open', () => {
    renderCard({
      resolvedActiveKeys: ['niacinamide'],
      positionByKey: { niacinamide: 6 },
    });

    fireEvent.press(screen.getByTestId('detected-actives-info-icon'));

    expect(screen.getByText('6th of 42')).toBeTruthy();
  });
});
