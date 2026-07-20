import React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, palette } from '@/constants/tokens';
import type { CalendarCellState } from '@/utils/calendarMatrix';

/**
 * One (product, day) cell in the routine calendar (img-05). A square split by a
 * diagonal running top-right → bottom-left: the upper-left triangle is AM, the
 * lower-right is PM. A half is filled when that period is scheduled.
 *
 * Both halves use Cobalt — the palette's informational/calendar colour. AM and
 * PM are told apart by position, never by colour, so the grid carries no
 * accidental warning/safe semantics.
 *
 * Pure and memoized: a cell is a function of (state, size) only, and a month
 * grid renders ~30 × 31 of them.
 */

export interface CalendarCellProps {
  state: CalendarCellState;
  size: number;
}

function CalendarCellComponent({ state, size }: CalendarCellProps) {
  const { am, pm } = state;
  const isEmpty = !am && !pm;
  const testID = isEmpty ? 'calendar-cell-empty' : `calendar-cell-${am ? 'am' : ''}${pm ? 'pm' : ''}`;

  return (
    <View testID={testID} style={[styles.cell, { width: size, height: size }]}>
      {/* An entirely unscheduled cell stays a plain bordered square — no
          diagonal, so empty regions of the grid read as quiet space. */}
      {isEmpty ? null : (
        <>
          {am ? (
            <View
              style={[
                styles.triangle,
                {
                  borderTopWidth: size,
                  borderRightWidth: size,
                  borderTopColor: palette.cobalt,
                },
              ]}
            />
          ) : null}
          {pm ? (
            <View
              style={[
                styles.triangle,
                {
                  borderBottomWidth: size,
                  borderLeftWidth: size,
                  borderBottomColor: palette.cobalt,
                },
              ]}
            />
          ) : null}
        </>
      )}
    </View>
  );
}

export const CalendarCell = React.memo(CalendarCellComponent);

const styles = StyleSheet.create({
  cell: {
    // Column separator only — the row divider is drawn by the row itself, so
    // it lines up with the frozen identity column's divider.
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderDivider,
    overflow: 'hidden',
  },
  /**
   * CSS triangle technique: a zero-size box whose borders collapse into a
   * right triangle. top+right fills the upper-left half; bottom+left fills the
   * lower-right half. Cheaper and crisper on both platforms than an SVG or a
   * rotated/transformed view.
   */
  triangle: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    borderColor: 'transparent',
  },
});
