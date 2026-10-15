/**
 * Draft Preview "Routine style" control (tech design FE-11, spec Story 1 / §5).
 *
 * ASSUMED props, added to the existing DraftPreviewScreenProps:
 *   depth: RoutineDepth;  onDepthChange: (depth: RoutineDepth) => void
 * The control is the real SegmentedControl, whose segments are role="tab" with
 * accessibilityState.selected, labelled with the approved style names.
 * The screen only reports the tap; RoutinesScreen persists + regenerates
 * (that wiring is covered in routines-screen.test.tsx).
 * Written against a DRAFT spec.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ROUTINE_DEPTH_COPY, ROUTINE_DEPTH_OPTIONS } from '@/constants/routineDepth';
import type { Product, Routine } from '@/types';
import { DraftPreviewScreen } from '@/components/routine/DraftPreviewScreen';
import { generatePlan } from '@/utils/routineEngine/generate';
import type { PlanDiffEntry } from '@/utils/routineEngine/validate';
import { makeDepthInput, makeR9 } from './fixtures';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return { Feather: ({ name, testID }: { name: string; testID?: string }) => <View testID={testID ?? `feather-icon-${name}`} /> };
});
jest.mock('@gorhom/bottom-sheet', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const BottomSheetModal = ReactActual.forwardRef(({ children }: { children: React.ReactNode }, ref: React.Ref<unknown>) => {
    ReactActual.useImperativeHandle(ref, () => ({ present: () => {}, dismiss: () => {} }));
    return <View>{children}</View>;
  });
  return { BottomSheetModal, BottomSheetScrollView: ({ children }: { children: React.ReactNode }) => <View>{children}</View>, BottomSheetBackdrop: () => null };
});

let mockProducts: Product[] = [];
let mockRoutines: Routine[] = [];
jest.mock('@/store/productsStore', () => ({
  useProductsStore: jest.fn((selector: any) => selector({ products: mockProducts })),
}));
jest.mock('@/store/routinesStore', () => ({
  useRoutinesStore: jest.fn((selector: any) => selector({ routines: mockRoutines })),
}));

const NO_DIFF: PlanDiffEntry[] = [];

function renderDraft(depth: 'essential' | 'balanced', extra: Partial<React.ComponentProps<typeof DraftPreviewScreen>> = {}) {
  mockProducts = makeR9();
  mockRoutines = [];
  const onDepthChange = jest.fn();
  const onCommit = jest.fn();
  render(
    <DraftPreviewScreen
      visible
      onClose={jest.fn()}
      plan={generatePlan(makeDepthInput(mockProducts, depth))}
      diff={NO_DIFF}
      onCommit={onCommit}
      depth={depth}
      onDepthChange={onDepthChange}
      {...extra}
    />,
  );
  return { onDepthChange, onCommit };
}

describe('Routine style control', () => {
  it('labels the control "Routine style" with the two approved style names as tabs', () => {
    renderDraft('balanced');

    expect(screen.getByText(ROUTINE_DEPTH_COPY.styleLabel)).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Essential' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Balanced' })).toBeTruthy();
  });

  it.each([
    ['balanced', 'Balanced', 'Essential'],
    ['essential', 'Essential', 'Balanced'],
  ] as const)('marks only the %s segment as selected', (depth, selected, other) => {
    renderDraft(depth);

    expect(screen.getByRole('tab', { name: selected }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByRole('tab', { name: other }).props.accessibilityState.selected).toBe(false);
  });

  it('describes the selected style with exactly one line, which follows the selection', () => {
    renderDraft('balanced');

    expect(screen.getByText(ROUTINE_DEPTH_OPTIONS.balanced.sublabel)).toBeTruthy();
    expect(screen.queryByText(ROUTINE_DEPTH_OPTIONS.essential.sublabel)).toBeNull();
  });

  it('reports the tapped style without committing anything', () => {
    const { onDepthChange, onCommit } = renderDraft('balanced');

    fireEvent.press(screen.getByRole('tab', { name: 'Essential' }));

    expect(onDepthChange).toHaveBeenCalledWith('essential');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('shows the toner and eye cream as steps in a Balanced draft', () => {
    renderDraft('balanced');
    expect(screen.getAllByText('Hydrating Toner').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Eye Cream').length).toBeGreaterThan(0);
  });
});

describe('reserve rows explain the style when it is the cause', () => {
  it('shows the Essential reserve sentence for the toner after expanding the reserve list', () => {
    renderDraft('essential');

    fireEvent.press(screen.getByText(/In reserve · \d+ products?/));

    expect(screen.getAllByText('Not part of your Essential routine — switch to Balanced to include it.').length).toBeGreaterThan(0);
  });
});
