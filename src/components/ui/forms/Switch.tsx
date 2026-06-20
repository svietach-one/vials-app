import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, palette, radius } from '@/constants/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SwitchProps {
  checked?: boolean;
  onValueChange?: (checked: boolean) => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DIMS = {
  sm: { w: 38, h: 22 },
  md: { w: 46, h: 28 },
} as const;

// ─── Component ────────────────────────────────────────────────────────────────

export function Switch({
  checked = false,
  onValueChange,
  size = 'md',
  disabled = false,
  style,
}: SwitchProps) {
  const { w, h } = DIMS[size];
  const knobDim = h - 6; // 3px inset on each side
  const knobOnLeft = w - knobDim - 3;

  // Animated knob position (replaces CSS `left` transition)
  const knobAnim = useRef(new Animated.Value(checked ? knobOnLeft : 3)).current;
  // Animated track color
  const trackAnim = useRef(new Animated.Value(checked ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(knobAnim, {
        toValue: checked ? knobOnLeft : 3,
        duration: 180,
        useNativeDriver: false, // `left` is not supported by native driver
      }),
      Animated.timing(trackAnim, {
        toValue: checked ? 1 : 0,
        duration: 180,
        useNativeDriver: false,
      }),
    ]).start();
  }, [checked, knobAnim, knobOnLeft, trackAnim]);

  const trackBg = trackAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.borderStrong, colors.controlFill],
  });

  return (
    <Pressable
      onPress={() => !disabled && onValueChange?.(!checked)}
      accessibilityRole="switch"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      style={[disabled && styles.disabled, style]}
      hitSlop={4}
    >
      <Animated.View
        style={[
          styles.track,
          { width: w, height: h, backgroundColor: trackBg },
        ]}
      >
        <Animated.View
          style={[
            styles.knob,
            {
              width: knobDim,
              height: knobDim,
              left: knobAnim,
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  disabled: {
    opacity: 0.45,
  },
  track: {
    borderRadius: radius.pill,
    // Relative positioning so the knob can use `left` (absolute inside)
    position: 'relative',
  },
  knob: {
    position: 'absolute',
    top: 3,
    borderRadius: radius.pill,
    backgroundColor: palette.white,
    // Subtle shadow so the knob lifts off the track
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
});
