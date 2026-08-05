import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, palette, radius, shadow, space } from '@/constants/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PillToggleOption {
  value: string;
  label: string;
  /** Leading icon, given the segment's active state so its color can follow. */
  icon?: (active: boolean) => React.ReactNode;
  accessibilityLabel?: string;
}

export interface PillToggleProps {
  options: PillToggleOption[];
  value: string;
  onValueChange: (value: string) => void;
  style?: StyleProp<ViewStyle>;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Full-width plum segmented pill — Clinic's Active/History tabs and the
 * Routines list/calendar switch. The one shared implementation for what were
 * previously two structurally-identical hand-rolled copies (ClinicScreen's
 * `ClinicTabs` and PlannerBlock's `toggleGroup`).
 */
export function PillToggle({ options, value, onValueChange, style }: PillToggleProps) {
  return (
    <View style={[styles.group, style]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={[styles.btn, active && styles.btnActive]}
            onPress={() => onValueChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            hitSlop={4}
          >
            {option.icon ? option.icon(active) : null}
            <Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    gap: space[1],
    backgroundColor: palette.white,
    borderRadius: radius.pill,
    padding: space[1],
    ...shadow.sm,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[1],
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: palette.white,
  },
  btnActive: {
    backgroundColor: palette.plum,
  },
  label: {
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  labelActive: {
    color: palette.white,
  },
});
