import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { IconButton } from '@/components/ui/core/IconButton';
import { Badge } from '@/components/ui/feedback/Badge';
import { ProductThumbnail } from '@/components/ui/ProductThumbnail';
import { ACTIVE_INGREDIENT_LABELS, PRODUCT_TYPE_LABELS } from '@/constants/labels';
import { colors, palette, radius, shadow, space, typography } from '@/constants/tokens';
import type { ActiveIngredientKey, Product, ProductType } from '@/types';
import { getProductActiveBadgeKeys } from '@/utils/activeBadges';

// ─── Product type → badge color ───────────────────────────────────────────────
//
// Mirrors RoutineStepCard's TYPE_COLORS so picker cards read identically to
// the cards already scheduled in the routine.

const TYPE_COLORS: Partial<Record<ProductType, { bg: string; text: string }>> = {
  serum:         { bg: palette.cobaltTint,       text: palette.cobalt },
  ampoule:       { bg: palette.cobaltTint,       text: palette.cobalt },
  essence:       { bg: palette.cobaltTint,       text: palette.cobalt },
  gel:           { bg: palette.cobaltTint,       text: palette.cobalt },
  cleanser:      { bg: palette.bottleGreenTint,  text: palette.bottleGreen },
  toner:         { bg: palette.bottleGreenTint,  text: palette.bottleGreen },
  moisturizer:   { bg: palette.bottleGreenTint,  text: palette.bottleGreen },
  cream:         { bg: palette.bottleGreenTint,  text: palette.bottleGreen },
  lotion:        { bg: palette.bottleGreenTint,  text: palette.bottleGreen },
  oil:           { bg: palette.bottleGreenTint,  text: palette.bottleGreen },
  spf:           { bg: palette.amberTint,        text: palette.amber },
  eye_cream:     { bg: palette.bottleGreenTint,  text: palette.bottleGreen },
  mask:          { bg: palette.amberTint,        text: palette.amber },
  peeling:       { bg: palette.amberTint,        text: palette.amber },
  spot_treatment:{ bg: palette.amberTint,        text: palette.amber },
  balm:          { bg: palette.bottleGreenTint,  text: palette.bottleGreen },
};

const DEFAULT_TYPE_COLOR = { bg: palette.zinc100, text: palette.zinc600 };

// ─── Active-ingredient badge fit ───────────────────────────────────────────────
// Mirrors ProductShelfCard's fit logic exactly (see that file for the full
// rationale): no live layout measurement is available ahead of render, so
// "does it fit" is estimated from label length rather than measured pixels.
// Try the first 2 actives, then 1 — and whenever there's a hidden remainder,
// the trailing "+N" badge's own width must be budgeted for too, or a pair of
// short-enough labels can still overflow once the "+N" that follows them is
// counted in.
const ASSUMED_ACTIVES_ROW_WIDTH = 190;
const BADGE_GAP = space[1];
const ACTIVE_BADGE_H_PADDING = space[3] * 2;
const OVERFLOW_BADGE_WIDTH_ESTIMATE = 40;
const AVG_GLYPH_WIDTH = 7.2;

function estimateBadgeWidth(label: string): number {
  return Math.ceil(label.length * AVG_GLYPH_WIDTH) + ACTIVE_BADGE_H_PADDING;
}

function activeBadgeVisibleCount(activeKeys: ActiveIngredientKey[]): number {
  const total = activeKeys.length;
  if (total === 0) return 0;

  const widths = activeKeys.map((key) => estimateBadgeWidth(ACTIVE_INGREDIENT_LABELS[key]));

  for (let count = Math.min(total, 2); count >= 1; count--) {
    const shownBadges = widths.slice(0, count);
    const shownWidth = shownBadges.reduce((sum, width) => sum + width, 0) + (count - 1) * BADGE_GAP;
    const overflowReserve = count < total ? BADGE_GAP + OVERFLOW_BADGE_WIDTH_ESTIMATE : 0;
    if (shownWidth + overflowReserve <= ASSUMED_ACTIVES_ROW_WIDTH) return count;
  }
  return 1;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProductPickerCardProps {
  product: Product;
  onAdd: (product: Product) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductPickerCard({ product, onAdd }: ProductPickerCardProps) {
  const activeKeys = getProductActiveBadgeKeys(product);
  const visibleActiveCount = activeBadgeVisibleCount(activeKeys);
  const hiddenActiveCount = activeKeys.length - visibleActiveCount;

  const typeLabel = PRODUCT_TYPE_LABELS[product.productType] ?? product.productType;
  const typeColor = TYPE_COLORS[product.productType] ?? DEFAULT_TYPE_COLOR;

  // Shadow lives on this outer, non-clipping wrapper — `styles.card` needs
  // `overflow: 'hidden'` to clip the bleeding photo to the rounded corners,
  // but overflow:hidden also clips the shadow itself (it renders outside the
  // view's bounds), so the two can't share a node.
  return (
    <View style={styles.cardShadow}>
      <View style={styles.card}>
        <View style={styles.mainRow}>
          {/* Leading product photo — placeholder when none, edge-to-edge with
              the card's left/top/bottom (matches the shelf card). */}
          <ProductThumbnail product={product} fill />

          <View style={styles.contentArea}>
            {/* Identity: brand (muted) above product name (bold) — right
                padding reserves room for the add button, which shares this
                line but sits outside contentArea's flow (absolute, top-right,
                matching the shelf card's overflow-button placement). */}
            <View style={styles.topRow}>
              {product.brand ? (
                <Text style={styles.brandName} numberOfLines={1}>
                  {product.brand}
                </Text>
              ) : null}
              <Text style={styles.productName} numberOfLines={1}>
                {product.name}
              </Text>
            </View>

            {/* Type badge on its own row, actives on another — matches the
                shelf card's layout. */}
            <View style={styles.typeRow}>
              <View style={[styles.typeBadge, { backgroundColor: typeColor.bg }]}>
                <Text style={[styles.typeBadgeText, { color: typeColor.text }]}>
                  {typeLabel}
                </Text>
              </View>
            </View>

            <View style={styles.activesRow}>
              {activeKeys.slice(0, visibleActiveCount).map((key) => (
                <Badge key={key} testID={`active-badge-${key}`}>
                  {ACTIVE_INGREDIENT_LABELS[key]}
                </Badge>
              ))}
              {hiddenActiveCount > 0 ? (
                <Badge testID="active-badge-overflow">{`+${hiddenActiveCount}`}</Badge>
              ) : null}
            </View>
          </View>

          {/* Add button — 24×24 visual, 42×42 tap target (hitSlop 9 on each
              side), top-right corner on the brand's line. */}
          <IconButton
            icon={<Feather name="plus" size={14} color={palette.white} />}
            label={`Add ${product.name} to routine`}
            variant="filled"
            round
            hitSlop={9}
            style={styles.addButton}
            onPress={() => onAdd(product)}
          />
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Shadow-only wrapper — see the comment at the JSX call site for why this
  // can't be merged into `card`.
  cardShadow: {
    borderRadius: radius.sm,
    backgroundColor: palette.white,
    ...shadow.sm,
  },
  card: {
    backgroundColor: palette.white,
    borderRadius: radius.sm,
    overflow: 'hidden',
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
  // Brand above the name, both left-aligned (matches the shelf/routine cards).
  // Right padding reserves room for the add button (top-right, absolute).
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
  addButton: {
    position: 'absolute',
    top: space[3],
    right: space[2],
    width: 24,
    height: 24,
  },
  typeRow: {
    flexDirection: 'row',
  },
  activesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    flexShrink: 1,
    minHeight: space[1] * 2 + typography.caption.lineHeight,
  },
  typeBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  typeBadgeText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    includeFontPadding: false,
  },
});
