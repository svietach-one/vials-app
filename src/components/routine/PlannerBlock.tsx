import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors, palette, radius, space, typography } from '@/constants/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlannerBlockProps {
  activePeriod: 'morning' | 'evening';
  onPeriodChange: (p: 'morning' | 'evening') => void;
  /** Currently selected day of week (0 = Sun … 6 = Sat). */
  selectedDow: number;
  onDaySelect: (dow: number) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
  activePeriod,
  onPeriodChange,
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
            style={[styles.toggleBtn, activePeriod === 'morning' && styles.toggleBtnActive]}
            onPress={() => onPeriodChange('morning')}
            accessibilityRole="button"
            accessibilityState={{ selected: activePeriod === 'morning' }}
            accessibilityLabel="Morning routine"
            hitSlop={4}
          >
            <Feather
              name="sun"
              size={16}
              color={activePeriod === 'morning' ? palette.white : colors.textTertiary}
            />
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, activePeriod === 'evening' && styles.toggleBtnActive]}
            onPress={() => onPeriodChange('evening')}
            accessibilityRole="button"
            accessibilityState={{ selected: activePeriod === 'evening' }}
            accessibilityLabel="Evening routine"
            hitSlop={4}
          >
            <Feather
              name="moon"
              size={16}
              color={activePeriod === 'evening' ? palette.white : colors.textTertiary}
            />
          </Pressable>
        </View>
      </View>

      {/* Row 2: weekday navigation — single active day, tapping changes selection */}
      <View style={styles.dayRow}>
        {DAY_CHIPS.map(({ dow, label }) => {
          const active = selectedDow === dow;
          return (
            <Pressable
              key={dow}
              style={[styles.dayChip, active && styles.dayChipActive]}
              onPress={() => onDaySelect(dow)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${DAY_NAMES[dow]}, ${active ? 'selected' : ''}`}
              hitSlop={4}
            >
              <Text style={[styles.dayChipLabel, active && styles.dayChipLabelActive]}>
                {label}
              </Text>
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
    gap: space[2],
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  dateText: {
    ...typography.body,
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

  dayRow: {
    flexDirection: 'row',
    gap: space[1],
    marginTop: space[1],
  },
  dayChip: {
    flex: 1,
    height: 30,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipActive: {
    backgroundColor: palette.black,
    borderColor: palette.black,
  },
  dayChipLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  dayChipLabelActive: {
    color: palette.white,
  },
});
