/**
 * Component tests — ProcedureDurationFeedbackModal (spec Story 1).
 * Does not exist yet (tests-first); contract in fixtures.ts.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { INVALID_MONTH_TEXTS, makeDurationModalProps, makeProcedureLog, OPTION, TID, textOf, toRegExp } from './fixtures';

import { ProcedureDurationFeedbackModal } from '@/components/clinic/ProcedureDurationFeedbackModal';

function selectDifferent() {
  fireEvent.press(screen.getByRole('radio', { name: OPTION.different }));
}

describe('initial render', () => {
  it('asks how long the effect lasted with Skip selected by default', () => {
    render(<ProcedureDurationFeedbackModal {...makeDurationModalProps()} />);

    expect(screen.getByText('How long did the effect last?')).toBeTruthy();
    expect(screen.getByRole('radio', { name: OPTION.skip }).props.accessibilityState.checked).toBe(true);
    expect(screen.getByRole('radio', { name: OPTION.expected }).props.accessibilityState.checked).toBe(false);
    expect(screen.queryByTestId(TID.input)).toBeNull();
  });

  it('renders nothing when proc is null', () => {
    render(<ProcedureDurationFeedbackModal {...makeDurationModalProps({ proc: null })} />);

    expect(screen.queryByText('How long did the effect last?')).toBeNull();
  });
});

describe('confirming', () => {
  it('confirms with null when Skip is left selected', () => {
    const props = makeDurationModalProps();
    render(<ProcedureDurationFeedbackModal {...props} />);

    fireEvent.press(screen.getByText('Confirm'));

    expect(props.onConfirm).toHaveBeenCalledWith(null);
  });

  it('confirms with the clinical lifespan of the log for "About as expected"', () => {
    const props = makeDurationModalProps();
    render(<ProcedureDurationFeedbackModal {...props} />);

    fireEvent.press(screen.getByRole('radio', { name: OPTION.expected }));
    fireEvent.press(screen.getByText('Confirm'));

    expect(props.onConfirm).toHaveBeenCalledWith(6);
  });

  it('confirms with the snapshot lifespan when the log has expectedMonths', () => {
    const props = makeDurationModalProps({ proc: makeProcedureLog({ expectedMonths: 5 }) });
    render(<ProcedureDurationFeedbackModal {...props} />);

    fireEvent.press(screen.getByRole('radio', { name: OPTION.expected }));
    fireEvent.press(screen.getByText('Confirm'));

    expect(props.onConfirm).toHaveBeenCalledWith(5);
  });

  it('shows the month input only for "A different length" and confirms its value', () => {
    const props = makeDurationModalProps();
    render(<ProcedureDurationFeedbackModal {...props} />);

    selectDifferent();
    fireEvent.changeText(screen.getByTestId(TID.input), '4.5');
    fireEvent.press(screen.getByText('Confirm'));

    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).toHaveBeenCalledWith(4.5);
  });
});

describe('invalid input', () => {
  it.each(INVALID_MONTH_TEXTS)('disables Confirm, shows the range error and never confirms for "%s"', (text) => {
    const props = makeDurationModalProps();
    render(<ProcedureDurationFeedbackModal {...props} />);

    selectDifferent();
    fireEvent.changeText(screen.getByTestId(TID.input), text);
    fireEvent.press(screen.getByText('Confirm'));

    expect(screen.getByTestId(TID.confirm).props.accessibilityState?.disabled).toBe(true);
    expect(textOf(screen.getByTestId(TID.error))).toMatch(toRegExp(/0\.5.{1,3}60/));
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it('disables Confirm while the different-length field is empty', () => {
    const props = makeDurationModalProps();
    render(<ProcedureDurationFeedbackModal {...props} />);

    selectDifferent();
    fireEvent.press(screen.getByText('Confirm'));

    expect(screen.getByTestId(TID.confirm).props.accessibilityState?.disabled).toBe(true);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });
});

describe('dismissing', () => {
  it('calls onCancel only when Cancel is pressed', () => {
    const props = makeDurationModalProps();
    render(<ProcedureDurationFeedbackModal {...props} />);

    fireEvent.press(screen.getByText('Cancel'));

    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it('calls onCancel only when the backdrop is pressed', () => {
    const props = makeDurationModalProps();
    render(<ProcedureDurationFeedbackModal {...props} />);

    fireEvent.press(screen.getByTestId(TID.backdrop));

    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });
});
