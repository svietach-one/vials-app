/**
 * Component tests — FilterSheet (FE-13-5, not yet implemented).
 * Spec: docs/specs/my-shelf-filter-bottomsheet.md — Stories 1, 2, 3
 * Tech design: docs/tech-design/my-shelf-filter-bottomsheet.md §1, §2, §3 (FE-13-5)
 *
 * Covers:
 *   FE13-FS-1  Opening the sheet shows the previously committed selection,
 *              not hardcoded defaults (Story 1 AC3)
 *   FE13-FS-2  Reopening after an abandoned (uncommitted) edit shows the last
 *              committed state, not the abandoned draft (Story 1 AC3 + Story 2 AC4)
 *   FE13-FS-3  Product Type single-select, including explicit deselect back to "All"
 *              (Story 2 AC1)
 *   FE13-FS-4  Functional Benefit multi-select toggle, independent of Product Type
 *              (Story 2 AC2)
 *   FE13-FS-5  Live count in the Apply button updates immediately per selection,
 *              before Apply is tapped (Story 2 AC4 first half)
 *   FE13-FS-6  Multiple selected benefits combine with AND semantics, not OR
 *              (Story 2 AC3 — preserves applyFilters's Gate 3)
 *   FE13-FS-7  Dismissing without tapping Apply never commits the draft (Story 2 AC5)
 *   FE13-FS-8  Clear All resets the draft without closing the sheet (Story 3 AC2)
 *   FE13-FS-9  Apply commits the draft and closes the sheet (Story 3 AC1)
 *   FE13-FS-10 Empty-result draft still renders an enabled, pressable Apply button
 *              showing "(0 products)" (spec §5 States)
 *
 * Mock strategy: only the native/heavy boundary is mocked (@gorhom/bottom-sheet,
 * react-native-safe-area-context, @expo/vector-icons) per .claude/rules/testing.md.
 * FilterChip, Button, and the real `@/constants/labels` map are NOT mocked, so
 * these tests double as a regression guard on FE-13-2's ingredient->benefit map.
 *
 * Until FE-13-5 lands, the `FilterSheet` import fails with "Cannot find module" —
 * expected TDD red state, see progress/my-shelf-filter-bottomsheet.md.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { FilterSheet } from '@/components/catalog/FilterSheet';
import {
  BENEFIT_COVERAGE_PRODUCTS,
  makeFilterSheetProps,
  makeFilterState,
} from './fixtures';

// Defensive: FilterSheet's live count is spec'd as `applyFilters(products, draftState)`
// (tech design FE-13-5), and `applyFilters` is a module-level export of
// `src/screens/CatalogScreen.tsx` (FE-13-3) — if the engineer imports it from
// there, that module's import chain touches `@/store/productsStore`, which
// reads AsyncStorage on hydrate(). This mock is a no-op safety net so that
// path can't fail this file even though FilterSheet's own props never need a store.
jest.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve()),
  },
  __esModule: true,
}));

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
  const { View, Pressable } = require('react-native');
  const BottomSheetModal = ReactActual.forwardRef(
    (
      { children, onDismiss }: { children: React.ReactNode; onDismiss?: () => void },
      ref: React.Ref<unknown>,
    ) => {
      ReactActual.useImperativeHandle(ref, () => ({
        present: () => {},
        dismiss: () => onDismiss?.(),
      }));
      return (
        <View>
          {/* Test-only affordance standing in for a real swipe-down / backdrop
              tap — both funnel into the sheet's onDismiss callback in the
              real @gorhom/bottom-sheet runtime. */}
          <Pressable testID="mock-bottom-sheet-backdrop" onPress={() => onDismiss?.()} />
          {children}
        </View>
      );
    },
  );
  const BottomSheetScrollView = ({ children }: { children: React.ReactNode }) => <View>{children}</View>;
  const BottomSheetFlatList = ({ data, renderItem, ListEmptyComponent }: any) => (
    <View>
      {data && data.length > 0
        ? data.map((item: any, index: number) => <View key={index}>{renderItem({ item, index })}</View>)
        : ListEmptyComponent}
    </View>
  );
  const BottomSheetBackdrop = () => null;
  return { BottomSheetModal, BottomSheetScrollView, BottomSheetFlatList, BottomSheetBackdrop };
});

function pressBackdrop() {
  fireEvent.press(screen.getByTestId('mock-bottom-sheet-backdrop'));
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── FE13-FS-1: opening shows committed state, not defaults ───────────────────

describe('FE13-FS-1: opening the sheet shows the previously committed selection, not hardcoded defaults', () => {
  it('should mark the committed Product Type chip as checked and "All" as unchecked', () => {
    render(
      <FilterSheet
        {...makeFilterSheetProps({
          initialState: makeFilterState({ selectedCategory: 'moisturizer', selectedBenefits: ['hydration'] }),
          products: BENEFIT_COVERAGE_PRODUCTS,
        })}
      />,
    );
    expect(screen.getByLabelText('Filter by Moisturizer').props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText('Show all products').props.accessibilityState.checked).toBe(false);
  });

  it('should mark the committed Functional Benefit chip as checked', () => {
    render(
      <FilterSheet
        {...makeFilterSheetProps({
          initialState: makeFilterState({ selectedCategory: 'moisturizer', selectedBenefits: ['hydration'] }),
          products: BENEFIT_COVERAGE_PRODUCTS,
        })}
      />,
    );
    expect(screen.getByLabelText('Filter by Hydration').props.accessibilityState.checked).toBe(true);
  });
});

// ── FE13-FS-2: reopening discards an abandoned draft ──────────────────────────

describe('FE13-FS-2: reopening after an abandoned edit shows the last committed state, not the abandoned draft', () => {
  it('should revert an uncommitted Product Type selection after a close/reopen cycle', () => {
    const { rerender } = render(
      <FilterSheet
        {...makeFilterSheetProps({
          visible: true,
          initialState: makeFilterState(),
          products: BENEFIT_COVERAGE_PRODUCTS,
        })}
      />,
    );

    // Abandon an edit: select Moisturizer but never tap Apply.
    fireEvent.press(screen.getByLabelText('Filter by Moisturizer'));
    expect(screen.getByLabelText('Filter by Moisturizer').props.accessibilityState.checked).toBe(true);

    // Close without applying (initialState is unchanged, since only Apply commits it).
    rerender(
      <FilterSheet
        {...makeFilterSheetProps({
          visible: false,
          initialState: makeFilterState(),
          products: BENEFIT_COVERAGE_PRODUCTS,
        })}
      />,
    );

    // Reopen.
    rerender(
      <FilterSheet
        {...makeFilterSheetProps({
          visible: true,
          initialState: makeFilterState(),
          products: BENEFIT_COVERAGE_PRODUCTS,
        })}
      />,
    );

    expect(screen.getByLabelText('Show all products').props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText('Filter by Moisturizer').props.accessibilityState.checked).toBe(false);
  });
});

// ── FE13-FS-3: Product Type single-select ─────────────────────────────────────

describe('FE13-FS-3: Product Type renders as a single-select group, including explicit deselect back to "All"', () => {
  it('should check Serum and uncheck All when Serum is pressed', () => {
    render(
      <FilterSheet {...makeFilterSheetProps({ initialState: makeFilterState(), products: BENEFIT_COVERAGE_PRODUCTS })} />,
    );
    fireEvent.press(screen.getByLabelText('Filter by Serum'));
    expect(screen.getByLabelText('Filter by Serum').props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText('Show all products').props.accessibilityState.checked).toBe(false);
  });

  it('should uncheck Serum and check Moisturizer when Moisturizer is pressed next (single-select)', () => {
    render(
      <FilterSheet {...makeFilterSheetProps({ initialState: makeFilterState(), products: BENEFIT_COVERAGE_PRODUCTS })} />,
    );
    fireEvent.press(screen.getByLabelText('Filter by Serum'));
    fireEvent.press(screen.getByLabelText('Filter by Moisturizer'));
    expect(screen.getByLabelText('Filter by Serum').props.accessibilityState.checked).toBe(false);
    expect(screen.getByLabelText('Filter by Moisturizer').props.accessibilityState.checked).toBe(true);
  });

  it('should revert to "All" when the All chip is pressed after a type was selected', () => {
    render(
      <FilterSheet {...makeFilterSheetProps({ initialState: makeFilterState(), products: BENEFIT_COVERAGE_PRODUCTS })} />,
    );
    fireEvent.press(screen.getByLabelText('Filter by Moisturizer'));
    fireEvent.press(screen.getByLabelText('Show all products'));
    expect(screen.getByLabelText('Show all products').props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText('Filter by Moisturizer').props.accessibilityState.checked).toBe(false);
  });
});

// ── FE13-FS-4: Functional Benefit multi-select ────────────────────────────────

describe('FE13-FS-4: Functional Benefit renders as a multi-select group, independent of Product Type', () => {
  it('should accumulate multiple selected benefits without affecting the Product Type selection', () => {
    render(
      <FilterSheet {...makeFilterSheetProps({ initialState: makeFilterState(), products: BENEFIT_COVERAGE_PRODUCTS })} />,
    );
    fireEvent.press(screen.getByLabelText('Filter by Serum'));
    fireEvent.press(screen.getByLabelText('Filter by Exfoliation'));
    fireEvent.press(screen.getByLabelText('Filter by Soothing'));

    expect(screen.getByLabelText('Filter by Exfoliation').props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText('Filter by Soothing').props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText('Filter by Serum').props.accessibilityState.checked).toBe(true);
  });

  it('should toggle a benefit back off when pressed a second time, leaving the other selected benefit intact', () => {
    render(
      <FilterSheet {...makeFilterSheetProps({ initialState: makeFilterState(), products: BENEFIT_COVERAGE_PRODUCTS })} />,
    );
    fireEvent.press(screen.getByLabelText('Filter by Exfoliation'));
    fireEvent.press(screen.getByLabelText('Filter by Soothing'));
    fireEvent.press(screen.getByLabelText('Filter by Exfoliation'));

    expect(screen.getByLabelText('Filter by Exfoliation').props.accessibilityState.checked).toBe(false);
    expect(screen.getByLabelText('Filter by Soothing').props.accessibilityState.checked).toBe(true);
  });
});

// ── FE13-FS-5: live count updates before Apply is tapped ──────────────────────

describe('FE13-FS-5: the Apply button live count updates immediately per selection, before Apply is tapped', () => {
  it('should show the full catalog count with no selections', () => {
    render(
      <FilterSheet {...makeFilterSheetProps({ initialState: makeFilterState(), products: BENEFIT_COVERAGE_PRODUCTS })} />,
    );
    expect(screen.getByText('Apply Filters (6 products)')).toBeTruthy();
  });

  it('should recompute the count after selecting a Product Type, without any Apply tap', () => {
    const onApply = jest.fn();
    render(
      <FilterSheet
        {...makeFilterSheetProps({ initialState: makeFilterState(), products: BENEFIT_COVERAGE_PRODUCTS, onApply })}
      />,
    );
    fireEvent.press(screen.getByLabelText('Filter by Serum'));
    expect(screen.getByText('Apply Filters (2 products)')).toBeTruthy();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('should recompute the count again after also selecting a benefit, without any Apply tap', () => {
    const onApply = jest.fn();
    render(
      <FilterSheet
        {...makeFilterSheetProps({ initialState: makeFilterState(), products: BENEFIT_COVERAGE_PRODUCTS, onApply })}
      />,
    );
    fireEvent.press(screen.getByLabelText('Filter by Serum'));
    fireEvent.press(screen.getByLabelText('Filter by Exfoliation'));
    expect(screen.getByText('Apply Filters (1 products)')).toBeTruthy();
    expect(onApply).not.toHaveBeenCalled();
  });
});

// ── FE13-FS-6: AND semantics across multiple selected benefits ───────────────

describe('FE13-FS-6: selecting more than one benefit combines them with AND semantics, not OR', () => {
  it('should count 0 products when two selected benefits are each matched by a different, non-overlapping product', () => {
    // Exfoliation matches only RETINOID_SERUM; Barrier Repair matches only
    // COPPER_PEPTIDE_CLEANSER. Under OR semantics the count would be 2;
    // under the required AND semantics it must be 0.
    render(
      <FilterSheet {...makeFilterSheetProps({ initialState: makeFilterState(), products: BENEFIT_COVERAGE_PRODUCTS })} />,
    );
    fireEvent.press(screen.getByLabelText('Filter by Exfoliation'));
    fireEvent.press(screen.getByLabelText('Filter by Barrier Repair'));
    expect(screen.getByText('Apply Filters (0 products)')).toBeTruthy();
  });

  it('should count 1 product when a single product satisfies both selected benefits (niacinamide: soothing + brightening)', () => {
    render(
      <FilterSheet {...makeFilterSheetProps({ initialState: makeFilterState(), products: BENEFIT_COVERAGE_PRODUCTS })} />,
    );
    fireEvent.press(screen.getByLabelText('Filter by Soothing'));
    fireEvent.press(screen.getByLabelText('Filter by Brightening'));
    expect(screen.getByText('Apply Filters (1 products)')).toBeTruthy();
  });
});

// ── FE13-FS-7: dismiss without Apply never commits ────────────────────────────

describe('FE13-FS-7: dismissing without tapping Apply never invokes onApply', () => {
  it('should not call onApply when the sheet is dismissed via backdrop after changing the draft', () => {
    const onApply = jest.fn();
    const onClose = jest.fn();
    render(
      <FilterSheet
        {...makeFilterSheetProps({ initialState: makeFilterState(), products: BENEFIT_COVERAGE_PRODUCTS, onApply, onClose })}
      />,
    );
    fireEvent.press(screen.getByLabelText('Filter by Serum'));
    fireEvent.press(screen.getByLabelText('Filter by Exfoliation'));
    pressBackdrop();

    expect(onApply).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ── FE13-FS-8: Clear All resets the draft without closing ────────────────────

describe('FE13-FS-8: Clear All resets the draft to defaults without closing the sheet', () => {
  it('should uncheck the selected Product Type and Functional Benefit chips after Clear All', () => {
    render(
      <FilterSheet
        {...makeFilterSheetProps({
          initialState: makeFilterState({ selectedCategory: 'serum', selectedBenefits: ['exfoliation'] }),
          products: BENEFIT_COVERAGE_PRODUCTS,
        })}
      />,
    );
    fireEvent.press(screen.getByText('Clear All'));

    expect(screen.getByLabelText('Show all products').props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText('Filter by Exfoliation').props.accessibilityState.checked).toBe(false);
  });

  it('should restore the full catalog count in the Apply button after Clear All', () => {
    render(
      <FilterSheet
        {...makeFilterSheetProps({
          initialState: makeFilterState({ selectedCategory: 'serum', selectedBenefits: ['exfoliation'] }),
          products: BENEFIT_COVERAGE_PRODUCTS,
        })}
      />,
    );
    fireEvent.press(screen.getByText('Clear All'));
    expect(screen.getByText('Apply Filters (6 products)')).toBeTruthy();
  });

  it('should NOT call onClose when Clear All is pressed', () => {
    const onClose = jest.fn();
    render(
      <FilterSheet
        {...makeFilterSheetProps({
          initialState: makeFilterState({ selectedCategory: 'serum' }),
          products: BENEFIT_COVERAGE_PRODUCTS,
          onClose,
        })}
      />,
    );
    fireEvent.press(screen.getByText('Clear All'));
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ── FE13-FS-9: Apply commits and closes ───────────────────────────────────────

describe('FE13-FS-9: Apply Filters commits the current draft and closes the sheet', () => {
  it('should call onApply with the current draft selection', () => {
    const onApply = jest.fn();
    render(
      <FilterSheet
        {...makeFilterSheetProps({ initialState: makeFilterState(), products: BENEFIT_COVERAGE_PRODUCTS, onApply })}
      />,
    );
    fireEvent.press(screen.getByLabelText('Filter by Serum'));
    fireEvent.press(screen.getByLabelText('Filter by Exfoliation'));
    fireEvent.press(screen.getByText('Apply Filters (1 products)'));

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ selectedCategory: 'serum', selectedBenefits: ['exfoliation'] }),
    );
  });

  it('should call onClose after Apply is pressed', () => {
    const onClose = jest.fn();
    render(
      <FilterSheet
        {...makeFilterSheetProps({ initialState: makeFilterState(), products: BENEFIT_COVERAGE_PRODUCTS, onClose })}
      />,
    );
    fireEvent.press(screen.getByText('Apply Filters (6 products)'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ── FE13-FS-10: empty-result draft still allows Apply ─────────────────────────

describe('FE13-FS-10: a draft selection matching zero products still renders an enabled Apply button', () => {
  it('should show "Apply Filters (0 products)" when the combination matches nothing', () => {
    render(
      <FilterSheet {...makeFilterSheetProps({ initialState: makeFilterState(), products: BENEFIT_COVERAGE_PRODUCTS })} />,
    );
    fireEvent.press(screen.getByLabelText('Filter by SPF'));
    fireEvent.press(screen.getByLabelText('Filter by Exfoliation'));
    expect(screen.getByText('Apply Filters (0 products)')).toBeTruthy();
  });

  it('should still call onApply when Apply is pressed on a zero-match draft', () => {
    const onApply = jest.fn();
    render(
      <FilterSheet
        {...makeFilterSheetProps({ initialState: makeFilterState(), products: BENEFIT_COVERAGE_PRODUCTS, onApply })}
      />,
    );
    fireEvent.press(screen.getByLabelText('Filter by SPF'));
    fireEvent.press(screen.getByLabelText('Filter by Exfoliation'));
    fireEvent.press(screen.getByText('Apply Filters (0 products)'));
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ selectedCategory: 'spf', selectedBenefits: ['exfoliation'] }),
    );
  });
});
