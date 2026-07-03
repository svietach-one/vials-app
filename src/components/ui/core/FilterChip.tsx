import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { PressableProps, StyleProp, ViewStyle } from 'react-native';

import { colors, radius, space, typography } from '@/constants/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FilterChipProps extends Omit<PressableProps, 'style' | 'children'> {
  children: string;
  selected?: boolean;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FilterChip({
  children,
  selected = false,
  size = 'md',
  accessibilityLabel,
  style,
  ...rest
}: FilterChipProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={accessibilityLabel ?? children}
      style={({ pressed }) => [
        styles.chip,
        size === 'sm' ? styles.chipSm : styles.chipMd,
        selected ? styles.selected : styles.unselected,
        style,
        pressed && styles.pressed,
      ]}
      {...rest}
    >
      <Text style={[styles.label, selected ? styles.labelSelected : styles.labelUnselected]}>
        {children}
      </Text>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  chip: {
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  chipMd: {
    height: space[8],
    paddingHorizontal: space[3],
  },
  chipSm: {
    height: space[7],
    paddingHorizontal: space[2],
  },
  selected: {
    backgroundColor: colors.controlFill,
  },
  unselected: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: 'DMSans-Medium',
    includeFontPadding: false,
  },
  labelSelected: {
    color: colors.controlOn,
  },
  labelUnselected: {
    color: colors.textSecondary,
  },
});
