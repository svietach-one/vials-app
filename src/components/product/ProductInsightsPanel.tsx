import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { InlineAlert } from '@/components/ui/feedback/InlineAlert';
import { Tag } from '@/components/ui/core/Tag';
import { CAPABILITY_LABELS } from '@/constants/labels';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import type { CapabilityKey, ProductProfile } from '@/types';

/**
 * Product Insights panel — Milestone 1 UI surface for `ProductProfile`
 * (docs/specs/2026-08-05-product-profile-m1.md §5, tech-design FE-8).
 *
 * Presentational only: receives an already-built `profile`, computed
 * upstream by the caller (see `ProductDetailScreen`'s `useMemo`). Never
 * calls the builder itself, never touches a store.
 *
 * IMPORTANT (progress/product-profile-m1.md qa-lead finding): this panel
 * must NOT gate its populated-vs-empty rendering on `profile.overallConfidence`
 * — that field is `insufficient_data` for every profile this milestone
 * because `sensitivityCompatibility` ships unconditionally `insufficient_data`
 * and the rollup takes the worst tier across all required fields. Gating on
 * it here would make the panel always render as empty, defeating its
 * purpose. Instead this renders whatever individual fields are actually
 * populated, and only shows the empty state when there are literally zero
 * resolved active classes.
 */

export interface ProductInsightsPanelProps {
  profile: ProductProfile;
  /** Skeleton state while the profile builds (spec §5) — the build itself is
   *  synchronous/near-instant, but the state must exist for UI consistency. */
  isLoading?: boolean;
}

/** Capability badges are a positive claim — only render when a score is
 *  present AND genuinely above zero. A real deterministic `0` (the product
 *  was checked and does not support this capability) is distinct from
 *  `null`/`insufficient_data` (never checked) — neither renders a badge. */
const BADGE_ORDER: CapabilityKey[] = [
  'barrierRepair',
  'exfoliation',
  'hydration',
  'brightening',
  'pigmentation',
  'acneControl',
  'sebumRegulation',
  'antioxidantProtection',
  'soothing',
  'antiAging',
];

function formatLayeringPosition(layeringOrder: number | null): string {
  return layeringOrder !== null ? `Step ${layeringOrder + 1} in your routine` : 'Not placed';
}

function formatIrritation(score: number | null): string {
  return score !== null ? `${score} / 5` : 'Not enough data';
}

export function ProductInsightsPanel({ profile, isLoading = false }: ProductInsightsPanelProps) {
  if (isLoading) {
    return (
      <View style={styles.card} accessibilityLabel="Loading product insights">
        <View style={[styles.skeletonLine, styles.skeletonLineWide]} />
        <View style={styles.skeletonLine} />
        <View style={[styles.skeletonLine, styles.skeletonLineNarrow]} />
      </View>
    );
  }

  const hasIngredientData = profile.resolvedActiveKeys.length > 0;

  if (!hasIngredientData) {
    return (
      <View style={styles.card}>
        <PanelHeader />
        <InlineAlert
          tone="neutral"
          icon={<Icon name="info" size={14} color={colors.textSecondary} />}
          title="Not enough ingredient data"
        >
          We couldn&apos;t match any known active ingredients for this product yet, so we can&apos;t
          show routine placement or capability badges.
        </InlineAlert>
      </View>
    );
  }

  const badgeKeys = BADGE_ORDER.filter((key) => {
    const score = profile.capabilities[key].score;
    return score !== null && score > 0;
  });

  return (
    <View style={styles.card}>
      <PanelHeader />

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Eligible periods</Text>
        <Text style={styles.rowValue}>
          {profile.routinePosition.eligiblePeriods.length > 0
            ? profile.routinePosition.eligiblePeriods.join(' / ')
            : 'Not placed'}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Layering position</Text>
        <Text style={styles.rowValue}>
          {formatLayeringPosition(profile.routinePosition.layeringOrder)}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Irritation</Text>
        <Text style={styles.rowValue}>{formatIrritation(profile.irritation.score)}</Text>
      </View>

      {badgeKeys.length > 0 ? (
        <View style={styles.tagWrap}>
          {badgeKeys.map((key) => (
            <Tag key={key} tone="safe">
              {CAPABILITY_LABELS[key]}
            </Tag>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function PanelHeader() {
  return (
    <View style={styles.cardHeader}>
      <View style={styles.cardIconCircle}>
        <Icon name="activity" size={18} color={palette.plum} />
      </View>
      <Text style={styles.cardTitle}>Product Insights</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: space[4],
    gap: space[3],
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  cardIconCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: palette.plumTint,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardTitle: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space[2],
  },
  rowLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  rowValue: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  skeletonLine: {
    height: 14,
    borderRadius: radius.xs,
    backgroundColor: colors.surfaceSunken,
  },
  skeletonLineWide: {
    width: '60%',
  },
  skeletonLineNarrow: {
    width: '40%',
  },
});
