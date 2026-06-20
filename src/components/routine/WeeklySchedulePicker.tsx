import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, space, typography } from '@/constants/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WeeklySchedulePickerProps {
  /** 0 = Sunday … 6 = Saturday. Empty array means every day. */
  scheduledDays: number[];
  onUpdate: (days: number[]) => void;
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
export function WeeklySchedulePicker({ scheduledDays, onUpdate }: WeeklySchedulePickerProps) {
  const isEveryDay = scheduledDays.length === 0;

  function isDayActive(dow: number): boolean {
    return isEveryDay || scheduledDays.includes(dow);
  }

  function toggleDay(dow: number) {
    if (isEveryDay) {
      // Switch to specific-days: all 7 selected minus the tapped one
      onUpdate(DAY_CHIPS.map((d) => d.dow).filter((d) => d !== dow));
    } else if (scheduledDays.includes(dow)) {
      const next = scheduledDays.filter((d) => d !== dow);
      // If zero remain, fall back to every-day
      onUpdate(next.length === 0 ? [] : next);
    } else {
      const next = [...scheduledDays, dow];
      // If all 7 selected, convert to every-day
      onUpdate(next.length === 7 ? [] : next);
    }
  }

  return (
    <View style={styles.row}>
      {DAY_CHIPS.map(({ dow, label }) => {
        const active = isDayActive(dow);
        return (
          <Pressable
            key={dow}
            onPress={() => toggleDay(dow)}
            style={[styles.chip, active && styles.chipActive]}
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
  chipActive: {
    backgroundColor: colors.controlFill,
    borderColor: colors.controlFill,
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
