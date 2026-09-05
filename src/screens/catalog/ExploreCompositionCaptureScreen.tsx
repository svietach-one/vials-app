import React, { useState } from 'react';
import {
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
 * anywhere. Either path navigates straight to `ExploreCompositionResult` the
 * instant capture completes, in the same synchronous handler, so the raw
 * text is never at risk of being lost to an intermediate step (spec Story 1
 * AC2/AC3).
 */
export default function ExploreCompositionCaptureScreen({ navigation, route }: Props) {
  const [category, setCategory] = useState<ProductType | null>(route.params?.category ?? null);
  const [categoryError, setCategoryError] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [pasteVisible, setPasteVisible] = useState(false);
  const [pasteText, setPasteText] = useState('');

  function goToResult(rawIngredientsText: string) {
    // Cuts off Directions/Warnings/manufacturer text that a real product
    // photo often captures right after the ingredients paragraph (2026-08-27
    // tech-lead review follow-up) — applied once, here, before the text is
    // ever stored or analyzed, so both capture paths and every downstream
    // consumer (matrix count, active-ingredient parsing, a promoted
    // Product's fullIngredientText) see the same clean text.
    const trimmedIngredientsText = extractIngredientSection(rawIngredientsText);
    navigation.navigate('ExploreCompositionResult', {
      rawIngredientsText: trimmedIngredientsText,
      category,
    });
  }

  function handleCapture(result: CaptureResult) {
    setCameraVisible(false);
    if (result.mode !== 'inci') return;
    trackEvent({ name: 'explore_capture_started', method: 'photo', category });
    goToResult(result.rawText);
  }

  function handleParsePress() {
    const text = pasteText.trim();
    setPasteVisible(false);
    setPasteText('');
    if (text) {
      trackEvent({ name: 'explore_capture_started', method: 'paste', category });
      goToResult(text);
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
