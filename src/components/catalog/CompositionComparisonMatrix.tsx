import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/core/Card';
import { Icon } from '@/components/ui/Icon';
import { ACTIVE_INGREDIENT_LABELS, getSlotCategoryLabel, getSlotCategoryLabelPlural } from '@/constants/labels';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import { formatLabelList } from '@/utils/productProfile/productLabel';
import type { ShelfComparisonResult } from '@/utils/productProfile/shelfComparison';
import type { SharedActive } from '@/utils/productProfile/shelfOverlap';

interface Props {
  comparison: ShelfComparisonResult;
  /** Whole-Shelf active overlap (explore-insights-v2 task 04) — not category-filtered, unlike `comparison`. */
  shelfOverlap: SharedActive[];
  /** Total Shelf product count, regardless of category — distinguishes "empty Shelf" from "no same-category items". */
  shelfProductCount: number;
}

/** At most 3 labels, then a `+{n} more` suffix — copy per task 04. */
const MAX_OVERLAP_PRODUCT_LABELS = 3;

/** Show at most 4 overlapping actives — copy per task 04. */
const MAX_OVERLAP_ROWS = 4;

/**
 * "How this fits your Shelf" insight card (explore-insights-v2 task 04,
 * superseding the 2026-08-26 decision batch's original 4-parameter matrix).
 * `Functional profile breadth` and `Ingredient count` are deleted (plan
 * decision D2) — abstract shelf statistics that changed no purchase
 * decision. `Active tags` is replaced by a NAMED overlap block: which
 * actives this composition shares with the Shelf, and which specific
 * products carry them, scanned across the WHOLE Shelf regardless of
 * category (`shelfOverlap`, unlike `comparison`, which stays
 * category-filtered per its own documented contract). `Category` is
 * unchanged.
 *
 * Overlap detection is informational, not a conflict — no amber, no
 * cabernet; the flow's existing `palette.plum`/muted-text treatment only.
 * Conflict detection on this screen remains a non-goal (plan decision D3).
 */
export function CompositionComparisonMatrix({ comparison, shelfOverlap, shelfProductCount }: Props) {
  const { category, sameCategoryCount } = comparison;

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
          <Text style={styles.cardTitle}>How this fits your Shelf</Text>
        </View>

        {shelfProductCount === 0 ? (
          <Text style={styles.mutedText}>Your Shelf is empty — add a product to start comparing.</Text>
        ) : (
          <View style={styles.rows}>
            {/*
              Overlap detection scans the WHOLE Shelf regardless of category
              (task 04's core point — a niacinamide moisturiser duplicates a
              niacinamide serum just as surely), so this block renders
              independently of `sameCategoryCount` below, never nested inside
              its zero-state.
            */}
            <View style={styles.overlapBlock} testID="matrix-row-shelf-overlap">
              {shelfOverlap.length === 0 ? (
                // A result, not an empty state — the composition fills a gap.
                // Rendered in the normal content style, never EmptyState/greyed out.
                <Text style={styles.rowLabel}>Nothing on your Shelf overlaps with this composition.</Text>
              ) : (
                <>
                  {shelfOverlap.slice(0, MAX_OVERLAP_ROWS).map((shared) => (
                    <View
                      key={shared.key}
                      testID={`shelf-overlap-row-${shared.key}`}
                      style={styles.overlapRow}
                    >
                      <Text style={styles.rowLabel}>
                        {ACTIVE_INGREDIENT_LABELS[shared.key] ?? shared.key} — you already have{' '}
                        {shared.products.length}
                      </Text>
                      <Text style={styles.rowMuted}>
                        {formatLabelList(
                          shared.products.map((p) => p.label),
                          MAX_OVERLAP_PRODUCT_LABELS,
                        )}
                      </Text>
                    </View>
                  ))}
                  {shelfOverlap.length > MAX_OVERLAP_ROWS ? (
                    <Text style={styles.rowMuted}>
                      +{shelfOverlap.length - MAX_OVERLAP_ROWS} more shared with your Shelf
                    </Text>
                  ) : null}
                </>
              )}
            </View>

            {sameCategoryCount === 0 ? (
              <Text style={styles.mutedText}>
                No other {getSlotCategoryLabelPlural(category)} on your Shelf yet to compare against.
              </Text>
            ) : (
              <View style={styles.row} testID="matrix-row-category-signal">
                <Text style={styles.rowLabel}>Category</Text>
                <View style={styles.rowValues}>
                  <Text style={styles.rowValue}>{getSlotCategoryLabel(category)}</Text>
                  <Text style={styles.rowMuted}>{sameCategoryCount}</Text>
                  <Text style={styles.rowMuted}>on your Shelf</Text>
                </View>
              </View>
            )}
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
  overlapBlock: {
    gap: space[3],
  },
  overlapRow: {
    gap: 2,
  },
  row: {
    gap: space[1],
  },
  rowLabel: {
    ...typography.bodySmall,
    color: colors.textPrimary,
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
