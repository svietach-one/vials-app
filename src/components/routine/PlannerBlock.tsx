import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';

import { PillToggle } from '@/components/ui/core/PillToggle';
import { colors, palette, radius, space, typography } from '@/constants/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Which representation the Routine tab is showing. */
export type RoutineViewMode = 'list' | 'calendar';

export interface PlannerBlockProps {
  /**
   * List ⇄ calendar switch (img-03). Replaces the former AM/PM segmented
   * toggle: both periods now render together as accordions in the list view,
   * so there is nothing to switch between.
   */
  viewMode: RoutineViewMode;
  onViewModeChange: (mode: RoutineViewMode) => void;
  /** Currently selected day of week (0 = Sun … 6 = Sat). */
  selectedDow: number;
  onDaySelect: (dow: number) => void;
  /**
   * Renders the Mo…Su week strip below the toggle. Default true (list view
   * uses it to filter the day's steps). Calendar view passes false — its own
   * month grid already shows every day, so the strip would just duplicate it.
   */
  showWeekStrip?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Mo … Su ordered for display (matching JS dow: Mon=1 … Sat=6, Sun=0)
const DAY_CHIPS: { dow: number; label: string }[] = [
  { dow: 1, label: 'Mo' },
  { dow: 2, label: 'Tu' },
  { dow: 3, label: 'We' },
  { dow: 4, label: 'Th' },
  { dow: 5, label: 'Fr' },
  { dow: 6, label: 'Sa' },
  { dow: 0, label: 'Su' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Monday of the week containing `d` (Mon-start week, matching DAY_CHIPS order). */
function getWeekStart(d: Date): Date {
  const dow = d.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  return monday;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PlannerBlock({
  viewMode,
  onViewModeChange,
  selectedDow,
  onDaySelect,
  showWeekStrip = true,
}: PlannerBlockProps) {
  const today = new Date();
  const weekStart = getWeekStart(today);

  return (
    <View style={styles.card}>
      {/* List ⇄ calendar segmented pill */}
      <PillToggle
        value={viewMode}
        onValueChange={(v) => onViewModeChange(v as RoutineViewMode)}
        options={[
          {
            value: 'list',
            label: 'List',
            accessibilityLabel: 'List view',
            icon: (active) => (
              <Icon name="list" size={16} color={active ? palette.white : colors.textSecondary} />
            ),
          },
          {
            value: 'calendar',
            label: 'Calendar',
            accessibilityLabel: 'Calendar view',
            icon: (active) => (
              <Icon
                name="calendar"
                size={16}
                color={active ? palette.white : colors.textSecondary}
              />
            ),
          },
        ]}
      />

      {/* Mo … Su week strip — single active day, tapping changes selection */}
      {showWeekStrip ? (
        <View style={styles.dayRow}>
          {DAY_CHIPS.map(({ dow, label }, index) => {
            const active = selectedDow === dow;
            const date = new Date(weekStart);
            date.setDate(weekStart.getDate() + index);
            return (
              <Pressable
                key={dow}
                style={styles.dayColumn}
                onPress={() => onDaySelect(dow)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${DAY_NAMES[dow]}, ${date.getDate()}${active ? ', selected' : ''}`}
                hitSlop={4}
              >
                <Text style={[styles.dayLabel, active && styles.dayLabelActive]}>{label}</Text>
                <View style={[styles.dayNumber, active && styles.dayNumberActive]}>
                  <Text style={[styles.dayNumberLabel, active && styles.dayNumberLabelActive]}>
                    {date.getDate()}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    gap: space[3],
  },

  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayColumn: {
    flex: 1,
    alignItems: 'center',
    gap: space[1],
  },
  dayLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: 13,
    lineHeight: 16,
    color: colors.textTertiary,
  },
  dayLabelActive: {
    color: palette.plum,
    fontFamily: 'DMSans-Bold',
  },
  dayNumber: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumberActive: {
    backgroundColor: palette.plum,
  },
  dayNumberLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: 16,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  dayNumberLabelActive: {
    fontFamily: 'DMSans-Bold',
    color: palette.white,
  },
});
