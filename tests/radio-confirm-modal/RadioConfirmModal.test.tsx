/**
 * Component tests — `RadioConfirmModal` (ui/core), the shared Modal +
 * RadioOptionGroup + fixed Confirm/Cancel footer introduced to replace
 * per-file N-button-stack confirm dialogs.
 * Spec: docs/specs/multi-action-radio-picker.md §4, §5
 * Tech design: docs/tech-design/multi-action-radio-picker.md §2, §3 FE-2
 *
 * RadioConfirmModal does not exist yet — this file fails to resolve until the
 * engineer creates src/components/ui/core/RadioConfirmModal.tsx per the
 * contract documented in fixtures.ts. Expected (tests-first).
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { makeRadioConfirmModalProps, SCOPE_OPTIONS } from './fixtures';

import { RadioConfirmModal } from '@/components/ui/core/RadioConfirmModal';

describe('initial render', () => {
  it('renders the title, every radio option, and a Confirm/Cancel footer', () => {
    render(<RadioConfirmModal {...makeRadioConfirmModalProps()} />);

    expect(screen.getByText('Save this routine for')).toBeTruthy();
    SCOPE_OPTIONS.forEach((option) => {
      expect(screen.getByRole('radio', { name: option.label })).toBeTruthy();
    });
    expect(screen.getByText('Confirm')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('renders optional body content when provided', () => {
    render(
      <RadioConfirmModal
        {...makeRadioConfirmModalProps({ body: <>Choose which periods to update.</> })}
      />,
    );

    expect(screen.getByText('Choose which periods to update.')).toBeTruthy();
  });

  it('pre-selects the row matching defaultValue and no other row', () => {
    render(<RadioConfirmModal {...makeRadioConfirmModalProps({ defaultValue: 'am' })} />);

    expect(screen.getByRole('radio', { name: 'Morning Only' }).props.accessibilityState.checked).toBe(
      true,
    );
    expect(
      screen.getByRole('radio', { name: 'Morning & Evening' }).props.accessibilityState.checked,
    ).toBe(false);
    expect(screen.getByRole('radio', { name: 'Evening Only' }).props.accessibilityState.checked).toBe(
      false,
    );
  });

  it('renders no title, radio rows, or footer when visible is false', () => {
    render(<RadioConfirmModal {...makeRadioConfirmModalProps({ visible: false })} />);

    expect(screen.queryByText('Save this routine for')).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Morning Only' })).toBeNull();
    expect(screen.queryByText('Confirm')).toBeNull();
    expect(screen.queryByText('Cancel')).toBeNull();
  });
});

describe('selecting a radio option before confirming', () => {
  it('moves the checked state to the tapped option without firing onConfirm or onCancel', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    render(
      <RadioConfirmModal
        {...makeRadioConfirmModalProps({ defaultValue: 'both', onConfirm, onCancel })}
      />,
    );

    fireEvent.press(screen.getByRole('radio', { name: 'Evening Only' }));

    expect(screen.getByRole('radio', { name: 'Evening Only' }).props.accessibilityState.checked).toBe(
      true,
    );
    expect(
      screen.getByRole('radio', { name: 'Morning & Evening' }).props.accessibilityState.checked,
    ).toBe(false);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('unchecks the previously selected option when a different one is tapped', () => {
    render(<RadioConfirmModal {...makeRadioConfirmModalProps({ defaultValue: 'both' })} />);

    fireEvent.press(screen.getByRole('radio', { name: 'Morning Only' }));
    fireEvent.press(screen.getByRole('radio', { name: 'Evening Only' }));

    expect(
      screen.getByRole('radio', { name: 'Morning Only' }).props.accessibilityState.checked,
    ).toBe(false);
    expect(screen.getByRole('radio', { name: 'Evening Only' }).props.accessibilityState.checked).toBe(
      true,
    );
  });
});

describe('confirming', () => {
  it('calls onConfirm with the defaultValue when Confirm is tapped without changing selection', () => {
    const onConfirm = jest.fn();
    render(<RadioConfirmModal {...makeRadioConfirmModalProps({ defaultValue: 'both', onConfirm })} />);

    fireEvent.press(screen.getByText('Confirm'));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('both');
  });

  it('calls onConfirm with the newly selected value after the user changes the selection', () => {
    const onConfirm = jest.fn();
    render(<RadioConfirmModal {...makeRadioConfirmModalProps({ defaultValue: 'both', onConfirm })} />);

    fireEvent.press(screen.getByRole('radio', { name: 'Evening Only' }));
    fireEvent.press(screen.getByText('Confirm'));

    expect(onConfirm).toHaveBeenCalledWith('pm');
  });

  it('never calls onCancel when Confirm is tapped', () => {
    const onCancel = jest.fn();
    render(<RadioConfirmModal {...makeRadioConfirmModalProps({ onCancel })} />);

    fireEvent.press(screen.getByText('Confirm'));

    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe('cancelling', () => {
  it('calls onCancel and never onConfirm when Cancel is tapped', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    render(<RadioConfirmModal {...makeRadioConfirmModalProps({ onConfirm, onCancel })} />);

    fireEvent.press(screen.getByText('Cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onCancel even after the user changed the selection first', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    render(<RadioConfirmModal {...makeRadioConfirmModalProps({ onConfirm, onCancel })} />);

    fireEvent.press(screen.getByRole('radio', { name: 'Evening Only' }));
    fireEvent.press(screen.getByText('Cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('selection resets on reopen', () => {
  it('reseeds the selection from defaultValue the next time the modal becomes visible', () => {
    const { rerender } = render(
      <RadioConfirmModal {...makeRadioConfirmModalProps({ visible: true, defaultValue: 'both' })} />,
    );

    fireEvent.press(screen.getByRole('radio', { name: 'Evening Only' }));
    expect(screen.getByRole('radio', { name: 'Evening Only' }).props.accessibilityState.checked).toBe(
      true,
    );

    // Close, then reopen — the in-progress "Evening Only" pick must not
    // survive the round trip (tech design §1: reset whenever visible turns
    // true).
    rerender(
      <RadioConfirmModal {...makeRadioConfirmModalProps({ visible: false, defaultValue: 'both' })} />,
    );
    rerender(
      <RadioConfirmModal {...makeRadioConfirmModalProps({ visible: true, defaultValue: 'both' })} />,
    );

    expect(
      screen.getByRole('radio', { name: 'Morning & Evening' }).props.accessibilityState.checked,
    ).toBe(true);
    expect(screen.getByRole('radio', { name: 'Evening Only' }).props.accessibilityState.checked).toBe(
      false,
    );
  });
});

describe('fixed Confirm/Cancel labels', () => {
  it('always renders the literal strings "Confirm" and "Cancel", regardless of the options supplied', () => {
    render(
      <RadioConfirmModal
        {...makeRadioConfirmModalProps({
          title: 'Remove this product?',
          options: [
            { value: 'am', label: 'A much longer label than usual, describing one single outcome' },
            { value: 'pm', label: 'Another long outcome label' },
          ],
          defaultValue: 'am',
        })}
      />,
    );

    expect(screen.getByText('Confirm')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });
});

describe('testID passthrough', () => {
  it('applies the given testID without throwing', () => {
    expect(() =>
      render(<RadioConfirmModal {...makeRadioConfirmModalProps({ testID: 'commit-scope-modal' })} />),
    ).not.toThrow();
  });
});
