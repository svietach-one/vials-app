import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FilterChip } from '@/components/ui/core/FilterChip';
import { PRODUCT_TYPE_LABELS } from '@/constants/labels';
import { colors, space, typography } from '@/constants/tokens';
import type { ProductType } from '@/types';

/**
 * The full catalog type set, in the same layering-adjacent order as
 * PRODUCT_TYPE_LABELS. categoryDetector only ever auto-fills one of a
 * narrower subset, but manual entry must be able to reach every type —
 * a wrapping row (no horizontal scroll) so nothing is hidden off-screen.
 */
export const PRODUCT_TYPE_OPTIONS: ProductType[] = Object.keys(
  PRODUCT_TYPE_LABELS,
) as ProductType[];

export interface CategoryPillRowProps {
  selected: ProductType | null;
  /** True while productTypeSource === 'auto-detected'. */
  autoDetected: boolean;
  onSelect: (type: ProductType) => void;
}

export function CategoryPillRow({ selected, autoDetected, onSelect }: CategoryPillRowProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Type</Text>
      {autoDetected ? <Text style={styles.caption}>auto-detected from label</Text> : null}
      <View style={styles.row}>
        {PRODUCT_TYPE_OPTIONS.map((type) => (
          <FilterChip
            key={type}
            selected={selected === type}
            onPress={() => onSelect(type)}
          >
            {PRODUCT_TYPE_LABELS[type]}
          </FilterChip>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space[2],
  },
  label: {
    ...typography.label,
    color: colors.textPrimary,
  },
  caption: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
});
