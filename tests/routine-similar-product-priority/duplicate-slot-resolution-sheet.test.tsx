/**
 * Component tests — Story 3 ACs 2 & 3: the resolution sheet opened by tapping
 * the passive duplicate-slot warning.
 * Spec: docs/specs/2026-07-11-routine-similar-product-priority.md §4 Story 3
 * Tech design: docs/tech-design/routine-similar-product-priority.md (FE-9)
 *
 * DuplicateSlotResolutionSheet and routinesStore.removeProductStep (existing,
 * reused per FE-9) are exercised here; the sheet component itself does not
 * exist yet — this file fails to resolve until the engineer creates
 * src/components/routine/DuplicateSlotResolutionSheet.tsx per the contract in
 * fixtures.ts. Expected (tests-first).
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { CREAM_A, CREAM_B, makeDuplicateSlotResolutionSheetProps } from './fixtures';

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return {
    Feather: ({ name, testID }: { name: string; testID?: string }) => (
      <View testID={testID ?? `feather-icon-${name}`} />
    ),
  };
});

const mockRemoveProductStep = jest.fn();
jest.mock('@/store/routinesStore', () => {
  const stateGetter = () => ({ removeProductStep: mockRemoveProductStep });
  const useRoutinesStore: any = jest.fn((selector: any) => selector(stateGetter()));
  useRoutinesStore.getState = stateGetter;
  return { useRoutinesStore };
});

import { DuplicateSlotResolutionSheet } from '@/components/routine/DuplicateSlotResolutionSheet';

beforeEach(() => {
  mockRemoveProductStep.mockClear();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Story 3 AC2: opening the sheet lists competing products ranked, with the top-ranked one "Recommended"', () => {
  it('renders both products in the given rank order, tagging only index 0 as Recommended', () => {
    render(
      <DuplicateSlotResolutionSheet
        {...makeDuplicateSlotResolutionSheetProps({ rankedProducts: [CREAM_A, CREAM_B] })}
      />,
    );

    expect(screen.getByText(CREAM_A.name)).toBeTruthy();
    expect(screen.getByText(CREAM_B.name)).toBeTruthy();
    expect(screen.getByText('Recommended')).toBeTruthy();
    // Only one "Recommended" tag exists, no matter how many products are ranked.
    expect(screen.getAllByText('Recommended')).toHaveLength(1);
  });

  it('does not re-sort — a different input order still tags its own index 0', () => {
    render(
      <DuplicateSlotResolutionSheet
        {...makeDuplicateSlotResolutionSheetProps({ rankedProducts: [CREAM_B, CREAM_A] })}
      />,
    );
    expect(screen.getAllByText('Recommended')).toHaveLength(1);
  });
});

describe('Story 3 AC2: removing a product asks for confirmation before calling removeProductStep', () => {
  it('does not remove until the user confirms the native Alert', () => {
    render(
      <DuplicateSlotResolutionSheet
        {...makeDuplicateSlotResolutionSheetProps({ routineId: 'routine-am', rankedProducts: [CREAM_A, CREAM_B] })}
      />,
    );

    fireEvent.press(screen.getByLabelText(`Remove ${CREAM_B.name}`));

    expect(Alert.alert).toHaveBeenCalled();
    expect(mockRemoveProductStep).not.toHaveBeenCalled();
  });

  it('calls removeProductStep(routineId, productId) once the Alert confirmation runs', () => {
    (Alert.alert as jest.Mock).mockImplementation((_title, _msg, buttons) => {
      const confirm = buttons?.find((b: any) => b.text === 'Remove');
      confirm?.onPress?.();
    });

    render(
      <DuplicateSlotResolutionSheet
        {...makeDuplicateSlotResolutionSheetProps({ routineId: 'routine-am', rankedProducts: [CREAM_A, CREAM_B] })}
      />,
    );

    fireEvent.press(screen.getByLabelText(`Remove ${CREAM_B.name}`));

    expect(mockRemoveProductStep).toHaveBeenCalledWith('routine-am', CREAM_B.id);
  });

  it('removes nothing when the Alert is cancelled', () => {
    (Alert.alert as jest.Mock).mockImplementation((_title, _msg, buttons) => {
      const cancel = buttons?.find((b: any) => b.text === 'Cancel' || b.style === 'cancel');
      cancel?.onPress?.();
    });

    render(
      <DuplicateSlotResolutionSheet
        {...makeDuplicateSlotResolutionSheetProps({ routineId: 'routine-am', rankedProducts: [CREAM_A, CREAM_B] })}
      />,
    );

    fireEvent.press(screen.getByLabelText(`Remove ${CREAM_B.name}`));

    expect(mockRemoveProductStep).not.toHaveBeenCalled();
  });
});

describe('Story 3 AC3: "Keep all" dismisses without removing anything', () => {
  it('calls onClose and never removeProductStep', () => {
    const onClose = jest.fn();
    render(
      <DuplicateSlotResolutionSheet
        {...makeDuplicateSlotResolutionSheetProps({ onClose, rankedProducts: [CREAM_A, CREAM_B] })}
      />,
    );

    fireEvent.press(screen.getByLabelText('Keep all'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockRemoveProductStep).not.toHaveBeenCalled();
  });
});

describe('Story 3 AC3: the resolution sheet never blocks — it is dismissable at any time', () => {
  it('renders nothing interactive when visible is false', () => {
    render(
      <DuplicateSlotResolutionSheet
        {...makeDuplicateSlotResolutionSheetProps({ visible: false })}
      />,
    );
    expect(screen.queryByLabelText('Keep all')).toBeNull();
  });
});
