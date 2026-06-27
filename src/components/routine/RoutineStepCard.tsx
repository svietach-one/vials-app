import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Checkbox } from '@/components/ui/forms/Checkbox';
import { ACTIVE_INGREDIENT_LABELS, PRODUCT_TYPE_LABELS } from '@/constants/labels';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import { formatScheduleDays } from '@/utils/routineLabel';
import type { Product, ProductType, RoutineStep } from '@/types';

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
  eye_cream:     { bg: palette.cabernetTint,     text: palette.cabernet },
  mask:          { bg: palette.cabernetTint,     text: palette.cabernet },
  peeling:       { bg: palette.cabernetTint,     text: palette.cabernet },
  spot_treatment:{ bg: palette.cabernetTint,     text: palette.cabernet },
  balm:          { bg: palette.cabernetTint,     text: palette.cabernet },
};

const DEFAULT_TYPE_COLOR = { bg: palette.zinc100, text: palette.zinc600 };

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RoutineStepCardProps {
  step: RoutineStep;
  product: Product;
  checked: boolean;
  onToggle: () => void;
  onCardPress: () => void;
  onSchedulePress: () => void;
  conflictingProductName?: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RoutineStepCard({
  step,
  product,
  checked,
  onToggle,
  onCardPress,
  onSchedulePress,
  conflictingProductName,
}: RoutineStepCardProps) {
  const hasConflict = !!conflictingProductName;

  // Resolve active ingredient label (prefer confirmed activeTags, fall back to activeIngredients)
  const activeKey = product.activeTags?.[0] ?? product.activeIngredients?.[0]?.key ?? null;
  const activeLabel = activeKey ? (ACTIVE_INGREDIENT_LABELS[activeKey] ?? null) : null;

  const typeLabel = PRODUCT_TYPE_LABELS[product.productType] ?? product.productType;
  const typeColor = TYPE_COLORS[product.productType] ?? DEFAULT_TYPE_COLOR;
  const scheduleLabel = formatScheduleDays(step.scheduledDays);

  return (
    <Pressable
      onPress={onCardPress}
      style={({ pressed }) => [
        styles.card,
        hasConflict && styles.cardConflict,
        pressed && styles.cardPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, tap to view product detail`}
    >
      {/* Main row: left content + right badges/checkbox */}
      <View style={styles.mainRow}>
        {/* Left column */}
        <View style={styles.leftCol}>
          <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>

          {product.brand ? (
            <Text style={styles.brandName} numberOfLines={1}>{product.brand}</Text>
          ) : null}

          {/* Schedule row — own Pressable so it doesn't trigger card navigation */}
          <Pressable
            onPress={onSchedulePress}
            style={styles.scheduleRow}
            accessibilityRole="button"
            accessibilityLabel={`Schedule: ${scheduleLabel}, tap to edit`}
            hitSlop={6}
          >
            <Feather name="calendar" size={11} color={palette.cabernet} />
            <Text style={styles.scheduleText}>{scheduleLabel}</Text>
          </Pressable>
        </View>

        {/* Right column: badges (top) + checkbox (bottom) */}
        <View style={styles.rightCol}>
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

          {/* Checkbox — inner Pressable captures its own tap, outer card press won't fire */}
          <Checkbox checked={checked} onValueChange={() => onToggle()} size="md" />
        </View>
      </View>

      {/* Conflict row — shown only when there is an active conflict */}
      {hasConflict ? (
        <View style={styles.conflictRow}>
          <Feather name="alert-triangle" size={11} color={palette.amber} />
          <Text style={styles.conflictText} numberOfLines={1}>
            Conflicts with {conflictingProductName}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.zinc100,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    paddingVertical: space[3],
  },
  cardConflict: {
    borderColor: palette.amber,
  },
  cardPressed: {
    backgroundColor: colors.bgSubtle,
  },

  mainRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: space[3],
  },

  // Left column
  leftCol: {
    flex: 1,
    minWidth: 0,
    gap: 3,
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
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 1,
  },
  scheduleText: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  // Right column
  rightCol: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    maxWidth: 140,
  },
  activeBadge: {
    backgroundColor: palette.black,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
    maxWidth: 80,
  },
  activeBadgeText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 10,
    lineHeight: 14,
    color: palette.white,
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

  // Conflict row
  conflictRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: space[2],
    paddingTop: space[2],
    borderTopWidth: 1,
    borderTopColor: palette.amberLine,
  },
  conflictText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 12,
    lineHeight: 16,
    color: palette.amber,
    flexShrink: 1,
  },
});
