import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/core/Card';
import { Icon } from '@/components/ui/Icon';
import {
  ACTIVE_INGREDIENT_LABELS,
  getSlotCategoryLabel,
  getSlotCategoryLabelPlural,
} from '@/constants/labels';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import type { ShelfComparisonResult } from '@/utils/productProfile/shelfComparison';

interface Props {
  comparison: ShelfComparisonResult;
}

/** 1-decimal average, per the tech design's shelf-comparison-rendering assumption. */
function formatAverage(value: number): string {
  return value.toFixed(1);
}

/**
 * Story 6 comparison matrix (2026-08-26 decision batch, FE-13). Exactly 4
 * rows against the user's own same-category Shelf items — never a 5th
 * parameter, never position/concentration/skin-type-suitability (spec Story
 * 6, §3 Non-Goals). Renders a plain zero-items message instead of the rows
 * when `sameCategoryCount` is 0 — never fabricated comparison numbers. The
 * two averages additionally surface their real data coverage
 * (`sameCategoryWithDataCount` of `sameCategoryCount`) instead of silently
 * averaging in same-category items with no recorded ingredient data; when
 * none of the same-category items have data, this reads as "no data
 * available", never as a real zero score (2026-08-26 tech-lead fix).
 */
export function CompositionComparisonMatrix({ comparison }: Props) {
  const { category, sameCategoryCount, sameCategoryWithDataCount } = comparison;
  const hasCoverage = sameCategoryWithDataCount > 0;

  // testID lives on the outer View, not <Card> — the test suite's Card mock
  // renders only `children`, dropping any other prop, so a testID placed
  // directly on Card would never reach the rendered tree.
  return (
    <View testID="composition-comparison-matrix">
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIconCircle}>
            <Icon name="grid" size={18} color={palette.plum} />
          </View>
          <Text style={styles.cardTitle}>Compare to your Shelf</Text>
        </View>

        {sameCategoryCount === 0 ? (
          <Text style={styles.mutedText}>
            No other {getSlotCategoryLabelPlural(category)} on your Shelf yet to compare against.
          </Text>
        ) : (
          <View style={styles.rows}>
            <View style={styles.row} testID="matrix-row-functional-breadth">
              <Text style={styles.rowLabel}>Functional profile breadth</Text>
              <View style={styles.rowValues}>
                <Text style={styles.rowValue}>{comparison.thisFunctionalTagCount}</Text>
                <Text style={styles.rowMuted}>
                  {hasCoverage
                    ? `Shelf avg ${formatAverage(comparison.shelfFunctionalTagAverage)} (${sameCategoryWithDataCount} of ${sameCategoryCount} with data)`
                    : `No ingredient data yet among your ${sameCategoryCount} same-category Shelf items`}
                </Text>
              </View>
            </View>

            <View style={styles.row} testID="matrix-row-ingredient-count">
              <Text style={styles.rowLabel}>Ingredient count</Text>
              <View style={styles.rowValues}>
                <Text style={styles.rowValue}>{comparison.thisIngredientCount}</Text>
                <Text style={styles.rowMuted}>
                  {hasCoverage
                    ? `Shelf avg ${formatAverage(comparison.shelfIngredientCountAverage)} (${sameCategoryWithDataCount} of ${sameCategoryCount} with data)`
                    : `No ingredient data yet among your ${sameCategoryCount} same-category Shelf items`}
                </Text>
              </View>
            </View>

            <View style={styles.row} testID="matrix-row-active-tags">
              <Text style={styles.rowLabel}>Active tags</Text>
              <View style={styles.rowValues}>
                <Text style={styles.rowValue}>
                  {comparison.thisActiveKeys.length > 0
                    ? comparison.thisActiveKeys.map((key) => ACTIVE_INGREDIENT_LABELS[key]).join(', ')
                    : 'None detected'}
                </Text>
                <Text style={styles.rowMuted}>
                  {comparison.shelfActiveTagOverlapCount} Shelf {getSlotCategoryLabelPlural(category)}{' '}
                  share a tag
                </Text>
              </View>
            </View>

            <View style={styles.row} testID="matrix-row-category-signal">
              <Text style={styles.rowLabel}>Category</Text>
              <View style={styles.rowValues}>
                <Text style={styles.rowValue}>{getSlotCategoryLabel(category)}</Text>
                <Text style={styles.rowMuted}>{sameCategoryCount}</Text>
                <Text style={styles.rowMuted}>on your Shelf</Text>
              </View>
            </View>
          </View>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: space[4],
    gap: space[3],
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  cardIconCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: palette.plumTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  mutedText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  rows: {
    gap: space[3],
  },
  row: {
    gap: space[1],
  },
  rowLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  rowValues: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space[2],
    flexWrap: 'wrap',
  },
  rowValue: {
    ...typography.body,
    color: colors.textPrimary,
  },
  rowMuted: {
    ...typography.caption,
    color: colors.textTertiary,
  },
});
