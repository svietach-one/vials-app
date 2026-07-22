import React, { useReducer, useState } from 'react';
import {
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  ToastAndroid,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { BarcodeSection } from '@/components/addProduct/BarcodeSection';
import { BrandNameCategorySection } from '@/components/addProduct/BrandNameCategorySection';
import { IngredientsSection } from '@/components/addProduct/IngredientsSection';
import { SaveBar } from '@/components/addProduct/SaveBar';
import { SectionAccordion } from '@/components/addProduct/SectionAccordion';
import { UsageDetailsSection } from '@/components/addProduct/UsageDetailsSection';
import { AppHeader } from '@/components/ui/core/AppHeader';
import { IconButton } from '@/components/ui/core/IconButton';
import { COMMUNITY_CONTRIBUTION_ENABLED } from '@/constants/featureFlags';
import { ACTIVE_INGREDIENT_LABELS, PRODUCT_TYPE_LABELS } from '@/constants/labels';
import { colors, palette, space, typography } from '@/constants/tokens';
import type { CatalogStackParamList } from '@/navigation/AppNavigator';
import { submitContribution } from '@/services/contributions';
import { useProductsStore } from '@/store/productsStore';
import { useSettingsStore } from '@/store/settingsStore';
import type { AddProductDraft } from '@/types';
import { canSave, formReducer, initialDraft } from '@/utils/productForm/formReducer';
import { buildProductFromDraft, buildSuggestPayload } from '@/utils/productForm/saveProduct';
import { generateId } from '@/utils/generateId';

type Props = NativeStackScreenProps<CatalogStackParamList, 'AddProduct'>;

// ─── Collapsed-row summaries ──────────────────────────────────────────────────

function Section1Summary({ draft }: { draft: AddProductDraft }) {
  const parts = [draft.brand, draft.name];
  if (draft.productType) parts.push(PRODUCT_TYPE_LABELS[draft.productType]);
  return (
    <Text style={styles.summary} numberOfLines={1}>
      {parts.filter(Boolean).join(' · ')}
    </Text>
  );
}

function Section2Summary({ draft }: { draft: AddProductDraft }) {
  return (
    <Text style={styles.summary} numberOfLines={1}>
      {draft.sectionStatus.barcode === 'skipped' ? 'Barcode skipped' : draft.barcode}
    </Text>
  );
}

function Section3Summary({ draft }: { draft: AddProductDraft }) {
  const keys = draft.activeIngredientKeys;
  if (keys.length === 0) {
    // Neutral, valid state — not an error/warning.
    return (
      <Text style={styles.summary} numberOfLines={1}>
        No actives added
      </Text>
    );
  }
  const shown = keys.slice(0, 3).map((key) => ACTIVE_INGREDIENT_LABELS[key]);
  const extra = keys.length - shown.length;
  return (
    <Text style={styles.summary} numberOfLines={1}>
      Actives: {shown.join(', ')}
      {extra > 0 ? ` +${extra}` : ''}
    </Text>
  );
}

function Section4Summary({ draft }: { draft: AddProductDraft }) {
  const opened = draft.isOpened && draft.openedDate ? `Opened ${draft.openedDate}` : 'Unopened';
  return (
    <Text style={styles.summary} numberOfLines={1}>
      {opened}
      {draft.paoMonths !== null ? ` · PAO ${draft.paoMonths}M` : ''}
    </Text>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

/**
 * The accordion Add Product screen — the manual / barcode-not-found entry
 * path. The only place the add-product form reducer is instantiated.
 */
export default function AddProductScreen({ navigation }: Props) {
  const [draft, dispatch] = useReducer(formReducer, undefined, initialDraft);
  const [validation, setValidation] = useState<{ section: 1 | 4; message: string } | null>(null);

  const addProduct = useProductsStore((s) => s.addProduct);
  const incrementCommunityContribution = useSettingsStore(
    (s) => s.incrementCommunityContribution,
  );

  function isDirty(): boolean {
    return (
      draft.brand.trim().length > 0 ||
      draft.name.trim().length > 0 ||
      draft.productType !== null ||
      draft.barcode !== null ||
      draft.inciRaw !== null ||
      draft.activeIngredientKeys.length > 0 ||
      draft.isOpened ||
      draft.paoMonths !== null
    );
  }

  function handleClose() {
    if (!isDirty()) {
      navigation.goBack();
      return;
    }
    Alert.alert('Discard this product?', 'Your entries so far will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  }

  function handleSave() {
    if (!canSave(draft)) {
      // Land the user on the first incomplete required section — no toast,
      // no dialog to dismiss.
      const target: { section: 1 | 4; message: string } =
        draft.sectionStatus.brand !== 'complete'
          ? { section: 1, message: 'Add a brand, name, and category to continue.' }
          : { section: 4, message: 'Pick a period-after-opening (PAO) to continue.' };
      if (draft.expandedSection !== target.section) {
        dispatch({ type: 'TOGGLE_SECTION', section: target.section });
      }
      setValidation(target);
      return;
    }
    setValidation(null);

    // 1. SYNCHRONOUS local write — this IS the save, as far as the UI cares.
    const product = buildProductFromDraft(draft, generateId(), new Date().toISOString());
    addProduct(product);
    // An INCI submission counts as a community contribution (like a barcode
    // scan, which BarcodeSection already counted at scan time).
    if (COMMUNITY_CONTRIBUTION_ENABLED && draft.inciRaw !== null) {
      incrementCommunityContribution();
    }

    // 2. Leave the screen and confirm immediately — nothing below is awaited.
    navigation.goBack();
    if (Platform.OS === 'android') {
      // No cross-platform toast infra exists yet; on iOS the product visibly
      // appearing on the shelf is the confirmation.
      ToastAndroid.show('Product added to your shelf', ToastAndroid.SHORT);
    }

    // 3. Share with the community database. The local save above is already
    //    committed and is never rolled back, so this only reports on itself.
    //    The wizard carries no photo (text-only contribution); a failure is
    //    surfaced rather than swallowed — this screen has already navigated
    //    away, so an Alert is the honest surface available.
    void shareDraft(draft);
  }

  async function shareDraft(draft: AddProductDraft) {
    if (!COMMUNITY_CONTRIBUTION_ENABLED) return;
    const result = await submitContribution(buildSuggestPayload(draft), null);
    if (result.status === 'error') {
      Alert.alert(
        'Couldn’t share this product',
        'It’s saved on your shelf. You can share it later from the product’s edit screen.',
      );
    }
    // 'unavailable' is silent here: nothing the user did failed, and this
    // screen is gone — the edit form states it explicitly when they go there.
  }

  const showSection1Error =
    validation?.section === 1 && draft.sectionStatus.brand !== 'complete';
  const showSection4Error = validation?.section === 4 && draft.paoMonths === null;

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader
        title="Add product"
        leftAction={
          <IconButton
            icon={<Feather name="x" size={20} color={colors.textPrimary} />}
            label="Close"
            variant="ghost"
            size="sm"
            onPress={handleClose}
          />
        }
      />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <SectionAccordion
          index={1}
          title="Brand, name, and category"
          status={draft.sectionStatus.brand}
          isExpanded={draft.expandedSection === 1}
          onToggle={() => dispatch({ type: 'TOGGLE_SECTION', section: 1 })}
          summary={<Section1Summary draft={draft} />}
        >
          {showSection1Error ? <Text style={styles.validation}>{validation.message}</Text> : null}
          <BrandNameCategorySection draft={draft} dispatch={dispatch} />
        </SectionAccordion>

        <SectionAccordion
          index={2}
          title="Barcode"
          status={draft.sectionStatus.barcode}
          isExpanded={draft.expandedSection === 2}
          onToggle={() => dispatch({ type: 'TOGGLE_SECTION', section: 2 })}
          summary={<Section2Summary draft={draft} />}
        >
          <BarcodeSection draft={draft} dispatch={dispatch} />
        </SectionAccordion>

        <SectionAccordion
          index={3}
          title="Ingredients"
          status={draft.sectionStatus.ingredients}
          isExpanded={draft.expandedSection === 3}
          onToggle={() => dispatch({ type: 'TOGGLE_SECTION', section: 3 })}
          summary={<Section3Summary draft={draft} />}
        >
          <IngredientsSection draft={draft} dispatch={dispatch} />
        </SectionAccordion>

        <SectionAccordion
          index={4}
          title="Usage details"
          status={draft.sectionStatus.usage}
          isExpanded={draft.expandedSection === 4}
          onToggle={() => dispatch({ type: 'TOGGLE_SECTION', section: 4 })}
          summary={<Section4Summary draft={draft} />}
        >
          {showSection4Error ? <Text style={styles.validation}>{validation.message}</Text> : null}
          <UsageDetailsSection draft={draft} dispatch={dispatch} />
        </SectionAccordion>
      </ScrollView>

      <SaveBar enabled={canSave(draft)} onPress={handleSave} />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgScreen,
  },
  scroll: {
    padding: space.gutterScreen,
    gap: space[3],
  },
  summary: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  validation: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: palette.cabernet,
    marginBottom: space[3],
  },
});
