import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/core/Card';
import { Icon } from '@/components/ui/Icon';
import { Tag } from '@/components/ui/core/Tag';
import { CAPABILITY_LABELS } from '@/constants/labels';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import type { CapabilityKey } from '@/types';

interface Props {
  capabilityTags: CapabilityKey[];
}

/**
 * "Functional profile" insight card (Story 9, FE-19) — extracted verbatim
 * (same JSX/copy/testIDs) from `ExploreCompositionResultScreen.tsx`'s
 * previously-inline `Card` block, so both that screen and
 * `WishlistEntryDetailScreen` render an identical section via
 * `CompositionInsightsSection` (FE-20) rather than a second implementation.
 */
export function FunctionalProfileCard({ capabilityTags }: Props) {
  return (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIconCircle}>
          <Icon name="layers" size={18} color={palette.plum} />
        </View>
        <Text style={styles.cardTitle}>Functional profile</Text>
      </View>
      {capabilityTags.length > 0 ? (
        <View style={styles.tagRow}>
          {capabilityTags.map((key) => (
            <Tag key={key} tone="info">
              {CAPABILITY_LABELS[key]}
            </Tag>
          ))}
        </View>
      ) : (
        <Text style={styles.mutedText}>
          No known functional tags detected in this composition.
        </Text>
      )}
    </Card>
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
