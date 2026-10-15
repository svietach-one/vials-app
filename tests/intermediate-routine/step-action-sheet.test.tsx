/**
 * RoutineStepActionSheet `allowRemoval` (tech design FE-9; spec Story 5):
 * Remove and Hide only exist when removal is allowed; default is allowed.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { RoutineStepActionSheet, type RoutineStepActionSheetProps } from '@/components/routine/RoutineStepActionSheet';
import { shelfProduct } from './fixtures';

jest.mock('@/components/ui/Icon', () => {
  const { View } = require('react-native');
  return { Icon: ({ name }: { name: string }) => <View testID={`icon-${name}`} /> };
});

function makeProps(overrides: Partial<RoutineStepActionSheetProps> = {}): RoutineStepActionSheetProps {
  return {
    product: shelfProduct('p', 'Daily Cream', 'moisturizer'),
    onViewDetails: jest.fn(),
    onEdit: jest.fn(),
    onRemoveFromRoutine: jest.fn(),
    onHide: jest.fn(),
    onClose: jest.fn(),
    allowRemoval: true,
    ...overrides,
  };
}

describe('with removal allowed (edit mode, and the default)', () => {
  it('offers all four rows', () => {
    render(<RoutineStepActionSheet {...makeProps()} />);

    expect(screen.getByText('View product details')).toBeTruthy();
    expect(screen.getByText('Edit product')).toBeTruthy();
    expect(screen.getByText('Remove from routine')).toBeTruthy();
    expect(screen.getByText('Hide from routine')).toBeTruthy();
  });

  it('keeps today\'s four rows when the prop is omitted', () => {
    const { allowRemoval: _omit, ...props } = makeProps();
    render(<RoutineStepActionSheet {...props} />);

    expect(screen.getByText('Remove from routine')).toBeTruthy();
    expect(screen.getByText('Hide from routine')).toBeTruthy();
  });
});

describe('with removal not allowed (edit mode off)', () => {
  it('offers only "View product details" and "Edit product"', () => {
    render(<RoutineStepActionSheet {...makeProps({ allowRemoval: false })} />);

    expect(screen.getByText('View product details')).toBeTruthy();
    expect(screen.getByText('Edit product')).toBeTruthy();
    expect(screen.queryByText('Remove from routine')).toBeNull();
    expect(screen.queryByText('Hide from routine')).toBeNull();
  });

  it('still acts on the product for the two remaining rows and closes afterwards', () => {
    const props = makeProps({ allowRemoval: false });
    render(<RoutineStepActionSheet {...props} />);

    fireEvent.press(screen.getByText('Edit product'));

    expect(props.onEdit).toHaveBeenCalledWith(props.product);
    expect(props.onClose).toHaveBeenCalled();
    expect(props.onRemoveFromRoutine).not.toHaveBeenCalled();
    expect(props.onHide).not.toHaveBeenCalled();
  });
});
