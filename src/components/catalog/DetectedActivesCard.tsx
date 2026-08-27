import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/core/Card';
import { Icon } from '@/components/ui/Icon';
import { Tag } from '@/components/ui/core/Tag';
import { ACTIVE_INGREDIENT_LABELS } from '@/constants/labels';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import type { ActiveIngredientKey } from '@/types';

interface Props {
  resolvedActiveKeys: ActiveIngredientKey[];
}

/**
 * "Detected actives" insight card (Story 9, FE-19) — extracted verbatim
 * (same JSX/copy/testID `detected-actives`) from
 * `ExploreCompositionResultScreen.tsx`'s previously-inline `Card` block
 * (2026-08-27, replaces the removed full raw-token ingredient list — see
 * spec Story 2's supersession note). Reused by `CompositionInsightsSection`
 * (FE-20) for both the result screen and `WishlistEntryDetailScreen`.
 */
export function DetectedActivesCard({ resolvedActiveKeys }: Props) {
  return (
    <View testID="detected-actives">
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIconCircle}>
            <Icon name="droplet" size={18} color={palette.plum} />
          </View>
          <Text style={styles.cardTitle}>Detected actives</Text>
        </View>
        {resolvedActiveKeys.length > 0 ? (
          <View style={styles.tagRow}>
            {resolvedActiveKeys.map((key) => (
              <Tag key={key} tone="safe">
                {ACTIVE_INGREDIENT_LABELS[key] ?? key}
              </Tag>
            ))}
          </View>
        ) : (
          <Text style={styles.mutedText}>
            No known active ingredients detected in this composition.
          </Text>
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
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  mutedText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
});
