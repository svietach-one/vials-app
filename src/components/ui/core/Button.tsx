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

import { palette } from '@/constants/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'textActive'
  | 'destructive';
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
        pressed && !disabled && variantContainerPressed[variant],
        disabled && variantContainerDisabled[variant],
        fullWidth && styles.fullWidth,
        style,
      ]}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      {...rest}
    >
      {icon ? <View style={styles.iconSlot}>{icon}</View> : null}
      <Text
        style={[
          styles.label,
          sizeLabel[size],
          variantLabel[variant],
          disabled && variantLabelDisabled[variant],
        ]}
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
    borderRadius: 6,
  },
  fullWidth: {
    width: '100%',
  },
  iconSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: 'DMSans-Bold',
    includeFontPadding: false,
  },
});

// Size: container
const sizeContainer = StyleSheet.create({
  sm: { paddingHorizontal: 20, paddingVertical: 9, gap: 6 },
  md: { paddingHorizontal: 20, paddingVertical: 10, gap: 6 },
  lg: { paddingHorizontal: 20, paddingVertical: 12, gap: 6 },
});

// Size: label
const sizeLabel = StyleSheet.create({
  sm: { fontSize: 14, lineHeight: 18 },
  md: { fontSize: 15, lineHeight: 20 },
  lg: { fontSize: 16, lineHeight: 22 },
});

// Variant: container — resting state
const variantContainer = StyleSheet.create({
  primary: {
    backgroundColor: palette.zinc900,
    borderColor: palette.zinc900,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderColor: palette.zinc900,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  textActive: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  destructive: {
    backgroundColor: 'transparent',
    borderColor: palette.red,
  },
});

// Variant: container — pressed state
const variantContainerPressed = StyleSheet.create({
  primary: {
    backgroundColor: palette.zinc800,
    borderColor: palette.zinc800,
  },
  secondary: {
    backgroundColor: palette.zinc100,
    borderColor: palette.zinc900,
  },
  ghost: {
    backgroundColor: palette.zinc100,
    borderColor: 'transparent',
  },
  textActive: {
    backgroundColor: palette.zinc100,
    borderColor: 'transparent',
  },
  destructive: {
    backgroundColor: palette.zinc100,
    borderColor: palette.red,
  },
});

// Variant: container — disabled state (explicit colors, no opacity hack)
const variantContainerDisabled = StyleSheet.create({
  primary: {
    backgroundColor: palette.zinc300,
    borderColor: palette.zinc300,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderColor: palette.zinc300,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  textActive: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  destructive: {
    backgroundColor: 'transparent',
    borderColor: palette.zinc300,
  },
});

// Variant: label — resting color
const variantLabel = StyleSheet.create({
  primary: { color: palette.white },
  secondary: { color: palette.zinc900 },
  ghost: { color: palette.zinc900 },
  textActive: { color: palette.bottleGreen },
  destructive: { color: palette.red },
});

// Variant: label — disabled color
const variantLabelDisabled = StyleSheet.create({
  primary: { color: palette.white },
  secondary: { color: palette.zinc300 },
  ghost: { color: palette.zinc300 },
  textActive: { color: palette.zinc300 },
  destructive: { color: palette.zinc300 },
});
