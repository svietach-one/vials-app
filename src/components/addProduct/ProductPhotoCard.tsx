import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/core/Button';
import { colors, radius, space, typography } from '@/constants/tokens';

import { FadeIn } from './FadeIn';
import { ScanTile } from './ScanTile';

export interface ProductPhotoCardProps {
  /** Stored product-photo URI, or null before a photo is taken/chosen. */
  imageUri: string | null;
  /** Launch the camera — the shot becomes the product cover. OCR is a separate, opt-in step. */
  onTakePhoto: () => void;
  /** Pick an existing image from the photo library. */
  onChooseLibrary: () => void;
}

const PREVIEW_SIZE = 132;

/**
 * Step 1 photo entry for the Add Product wizard. Deliberately flat (no card /
 * shadow): a bordered "Take product photo" tile in the same style as the other
 * scan tiles. The shot becomes the product cover outright (the caption states
 * this) — OCR to prefill brand/name is a separate, opt-in step surfaced
 * elsewhere once a photo exists. Once taken, the tile is replaced by the photo
 * preview (tap to retake).
 */
export function ProductPhotoCard({
  imageUri,
  onTakePhoto,
  onChooseLibrary,
}: ProductPhotoCardProps) {
  return (
    <View style={styles.wrap}>
      {imageUri ? (
        <FadeIn key={imageUri} style={styles.previewWrap}>
          <Pressable
            style={styles.previewBox}
            onPress={onTakePhoto}
            accessibilityRole="button"
            accessibilityLabel="Retake product photo"
          >
            <Image
              source={{ uri: imageUri }}
              style={styles.previewImage}
              resizeMode="cover"
              accessibilityLabel="Product photo preview"
            />
          </Pressable>
        </FadeIn>
      ) : (
        <ScanTile icon="camera" label="Take product photo" onPress={onTakePhoto} compact />
      )}

      <Text style={styles.caption}>
        {imageUri
          ? 'This photo will be saved as your product cover'
          : "Take a clear photo of the front with labels. We'll use it as the product cover."}
      </Text>

      <Button
        variant="textActive"
        size="sm"
        onPress={onChooseLibrary}
        accessibilityLabel="Choose photo from library"
        style={styles.libraryButton}
      >
        Choose photo from library
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space[2],
  },
  previewWrap: {
    alignSelf: 'center',
  },
  // Bordered, NOT shadowed — a framed photo slot, tap to retake.
  previewBox: {
    width: PREVIEW_SIZE,
    height: PREVIEW_SIZE,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  caption: {
    ...typography.caption, // 14px
    color: colors.textSecondary,
    textAlign: 'center',
  },
  libraryButton: {
    alignSelf: 'center',
  },
});
