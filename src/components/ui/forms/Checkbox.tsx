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

import { colors, palette, radius, space, typography } from '@/constants/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CheckboxProps {
  checked?: boolean;
  onValueChange?: (checked: boolean) => void;
  label?: string | null;
  sublabel?: string | null;
  size?: 'sm' | 'md';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Checkbox({
  checked = false,
  onValueChange,
  label,
  sublabel,
  size = 'md',
  disabled = false,
  style,
}: CheckboxProps) {
  const dim = size === 'sm' ? 18 : 24;
  const iconSize = size === 'sm' ? 11 : 14;
  const hasText = !!(label || sublabel);

  return (
    <Pressable
      onPress={() => !disabled && onValueChange?.(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      style={[
        styles.row,
        hasText ? styles.rowWithText : null,
        disabled && styles.disabled,
        style,
      ]}
      hitSlop={4}
    >
      {/* Box */}
      <View
        style={[
          styles.box,
          { width: dim, height: dim },
          checked ? styles.boxChecked : styles.boxUnchecked,
        ]}
      >
        {checked ? (
          <Feather name="check" size={iconSize} color={palette.white} />
        ) : null}
      </View>

      {/* Label block */}
      {hasText ? (
        <View style={styles.textBlock}>
          {label ? (
            <Text
              style={[
                styles.label,
                checked && styles.labelChecked,
              ]}
            >
              {label}
            </Text>
          ) : null}
          {sublabel ? (
            <Text style={styles.sublabel}>{sublabel}</Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  rowWithText: {
    alignItems: 'flex-start',
  },
  disabled: {
    opacity: 0.45,
  },

  box: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.xs,
  },
  boxUnchecked: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.controlFill,
  },
  boxChecked: {
    backgroundColor: colors.controlFill,
    borderWidth: 0,
  },

  textBlock: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.body.fontSize,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  // Strike-through when checked, using text decoration
  labelChecked: {
    textDecorationLine: 'line-through',
    color: colors.textTertiary,
  },
  sublabel: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
});
