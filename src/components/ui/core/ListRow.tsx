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
import { Feather } from '@expo/vector-icons';

import { colors, space, typography } from '@/constants/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ListRowProps {
  leading?: React.ReactNode;
  title: string;
  subtitle?: string | null;
  trailing?: React.ReactNode;
  /** Renders a trailing chevron icon. */
  chevron?: boolean;
  /** Renders a 1px bottom border. Default true. */
  divider?: boolean;
  onPress?: PressableProps['onPress'];
  style?: StyleProp<ViewStyle>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  chevron = false,
  divider = true,
  onPress,
  style,
}: ListRowProps) {
  const isInteractive = !!onPress;

  // Shared inner layout — extracted so it isn't duplicated across both branches.
  const inner = (
    <>
      {leading ? <View style={styles.leadingSlot}>{leading}</View> : null}

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {trailing ? <View style={styles.trailingSlot}>{trailing}</View> : null}

      {chevron ? (
        <Feather
          name="chevron-right"
          size={18}
          color={colors.textTertiary}
          style={styles.chevron}
        />
      ) : null}
    </>
  );

  if (isInteractive) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.row,
          divider && styles.withDivider,
          pressed && styles.pressed,
          style,
        ]}
      >
        {inner}
      </Pressable>
    );
  }

  return (
    <View style={[styles.row, divider && styles.withDivider, style]}>
      {inner}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingVertical: 10,
    paddingHorizontal: space[1],
    gap: space[3],
  },
  // Bottom border drawn via borderBottomWidth so it spans the full row width,
  // matching the CSS `border-bottom` approach from the web original.
  withDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDivider,
  },
  // Pressed feedback: subtle sunken surface, replaces CSS hover background swap.
  pressed: {
    backgroundColor: colors.surfaceSunken,
  },

  leadingSlot: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    minWidth: 0, // allows Text numberOfLines to truncate correctly
  },
  title: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.body.fontSize,
    lineHeight: 20,
    letterSpacing: -0.15,
    color: colors.textPrimary,
  },
  subtitle: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    marginTop: 1,
  },
  trailingSlot: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    flexShrink: 0,
  },
});
