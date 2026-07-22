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

/** Assumed height basis for sizing the placeholder glyph in `fill` mode, where the
 *  actual rendered height is dynamic (driven by the parent's layout). */
const FILL_PLACEHOLDER_ICON_BASIS = 104;

/**
 * Width : height. Skincare packaging (bottles, tubes, droppers) is portrait,
 * so a portrait frame crops far less of the product than a square one did.
 */
const ASPECT_W_OVER_H = 3 / 4;

/** Derives the thumbnail width from its height. */
export function productThumbnailWidth(height: number): number {
  return Math.round(height * ASPECT_W_OVER_H);
}

export interface ProductThumbnailProps {
  product: Product;
  /** Height in px; width is derived from the portrait aspect ratio. */
  size?: number;
  /** Dim to match a hidden/disabled card. */
  dimmed?: boolean;
  /**
   * Fill the parent's height edge-to-edge instead of a fixed pixel size
   * (e.g. a shelf card's leading photo, flush with the card's left/top/
   * bottom edges). Width is still derived from the portrait aspect ratio.
   * Only the leading corners are rounded — the trailing corners are square
   * since that edge borders the card's text column, not the card boundary.
   */
  fill?: boolean;
}

export function ProductThumbnail({
  product,
  size = DEFAULT_SIZE,
  dimmed = false,
  fill = false,
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
        fill
          ? styles.boxFill
          : { width: productThumbnailWidth(size), height: size, borderRadius: radius.sm },
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
        <ProductThumbnailPlaceholder
          productType={product.productType}
          size={fill ? FILL_PLACEHOLDER_ICON_BASIS : size}
        />
      )}
    </View>
  );
}

// ─── Placeholder ──────────────────────────────────────────────────────────────

export interface ProductThumbnailPlaceholderProps {
  productType: ProductType;
  /** Height in px — matches {@link ProductThumbnailProps.size}. */
  size: number;
}

/**
 * Own subcomponent with a stable prop contract so future custom artwork can
 * replace it without touching {@link ProductThumbnail}'s API. A Feather `image`
 * glyph on a muted per-type wash — deliberately a filled tile (a product with
 * no photo yet), semantically distinct from any future "deleted"/empty-slot
 * placeholder.
 *
 * Fills its parent, so it is the same portrait rectangle as a real photo. The
 * glyph scales off the WIDTH, the constraining edge in a portrait frame.
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
      <Feather
        name="image"
        size={Math.round(productThumbnailWidth(size) * 0.4)}
        color={palette.zinc400}
      />
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
  // Edge-to-edge card variant: no border (nothing should read as a "gap"
  // from the card's edges), only the leading corners rounded to match the
  // card's own radius — the trailing corners butt against the text column.
  // No explicit height: the parent row's `alignItems: 'stretch'` sizes this
  // view to match its sibling's height, and aspectRatio derives the width
  // from that. A `height: '100%'` here would resolve against the nearest
  // ancestor with a DEFINITE height instead — since the row itself is
  // content-sized (no fixed height), that bubbles up to the screen/FlatList
  // container and blows the image (and card) up to full-screen size.
  boxFill: {
    aspectRatio: ASPECT_W_OVER_H,
    alignSelf: 'stretch',
    borderWidth: 0,
    borderTopLeftRadius: radius.sm,
    borderBottomLeftRadius: radius.sm,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
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
