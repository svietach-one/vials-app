import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Icon } from '@/components/ui/Icon';

import { AttributionTooltip } from '@/components/routine/AttributionTooltip';
import { AllergenBadge } from '@/components/ui/AllergenBadge';
import { IconButton } from '@/components/ui/core/IconButton';
import { Badge } from '@/components/ui/feedback/Badge';
import { ProductThumbnail } from '@/components/ui/ProductThumbnail';
import { ACTIVE_INGREDIENT_LABELS, getProductTypeBadgeStatus, PRODUCT_TYPE_LABELS } from '@/constants/labels';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import { getProductAllergenMatches } from '@/utils/allergenDetector';
import { getMatchesForKey, hasAliasOverride } from '@/utils/attributionLookup';
import type { Product, ProductType } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RoutineStepCardProps {
  product: Product;
  onCardPress?: () => void;
  conflictingProductName?: string | null;
  /**
   * DraggableFlatList's `drag` callback. Wired to the card's long press —
   * holding anywhere on the card lifts it, so there is no edit mode to arm
   * and no separate drag handle (img-03).
   */
  onLongPress?: () => void;
  /** Opens the step's overflow action sheet (three-dots, trailing). */
  onOverflowPress?: () => void;
  /**
   * Adaptation week (1–4) while the engine micro-doses this product
   * (research §2.6). Renders the ⏳ status line — informational, not a warning.
   */
  adaptationWeek?: number | null;
  /**
   * The step's resolved productType (e.g. after the pre_cleanse
   * classification guard reclassifies a mistyped micellar water from
   * `cleanser` to `makeup_remover`). Drives the type badge instead of
   * `product.productType` so the badge never contradicts a stepNote or
   * placeholder computed from the SAME resolved type — reclassification is
   * engine-derived, never persisted back to the catalog record. Falls back to
   * `product.productType` when absent (every pre-existing call site).
   */
  displayProductType?: ProductType;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RoutineStepCard({
  product,
  onCardPress,
  conflictingProductName,
  onLongPress,
  onOverflowPress,
  adaptationWeek,
  displayProductType,
}: RoutineStepCardProps) {
  const hasConflict = !!conflictingProductName;
  const hasTrailingRow = hasConflict || adaptationWeek != null;
  const productType = displayProductType ?? product.productType;

  const activeKey = product.activeTags?.[0] ?? product.activeIngredients?.[0]?.key ?? null;
  const activeLabel = activeKey ? (ACTIVE_INGREDIENT_LABELS[activeKey] ?? null) : null;

  const [attributionVisible, setAttributionVisible] = useState(false);
  const activeMatches = activeKey ? getMatchesForKey(product.fullIngredientText, activeKey) : [];
  const showAliasIcon = hasAliasOverride(activeMatches);
  const allergenMatches = getProductAllergenMatches(product);

  const typeLabel = PRODUCT_TYPE_LABELS[productType] ?? productType;
  const typeBadgeStatus = getProductTypeBadgeStatus(productType);

  const cardStyle = [styles.card, hasConflict && styles.cardConflict];

  // ── Shared card body ──────────────────────────────────────────────────────
  //
  // In edit mode the card root is a plain View so there is no RNGH touch
  // responder competing with the drag handle's TouchableOpacity.
  // In normal mode the root is an RNGH TouchableOpacity for navigation.
  // Keeping the two branches explicit avoids the nested-RNGH-handler problem
  // that caused drag gestures to be swallowed by the outer touch responder.

  const mainRow = (
    <View style={styles.mainRow}>
      {/* Leading product photo — placeholder when none, edge-to-edge with
          the card's left/top/bottom (matches the shelf card) */}
      <ProductThumbnail product={product} fill squareBottomLeft={hasTrailingRow} />

      {/* Content area */}
      <View style={styles.contentArea}>
        {/* Identity: brand (muted) above product name (bold) */}
        <View style={styles.topRow}>
          {product.brand ? (
            <Text style={styles.brandName} numberOfLines={1}>{product.brand}</Text>
          ) : null}
          <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
        </View>

        {/* Bottom row: badges only — overflow button moved to the top-right
            corner, on the brand's line (see below) */}
        <View style={styles.bottomRow}>
          <View style={styles.badgesRow}>
            <Badge status={typeBadgeStatus} type="Light">{typeLabel}</Badge>
            {activeLabel && activeKey ? (
              <Pressable
                testID={`active-badge-${activeKey}`}
                accessibilityRole="button"
                accessibilityLabel={`${activeLabel} detected, tap for details`}
                onPress={() => setAttributionVisible(true)}
                style={styles.activeBadge}
              >
                {/* Compact routine surface: a lightning glyph signals "has
                    actives" — full biomarker tags live on the shelf card only.
                    The glyph stays tappable so INCI attribution is preserved. */}
                <Icon name="zap" size={16} color={palette.zinc600} />
                {showAliasIcon ? (
                  <View
                    testID={`active-badge-alias-icon-${activeKey}`}
                    accessibilityLabel="Detected via regional ingredient name"
                    style={styles.aliasIconWrap}
                  >
                    <Icon name="globe" size={16} color={palette.zinc500} />
                  </View>
                ) : null}
              </Pressable>
            ) : null}
            <AllergenBadge matches={allergenMatches} />
          </View>
        </View>
      </View>

      {onOverflowPress ? (
        <IconButton
          icon={<Icon name="more-vertical" size={18} color={palette.zinc500} />}
          label={`More actions for ${product.name}`}
          variant="ghost"
          size="sm"
          style={styles.overflowButton}
          onPress={(e) => {
            e?.stopPropagation?.();
            onOverflowPress();
          }}
        />
      ) : null}
    </View>
  );

  const conflictRow = hasConflict ? (
    <View style={styles.conflictRow}>
      <Icon name="alert-triangle" size={16} color={colors.statusWarningAccent} />
      <Text style={styles.conflictText} numberOfLines={1}>
        Conflicts with {conflictingProductName}
      </Text>
    </View>
  ) : null;

  // Status, not a warning — the one deliberate visibility exception (§2.6)
  const adaptationRow =
    adaptationWeek != null ? (
      <View style={styles.adaptationRow}>
        <Icon name="clock" size={18} color={palette.zinc600} />
        <Text style={styles.adaptationText} numberOfLines={2}>
          Adaptation Phase (Week {adaptationWeek} of 4) — frequency managed to
          prevent purging
        </Text>
      </View>
    ) : null;

  const attributionTooltip = (
    <AttributionTooltip
      visible={attributionVisible}
      onClose={() => setAttributionVisible(false)}
      displayName={activeLabel ?? ''}
      matches={activeMatches}
    />
  );

  // One root: tap navigates, long press hands the touch to the drag gesture.
  // No shadow here — these cards sit inside a Morning/Evening accordion card
  // that carries its own shadow (see PERIOD_CARD_SHADOW in RoutinesScreen),
  // so the product cards inside stay flat. Both this card and the accordion
  // behind it are white, so a light gray outline (not a shadow) is what
  // actually separates one product card from the next — Routines-tab only,
  // this component has no other call site.
  return (
    <>
      <TouchableOpacity
        onPress={onCardPress}
        onLongPress={onLongPress}
        delayLongPress={200}
        activeOpacity={onCardPress ? 0.92 : 1}
        style={cardStyle}
        accessibilityRole="button"
        accessibilityLabel={`${product.name}, tap to view product detail`}
        accessibilityHint={onLongPress ? 'Hold to reorder' : undefined}
      >
        {mainRow}
        {conflictRow}
        {adaptationRow}
      </TouchableOpacity>
      {attributionTooltip}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const dragStyles = StyleSheet.create({
  container: {
    width: 20,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 10,
    gap: 3,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: palette.zinc300,
  },
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: colors.borderDivider,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  cardConflict: {
    borderColor: palette.amberLine,
  },

  // No padding here — the leading photo bleeds flush to the row's
  // left/top/bottom (see ProductThumbnail's `fill` mode). Vertical and
  // trailing padding live on contentArea instead, around the text only.
  mainRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: space[3],
  },

  contentArea: {
    flex: 1,
    minWidth: 0,
    gap: space[2],
    paddingVertical: space[4],
    paddingRight: space[3],
  },

  overflowButton: {
    position: 'absolute',
    top: space[3],
    right: space[2],
  },

  // Brand above the name, both left-aligned (matches the shelf card).
  // Right padding reserves room for the overflow button, which shares
  // this line but sits outside contentArea's flow (absolute, top-right).
  topRow: {
    gap: 2,
    paddingRight: space[8],
  },
  productName: {
    ...typography.body,
    fontFamily: 'DMSans-Bold',
    color: palette.black,
  },
  brandName: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },

  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  // Neutral gray fill — matches the shelf card's active-badge treatment
  // (one color for all actives on a light gray backing), no colored border.
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.pill,
    // Fixed height + minWidth match the neighboring type Badge's rendered
    // height (space[1] padding + caption line-height ≈ 28px); minWidth keeps
    // the common single-icon case a perfect circle, not an oval.
    height: 28,
    minWidth: 28,
    paddingHorizontal: 6,
  },
  aliasIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBadgeText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    includeFontPadding: false,
    color: palette.black,
  },

  conflictRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: space[2],
    paddingBottom: space[2],
    paddingHorizontal: space[3],
    borderTopWidth: 1,
    borderTopColor: palette.amberLine,
  },
  adaptationRow: {
    flexDirection: 'row',
    // flex-start, not center: the text can wrap to 2 lines, and centering
    // the icon against the whole wrapped block pulls it away from the first
    // line — top-aligned keeps it level with the text's first line.
    alignItems: 'flex-start',
    gap: space[2],
    marginTop: space[2],
    paddingTop: space[2],
    paddingBottom: space[2],
    paddingHorizontal: space[3],
    borderTopWidth: 1,
    borderTopColor: colors.borderDivider,
  },
  adaptationText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  conflictText: {
    ...typography.bodySmall,
    color: palette.amber,
    flexShrink: 1,
  },
});
