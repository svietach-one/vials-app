/**
 * Integration tests — Story 2 AC2 (sheet wiring), screen-improvements
 * redesign: DraftPreviewSheet renders a "Replace with" Select per recorded
 * `plan.slotAlternatives` entry, listing every candidate (current, engine
 * recommendation, reserve alternatives) and bubbling the chosen one up to
 * the caller instead of mutating the plan itself.
 * Spec: docs/specs/2026-07-11-routine-similar-product-priority.md §4 Story 2
 * Tech design: docs/tech-design/routine-similar-product-priority.md (FE-3, FE-10)
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import type { Product, Routine } from '@/types';
import type { PlanDiffEntry } from '@/utils/routineEngine/validate';

import { CREAM_A, CREAM_B, makePlanWithAlternative, makeSlotAlternative } from './fixtures';

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return {
    Feather: ({ name, testID }: { name: string; testID?: string }) => (
      <View testID={testID ?? `feather-icon-${name}`} />
    ),
  };
});

jest.mock('@gorhom/bottom-sheet', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const BottomSheetModal = ReactActual.forwardRef(
    ({ children }: { children: React.ReactNode }, ref: React.Ref<unknown>) => {
      ReactActual.useImperativeHandle(ref, () => ({ present: () => {}, dismiss: () => {} }));
      return <View>{children}</View>;
    },
  );
  const BottomSheetScrollView = ({ children }: { children: React.ReactNode }) => <View>{children}</View>;
  const BottomSheetBackdrop = () => null;
  return { BottomSheetModal, BottomSheetScrollView, BottomSheetBackdrop };
});

let mockProducts: Product[] = [];
let mockRoutines: Routine[] = [];

jest.mock('@/store/productsStore', () => ({
  useProductsStore: jest.fn((selector: any) => selector({ products: mockProducts })),
}));

jest.mock('@/store/routinesStore', () => ({
  useRoutinesStore: jest.fn((selector: any) => selector({ routines: mockRoutines })),
}));

import { DraftPreviewSheet } from '@/components/routine/DraftPreviewSheet';

const NO_DIFF: PlanDiffEntry[] = [];

beforeEach(() => {
  mockProducts = [CREAM_A, CREAM_B];
  mockRoutines = [];
});

describe('Story 2 AC2: a same-slot candidate renders inside the step card dropdown', () => {
  it('starts collapsed and reveals the "Replace with" list only once the step card is tapped', () => {
    render(
      <DraftPreviewSheet
        visible
        onClose={jest.fn()}
        plan={makePlanWithAlternative()}
        diff={NO_DIFF}
        onCommit={jest.fn()}
        onSwapAlternative={jest.fn()}
      />,
    );

    expect(screen.queryByText('Replace with')).toBeNull();

    fireEvent.press(screen.getByLabelText(`Replace ${CREAM_A.name}`));

    expect(screen.getByText('Replace with')).toBeTruthy();
  });

  it('never removes the alternative from the shelf or the plan — it stays a suggestion, not a mutation', () => {
    const plan = makePlanWithAlternative();
    render(
      <DraftPreviewSheet
        visible
        onClose={jest.fn()}
        plan={plan}
        diff={NO_DIFF}
        onCommit={jest.fn()}
        onSwapAlternative={jest.fn()}
      />,
    );

    // The winner is still the one shown as admitted; nothing about the
    // plan's own periods array is touched by rendering.
    expect(plan.periods.morning.map((s) => s.productId)).toEqual([CREAM_A.id]);
  });

  it('renders no dropdown affordance at all when the plan has no slotAlternatives', () => {
    const plan = makePlanWithAlternative({ slotAlternatives: [] });
    render(
      <DraftPreviewSheet
        visible
        onClose={jest.fn()}
        plan={plan}
        diff={NO_DIFF}
        onCommit={jest.fn()}
        onSwapAlternative={jest.fn()}
      />,
    );
    expect(screen.queryByText('Replace with')).toBeNull();
    // The card is inert too — no expand target, so a chevron never lies.
    expect(screen.queryByLabelText(`Replace ${CREAM_A.name}`)).toBeNull();
  });
});

describe('Story 2 AC2: expanding a step card lists every candidate with a reason fragment', () => {
  it('lists the recommended product and the alternative, each with a reason', () => {
    render(
      <DraftPreviewSheet
        visible
        onClose={jest.fn()}
        plan={makePlanWithAlternative()}
        diff={NO_DIFF}
        onCommit={jest.fn()}
        onSwapAlternative={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByLabelText(`Replace ${CREAM_A.name}`));

    expect(screen.getByLabelText(`${CREAM_A.name} — recommended`)).toBeTruthy();
    expect(screen.getByLabelText(`${CREAM_B.name} — from reserve`)).toBeTruthy();
  });

  it('lists one option per candidate when a slot has more than one non-admitted competitor', () => {
    const secondAlternative = { ...CREAM_B, id: 'p-cream-c', name: 'Third Moisturizer' };
    mockProducts = [CREAM_A, CREAM_B, secondAlternative];
    const plan = makePlanWithAlternative({
      slotAlternatives: [
        makeSlotAlternative({
          alternatives: [
            { productId: CREAM_B.id, productType: 'moisturizer', scheduledDays: [], slotIndex: 11, score: 0, addedAt: '2026-01-01' },
            { productId: secondAlternative.id, productType: 'moisturizer', scheduledDays: [], slotIndex: 11, score: 0, addedAt: '2026-01-01' },
          ],
        }),
      ],
    });

    render(
      <DraftPreviewSheet
        visible
        onClose={jest.fn()}
        plan={plan}
        diff={NO_DIFF}
        onCommit={jest.fn()}
        onSwapAlternative={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByLabelText(`Replace ${CREAM_A.name}`));

    expect(screen.getByLabelText(`${CREAM_B.name} — from reserve`)).toBeTruthy();
    expect(screen.getByLabelText(`${secondAlternative.name} — from reserve`)).toBeTruthy();
  });
});

describe('Story 2 AC2: choosing a candidate bubbles the decision up to the caller', () => {
  it('calls onSwapAlternative(winnerProductId, chosenProductId) and does not call onCommit', () => {
    const onSwapAlternative = jest.fn();
    const onCommit = jest.fn();
    render(
      <DraftPreviewSheet
        visible
        onClose={jest.fn()}
        plan={makePlanWithAlternative()}
        diff={NO_DIFF}
        onCommit={onCommit}
        onSwapAlternative={onSwapAlternative}
      />,
    );

    fireEvent.press(screen.getByLabelText(`Replace ${CREAM_A.name}`));
    fireEvent.press(screen.getByLabelText(`${CREAM_B.name} — from reserve`));

    expect(onSwapAlternative).toHaveBeenCalledWith(CREAM_A.id, CREAM_B.id);
    expect(onCommit).not.toHaveBeenCalled();
  });
});
