import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, radius, space } from '@/constants/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'style'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading icon node (e.g. a Feather <Icon> component). */
  icon?: React.ReactNode;
  /** Trailing icon node. */
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  fullWidth = false,
  disabled = false,
  style,
  ...rest
}: ButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        sizeContainer[size],
        variantContainer[variant],
        pressed && variantContainerPressed[variant],
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        style,
      ]}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      {...rest}
    >
      {icon ? <View style={styles.iconSlot}>{icon}</View> : null}
      <Text
        style={[styles.label, sizeLabel[size], variantLabel[variant]]}
        numberOfLines={1}
      >
        {children}
      </Text>
      {iconRight ? <View style={styles.iconSlot}>{iconRight}</View> : null}
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.4,
  },
  iconSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: 'DMSans-Medium',
    letterSpacing: -0.15,
    includeFontPadding: false,
  },
});

// Size: container
const sizeContainer = StyleSheet.create({
  sm: { height: 36, paddingHorizontal: space[3], gap: space[2] },
  md: { height: 44, paddingHorizontal: space[5], gap: space[2] },
  lg: { height: 52, paddingHorizontal: space[6], gap: space[2] },
});

// Size: label
const sizeLabel = StyleSheet.create({
  sm: { fontSize: 13, lineHeight: 18 },
  md: { fontSize: 15, lineHeight: 20 },
  lg: { fontSize: 16, lineHeight: 22 },
});

// Variant: container — resting state
const variantContainer = StyleSheet.create({
  primary: {
    backgroundColor: colors.controlFill,
    borderColor: colors.controlFill,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderColor: colors.controlFill,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  destructive: {
    backgroundColor: 'transparent',
    borderColor: colors.statusSOSLine,
  },
});

// Variant: container — pressed state (replaces CSS :active / onMouseDown)
const variantContainerPressed = StyleSheet.create({
  primary: {
    backgroundColor: colors.controlFillHover,
    borderColor: colors.controlFillHover,
  },
  secondary: {
    backgroundColor: colors.surfaceSunken,
    borderColor: colors.controlFill,
  },
  ghost: {
    backgroundColor: colors.surfaceSunken,
    borderColor: 'transparent',
  },
  destructive: {
    backgroundColor: colors.statusSOSTint,
    borderColor: colors.statusSOSLine,
  },
});

// Variant: label color
const variantLabel = StyleSheet.create({
  primary: { color: colors.controlOn },
  secondary: { color: colors.textPrimary },
  ghost: { color: colors.textPrimary },
  destructive: { color: colors.statusSOS },
});
