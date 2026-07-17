/**
 * GoalSelector component contract (V2.1 phase-03 §3.1: "pick at most 2
 * goals"). First selected = primary, second = secondary; no selection means
 * maintenance. Written qa-lead-first against the intended props:
 *   { primaryGoal, secondaryGoal, onChange(primary, secondary) }
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { GoalSelector, type GoalSelectorProps } from '@/components/profile/GoalSelector';

function makeProps(overrides: Partial<GoalSelectorProps> = {}): GoalSelectorProps {
  return {
    primaryGoal: 'maintenance',
    secondaryGoal: null,
    onChange: jest.fn(),
    ...overrides,
  };
}

describe('GoalSelector', () => {
  it('renders the six selectable goals and no maintenance chip', () => {
    render(<GoalSelector {...makeProps()} />);

    for (const label of [
      'Clear acne',
      'Fade pigmentation',
      'Anti-aging',
      'Deep hydration',
      'Repair barrier',
      'Control oil',
    ]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.queryByText('Maintenance')).toBeNull();
  });

  it('selects the first tapped goal as primary', () => {
    const onChange = jest.fn();
    render(<GoalSelector {...makeProps({ onChange })} />);

    fireEvent.press(screen.getByText('Anti-aging'));

    expect(onChange).toHaveBeenCalledWith('aging', null);
  });

  it('selects a second goal as secondary, keeping the first primary', () => {
    const onChange = jest.fn();
    render(<GoalSelector {...makeProps({ primaryGoal: 'aging', onChange })} />);

    fireEvent.press(screen.getByText('Deep hydration'));

    expect(onChange).toHaveBeenCalledWith('aging', 'dehydration');
  });

  it('ignores a third selection — at most 2 goals', () => {
    const onChange = jest.fn();
    render(
      <GoalSelector
        {...makeProps({ primaryGoal: 'aging', secondaryGoal: 'dehydration', onChange })}
      />,
    );

    fireEvent.press(screen.getByText('Control oil'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('promotes the secondary when the primary is deselected', () => {
    const onChange = jest.fn();
    render(
      <GoalSelector
        {...makeProps({ primaryGoal: 'aging', secondaryGoal: 'dehydration', onChange })}
      />,
    );

    fireEvent.press(screen.getByText('Anti-aging'));

    expect(onChange).toHaveBeenCalledWith('dehydration', null);
  });

  it('falls back to maintenance when the only selected goal is deselected', () => {
    const onChange = jest.fn();
    render(<GoalSelector {...makeProps({ primaryGoal: 'aging', onChange })} />);

    fireEvent.press(screen.getByText('Anti-aging'));

    expect(onChange).toHaveBeenCalledWith('maintenance', null);
  });

  it('marks the primary chip with a Primary indicator', () => {
    render(
      <GoalSelector {...makeProps({ primaryGoal: 'aging', secondaryGoal: 'dehydration' })} />,
    );

    expect(screen.getByText('Primary')).toBeTruthy();
  });

  it('exposes checkbox semantics with checked state on selected chips', () => {
    render(<GoalSelector {...makeProps({ primaryGoal: 'aging' })} />);

    const checked = screen
      .getAllByRole('checkbox')
      .filter((node) => node.props.accessibilityState?.checked === true);
    expect(checked).toHaveLength(1);
  });
});
