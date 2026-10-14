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
  /**
   * Which routine the gap is in. Supplied, the copy names it ("No Cleanser in
   * your morning routine") instead of asserting something about the shelf.
   * A slot can be unfilled for THIS period while the user owns a product that
   * is limited to the other one (evening-only cleanser, AM-only SPF), where
   * "in your shelf" was simply false (tech-lead review 2026-10-14, W1).
   */
  period?: 'morning' | 'evening';
  onFindInCatalog: () => void;
}

export function GapCard({ label, period, onFindInCatalog }: GapCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.iconCircle}>
        <Icon name="info" size={16} color={colors.statusInfo} />
      </View>
      <Text style={styles.text}>
        {period ? `No ${label} in your ${period} routine` : `No ${label} in your shelf`}
      </Text>
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
