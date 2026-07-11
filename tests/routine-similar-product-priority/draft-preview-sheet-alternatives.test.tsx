/**
 * Integration tests — Story 2 AC2 (sheet wiring): DraftPreviewSheet renders a
 * SlotAlternativeRow per recorded `plan.slotAlternatives` entry, and bubbles
 * a swap decision up to the caller instead of mutating the plan itself.
 * Spec: docs/specs/2026-07-11-routine-similar-product-priority.md §4 Story 2
 * Tech design: docs/tech-design/routine-similar-product-priority.md (FE-3, FE-10)
 *
 * `RoutinePlan.slotAlternatives` (FE-3) and the `onSwapAlternative` prop
 * (FE-10) do not exist yet — this file (and fixtures.ts's
 * makePlanWithAlternative) fails to typecheck/resolve until they land.
 * Expected (tests-first). Mocking follows
 * tests/routine-engine/draft-preview-sheet.test.tsx's established playbook.
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

describe('Story 2 AC2: a non-admitted same-slot product renders as a visible, swappable alternative', () => {
  it('shows "Also on your shelf: <alternative>" under the admitted winner in the Morning After column', () => {
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

    expect(screen.getAllByText(CREAM_A.name).length).toBeGreaterThan(0);
    expect(screen.getByText(`Also on your shelf: ${CREAM_B.name}`)).toBeTruthy();
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

    // The winner is still the one shown as admitted in the After column;
    // nothing about the plan's own periods array is touched by rendering.
    expect(plan.periods.morning.map((s) => s.productId)).toEqual([CREAM_A.id]);
  });

  it('renders no SlotAlternativeRow when the plan has no slotAlternatives', () => {
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
    expect(screen.queryByText(/Also on your shelf/)).toBeNull();
  });
});

describe('Story 2 AC2: the one-tap swap action bubbles up to the caller', () => {
  it('calls onSwapAlternative(winnerProductId, alternativeProductId) and does not call onCommit', () => {
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

    fireEvent.press(screen.getByLabelText(`Swap to ${CREAM_B.name}`));

    expect(onSwapAlternative).toHaveBeenCalledWith(CREAM_A.id, CREAM_B.id);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('renders one row per alternative when a slot has more than one non-admitted competitor', () => {
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

    expect(screen.getByText(`Also on your shelf: ${CREAM_B.name}`)).toBeTruthy();
    expect(screen.getByText(`Also on your shelf: ${secondAlternative.name}`)).toBeTruthy();
  });
});
