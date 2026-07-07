import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors, radius, space, typography } from '@/constants/tokens';

export interface OptimizeStripProps {
  /** True when validate found avoid-level findings — the strip lights up. */
  hasFindings: boolean;
  onPress: () => void;
}

/**
 * Entry point B (research §3): the contextual action strip at the very
 * bottom of a populated routine view. Doubles as the validate-mode finding
 * indicator — an avoid-level finding highlights it quietly (amber tint, no
 * banner, no modal; conflict surfacing stays inside routines).
 */
export function OptimizeStrip({ hasFindings, onPress }: OptimizeStripProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Optimize or Regenerate Routine"
      style={({ pressed }) => [
        styles.strip,
        hasFindings && styles.stripHighlighted,
        pressed && styles.stripPressed,
      ]}
    >
      <View style={styles.labelRow}>
        <Feather
          name="refresh-cw"
          size={14}
          color={hasFindings ? colors.statusWarning : colors.textPrimary}
        />
        <Text style={[styles.label, hasFindings && styles.labelHighlighted]}>
          Optimize or Regenerate Routine
        </Text>
      </View>
      {hasFindings ? (
        <View style={styles.badge}>
          <Feather name="alert-triangle" size={13} color={colors.statusWarning} />
          <Text style={styles.badgeText}>Suggestions available</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderDivider,
    backgroundColor: colors.surfaceCard,
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    alignItems: 'center',
    gap: space[1],
  },
  stripHighlighted: {
    borderColor: colors.statusWarningLine,
    backgroundColor: colors.statusWarningTint,
  },
  stripPressed: {
    opacity: 0.7,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
  },
  label: {
    ...typography.body,
    color: colors.textPrimary,
  },
  labelHighlighted: {
    fontFamily: typography.label.fontFamily,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
  },
  badgeText: {
    ...typography.bodySmall,
    color: colors.statusWarning,
  },
});
