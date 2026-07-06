import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors, radius, space } from '@/constants/tokens';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CatalogFilterTriggerProps {
  activeFilterCount: number;
  onPress: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CatalogFilterTrigger({ activeFilterCount, onPress }: CatalogFilterTriggerProps) {
  const hasActiveFilters = activeFilterCount > 0;
  const accessibilityLabel = hasActiveFilters
    ? `Open filters, ${activeFilterCount} active`
    : 'Open filters';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={styles.trigger}
    >
      <Feather name="sliders" size={18} color={colors.textPrimary} />
      {hasActiveFilters ? <View testID="filter-trigger-badge" style={styles.badge} /> : null}
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  trigger: {
    width: space.hitMin,
    height: space.hitMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.statusInfo,
  },
});
