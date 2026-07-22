import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { ProductActionSheet } from '@/components/product/ProductActionSheet';
import { IconButton } from '@/components/ui/core/IconButton';
import { Badge } from '@/components/ui/feedback/Badge';
import { ProductThumbnail } from '@/components/ui/ProductThumbnail';
import { ACTIVE_INGREDIENT_LABELS, PRODUCT_TYPE_LABELS } from '@/constants/labels';
import { colors, palette, radius, shadow, space, typography } from '@/constants/tokens';
import type { ActiveIngredientKey, Product, ProductType } from '@/types';
import { getProductActiveBadgeKeys } from '@/utils/activeBadges';

// ─── Product type → badge color ───────────────────────────────────────────────

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

// ─── Active-ingredient badges ──────────────────────────────────────────────────
// Actives no longer carry per-category color (that lived in a since-removed
// ACTIVE_CATEGORY_COLORS map) — every active badge now uses the shared Badge
// component's neutral fill, one color for all actives on a light gray backing.
//
// Pills must never render partially cut off, and the shelf list has no live
// layout measurement to lean on (a real onLayout pass only resolves after
// first render), so the "does it fit" call is made ahead of time from an
// estimated pixel width rather than measured layout: try the first 2 actives,
// then 1, falling back sooner rather than risk a clipped pill. Critically,
// whenever anything is hidden, a trailing "+N" badge renders too — its width
// must be reserved in the same budget, not just the visible actives' own
// widths, or the row can still overflow past the card's right edge (this is
// exactly what caused a pill to render half-clipped: two short-enough labels
// "fit" on their own, but not once the "+N" badge that follows them is
// counted in). The hidden actives are still visible on the product's own
// detail page.
const ASSUMED_ACTIVES_ROW_WIDTH = 190; // conservative floor — a ~375pt-wide device
const BADGE_GAP = space[1];
const ACTIVE_BADGE_H_PADDING = space[3] * 2; // Badge's own horizontal padding
const OVERFLOW_BADGE_WIDTH_ESTIMATE = 40; // "+N" is short, but still pays full badge padding
const AVG_GLYPH_WIDTH = 7.2; // DMSans-Medium at typography.caption (14px)

function estimateBadgeWidth(label: string): number {
  return Math.ceil(label.length * AVG_GLYPH_WIDTH) + ACTIVE_BADGE_H_PADDING;
}

function activeBadgeVisibleCount(activeKeys: ActiveIngredientKey[]): number {
  const total = activeKeys.length;
  if (total === 0) return 0;

  const widths = activeKeys.map((key) => estimateBadgeWidth(ACTIVE_INGREDIENT_LABELS[key]));

  for (let count = Math.min(total, 2); count >= 1; count--) {
    const shownBadges = widths.slice(0, count);
    // (count - 1) gaps BETWEEN the shown badges themselves...
    const shownWidth = shownBadges.reduce((sum, width) => sum + width, 0) + (count - 1) * BADGE_GAP;
    // ...plus one more gap-and-badge if a trailing "+N" will also render.
    const overflowReserve = count < total ? BADGE_GAP + OVERFLOW_BADGE_WIDTH_ESTIMATE : 0;
    if (shownWidth + overflowReserve <= ASSUMED_ACTIVES_ROW_WIDTH) return count;
  }
  return 1; // always show at least one real badge when there's at least one active
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProductShelfCardProps {
  product: Product;
  /** True when product appears in any RoutineStep across all routines. */
  isInRoutine: boolean;
  /** Output of formatScheduleDays(scheduledDays). Only used when isInRoutine=true. */
  scheduleLabel: string;
  /** Derived from product.usageTime. Only shown when isInRoutine=true. */
  usageTime: 'morning' | 'evening' | 'both';
  onCardPress: () => void;
  onEdit: (p: Product) => void;
  onAddToRoutine: (p: Product) => void;
  onRemoveFromRoutine: (p: Product) => void;
  onDelete: (p: Product) => void;
  onToggleHidden: (p: Product) => void;
  disabled?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductShelfCard({
  product,
  isInRoutine,
  scheduleLabel,
  usageTime,
  onCardPress,
  onEdit,
  onAddToRoutine,
  onRemoveFromRoutine,
  onDelete,
  onToggleHidden,
  disabled = false,
}: ProductShelfCardProps) {
  const [sheetVisible, setSheetVisible] = useState(false);

  const activeKeys = getProductActiveBadgeKeys(product);

  const typeLabel = PRODUCT_TYPE_LABELS[product.productType] ?? product.productType;
  const typeColor = TYPE_COLORS[product.productType] ?? DEFAULT_TYPE_COLOR;

  const visibleActiveCount = activeBadgeVisibleCount(activeKeys);
  const hiddenActiveCount = activeKeys.length - visibleActiveCount;

  return (
    <>
      {/* Shadow lives on this outer, non-clipping wrapper — `styles.card`
          below needs `overflow: 'hidden'` to clip the bleeding photo to the
          rounded corners, but overflow:hidden also clips the shadow itself
          (it renders outside the view's bounds), so the two can't share a
          node. */}
      <View style={[styles.cardShadow, disabled && styles.cardDisabled]}>
        <Pressable
          onPress={disabled ? undefined : onCardPress}
          disabled={disabled}
          style={({ pressed }) => [styles.card, pressed && !disabled && styles.cardPressed]}
          accessibilityRole="button"
          accessibilityLabel={`${product.name}, tap to view details`}
        >
          <View style={styles.rowWrap}>
            {/* Leading product photo — placeholder when none, edge-to-edge with
                the card's left/top/bottom, dims with card. Routine-membership
                state (sun/moon usage time, or "hidden from routine") renders as
                small colored circle glyphs over the photo's bottom-left corner
                instead of a text row, so it stays out of the card's text area. */}
            <View style={styles.thumbnailWrap}>
              <ProductThumbnail product={product} fill dimmed={!!product.isHidden} />
              <View style={[styles.thumbnailBadgeRow, product.isHidden && styles.contentDimmed]}>
                {isInRoutine ? (
                  <>
                    {(usageTime === 'morning' || usageTime === 'both') ? (
                      <View testID="icon-sun" style={[styles.circleBadge, styles.circleBadgeSun]}>
                        <Feather name="sun" size={14} color={palette.marigold} />
                      </View>
                    ) : null}
                    {(usageTime === 'evening' || usageTime === 'both') ? (
                      <View testID="icon-moon" style={[styles.circleBadge, styles.circleBadgeMoon]}>
                        <Feather name="moon" size={14} color={palette.cobalt} />
                      </View>
                    ) : null}
                  </>
                ) : (
                  <View
                    testID="icon-hidden-from-routine"
                    style={[styles.circleBadge, styles.circleBadgeHidden]}
                  >
                    <Feather name="eye-off" size={14} color={palette.zinc600} />
                  </View>
                )}
              </View>
            </View>

            <View style={styles.mainColumn}>
              <View
                testID="shelf-card-content"
                style={[styles.content, product.isHidden && styles.contentDimmed]}
              >
                {/* Identity: brand (muted) above product name (bold) */}
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

                {/* Type badge on its own row, actives on another (see below) */}
                <View style={styles.typeRow}>
                  <View style={[styles.typeBadge, { backgroundColor: typeColor.bg }]}>
                    <Text style={[styles.typeBadgeText, { color: typeColor.text }]}>
                      {typeLabel}
                    </Text>
                  </View>
                </View>

                {/* Actives row — type badge stays above. Always rendered
                    (even with zero actives) so every shelf card reserves the
                    same height; see activesRow's minHeight. */}
                <View testID="shelf-card-actives-row" style={styles.activesRow}>
                  {product.isHidden ? (
                    <View style={styles.hiddenIconBadge}>
                      <Feather name="eye-off" size={12} color={colors.textTertiary} />
                    </View>
                  ) : null}
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
            </View>

            <IconButton
              icon={<Feather name="more-vertical" size={16} color={colors.textSecondary} />}
              label={`More actions for ${product.name}`}
              variant="ghost"
              size="sm"
              style={styles.overflowButton}
              onPress={(e) => {
                e?.stopPropagation?.();
                setSheetVisible(true);
              }}
            />
          </View>
        </Pressable>
      </View>

      <ProductActionSheet
        product={sheetVisible ? product : null}
        onEdit={(p) => {
          setSheetVisible(false);
          onEdit(p);
        }}
        onDelete={(p) => {
          setSheetVisible(false);
          onDelete(p);
        }}
        onToggleHidden={(p) => {
          setSheetVisible(false);
          onToggleHidden(p);
        }}
        onAddToRoutine={isInRoutine ? undefined : onAddToRoutine}
        onRemoveFromRoutine={isInRoutine ? onRemoveFromRoutine : undefined}
        onClose={() => setSheetVisible(false)}
      />
    </>
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
  cardPressed: {
    backgroundColor: colors.bgSubtle,
  },
  cardDisabled: {
    opacity: 0.4,
  },

  // No edge padding here — the leading photo bleeds flush to the card's
  // left/top/bottom (see ProductThumbnail's `fill` mode). Vertical and
  // trailing padding live on mainColumn instead, around the text content only.
  rowWrap: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: space[3],
  },
  mainColumn: {
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

  content: {
    gap: space[2],
  },
  contentDimmed: {
    opacity: 0.4,
  },

  // Brand sits above the name, both left-aligned — the name is the primary
  // identifier, the brand is context for it.
  topRow: {
    gap: 2,
    paddingRight: space[10],
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

  // Routine-membership state (sun/moon/hidden) now overlays the photo
  // instead of rendering as a text row — see thumbnailWrap below.
  // flexDirection: 'row' matters here, not just visually: it keeps this
  // wrapper's cross-axis as height (matching rowWrap's), so ProductThumbnail's
  // `alignSelf: 'stretch'` still stretches HEIGHT the same way it would as a
  // direct child of rowWrap. Left as the default 'column', the cross-axis
  // flips to width and the height/aspectRatio chain that sizes the fill-mode
  // photo breaks — which is exactly what blew the image up to fill the card.
  thumbnailWrap: {
    position: 'relative',
    flexDirection: 'row',
  },
  thumbnailBadgeRow: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    flexDirection: 'row',
    gap: 4,
  },
  circleBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleBadgeSun: {
    backgroundColor: palette.marigoldTint,
  },
  circleBadgeMoon: {
    backgroundColor: palette.cobaltTint,
  },
  circleBadgeHidden: {
    backgroundColor: palette.zinc100,
  },

  // Type badge on its own row, above the actives row.
  typeRow: {
    flexDirection: 'row',
  },
  // minHeight matches a Badge's own rendered height (space[1]*2 padding +
  // caption line-height) so this row keeps its place — and every shelf card
  // stays the same overall height — even for a product with zero actives,
  // instead of collapsing to 0 when it has no badges to size it.
  activesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    flexShrink: 1,
    minHeight: space[1] * 2 + typography.caption.lineHeight,
    // Pills must never sit flush against the card's edge.
    paddingRight: 4,
  },
  // Compact neutral pill for the "hidden" (product.isHidden) glyph — same
  // light gray backing as the active badges (Badge's Default/Light).
  hiddenIconBadge: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 4,
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
