import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { ProductActionSheet } from '@/components/product/ProductActionSheet';
import { IconButton } from '@/components/ui/core/IconButton';
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
  disabled = false,
}: ProductShelfCardProps) {
  const [sheetVisible, setSheetVisible] = useState(false);

  const activeKey = product.activeTags?.[0] ?? product.activeIngredients?.[0]?.key ?? null;
  const activeLabel = activeKey ? (ACTIVE_INGREDIENT_LABELS[activeKey] ?? null) : null;

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
        {/* Top row: product name (left) + brand name (right) */}
        <View style={styles.topRow}>
          <Text style={styles.productName} numberOfLines={2}>
            {product.name}
          </Text>
          {product.brand ? (
            <Text style={styles.brandName} numberOfLines={1}>
              {product.brand}
            </Text>
          ) : null}
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

        {/* Bottom row: badge row (left) + overflow button (right) */}
        <View style={styles.bottomRow}>
          <View style={styles.badgesRow}>
            {activeLabel ? (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText} numberOfLines={1}>
                  {activeLabel}
                </Text>
              </View>
            ) : null}
            <View style={[styles.typeBadge, { backgroundColor: typeColor.bg }]}>
              <Text
                style={[styles.typeBadgeText, { color: typeColor.text }]}
                numberOfLines={1}
              >
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
        onToggleHidden={() => {
          setSheetVisible(false);
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
    borderRadius: radius.xl,
    paddingHorizontal: space[4],
    paddingVertical: space[4],
    gap: space[2],
  },
  cardPressed: {
    backgroundColor: colors.bgSubtle,
  },
  cardDisabled: {
    opacity: 0.4,
  },

  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: space[2],
  },
  productName: {
    ...typography.body,
    fontFamily: 'DMSans-Bold',
    color: palette.black,
    flex: 1,
  },
  brandName: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'right',
    flexShrink: 0,
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
  },
  activeBadge: {
    backgroundColor: palette.white,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.zinc300,
    paddingHorizontal: 6,
    paddingVertical: 2,
    maxWidth: 90,
  },
  activeBadgeText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 10,
    lineHeight: 14,
    color: palette.black,
  },
  typeBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
    maxWidth: 96,
  },
  typeBadgeText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 10,
    lineHeight: 14,
  },
});
