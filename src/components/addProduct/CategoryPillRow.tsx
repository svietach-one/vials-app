import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { FilterChip } from '@/components/ui/core/FilterChip';
import { PRODUCT_TYPE_LABELS } from '@/constants/labels';
import { colors, space, typography } from '@/constants/tokens';
import type { ProductType } from '@/types';

/**
 * The wizard's fixed category set (per docs/specs/add-product-flow/07).
 * Deliberately narrower than the full catalog PRODUCT_TYPE_LABELS list the
 * FilterSheet derives its options from — categoryDetector only ever returns
 * one of these eight.
 */
export const PRODUCT_TYPE_OPTIONS: ProductType[] = [
  'cleanser',
  'serum',
  'moisturizer',
  'toner',
  'spf',
  'mask',
  'oil',
  'peeling',
];

export interface CategoryPillRowProps {
  selected: ProductType | null;
  /** True while productTypeSource === 'auto-detected'. */
  autoDetected: boolean;
  onSelect: (type: ProductType) => void;
}

export function CategoryPillRow({ selected, autoDetected, onSelect }: CategoryPillRowProps) {
  return (
    <View style={styles.wrap}>
      {autoDetected ? <Text style={styles.caption}>auto-detected from label</Text> : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {PRODUCT_TYPE_OPTIONS.map((type) => (
          <FilterChip
            key={type}
            selected={selected === type}
            onPress={() => onSelect(type)}
          >
            {PRODUCT_TYPE_LABELS[type]}
          </FilterChip>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space[2],
  },
  caption: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  row: {
    gap: space[2],
  },
});
