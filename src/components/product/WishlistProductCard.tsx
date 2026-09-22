import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/core/Button';
import { Card } from '@/components/ui/core/Card';
import { Tag } from '@/components/ui/core/Tag';
import { ProductThumbnail } from '@/components/ui/ProductThumbnail';
import { ACTIVE_INGREDIENT_LABELS, CAPABILITY_LABELS } from '@/constants/labels';
import { colors, space, typography } from '@/constants/tokens';
import type { CapabilityKey, Product } from '@/types';
import { buildProductProfileFromProduct } from '@/utils/productProfile';

/**
 * Wishlist tab's card treatment — distinct from ProductShelfCard's Owned
 * treatment (no routine/PAO/hide affordances, since a Wishlist item carries
 * none of those). Layout follows docs/tasks/ux-explore-vials's My Shelf
 * mockup: thumbnail + identity, capability badges sourced from the real
 * Product Profile (Milestone 1 — barrierRepair/exfoliation are the only
 * scored capabilities today, see docs/tasks/product_profile/03-capabilities.md),
 * a short objective description, then Put on my shelf / Remove actions.
 */

const CAPABILITY_ORDER: CapabilityKey[] = [
  'barrierRepair',
  'exfoliation',
  'hydration',
  'brightening',
  'pigmentation',
  'acneControl',
  'sebumRegulation',
  'antioxidantProtection',
  'soothing',
  'antiAging',
];

const MAX_BADGES = 2;

function describeProduct(product: Product, capabilityKeys: CapabilityKey[]): string | null {
  const parts: string[] = [];
  if (capabilityKeys.length > 0) {
    parts.push(`Supports ${CAPABILITY_LABELS[capabilityKeys[0]].toLowerCase()}.`);
  }
  const ingredientLabels = (product.activeTags ?? [])
    .slice(0, 2)
    .map((key) => ACTIVE_INGREDIENT_LABELS[key])
    .filter((label): label is string => !!label);
  if (ingredientLabels.length > 0) {
    parts.push(`Contains ${ingredientLabels.join(' and ')}.`);
  }
  return parts.length > 0 ? parts.join(' ') : null;
}

export interface WishlistProductCardProps {
  product: Product;
  onCardPress: () => void;
  onPutOnShelf: (p: Product) => void;
  onRemove: (p: Product) => void;
}

export function WishlistProductCard({
  product,
  onCardPress,
  onPutOnShelf,
  onRemove,
}: WishlistProductCardProps) {
  const capabilityKeys = useMemo(() => {
    const profile = buildProductProfileFromProduct(product);
    return CAPABILITY_ORDER.filter((key) => {
      const score = profile.capabilities[key].score;
      return score !== null && score > 0;
    }).slice(0, MAX_BADGES);
  }, [product]);

  const description = describeProduct(product, capabilityKeys);

  return (
    <Card interactive onPress={onCardPress} padding="none" style={styles.card}>
      <View style={styles.row}>
        <ProductThumbnail product={product} />
        <View style={styles.content}>
          {product.brand ? (
            <Text style={styles.brand} numberOfLines={1}>
              {product.brand}
            </Text>
          ) : null}
          <Text style={styles.name} numberOfLines={1}>
            {product.name}
          </Text>
        </View>
      </View>

      {capabilityKeys.length > 0 ? (
        <View style={styles.badgeRow}>
          {capabilityKeys.map((key) => (
            <Tag key={key} tone="info">
              {CAPABILITY_LABELS[key]}
            </Tag>
          ))}
        </View>
      ) : null}

      {description ? <Text style={styles.description}>{description}</Text> : null}

      <View style={styles.divider} />

      <View style={styles.actionsRow}>
        <Button
          size="sm"
          onPress={(e) => {
            e?.stopPropagation?.();
            onPutOnShelf(product);
          }}
          style={styles.putOnShelfBtn}
        >
          Put on my shelf
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onPress={(e) => {
            e?.stopPropagation?.();
            onRemove(product);
          }}
        >
          Remove
        </Button>
      </View>
    </Card>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    padding: space[4],
    gap: space[3],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  brand: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  name: {
    ...typography.body,
    fontFamily: 'DMSans-Bold',
    color: colors.textPrimary,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  description: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderDivider,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  putOnShelfBtn: {
    flex: 1,
  },
});
