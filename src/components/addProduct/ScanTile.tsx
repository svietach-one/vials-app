import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors, radius, space, typography } from '@/constants/tokens';

export interface ScanTileProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  caption?: string;
  onPress: () => void;
  /** Slim single-row layout: icon + label only, no caption, no icon
   *  circle — for tiles that don't need the full explanatory block. */
  compact?: boolean;
}

/** Dashed-border camera launch tile shared by the wizard sections. */
export function ScanTile({ icon, label, caption, onPress, compact = false }: ScanTileProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.tile,
        compact && styles.tileCompact,
        pressed && styles.tilePressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {compact ? (
        <Feather name={icon} size={16} color={colors.textPrimary} />
      ) : (
        <View style={styles.iconWrap}>
          <Feather name={icon} size={20} color={colors.textPrimary} />
        </View>
      )}
      <Text style={styles.label}>{label}</Text>
      {!compact && caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    borderRadius: radius.xl,
    paddingVertical: space[5],
    paddingHorizontal: space[4],
    alignItems: 'center',
    gap: space[2],
    backgroundColor: colors.surfaceRaised,
  },
  tilePressed: {
    backgroundColor: colors.surfaceSunken,
  },
  tileCompact: {
    flexDirection: 'row',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingVertical: space[3],
    gap: space[2],
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  caption: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
