/**
 * Integration tests — Story 2 UI ACs: Draft Preview (Diff Mode) layout and
 * the four-way commit scope.
 * Spec: docs/specs/2026-07-04-routine-engine.md §4 Story 2
 *
 * FE-8 shipped DraftPreviewSheet + src/domain/routinePlanActions.ts
 * (progress/routine-engine.md, 2026-07-05 "GENERATION UX" entry). Heavy
 * native modules (@gorhom/bottom-sheet) are mocked at the boundary per
 * .claude/rules/testing.md and the established playbook in
 * tests/routines/routines-screen-hidden-filter.test.tsx.
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

import { DraftPreviewSheet } from '@/components/routine/DraftPreviewSheet';

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
    frozen: [{ productId: RETINOID.id, reasonCode: 'peel_rehab_no_exfoliants', until: '2026-07-18' }],
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

describe('Story 2 AC: Draft Preview renders the step list with the four commit actions', () => {
  it('renders Morning/Evening step groups, the paused row, and all four scope actions', () => {
    render(
      <DraftPreviewSheet
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

    expect(screen.getByLabelText('Save for Morning & Evening')).toBeTruthy();
    expect(screen.getByLabelText('Save for Morning Only')).toBeTruthy();
    expect(screen.getByLabelText('Save for Evening Only')).toBeTruthy();
    expect(screen.getByLabelText('Cancel and discard draft')).toBeTruthy();
  });

  it('caps the summary lines at 3', () => {
    render(
      <DraftPreviewSheet
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
      <DraftPreviewSheet
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
      <DraftPreviewSheet
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

describe('Story 2 AC: each commit action invokes onCommit with the correct scope', () => {
  it('"Save for Morning & Evening" commits scope "both"', () => {
    const onCommit = jest.fn();
    render(<DraftPreviewSheet visible onClose={jest.fn()} plan={makePlan()} diff={NO_DIFF} onCommit={onCommit} />);
    fireEvent.press(screen.getByLabelText('Save for Morning & Evening'));
    expect(onCommit).toHaveBeenCalledWith('both');
  });

  it('"Save for Morning Only" commits scope "am"', () => {
    const onCommit = jest.fn();
    render(<DraftPreviewSheet visible onClose={jest.fn()} plan={makePlan()} diff={NO_DIFF} onCommit={onCommit} />);
    fireEvent.press(screen.getByLabelText('Save for Morning Only'));
    expect(onCommit).toHaveBeenCalledWith('am');
  });

  it('"Save for Evening Only" commits scope "pm"', () => {
    const onCommit = jest.fn();
    render(<DraftPreviewSheet visible onClose={jest.fn()} plan={makePlan()} diff={NO_DIFF} onCommit={onCommit} />);
    fireEvent.press(screen.getByLabelText('Save for Evening Only'));
    expect(onCommit).toHaveBeenCalledWith('pm');
  });

  it('"Cancel / Discard Draft" never calls onCommit, only onClose', () => {
    const onCommit = jest.fn();
    const onClose = jest.fn();
    render(<DraftPreviewSheet visible onClose={onClose} plan={makePlan()} diff={NO_DIFF} onCommit={onCommit} />);
    fireEvent.press(screen.getByLabelText('Cancel and discard draft'));
    expect(onCommit).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

describe('screen-improvements: the reserve list is a collapsed-by-default disclosure', () => {
  it('starts collapsed, showing only the heading with a product count', () => {
    render(
      <DraftPreviewSheet
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

  it('expands to show reserved products and their reason text when tapped', () => {
    render(
      <DraftPreviewSheet
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
    // The dictionary text, not the raw code.
    expect(screen.getByText(/don’t call for this product/)).toBeTruthy();
  });
});

describe('phase-07: reserve rows show the reason and an override action', () => {
  it('shows a frozen pair-rule product with its reason text (not a rule id)', () => {
    render(
      <DraftPreviewSheet
        visible
        onClose={jest.fn()}
        plan={makePlan({
          frozen: [{ productId: RETINOID.id, reasonCode: 'retinoid_acid_conflict', ruleId: 'rule_retinol_aha' }],
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
      <DraftPreviewSheet
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
      <DraftPreviewSheet
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
