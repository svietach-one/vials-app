import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Feather } from '@expo/vector-icons';

import { ACTIVE_INGREDIENT_LABELS, PRODUCT_TYPE_LABELS } from '@/constants/labels';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import type { Product, ProductType } from '@/types';

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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RoutineStepCardProps {
  product: Product;
  onCardPress?: () => void;
  conflictingProductName?: string | null;
  /**
   * The raw `drag` callback from DraggableFlatList's renderItem.
   * Only rendered (via the drag handle) when isEditMode is true.
   */
  drag?: () => void;
  /** Switches the card between normal mode and edit mode (drag handle + delete). */
  isEditMode?: boolean;
  /** Called when the user taps the delete button in edit mode. */
  onDelete?: () => void;
  /**
   * Adaptation week (1–4) while the engine micro-doses this product
   * (research §2.6). Renders the ⏳ status line — informational, not a warning.
   */
  adaptationWeek?: number | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RoutineStepCard({
  product,
  onCardPress,
  conflictingProductName,
  drag,
  isEditMode = false,
  onDelete,
  adaptationWeek,
}: RoutineStepCardProps) {
  const hasConflict = !!conflictingProductName;

  const activeKey = product.activeTags?.[0] ?? product.activeIngredients?.[0]?.key ?? null;
  const activeLabel = activeKey ? (ACTIVE_INGREDIENT_LABELS[activeKey] ?? null) : null;

  const typeLabel = PRODUCT_TYPE_LABELS[product.productType] ?? product.productType;
  const typeColor = TYPE_COLORS[product.productType] ?? DEFAULT_TYPE_COLOR;

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
      {/* Drag handle — only in edit mode, directly calls the RNDFL drag fn */}
      {isEditMode && drag ? (
        // RN Pressable (not RNGH) so RNDFL's GestureDetector can claim the
        // touch after drag() is called without a competing RNGH handler.
        <Pressable
          onLongPress={drag}
          delayLongPress={150}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={dragStyles.container}
          accessibilityLabel="Hold to reorder"
        >
          <View style={dragStyles.dotsGrid}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <View key={i} style={dragStyles.dot} />
            ))}
          </View>
        </Pressable>
      ) : null}

      {/* Content area */}
      <View style={styles.contentArea}>
        {/* Top row: product name (left, up to 2 lines) + brand (right, 1 line) */}
        <View style={styles.topRow}>
          <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
          {product.brand ? (
            <Text style={styles.brandName} numberOfLines={1}>{product.brand}</Text>
          ) : null}
        </View>

        {/* Bottom row: badges (left) + delete button in edit mode (right) */}
        <View style={styles.bottomRow}>
          <View style={styles.badgesRow}>
            <View style={[styles.typeBadge, { backgroundColor: typeColor.bg }]}>
              <Text style={[styles.typeBadgeText, { color: typeColor.text }]}>
                {typeLabel}
              </Text>
            </View>
            {activeLabel ? (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>
                  {activeLabel}
                </Text>
              </View>
            ) : null}
          </View>

          {isEditMode ? (
            <TouchableOpacity
              onPress={onDelete}
              disabled={!onDelete}
              activeOpacity={0.5}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ opacity: onDelete ? 1 : 0.35 }}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${product.name}`}
            >
              <Feather name="trash-2" size={18} color={palette.zinc500} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );

  const conflictRow = hasConflict ? (
    <View style={styles.conflictRow}>
      <Feather name="alert-triangle" size={11} color={palette.amber} />
      <Text style={styles.conflictText} numberOfLines={1}>
        Conflicts with {conflictingProductName}
      </Text>
    </View>
  ) : null;

  // Status, not a warning — the one deliberate visibility exception (§2.6)
  const adaptationRow =
    adaptationWeek != null ? (
      <View style={styles.adaptationRow}>
        <Text style={styles.adaptationText} numberOfLines={2}>
          ⏳ Adaptation Phase (Week {adaptationWeek} of 4) — frequency managed to
          prevent purging
        </Text>
      </View>
    ) : null;

  // Edit mode: plain View root — no RNGH handler competing with drag handle
  if (isEditMode) {
    return (
      <View style={cardStyle}>
        {mainRow}
        {conflictRow}
        {adaptationRow}
      </View>
    );
  }

  // Normal mode: RNGH TouchableOpacity for tap-to-navigate
  return (
    <TouchableOpacity
      onPress={onCardPress}
      activeOpacity={onCardPress ? 0.92 : 1}
      style={cardStyle}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, tap to view product detail`}
    >
      {mainRow}
      {conflictRow}
      {adaptationRow}
    </TouchableOpacity>
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
    borderColor: palette.zinc200,
    borderRadius: radius.sm,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  cardConflict: {
    borderColor: palette.amber,
  },

  mainRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: space[3],
  },

  contentArea: {
    flex: 1,
    minWidth: 0,
    gap: space[2],
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[2],
  },
  productName: {
    flex: 1,
    ...typography.body,
    fontFamily: 'DMSans-Bold',
    color: palette.black,
  },
  brandName: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flexShrink: 0,
    maxWidth: 110,
    textAlign: 'right',
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
  activeBadge: {
    backgroundColor: palette.white,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.zinc300,
    paddingHorizontal: 6,
    paddingVertical: 2,
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
    marginTop: space[2],
    paddingTop: space[2],
    borderTopWidth: 1,
    borderTopColor: palette.amberLine,
  },
  adaptationRow: {
    marginTop: space[2],
    paddingTop: space[2],
    borderTopWidth: 1,
    borderTopColor: colors.borderDivider,
  },
  adaptationText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  conflictText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: palette.amber,
    flexShrink: 1,
  },
});
