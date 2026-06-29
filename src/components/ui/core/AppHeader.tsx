import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, space } from '@/constants/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppHeaderProps {
  title: string;
  /** Left slot — use IconButton (ghost, sm) for back/close. Absent = invisible spacer. */
  leftAction?: React.ReactNode;
  /** Right slot — use Button (textActive, sm) or IconButton. Absent = invisible spacer. */
  rightAction?: React.ReactNode;
  /** Show 1px bottom border. Defaults to true. */
  showDivider?: boolean;
}

// ─── Layout constant ──────────────────────────────────────────────────────────

// Wide enough to hold "Done" in Button sm (≈72px) and any IconButton size.
// Both side zones share the same value so the title is always truly centred.
const ACTION_ZONE_WIDTH = 80;

// ─── Component ────────────────────────────────────────────────────────────────

export function AppHeader({
  title,
  leftAction,
  rightAction,
  showDivider = true,
}: AppHeaderProps) {
  return (
    <View style={[styles.container, showDivider && styles.divider]}>
      <View style={styles.leftZone}>{leftAction}</View>

      <View style={styles.titleZone}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <View style={styles.rightZone}>{rightAction}</View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.gutterScreen,
    minHeight: 52,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDivider,
  },
  leftZone: {
    width: ACTION_ZONE_WIDTH,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  titleZone: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'DMSans-Medium',
    fontSize: 16,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  rightZone: {
    width: ACTION_ZONE_WIDTH,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
