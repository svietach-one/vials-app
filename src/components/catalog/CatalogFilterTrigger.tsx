import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { IconButton } from '@/components/ui/core/IconButton';
import { colors, radius } from '@/constants/tokens';

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
    <IconButton
      icon={
        <>
          <Feather name="sliders" size={18} color={colors.textPrimary} />
          {hasActiveFilters ? <View testID="filter-trigger-badge" style={styles.badge} /> : null}
        </>
      }
      label={accessibilityLabel}
      variant="ghost"
      // Sized to sit beside the header's "+" action, which is sm too.
      size="sm"
      onPress={onPress}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Tucked into the glyph's top-right corner: (36px box − 18px icon) / 2 = 9,
  // minus 3 so the dot overlaps the icon rather than floating off it.
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.statusInfo,
  },
});
