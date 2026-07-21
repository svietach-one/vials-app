import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

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
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the date of the nearest (today or upcoming) occurrence of targetDow.
 * If targetDow === today.getDay(), returns today's date.
 */
function getDateForDow(today: Date, targetDow: number): Date {
  const daysOffset = (targetDow - today.getDay() + 7) % 7;
  const d = new Date(today);
  d.setDate(today.getDate() + daysOffset);
  return d;
}

function buildDateLabel(selectedDate: Date, isToday: boolean): string {
  const dayName = DAY_NAMES[selectedDate.getDay()];
  const dateStr = `${selectedDate.getDate()} ${MONTH_NAMES[selectedDate.getMonth()]}`;
  return isToday ? `Today, ${dayName}, ${dateStr}` : `${dayName}, ${dateStr}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PlannerBlock({
  viewMode,
  onViewModeChange,
  selectedDow,
  onDaySelect,
}: PlannerBlockProps) {
  const today = new Date();
  const todayDow = today.getDay();
  const selectedDate = getDateForDow(today, selectedDow);
  const dateLabel = buildDateLabel(selectedDate, selectedDow === todayDow);

  return (
    <View style={styles.card}>
      {/* Row 1: date text (left) + morning/evening toggle (right) */}
      <View style={styles.headerRow}>
        <Text style={styles.dateText} numberOfLines={1} adjustsFontSizeToFit>
          {dateLabel}
        </Text>
        <View style={styles.toggleGroup}>
          <Pressable
            style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
            onPress={() => onViewModeChange('list')}
            accessibilityRole="button"
            accessibilityState={{ selected: viewMode === 'list' }}
            accessibilityLabel="List view"
            hitSlop={4}
          >
            <Feather
              name="list"
              size={16}
              color={viewMode === 'list' ? palette.white : colors.textTertiary}
            />
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, viewMode === 'calendar' && styles.toggleBtnActive]}
            onPress={() => onViewModeChange('calendar')}
            accessibilityRole="button"
            accessibilityState={{ selected: viewMode === 'calendar' }}
            accessibilityLabel="Calendar view"
            hitSlop={4}
          >
            <Feather
              name="calendar"
              size={16}
              color={viewMode === 'calendar' ? palette.white : colors.textTertiary}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    gap: space[2],
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  dateText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 16,
    lineHeight: 22,
    color: colors.textPrimary,
    flex: 1,
  },
  toggleGroup: {
    flexDirection: 'row',
    gap: space[1],
    flexShrink: 0,
  },
  toggleBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnActive: {
    backgroundColor: palette.black,
  },
});
