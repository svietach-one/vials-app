import React from 'react';
import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, palette, radius } from '@/constants/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

export type IconButtonVariant = 'ghost' | 'secondary' | 'filled';
export type IconButtonSize = 'xs' | 'sm' | 'md' | 'lg';

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

// `xs` sits below the 44px minimum tap target on purpose — it exists for
// icon glyphs embedded inside an already-compact chip/badge (e.g. a 32px
// pill's remove control) where the visual box must match the chip's own
// size. The hitSlop expansion below still pads the touch area to 44px.
const DIMS: Record<IconButtonSize, number> = { xs: 32, sm: 36, md: 44, lg: 52 };
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
    backgroundColor: palette.plum,
    borderColor: palette.plum,
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
    backgroundColor: palette.plumPressed,
    borderColor: palette.plumPressed,
  },
});
