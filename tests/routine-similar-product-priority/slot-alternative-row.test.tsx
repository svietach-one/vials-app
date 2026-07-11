/**
 * Component tests — Story 2 AC2 (component layer): the "Also on your shelf"
 * alternative row with its one-tap swap action.
 * Spec: docs/specs/2026-07-11-routine-similar-product-priority.md §4 Story 2
 * Tech design: docs/tech-design/routine-similar-product-priority.md (FE-10)
 *
 * SlotAlternativeRow does not exist yet — this file fails to resolve until
 * the engineer creates src/components/routine/SlotAlternativeRow.tsx per the
 * contract in fixtures.ts. Expected (tests-first).
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { CREAM_A, CREAM_B, makeSlotAlternativeRowProps } from './fixtures';

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return {
    Feather: ({ name, testID }: { name: string; testID?: string }) => (
      <View testID={testID ?? `feather-icon-${name}`} />
    ),
  };
});

import { SlotAlternativeRow } from '@/components/routine/SlotAlternativeRow';

describe('Story 2 AC2: the non-admitted product is listed as a visible alternative', () => {
  it('renders "Also on your shelf: <alternative name>"', () => {
    render(
      <SlotAlternativeRow
        {...makeSlotAlternativeRowProps({
          winnerProductName: CREAM_A.name,
          alternativeProductName: CREAM_B.name,
        })}
      />,
    );

    expect(screen.getByText(`Also on your shelf: ${CREAM_B.name}`)).toBeTruthy();
  });

  it('never renders anything mentioning the winner as an alternative to itself', () => {
    render(
      <SlotAlternativeRow
        {...makeSlotAlternativeRowProps({
          winnerProductName: CREAM_A.name,
          alternativeProductName: CREAM_B.name,
        })}
      />,
    );
    expect(screen.queryByText(`Also on your shelf: ${CREAM_A.name}`)).toBeNull();
  });
});

describe('Story 2 AC2: the row offers a one-tap swap action', () => {
  it('calls onSwap when the swap action is pressed', () => {
    const onSwap = jest.fn();
    render(
      <SlotAlternativeRow
        {...makeSlotAlternativeRowProps({ alternativeProductName: CREAM_B.name, onSwap })}
      />,
    );

    fireEvent.press(screen.getByLabelText(`Swap to ${CREAM_B.name}`));

    expect(onSwap).toHaveBeenCalledTimes(1);
  });
});
