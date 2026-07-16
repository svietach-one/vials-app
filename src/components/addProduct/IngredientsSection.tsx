import React, { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { CameraCaptureModal } from '@/components/camera/CameraCaptureModal';
import { InciScanNotice } from '@/components/camera/InciScanNotice';
import { Button } from '@/components/ui/core/Button';
import { ACTIVE_INGREDIENT_LABELS } from '@/constants/labels';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import type { AddProductDraft } from '@/types';
import { parseInciText } from '@/utils/productForm/activeIngredientMatcher';
import { findIntraProductConflicts } from '@/utils/productForm/conflictPreview';
import type { FormAction } from '@/utils/productForm/formReducer';

import { ActivesChecklist } from './ActivesChecklist';
import { DetectedActiveChip } from './DetectedActiveChip';
import { ScanTile } from './ScanTile';

export interface IngredientsSectionProps {
  draft: AddProductDraft;
  dispatch: (action: FormAction) => void;
}

/**
 * Section 3 — actives via INCI OCR, pasted text, or the manual checklist.
 * Optional by design: zero checked/detected actives is a valid final state.
 * A FIRST scan is reachable ONLY through InciScanNotice ("Got it, scan
 * now"); the multi-shot "Add another shot" re-scan intentionally skips the
 * notice — it's the same scanning process for the same product.
 */
export function IngredientsSection({ draft, dispatch }: IngredientsSectionProps) {
  const [noticeVisible, setNoticeVisible] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [pasteVisible, setPasteVisible] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [rawExpanded, setRawExpanded] = useState(false);
  const [rawText, setRawText] = useState(draft.inciRaw ?? '');
  // Whether the open camera is an additive re-shoot (long ingredient lists).
  const [isReshoot, setIsReshoot] = useState(false);
  // Manual checklist stays reachable after any OCR result (even garbled
  // text with zero matches) — and never hides the raw text.
  const [showChecklist, setShowChecklist] = useState(false);
  const [stripNote, setStripNote] = useState(false);

  // Keep the editable raw block in sync when OCR/paste replaces the text,
  // and surface a fresh result expanded — the user must immediately see
  // what was actually scanned.
  useEffect(() => {
    setRawText(draft.inciRaw ?? '');
    if (draft.inciRaw !== null) setRawExpanded(true);
  }, [draft.inciRaw]);

  function applyInciText(text: string) {
    dispatch({
      type: 'APPLY_INCI_OCR_RESULT',
      rawText: text,
      matchedKeys: parseInciText(text),
    });
  }

  function handleInciCapture(capturedText: string, hadNonLatin: boolean) {
    setCameraVisible(false);
    setStripNote(hadNonLatin);
    if (isReshoot && draft.inciRaw !== null) {
      // Multi-shot: concatenate onto the existing text — parseInciText
      // already splits the whole string on commas, so no parser changes.
      applyInciText(`${draft.inciRaw}, ${capturedText}`);
    } else {
      applyInciText(capturedText);
    }
    setIsReshoot(false);
  }

  function handleClearRaw() {
    setStripNote(false);
    dispatch({ type: 'CLEAR_INCI_RAW' });
  }

  const conflictHits = findIntraProductConflicts(draft.activeIngredientKeys);
  const hasOcrData = draft.inciRaw !== null;

  return (
    <View style={styles.wrap}>
      <ScanTile
        icon="file-text"
        label="Scan INCI list"
        caption="The full ingredients list on the back of the packaging"
        onPress={() => setNoticeVisible(true)}
      />

      <Text style={styles.divider}>or check known actives</Text>

      {hasOcrData ? (
        <>
          {draft.activeIngredientKeys.length > 0 ? (
            <View style={styles.chips}>
              {draft.activeIngredientKeys.map((key) => (
                <DetectedActiveChip
                  key={key}
                  activeKey={key}
                  onRemove={(k) => dispatch({ type: 'REMOVE_DETECTED_ACTIVE', key: k })}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.noActives}>
              No known actives detected — that&apos;s fine for a plain product.
            </Text>
          )}

          <View style={styles.rawHeader}>
            <Pressable
              style={styles.rawToggle}
              onPress={() => setRawExpanded((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: rawExpanded }}
            >
              <Feather
                name={rawExpanded ? 'chevron-down' : 'chevron-right'}
                size={16}
                color={colors.textSecondary}
              />
              <Text style={styles.rawToggleLabel}>Full INCI text (raw)</Text>
            </Pressable>
            <Pressable
              onPress={handleClearRaw}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear INCI text"
            >
              <Feather name="x-circle" size={16} color={colors.textTertiary} />
            </Pressable>
          </View>

          {rawExpanded ? (
            <TextInput
              value={rawText}
              onChangeText={setRawText}
              // Re-parse on commit so manual fixes to the OCR text update the
              // detected keys (additively — removals stay a chip-level action).
              onBlur={() => {
                if (rawText !== draft.inciRaw) applyInciText(rawText);
              }}
              multiline
              style={styles.rawInput}
              accessibilityLabel="Full INCI text"
            />
          ) : null}

          {stripNote ? (
            <Text style={styles.stripNote}>
              Some non-Latin characters were removed — check the list looks right.
            </Text>
          ) : null}

          <Pressable
            onPress={() => {
              setIsReshoot(true);
              setCameraVisible(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Add another shot"
          >
            <Text style={styles.pasteLink}>Text didn&apos;t fit? Add another shot.</Text>
          </Pressable>

          <Pressable
            onPress={() => setShowChecklist((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="Choose actives manually"
            accessibilityState={{ expanded: showChecklist }}
          >
            <Text style={styles.pasteLink}>
              {showChecklist ? 'Hide manual checklist' : 'Choose actives manually'}
            </Text>
          </Pressable>

          {showChecklist ? (
            <ActivesChecklist
              selectedKeys={draft.activeIngredientKeys}
              onToggle={(key) => dispatch({ type: 'TOGGLE_ACTIVE_KEY', key })}
            />
          ) : null}
        </>
      ) : (
        <ActivesChecklist
          selectedKeys={draft.activeIngredientKeys}
          onToggle={(key) => dispatch({ type: 'TOGGLE_ACTIVE_KEY', key })}
        />
      )}

      {conflictHits.length > 0 ? (
        <View style={styles.conflictBanner}>
          <Feather name="alert-triangle" size={16} color={palette.amber} />
          <View style={styles.conflictBody}>
            {conflictHits.map((rule) => (
              <Text key={rule.id} style={styles.conflictPair}>
                {ACTIVE_INGREDIENT_LABELS[rule.itemA as keyof typeof ACTIVE_INGREDIENT_LABELS]}
                {' + '}
                {ACTIVE_INGREDIENT_LABELS[rule.itemB as keyof typeof ACTIVE_INGREDIENT_LABELS]}
              </Text>
            ))}
            <Text style={styles.conflictNote}>
              These actives interact — plan them on different days. You&apos;ll see exact
              warnings when this product is in a routine.
            </Text>
          </View>
        </View>
      ) : null}

      {!hasOcrData ? (
        <Pressable
          onPress={() => setPasteVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Paste full INCI text instead"
        >
          <Text style={styles.pasteLink}>Paste full INCI text instead</Text>
        </Pressable>
      ) : null}

      <InciScanNotice
        visible={noticeVisible}
        onScan={() => {
          setNoticeVisible(false);
          setCameraVisible(true);
        }}
        onUseChecklist={() => setNoticeVisible(false)}
      />

      <CameraCaptureModal
        mode="inci"
        visible={cameraVisible}
        onClose={() => {
          setCameraVisible(false);
          setIsReshoot(false);
        }}
        onCapture={(result) => {
          if (result.mode === 'inci') handleInciCapture(result.rawText, result.hadNonLatin);
        }}
      />

      <Modal
        visible={pasteVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setPasteVisible(false)}
      >
        <View style={styles.pasteBackdrop}>
          <View style={styles.pasteCard}>
            <Text style={styles.pasteTitle}>Paste INCI text</Text>
            <Text style={styles.pasteHint}>
              Paste the original Latin-character ingredients list, not a translation.
            </Text>
            <TextInput
              value={pasteText}
              onChangeText={setPasteText}
              multiline
              placeholder="Aqua, Glycerin, Niacinamide, …"
              placeholderTextColor={colors.textTertiary}
              style={styles.pasteInput}
              accessibilityLabel="Pasted INCI text"
            />
            <View style={styles.pasteActions}>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onPress={() => {
                  const text = pasteText.trim();
                  setPasteVisible(false);
                  setPasteText('');
                  if (text) applyInciText(text);
                }}
              >
                Parse ingredients
              </Button>
              <Button variant="ghost" size="lg" fullWidth onPress={() => setPasteVisible(false)}>
                Cancel
              </Button>
            </View>
          </View>
        </View>
      </Modal>
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  noActives: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  rawHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rawToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
  },
  stripNote: {
    ...typography.caption,
    color: palette.amber,
  },
  rawToggleLabel: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: colors.textSecondary,
  },
  rawInput: {
    ...typography.bodySmall,
    // IBM Plex Mono is the target face but isn't installed yet (see tokens.ts
    // font note) — fall back to the platform monospace font.
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace' }),
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.borderDivider,
    borderRadius: radius.md,
    padding: space[3],
    minHeight: 96,
    textAlignVertical: 'top',
    backgroundColor: colors.surfaceSunken,
  },
  conflictBanner: {
    flexDirection: 'row',
    gap: space[3],
    backgroundColor: palette.amberTint,
    borderWidth: 1,
    borderColor: palette.amberLine,
    borderRadius: radius.lg,
    padding: space[3],
  },
  conflictBody: {
    flex: 1,
    gap: space[1],
  },
  conflictPair: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: palette.amber,
  },
  conflictNote: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  pasteLink: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: colors.textSecondary,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
  pasteBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(9, 9, 11, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.gutterScreen,
  },
  pasteCard: {
    width: '100%',
    backgroundColor: colors.bgBase,
    borderRadius: radius.xl,
    padding: space[6],
    gap: space[3],
  },
  pasteTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  pasteHint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  pasteInput: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    padding: space[3],
    minHeight: 120,
    textAlignVertical: 'top',
    backgroundColor: colors.surfaceRaised,
  },
  pasteActions: {
    gap: space[2],
  },
});
