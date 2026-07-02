import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { palette } from '@/constants/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TabButtonMode = 'morning' | 'evening';

export interface TabButtonProps extends Omit<PressableProps, 'style'> {
  mode: TabButtonMode;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const MODE_CONFIG: Record<TabButtonMode, { label: string; icon: React.ComponentProps<typeof Feather>['name'] }> = {
  morning: { label: 'Morning', icon: 'sun' },
  evening: { label: 'Evening', icon: 'moon' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function TabButton({
  mode,
  active = false,
  disabled = false,
  style,
  ...rest
}: TabButtonProps) {
  const { label, icon } = MODE_CONFIG[mode];

  return (
    <Pressable
      disabled={disabled}
      {...rest}
      style={({ pressed }) => [
        styles.base,
        active && !disabled && styles.active,
        !active && pressed && styles.inactivePressed,
        active && !disabled && pressed && styles.activePressed,
        disabled && styles.disabledBase,
        style,
      ]}
      accessibilityRole="tab"
      accessibilityState={{ selected: active && !disabled, disabled: !!disabled }}
      accessibilityLabel={label}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
    >
      <Feather
        name={icon}
        size={20}
        color={disabled ? palette.zinc300 : active ? palette.white : palette.zinc400}
      />
      <Text
        style={[
          styles.label,
          disabled ? styles.labelDisabled : active ? styles.labelActive : styles.labelInactive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  active: {
    backgroundColor: palette.black,
    // Figma: drop-shadow(0px 1px 0.5px rgba(9,9,11,0.12)) — no matching system token
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 0.5,
    elevation: 1,
  },
  inactivePressed: {
    backgroundColor: palette.zinc100,
  },
  activePressed: {
    opacity: 0.8,
  },
  disabledBase: {
    opacity: 0.4,
  },
  label: {
    fontFamily: 'DMSans-Bold',
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
  },
  labelActive: {
    color: palette.white,
  },
  labelInactive: {
    color: palette.zinc400,
  },
  labelDisabled: {
    color: palette.zinc300,
  },
});
