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
  eye_cream:     { bg: palette.bottleGreenTint,  text: palette.bottleGreen },
  mask:          { bg: palette.amberTint,        text: palette.amber },
  peeling:       { bg: palette.amberTint,        text: palette.amber },
  spot_treatment:{ bg: palette.amberTint,        text: palette.amber },
  balm:          { bg: palette.bottleGreenTint,  text: palette.bottleGreen },
};

const DEFAULT_TYPE_COLOR = { bg: palette.zinc100, text: palette.zinc600 };

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RoutineStepCardProps {
  step: RoutineStep;
  product: Product;
  checked: boolean;
  onToggle: () => void;
  onCardPress: () => void;
  conflictingProductName?: string | null;
  /** When provided, a drag handle is rendered and long-pressing it initiates drag. */
  onDrag?: () => void;
}

// ─── Drag handle ──────────────────────────────────────────────────────────────

function DragHandle({ onDrag }: { onDrag: () => void }) {
  return (
    <Pressable
      onLongPress={onDrag}
      style={dragStyles.container}
      hitSlop={8}
      accessibilityLabel="Hold to reorder"
    >
      <View style={dragStyles.dotsGrid}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={dragStyles.dot} />
        ))}
      </View>
    </Pressable>
  );
}

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

// ─── Component ────────────────────────────────────────────────────────────────

export function RoutineStepCard({
  step,
  product,
  checked,
  onToggle,
  onCardPress,
  conflictingProductName,
  onDrag,
}: RoutineStepCardProps) {
  const hasConflict = !!conflictingProductName;

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
      {/* Main row: drag handle (optional) + left content + right badges/checkbox */}
      <View style={styles.mainRow}>
        {onDrag ? <DragHandle onDrag={onDrag} /> : null}

        {/* Left column */}
        <View style={styles.leftCol}>
          <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>

          {product.brand ? (
            <Text style={styles.brandName} numberOfLines={1}>{product.brand}</Text>
          ) : null}

          {/* Schedule row — display only, not pressable */}
          <View style={styles.scheduleRow}>
            <Feather name="calendar" size={11} color={colors.textTertiary} />
            <Text style={styles.scheduleText}>{scheduleLabel}</Text>
          </View>
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

          <Checkbox checked={checked} onValueChange={() => onToggle()} size="md" />
        </View>
      </View>

      {/* Conflict row */}
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
    borderColor: palette.zinc200,
    borderRadius: radius.xl,
    paddingHorizontal: space[4],
    paddingVertical: space[4],
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

  leftCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
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
    marginTop: 2,
  },
  scheduleText: {
    ...typography.caption,
    color: colors.textSecondary,
  },

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
