import React, { useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Icon } from '@/components/ui/Icon';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { CameraCaptureModal } from '@/components/camera/CameraCaptureModal';
import { ScanTile } from '@/components/addProduct/ScanTile';
import { AppHeader } from '@/components/ui/core/AppHeader';
import { Button } from '@/components/ui/core/Button';
import { FilterChip } from '@/components/ui/core/FilterChip';
import { IconButton } from '@/components/ui/core/IconButton';
import { PRODUCT_TYPE_LABELS } from '@/constants/labels';
import { colors, radius, space, typography } from '@/constants/tokens';
import type { CatalogStackParamList } from '@/navigation/AppNavigator';
import type { CaptureResult, ProductType } from '@/types';
import { trackEvent } from '@/utils/analytics';
import { extractIngredientSection } from '@/utils/productProfile/ingredientSectionExtractor';
import { mergeIngredientCaptures } from '@/utils/productProfile/mergeIngredientCaptures';
import { tokenizeIngredientsText } from '@/utils/productProfile/resolve';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<CatalogStackParamList, 'ExploreCompositionCapture'>;

/**
 * A small, single-tap category set — the same option labels
 * `ManualProductFormScreen.tsx` uses (`PRODUCT_TYPE_LABELS`), not a second
 * taxonomy. **Required as of 2026-08-27** (was previously optional, tech
 * design Assumption 1) — validated before either capture path opens, per
 * `requireCategory()` below.
 */
const CATEGORY_OPTIONS = Object.keys(PRODUCT_TYPE_LABELS) as ProductType[];

// ─── Screen ───────────────────────────────────────────────────────────────────

/**
 * Explore Composition flow's capture screen (tech design FE-2). **Redesigned
 * 2026-08-27** per a human design reference: a single neutral headline
 * explaining the screen's purpose (no "your" — the product isn't owned yet,
 * see spec Story 1's framing; consolidated from an initial headline+
 * subheadline pair into one sentence per the human's own follow-up
 * simplification), then the required category chips, then a
 * photo-capture tile reusing `ScanTile` (the same dashed-border camera-launch
 * tile already shared by the manual-entry wizard's sections — not a new
 * component) with "Paste text manually" as a lower-emphasis secondary
 * action below it (still a text link, not a card/outlined button — keeps
 * the primary/secondary weighting from `06-capture-screen-hierarchy.md`, only
 * the primary action's own presentation changed from a filled `Button` to
 * `ScanTile`). No hero illustration — not available yet. No brand/name field
 * anywhere.
 *
 * **2026-09-09 (docs/investigations/ocr-incomplete-ingredient-capture.md):**
 * the PHOTO path no longer navigates the instant a shot completes — a single
 * photo often can't fit a long ingredient list in one legible frame (real
 * device-QA sample: a long single-line wrap on a narrow box side), and there
 * is no reliable way to auto-detect that (an earlier geometry-based attempt
 * shipped and had to be reverted the same day — see the investigation doc
 * §6a). Instead, after a capture the screen pauses on an explicit "Text
 * didn't fit? Add another shot." / "Continue" choice, mirroring the
 * already-shipped pattern in `IngredientsSection.tsx`; a second shot is
 * merged onto the first via `mergeIngredientCaptures.ts` (fuzzy tail/head
 * overlap dedup, not naive concatenation). This deliberately supersedes this
 * file's own previously-documented "instant navigate, no intermediate step"
 * contract — but PHOTO ONLY. The PASTE path is unchanged and still navigates
 * the instant "Parse ingredients" is pressed (spec Story 1 AC2/AC3 stands
 * for paste): pasted text has no framing/multi-shot problem to solve, and
 * the user can already edit it before submitting.
 */
export default function ExploreCompositionCaptureScreen({ navigation, route }: Props) {
  const [category, setCategory] = useState<ProductType | null>(route.params?.category ?? null);
  const [categoryError, setCategoryError] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [pasteVisible, setPasteVisible] = useState(false);
  const [pasteText, setPasteText] = useState('');
  // Raw text accumulated across the photo path's shots — null before any
  // shot completes. Merged (not overwritten, see mergeIngredientCaptures) on
  // every subsequent capture, so "Add another shot" can be tapped more than
  // once for a very long list.
  const [capturedIngredientsText, setCapturedIngredientsText] = useState<string | null>(null);
  // One thumbnail per shot taken, in order — the visible proof (2026-09-09
  // user feedback: "не понимаю что оно прикрепилось") that every photo the
  // user took was actually picked up, not just the most recent one.
  const [capturedPhotoUris, setCapturedPhotoUris] = useState<string[]>([]);
  // Dedicated shot counter — NOT derived from capturedPhotoUris.length.
  // sourceUri can legitimately come back null (CameraCaptureModal.tsx sets
  // it from `assets[0]?.uri ?? null`), in which case that array would
  // undercount how many shots were actually merged into
  // capturedIngredientsText. finalizeCapturedText's single-vs-multi-shot
  // decision must never depend on optional data — code-review caught that
  // exactly this gap could silently reintroduce the §6d data-loss bug.
  const [shotCount, setShotCount] = useState(0);

  // `extractIngredientSection`'s single "cut at the first stop-marker" pass
  // is built for ONE complete label capture — on a multi-shot merge it can
  // silently drop real content. Confirmed on a real device photo pair
  // (2026-09-09, docs/investigations/ocr-incomplete-ingredient-capture.md):
  // shot 1 already contained its own trailing "Made in Poland by:" footer
  // (its photo happened to capture both), so once shot 2's genuinely new
  // ingredients (Isopropyl Myristate, Cetearyl Alcohol, Hydroxyacetophenone)
  // were appended after it, the single cut-at-first-marker pass stopped at
  // shot 1's OWN "Made in" and discarded all of shot 2's contribution.
  // Extracting each shot individually before merging doesn't fix this
  // either — a shot with no header of its own (a mid-label continuation)
  // can have a warnings sentence sitting before ITS OWN real ingredient
  // tail, with nothing to anchor on. So: skip the trim entirely once more
  // than one photo has been merged, and trust `mergeIngredientCaptures`'s
  // own overlap dedup instead — a noisier ingredient count (some
  // Directions/Warnings prose may show up as fake tokens) is the accepted
  // cost of never silently losing real ingredient data, consistent with
  // this module's own "under-filtering over over-filtering" principle.
  function finalizeCapturedText(rawText: string): string {
    return shotCount > 1 ? rawText : extractIngredientSection(rawText);
  }

  // Live count for the "N ingredients recognized" status line — mirrors
  // exactly what will navigate to the Result screen (see
  // `finalizeCapturedText`), so the number shown here is never lying about
  // what actually made it through. Memoized: this reruns a regex-based
  // header search over the full accumulated text, and this screen re-renders
  // for reasons unrelated to it (category chip taps, paste modal state).
  const finalizedCapturedText = useMemo(
    () => (capturedIngredientsText !== null ? finalizeCapturedText(capturedIngredientsText) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finalizeCapturedText closes over shotCount, already a dep
    [capturedIngredientsText, shotCount],
  );
  const recognizedIngredientCount =
    finalizedCapturedText !== null ? tokenizeIngredientsText(finalizedCapturedText).length : 0;

  function goToResult(rawIngredientsText: string) {
    navigation.navigate('ExploreCompositionResult', {
      rawIngredientsText,
      category,
    });
  }

  function handleCapture(result: CaptureResult) {
    setCameraVisible(false);
    if (result.mode !== 'inci') return;
    // Fires once per FLOW, not once per shot (docs/tasks/explore_insights/
    // 07-analytics-events.md names this a capture-flow-start event, and the
    // funnel it feeds compares it against explore_result_viewed) — a
    // "Add another shot" reshoot is a continuation of the same flow, not a
    // new one, so it must not re-fire this.
    if (capturedIngredientsText === null) {
      trackEvent({ name: 'explore_capture_started', method: 'photo', category });
    }
    setShotCount((prev) => prev + 1);
    setCapturedIngredientsText((prev) =>
      prev !== null ? mergeIngredientCaptures(prev, result.rawText) : result.rawText,
    );
    const { sourceUri } = result;
    if (sourceUri) {
      setCapturedPhotoUris((prev) => [...prev, sourceUri]);
    }
  }

  function handleContinue() {
    if (finalizedCapturedText !== null) goToResult(finalizedCapturedText);
  }

  function handleParsePress() {
    const text = pasteText.trim();
    setPasteVisible(false);
    setPasteText('');
    if (text) {
      trackEvent({ name: 'explore_capture_started', method: 'paste', category });
      goToResult(extractIngredientSection(text));
    }
  }

  function toggleCategory(value: ProductType) {
    setCategory((prev) => (prev === value ? null : value));
    setCategoryError(false);
  }

  // Category is now required (2026-08-27, product decision — was previously
  // optional, see spec §10/Assumption reversal note): validated before either
  // capture path opens, not after, so the user isn't sent through OCR/paste
  // only to be turned back at the end.
  function requireCategory(): boolean {
    if (category === null) {
      setCategoryError(true);
      return false;
    }
    return true;
  }

  function handlePhotographPress() {
    if (!requireCategory()) return;
    setCameraVisible(true);
  }

  function handlePastePress() {
    if (!requireCategory()) return;
    setPasteVisible(true);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader
        title="Explore Composition"
        leftAction={
          <IconButton
            icon={<Icon name="arrow-left" size={20} color={colors.textPrimary} />}
            label="Back"
            variant="ghost"
            size="sm"
            onPress={() => navigation.goBack()}
          />
        }
      />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headline}>
          Choose a category and add the ingredients to see the details.
        </Text>

        <Text style={styles.categoryLabel}>Category</Text>
        <View style={styles.chipsWrap}>
          {CATEGORY_OPTIONS.map((value) => (
            <FilterChip
              key={value}
              selected={category === value}
              onPress={() => toggleCategory(value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: category === value }}
            >
              {PRODUCT_TYPE_LABELS[value]}
            </FilterChip>
          ))}
        </View>
        {categoryError ? (
          <Text style={styles.categoryErrorText}>Please select a category to continue.</Text>
        ) : null}

        {capturedIngredientsText === null ? (
          <View style={styles.captureBlock}>
            <ScanTile
              icon="camera"
              label="Take a photo"
              caption="Photograph the ingredient list on the label"
              onPress={handlePhotographPress}
            />
            <Button variant="textActive" size="md" onPress={handlePastePress} style={styles.pasteLinkBtn}>
              Paste text manually
            </Button>
          </View>
        ) : (
          <View style={styles.captureBlock}>
            <View style={styles.thumbnailRow}>
              {capturedPhotoUris.map((uri, index) => (
                <Image
                  key={`${uri}-${index}`}
                  source={{ uri }}
                  style={styles.thumbnail}
                  accessibilityLabel={`Captured photo ${index + 1}`}
                />
              ))}
            </View>
            <Text style={styles.capturedNotice}>
              {capturedPhotoUris.length > 1
                ? `${capturedPhotoUris.length} photos combined — `
                : ''}
              {recognizedIngredientCount === 1
                ? '1 ingredient recognized'
                : `${recognizedIngredientCount} ingredients recognized`}
            </Text>
            <Button variant="primary" size="lg" fullWidth onPress={handleContinue}>
              Continue
            </Button>
            <Button
              variant="ghost"
              size="sm"
              fullWidth
              onPress={handlePhotographPress}
              accessibilityLabel="Add another shot"
            >
              Missing something? Add another shot.
            </Button>
            <Text style={styles.addShotHint}>
              Turn the jar or unfold the label to show what&apos;s left, and make sure
              it all fits in the new photo — it will be added to what we already read,
              not replace it.
            </Text>
          </View>
        )}
      </ScrollView>

      <CameraCaptureModal
        mode="inci"
        visible={cameraVisible}
        onClose={() => setCameraVisible(false)}
        onCapture={handleCapture}
      />

      <Modal
        visible={pasteVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setPasteVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.pasteBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.pasteScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.pasteCard}>
              <Text style={styles.pasteTitle}>Paste ingredient text</Text>
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
                accessibilityLabel="Paste ingredient text"
              />
              <View style={styles.pasteActions}>
                <Button variant="primary" size="lg" fullWidth onPress={handleParsePress}>
                  Parse ingredients
                </Button>
                <Button variant="ghost" size="lg" fullWidth onPress={() => setPasteVisible(false)}>
                  Cancel
                </Button>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgScreen,
  },
  content: {
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[5],
    paddingBottom: space[12],
    gap: space[3],
  },
  headline: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: space[2],
  },
  categoryLabel: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
    marginBottom: -space[1],
  },
  categoryErrorText: {
    ...typography.bodySmall,
    color: colors.statusWarningAccent,
  },
  captureBlock: {
    gap: space[3],
    paddingVertical: space[2],
  },
  thumbnailRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space[2],
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderDivider,
    backgroundColor: colors.surfaceSunken,
  },
  capturedNotice: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  addShotHint: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  pasteLinkBtn: {
    alignSelf: 'center',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  pasteBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(9, 9, 11, 0.6)',
  },
  pasteScrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.gutterScreen,
    paddingVertical: space[6],
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
    maxHeight: 240,
    textAlignVertical: 'top',
    backgroundColor: colors.surfaceRaised,
  },
  pasteActions: {
    gap: space[2],
  },
});
