/**
 * Component tests — Story 1 ACs 1-4: the manual-add duplicate choice sheet
 * itself (Replace / Keep both / Cancel), in isolation from AddToRoutineSheet.
 * Spec: docs/specs/2026-07-11-routine-similar-product-priority.md §4 Story 1
 * Tech design: docs/tech-design/routine-similar-product-priority.md (FE-6)
 *
 * DuplicateSlotChoiceSheet does not exist yet — this file fails to resolve
 * until the engineer creates src/components/routine/DuplicateSlotChoiceSheet.tsx
 * per the contract in fixtures.ts. Expected (tests-first).
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { CREAM_A, CREAM_B, makeDuplicateSlotChoiceSheetProps } from './fixtures';

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return {
    Feather: ({ name, testID }: { name: string; testID?: string }) => (
      <View testID={testID ?? `feather-icon-${name}`} />
    ),
  };
});

import { DuplicateSlotChoiceSheet } from '@/components/routine/DuplicateSlotChoiceSheet';

describe('Story 1 AC1: the choice sheet names both products and offers the three actions', () => {
  it('renders the title with the slot label and both product names, plus Replace/Keep both/Cancel', () => {
    render(
      <DuplicateSlotChoiceSheet
        {...makeDuplicateSlotChoiceSheetProps({ slotLabel: 'moisturizer' })}
      />,
    );

    expect(screen.getByText('You already have a moisturizer in this routine')).toBeTruthy();
    expect(screen.getByText(CREAM_A.name)).toBeTruthy();
    expect(screen.getByText(CREAM_B.name)).toBeTruthy();

    expect(screen.getByLabelText(`Replace ${CREAM_A.name}`)).toBeTruthy();
    expect(screen.getByLabelText('Keep both')).toBeTruthy();
    expect(screen.getByLabelText('Cancel')).toBeTruthy();
  });

  it('renders nothing actionable when visible is false', () => {
    render(
      <DuplicateSlotChoiceSheet {...makeDuplicateSlotChoiceSheetProps({ visible: false })} />,
    );
    expect(screen.queryByLabelText('Keep both')).toBeNull();
  });
});

describe('Story 1 AC2: "Replace [existing]" removes the existing step in favor of the incoming product', () => {
  it('calls onReplace and none of the other callbacks', () => {
    const onReplace = jest.fn();
    const onKeepBoth = jest.fn();
    const onCancel = jest.fn();
    render(
      <DuplicateSlotChoiceSheet
        {...makeDuplicateSlotChoiceSheetProps({ onReplace, onKeepBoth, onCancel })}
      />,
    );

    fireEvent.press(screen.getByLabelText(`Replace ${CREAM_A.name}`));

    expect(onReplace).toHaveBeenCalledTimes(1);
    expect(onKeepBoth).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe('Story 1 AC3: "Keep both" preserves both products', () => {
  it('calls onKeepBoth and none of the other callbacks', () => {
    const onReplace = jest.fn();
    const onKeepBoth = jest.fn();
    const onCancel = jest.fn();
    render(
      <DuplicateSlotChoiceSheet
        {...makeDuplicateSlotChoiceSheetProps({ onReplace, onKeepBoth, onCancel })}
      />,
    );

    fireEvent.press(screen.getByLabelText('Keep both'));

    expect(onKeepBoth).toHaveBeenCalledTimes(1);
    expect(onReplace).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe('Story 1 AC4: "Cancel" (or dismissal) leaves the routine unchanged', () => {
  it('pressing Cancel calls onCancel and neither onReplace nor onKeepBoth', () => {
    const onReplace = jest.fn();
    const onKeepBoth = jest.fn();
    const onCancel = jest.fn();
    render(
      <DuplicateSlotChoiceSheet
        {...makeDuplicateSlotChoiceSheetProps({ onReplace, onKeepBoth, onCancel })}
      />,
    );

    fireEvent.press(screen.getByLabelText('Cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onReplace).not.toHaveBeenCalled();
    expect(onKeepBoth).not.toHaveBeenCalled();
  });
});
