import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { InlineAlert } from '@/components/ui/feedback/InlineAlert';
import { getSlotCategoryLabelPlural } from '@/constants/labels';
import { colors, space } from '@/constants/tokens';
import { findSlotDuplicateGroups } from '@/utils/routineEngine/duplicateSlot';
import { getSlotIndex } from '@/utils/routineEngine/slotting';
import type { Product, Routine } from '@/types';

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

// ─── Component ────────────────────────────────────────────────────────────────

export function DuplicateSlotWarningInline({ routines, products, onPressGroup }: DuplicateSlotWarningInlineProps) {
  const rows: Row[] = routines.flatMap((routine) =>
    findSlotDuplicateGroups(routine.steps).map((group) => {
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

  // products is consumed by the wiring caller today via onPressGroup's
  // productIds; kept as a prop for shape-parity with ConflictWarningInline
  // and for future name-bearing copy without a prop-shape change.
  void products;

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
            icon={<Feather name="layers" size={14} color={colors.statusInfo} />}
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
