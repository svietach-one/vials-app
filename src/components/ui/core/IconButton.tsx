import React from 'react';
import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, radius } from '@/constants/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

export type IconButtonVariant = 'ghost' | 'secondary' | 'filled';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps extends Omit<PressableProps, 'style'> {
  icon: React.ReactNode;
  /** Accessible label — required for screen readers (replaces aria-label). */
  label: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  /** Use pill radius instead of the default md radius. */
  round?: boolean;
  style?: StyleProp<ViewStyle>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DIMS: Record<IconButtonSize, number> = { sm: 36, md: 44, lg: 52 };
const MIN_TARGET = 44; // px — WCAG / HIG minimum tap target

// ─── Component ────────────────────────────────────────────────────────────────

export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  round = false,
  disabled = false,
  style,
  ...rest
}: IconButtonProps) {
  const dim = DIMS[size];

  // For sizes smaller than 44px, expand the invisible tap target via hitSlop
  // so the visual size stays compact while the touch area meets the 44px rule.
  const inset = Math.max(0, Math.ceil((MIN_TARGET - dim) / 2));
  const hitSlop = inset > 0 ? inset : undefined;

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      hitSlop={hitSlop}
      style={({ pressed }) => [
        styles.base,
        { width: dim, height: dim, borderRadius: round ? radius.pill : radius.md },
        variantStyles[variant],
        pressed && !disabled && variantPressedStyles[variant],
        disabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {icon}
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  disabled: {
    opacity: 0.4,
  },
});

const variantStyles = StyleSheet.create({
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  secondary: {
    backgroundColor: colors.surfaceCard,
    borderColor: colors.borderStrong,
  },
  filled: {
    backgroundColor: colors.controlFill,
    borderColor: colors.controlFill,
  },
});

const variantPressedStyles = StyleSheet.create({
  ghost: {
    backgroundColor: colors.surfaceSunken,
    borderColor: 'transparent',
  },
  secondary: {
    backgroundColor: colors.surfaceSunken,
    borderColor: colors.borderStrong,
  },
  filled: {
    backgroundColor: colors.controlFillHover,
    borderColor: colors.controlFillHover,
  },
});
