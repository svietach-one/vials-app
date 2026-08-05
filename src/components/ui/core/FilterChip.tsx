import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { PressableProps, StyleProp, ViewStyle } from 'react-native';

import { colors, palette, radius, space, typography } from '@/constants/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FilterChipProps extends Omit<PressableProps, 'style' | 'children'> {
  children: string;
  selected?: boolean;
  size?: 'sm' | 'md';
  /** Optional trailing sub-label (e.g. "Primary") shown after the main text. */
  subLabel?: string;
  style?: StyleProp<ViewStyle>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FilterChip({
  children,
  selected = false,
  size = 'md',
  subLabel,
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
      {subLabel ? <Text style={styles.subLabel}>{subLabel}</Text> : null}
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space[2],
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
    backgroundColor: palette.plumTintLight,
    borderWidth: 1,
    borderColor: palette.plum,
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
    color: palette.plum,
  },
  labelUnselected: {
    color: colors.textSecondary,
  },
  subLabel: {
    ...typography.caption,
    fontFamily: 'DMSans-Medium',
    color: palette.plum,
    opacity: 0.75,
  },
});
