import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, radius, shadow, space } from '@/constants/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SegmentOption {
  value: string;
  label: string;
}

export interface SegmentedControlProps {
  options: Array<SegmentOption | string>;
  value: string;
  onValueChange: (value: string) => void;
  size?: 'sm' | 'md';
  /** Stretch segments to fill full container width. Default true. */
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SegmentedControl({
  options,
  value,
  onValueChange,
  size = 'md',
  fullWidth = true,
  style,
}: SegmentedControlProps) {
  const items: SegmentOption[] = options.map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o,
  );

  const segmentHeight = size === 'sm' ? 32 : 40;
  const labelSize = size === 'sm' ? 13 : 15;

  const segments = items.map((item) => {
    const active = item.value === value;
    return (
      <Pressable
        key={item.value}
        onPress={() => onValueChange(item.value)}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        style={[
          styles.segment,
          fullWidth && styles.segmentFlex,
          { height: segmentHeight },
          active && styles.segmentActive,
        ]}
      >
        <Text
          style={[
            styles.label,
            { fontSize: labelSize },
            active ? styles.labelActive : styles.labelInactive,
          ]}
          numberOfLines={1}
        >
          {item.label}
        </Text>
      </Pressable>
    );
  });

  if (fullWidth) {
    return <View style={[styles.track, style]}>{segments}</View>;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.track, style]}
      contentContainerStyle={styles.scrollContent}
    >
      {segments}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: 3,
    gap: 3,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.borderDivider,
    borderRadius: radius.md,
  },
  scrollContent: {
    flexDirection: 'row',
    gap: 3,
  },

  segment: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[4],
    borderRadius: radius.sm,
    backgroundColor: 'transparent',
  },
  segmentFlex: {
    flex: 1,
  },
  // Active pill: white surface with subtle shadow, replicates CSS box-shadow: var(--shadow-xs)
  segmentActive: {
    backgroundColor: colors.surfaceRaised,
    ...shadow.xs,
  },

  label: {
    fontFamily: 'DMSans-Medium',
    letterSpacing: -0.15,
    includeFontPadding: false,
  },
  labelActive: {
    color: colors.textPrimary,
  },
  labelInactive: {
    color: colors.textSecondary,
  },
});
