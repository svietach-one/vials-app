import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors, space, typography } from '@/constants/tokens';

/**
 * Story 2 (routine-similar-product-priority): "Also on your shelf" row for a
 * non-admitted same-slot product, rendered under its winner in Draft
 * Preview's After column. A one-tap swap action bubbles up via `onSwap` — the
 * parent (DraftPreviewSheet -> RoutinesScreen) owns rewriting the still-
 * uncommitted draft (tech design §1); nothing here mutates the plan.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SlotAlternativeRowProps {
  /** The currently-admitted product this row is an alternative to. */
  winnerProductName: string;
  alternativeProductName: string;
  onSwap: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SlotAlternativeRow({
  winnerProductName,
  alternativeProductName,
  onSwap,
}: SlotAlternativeRowProps) {
  return (
    <View style={styles.row}>
      <Feather name="corner-down-right" size={13} color={colors.textTertiary} />
      <Text style={styles.text} numberOfLines={1}>
        {`Also on your shelf: ${alternativeProductName}`}
      </Text>
      <Pressable
        onPress={onSwap}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Swap to ${alternativeProductName}`}
        accessibilityHint={`Replaces ${winnerProductName} in this routine`}
      >
        <Text style={styles.swap}>Swap</Text>
      </Pressable>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingLeft: space[2],
  },
  text: {
    ...typography.caption,
    color: colors.textTertiary,
    flex: 1,
  },
  swap: {
    ...typography.caption,
    color: colors.statusInfo,
    fontFamily: 'DMSans-Medium',
  },
});
