import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, TextStyle, ViewProps, ViewStyle } from 'react-native';

import { colors, radius, space, typography } from '@/constants/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BadgeStatus = 'Default' | 'Green' | 'Cobalt' | 'Cabernet' | 'Amber';
export type BadgeType = 'Light' | 'Dark';

export interface BadgeProps extends Omit<ViewProps, 'style'> {
  status?: BadgeStatus;
  type?: BadgeType;
  children: string | number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

// ─── Precomputed variant styles ───────────────────────────────────────────────
// Registered as integer IDs via StyleSheet.create — no inline-object allocation
// per render, which matters on the FlatList hot path (catalog badges).

const bgStyles = StyleSheet.create({
  Default_Light:  { backgroundColor: colors.surfaceSunken },
  Default_Dark:   { backgroundColor: colors.controlFill },
  Green_Light:    { backgroundColor: colors.statusSafeTint },
  Green_Dark:     { backgroundColor: colors.statusSafe },
  Cobalt_Light:   { backgroundColor: colors.statusInfoTint },
  Cobalt_Dark:    { backgroundColor: colors.statusInfo },
  Cabernet_Light: { backgroundColor: colors.statusSOSTint },
  Cabernet_Dark:  { backgroundColor: colors.statusSOS },
  Amber_Light:    { backgroundColor: colors.statusWarningTint },
  Amber_Dark:     { backgroundColor: colors.statusWarning },
});

const fgStyles = StyleSheet.create({
  Default_Light:  { color: colors.textSecondary },
  Default_Dark:   { color: colors.controlOn },
  Green_Light:    { color: colors.statusSafe },
  Green_Dark:     { color: colors.controlOn },
  Cobalt_Light:   { color: colors.statusInfo },
  Cobalt_Dark:    { color: colors.controlOn },
  Cabernet_Light: { color: colors.statusSOS },
  Cabernet_Dark:  { color: colors.controlOn },
  Amber_Light:    { color: colors.statusWarning },
  Amber_Dark:     { color: colors.controlOn },
});

type VariantKey = keyof typeof bgStyles;

// ─── Component ────────────────────────────────────────────────────────────────

export function Badge({
  children,
  status = 'Default',
  type = 'Light',
  style,
  textStyle,
  ...rest
}: BadgeProps) {
  const key = `${status}_${type}` as VariantKey;

  return (
    <View style={[styles.pill, bgStyles[key], style]} {...rest}>
      <Text style={[styles.label, fgStyles[key], textStyle]} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

// ─── Base styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    flexShrink: 0,
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: radius.pill,
  },
  label: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    includeFontPadding: false,
  },
});
