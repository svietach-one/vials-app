import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { CameraCaptureModal } from '@/components/camera/CameraCaptureModal';
import { colors, radius, space, typography } from '@/constants/tokens';
import type { AddProductDraft } from '@/types';
import { detectCategory } from '@/utils/productForm/categoryDetector';
import type { FormAction } from '@/utils/productForm/formReducer';
import { splitLabelText } from '@/utils/productForm/ocrNormalizer';

import { BrandAutocompleteInput } from './BrandAutocompleteInput';
import { CategoryPillRow } from './CategoryPillRow';
import { ScanTile } from './ScanTile';

export interface BrandNameCategorySectionProps {
  draft: AddProductDraft;
  dispatch: (action: FormAction) => void;
}

/** Section 1 — brand, product name and category, via label OCR or manual entry. */
export function BrandNameCategorySection({ draft, dispatch }: BrandNameCategorySectionProps) {
  const [cameraVisible, setCameraVisible] = useState(false);

  return (
    <View style={styles.wrap}>
      <ScanTile
        icon="camera"
        label="Scan front label"
        caption="Point the camera at the front of the packaging"
        onPress={() => setCameraVisible(true)}
      />

      <Text style={styles.divider}>or type manually</Text>

      <BrandAutocompleteInput
        value={draft.brand}
        onSelectSuggestion={(brand) =>
          dispatch({ type: 'SET_BRAND', value: brand, source: 'autocomplete' })
        }
        onCommitTyped={(text) => dispatch({ type: 'SET_BRAND', value: text, source: 'typed' })}
      />

      <TextInput
        value={draft.name}
        onChangeText={(text) => dispatch({ type: 'SET_NAME', value: text, source: 'typed' })}
        placeholder="Product name"
        placeholderTextColor={colors.textTertiary}
        autoCapitalize="words"
        autoCorrect={false}
        style={styles.input}
        accessibilityLabel="Product name"
      />

      <CategoryPillRow
        selected={draft.productType}
        autoDetected={draft.productTypeSource === 'auto-detected'}
        onSelect={(type) => dispatch({ type: 'SET_CATEGORY', value: type, source: 'manual' })}
      />

      <CameraCaptureModal
        mode="label"
        visible={cameraVisible}
        onClose={() => setCameraVisible(false)}
        onCapture={(result) => {
          setCameraVisible(false);
          if (result.mode !== 'label') return;
          const { brand, name } = splitLabelText(result.rawText);
          dispatch({
            type: 'APPLY_LABEL_OCR_RESULT',
            brand,
            name,
            detectedType: detectCategory(result.rawText),
          });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space[3],
  },
  divider: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    ...typography.body,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    paddingVertical: space[3],
    backgroundColor: colors.surfaceRaised,
  },
});
