/**
 * Component tests — FilterSheet.
 * Spec: docs/specs/my-shelf-filter-bottomsheet.md — Stories 1, 2, 3
 *
 * Covers:
 *   FE13-FS-1  Opening the sheet shows the previously committed selection,
 *              not hardcoded defaults (Story 1 AC3)
 *   FE13-FS-2  Reopening after an abandoned (uncommitted) edit shows the last
 *              committed state, not the abandoned draft (Story 1 AC3 + Story 2 AC4)
 *   FE13-FS-3  Product Type single-select, including explicit deselect back to "All"
 *              (Story 2 AC1)
 *   FE13-FS-7  Dismissing without tapping Apply never commits the draft (Story 2 AC5)
 *   FE13-FS-8  Clear All resets the draft without closing the sheet (Story 3 AC2)
 *   FE13-FS-9  Apply commits the draft and closes the sheet (Story 3 AC1)
 *
 * Note: the sheet's Benefits section and the live product-count in the Apply
 * button were removed — the sheet now only filters by Product Type and the
 * Apply button always reads the static "Apply Filters".
 *
 * Mock strategy: only the native/heavy boundary is mocked (@gorhom/bottom-sheet,
 * react-native-safe-area-context, @expo/vector-icons) per .claude/rules/testing.md.
 * FilterChip, Button, and the real `@/constants/labels` map are NOT mocked.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { FilterSheet } from '@/components/catalog/FilterSheet';
import { makeFilterSheetProps, makeFilterState } from './fixtures';

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
  const BottomSheetBackdrop = () => null;
  return { BottomSheetModal, BottomSheetScrollView, BottomSheetBackdrop };
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
          initialState: makeFilterState({ selectedCategory: 'moisturizer' }),
        })}
      />,
    );
    expect(screen.getByLabelText('Filter by Moisturizer').props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText('Show all products').props.accessibilityState.checked).toBe(false);
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
        })}
      />,
    );

    // Reopen.
    rerender(
      <FilterSheet
        {...makeFilterSheetProps({
          visible: true,
          initialState: makeFilterState(),
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
    render(<FilterSheet {...makeFilterSheetProps({ initialState: makeFilterState() })} />);
    fireEvent.press(screen.getByLabelText('Filter by Serum'));
    expect(screen.getByLabelText('Filter by Serum').props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText('Show all products').props.accessibilityState.checked).toBe(false);
  });

  it('should uncheck Serum and check Moisturizer when Moisturizer is pressed next (single-select)', () => {
    render(<FilterSheet {...makeFilterSheetProps({ initialState: makeFilterState() })} />);
    fireEvent.press(screen.getByLabelText('Filter by Serum'));
    fireEvent.press(screen.getByLabelText('Filter by Moisturizer'));
    expect(screen.getByLabelText('Filter by Serum').props.accessibilityState.checked).toBe(false);
    expect(screen.getByLabelText('Filter by Moisturizer').props.accessibilityState.checked).toBe(true);
  });

  it('should revert to "All" when the All chip is pressed after a type was selected', () => {
    render(<FilterSheet {...makeFilterSheetProps({ initialState: makeFilterState() })} />);
    fireEvent.press(screen.getByLabelText('Filter by Moisturizer'));
    fireEvent.press(screen.getByLabelText('Show all products'));
    expect(screen.getByLabelText('Show all products').props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText('Filter by Moisturizer').props.accessibilityState.checked).toBe(false);
  });
});

// ── FE13-FS-7: dismiss without Apply never commits ────────────────────────────

describe('FE13-FS-7: dismissing without tapping Apply never invokes onApply', () => {
  it('should not call onApply when the sheet is dismissed via backdrop after changing the draft', () => {
    const onApply = jest.fn();
    const onClose = jest.fn();
    render(
      <FilterSheet
        {...makeFilterSheetProps({ initialState: makeFilterState(), onApply, onClose })}
      />,
    );
    fireEvent.press(screen.getByLabelText('Filter by Serum'));
    pressBackdrop();

    expect(onApply).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ── FE13-FS-8: Clear All resets the draft without closing ────────────────────

describe('FE13-FS-8: Clear All resets the draft to defaults without closing the sheet', () => {
  it('should uncheck the selected Product Type chip after Clear All', () => {
    render(
      <FilterSheet
        {...makeFilterSheetProps({
          initialState: makeFilterState({ selectedCategory: 'serum' }),
        })}
      />,
    );
    fireEvent.press(screen.getByText('Clear All'));

    expect(screen.getByLabelText('Show all products').props.accessibilityState.checked).toBe(true);
  });

  it('should NOT call onClose when Clear All is pressed', () => {
    const onClose = jest.fn();
    render(
      <FilterSheet
        {...makeFilterSheetProps({
          initialState: makeFilterState({ selectedCategory: 'serum' }),
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
    render(<FilterSheet {...makeFilterSheetProps({ initialState: makeFilterState(), onApply })} />);
    fireEvent.press(screen.getByLabelText('Filter by Serum'));
    fireEvent.press(screen.getByText('Apply Filters'));

    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ selectedCategory: 'serum' }));
  });

  it('should call onClose after Apply is pressed', () => {
    const onClose = jest.fn();
    render(<FilterSheet {...makeFilterSheetProps({ initialState: makeFilterState(), onClose })} />);
    fireEvent.press(screen.getByText('Apply Filters'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
