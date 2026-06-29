import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { IconButton } from '@/components/ui/core/IconButton';
import { Tag } from '@/components/ui/core/Tag';
import { colors, radius, space, typography } from '@/constants/tokens';
import type { Product, ProductType } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<ProductType, string> = {
  cleanser: 'Cleanser',
  toner: 'Toner',
  essence: 'Essence',
  serum: 'Serum',
  gel: 'Gel',
  moisturizer: 'Moisturizer',
  oil: 'Face Oil',
  spf: 'Sunscreen',
  makeup_remover: 'Makeup Remover',
  peeling: 'Peeling',
  ampoule: 'Ampoule',
  lotion: 'Lotion',
  cream: 'Cream',
  eye_cream: 'Eye Cream',
  mask: 'Mask',
  balm: 'Balm',
  spot_treatment: 'Spot Treatment',
  other: 'Other',
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProductPickerCardProps {
  product: Product;
  onAdd: (product: Product) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductPickerCard({ product, onAdd }: ProductPickerCardProps) {
  const typeLabel = TYPE_LABELS[product.productType];

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>
            {product.name}
          </Text>
          {product.brand ? (
            <Text style={styles.brand} numberOfLines={1}>
              {product.brand}
            </Text>
          ) : null}
        </View>

        <View style={styles.controls}>
          <Tag tone="neutral">{typeLabel}</Tag>
          <IconButton
            icon={<Feather name="plus" size={18} color="#FFFFFF" />}
            label={`Add ${product.name} to routine`}
            variant="filled"
            size="md"
            round
            onPress={() => onAdd(product)}
          />
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderDivider,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[4],
    gap: space[3],
  },
  info: {
    flex: 1,
    gap: space[1],
  },
  name: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  brand: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    flexShrink: 0,
  },
});
