import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { OcrScannerSheet } from '@/components/product/OcrScannerSheet';
import { Input } from '@/components/ui/forms/Input';
import { SegmentedControl } from '@/components/ui/forms/SegmentedControl';
import { Button } from '@/components/ui/core/Button';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import { parseActiveIngredientsFromInci } from '@/utils/ingredientParser';
import { generateId } from '@/utils/generateId';
import type {
  ActiveIngredient,
  ActiveIngredientKey,
  Product,
  ProductType,
  RoutineTarget,
} from '@/types';
import type { CatalogStackParamList } from '@/navigation/AppNavigator';
import { useProductsStore } from '@/store/productsStore';
import { useRoutineLinking } from '@/hooks/useRoutineLinking';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<CatalogStackParamList, 'ManualProductForm'>;

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_ACTIVE_INGREDIENTS: ActiveIngredient[] = [
  { key: 'retinol', displayName: 'Retinol' },
  { key: 'aha', displayName: 'AHA' },
  { key: 'bha', displayName: 'BHA' },
  { key: 'vitamin_c', displayName: 'Vitamin C' },
  { key: 'niacinamide', displayName: 'Niacinamide' },
  { key: 'copper_peptides', displayName: 'Copper Peptides' },
  { key: 'benzoyl_peroxide', displayName: 'Benzoyl Peroxide' },
  { key: 'spf_chemical', displayName: 'SPF (Chemical)' },
];

const PRODUCT_TYPE_OPTIONS: { value: ProductType; label: string }[] = [
  { value: 'cleanser', label: 'Cleanser' },
  { value: 'toner', label: 'Toner' },
  { value: 'essence', label: 'Essence' },
  { value: 'serum', label: 'Serum' },
  { value: 'gel', label: 'Gel' },
  { value: 'moisturizer', label: 'Moisturizer' },
  { value: 'oil', label: 'Oil' },
  { value: 'spf', label: 'SPF' },
  { value: 'makeup_remover', label: 'Makeup Remover' },
  { value: 'peeling', label: 'Peeling' },
  { value: 'ampoule', label: 'Ampoule' },
  { value: 'lotion', label: 'Lotion' },
  { value: 'cream', label: 'Cream' },
  { value: 'eye_cream', label: 'Eye Cream' },
  { value: 'mask', label: 'Mask' },
  { value: 'balm', label: 'Balm' },
  { value: 'spot_treatment', label: 'Spot Treatment' },
  { value: 'other', label: 'Other' },
];

const USAGE_OPTIONS = [
  { value: 'morning', label: 'Morning' },
  { value: 'evening', label: 'Evening' },
  { value: 'both', label: 'Both' },
];

const ROUTINE_TARGET_OPTIONS: { value: RoutineTarget; label: string }[] = [
  { value: 'none', label: 'Skip' },
  { value: 'morning', label: 'AM' },
  { value: 'evening', label: 'PM' },
  { value: 'both', label: 'AM & PM' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function keysToIngredients(keys: ActiveIngredientKey[]): ActiveIngredient[] {
  return keys.map((key) => {
    const match = ALL_ACTIVE_INGREDIENTS.find((a) => a.key === key);
    return match ?? { key, displayName: key };
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface InciFieldProps {
  value: string;
  onChange: (t: string) => void;
  onDetect: () => void;
  onScan: () => void;
  ocrScanned: boolean;
}
function InciField({ value, onChange, onDetect, onScan, ocrScanned }: InciFieldProps) {
  return (
    <View style={formStyles.fieldGroup}>
      <View style={formStyles.fieldLabelRow}>
        <Text style={formStyles.fieldLabel}>Full Ingredient List (INCI)</Text>
        {value.trim().length > 5 ? (
          <Pressable onPress={onDetect} hitSlop={8}>
            <Text style={formStyles.detectLink}>Detect actives →</Text>
          </Pressable>
        ) : null}
      </View>
      {ocrScanned ? (
        <View style={formStyles.inciNoticeOcr}>
          <Text style={formStyles.inciNoticeOcrTitle}>⚠️ Scanner Demo Mode</Text>
          <Text style={formStyles.inciNoticeOcrBody}>
            Please review the scanned text carefully for any punctuation or typo mistakes.
          </Text>
        </View>
      ) : (
        <View style={formStyles.inciNotice}>
          <Text style={formStyles.inciNoticeText}>
            ⚠️ Ingredients must be in Latin/English characters. For Asian products, look for the English "Ingredients" block on the packaging.
          </Text>
        </View>
      )}
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Paste INCI text here, then tap 'Detect actives' to auto-tag…"
        placeholderTextColor={colors.textTertiary}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        style={formStyles.textArea}
      />
      <Pressable
        style={({ pressed }) => [formStyles.ocrBtn, pressed && formStyles.ocrBtnPressed]}
        onPress={onScan}
        accessibilityRole="button"
        accessibilityLabel="Scan ingredients text with camera"
      >
        <Feather name="camera" size={18} color={colors.textPrimary} />
        <Text style={formStyles.ocrBtnLabel}>Scan Ingredients Text</Text>
      </Pressable>
    </View>
  );
}

interface IngredientChipsProps {
  selected: ActiveIngredient[];
  onToggle: (ing: ActiveIngredient) => void;
}
function IngredientChips({ selected, onToggle }: IngredientChipsProps) {
  return (
    <View style={formStyles.fieldGroup}>
      <Text style={formStyles.fieldLabel}>Confirmed Active Ingredients</Text>
      <Text style={formStyles.fieldHint}>
        Check the actives that are prominently present in this product.
      </Text>
      <View style={formStyles.ingredientWrap}>
        {ALL_ACTIVE_INGREDIENTS.map((ing) => {
          const active = selected.some((s) => s.key === ing.key);
          return (
            <Pressable
              key={ing.key}
              onPress={() => onToggle(ing)}
              style={[chipStyles.chip, active && chipStyles.chipActive]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
            >
              <Text style={[chipStyles.label, active && chipStyles.labelActive]}>
                {ing.displayName}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

interface RoutineTargetPickerProps {
  value: RoutineTarget;
  onChange: (v: RoutineTarget) => void;
}
function RoutineTargetPicker({ value, onChange }: RoutineTargetPickerProps) {
  return (
    <View style={formStyles.fieldGroup}>
      <Text style={formStyles.fieldLabel}>Add to Routine</Text>
      <View style={formStyles.routineRow}>
        {ROUTINE_TARGET_OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              style={[chipStyles.chip, chipStyles.chipFlex, active && chipStyles.chipActive]}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <Text style={[chipStyles.label, active && chipStyles.labelActive]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ManualProductFormScreen({ route, navigation }: Props) {
  const { prefillOBFProduct, editingProductId } = route.params;

  const products = useProductsStore((s) => s.products);
  const addProduct = useProductsStore((s) => s.addProduct);
  const updateProduct = useProductsStore((s) => s.updateProduct);
  const { addProductToRoutine } = useRoutineLinking();

  const editingProduct = editingProductId
    ? (products.find((p) => p.id === editingProductId) ?? null)
    : null;

  const isEditMode = !!editingProduct;

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [productType, setProductType] = useState<ProductType>('serum');
  const [selectedIngredients, setSelectedIngredients] = useState<ActiveIngredient[]>([]);
  const [fullIngredientText, setFullIngredientText] = useState('');
  const [usageTime, setUsageTime] = useState<'morning' | 'evening' | 'both'>('both');
  const [routineTarget, setRoutineTarget] = useState<RoutineTarget>('none');
  const [nameError, setNameError] = useState<string | null>(null);
  const [obfId, setObfId] = useState<string | null>(null);
  const [showOcrScanner, setShowOcrScanner] = useState(false);
  const [ocrScanned, setOcrScanned] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    navigation.setOptions({ title: isEditMode ? 'Edit Product' : 'Add Product' });
  }, [navigation, isEditMode]);

  // Pre-fill once on mount from navigation params
  useEffect(() => {
    if (editingProduct) {
      setName(editingProduct.name);
      setBrand(editingProduct.brand ?? '');
      setProductType(editingProduct.productType);
      setFullIngredientText(editingProduct.fullIngredientText ?? '');
      setUsageTime(editingProduct.usageTime);
      setObfId(editingProduct.openBeautyFactsId);
      const tagKeys: ActiveIngredientKey[] =
        editingProduct.activeTags ?? editingProduct.activeIngredients.map((i) => i.key);
      setSelectedIngredients(keysToIngredients(tagKeys));
    } else if (prefillOBFProduct) {
      setName(prefillOBFProduct.name);
      setBrand(prefillOBFProduct.brand);
      setFullIngredientText(prefillOBFProduct.ingredientsText);
      setObfId(prefillOBFProduct.obfId);
      setProductType('serum');
      setUsageTime('both');
      const parsedKeys = parseActiveIngredientsFromInci(prefillOBFProduct.ingredientsText);
      setSelectedIngredients(keysToIngredients(parsedKeys));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function toggleIngredient(ing: ActiveIngredient) {
    setSelectedIngredients((prev) =>
      prev.some((s) => s.key === ing.key)
        ? prev.filter((s) => s.key !== ing.key)
        : [...prev, ing],
    );
  }

  function detectFromInci() {
    const trimmed = fullIngredientText.trim();
    if (!trimmed) return;
    const parsedKeys = parseActiveIngredientsFromInci(trimmed);
    setSelectedIngredients(keysToIngredients(parsedKeys));
  }

  function handleOcrResult(text: string) {
    setFullIngredientText(text);
    const parsedKeys = parseActiveIngredientsFromInci(text);
    setSelectedIngredients(keysToIngredients(parsedKeys));
    setOcrScanned(true);
    setShowOcrScanner(false);
  }

  function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('Product name is required');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    setNameError(null);

    const product: Product = {
      id: editingProduct?.id ?? generateId(),
      name: trimmedName,
      brand: brand.trim() || null,
      productType,
      imageUrl: null,
      activeIngredients: selectedIngredients,
      activeTags: selectedIngredients.map((i) => i.key),
      fullIngredientText: fullIngredientText.trim() || null,
      usageTime,
      openBeautyFactsId: obfId,
      addedAt: editingProduct?.addedAt ?? new Date().toISOString(),
      notes: null,
      openedDate: editingProduct?.openedDate ?? null,
      paoMonths: editingProduct?.paoMonths ?? null,
    };

    if (isEditMode) {
      updateProduct(product.id, product);
      navigation.goBack();
    } else {
      addProduct(product);
      addProductToRoutine(product, routineTarget);
      navigation.navigate('Catalog');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={styles.safe}>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Input
            label="Product Name *"
            value={name}
            onChangeText={(t) => { setName(t); if (nameError) setNameError(null); }}
            placeholder="e.g. Daily Moisturiser SPF 50"
            error={nameError}
            returnKeyType="next"
          />

          <Input
            label="Brand"
            value={brand}
            onChangeText={setBrand}
            placeholder="e.g. La Roche-Posay"
            returnKeyType="next"
          />

          <View style={formStyles.fieldGroup}>
            <Text style={formStyles.fieldLabel}>Product Type</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={formStyles.typeRow}
            >
              {PRODUCT_TYPE_OPTIONS.map(({ value, label }) => {
                const active = productType === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setProductType(value)}
                    style={[chipStyles.chip, active && chipStyles.chipActive]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[chipStyles.label, active && chipStyles.labelActive]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <InciField
            value={fullIngredientText}
            onChange={(t) => {
              setFullIngredientText(t);
              if (t === '') setOcrScanned(false);
            }}
            onDetect={detectFromInci}
            onScan={() => setShowOcrScanner(true)}
            ocrScanned={ocrScanned}
          />

          <IngredientChips
            selected={selectedIngredients}
            onToggle={toggleIngredient}
          />

          <View style={formStyles.fieldGroup}>
            <Text style={formStyles.fieldLabel}>Usage Time</Text>
            <SegmentedControl
              options={USAGE_OPTIONS}
              value={usageTime}
              onValueChange={(v) => setUsageTime(v as 'morning' | 'evening' | 'both')}
              fullWidth
            />
          </View>

          {!isEditMode ? (
            <RoutineTargetPicker value={routineTarget} onChange={setRoutineTarget} />
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button fullWidth onPress={handleSave} disabled={!name.trim()}>
            {isEditMode ? 'Save Changes' : 'Add to Catalog'}
          </Button>
        </View>
      </SafeAreaView>

      <OcrScannerSheet
        visible={showOcrScanner}
        onClose={() => setShowOcrScanner(false)}
        onResult={handleOcrResult}
      />
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[4],
    paddingBottom: space[6],
    gap: space[5],
  },
  footer: {
    paddingHorizontal: space.gutterScreen,
    paddingVertical: space[4],
    borderTopWidth: 1,
    borderTopColor: colors.borderDivider,
    backgroundColor: colors.bgBase,
  },
});

const formStyles = StyleSheet.create({
  fieldGroup: { gap: space[2] },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: 11,
    letterSpacing: 1.32,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  fieldHint: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: -space[1],
  },
  detectLink: {
    ...typography.caption,
    fontFamily: 'DMSans-Medium',
    color: colors.textLink,
  },
  inciNotice: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.sm,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderLeftWidth: 3,
    borderLeftColor: colors.statusWarning,
  },
  inciNoticeText: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  inciNoticeOcr: {
    backgroundColor: colors.statusWarningTint,
    borderRadius: radius.sm,
    paddingHorizontal: space[3],
    paddingVertical: space[2] + 2,
    borderLeftWidth: 3,
    borderLeftColor: colors.statusWarning,
    gap: space[1],
  },
  inciNoticeOcrTitle: {
    ...typography.caption,
    fontFamily: 'DMSans-Medium',
    color: colors.statusWarning,
    lineHeight: 18,
  },
  inciNoticeOcrBody: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  ocrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    paddingHorizontal: space[4],
    paddingVertical: space[3] + 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
  },
  ocrBtnPressed: {
    backgroundColor: colors.surfaceSunken,
  },
  ocrBtnLabel: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  typeRow: {
    flexDirection: 'row',
    gap: space[2],
    paddingVertical: 2,
  },
  ingredientWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  textArea: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    color: colors.textPrimary,
    borderWidth: 1.5,
    borderColor: colors.borderInput,
    borderRadius: radius.md,
    padding: space[3],
    minHeight: 96,
    backgroundColor: colors.surfaceRaised,
    includeFontPadding: false,
  },
  routineRow: {
    flexDirection: 'row',
    gap: space[2],
  },
});

const chipStyles = StyleSheet.create({
  chip: {
    paddingHorizontal: space[3],
    paddingVertical: space[2] - 1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
  },
  chipFlex: {
    flex: 1,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: palette.black,
    borderColor: palette.black,
  },
  label: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: colors.textSecondary,
  },
  labelActive: { color: palette.white },
});
