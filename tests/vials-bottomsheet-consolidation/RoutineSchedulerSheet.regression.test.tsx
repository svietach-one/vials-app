/**
 * Component tests — Story 1 AC4: RoutineSchedulerSheet (BottomSheet's one
 * pre-existing consumer) renders and dismisses exactly as it did before
 * FE-1's safe-area-insets change — no visual or behavioral regression.
 * Spec: docs/specs/vials-bottomsheet-consolidation.md §4 Story 1 AC4
 * Tech design: docs/tech-design/vials-bottomsheet-consolidation.md (FE-1)
 *
 * Grounded directly in src/components/routine/RoutineSchedulerSheet.tsx as
 * it exists today (read in full before writing this file): it always passes
 * `dismissOnBackdrop={false}` to BottomSheet, pre-populates Morning/Evening/
 * scheduledDays from the store via `deriveProductSchedule` on open, requires
 * at least one of Morning/Evening before saving, and calls
 * upsertProductStep/removeProductStep per period on Save. None of that
 * behavior is expected to change under FE-1 (which only touches
 * BottomSheet's internal padding calculation) — every assertion below
 * should already pass against today's code and must keep passing after FE-1
 * lands.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import type { Routine } from '@/types';

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

let mockRoutines: Routine[] = [];
const mockUpsertProductStep = jest.fn();
const mockRemoveProductStep = jest.fn();

jest.mock('@/store/routinesStore', () => {
  const stateGetter = () => ({
    routines: mockRoutines,
    upsertProductStep: mockUpsertProductStep,
    removeProductStep: mockRemoveProductStep,
  });
  const useRoutinesStore: any = jest.fn((selector: any) => selector(stateGetter()));
  useRoutinesStore.getState = stateGetter;
  return { useRoutinesStore };
});

import { RoutineSchedulerSheet } from '@/components/routine/RoutineSchedulerSheet';
import { makeRoutineSchedulerSheetProps } from './fixtures';

beforeEach(() => {
  mockUpsertProductStep.mockClear();
  mockRemoveProductStep.mockClear();
  mockRoutines = [
    { id: 'routine-am', name: 'Morning', timeOfDay: 'morning', steps: [] },
    { id: 'routine-pm', name: 'Evening', timeOfDay: 'evening', steps: [] },
  ];
});

describe('Story 1 AC4: unchanged rendering', () => {
  it('renders the default title, both sections, and both TimeChips', () => {
    render(<RoutineSchedulerSheet {...makeRoutineSchedulerSheetProps()} />);

    expect(screen.getByText('Add to Routine')).toBeTruthy();
    expect(screen.getByText('Time of Day')).toBeTruthy();
    expect(screen.getByText('Weekly Planner')).toBeTruthy();
    expect(screen.getByLabelText('Morning')).toBeTruthy();
    expect(screen.getByLabelText('Evening')).toBeTruthy();
  });

  it('renders a custom title when one is supplied', () => {
    render(
      <RoutineSchedulerSheet {...makeRoutineSchedulerSheetProps({ title: 'Edit Schedule' })} />,
    );

    expect(screen.getByText('Edit Schedule')).toBeTruthy();
    expect(screen.queryByText('Add to Routine')).toBeNull();
  });

  it('pre-populates Morning as checked when the product already has a morning step', () => {
    mockRoutines = [
      {
        id: 'routine-am',
        name: 'Morning',
        timeOfDay: 'morning',
        steps: [{ id: 'step-am', productType: 'moisturizer', productId: 'product-1', hidden: false, scheduledDays: [] }],
      },
      { id: 'routine-pm', name: 'Evening', timeOfDay: 'evening', steps: [] },
    ];

    render(<RoutineSchedulerSheet {...makeRoutineSchedulerSheetProps()} />);

    expect(screen.getByLabelText('Morning').props.accessibilityState?.checked).toBe(true);
    expect(screen.getByLabelText('Evening').props.accessibilityState?.checked).toBe(false);
  });
});

describe('Story 1 AC4: unchanged dismiss behavior — backdrop tap never closes this sheet', () => {
  it('keeps the sheet content mounted after a backdrop tap (dismissOnBackdrop is always false here)', () => {
    const onClose = jest.fn();
    render(<RoutineSchedulerSheet {...makeRoutineSchedulerSheetProps({ onClose })} />);

    fireEvent.press(screen.getByTestId('bottomsheet-backdrop'));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Time of Day')).toBeTruthy();
  });

  it('the Cancel button still closes the sheet without writing to the store', () => {
    const onClose = jest.fn();
    render(<RoutineSchedulerSheet {...makeRoutineSchedulerSheetProps({ onClose })} />);

    fireEvent.press(screen.getByText('Cancel'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockUpsertProductStep).not.toHaveBeenCalled();
    expect(mockRemoveProductStep).not.toHaveBeenCalled();
  });
});

describe('Story 1 AC4: unchanged save validation and write behavior', () => {
  it('shows a validation error and writes nothing when neither Morning nor Evening is selected', () => {
    const onClose = jest.fn();
    render(<RoutineSchedulerSheet {...makeRoutineSchedulerSheetProps({ onClose })} />);

    fireEvent.press(screen.getByText('Save'));

    expect(
      screen.getByText('Please select when you will be using this product (Morning, Evening, or Both)'),
    ).toBeTruthy();
    expect(mockUpsertProductStep).not.toHaveBeenCalled();
    expect(mockRemoveProductStep).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('upserts the morning step, removes any evening step, and closes on Save with only Morning checked', () => {
    const onClose = jest.fn();
    render(
      <RoutineSchedulerSheet
        {...makeRoutineSchedulerSheetProps({ onClose, productId: 'product-1', productType: 'moisturizer' })}
      />,
    );

    fireEvent.press(screen.getByLabelText('Morning'));
    fireEvent.press(screen.getByText('Save'));

    expect(mockUpsertProductStep).toHaveBeenCalledWith('routine-am', 'product-1', 'moisturizer', []);
    expect(mockRemoveProductStep).toHaveBeenCalledWith('routine-pm', 'product-1');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('Story 1 AC4: unchanged destructive actions', () => {
  it('renders neither Hide nor Remove when their handlers are not supplied', () => {
    render(<RoutineSchedulerSheet {...makeRoutineSchedulerSheetProps()} />);

    expect(screen.queryByText('Hide product')).toBeNull();
    expect(screen.queryByText('Remove from routine')).toBeNull();
  });

  it('closes then calls onHide when "Hide product" is pressed', () => {
    const onClose = jest.fn();
    const onHide = jest.fn();
    render(<RoutineSchedulerSheet {...makeRoutineSchedulerSheetProps({ onClose, onHide })} />);

    fireEvent.press(screen.getByText('Hide product'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onHide).toHaveBeenCalledTimes(1);
  });
});
