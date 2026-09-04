import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, palette, radius, space } from '@/constants/tokens';
import { getWeekStart } from '@/utils/routineSchedule';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * routine-step-grouping follow-up: this block used to also own the List ⇄
 * Calendar segmented pill (img-03). That toggle now lives in AppHeader's
 * leftAction (RoutinesScreen), and the Morning/Evening period switch is a
 * separate PillToggle rendered directly by RoutinesScreen — so this
 * component is left with exactly one job: the Mo…Su week strip. It has a
 * single remaining call site (the list view's header block); the former
 * calendar-view call site (`showWeekStrip={false}`) rendered nothing once
 * the toggle moved out, so it was removed rather than kept as a no-op.
 */
export interface PlannerBlockProps {
  /** Currently selected day of week (0 = Sun … 6 = Sat). */
  selectedDow: number;
  onDaySelect: (dow: number) => void;
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

// ─── Component ────────────────────────────────────────────────────────────────

export function PlannerBlock({ selectedDow, onDaySelect }: PlannerBlockProps) {
  const today = new Date();
  const weekStart = getWeekStart(today);

  return (
    <View style={styles.card}>
      {/* Mo … Su week strip — single active day, tapping changes selection */}
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
