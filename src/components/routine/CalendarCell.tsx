import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors, palette, radius } from '@/constants/tokens';

/**
 * One (product, day, period) cell in the routine calendar (img-05). Each
 * product occupies two lanes — a morning lane and an evening lane — and this
 * renders a single lane's day.
 *
 * A scheduled cell is a ringed circle carrying its period's icon: a marigold
 * sun for morning, a cobalt moon for evening. An unscheduled cell keeps the
 * circle but drops the icon and fades to a neutral ring, so scanning a row
 * reads as "icon = on, hollow = off" rather than depending on colour alone.
 *
 * Pure and memoized: a cell is a function of its props only, and a month grid
 * renders ~2 × 30 × 31 of them.
 */

export interface CalendarCellProps {
  period: 'am' | 'pm';
  scheduled: boolean;
  /** Column width. */
  size: number;
  /** Lane height — one product row stacks two of these. */
  height: number;
  /**
   * `legend` reuses the same marker outside the grid: no column separator, and
   * a testID that never inflates the grid's cell counts.
   */
  variant?: 'grid' | 'legend';
}

const AM = {
  icon: 'sun',
  color: palette.marigold,
  tint: palette.marigoldTint,
} as const;

const PM = {
  icon: 'moon',
  color: palette.cobalt,
  tint: palette.cobaltTint,
} as const;

function CalendarCellComponent({
  period,
  scheduled,
  size,
  height,
  variant = 'grid',
}: CalendarCellProps) {
  const spec = period === 'am' ? AM : PM;
  const diameter = Math.min(size, height) - 8;
  const testID =
    variant === 'legend'
      ? `calendar-legend-${scheduled ? period : 'empty'}`
      : scheduled
        ? `calendar-cell-${period}`
        : 'calendar-cell-empty';

  return (
    <View
      testID={testID}
      style={[
        styles.cell,
        variant === 'grid' && styles.cellDivider,
        { width: size, height },
      ]}
    >
      <View
        style={[
          styles.dot,
          {
            width: diameter,
            height: diameter,
            borderRadius: radius.pill,
            borderColor: scheduled ? spec.color : colors.borderStrong,
            backgroundColor: scheduled ? spec.tint : 'transparent',
          },
        ]}
      >
        {scheduled ? (
          <Feather name={spec.icon} size={Math.round(diameter * 0.55)} color={spec.color} />
        ) : null}
      </View>
    </View>
  );
}

export const CalendarCell = React.memo(CalendarCellComponent);

const styles = StyleSheet.create({
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Column separator only — the row divider is drawn by the product row, so it
  // lines up with the frozen identity column's divider.
  cellDivider: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.borderDivider,
  },
  dot: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
