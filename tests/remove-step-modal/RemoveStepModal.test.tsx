/**
 * Component tests — Story 2 (multi-action-radio-picker): choosing removal
 * scope for a routine step via `RemoveStepModal`.
 * Spec: docs/specs/multi-action-radio-picker.md §4 Story 2
 * Tech design: docs/tech-design/multi-action-radio-picker.md §3 FE-4
 *
 * First dedicated component test file for RemoveStepModal — every
 * RoutinesScreen-level suite mocks it to `() => null` (unchanged, out of
 * scope for this file). RemoveStepModal does not render a RadioConfirmModal
 * yet — this file fails to resolve/pass until the engineer converts
 * src/components/routine/RemoveStepModal.tsx per FE-4. Expected (tests-first).
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { makeRemoveStepModalProps } from './fixtures';

import { RemoveStepModal } from '@/components/routine/RemoveStepModal';

describe('Story 2 AC1: the modal names the product and offers day-scoped/all-days radio options', () => {
  it('renders the title, both radio options named for the viewed day, and Confirm/Cancel', () => {
    render(<RemoveStepModal {...makeRemoveStepModalProps({ productName: 'Vitamin C Serum', dow: 1 })} />);

    expect(screen.getByText('Remove Vitamin C Serum?')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Mondays only' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'All days' })).toBeTruthy();
    expect(screen.getByText('Confirm')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('labels the narrow option using the day actually being viewed', () => {
    render(<RemoveStepModal {...makeRemoveStepModalProps({ dow: 5 })} />); // Friday

    expect(screen.getByRole('radio', { name: 'Fridays only' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Mondays only' })).toBeNull();
  });

  it('pre-selects the narrower "{day}s only" scope, not "All days"', () => {
    render(<RemoveStepModal {...makeRemoveStepModalProps({ dow: 1 })} />);

    expect(screen.getByRole('radio', { name: 'Mondays only' }).props.accessibilityState.checked).toBe(
      true,
    );
    expect(screen.getByRole('radio', { name: 'All days' }).props.accessibilityState.checked).toBe(
      false,
    );
  });

  it('renders nothing actionable when visible is false', () => {
    render(<RemoveStepModal {...makeRemoveStepModalProps({ visible: false })} />);

    expect(screen.queryByRole('radio', { name: 'All days' })).toBeNull();
    expect(screen.queryByText('Confirm')).toBeNull();
  });
});

describe('selecting a radio option alone never fires a removal callback', () => {
  it('only updates which option shows selected; neither removal callback nor onCancel has fired', () => {
    const onRemoveDay = jest.fn();
    const onRemoveAll = jest.fn();
    const onCancel = jest.fn();
    render(
      <RemoveStepModal
        {...makeRemoveStepModalProps({ onRemoveDay, onRemoveAll, onCancel })}
      />,
    );

    fireEvent.press(screen.getByRole('radio', { name: 'All days' }));

    expect(screen.getByRole('radio', { name: 'All days' }).props.accessibilityState.checked).toBe(
      true,
    );
    expect(
      screen.getByRole('radio', { name: 'Mondays only' }).props.accessibilityState.checked,
    ).toBe(false);
    expect(onRemoveDay).not.toHaveBeenCalled();
    expect(onRemoveAll).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe('Story 2 AC2: picking "All days" then confirming removes every occurrence', () => {
  it('calls onRemoveAll and not onRemoveDay', () => {
    const onRemoveDay = jest.fn();
    const onRemoveAll = jest.fn();
    const onCancel = jest.fn();
    render(
      <RemoveStepModal
        {...makeRemoveStepModalProps({ onRemoveDay, onRemoveAll, onCancel })}
      />,
    );

    fireEvent.press(screen.getByRole('radio', { name: 'All days' }));
    fireEvent.press(screen.getByText('Confirm'));

    expect(onRemoveAll).toHaveBeenCalledTimes(1);
    expect(onRemoveDay).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe('confirming without changing the default selection removes just the viewed day', () => {
  it('calls onRemoveDay and not onRemoveAll', () => {
    const onRemoveDay = jest.fn();
    const onRemoveAll = jest.fn();
    render(
      <RemoveStepModal {...makeRemoveStepModalProps({ onRemoveDay, onRemoveAll })} />,
    );

    fireEvent.press(screen.getByText('Confirm'));

    expect(onRemoveDay).toHaveBeenCalledTimes(1);
    expect(onRemoveAll).not.toHaveBeenCalled();
  });
});

describe('Story 2 AC3: Cancel leaves the routine unchanged', () => {
  it('calls onCancel and neither removal callback', () => {
    const onRemoveDay = jest.fn();
    const onRemoveAll = jest.fn();
    const onCancel = jest.fn();
    render(
      <RemoveStepModal
        {...makeRemoveStepModalProps({ onRemoveDay, onRemoveAll, onCancel })}
      />,
    );

    fireEvent.press(screen.getByText('Cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onRemoveDay).not.toHaveBeenCalled();
    expect(onRemoveAll).not.toHaveBeenCalled();
  });

  it('calls onCancel even after selecting "All days" first', () => {
    const onRemoveDay = jest.fn();
    const onRemoveAll = jest.fn();
    const onCancel = jest.fn();
    render(
      <RemoveStepModal
        {...makeRemoveStepModalProps({ onRemoveDay, onRemoveAll, onCancel })}
      />,
    );

    fireEvent.press(screen.getByRole('radio', { name: 'All days' }));
    fireEvent.press(screen.getByText('Cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onRemoveDay).not.toHaveBeenCalled();
    expect(onRemoveAll).not.toHaveBeenCalled();
  });
});
