import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';

import { Button } from '@/components/ui/core/Button';
import { colors, radius, space, typography } from '@/constants/tokens';

/**
 * "You had one and it is gone" empty state (routine-step-grouping
 * SCREENS.md §6.2, US-44): a persisted `RoutineStep` whose `productId` no
 * longer resolves to a catalog product. Neutral (not Cobalt) — a repair, not
 * a suggestion. Must share no copy/component with {@link GapCard}.
 */

export interface OrphanedSlotCardProps {
  onAddFromCatalog: () => void;
  onPause: () => void;
}

export function OrphanedSlotCard({ onAddFromCatalog, onPause }: OrphanedSlotCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Icon name="alert-circle" size={16} color={colors.textTertiary} />
        <Text style={styles.text}>Product removed</Text>
      </View>
      <View style={styles.actions}>
        <Button variant="secondary" size="sm" accessibilityRole="button" onPress={onAddFromCatalog}>
          Add from catalog
        </Button>
        <Button variant="ghost" size="sm" accessibilityRole="button" onPress={onPause}>
          Pause
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space[2],
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.lg,
    padding: space[3],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  text: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: space[2],
  },
});
