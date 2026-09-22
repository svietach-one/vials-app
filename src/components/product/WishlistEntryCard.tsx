import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/core/Button';
import { Card } from '@/components/ui/core/Card';
import { colors, space, typography } from '@/constants/tokens';
import type { WishlistEntry } from '@/types';

/**
 * Wishlist tab's card for a `WishlistEntry` — sibling to, not shared with,
 * `WishlistProductCard.tsx` (tech design FE-7): a `WishlistEntry` may have no
 * brand/name yet and carries no `Product`-shaped capability/routine data, so
 * its actions and shape are deliberately different, not a variant of the
 * same card.
 *
 * `Remove` (the `onDelete` prop — label changed 2026-08-28 to match
 * `WishlistProductCard.tsx`'s own wording) fires immediately with no
 * confirmation modal (spec Story 3 AC3) — `DeleteProductModal` is never
 * imported here. `Move to Shelf` (spec Story 3 AC2 / Story 5 AC1) hands the
 * full entry to the caller so it can open the shared completion form
 * pre-filled.
 */
export interface WishlistEntryCardProps {
  entry: WishlistEntry;
  onCardPress: (entry: WishlistEntry) => void;
  onPromote: (entry: WishlistEntry) => void;
  onDelete: (entry: WishlistEntry) => void;
}

export function WishlistEntryCard({ entry, onCardPress, onPromote, onDelete }: WishlistEntryCardProps) {
  return (
    <Card interactive onPress={() => onCardPress(entry)} padding="none" style={styles.card}>
      <View style={styles.content}>
        {entry.brand ? (
          <Text style={styles.brand} numberOfLines={1}>
            {entry.brand}
          </Text>
        ) : null}
        <Text style={styles.name} numberOfLines={1}>
          {entry.name ?? 'Untitled composition'}
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.actionsRow}>
        <Button
          variant="secondary"
          size="sm"
          onPress={(e) => {
            e?.stopPropagation?.();
            onPromote(entry);
          }}
          style={styles.promoteBtn}
        >
          Move to Shelf
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onPress={(e) => {
            e?.stopPropagation?.();
            onDelete(entry);
          }}
        >
          Remove
        </Button>
      </View>
    </Card>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    padding: space[4],
    gap: space[3],
  },
  content: {
    gap: 2,
  },
  brand: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  name: {
    ...typography.body,
    fontFamily: 'DMSans-Bold',
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderDivider,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  promoteBtn: {
    flex: 1,
  },
});
