import React from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { Icon, type IconName } from '@/components/ui/Icon';

import { colors, palette, radius, space, typography } from '@/constants/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TimeChipProps {
  icon: IconName;
  label: string;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Full-width AM/PM-style toggle chip used in the routine scheduling sheets
 * (RoutineSchedulerSheet, AddToRoutineSheet) — shared here so the two flows
 * can't drift apart the way they did before this was extracted.
 */
export function TimeChip({ icon, label, active, onPress, disabled, style }: TimeChipProps) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={[styles.chip, active && styles.chipActive, disabled && styles.chipDisabled, style]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active, disabled }}
      accessibilityLabel={label}
    >
      <Icon name={icon} size={15} color={active ? palette.white : colors.textSecondary} />
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  chip: {
    flex: 1,
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
  },
  chipActive: {
    backgroundColor: palette.black,
    borderColor: palette.black,
  },
  chipDisabled: {
    opacity: 0.4,
  },
  label: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textSecondary,
  },
  labelActive: {
    color: palette.white,
  },
});
