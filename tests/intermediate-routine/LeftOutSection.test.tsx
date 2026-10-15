/**
 * Component test for the "Not in your routine" section (tech design FE-10).
 * Spec Story 5 and §5. Copy that is still PLACEHOLDER (spec Q4b) is read from
 * ONE exported constant, ROUTINE_DEPTH_COPY, so a copy change touches one file.
 *
 * ASSUMED props (the tech design names the component and its two actions only):
 *   <LeftOutSection items={LeftOutItem[]} products={Product[]}
 *                   onAdd={(productId: string) => void} onReview={() => void} />
 * ASSUMED a11y: header is a button whose label/text is ROUTINE_DEPTH_COPY.leftOutHeader(n) and which
 * exposes accessibilityState.expanded; row actions have accessibilityLabel
 * `${ROUTINE_DEPTH_COPY.addAction} ${name}` / `${ROUTINE_DEPTH_COPY.reviewAction} ${name}`.
 * Written against a DRAFT spec.
 */
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { reasonText } from '@/constants/decisionReasons';
import { ROUTINE_DEPTH_COPY } from '@/constants/routineDepth';
import type { Product } from '@/types';
import { LeftOutSection, type LeftOutSectionProps } from '@/components/routine/LeftOutSection';
import { makeLeftOutItem, REASON, shelfProduct } from './fixtures';

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return { Feather: ({ name, testID }: { name: string; testID?: string }) => <View testID={testID ?? `feather-icon-${name}`} /> };
});

const PRODUCTS: Product[] = [
  shelfProduct('oil', 'Face Oil', 'oil'),
  shelfProduct('toner', 'Hydrating Toner', 'toner'),
  shelfProduct('acid', 'AHA Serum', 'serum'),
  shelfProduct('toner-b', 'Backup Toner', 'toner'),
];

function makeProps(overrides: Partial<LeftOutSectionProps> = {}): LeftOutSectionProps {
  return {
    items: [
      makeLeftOutItem({ productId: 'toner', kind: 'ready' }),
      makeLeftOutItem({ productId: 'oil', kind: 'reserve', reasonCode: 'not_needed_for_goals' }),
      makeLeftOutItem({ productId: 'acid', kind: 'frozen', reasonCode: REASON('peel_rehab_no_exfoliants'), until: '2026-07-18' }),
      makeLeftOutItem({ productId: 'toner-b', kind: 'alternative' }),
    ],
    products: PRODUCTS,
    onAdd: jest.fn(),
    onReview: jest.fn(),
    ...overrides,
  };
}

const header = (n: number) => ROUTINE_DEPTH_COPY.leftOutHeader(n);

describe('collapsed header', () => {
  it('shows "Not in your routine · N" and keeps the rows hidden until tapped', () => {
    render(<LeftOutSection {...makeProps()} />);

    expect(screen.getByText(header(4))).toBeTruthy();
    expect(screen.queryByText('Face Oil')).toBeNull();
  });

  it('expands to show every row on tap and collapses again on a second tap', () => {
    render(<LeftOutSection {...makeProps()} />);

    fireEvent.press(screen.getByText(header(4)));
    expect(screen.getByText('Face Oil')).toBeTruthy();
    expect(screen.getByText('Hydrating Toner')).toBeTruthy();
    expect(screen.getByText('AHA Serum')).toBeTruthy();
    expect(screen.getByText('Backup Toner')).toBeTruthy();

    fireEvent.press(screen.getByText(header(4)));
    expect(screen.queryByText('Face Oil')).toBeNull();
  });

  it('tells assistive tech whether the section is expanded', () => {
    render(<LeftOutSection {...makeProps()} />);

    const button = screen.getByRole('button', { name: header(4) });
    expect(button.props.accessibilityState?.expanded).toBe(false);
    fireEvent.press(button);
    expect(screen.getByRole('button', { name: header(4) }).props.accessibilityState?.expanded).toBe(true);
  });

  it('renders nothing at all when there are no items', () => {
    render(<LeftOutSection {...makeProps({ items: [] })} />);

    expect(screen.queryByText(/Not in your routine/)).toBeNull();
  });
});

describe('one reason line per row, by kind', () => {
  beforeEach(() => {
    render(<LeftOutSection {...makeProps()} />);
    fireEvent.press(screen.getByText(header(4)));
  });

  it('states the engine reason text for a reserve row', () => {
    expect(screen.getByText(reasonText('not_needed_for_goals'))).toBeTruthy();
  });

  it('states "paused until <date>" for a frozen row', () => {
    expect(screen.getByText(/paused until 2026-07-18/)).toBeTruthy();
  });

  it('states the ready copy for a row a fresh draft would include', () => {
    expect(screen.getByText(ROUTINE_DEPTH_COPY.readyToAdd)).toBeTruthy();
  });

  it('states the backup copy for a same-slot loser', () => {
    expect(screen.getByText(ROUTINE_DEPTH_COPY.backup)).toBeTruthy();
  });
});

describe('row actions', () => {
  it('offers "Add" on a reserve row and reports that product id', () => {
    const props = makeProps();
    render(<LeftOutSection {...props} />);
    fireEvent.press(screen.getByText(header(4)));

    fireEvent.press(screen.getByLabelText(`${ROUTINE_DEPTH_COPY.addAction} Face Oil`));

    expect(props.onAdd).toHaveBeenCalledWith('oil');
    expect(props.onReview).not.toHaveBeenCalled();
  });

  it('offers "Review" on a ready row, which opens the draft without recording an override', () => {
    const props = makeProps();
    render(<LeftOutSection {...props} />);
    fireEvent.press(screen.getByText(header(4)));

    fireEvent.press(screen.getByLabelText(`${ROUTINE_DEPTH_COPY.reviewAction} Hydrating Toner`));

    expect(props.onReview).toHaveBeenCalledTimes(1);
    expect(props.onAdd).not.toHaveBeenCalled();
  });

  it('offers no action on a paused row or a backup row', () => {
    render(<LeftOutSection {...makeProps()} />);
    fireEvent.press(screen.getByText(header(4)));

    expect(screen.queryByLabelText(`${ROUTINE_DEPTH_COPY.addAction} AHA Serum`)).toBeNull();
    expect(screen.queryByLabelText(`${ROUTINE_DEPTH_COPY.reviewAction} AHA Serum`)).toBeNull();
    expect(screen.queryByLabelText(`${ROUTINE_DEPTH_COPY.addAction} Backup Toner`)).toBeNull();
    expect(screen.queryByLabelText(`${ROUTINE_DEPTH_COPY.reviewAction} Backup Toner`)).toBeNull();
  });
});

describe('legibility (spec §5: at least 14px)', () => {
  it('never sets a font size below 14 on any text in the expanded section', () => {
    render(<LeftOutSection {...makeProps()} />);
    fireEvent.press(screen.getByText(header(4)));

    const sizes = screen
      .UNSAFE_getAllByType(Text)
      .map((node) => StyleSheet.flatten(node.props.style)?.fontSize)
      .filter((size): size is number => typeof size === 'number');
    expect(sizes.length).toBeGreaterThan(0);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(14);
  });
});
