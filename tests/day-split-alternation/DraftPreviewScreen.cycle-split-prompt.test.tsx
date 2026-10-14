/**
 * Integration tests — Stories 2, 3 (UI half), 4 (UI half): the Draft Preview
 * cycle-class-rival prompt card.
 * Spec: docs/specs/day-split-alternation.md §4 Stories 2, 3, 4
 * Tech design: docs/tech-design/day-split-alternation.md (FE-5)
 *
 * Written BEFORE the engineer's implementation, per the qa-lead -> engineer
 * handoff (.claude/rules/agent-layer-protocol.md). `plan.reserve` items don't
 * carry `rivalOfProductId`/`period` yet, `cycle_class_rival` is not a member
 * of `DecisionReasonCode`, and `DraftPreviewScreenProps` doesn't have
 * `onAcceptCycleSplit`/`onDeclineCycleSplit`/`dismissedCycleSplitRivalIds`
 * yet — every test below is EXPECTED TO FAIL (both `tsc` and at runtime)
 * until FE-1/FE-5 ship. The binding prop/behaviour contract is documented in
 * ./fixtures.ts's file header.
 *
 * Mocking follows the established playbook in
 * tests/routine-similar-product-priority/draft-preview-sheet-alternatives.test.tsx.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import type { Product, Routine } from '@/types';
import type { PlanDiffEntry } from '@/utils/routineEngine/validate';

import { AHA, RETINOID, makePlanWithCycleRival, makePlannedStep } from './fixtures';

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

import { DraftPreviewScreen } from '@/components/routine/DraftPreviewScreen';

const NO_DIFF: PlanDiffEntry[] = [];

beforeEach(() => {
  mockProducts = [RETINOID, AHA];
  mockRoutines = [];
});

describe('Story 2: the cycle-class-rival prompt card renders when detected', () => {
  it('names both the winner and the rival and offers both actions', () => {
    render(
      <DraftPreviewScreen
        visible
        onClose={jest.fn()}
        plan={makePlanWithCycleRival()}
        diff={NO_DIFF}
        onCommit={jest.fn()}
        onAcceptCycleSplit={jest.fn()}
        onDeclineCycleSplit={jest.fn()}
      />,
    );

    expect(screen.getByText(RETINOID.name)).toBeTruthy();
    expect(screen.getByText(AHA.name)).toBeTruthy();
    expect(screen.getByLabelText('Alternate automatically')).toBeTruthy();
    expect(screen.getByLabelText(`Keep only ${RETINOID.name}`)).toBeTruthy();
  });

  it('renders no prompt card when the plan has no cycle_class_rival reserve item', () => {
    render(
      <DraftPreviewScreen
        visible
        onClose={jest.fn()}
        plan={makePlanWithCycleRival({ reserve: [{ productId: AHA.id, reasonCode: 'not_needed_for_goals' }] })}
        diff={NO_DIFF}
        onCommit={jest.fn()}
        onAcceptCycleSplit={jest.fn()}
        onDeclineCycleSplit={jest.fn()}
      />,
    );

    expect(screen.queryByLabelText('Alternate automatically')).toBeNull();
  });

  it('renders no prompt card at all for a plan with an empty reserve', () => {
    render(
      <DraftPreviewScreen
        visible
        onClose={jest.fn()}
        plan={makePlanWithCycleRival({ reserve: [] })}
        diff={NO_DIFF}
        onCommit={jest.fn()}
        onAcceptCycleSplit={jest.fn()}
        onDeclineCycleSplit={jest.fn()}
      />,
    );

    expect(screen.queryByLabelText('Alternate automatically')).toBeNull();
    expect(screen.queryByLabelText(`Keep only ${RETINOID.name}`)).toBeNull();
  });
});

describe('Story 2 AC: the prompt card is NOT buried in the collapsible "In reserve" section', () => {
  it('shows both actions before "In reserve" is ever expanded', () => {
    render(
      <DraftPreviewScreen
        visible
        onClose={jest.fn()}
        plan={makePlanWithCycleRival()}
        diff={NO_DIFF}
        onCommit={jest.fn()}
        onAcceptCycleSplit={jest.fn()}
        onDeclineCycleSplit={jest.fn()}
      />,
    );

    // "In reserve" starts collapsed (DraftPreviewScreen's own default state) —
    // the reserved AHA row itself is not yet in the tree, but the prompt
    // card's actions already are.
    expect(screen.queryByText(AHA.name)).toBeNull();
    expect(screen.getByLabelText('Alternate automatically')).toBeTruthy();
    expect(screen.getByLabelText(`Keep only ${RETINOID.name}`)).toBeTruthy();
  });
});

describe('Story 2 AC: doing nothing preserves today\'s exact single-winner/reserve outcome', () => {
  it('still lists the rival in "In reserve" with its own independent "Add anyway"', () => {
    const onOverride = jest.fn();
    const onAcceptCycleSplit = jest.fn();
    render(
      <DraftPreviewScreen
        visible
        onClose={jest.fn()}
        plan={makePlanWithCycleRival()}
        diff={NO_DIFF}
        onCommit={jest.fn()}
        onOverride={onOverride}
        onAcceptCycleSplit={onAcceptCycleSplit}
        onDeclineCycleSplit={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByText('In reserve · 1 product'));
    fireEvent.press(screen.getByLabelText(`Add ${AHA.name} anyway`));

    // The generic phase-07 override path fires — NOT the new cycle-split
    // acceptance path. The two affordances are independent, never conflated.
    expect(onOverride).toHaveBeenCalledWith(AHA.id);
    expect(onAcceptCycleSplit).not.toHaveBeenCalled();
  });

  it('the winner is still the one admitted and shown as a normal scheduled step', () => {
    render(
      <DraftPreviewScreen
        visible
        onClose={jest.fn()}
        plan={makePlanWithCycleRival()}
        diff={NO_DIFF}
        onCommit={jest.fn()}
        onAcceptCycleSplit={jest.fn()}
        onDeclineCycleSplit={jest.fn()}
      />,
    );

    expect(screen.getByText(RETINOID.name)).toBeTruthy();
  });
});

describe('Story 3: tapping "Alternate automatically" bubbles the rival productId up', () => {
  it('calls onAcceptCycleSplit(rivalProductId) and never onCommit', () => {
    const onAcceptCycleSplit = jest.fn();
    const onCommit = jest.fn();
    render(
      <DraftPreviewScreen
        visible
        onClose={jest.fn()}
        plan={makePlanWithCycleRival()}
        diff={NO_DIFF}
        onCommit={onCommit}
        onAcceptCycleSplit={onAcceptCycleSplit}
        onDeclineCycleSplit={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByLabelText('Alternate automatically'));

    expect(onAcceptCycleSplit).toHaveBeenCalledWith(AHA.id);
    expect(onCommit).not.toHaveBeenCalled();
  });
});

describe('Story 4: tapping "Keep only [winner]" bubbles the rival productId up', () => {
  it('calls onDeclineCycleSplit(rivalProductId) and never onAcceptCycleSplit/onCommit', () => {
    const onDeclineCycleSplit = jest.fn();
    const onAcceptCycleSplit = jest.fn();
    const onCommit = jest.fn();
    render(
      <DraftPreviewScreen
        visible
        onClose={jest.fn()}
        plan={makePlanWithCycleRival()}
        diff={NO_DIFF}
        onCommit={onCommit}
        onAcceptCycleSplit={onAcceptCycleSplit}
        onDeclineCycleSplit={onDeclineCycleSplit}
      />,
    );

    fireEvent.press(screen.getByLabelText(`Keep only ${RETINOID.name}`));

    expect(onDeclineCycleSplit).toHaveBeenCalledWith(AHA.id);
    expect(onAcceptCycleSplit).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });
});

describe('Story 4: a session-dismissed rival suppresses only the card, not the reserve row', () => {
  it('renders no prompt card when the rival id is in dismissedCycleSplitRivalIds', () => {
    render(
      <DraftPreviewScreen
        visible
        onClose={jest.fn()}
        plan={makePlanWithCycleRival()}
        diff={NO_DIFF}
        onCommit={jest.fn()}
        onAcceptCycleSplit={jest.fn()}
        onDeclineCycleSplit={jest.fn()}
        dismissedCycleSplitRivalIds={[AHA.id]}
      />,
    );

    expect(screen.queryByLabelText('Alternate automatically')).toBeNull();
    expect(screen.queryByLabelText(`Keep only ${RETINOID.name}`)).toBeNull();
  });

  it('still lists the dismissed rival in "In reserve" with "Add anyway" available', () => {
    render(
      <DraftPreviewScreen
        visible
        onClose={jest.fn()}
        plan={makePlanWithCycleRival()}
        diff={NO_DIFF}
        onCommit={jest.fn()}
        onOverride={jest.fn()}
        onAcceptCycleSplit={jest.fn()}
        onDeclineCycleSplit={jest.fn()}
        dismissedCycleSplitRivalIds={[AHA.id]}
      />,
    );

    fireEvent.press(screen.getByText('In reserve · 1 product'));
    expect(screen.getByLabelText(`Add ${AHA.name} anyway`)).toBeTruthy();
  });
});

describe('regression: a plan with two admitted steps and no reserve renders normally', () => {
  it('does not crash and shows no cycle-split prompt when nothing is reserved', () => {
    render(
      <DraftPreviewScreen
        visible
        onClose={jest.fn()}
        plan={makePlanWithCycleRival({
          periods: {
            morning: [],
            evening: [
              makePlannedStep({ productId: RETINOID.id, scheduledDays: [2, 6] }),
              makePlannedStep({ productId: AHA.id, scheduledDays: [1, 4] }),
            ],
          },
          reserve: [],
        })}
        diff={NO_DIFF}
        onCommit={jest.fn()}
        onAcceptCycleSplit={jest.fn()}
        onDeclineCycleSplit={jest.fn()}
      />,
    );

    expect(screen.getByText(RETINOID.name)).toBeTruthy();
    expect(screen.getByText(AHA.name)).toBeTruthy();
    expect(screen.queryByLabelText('Alternate automatically')).toBeNull();
  });
});
