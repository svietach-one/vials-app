import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, space, typography } from '@/constants/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WeeklySchedulePickerProps {
  /** 0 = Sunday … 6 = Saturday. Empty array means every day. */
  scheduledDays: number[];
  onUpdate?: (days: number[]) => void;
  /** When true, chips are display-only (not pressable). */
  readOnly?: boolean;
  /** Active chip fill color. Defaults to controlFill (black). */
  accentColor?: string;
}

// ─── Day chip definitions ─────────────────────────────────────────────────────

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

/**
 * Inline day-of-week picker for a routine step.
 * Empty scheduledDays → "Every day" (all chips appear active).
 * Deselecting a chip when in every-day mode switches to specific-days mode.
 * Selecting all 7 chips converts back to every-day mode.
 */
export function WeeklySchedulePicker({
  scheduledDays,
  onUpdate,
  readOnly = false,
  accentColor,
}: WeeklySchedulePickerProps) {
  const isEveryDay = scheduledDays.length === 0;
  const fill = accentColor ?? colors.controlFill;

  function isDayActive(dow: number): boolean {
    return isEveryDay || scheduledDays.includes(dow);
  }

  function toggleDay(dow: number) {
    if (readOnly || !onUpdate) return;
    if (isEveryDay) {
      onUpdate(DAY_CHIPS.map((d) => d.dow).filter((d) => d !== dow));
    } else if (scheduledDays.includes(dow)) {
      const next = scheduledDays.filter((d) => d !== dow);
      onUpdate(next.length === 0 ? [] : next);
    } else {
      const next = [...scheduledDays, dow];
      onUpdate(next.length === 7 ? [] : next);
    }
  }

  return (
    <View style={styles.row}>
      {DAY_CHIPS.map(({ dow, label }) => {
        const active = isDayActive(dow);
        const activeStyle = active
          ? { backgroundColor: fill, borderColor: fill }
          : undefined;

        if (readOnly) {
          return (
            <View key={dow} style={[styles.chip, activeStyle]}>
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                {label}
              </Text>
            </View>
          );
        }

        return (
          <Pressable
            key={dow}
            onPress={() => toggleDay(dow)}
            style={[styles.chip, activeStyle]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            accessibilityLabel={`${label}, ${active ? 'selected' : 'not selected'}`}
            hitSlop={4}
          >
            <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: space[1],
    marginTop: space[2],
  },
  chip: {
    width: 30,
    height: 26,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabel: {
    ...typography.caption,
    fontFamily: 'DMSans-Medium',
    color: colors.textSecondary,
  },
  chipLabelActive: {
    color: colors.textOnDark,
  },
});
