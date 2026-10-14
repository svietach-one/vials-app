/**
 * Component tests — CalibrationCard (spec Story 4). Contract in fixtures.ts.
 */
import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { makeCalibrationCardProps, TID, textOf, toRegExp } from './fixtures';

import { CalibrationCard } from '@/components/clinic/CalibrationCard';

let alertSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => alertSpy.mockRestore());

describe('empty state (no calibration)', () => {
  it('shows the clinical default, the info hint and no Reset button', () => {
    render(<CalibrationCard {...makeCalibrationCardProps()} />);

    expect(screen.getByText('Using the clinical default (6 months).')).toBeTruthy();
    expect(screen.getByTestId(TID.emptyAlert)).toBeTruthy();
    expect(screen.queryByTestId(TID.reset)).toBeNull();
    expect(screen.queryByTestId(TID.estimateValue)).toBeNull();
  });
});

describe('calibrated state', () => {
  it('shows default vs estimate and a plural report count', () => {
    render(
      <CalibrationCard {...makeCalibrationCardProps({ entry: { months: 5, samples: 2 } })} />,
    );

    expect(textOf(screen.getByTestId(TID.defaultValue))).toMatch(toRegExp('6 months'));
    expect(textOf(screen.getByTestId(TID.estimateValue))).toMatch(toRegExp('5.0 months'));
    expect(textOf(screen.getByTestId(TID.reportsTag))).toMatch(toRegExp('2 reports'));
    expect(screen.queryByTestId(TID.emptyAlert)).toBeNull();
  });

  it('uses the singular form for one report', () => {
    render(
      <CalibrationCard {...makeCalibrationCardProps({ entry: { months: 5, samples: 1 } })} />,
    );

    expect(textOf(screen.getByTestId(TID.reportsTag))).toMatch(toRegExp('1 report'));
  });
});

describe('Reset to default', () => {
  it('asks via Alert.alert and does not reset until Reset is chosen', () => {
    const props = makeCalibrationCardProps({ entry: { months: 5, samples: 2 } });
    render(<CalibrationCard {...props} />);

    fireEvent.press(screen.getByTestId(TID.reset));

    expect(alertSpy).toHaveBeenCalledTimes(1);
    const [title, , buttons] = alertSpy.mock.calls[0];
    expect(title).toBe('Reset estimate?');
    expect(buttons.map((b: { text: string }) => b.text)).toEqual(['Cancel', 'Reset']);
    expect(props.onReset).not.toHaveBeenCalled();
  });

  it('calls onReset when the Reset alert button is pressed', () => {
    const props = makeCalibrationCardProps({ entry: { months: 5, samples: 2 } });
    render(<CalibrationCard {...props} />);

    fireEvent.press(screen.getByTestId(TID.reset));
    const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    buttons.find((b) => b.text === 'Reset')?.onPress?.();

    expect(props.onReset).toHaveBeenCalledTimes(1);
  });

  it('does not call onReset when Cancel is chosen', () => {
    const props = makeCalibrationCardProps({ entry: { months: 5, samples: 2 } });
    render(<CalibrationCard {...props} />);

    fireEvent.press(screen.getByTestId(TID.reset));
    const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    buttons.find((b) => b.text === 'Cancel')?.onPress?.();

    expect(props.onReset).not.toHaveBeenCalled();
  });
});
