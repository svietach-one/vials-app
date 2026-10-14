/**
 * Component tests — Story 1 ACs 1-4 (now also multi-action-radio-picker
 * Story 1): the manual-add duplicate choice sheet itself (Replace / Keep
 * both radio pair + Confirm/Cancel), in isolation from AddToRoutineSheet.
 * Spec: docs/specs/2026-07-11-routine-similar-product-priority.md §4 Story 1
 *       docs/specs/multi-action-radio-picker.md §4 Story 1
 * Tech design: docs/tech-design/routine-similar-product-priority.md (FE-6)
 *              docs/tech-design/multi-action-radio-picker.md (FE-3)
 *
 * multi-action-radio-picker (FE-3) converts this sheet's old three-stacked-
 * Button layout (Replace/Keep both/Cancel, one tap = select-and-commit) to a
 * RadioConfirmModal: two radio options ("Replace" pre-selected, "Keep both"),
 * then a Confirm/Cancel footer. The sheet's EXTERNAL prop contract
 * (visible, slotLabel, existingProduct, incomingProduct, onReplace,
 * onKeepBoth, onCancel) is unchanged (tech design §1) — only the internal
 * JSX/queries below change. This file replaces the old
 * `getByLabelText('Replace <name>')`/`'Keep both'`/`'Cancel'`-as-a-single-tap
 * assertions with the new radio-select-then-Confirm contract; the old
 * queries are gone, not kept alongside the new ones (tech design Assumption
 * 5 — no dead/duplicate accessibility surface).
 *
 * DuplicateSlotChoiceSheet does not render RadioConfirmModal yet — this file
 * fails to resolve/pass until the engineer converts
 * src/components/routine/DuplicateSlotChoiceSheet.tsx per multi-action-radio-
 * picker FE-3. Expected (tests-first).
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { CREAM_A, CREAM_B, makeDuplicateSlotChoiceSheetProps } from './fixtures';

import { DuplicateSlotChoiceSheet } from '@/components/routine/DuplicateSlotChoiceSheet';

describe('Story 1 AC1: the sheet names both products and offers Replace/Keep both + Confirm/Cancel', () => {
  it('renders the title with the slot label, both product names, the two radio options, and Confirm/Cancel', () => {
    render(
      <DuplicateSlotChoiceSheet
        {...makeDuplicateSlotChoiceSheetProps({ slotLabel: 'moisturizer' })}
      />,
    );

    expect(screen.getByText('You already have a moisturizer in this routine')).toBeTruthy();
    expect(screen.getByText(CREAM_A.name)).toBeTruthy();
    expect(screen.getByText(CREAM_B.name)).toBeTruthy();

    expect(screen.getByRole('radio', { name: 'Replace' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Keep both' })).toBeTruthy();
    expect(screen.getByText('Confirm')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('pre-selects "Replace" (the previous primary action) and leaves "Keep both" unchecked', () => {
    render(<DuplicateSlotChoiceSheet {...makeDuplicateSlotChoiceSheetProps()} />);

    expect(screen.getByRole('radio', { name: 'Replace' }).props.accessibilityState.checked).toBe(
      true,
    );
    expect(
      screen.getByRole('radio', { name: 'Keep both' }).props.accessibilityState.checked,
    ).toBe(false);
  });

  it('renders nothing actionable when visible is false', () => {
    render(
      <DuplicateSlotChoiceSheet {...makeDuplicateSlotChoiceSheetProps({ visible: false })} />,
    );

    expect(screen.queryByRole('radio', { name: 'Keep both' })).toBeNull();
    expect(screen.queryByText('Confirm')).toBeNull();
  });
});

describe('Story 1 AC5: selecting a radio option alone never fires a callback', () => {
  it('only updates which option shows selected; no callback has fired yet', () => {
    const onReplace = jest.fn();
    const onKeepBoth = jest.fn();
    const onCancel = jest.fn();
    render(
      <DuplicateSlotChoiceSheet
        {...makeDuplicateSlotChoiceSheetProps({ onReplace, onKeepBoth, onCancel })}
      />,
    );

    fireEvent.press(screen.getByRole('radio', { name: 'Keep both' }));

    expect(screen.getByRole('radio', { name: 'Keep both' }).props.accessibilityState.checked).toBe(
      true,
    );
    expect(screen.getByRole('radio', { name: 'Replace' }).props.accessibilityState.checked).toBe(
      false,
    );
    expect(onReplace).not.toHaveBeenCalled();
    expect(onKeepBoth).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe('Story 1 AC2: confirming without changing the default selection replaces the existing step', () => {
  it('calls onReplace and none of the other callbacks', () => {
    const onReplace = jest.fn();
    const onKeepBoth = jest.fn();
    const onCancel = jest.fn();
    render(
      <DuplicateSlotChoiceSheet
        {...makeDuplicateSlotChoiceSheetProps({ onReplace, onKeepBoth, onCancel })}
      />,
    );

    fireEvent.press(screen.getByText('Confirm'));

    expect(onReplace).toHaveBeenCalledTimes(1);
    expect(onKeepBoth).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe('Story 1 AC3: picking "Keep both" then confirming preserves both products', () => {
  it('calls onKeepBoth and none of the other callbacks', () => {
    const onReplace = jest.fn();
    const onKeepBoth = jest.fn();
    const onCancel = jest.fn();
    render(
      <DuplicateSlotChoiceSheet
        {...makeDuplicateSlotChoiceSheetProps({ onReplace, onKeepBoth, onCancel })}
      />,
    );

    fireEvent.press(screen.getByRole('radio', { name: 'Keep both' }));
    fireEvent.press(screen.getByText('Confirm'));

    expect(onKeepBoth).toHaveBeenCalledTimes(1);
    expect(onReplace).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe('Story 1 AC4: "Cancel" leaves the routine unchanged', () => {
  it('pressing Cancel calls onCancel and neither onReplace nor onKeepBoth', () => {
    const onReplace = jest.fn();
    const onKeepBoth = jest.fn();
    const onCancel = jest.fn();
    render(
      <DuplicateSlotChoiceSheet
        {...makeDuplicateSlotChoiceSheetProps({ onReplace, onKeepBoth, onCancel })}
      />,
    );

    fireEvent.press(screen.getByText('Cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onReplace).not.toHaveBeenCalled();
    expect(onKeepBoth).not.toHaveBeenCalled();
  });

  it('pressing Cancel after picking "Keep both" still only calls onCancel', () => {
    const onReplace = jest.fn();
    const onKeepBoth = jest.fn();
    const onCancel = jest.fn();
    render(
      <DuplicateSlotChoiceSheet
        {...makeDuplicateSlotChoiceSheetProps({ onReplace, onKeepBoth, onCancel })}
      />,
    );

    fireEvent.press(screen.getByRole('radio', { name: 'Keep both' }));
    fireEvent.press(screen.getByText('Cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onReplace).not.toHaveBeenCalled();
    expect(onKeepBoth).not.toHaveBeenCalled();
  });
});
