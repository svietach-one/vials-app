import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
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

import { Input } from '@/components/ui/forms/Input';
import { SegmentedControl } from '@/components/ui/forms/SegmentedControl';
import { Button } from '@/components/ui/core/Button';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import { searchProducts } from '@/services/openBeautyFacts/search';
import type { OBFProduct } from '@/services/openBeautyFacts/types';
import { parseActiveIngredientsFromInci } from '@/utils/ingredientParser';
import { generateId } from '@/utils/generateId';
import type { ActiveIngredient, ActiveIngredientKey, Product, ProductType } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const PRODUCT_TYPE_OPTIONS: { value: ProductType; label: string }[] = [
  { value: 'cleanser', label: 'Cleanser' },
  { value: 'toner', label: 'Toner' },
  { value: 'essence', label: 'Essence' },
  { value: 'serum', label: 'Serum' },
  { value: 'gel', label: 'Gel' },
  { value: 'moisturizer', label: 'Moisturizer' },
  { value: 'oil', label: 'Oil' },
  { value: 'spf', label: 'SPF' },
];

export const ALL_ACTIVE_INGREDIENTS: ActiveIngredient[] = [
  { key: 'retinol', displayName: 'Retinol' },
  { key: 'aha', displayName: 'AHA' },
  { key: 'bha', displayName: 'BHA' },
  { key: 'vitamin_c', displayName: 'Vitamin C' },
  { key: 'niacinamide', displayName: 'Niacinamide' },
  { key: 'copper_peptides', displayName: 'Copper Peptides' },
  { key: 'benzoyl_peroxide', displayName: 'Benzoyl Peroxide' },
  { key: 'spf_chemical', displayName: 'SPF (Chemical)' },
];

const USAGE_OPTIONS = [
  { value: 'morning', label: 'Morning' },
  { value: 'evening', label: 'Evening' },
  { value: 'both', label: 'Both' },
];

export type RoutineTarget = 'none' | 'morning' | 'evening' | 'both';

const ROUTINE_TARGET_OPTIONS: { value: RoutineTarget; label: string }[] = [
  { value: 'none', label: 'Skip' },
  { value: 'morning', label: 'AM' },
  { value: 'evening', label: 'PM' },
  { value: 'both', label: 'AM & PM' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AddProductModalProps {
  visible: boolean;
  editingProduct?: Product | null;
  /**
   * Pre-fills the form from an OBF search result (e.g. when the user taps a
   * result on AddProductHubScreen). Triggers "add" mode — not "edit" mode.
   */
  prefillOBFProduct?: OBFProduct | null;
  onClose: () => void;
  onSave: (product: Product, routineTarget: RoutineTarget) => void;
}

type Mode = 'search' | 'form';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function keysToIngredients(keys: ActiveIngredientKey[]): ActiveIngredient[] {
  return keys.map((key) => {
    const match = ALL_ACTIVE_INGREDIENTS.find((a) => a.key === key);
    return match ?? { key, displayName: key };
  });
}

// ─── Sub-components (extracted to keep renderFormPhase under limit) ───────────

interface InciFieldProps {
  value: string;
  onChange: (t: string) => void;
  onDetect: () => void;
  onScan: () => void;
}
function InciField({ value, onChange, onDetect, onScan }: InciFieldProps) {
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
      <View style={formStyles.inciNotice}>
        <Text style={formStyles.inciNoticeText}>
          ⚠️ Ingredients must be in Latin/English characters. For Asian products, look for the English "Ingredients" block on the packaging.
        </Text>
      </View>
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

// ─── Component ────────────────────────────────────────────────────────────────

export function AddProductModal({
  visible,
  editingProduct,
  prefillOBFProduct,
  onClose,
  onSave,
}: AddProductModalProps) {
  const [mode, setMode] = useState<Mode>('search');

  // Search state (used in modal's own search phase when no Hub pre-fill)
  const [searchText, setSearchText] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchResults, setSearchResults] = useState<OBFProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [productType, setProductType] = useState<ProductType>('serum');
  const [selectedIngredients, setSelectedIngredients] = useState<ActiveIngredient[]>([]);
  const [fullIngredientText, setFullIngredientText] = useState('');
  const [usageTime, setUsageTime] = useState<'morning' | 'evening' | 'both'>('both');
  const [routineTarget, setRoutineTarget] = useState<RoutineTarget>('none');
  const [nameError, setNameError] = useState<string | null>(null);
  const [obfId, setObfId] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  // ── Reset / pre-fill when modal opens ──────────────────────────────────────
  useEffect(() => {
    if (!visible) return;

    if (editingProduct) {
      // Edit mode: restore from saved product
      setMode('form');
      setName(editingProduct.name);
      setBrand(editingProduct.brand ?? '');
      setProductType(editingProduct.productType);
      setFullIngredientText(editingProduct.fullIngredientText ?? '');
      setUsageTime(editingProduct.usageTime);
      setObfId(editingProduct.openBeautyFactsId);
      setRoutineTarget('none');
      setNameError(null);
      // Restore ingredient selection from activeTags (user-validated) with fallback
      // to activeIngredients for legacy products saved before activeTags was added.
      const tagKeys: ActiveIngredientKey[] =
        editingProduct.activeTags ?? editingProduct.activeIngredients.map((i) => i.key);
      setSelectedIngredients(keysToIngredients(tagKeys));
    } else if (prefillOBFProduct) {
      // OBF pre-fill from Hub: go straight to form mode, skip in-modal search
      setMode('form');
      setName(prefillOBFProduct.name);
      setBrand(prefillOBFProduct.brand);
      setFullIngredientText(prefillOBFProduct.ingredientsText);
      setObfId(prefillOBFProduct.obfId || null);
      setProductType('serum');
      setUsageTime('both');
      setRoutineTarget('none');
      setNameError(null);
      const parsedKeys = parseActiveIngredientsFromInci(prefillOBFProduct.ingredientsText);
      setSelectedIngredients(keysToIngredients(parsedKeys));
    } else {
      // New product — start at search
      setMode('search');
      setSearchText('');
      setDebouncedQuery('');
      setSearchResults([]);
      setSearchFailed(false);
      setName('');
      setBrand('');
      setProductType('serum');
      setSelectedIngredients([]);
      setFullIngredientText('');
      setUsageTime('both');
      setObfId(null);
      setRoutineTarget('none');
      setNameError(null);
    }
  }, [visible, editingProduct, prefillOBFProduct]);

  // ── Debounce search ────────────────────────────────────────────────────────
  useEffect(() => {
    if (searchText.trim().length < 3) {
      setSearchResults([]);
      setDebouncedQuery('');
      setSearchFailed(false);
      return;
    }
    const t = setTimeout(() => setDebouncedQuery(searchText.trim()), 600);
    return () => clearTimeout(t);
  }, [searchText]);

  // ── Fetch OBF results ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!debouncedQuery) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    searchProducts(debouncedQuery).then(({ products, failed }) => {
      if (!cancelled) {
        setSearchResults(products);
        setSearchFailed(failed);
        setSearching(false);
      }
    });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  function selectOBFProduct(item: OBFProduct) {
    setObfId(item.obfId || null);
    setName(item.name);
    setBrand(item.brand);
    setFullIngredientText(item.ingredientsText);
    const parsedKeys = parseActiveIngredientsFromInci(item.ingredientsText);
    setSelectedIngredients(keysToIngredients(parsedKeys));
    setMode('form');
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: false }), 50);
  }

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

  // Simulates an OCR scan: fills the textarea with a sample INCI text and
  // immediately runs ingredient detection so the checkboxes light up.
  // Replace this with a real image-picker + OCR flow when a library is added.
  function handleMockOcrScan() {
    const sample =
      'Water, Glycerin, Niacinamide, Centella Asiatica Extract, Sodium Hyaluronate, ' +
      'Panthenol, Betaine, Allantoin, Carbomer, Disodium EDTA';
    setFullIngredientText(sample);
    const parsedKeys = parseActiveIngredientsFromInci(sample);
    setSelectedIngredients(keysToIngredients(parsedKeys));
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
      // User-validated active ingredient keys — clean array for reliable filtering
      activeTags: selectedIngredients.map((i) => i.key),
      fullIngredientText: fullIngredientText.trim() || null,
      usageTime,
      openBeautyFactsId: obfId,
      addedAt: editingProduct?.addedAt ?? new Date().toISOString(),
      notes: null,
      openedDate: editingProduct?.openedDate ?? null,
      paoMonths: editingProduct?.paoMonths ?? null,
    };

    onSave(product, routineTarget);
  }

  // ── Sub-renders ────────────────────────────────────────────────────────────

  function renderSearchPhase() {
    return (
      <>
        <View style={searchStyles.inputWrap}>
          <Input
            icon={<Feather name="search" size={16} color={colors.textTertiary} />}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search by name or brand…"
            returnKeyType="search"
            autoFocus
            clearButtonMode="while-editing"
          />
        </View>

        <ScrollView style={searchStyles.results} keyboardShouldPersistTaps="handled">
          {searching ? (
            <ActivityIndicator
              size="small"
              color={colors.textSecondary}
              style={searchStyles.loader}
            />
          ) : searchText.trim().length < 3 ? (
            <Text style={searchStyles.hint}>Type at least 3 characters to search Open Beauty Facts</Text>
          ) : searchFailed ? (
            <Text style={searchStyles.hint}>Search unavailable — add your product manually below.</Text>
          ) : searchResults.length === 0 ? (
            <Text style={searchStyles.hint}>No results found for "{searchText.trim()}"</Text>
          ) : (
            searchResults.map((item) => (
              <Pressable
                key={item.obfId || item.name}
                style={({ pressed }) => [searchStyles.resultRow, pressed && searchStyles.resultRowPressed]}
                onPress={() => selectOBFProduct(item)}
              >
                <View style={searchStyles.resultContent}>
                  <Text style={searchStyles.resultName} numberOfLines={1}>{item.name}</Text>
                  {item.brand ? (
                    <Text style={searchStyles.resultBrand} numberOfLines={1}>{item.brand}</Text>
                  ) : null}
                </View>
                <Feather name="plus" size={18} color={colors.textSecondary} />
              </Pressable>
            ))
          )}

          <View style={searchStyles.manualWrap}>
            <Text style={searchStyles.manualLabel}>Product not found?</Text>
            <Pressable onPress={() => setMode('form')} hitSlop={8}>
              <Text style={searchStyles.manualLink}>Add manually →</Text>
            </Pressable>
          </View>
        </ScrollView>
      </>
    );
  }

  function renderFormPhase() {
    return (
      <>
        <ScrollView
          ref={scrollRef}
          style={formStyles.scroll}
          contentContainerStyle={formStyles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back to search — hidden when editing or when OBF pre-fill came from Hub */}
          {!editingProduct && !prefillOBFProduct && (
            <Pressable onPress={() => setMode('search')} style={formStyles.backRow} hitSlop={8}>
              <Feather name="arrow-left" size={14} color={colors.textLink} />
              <Text style={formStyles.backText}>Back to search</Text>
            </Pressable>
          )}

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
            onChange={setFullIngredientText}
            onDetect={detectFromInci}
            onScan={handleMockOcrScan}
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

          {!editingProduct ? (
            <RoutineTargetPicker
              value={routineTarget}
              onChange={setRoutineTarget}
            />
          ) : null}
        </ScrollView>

        <View style={formStyles.footer}>
          <Button fullWidth onPress={handleSave} disabled={!name.trim()}>
            {editingProduct ? 'Save Changes' : 'Add to Catalog'}
          </Button>
        </View>
      </>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <SafeAreaView style={styles.safe}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {editingProduct
                ? 'Edit Product'
                : mode === 'form'
                ? 'Add Product'
                : 'Find Product'}
            </Text>
            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Feather name="x" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          {mode === 'search' ? renderSearchPhase() : renderFormPhase()}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.gutterScreen,
    paddingVertical: space[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDivider,
  },
  headerTitle: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
  },
});

const searchStyles = StyleSheet.create({
  inputWrap: {
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[4],
    paddingBottom: space[2],
  },
  results: { flex: 1 },
  loader: { marginTop: space[8] },
  hint: {
    ...typography.body,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: space[8],
    paddingHorizontal: space[6],
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.gutterScreen,
    paddingVertical: space[3] + 2,
    gap: space[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDivider,
  },
  resultRowPressed: { backgroundColor: colors.surfaceSunken },
  resultContent: { flex: 1, gap: 2 },
  resultName: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  resultBrand: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  manualWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    paddingVertical: space[6],
  },
  manualLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  manualLink: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: colors.textLink,
  },
});

const formStyles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[4],
    paddingBottom: space[6],
    gap: space[5],
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    marginBottom: -space[2],
  },
  backText: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: colors.textLink,
  },
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
  footer: {
    paddingHorizontal: space.gutterScreen,
    paddingVertical: space[4],
    borderTopWidth: 1,
    borderTopColor: colors.borderDivider,
    backgroundColor: colors.bgBase,
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
