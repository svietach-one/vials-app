import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, radius, shadow, space } from '@/constants/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CardVariant = 'surface' | 'raised' | 'flat';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps {
  variant?: CardVariant;
  padding?: CardPadding;
  /**
   * When true the card renders as a Pressable and shows a subtle press-in
   * feedback. Pass onPress to handle the tap. Replaces CSS hover/pointer.
   */
  interactive?: boolean;
  onPress?: PressableProps['onPress'];
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Card({
  children,
  variant = 'surface',
  padding = 'md',
  interactive = false,
  onPress,
  style,
}: CardProps) {
  const containerStyle = [
    styles.base,
    variantStyles[variant],
    paddingStyles[padding],
    style,
  ];

  if (interactive) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          ...containerStyle,
          // Subtle press-in: slightly darker surface + tighter shadow
          pressed && styles.pressed,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={containerStyle}>
      {children}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.sm,
    borderWidth: 1,
    overflow: 'hidden',
  },
  // Pressed: dimmed surface — replaces CSS translateY(-1px) hover lift
  pressed: {
    opacity: 0.85,
  },
});

// Variant: surface color, border, shadow
const variantStyles = StyleSheet.create({
  surface: {
    backgroundColor: colors.surfaceCard,
    borderColor: colors.borderDivider,
    ...shadow.none,
  },
  raised: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderDivider,
    ...shadow.md,
  },
  flat: {
    backgroundColor: 'transparent',
    borderColor: colors.borderDivider,
    ...shadow.none,
  },
});

// Padding: maps to token values
const paddingStyles = StyleSheet.create({
  none: { padding: 0 },
  sm:   { padding: space[3] },
  md:   { padding: space.gapCard },
  lg:   { padding: space[6] },
});
