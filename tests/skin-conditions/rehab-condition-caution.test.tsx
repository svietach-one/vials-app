/**
 * Component tests for the condition-aware recovery caution on the rehab
 * notice card (US-25).
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { makeRehabNotice, makeRehabNoticeCardProps } from './fixtures';

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return {
    Feather: ({ name, testID }: { name: string; testID?: string }) => (
      <View testID={testID ?? `feather-icon-${name}`} />
    ),
  };
});

import { RehabNoticeCard } from '@/components/routine/RehabNoticeCard';
import { getRecoveryConditionCaution } from '@/utils/skinConditionModifiers';

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
