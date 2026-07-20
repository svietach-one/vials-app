import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { ProductActionSheet } from '@/components/product/ProductActionSheet';
import { IconButton } from '@/components/ui/core/IconButton';
import { ProductThumbnail } from '@/components/ui/ProductThumbnail';
import { ACTIVE_INGREDIENT_LABELS, PRODUCT_TYPE_LABELS } from '@/constants/labels';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import type { ActiveBadgeCategory, Product, ProductType } from '@/types';
import { getActiveBadgeCategory, getProductActiveBadgeKeys } from '@/utils/activeBadges';

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

// ─── Active-ingredient category → badge color ─────────────────────────────────
// Outlined recipe (colored border + plain background), deliberately distinct
// from TYPE_COLORS' solid-fill recipe — see spec Story 3 / tech design Assumptions.

const ACTIVE_CATEGORY_COLORS: Record<ActiveBadgeCategory, { border: string; text: string }> = {
  exfoliant: { border: palette.amberLine, text: palette.amber },
  soothing: { border: palette.bottleGreenLine, text: palette.bottleGreen },
  hydrator: { border: palette.cobaltLine, text: palette.cobalt },
  other: { border: palette.zinc300, text: palette.black },
};

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

  return (
    <>
      <Pressable
        onPress={disabled ? undefined : onCardPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.card,
          pressed && !disabled && styles.cardPressed,
          disabled && styles.cardDisabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${product.name}, tap to view details`}
      >
        <View style={styles.rowWrap}>
          {/* Leading product photo (52px) — placeholder when none, dims with card */}
          <ProductThumbnail product={product} size={104} dimmed={!!product.isHidden} />

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

          {/* Middle row: routine info or hidden state */}
          {isInRoutine ? (
            <View style={styles.middleRow}>
              <View style={styles.scheduleBlock}>
                <View testID="icon-calendar">
                  <Feather name="calendar" size={14} color={colors.textTertiary} />
                </View>
                <Text style={styles.scheduleText}>{scheduleLabel}</Text>
              </View>
              <View style={styles.timeOfDayBlock}>
                {(usageTime === 'evening' || usageTime === 'both') ? (
                  <View testID="icon-moon">
                    <Feather name="moon" size={14} color={colors.textTertiary} />
                  </View>
                ) : null}
                {(usageTime === 'morning' || usageTime === 'both') ? (
                  <View testID="icon-sun">
                    <Feather name="sun" size={14} color={colors.textTertiary} />
                  </View>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={styles.middleRow}>
              <View style={styles.hiddenBlock}>
                <Feather name="eye-off" size={14} color={colors.textTertiary} />
                <Text style={styles.hiddenText}>Hidden from routine</Text>
              </View>
            </View>
          )}
        </View>

        {/* Bottom row: badge row (left, dims with content) + overflow button (right, always opaque) */}
        <View style={styles.bottomRow}>
          <View style={[styles.badgesRow, product.isHidden && styles.contentDimmed]}>
            {product.isHidden ? (
              <View style={styles.activeBadge}>
                <Feather name="eye-off" size={12} color={colors.textTertiary} />
              </View>
            ) : null}
            {activeKeys.map((key) => {
              const categoryColor = ACTIVE_CATEGORY_COLORS[getActiveBadgeCategory(key)];
              return (
                <View
                  key={key}
                  testID={`active-badge-${key}`}
                  style={[styles.activeBadge, { borderColor: categoryColor.border }]}
                >
                  <Text style={[styles.activeBadgeText, { color: categoryColor.text }]}>
                    {ACTIVE_INGREDIENT_LABELS[key]}
                  </Text>
                </View>
              );
            })}
            <View style={[styles.typeBadge, { backgroundColor: typeColor.bg }]}>
              <Text style={[styles.typeBadgeText, { color: typeColor.text }]}>
                {typeLabel}
              </Text>
            </View>
          </View>

          <IconButton
            icon={<Feather name="more-vertical" size={16} color={colors.textSecondary} />}
            label={`More actions for ${product.name}`}
            variant="ghost"
            size="sm"
            onPress={(e) => {
              e?.stopPropagation?.();
              setSheetVisible(true);
            }}
          />
        </View>
          </View>
        </View>
      </Pressable>

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
  card: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.zinc200,
    borderRadius: radius.sm,
    paddingHorizontal: space[2],
    paddingVertical: space[4],
    gap: space[2],
  },
  cardPressed: {
    backgroundColor: colors.bgSubtle,
  },
  cardDisabled: {
    opacity: 0.4,
  },

  rowWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
  },
  mainColumn: {
    flex: 1,
    minWidth: 0,
    gap: space[2],
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

  middleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scheduleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  scheduleText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  timeOfDayBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  hiddenBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hiddenText: {
    ...typography.caption,
    color: colors.textTertiary,
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
