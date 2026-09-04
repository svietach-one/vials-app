import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';

import { InlineAlert } from '@/components/ui/feedback/InlineAlert';
import { getPrimaryActiveKey } from '@/components/routine/RoutineProductCard';
import { getSlotCategoryLabelPlural } from '@/constants/labels';
import { colors, space } from '@/constants/tokens';
import { findSlotDuplicateGroups } from '@/utils/routineEngine/duplicateSlot';
import { getSlotIndex } from '@/utils/routineEngine/slotting';
import type { Product, Routine, RoutineStep } from '@/types';

/**
 * Story 3 (routine-similar-product-priority): passive, non-blocking banner
 * for routines that already contain 2+ steps sharing a layering slot. Sibling
 * to ConflictWarningInline but a lower/advisory `tone="info"` — this is a
 * flat signal, never severity-graded, and never blocks viewing/editing.
 * Groups are computed PER ROUTINE (findSlotDuplicateGroups scopes to one
 * routine's steps) — a single moisturizer in AM plus a single moisturizer in
 * PM is never flagged. Returns null when nothing to show.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DuplicateSlotGroupPress {
  routineId: string;
  slotIndex: number;
  productIds: string[];
}

export interface DuplicateSlotWarningInlineProps {
  routines: Routine[];
  products: Product[];
  onPressGroup: (group: DuplicateSlotGroupPress) => void;
}

interface Row {
  key: string;
  routineId: string;
  slotIndex: number;
  productIds: string[];
  message: string;
}

/**
 * routine-step-grouping polish round 3 (Change 1 addendum): the notification
 * fires only when the duplicated products actually overlap on active
 * ingredients — two plain moisturizers with no actives should never trigger
 * it. ALL group members must carry a non-null primary active key (not just
 * one): the notification is warning about redundant exposure to the SAME
 * active effect, and a group with only one active-bearing member doesn't
 * actually create that redundancy on this axis. Display-layer filter only —
 * findSlotDuplicateGroups' own detection is unchanged. Exported so
 * RoutinesScreen's per-card similarMap (the other Change-1 display site) can
 * apply the identical rule instead of duplicating it.
 */
export function groupHasActiveIngredientOverlap(group: RoutineStep[], products: Product[]): boolean {
  return group.every((step) => {
    const product = step.productId ? products.find((p) => p.id === step.productId) : undefined;
    return !!product && getPrimaryActiveKey(product) != null;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DuplicateSlotWarningInline({ routines, products, onPressGroup }: DuplicateSlotWarningInlineProps) {
  const rows: Row[] = routines.flatMap((routine) =>
    findSlotDuplicateGroups(routine.steps, products)
      .filter((group) => groupHasActiveIngredientOverlap(group, products))
      .map((group) => {
        const slotIndex = getSlotIndex(group[0].productType);
        const label = getSlotCategoryLabelPlural(group[0].productType);
        return {
          key: `${routine.id}-${slotIndex}`,
          routineId: routine.id,
          slotIndex,
          productIds: group.flatMap((s) => (s.productId ? [s.productId] : [])),
          message: `${group.length} similar products (${label}) in this routine`,
        };
      }),
  );

  if (rows.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {rows.map((row) => (
        <Pressable
          key={row.key}
          accessibilityRole="button"
          accessibilityLabel={row.message}
          onPress={() =>
            onPressGroup({ routineId: row.routineId, slotIndex: row.slotIndex, productIds: row.productIds })
          }
        >
          <InlineAlert
            tone="info"
            icon={<Icon name="layers" size={16} color={colors.statusInfo} />}
          >
            {row.message}
          </InlineAlert>
        </Pressable>
      ))}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: {
    gap: space[3],
  },
});
