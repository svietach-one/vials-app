import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors, radius, space } from '@/constants/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TagTone = 'neutral' | 'sos' | 'warning' | 'safe' | 'info';

export interface TagProps {
  children: React.ReactNode;
  tone?: TagTone;
  /** Renders a remove (×) button and calls this handler when pressed. */
  onRemove?: () => void;
  style?: StyleProp<ViewStyle>;
}

// ─── Tone maps ────────────────────────────────────────────────────────────────
// Tag uses a outlined approach: surface-raised background for all tones,
// with the border and text color carrying the semantic meaning.
// (Badge in the feedback folder uses filled tints — these are distinct.)

const toneBorderColor: Record<TagTone, string> = {
  neutral: colors.borderStrong,
  sos:     colors.statusSOSLine,
  warning: colors.statusWarningLine,
  safe:    colors.statusSafeLine,
  info:    colors.statusInfoLine,
};

const toneTextColor: Record<TagTone, string> = {
  neutral: colors.textPrimary,
  sos:     colors.statusSOS,
  warning: colors.statusWarning,
  safe:    colors.statusSafe,
  info:    colors.statusInfo,
};

// ─── Component ────────────────────────────────────────────────────────────────

export function Tag({ children, tone = 'neutral', onRemove, style }: TagProps) {
  const borderColor = toneBorderColor[tone];
  const textColor = toneTextColor[tone];
  const isRemovable = !!onRemove;

  return (
    <View
      style={[
        styles.container,
        { borderColor },
        isRemovable ? styles.removablePadding : styles.defaultPadding,
        style,
      ]}
    >
      <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>
        {children}
      </Text>

      {isRemovable ? (
        <Pressable
          onPress={onRemove}
          accessibilityLabel="Remove tag"
          accessibilityRole="button"
          // hitSlop pads the tiny 18px target out to 44px without enlarging
          // the visual remove button.
          hitSlop={{ top: 10, bottom: 10, left: 6, right: 10 }}
          style={({ pressed }) => [
            styles.removeButton,
            pressed && styles.removeButtonPressed,
          ]}
        >
          <Feather name="x" size={12} color={textColor} />
        </Pressable>
      ) : null}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start', // shrink-wrap to content width
    height: 28,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderRadius: radius.pill,
    gap: space[2] - 2, // 6px — between label and remove button
  },
  // Padding variants: tighter right side when the × button is present
  defaultPadding: {
    paddingHorizontal: 12,
  },
  removablePadding: {
    paddingLeft: 12,
    paddingRight: 6,
  },

  label: {
    fontFamily: 'DMSans-Medium',
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.1,
    includeFontPadding: false,
  },

  removeButton: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  removeButtonPressed: {
    opacity: 0.5,
  },
});
