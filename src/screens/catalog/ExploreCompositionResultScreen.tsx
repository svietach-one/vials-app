import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Icon } from '@/components/ui/Icon';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '@/components/ui/core/Button';
import { IconButton } from '@/components/ui/core/IconButton';
import { AppHeader } from '@/components/ui/core/AppHeader';
import { Input } from '@/components/ui/forms/Input';
import { BrandAutocompleteInput } from '@/components/addProduct/BrandAutocompleteInput';
import { CompositionInsightsSection } from '@/components/catalog/CompositionInsightsSection';
import { colors, space, typography } from '@/constants/tokens';
import type { CatalogStackParamList } from '@/navigation/AppNavigator';
import { useCompositionInsights } from '@/hooks/useCompositionInsights';
import { generateId } from '@/utils/generateId';
import { useWishlistStore } from '@/store/wishlistStore';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<CatalogStackParamList, 'ExploreCompositionResult'>;

// ─── Screen ───────────────────────────────────────────────────────────────────

/**
 * Explore Composition flow's result screen (tech design FE-4, extended by the
 * 2026-08-26 decision batch FE-9..FE-14). Shows the functional-tag list, a
 * Detected-actives list (**2026-08-27**: replaces the removed full raw-token
 * ingredient list — a real product photo often captures Directions/Cautions
 * text alongside the ingredients paragraph, and the naive tokenizer can't
 * separate them, so the full list read as mostly "not recognized" noise; see
 * spec Story 2's supersession note), a skin-type caution (Story 7), a
 * comparison matrix and routine placement when a category was captured
 * (Story 6/8), and a disclaimer — nothing else (spec Story 2 AC1/AC3,
 * Non-Goals §3). Never calls `conflictEngine.ts`, `buildIrritationProfile`,
 * `buildSensitivityCompatibility`, or the `buildProductProfileFrom*`
 * orchestrators — those cover sections this screen deliberately excludes.
 * `buildRoutinePosition` IS now called (deliberate 2026-08-26 reversal of the
 * first slice's non-goal, see spec §3) when `category` is set — never when
 * it is `null`.
 *
 * **2026-08-27, human-approved exception:** the Save-to-Wishlist modal's
 * Brand field reuses `BrandAutocompleteInput`, which transitively imports
 * `detectScript` from `brandCorrection.ts` (script detection only, not that
 * module's brand-matching logic). This is NOT the identity-matching this
 * screen otherwise avoids: the suggestion source is purely local (the
 * user's own Shelf brands + a static seed dictionary), never a
 * corpus/`ProductRepository` lookup, and it never attempts to identify this
 * composition — it only autocompletes text the user is already deliberately
 * typing by hand into a field the spec always required as manual entry
 * (Story 3).
 */
export default function ExploreCompositionResultScreen({ navigation, route }: Props) {
  const { rawIngredientsText, category } = route.params;
  const addEntry = useWishlistStore((s) => s.addEntry);

  const [wishlistModalVisible, setWishlistModalVisible] = useState(false);
  const [wishlistBrand, setWishlistBrand] = useState('');
  const [wishlistName, setWishlistName] = useState('');

  // Non-behavior-changing refactor (Story 9, FE-21): the inline useMemo
  // chain that used to live directly in this screen now lives in
  // `useCompositionInsights` — shared with `WishlistEntryDetailScreen` — and
  // its rendered output moved into `CompositionInsightsSection` below. Every
  // existing testID/text/assertion this screen already shipped is preserved.
  const insights = useCompositionInsights(rawIngredientsText, category);

  function openWishlistModal() {
    setWishlistBrand('');
    setWishlistName('');
    setWishlistModalVisible(true);
  }

  function handleWishlistConfirm() {
    addEntry({
      id: generateId(),
      brand: wishlistBrand.trim() || null,
      name: wishlistName.trim() || null,
      category,
      rawIngredientsText,
      parsedIngredientIds: insights.resolvedActiveKeys,
      sourceFlow: 'explore_composition',
      createdAt: new Date().toISOString(),
    });
    setWishlistModalVisible(false);
    navigation.navigate('Catalog');
  }

  function handlePutOnShelf() {
    navigation.navigate('ManualProductForm', {
      explorePrefill: {
        rawIngredientsText,
        activeKeys: insights.resolvedActiveKeys,
        brand: null,
        name: null,
        category,
      },
    });
  }

  return (
    <SafeAreaView style={styles.flex}>
      <AppHeader
        title="Composition"
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
        showsVerticalScrollIndicator={false}
      >
        <CompositionInsightsSection
          {...insights}
          onSetSkinType={() => navigation.navigate('Profile' as never)}
        />
      </ScrollView>

      <View style={styles.footer}>
        <Button size="lg" onPress={handlePutOnShelf} style={styles.footerBtn}>
          Put on Shelf
        </Button>
        <Button variant="secondary" size="lg" onPress={openWishlistModal} style={styles.footerBtn}>
          Add to Wishlist
        </Button>
      </View>

      <Modal
        visible={wishlistModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setWishlistModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add to Wishlist</Text>
            {/* Reuses the existing shelf-brand autocomplete (2026-08-27,
                real-device finding) — local-only (user's own Shelf brands +
                the static seed dictionary, never a corpus/ProductRepository
                lookup), so it doesn't reopen the identity-matching guardrail
                this flow otherwise avoids. */}
            <BrandAutocompleteInput
              value={wishlistBrand}
              onSelectSuggestion={setWishlistBrand}
              onCommitTyped={setWishlistBrand}
            />
            <Input
              label="Name"
              accessibilityLabel="Name"
              value={wishlistName}
              onChangeText={setWishlistName}
              placeholder="e.g. Daily Moisturiser"
            />
            <View style={styles.modalActions}>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                testID="wishlist-entry-save-confirm"
                onPress={handleWishlistConfirm}
              >
                Save
              </Button>
              <Button
                variant="ghost"
                size="lg"
                fullWidth
                onPress={() => setWishlistModalVisible(false)}
              >
                Cancel
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.bgScreen,
  },
  content: {
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[5],
    paddingBottom: space[8],
    gap: space[4],
  },
  footer: {
    flexDirection: 'row',
    gap: space[3],
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[3],
    paddingBottom: space[4],
    borderTopWidth: 1,
    borderTopColor: colors.borderDivider,
  },
  footerBtn: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(9, 9, 11, 0.6)',
    paddingHorizontal: space.gutterScreen,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.bgBase,
    borderRadius: 24,
    padding: space[6],
    gap: space[3],
  },
  modalTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  modalActions: {
    gap: space[2],
    marginTop: space[2],
  },
});
