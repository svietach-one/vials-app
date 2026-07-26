/**
 * Component tests for the optional skin-condition picker (US-23) and the
 * condition-aware recovery caution (US-25).
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import {
  makeConditionSelectorProps,
  makeRehabNotice,
  makeRehabNoticeCardProps,
} from './fixtures';

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return {
    Feather: ({ name, testID }: { name: string; testID?: string }) => (
      <View testID={testID ?? `feather-icon-${name}`} />
    ),
  };
});

import { ConditionSelector } from '@/components/profile/ConditionSelector';
import { RehabNoticeCard } from '@/components/routine/RehabNoticeCard';
import { getRecoveryConditionCaution } from '@/utils/skinConditionModifiers';

describe('US-23: ConditionSelector', () => {
  it('offers all three conditions with plain-language descriptions', () => {
    // Arrange / Act
    render(<ConditionSelector {...makeConditionSelectorProps()} />);
    // Assert
    expect(screen.getByLabelText('Eczema / atopic dermatitis')).toBeTruthy();
    expect(screen.getByLabelText('Seborrheic dermatitis')).toBeTruthy();
    expect(screen.getByLabelText('Rosacea')).toBeTruthy();
    expect(screen.getByText('Skin that flushes or reacts easily.')).toBeTruthy();
  });

  it('shows a persistent non-diagnostic disclaimer', () => {
    render(<ConditionSelector {...makeConditionSelectorProps()} />);
    expect(screen.getByText(/not a diagnosis/i)).toBeTruthy();
    expect(screen.getByText(/do not replace advice from a dermatologist/i)).toBeTruthy();
  });

  it('starts with nothing selected', () => {
    render(<ConditionSelector {...makeConditionSelectorProps()} />);
    expect(screen.getByLabelText('Rosacea').props.accessibilityState.checked).toBe(false);
  });

  it('is multi-select — adds a second condition without dropping the first', () => {
    // Arrange
    const onChange = jest.fn();
    render(
      <ConditionSelector {...makeConditionSelectorProps({ selected: ['eczema'], onChange })} />,
    );
    // Act
    fireEvent.press(screen.getByLabelText('Rosacea'));
    // Assert
    expect(onChange).toHaveBeenCalledWith(['eczema', 'rosacea']);
  });

  it('deselects a selected condition', () => {
    // Arrange
    const onChange = jest.fn();
    render(
      <ConditionSelector {...makeConditionSelectorProps({ selected: ['eczema'], onChange })} />,
    );
    // Act
    fireEvent.press(screen.getByLabelText('Eczema / atopic dermatitis'));
    // Assert
    expect(onChange).toHaveBeenCalledWith([]);
  });
});

describe('US-25: recovery caution on the rehab card', () => {
  it('appends the caution line for eczema after an aggressive procedure', () => {
    // Arrange
    const caution = getRecoveryConditionCaution(['eczema'], {
      aggressive: true,
      phase: 'rehab',
    });
    // Act
    render(<RehabNoticeCard {...makeRehabNoticeCardProps({ conditionCaution: caution })} />);
    // Assert
    expect(screen.getByText(/Recovery may take a bit longer than usual/)).toBeTruthy();
  });

  it('renders no extra line when no condition is selected', () => {
    // Arrange
    const caution = getRecoveryConditionCaution([], { aggressive: true, phase: 'rehab' });
    // Act
    render(<RehabNoticeCard {...makeRehabNoticeCardProps({ conditionCaution: caution })} />);
    // Assert
    expect(screen.queryByText(/Recovery may take a bit longer/)).toBeNull();
  });

  it('renders no extra line for a botox rehab notice', () => {
    // Arrange — botox is not in the aggressive set
    const notice = makeRehabNotice({ procedureName: 'Botox', aggressive: false });
    const caution = getRecoveryConditionCaution(['rosacea'], {
      aggressive: notice.aggressive,
      phase: 'rehab',
    });
    // Act
    render(<RehabNoticeCard {...makeRehabNoticeCardProps({ notice, conditionCaution: caution })} />);
    // Assert
    expect(screen.queryByText(/Recovery may take a bit longer/)).toBeNull();
  });

  it('keeps the existing restriction list intact alongside the caution', () => {
    // Arrange
    const caution = getRecoveryConditionCaution(['rosacea'], {
      aggressive: true,
      phase: 'rehab',
    });
    // Act
    render(<RehabNoticeCard {...makeRehabNoticeCardProps({ conditionCaution: caution })} />);
    // Assert
    expect(screen.getByText('Strictly indoor shelter or SPF 50+')).toBeTruthy();
    expect(screen.getByText('Day 2 of 14')).toBeTruthy();
  });
});
