import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { CameraCaptureModal } from '@/components/camera/CameraCaptureModal';
import { Input } from '@/components/ui/forms/Input';
import { colors, space, typography } from '@/constants/tokens';
import type { AddProductDraft } from '@/types';
import { detectCategory } from '@/utils/productForm/categoryDetector';
import type { FormAction } from '@/utils/productForm/formReducer';
import { splitLabelLines } from '@/utils/productForm/ocrNormalizer';

import { BrandAutocompleteInput } from './BrandAutocompleteInput';
import { CategoryPillRow } from './CategoryPillRow';
import { LabelLinePicker, type LabelLineField } from './LabelLinePicker';
import { ScanTile } from './ScanTile';

export interface BrandNameCategorySectionProps {
  draft: AddProductDraft;
  dispatch: (action: FormAction) => void;
}

/** Removes an OCR line previously appended to a field (best effort — the
 *  field is freely editable, so the line may have been reworded away). */
function removeLineFromField(fieldValue: string, line: string): string {
  return fieldValue.replace(line, '').replace(/\s{2,}/g, ' ').trim();
}

/** Appends an OCR line to a field, space-joined onto existing content. */
function appendLineToField(fieldValue: string, line: string): string {
  return fieldValue.trim().length > 0 ? `${fieldValue.trim()} ${line}` : line;
}

/** Section 1 — brand, product name and category, via label OCR or manual entry. */
export function BrandNameCategorySection({ draft, dispatch }: BrandNameCategorySectionProps) {
  const [cameraVisible, setCameraVisible] = useState(false);
  // Multi-line label OCR: the detected-line chip pool + its assignments.
  const [labelLines, setLabelLines] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<Record<number, LabelLineField>>({});

  function handleLabelCapture(rawText: string) {
    // Category detection always runs on the full text; the reducer-level
    // "manual choice wins" rule is preserved by guarding the source here.
    const detected = detectCategory(rawText);
    if (detected !== null && draft.productTypeSource !== 'manual') {
      dispatch({ type: 'SET_CATEGORY', value: detected, source: 'auto-detected' });
    }

    const lines = splitLabelLines(rawText);
    if (lines.length === 0) return;

    if (lines.length === 1) {
      // A single detected line can only be the brand — skip the chip UI.
      dispatch({ type: 'SET_BRAND', value: lines[0], source: 'ocr' });
      setLabelLines([]);
      setAssignments({});
      return;
    }

    setLabelLines(lines);
    setAssignments({});
  }

  function handleAssignLine(index: number, field: LabelLineField) {
    const line = labelLines[index];
    const previous = assignments[index];
    if (line === undefined || previous === field) return;

    // Reassignment moves the line: pull it out of the field it was in.
    // previous !== field is guaranteed by the guard above, so the two
    // dispatches always touch different fields.
    if (previous === 'brand') {
      dispatch({ type: 'SET_BRAND', value: removeLineFromField(draft.brand, line), source: 'ocr' });
    } else if (previous === 'name') {
      dispatch({ type: 'SET_NAME', value: removeLineFromField(draft.name, line), source: 'ocr' });
    }

    if (field === 'brand') {
      dispatch({ type: 'SET_BRAND', value: appendLineToField(draft.brand, line), source: 'ocr' });
    } else {
      dispatch({ type: 'SET_NAME', value: appendLineToField(draft.name, line), source: 'ocr' });
    }

    setAssignments((prev) => ({ ...prev, [index]: field }));
  }

  function handleSwap() {
    const { brand, name } = draft;
    dispatch({ type: 'SET_BRAND', value: name, source: 'typed' });
    dispatch({ type: 'SET_NAME', value: brand, source: 'typed' });
  }

  return (
    <View style={styles.wrap}>
      <ScanTile
        icon="camera"
        label="Scan front label"
        caption="Point the camera at the front of the packaging"
        onPress={() => setCameraVisible(true)}
      />

      <Text style={styles.divider}>or type manually</Text>

      {labelLines.length > 1 ? (
        <LabelLinePicker lines={labelLines} assignments={assignments} onAssign={handleAssignLine} />
      ) : null}

      <BrandAutocompleteInput
        value={draft.brand}
        onSelectSuggestion={(brand) =>
          dispatch({ type: 'SET_BRAND', value: brand, source: 'autocomplete' })
        }
        onCommitTyped={(text) => dispatch({ type: 'SET_BRAND', value: text, source: 'typed' })}
      />

      <Pressable
        onPress={handleSwap}
        style={styles.swapBtn}
        accessibilityRole="button"
        accessibilityLabel="Swap brand and product name"
      >
        <Feather name="repeat" size={14} color={colors.textSecondary} />
        <Text style={styles.swapLabel}>Swap</Text>
      </Pressable>

      <Input
        label="Product name"
        value={draft.name}
        onChangeText={(text) => dispatch({ type: 'SET_NAME', value: text, source: 'typed' })}
        onClear={() => dispatch({ type: 'SET_NAME', value: '', source: 'typed' })}
        placeholder="e.g. Daily Moisturiser SPF 50"
        autoCapitalize="words"
        autoCorrect={false}
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
          handleLabelCapture(result.rawText);
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
  swapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: space[1],
    paddingHorizontal: space[2],
    paddingVertical: space[1],
  },
  swapLabel: {
    ...typography.caption,
    fontFamily: 'DMSans-Medium',
    color: colors.textSecondary,
  },
});
