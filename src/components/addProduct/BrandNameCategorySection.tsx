import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CameraCaptureModal } from '@/components/camera/CameraCaptureModal';
import { Input } from '@/components/ui/forms/Input';
import { colors, space, typography } from '@/constants/tokens';
import type { AddProductDraft } from '@/types';
import { suggestLabelLineCorrection } from '@/utils/productForm/brandCorrection';
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
  // Dictionary "Did you mean …?" spellings per line — never auto-applied;
  // the raw OCR text stays until the user taps Use (spec caveat 3).
  const [suggestions, setSuggestions] = useState<Record<number, string>>({});

  // Clearing a field by hand (not via reassignment) must release any chip
  // still marked assigned to it — otherwise handleAssignLine's "already
  // assigned to this field" guard blocks re-adding the same chip to a field
  // the user just emptied out.
  useEffect(() => {
    if (draft.brand.trim().length > 0) return;
    setAssignments((prev) => {
      if (!Object.values(prev).includes('brand')) return prev;
      const next: Record<number, LabelLineField> = {};
      for (const [key, field] of Object.entries(prev)) {
        if (field !== 'brand') next[Number(key)] = field;
      }
      return next;
    });
  }, [draft.brand]);

  useEffect(() => {
    if (draft.name.trim().length > 0) return;
    setAssignments((prev) => {
      if (!Object.values(prev).includes('name')) return prev;
      const next: Record<number, LabelLineField> = {};
      for (const [key, field] of Object.entries(prev)) {
        if (field !== 'name') next[Number(key)] = field;
      }
      return next;
    });
  }, [draft.name]);

  function handleLabelCapture(rawText: string) {
    // Category detection always runs on the full text; the reducer-level
    // "manual choice wins" rule is preserved by guarding the source here.
    const detected = detectCategory(rawText);
    if (detected !== null && draft.productTypeSource !== 'manual') {
      dispatch({ type: 'SET_CATEGORY', value: detected, source: 'auto-detected' });
    }

    const lines = splitLabelLines(rawText);
    if (lines.length === 0) return;

    const nextSuggestions: Record<number, string> = {};
    lines.forEach((line, index) => {
      const suggestion = suggestLabelLineCorrection(line);
      if (suggestion !== null) nextSuggestions[index] = suggestion;
    });

    if (lines.length === 1) {
      // A single detected line can only be the brand — the field gets the
      // raw OCR text either way; the chip pool stays visible only to host
      // a pending "Did you mean …?" suggestion.
      dispatch({ type: 'SET_BRAND', value: lines[0], source: 'ocr' });
      const hasSuggestion = nextSuggestions[0] !== undefined;
      setLabelLines(hasSuggestion ? lines : []);
      setAssignments(hasSuggestion ? { 0: 'brand' } : {});
      setSuggestions(nextSuggestions);
      return;
    }

    setLabelLines(lines);
    setAssignments({});
    setSuggestions(nextSuggestions);
  }

  function handleAcceptSuggestion(index: number) {
    const suggestion = suggestions[index];
    const rawLine = labelLines[index];
    if (suggestion === undefined || rawLine === undefined) return;

    // If the raw line is already assigned to a field, swap it for the
    // accepted spelling there too; unassigned chips just update in place.
    const field = assignments[index];
    if (field === 'brand') {
      dispatch({
        type: 'SET_BRAND',
        value: appendLineToField(removeLineFromField(draft.brand, rawLine), suggestion),
        source: 'ocr',
      });
    } else if (field === 'name') {
      dispatch({
        type: 'SET_NAME',
        value: appendLineToField(removeLineFromField(draft.name, rawLine), suggestion),
        source: 'ocr',
      });
    }

    // A single-line pool only existed to host the suggestion — retire it,
    // same as the dismiss path.
    if (labelLines.length === 1) {
      setLabelLines([]);
      setAssignments({});
      setSuggestions({});
      return;
    }

    setLabelLines((prev) => prev.map((line, i) => (i === index ? suggestion : line)));
    setSuggestions((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  }

  function handleDismissSuggestion(index: number) {
    setSuggestions((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    // A single-line pool only existed to host the suggestion — retire it.
    if (labelLines.length === 1) {
      setLabelLines([]);
      setAssignments({});
    }
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

  return (
    <View style={styles.wrap}>
      <ScanTile
        icon="camera"
        label="Scan front label"
        onPress={() => setCameraVisible(true)}
        compact
      />

      <Text style={styles.divider}>or type manually</Text>

      {labelLines.length > 0 ? (
        <LabelLinePicker
          lines={labelLines}
          assignments={assignments}
          onAssign={handleAssignLine}
          suggestions={suggestions}
          onAcceptSuggestion={handleAcceptSuggestion}
          onDismissSuggestion={handleDismissSuggestion}
        />
      ) : null}

      <BrandAutocompleteInput
        value={draft.brand}
        onSelectSuggestion={(brand) =>
          dispatch({ type: 'SET_BRAND', value: brand, source: 'autocomplete' })
        }
        onCommitTyped={(text) => dispatch({ type: 'SET_BRAND', value: text, source: 'typed' })}
      />

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
  },
});
