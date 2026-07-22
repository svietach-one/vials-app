import React, { useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { CalendarCell } from '@/components/routine/CalendarCell';
import { Button } from '@/components/ui/core/Button';
import { ProductThumbnail } from '@/components/ui/ProductThumbnail';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import type { Product, Routine } from '@/types';
import { buildCalendarMatrix, type CalendarRow } from '@/utils/calendarMatrix';

/**
 * Read-only month overview of the routine (img-05). Rows are products, columns
 * are days; every product row stacks two lanes — a morning lane of sun icons
 * above an evening lane of moon icons — so AM and PM are read by icon rather
 * than by which half of a cell is filled.
 *
 * **Frozen first column without scroll syncing.** React Native has no sticky
 * columns, and the usual workaround (two vertical ScrollViews kept in step via
 * onScroll → scrollTo) jitters. Instead the whole grid lives in ONE vertical
 * ScrollView, and only the day columns sit inside a horizontal ScrollView:
 * vertical scrolling therefore moves both sides because they are the same
 * scroll container, and horizontal scrolling moves only the days. No
 * synchronisation code exists to drift.
 */

const CELL_SIZE = 36;
const LANE_HEIGHT = 34;
const ROW_HEIGHT = LANE_HEIGHT * 2;
const IDENTITY_WIDTH = 148;
const HEADER_HEIGHT = 44;
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export interface RoutineCalendarViewProps {
  routines: Routine[];
  products: Product[];
  /** Opens the same action sheet the list view uses. */
  onProductPress: (product: Product) => void;
  /** Add-product entry point for the empty state. */
  onAddProduct: () => void;
  /** Injected for tests; defaults to the real clock. */
  now?: Date;
}

export function RoutineCalendarView({
  routines,
  products,
  onProductPress,
  onAddProduct,
  now = new Date(),
}: RoutineCalendarViewProps) {
  const matrix = useMemo(
    () => buildCalendarMatrix(routines, products, now),
    [routines, products, now],
  );

  const isCurrentMonth =
    now.getFullYear() === matrix.year && now.getMonth() === matrix.month;
  const todayIndex = isCurrentMonth ? now.getDate() - 1 : -1;

  const scrollRef = useRef<ScrollView>(null);

  // Bring today into view on mount, sitting roughly a third in from the left
  // rather than flush against the edge.
  function handleGridLayout() {
    if (todayIndex < 0) return;
    const offset = Math.max(0, (todayIndex - 2) * CELL_SIZE);
    scrollRef.current?.scrollTo({ x: offset, animated: false });
  }

  if (matrix.rows.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Feather name="calendar" size={28} color={colors.textTertiary} />
        <Text style={styles.emptyText}>No products scheduled this month.</Text>
        <Button variant="textActive" size="sm" onPress={onAddProduct} accessibilityLabel="Add product to routine">
          Add product
        </Button>
      </View>
    );
  }

  const days = Array.from({ length: matrix.daysInMonth }, (_, i) => i);

  return (
    <View style={styles.container}>
      <Text style={styles.monthLabel}>
        {MONTH_NAMES[matrix.month]} {matrix.year}
      </Text>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {/* Frozen identity column — outside the horizontal scroll */}
          <View style={styles.identityColumn}>
            <View style={styles.identityHeaderSpacer} />
            {matrix.rows.map((row, i) => (
              <IdentityCell
                key={row.product.id}
                row={row}
                isLast={i === matrix.rows.length - 1}
                onPress={onProductPress}
              />
            ))}
          </View>

          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            onLayout={handleGridLayout}
          >
            <View>
              <DayHeaderRow
                days={days}
                year={matrix.year}
                month={matrix.month}
                todayIndex={todayIndex}
              />
              {matrix.rows.map((row, rowIndex) => (
                <View
                  key={row.product.id}
                  style={[
                    styles.productRow,
                    rowIndex === matrix.rows.length - 1 && styles.productRowLast,
                  ]}
                >
                  <View style={styles.laneRow}>
                    {row.cells.map((cell, i) => (
                      <CalendarCell
                        key={i}
                        period="am"
                        scheduled={cell.am}
                        size={CELL_SIZE}
                        height={LANE_HEIGHT}
                      />
                    ))}
                  </View>
                  <View style={styles.laneRow}>
                    {row.cells.map((cell, i) => (
                      <CalendarCell
                        key={i}
                        period="pm"
                        scheduled={cell.pm}
                        size={CELL_SIZE}
                        height={LANE_HEIGHT}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        <Legend />
      </ScrollView>
    </View>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <View style={styles.legend}>
      <LegendItem period="am" label="Morning" />
      <LegendItem period="pm" label="Evening" />
      <LegendItem label="Not scheduled" />
    </View>
  );
}

function LegendItem({ period, label }: { period?: 'am' | 'pm'; label: string }) {
  return (
    <View style={styles.legendItem}>
      <CalendarCell
        variant="legend"
        period={period ?? 'am'}
        scheduled={period !== undefined}
        size={LANE_HEIGHT}
        height={LANE_HEIGHT}
      />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

// ─── Row identity (frozen column) ─────────────────────────────────────────────

function IdentityCell({
  row,
  isLast,
  onPress,
}: {
  row: CalendarRow;
  isLast: boolean;
  onPress: (p: Product) => void;
}) {
  const { product } = row;
  return (
    <Pressable
      style={[styles.identityCell, isLast && styles.identityCellLast]}
      onPress={() => onPress(product)}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, open actions`}
    >
      <ProductThumbnail product={product} size={44} />
      <View style={styles.identityText}>
        {product.brand ? (
          <Text style={styles.identityBrand} numberOfLines={1}>
            {product.brand}
          </Text>
        ) : null}
        <Text style={styles.identityName} numberOfLines={1}>
          {product.name}
        </Text>
      </View>
    </Pressable>
  );
}

// ─── Day header ───────────────────────────────────────────────────────────────

function DayHeaderRow({
  days,
  year,
  month,
  todayIndex,
}: {
  days: number[];
  year: number;
  month: number;
  todayIndex: number;
}) {
  return (
    <View style={styles.headerRow}>
      {days.map((i) => {
        const dayNumber = i + 1;
        const weekday = WEEKDAY_LABELS[new Date(year, month, dayNumber).getDay()];
        const isToday = i === todayIndex;
        return (
          <View key={i} style={styles.headerCell}>
            <Text style={styles.headerWeekday}>{weekday}</Text>
            <View style={[styles.headerDateBadge, isToday && styles.headerDateBadgeToday]}>
              <Text
                style={[styles.headerDate, isToday && styles.headerDateToday]}
                testID={isToday ? 'calendar-today' : undefined}
              >
                {dayNumber}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  monthLabel: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
    // Matches the grid card's own horizontal inset.
    paddingHorizontal: space[4],
    paddingBottom: space[3],
  },
  grid: {
    flexDirection: 'row',
    marginHorizontal: space[4],
    borderWidth: 1,
    borderColor: colors.borderDivider,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceCard,
    overflow: 'hidden',
  },

  identityColumn: {
    width: IDENTITY_WIDTH,
    borderRightWidth: 1,
    borderRightColor: colors.borderDivider,
    backgroundColor: colors.surfaceCard,
  },
  identityHeaderSpacer: {
    height: HEADER_HEIGHT,
  },
  identityCell: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderDivider,
  },
  identityCellLast: {
    borderBottomWidth: 0,
  },
  identityText: {
    flex: 1,
    minWidth: 0,
  },
  identityBrand: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textSecondary,
  },
  identityName: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },

  headerRow: {
    flexDirection: 'row',
    height: HEADER_HEIGHT,
  },
  headerCell: {
    width: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  headerWeekday: {
    fontFamily: 'DMSans-Medium',
    fontSize: 10,
    lineHeight: 12,
    color: colors.textTertiary,
  },
  headerDateBadge: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Today matches PlannerBlock's week-strip active-day treatment (plum fill).
  headerDateBadgeToday: {
    backgroundColor: palette.plum,
  },
  headerDate: {
    fontFamily: 'DMSans-Medium',
    fontSize: 12,
    lineHeight: 14,
    color: colors.textPrimary,
  },
  headerDateToday: {
    color: palette.white,
    fontFamily: 'DMSans-Bold',
  },

  // One product = two stacked lanes (morning above evening). The row divider
  // lives here, not on the cell, so it aligns with the frozen identity
  // column's divider at the same y.
  productRow: {
    height: ROW_HEIGHT,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderDivider,
  },
  productRowLast: {
    borderBottomWidth: 0,
  },
  laneRow: {
    flexDirection: 'row',
    height: LANE_HEIGHT,
    alignItems: 'center',
  },

  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: space[4],
    paddingHorizontal: space[4],
    paddingTop: space[4],
    paddingBottom: space[2],
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
  },
  legendLabel: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textSecondary,
  },

  emptyWrap: {
    alignItems: 'center',
    paddingVertical: space[12],
    gap: space[3],
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
