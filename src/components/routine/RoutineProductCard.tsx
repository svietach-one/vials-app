import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';

import { AllergenBadge } from '@/components/ui/AllergenBadge';
import { IconButton } from '@/components/ui/core/IconButton';
import { Badge } from '@/components/ui/feedback/Badge';
import { ProductThumbnail } from '@/components/ui/ProductThumbnail';
import { ACTIVE_INGREDIENT_LABELS } from '@/constants/labels';
import { colors, palette, radius, shadow, space, typography } from '@/constants/tokens';
import { getProductAllergenMatches } from '@/utils/allergenDetector';
import type { ActiveIngredientKey, Product, ProductType, Zone } from '@/types';

/**
 * The single "does this product carry an active ingredient" signal, shared
 * with `DuplicateSlotWarningInline`/`RoutinesScreen`'s similar-slot
 * notification gating (routine-step-grouping polish round 3, Change 1
 * addendum) so both places agree with this card's own lightning badge on
 * what counts as "has an active". `activeTags` wins whenever defined (even
 * empty — an explicit "no confirmed actives"), `activeIngredients` is the
 * fallback for older records that only ever populated that field.
 */
export function getPrimaryActiveKey(
  product: Pick<Product, 'activeTags' | 'activeIngredients'>,
): ActiveIngredientKey | null {
  return product.activeTags?.[0] ?? product.activeIngredients?.[0]?.key ?? null;
}

/**
 * Replaces `RoutineStepCard` on the Routine screen (routine-step-grouping
 * SCREENS.md §4). `RoutineStepCard.tsx` itself is left in place, unused by
 * this screen — it still has its own standalone component test suites
 * outside this task's scope (progress/routine-step-grouping.md log).
 */

export interface RoutineProductCardProps {
  product: Product;
  /** Reclassified type (e.g. a mistyped micellar water) — no longer consumed
   *  by this component since the product-type badge was removed (routine-
   *  step-grouping polish round 3), kept on the prop contract since
   *  RoutinesScreen still computes and passes it. */
  displayProductType?: ProductType;
  completed: boolean;
  editMode: boolean;
  /** Only consulted when `editMode` is false. */
  tappable: boolean;
  onToggleComplete?: () => void;
  /** Edit-mode body tap — opens the overflow action sheet. */
  onOpenActionSheet?: () => void;
  /** Edit-mode Pause icon. */
  onPausePress?: () => void;
  /** Edit-mode Schedule icon. */
  onSchedulePress?: () => void;
  conflictingProductName?: string | null;
  /** Story 3 (routine-similar-product-priority), per-card echo of the passive
   *  top-of-screen DuplicateSlotWarningInline banner — same detection
   *  (findSlotDuplicateGroups), same icon/color, one other product name. */
  similarProductName?: string | null;
  adaptationWeek?: number | null;
}

const ZONE_LABELS: Record<Zone, string> = {
  face: 'Face',
  eyes: 'Eyes',
  neck: 'Neck',
  lips: 'Lips',
  hands: 'Hands',
};

/** Zone tag text for the meta line, or null when the default (absent/[]/
 *  exactly ['face']) carries nothing worth rendering (SCREENS.md §4.7). */
function zoneTagText(zones: Zone[] | undefined): string | null {
  if (!zones || zones.length === 0) return null;
  if (zones.length === 1 && zones[0] === 'face') return null;
  return zones.map((z) => ZONE_LABELS[z]).join(' · ');
}

export function RoutineProductCard({
  product,
  displayProductType,
  completed,
  editMode,
  tappable,
  onToggleComplete,
  onOpenActionSheet,
  onPausePress,
  onSchedulePress,
  conflictingProductName,
  similarProductName,
  adaptationWeek,
}: RoutineProductCardProps) {
  const isReapply = product.timing === 'reapply';
  const zoneText = zoneTagText(product.zones);
  const reapplyText = isReapply ? `reapply after ~${product.reapplyAfterHours} h` : null;
  const hasMetaLine = zoneText !== null || reapplyText !== null;

  const activeKey = getPrimaryActiveKey(product);
  const activeLabel = activeKey ? (ACTIVE_INGREDIENT_LABELS[activeKey] ?? null) : null;
  const allergenMatches = getProductAllergenMatches(product);

  const hasConflict = !!conflictingProductName;
  const hasSimilarTip = !!similarProductName;
  const hasBelowContent = hasConflict || hasSimilarTip || adaptationWeek != null;

  const accessibilityLabel = [
    product.brand,
    product.name,
    zoneText,
    completed ? 'completed' : 'not completed',
  ]
    .filter((part): part is string => !!part)
    .join(', ');

  function handlePress() {
    if (editMode) {
      onOpenActionSheet?.();
      return;
    }
    if (tappable) onToggleComplete?.();
  }

  // Edit-mode Pause/Schedule icons, the "Completed" badge, and the
  // active-ingredient lightning badge all live on the brand-name row now
  // (relocated from rightCluster) — one slot, same priority order the old
  // rightCluster used (edit icons > completed > active ingredient). Only
  // AllergenBadge stays behind in rightCluster, with its original
  // visibility rule unchanged (hidden in edit mode or once completed).
  const headerRowIcons = editMode ? (
    <View style={styles.editIconsRow}>
      <IconButton
        testID="pause-icon"
        icon={<Icon name="pause-circle" size={18} color={colors.textSecondary} />}
        label="Pause"
        variant="ghost"
        size="sm"
        onPress={(e) => {
          e?.stopPropagation?.();
          onPausePress?.();
        }}
      />
      <IconButton
        testID="schedule-icon"
        icon={<Icon name="calendar" size={18} color={colors.textSecondary} />}
        label="Schedule"
        variant="ghost"
        size="sm"
        onPress={(e) => {
          e?.stopPropagation?.();
          onSchedulePress?.();
        }}
      />
    </View>
  ) : completed ? (
    <Badge testID="completed-badge" status="Cabernet" type="Dark">
      Completed
    </Badge>
  ) : activeLabel && activeKey ? (
    <View testID={`active-badge-${activeKey}`} style={styles.activeBadge}>
      <Icon name="zap" size={16} color={palette.zinc600} />
    </View>
  ) : null;
  // When product.brand is absent, the row still renders for the icon slot
  // alone (justify-content: space-between collapses to flex-start for a
  // single child) rather than moving the slot down onto productName's own
  // line — keeps productName's line reserved for the name only, and avoids
  // the icon's vertical position jumping between products depending on
  // whether they have a brand.
  const showHeaderRow = !!product.brand || !!headerRowIcons;

  const rightCluster = !editMode && !completed ? <AllergenBadge matches={allergenMatches} /> : null;

  return (
    // Shadow lives on this outer, non-clipping wrapper — the Pressable below
    // needs overflow:hidden to clip the edge-to-edge photo to the rounded
    // corners, but overflow:hidden also clips the shadow itself (it renders
    // outside the view's bounds on iOS), so the two can't share a node. Same
    // split ProductShelfCard.tsx already uses for the same reason.
    <View style={completed ? styles.cardShadowCompleted : styles.cardShadow}>
      <Pressable
        testID="routine-product-card"
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityState={{ checked: completed }}
        accessibilityLabel={accessibilityLabel}
        style={[styles.card, completed && styles.cardCompleted]}
      >
        <View style={styles.mainRow}>
          <View style={styles.thumbnailWrap}>
            <ProductThumbnail product={product} fill squareBottomLeft={hasBelowContent} dimmed={completed} />
          </View>

          <View style={styles.textColumn}>
            {showHeaderRow ? (
              <View style={styles.headerRow}>
                {product.brand ? (
                  <Text style={[styles.brandName, styles.brandNameFlex, completed && styles.textDimmed]} numberOfLines={1}>
                    {product.brand}
                  </Text>
                ) : null}
                {headerRowIcons}
              </View>
            ) : null}
            <Text style={[styles.productName, completed && styles.textDimmed]} numberOfLines={1}>
              {product.name}
            </Text>
            {hasMetaLine ? (
              <View testID="meta-line" style={styles.metaLine}>
                {zoneText ? (
                  <Text style={styles.metaText} numberOfLines={1}>
                    {zoneText}
                  </Text>
                ) : null}
                {reapplyText ? (
                  <Text style={[styles.metaText, isReapply && !completed && styles.reapplyText]} numberOfLines={1}>
                    {reapplyText}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>

          {rightCluster ? <View style={styles.rightCluster}>{rightCluster}</View> : null}
        </View>

        {hasBelowContent ? (
          <View style={styles.belowContent}>
            {hasConflict ? (
              <View style={styles.conflictRow}>
                <Icon name="alert-triangle" size={16} color={colors.statusWarningAccent} />
                <Text style={styles.conflictText} numberOfLines={1}>
                  Conflicts with {conflictingProductName}
                </Text>
              </View>
            ) : null}

            {hasSimilarTip ? (
              <View style={styles.similarRow}>
                <Icon name="layers" size={16} color={colors.statusInfo} />
                <Text style={styles.similarText} numberOfLines={1}>
                  Similar to {similarProductName}
                </Text>
              </View>
            ) : null}

            {adaptationWeek != null ? (
              <View style={styles.adaptationRow}>
                <Icon name="clock" size={18} color={palette.zinc600} />
                <Text style={styles.adaptationText} numberOfLines={2}>
                  Adaptation Phase (Week {adaptationWeek} of 4) — frequency managed to prevent purging
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Shadow-only wrapper — see the comment at the JSX call site for why this
  // can't be merged into `card` (mirrors ProductShelfCard.tsx's cardShadow).
  // cardShadow/cardShadowCompleted are applied EXCLUSIVELY (never merged in
  // the same style array, unlike card/cardCompleted below) — StyleSheet's
  // shallow-merge means a later `...shadow.none` ({}) cannot un-set keys an
  // earlier `...shadow.sm` already set, so each variant must carry its own
  // complete shadow definition (same pattern Card.tsx's variantStyles uses).
  cardShadow: {
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceCard,
    ...shadow.sm,
  },
  cardShadowCompleted: {
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceCard,
    ...shadow.none,
  },
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  cardCompleted: {
    borderWidth: 1,
    borderColor: 'rgba(9, 9, 11, 0.06)',
  },
  // No padding here — the leading photo bleeds flush to the card's left/top/
  // bottom edges (see ProductThumbnail's `fill` mode, and ProductShelfCard's
  // rowWrap for the same pattern). Vertical/trailing padding lives on
  // textColumn/rightCluster instead, around the text content only.
  mainRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: space[3],
  },
  // flexDirection: 'row' matters here, not just visually — see
  // ProductShelfCard.tsx's thumbnailWrap comment for why the cross-axis must
  // stay height for ProductThumbnail's `alignSelf: 'stretch'` chain to work.
  thumbnailWrap: {
    flexDirection: 'row',
  },
  textColumn: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    paddingVertical: space[3],
  },
  // Holds brand name plus (when present) the active-ingredient lightning
  // badge or, in edit mode, the Pause/Schedule icons — all on one line,
  // per the human's request to move those off the right cluster.
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
  },
  brandName: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  brandNameFlex: {
    flex: 1,
  },
  productName: {
    ...typography.body,
    fontFamily: 'DMSans-Bold',
    color: colors.textPrimary,
  },
  textDimmed: {
    color: colors.textSecondary,
  },
  metaLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[1],
  },
  metaText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  reapplyText: {
    fontStyle: 'italic',
  },
  rightCluster: {
    flexShrink: 0,
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: space[2],
    paddingVertical: space[3],
    paddingRight: space[3],
  },
  editIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
  },
  activeBadge: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSunken,
  },
  // Holds every row rendered below mainRow (conflict/similar-slot/adaptation).
  // Reproduces the horizontal/bottom padding and gap the card used to carry
  // on itself before the leading photo went edge-to-edge (see mainRow).
  belowContent: {
    paddingTop: space[2],
    paddingHorizontal: space[3],
    paddingBottom: space[3],
    gap: space[2],
  },
  conflictRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: space[2],
    borderTopWidth: 1,
    borderTopColor: palette.amberLine,
  },
  conflictText: {
    ...typography.bodySmall,
    color: palette.amber,
    flexShrink: 1,
  },
  // Per-card echo of DuplicateSlotWarningInline's top-of-screen banner — same
  // icon/color (layers, statusInfo/cobalt), same bordered-top row shape as
  // conflictRow.
  similarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: space[2],
    borderTopWidth: 1,
    borderTopColor: colors.statusInfoLine,
  },
  similarText: {
    ...typography.bodySmall,
    color: colors.statusInfo,
    flexShrink: 1,
  },
  adaptationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[2],
    paddingTop: space[2],
    borderTopWidth: 1,
    borderTopColor: colors.borderDivider,
  },
  adaptationText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flexShrink: 1,
  },
});
