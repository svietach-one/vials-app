/**
 * Integration tests — Story 2 UI ACs: Draft Preview (Diff Mode) layout and
 * the commit-scope choice.
 * Spec: docs/specs/2026-07-04-routine-engine.md §4 Story 2
 *       docs/specs/multi-action-radio-picker.md §4 Story 3
 *
 * FE-8 shipped DraftPreviewScreen + src/domain/routinePlanActions.ts
 * (progress/routine-engine.md, 2026-07-05 "GENERATION UX" entry). Heavy
 * native modules (@gorhom/bottom-sheet) are mocked at the boundary per
 * .claude/rules/testing.md and the established playbook in
 * tests/routines/routines-screen-hidden-filter.test.tsx.
 *
 * multi-action-radio-picker (FE-5) converts the bottom commit-scope footer
 * from four stacked Save-for-X/Cancel Buttons (one tap = select-and-commit)
 * to a RadioOptionGroup<PlanCommitScope> ("Morning & Evening" pre-selected,
 * "Morning Only", "Evening Only") plus a local Confirm/Cancel Button pair.
 * `onCommit`'s signature is unchanged. The blocks below that used to query
 * `getByLabelText('Save for Morning & Evening')` etc. as single-tap-commits
 * are rewritten against the new select-then-Confirm contract — the old
 * per-action labels are gone, not kept alongside the new ones (tech design
 * Assumption 5 of multi-action-radio-picker).
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import type { Product, Routine } from '@/types';
import type { RoutinePlan } from '@/utils/routineEngine/generate';
import { getSlotIndex } from '@/utils/routineEngine/slotting';
import type { PlanDiffEntry } from '@/utils/routineEngine/validate';

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

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: 'p-default',
    name: 'Product',
    brand: null,
    productType: 'serum',
    imageUrl: null,
    activeIngredients: [],
    activeTags: [],
    fullIngredientText: null,
    usageTime: 'both',
    openBeautyFactsId: null,
    addedAt: '2026-01-01',
    notes: null,
    openedDate: null,
    paoMonths: null,
    ...overrides,
  };
}

const CLEANSER = makeProduct({ id: 'p-cleanser', name: 'Gentle Cleanser' });
const VITC = makeProduct({ id: 'p-vitc', name: 'Vitamin C Serum' });
const RETINOID = makeProduct({ id: 'p-retinoid', name: 'Retinol Night Cream' });

function makePlan(overrides: Partial<RoutinePlan> = {}): RoutinePlan {
  return {
    rulesetVersion: '2026-07-04',
    generatedFor: '2026-07-04',
    periods: {
      morning: [
        { productId: CLEANSER.id, productType: 'cleanser', scheduledDays: [], slotIndex: 0, score: 0, addedAt: '2026-01-01' },
        { productId: VITC.id, productType: 'serum', scheduledDays: [], slotIndex: 5, score: 0, addedAt: '2026-01-01' },
      ],
      evening: [
        { productId: CLEANSER.id, productType: 'cleanser', scheduledDays: [], slotIndex: 0, score: 0, addedAt: '2026-01-01' },
      ],
    },
    frozen: [{ productId: RETINOID.id, reasonCode: 'peel_rehab_no_exfoliants', until: '2026-07-18', overridesPin: true }],
    reserve: [],
    placeholders: [],
    decisions: [],
    ...overrides,
  };
}

const NO_DIFF: PlanDiffEntry[] = [];

beforeEach(() => {
  mockProducts = [CLEANSER, VITC, RETINOID];
  mockRoutines = [];
});

describe('Story 2 AC: Draft Preview renders the step list with the commit-scope radio picker', () => {
  it('renders Morning/Evening step groups, the paused row, the three scope options, and Confirm/Cancel', () => {
    render(
      <DraftPreviewScreen
        visible
        onClose={jest.fn()}
        plan={makePlan()}
        diff={NO_DIFF}
        onCommit={jest.fn()}
      />,
    );

    expect(screen.getByText('Morning')).toBeTruthy();
    expect(screen.getByText('Evening')).toBeTruthy();
    // After column shows the planned products.
    expect(screen.getAllByText('Vitamin C Serum').length).toBeGreaterThan(0);
    // Paused row for the frozen (until-bearing) product.
    expect(screen.getByText(/Retinol Night Cream — paused until 2026-07-18/)).toBeTruthy();

    expect(screen.getByRole('radio', { name: 'Save for Morning & Evening' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Save for Morning only' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Save for Evening only' })).toBeTruthy();
    expect(screen.getByText('Confirm')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('pre-selects "Morning & Evening" and leaves the other two scopes unchecked', () => {
    render(
      <DraftPreviewScreen
        visible
        onClose={jest.fn()}
        plan={makePlan()}
        diff={NO_DIFF}
        onCommit={jest.fn()}
      />,
    );

    expect(
      screen.getByRole('radio', { name: 'Save for Morning & Evening' }).props.accessibilityState.checked,
    ).toBe(true);
    expect(screen.getByRole('radio', { name: 'Save for Morning only' }).props.accessibilityState.checked).toBe(
      false,
    );
    expect(screen.getByRole('radio', { name: 'Save for Evening only' }).props.accessibilityState.checked).toBe(
      false,
    );
  });

  it('caps the summary lines at 3', () => {
    render(
      <DraftPreviewScreen
        visible
        onClose={jest.fn()}
        plan={makePlan()}
        diff={NO_DIFF}
        onCommit={jest.fn()}
      />,
    );
    // buildDraftSummaryLines is unit-tested exhaustively in planApply.test.ts;
    // this just confirms the sheet never renders more rows than that cap.
    const summaryRows = screen.queryAllByText(/paused until|added|moved|Split/);
    expect(summaryRows.length).toBeLessThanOrEqual(4); // <=3 summary lines + 1 paused-block duplicate check
  });
});

describe('screen-improvements: steps are numbered in the order they are applied', () => {
  it('lists a period layering-ordered regardless of the order the plan arrays hold', () => {
    render(
      <DraftPreviewScreen
        visible
        onClose={jest.fn()}
        plan={makePlan({
          // Serum first in the array; cleanser must still render as step 1.
          periods: {
            morning: [
              { productId: VITC.id, productType: 'serum', scheduledDays: [], slotIndex: getSlotIndex('serum'), score: 0, addedAt: '2026-01-01' },
              { productId: CLEANSER.id, productType: 'cleanser', scheduledDays: [], slotIndex: getSlotIndex('cleanser'), score: 0, addedAt: '2026-01-01' },
            ],
            evening: [],
          },
        })}
        diff={NO_DIFF}
        onCommit={jest.fn()}
      />,
    );

    // Category now renders as part of the step heading ("1. Cleanser"),
    // not an isolated badge (screen-improvements: heading moved out of the
    // card, matching StepGroupHeader on the Routines screen) — the numbering
    // itself is what proves layering order, so assert heading+number together.
    expect(screen.getByText('1. Cleanser')).toBeTruthy();
    expect(screen.getByText('2. Serum')).toBeTruthy();
  });

  it('numbers each step by its position within its own period', () => {
    render(
      <DraftPreviewScreen
        visible
        onClose={jest.fn()}
        plan={makePlan()}
        diff={NO_DIFF}
        onCommit={jest.fn()}
      />,
    );

    // Morning has two steps (1, 2) and Evening restarts at 1. The heading now
    // reads "1. Cleanser" as one node (screen-improvements: moved out of the
    // card into a StepGroupHeader-style heading), so match the full text.
    expect(screen.getAllByText('1. Cleanser')).toHaveLength(2);
    expect(screen.getAllByText('2. Serum')).toHaveLength(1);
  });
});

describe('screen-improvements: each step reflects whether it changed from the saved routine', () => {
  it('tags a step "No change" when the admitted product is the same as the saved one', () => {
    mockRoutines = [
      {
        id: 'routine-am',
        name: 'Morning',
        timeOfDay: 'morning',
        steps: [{ id: 's1', productType: 'cleanser', productId: CLEANSER.id, hidden: false, scheduledDays: [] }],
      },
    ];
    render(
      <DraftPreviewScreen
        visible
        onClose={jest.fn()}
        plan={makePlan({
          periods: {
            morning: [
              { productId: CLEANSER.id, productType: 'cleanser', scheduledDays: [], slotIndex: getSlotIndex('cleanser'), score: 0, addedAt: '2026-01-01' },
            ],
            evening: [],
          },
        })}
        diff={NO_DIFF}
        onCommit={jest.fn()}
      />,
    );

    expect(screen.getByText('Gentle Cleanser')).toBeTruthy();
    expect(screen.getByText('No change')).toBeTruthy();
  });

  it('shows the old product struck through above the new one when the slot changed', () => {
    mockRoutines = [
      {
        id: 'routine-am',
        name: 'Morning',
        timeOfDay: 'morning',
        steps: [{ id: 's1', productType: 'serum', productId: RETINOID.id, hidden: false, scheduledDays: [] }],
      },
    ];
    render(
      <DraftPreviewScreen
        visible
        onClose={jest.fn()}
        plan={makePlan({
          periods: {
            morning: [
              { productId: VITC.id, productType: 'serum', scheduledDays: [], slotIndex: getSlotIndex('serum'), score: 0, addedAt: '2026-01-01' },
            ],
            evening: [],
          },
        })}
        diff={NO_DIFF}
        onCommit={jest.fn()}
      />,
    );

    expect(screen.getByText('Retinol Night Cream')).toBeTruthy();
    expect(screen.getByText('Vitamin C Serum')).toBeTruthy();
    expect(screen.queryByText('No change')).toBeNull();
  });
});

describe('Story 2 / multi-action-radio-picker Story 3: selecting a scope alone never commits', () => {
  it('only moves which radio option is checked; onCommit has not fired yet', () => {
    const onCommit = jest.fn();
    render(<DraftPreviewScreen visible onClose={jest.fn()} plan={makePlan()} diff={NO_DIFF} onCommit={onCommit} />);

    fireEvent.press(screen.getByRole('radio', { name: 'Save for Evening only' }));

    expect(screen.getByRole('radio', { name: 'Save for Evening only' }).props.accessibilityState.checked).toBe(
      true,
    );
    expect(
      screen.getByRole('radio', { name: 'Save for Morning & Evening' }).props.accessibilityState.checked,
    ).toBe(false);
    expect(onCommit).not.toHaveBeenCalled();
  });
});

describe('Story 2 / multi-action-radio-picker Story 3: Confirm commits the currently selected scope', () => {
  it('confirming without changing the default selection commits scope "both"', () => {
    const onCommit = jest.fn();
    render(<DraftPreviewScreen visible onClose={jest.fn()} plan={makePlan()} diff={NO_DIFF} onCommit={onCommit} />);
    fireEvent.press(screen.getByText('Confirm'));
    expect(onCommit).toHaveBeenCalledWith('both');
  });

  it('selecting "Morning Only" then confirming commits scope "am"', () => {
    const onCommit = jest.fn();
    render(<DraftPreviewScreen visible onClose={jest.fn()} plan={makePlan()} diff={NO_DIFF} onCommit={onCommit} />);
    fireEvent.press(screen.getByRole('radio', { name: 'Save for Morning only' }));
    fireEvent.press(screen.getByText('Confirm'));
    expect(onCommit).toHaveBeenCalledWith('am');
  });

  it('selecting "Evening Only" then confirming commits scope "pm"', () => {
    const onCommit = jest.fn();
    render(<DraftPreviewScreen visible onClose={jest.fn()} plan={makePlan()} diff={NO_DIFF} onCommit={onCommit} />);
    fireEvent.press(screen.getByRole('radio', { name: 'Save for Evening only' }));
    fireEvent.press(screen.getByText('Confirm'));
    expect(onCommit).toHaveBeenCalledWith('pm');
  });

  it('"Cancel" never calls onCommit, only onClose — same behavior as today\'s Cancel / Discard Draft', () => {
    const onCommit = jest.fn();
    const onClose = jest.fn();
    render(<DraftPreviewScreen visible onClose={onClose} plan={makePlan()} diff={NO_DIFF} onCommit={onCommit} />);
    fireEvent.press(screen.getByText('Cancel'));
    expect(onCommit).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('"Cancel" after changing the selection still never calls onCommit', () => {
    const onCommit = jest.fn();
    const onClose = jest.fn();
    render(<DraftPreviewScreen visible onClose={onClose} plan={makePlan()} diff={NO_DIFF} onCommit={onCommit} />);
    fireEvent.press(screen.getByRole('radio', { name: 'Save for Morning only' }));
    fireEvent.press(screen.getByText('Cancel'));
    expect(onCommit).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

describe('screen-improvements: the reserve list is a collapsed-by-default disclosure', () => {
  it('explains the whole list once under the heading instead of per product', () => {
    render(
      <DraftPreviewScreen
        visible
        onClose={jest.fn()}
        plan={makePlan({
          periods: { morning: [], evening: [] },
          reserve: [
            { productId: VITC.id, reasonCode: 'not_needed_for_goals' },
            { productId: RETINOID.id, reasonCode: 'not_needed_for_goals' },
          ],
        })}
        diff={NO_DIFF}
        onCommit={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByText('In reserve · 2 products'));

    expect(screen.getByText(/don’t call for these products/)).toBeTruthy();
    // The per-product repetition of the same sentence is gone.
    expect(screen.queryByText(/don’t call for this product/)).toBeNull();
  });

  it('keeps a reason on the row when it says something the shared intro does not', () => {
    render(
      <DraftPreviewScreen
        visible
        onClose={jest.fn()}
        plan={makePlan({
          periods: { morning: [], evening: [] },
          reserve: [
            { productId: VITC.id, reasonCode: 'not_needed_for_goals' },
            { productId: RETINOID.id, reasonCode: 'duplicate_function' },
          ],
        })}
        diff={NO_DIFF}
        onCommit={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByText('In reserve · 2 products'));

    expect(screen.getByText(/Another product already covers this role/)).toBeTruthy();
  });

  it('starts collapsed, showing only the heading with a product count', () => {
    render(
      <DraftPreviewScreen
        visible
        onClose={jest.fn()}
        plan={makePlan({
          periods: { morning: [], evening: [] },
          reserve: [{ productId: VITC.id, reasonCode: 'not_needed_for_goals' }],
        })}
        diff={NO_DIFF}
        onCommit={jest.fn()}
      />,
    );

    expect(screen.getByText('In reserve · 1 product')).toBeTruthy();
    expect(screen.queryByText('Vitamin C Serum')).toBeNull();
  });

  it('expands to show the reserved products themselves when tapped', () => {
    render(
      <DraftPreviewScreen
        visible
        onClose={jest.fn()}
        plan={makePlan({
          periods: { morning: [], evening: [] },
          reserve: [{ productId: VITC.id, reasonCode: 'not_needed_for_goals' }],
        })}
        diff={NO_DIFF}
        onCommit={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByText('In reserve · 1 product'));

    expect(screen.getByText('Vitamin C Serum')).toBeTruthy();
  });
});

describe('phase-07: reserve rows show the reason and an override action', () => {
  it('shows a frozen pair-rule product with its reason text (not a rule id)', () => {
    render(
      <DraftPreviewScreen
        visible
        onClose={jest.fn()}
        plan={makePlan({
          frozen: [{ productId: RETINOID.id, reasonCode: 'retinoid_acid_conflict', ruleId: 'rule_retinol_aha', overridesPin: false }],
        })}
        diff={NO_DIFF}
        onCommit={jest.fn()}
      />,
    );

    expect(screen.getByText(/Retinoids and exfoliating acids/)).toBeTruthy();
    expect(screen.queryByText(/rule_retinol_aha/)).toBeNull();
  });

  it('fires onOverride with the product id when "Add anyway" is tapped', () => {
    const onOverride = jest.fn();
    render(
      <DraftPreviewScreen
        visible
        onClose={jest.fn()}
        plan={makePlan({ reserve: [{ productId: VITC.id, reasonCode: 'cumulative_active_cap' }] })}
        diff={NO_DIFF}
        onCommit={jest.fn()}
        onOverride={onOverride}
      />,
    );

    fireEvent.press(screen.getByText('In reserve · 1 product'));
    fireEvent.press(screen.getByLabelText('Add Vitamin C Serum anyway'));
    expect(onOverride).toHaveBeenCalledWith(VITC.id);
  });

  it('omits the override action when onOverride is not provided', () => {
    render(
      <DraftPreviewScreen
        visible
        onClose={jest.fn()}
        plan={makePlan({ reserve: [{ productId: VITC.id, reasonCode: 'not_needed_for_goals' }] })}
        diff={NO_DIFF}
        onCommit={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByText('In reserve · 1 product'));
    expect(screen.queryByLabelText('Add Vitamin C Serum anyway')).toBeNull();
  });
});

describe('Reset all option in the commit footer', () => {
  const SAVED_ROUTINE: Routine[] = [
    {
      id: 'routine-am',
      name: 'Morning',
      timeOfDay: 'morning',
      steps: [{ id: 's1', productType: 'cleanser', productId: CLEANSER.id, hidden: false, scheduledDays: [] }],
    },
  ];

  function renderFooter(props: Partial<React.ComponentProps<typeof DraftPreviewScreen>> = {}) {
    const onCommit = jest.fn();
    const onResetAll = jest.fn();
    render(
      <DraftPreviewScreen
        visible
        onClose={jest.fn()}
        plan={makePlan()}
        diff={NO_DIFF}
        onCommit={onCommit}
        onResetAll={onResetAll}
        {...props}
      />,
    );
    return { onCommit, onResetAll };
  }

  it('titles the footer "Select an option" and offers Reset all when a routine has steps', () => {
    mockRoutines = SAVED_ROUTINE;
    renderFooter();

    expect(screen.getByText('Select an option')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Reset all' })).toBeTruthy();
  });

  it('hides Reset all when no routine has any step', () => {
    mockRoutines = [];
    renderFooter();

    expect(screen.queryByRole('radio', { name: 'Reset all' })).toBeNull();
  });

  it('calls onResetAll, not onCommit, when Reset all is selected and confirmed', () => {
    mockRoutines = SAVED_ROUTINE;
    const { onCommit, onResetAll } = renderFooter();

    fireEvent.press(screen.getByRole('radio', { name: 'Reset all' }));
    fireEvent.press(screen.getByText('Confirm'));

    expect(onResetAll).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('still commits the default scope when Reset all is not chosen', () => {
    mockRoutines = SAVED_ROUTINE;
    const { onCommit, onResetAll } = renderFooter();

    fireEvent.press(screen.getByText('Confirm'));

    expect(onCommit).toHaveBeenCalledWith('both');
    expect(onResetAll).not.toHaveBeenCalled();
  });
});
