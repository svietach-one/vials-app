/**
 * Component test — DetectedActivesCard (explore-insights-v2 task 03).
 * Position ordering, ordinal formatting, and the below-the-1%-line note.
 */
import React from 'react';
import { render, screen, within } from '@testing-library/react-native';

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
