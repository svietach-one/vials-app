import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';

import { Button } from '@/components/ui/core/Button';
import { colors, palette, radius, space, typography } from '@/constants/tokens';

/**
 * "You never had one" empty state (routine-step-grouping SCREENS.md §6.1,
 * US-44): the generator determined a step is needed and the shelf cannot
 * fill it. Cobalt-accented — informational, not a warning. Must share no
 * copy/component with {@link OrphanedSlotCard} (US-44 negative).
 */

export interface GapCardProps {
  /** Human-readable missing thing, e.g. "SPF". */
  label: string;
  onFindInCatalog: () => void;
}

export function GapCard({ label, onFindInCatalog }: GapCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.iconCircle}>
        <Icon name="info" size={16} color={colors.statusInfo} />
      </View>
      <Text style={styles.text}>No {label} in your shelf</Text>
      <Button variant="ghost" size="sm" accessibilityRole="button" onPress={onFindInCatalog}>
        Find in catalog
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    backgroundColor: colors.statusInfoTint,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.statusInfoLine,
    borderStyle: 'dashed',
    padding: space[3],
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.white,
    flexShrink: 0,
  },
  text: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    flex: 1,
  },
});
