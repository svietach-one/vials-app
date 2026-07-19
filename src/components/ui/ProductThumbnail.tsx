import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { palette, radius } from '@/constants/tokens';
import { localPhotoExists } from '@/services/imageFile';
import type { Product, ProductType } from '@/types';
import { getProductThumbnailTint } from '@/utils/productThumbnailTint';

/**
 * The single owner of product-image display logic (img-02). Resolves the
 * render source by precedence `localImageUri ?? imageUrl ?? placeholder`,
 * handles every image state, and renders the tinted placeholder. Cards never
 * implement any of this themselves.
 */

const DEFAULT_SIZE = 44;

export interface ProductThumbnailProps {
  product: Product;
  /** Square edge in px. 44 on routine cards, 52 on the shelf card. */
  size?: number;
  /** Dim to match a hidden/disabled card. */
  dimmed?: boolean;
}

export function ProductThumbnail({
  product,
  size = DEFAULT_SIZE,
  dimmed = false,
}: ProductThumbnailProps) {
  const uri = product.localImageUri ?? product.imageUrl ?? null;
  const isLocal = !!product.localImageUri && uri === product.localImageUri;

  const [failed, setFailed] = useState(false);
  const [localMissing, setLocalMissing] = useState(false);

  // Reset error state when the source changes.
  useEffect(() => {
    setFailed(false);
    setLocalMissing(false);
  }, [uri]);

  // Android's <Image onError> does not reliably fire for a missing `file://`
  // URI (e.g. a dangling localImageUri after a restore), so proactively verify
  // a local file's existence off the render thread and fall back to the
  // placeholder. Result is cached in state, keyed to the URI via the deps.
  useEffect(() => {
    if (!isLocal || !uri) return;
    let cancelled = false;
    void localPhotoExists(uri).then((exists) => {
      if (!cancelled && !exists) setLocalMissing(true);
    });
    return () => {
      cancelled = true;
    };
  }, [uri, isLocal]);

  const showImage = !!uri && !failed && !localMissing;

  return (
    <View
      testID="product-thumbnail"
      style={[
        styles.box,
        { width: size, height: size, borderRadius: radius.sm },
        dimmed && styles.dimmed,
      ]}
    >
      {showImage ? (
        <Image
          testID="product-thumbnail-image"
          source={{ uri: uri as string }}
          style={styles.image}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <ProductThumbnailPlaceholder productType={product.productType} size={size} />
      )}
    </View>
  );
}

// ─── Placeholder ──────────────────────────────────────────────────────────────

export interface ProductThumbnailPlaceholderProps {
  productType: ProductType;
  size: number;
}

/**
 * Own subcomponent with a stable prop contract so future custom artwork can
 * replace it without touching {@link ProductThumbnail}'s API. A Feather `image`
 * glyph on a muted per-type wash — deliberately a filled tile (a product with
 * no photo yet), semantically distinct from any future "deleted"/empty-slot
 * placeholder.
 */
export function ProductThumbnailPlaceholder({
  productType,
  size,
}: ProductThumbnailPlaceholderProps) {
  return (
    <View
      testID="product-thumbnail-placeholder"
      style={[styles.placeholder, { backgroundColor: getProductThumbnailTint(productType) }]}
    >
      <Feather name="image" size={Math.round(size * 0.4)} color={palette.zinc400} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    overflow: 'hidden',
    backgroundColor: palette.zinc100,
    borderWidth: 1,
    borderColor: palette.zinc200,
    flexShrink: 0,
  },
  dimmed: {
    opacity: 0.4,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
