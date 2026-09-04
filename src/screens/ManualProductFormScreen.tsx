import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
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

import { ContributionConsentModal, type ContributionConsentModalVariant } from '@/components/product/ContributionConsentModal';
import { ContributionToggle } from '@/components/product/ContributionToggle';
import { OcrScannerSheet } from '@/components/product/OcrScannerSheet';
import { RoutineSchedulerSheet } from '@/components/routine/RoutineSchedulerSheet';
import { AppHeader } from '@/components/ui/core/AppHeader';
import { Button } from '@/components/ui/core/Button';
import { Card } from '@/components/ui/core/Card';
import { FilterChip } from '@/components/ui/core/FilterChip';
import { IconButton } from '@/components/ui/core/IconButton';
import { InlineAlert } from '@/components/ui/feedback/InlineAlert';
import { BrandAutocompleteInput } from '@/components/addProduct/BrandAutocompleteInput';
import { Input } from '@/components/ui/forms/Input';
import { Switch } from '@/components/ui/forms/Switch';
import { ProductThumbnail } from '@/components/ui/ProductThumbnail';
import { COMMUNITY_CONTRIBUTION_ENABLED } from '@/constants/featureFlags';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import { useProductRepository } from '@/hooks/useCorpusRepositories';
import { submitContribution, type ContributionResult } from '@/services/contributions';
import {
  deleteProductPhoto,
  pickAndStoreProductPhoto,
  renderContributionBlob,
  storeExistingPhotoAsProductPhoto,
  type PhotoSource,
} from '@/services/productImage';
import { normalizeActiveKey, parseActiveIngredientsFromInci } from '@/utils/ingredientParser';
import { generateId } from '@/utils/generateId';
import { searchBrandsWithCorpus } from '@/utils/productForm/brandLookup';
import { resolveProductType } from '@/utils/productType';
import type {
  ActiveIngredient,
  ActiveIngredientKey,
  Product,
  ProductSource,
  ProductType,
} from '@/types';
import type { CatalogStackParamList } from '@/navigation/AppNavigator';
import { useProductsStore } from '@/store/productsStore';
import { useProfileStore } from '@/store/profileStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { canShareContributionPhoto } from '@/utils/contributionConsent';
import { contributedProductsCount, decideManualSave } from '@/utils/contributionConsentFlow';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<CatalogStackParamList, 'ManualProductForm'>;

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_ACTIVE_INGREDIENTS: ActiveIngredient[] = [
  { key: 'retinoid', displayName: 'Retinoids' },
  { key: 'aha', displayName: 'AHA' },
  { key: 'bha', displayName: 'BHA' },
  { key: 'vitamin_c_pure', displayName: 'Vitamin C (Pure)' },
  { key: 'vitamin_c_derivative', displayName: 'Vitamin C (Derivative)' },
  { key: 'niacinamide', displayName: 'Niacinamide' },
  { key: 'copper_peptides', displayName: 'Copper Peptides' },
  { key: 'benzoyl_peroxide', displayName: 'Benzoyl Peroxide' },
  { key: 'spf_filters', displayName: 'UV Filters (SPF)' },
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

const PAO_PRESETS = [
  { months: 3, label: '3M' },
  { months: 6, label: '6M' },
  { months: 12, label: '12M' },
  { months: 24, label: '24M' },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function keysToIngredients(keys: ActiveIngredientKey[]): ActiveIngredient[] {
  return keys.map((rawKey) => {
    // Legacy persisted tags ('retinol', 'vitamin_c', …) resolve to their canonical chip
    const key = normalizeActiveKey(rawKey);
    const match = ALL_ACTIVE_INGREDIENTS.find((a) => a.key === key);
    return match ?? { key, displayName: key };
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionEyebrow({ num, label }: { num: string; label: string }) {
  return (
    <View style={s.eyebrow}>
      <View style={s.eyebrowBadge}>
        <Text style={s.eyebrowNum}>{num}</Text>
      </View>
      <Text style={s.eyebrowLabel}>{label}</Text>
    </View>
  );
}

interface InciFieldProps {
  value: string;
  onChange: (t: string) => void;
  onDetect: () => void;
  onScan: () => void;
  ocrScanned: boolean;
}

function InciField({ value, onChange, onDetect, onScan, ocrScanned }: InciFieldProps) {
  return (
    <View style={s.inciStack}>
      <InlineAlert
        tone={ocrScanned ? 'warning' : 'info'}
        icon={
          <Icon
            name={ocrScanned ? 'alert-triangle' : 'info'}
            size={16}
            color={ocrScanned ? colors.statusWarningAccent : colors.statusInfo}
          />
        }
      >
        {ocrScanned ? (
          <View style={{ gap: space[1] }}>
            <Text style={s.alertTitleWarning}>Scanner Demo Mode</Text>
            <Text style={s.alertBodyWarning}>
              Please review the scanned text carefully for any punctuation or typo mistakes.
            </Text>
          </View>
        ) : (
          <Text style={s.alertBodyInfo}>
            Ingredients must be in Latin/English characters. For Asian products, look for the
            English "Ingredients" block on the packaging.
          </Text>
        )}
      </InlineAlert>

      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Paste INCI text here, then tap 'Detect actives' to auto-tag…"
        placeholderTextColor={colors.textTertiary}
        multiline
        numberOfLines={5}
        textAlignVertical="top"
        style={s.textArea}
        accessibilityLabel="Full ingredient list INCI"
      />

      {value.trim().length > 5 ? (
        <Button
          variant="textActive"
          size="sm"
          iconRight={<Icon name="arrow-right" size={14} color={palette.plum} />}
          onPress={onDetect}
          accessibilityLabel="Detect active ingredients from INCI text"
          style={s.detectRow}
        >
          Detect actives
        </Button>
      ) : null}

      <Button
        variant="secondary"
        size="md"
        fullWidth
        icon={<Icon name="camera" size={16} color={colors.textPrimary} />}
        onPress={onScan}
      >
        Scan Ingredients Text
      </Button>
    </View>
  );
}

interface IngredientChipsProps {
  selected: ActiveIngredient[];
  onToggle: (ing: ActiveIngredient) => void;
}

function IngredientChips({ selected, onToggle }: IngredientChipsProps) {
  return (
    <View style={s.subSection}>
      <Text style={s.featureTitle}>Confirmed Active Ingredients</Text>
      <Text style={s.sectionHint}>
        Check the actives prominently present in this product.
      </Text>
      <View style={s.chipsWrap}>
        {ALL_ACTIVE_INGREDIENTS.map((ing) => {
          const active = selected.some((item) => item.key === ing.key);
          return (
            <FilterChip
              key={ing.key}
              selected={active}
              onPress={() => onToggle(ing)}
              accessibilityLabel={ing.displayName}
            >
              {ing.displayName}
            </FilterChip>
          );
        })}
      </View>
    </View>
  );
}

interface PaoFieldProps {
  selected: number | null;
  isCustom: boolean;
  customText: string;
  error: string | null;
  onSelectPreset: (months: number) => void;
  onSelectCustom: () => void;
  onCustomTextChange: (t: string) => void;
}

function PaoField({
  selected,
  isCustom,
  customText,
  error,
  onSelectPreset,
  onSelectCustom,
  onCustomTextChange,
}: PaoFieldProps) {
  return (
    <View style={s.subSection}>
      <Text style={s.featureTitle}>Period After Opening</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chipsRow}
      >
        {PAO_PRESETS.map(({ months, label }) => {
          const active = !isCustom && selected === months;
          return (
            <FilterChip
              key={months}
              selected={active}
              onPress={() => onSelectPreset(months)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
            >
              {label}
            </FilterChip>
          );
        })}
        <FilterChip
          selected={isCustom}
          onPress={onSelectCustom}
          accessibilityRole="radio"
          accessibilityState={{ checked: isCustom }}
        >
          Custom
        </FilterChip>
      </ScrollView>
      {isCustom ? (
        <View style={s.customPaoRow}>
          <TextInput
            value={customText}
            onChangeText={onCustomTextChange}
            placeholder="e.g. 18"
            placeholderTextColor={colors.textTertiary}
            keyboardType="number-pad"
            maxLength={3}
            style={[s.customPaoInput, error ? s.inputError : null]}
            accessibilityLabel="Custom PAO months"
          />
          <Text style={s.customPaoUnit}>months</Text>
        </View>
      ) : null}
      {error ? <Text style={s.fieldError}>{error}</Text> : null}
    </View>
  );
}

interface OpenedDateFieldProps {
  isOpened: boolean;
  dateValue: string;
  onToggle: (v: boolean) => void;
  onDateChange: (t: string) => void;
}

function OpenedDateField({ isOpened, dateValue, onToggle, onDateChange }: OpenedDateFieldProps) {
  return (
    <View style={s.subSection}>
      <Text style={s.featureTitle}>Already Opened?</Text>
      <Text style={s.featureDesc}>
        Turn on if this product has already been opened.
      </Text>
      <Switch checked={isOpened} onValueChange={onToggle} size="md" />
      {isOpened ? (
        <View style={s.dateBlock}>
          <TextInput
            value={dateValue}
            onChangeText={onDateChange}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textTertiary}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
            style={s.dateInput}
            accessibilityLabel="Date product was opened"
          />
          <Text style={s.dateHint}>Date you first opened this product</Text>
        </View>
      ) : null}
    </View>
  );
}

interface PhysicalExfoliantFieldProps {
  checked: boolean;
  onToggle: (v: boolean) => void;
}

/**
 * "Physical exfoliant" toggle (tech-design vials-conflict-matrix-expansion.md
 * §3 FE-6) — off by default, wired to Product.isPhysicalExfoliant. Mirrors
 * OpenedDateField's Switch pattern above: the flag cannot be read off the
 * ingredient list, so it is a plain user-asserted signal, not derived state.
 */
function PhysicalExfoliantField({ checked, onToggle }: PhysicalExfoliantFieldProps) {
  return (
    <View style={s.subSection}>
      <Text style={s.featureTitle}>Physical exfoliant</Text>
      <Text style={s.featureDesc}>
        Turn on if this product contains abrasive scrub particles or is an exfoliating tool —
        this can&apos;t be detected from the ingredient list.
      </Text>
      <Switch
        checked={checked}
        onValueChange={onToggle}
        size="md"
        accessibilityLabel="Physical exfoliant"
      />
    </View>
  );
}

/**
 * Honest reporting of the community-share outcome (US-3). Four distinct
 * states — sharing / shared / unavailable / failed — because the whole point
 * of this surface is that it must never imply a submission happened when it
 * did not. "Unavailable" is deliberately not an error: retrying cannot help in
 * a build without the libSQL module, so no retry is offered there.
 */
function ShareStatus({
  sharing,
  result,
  onRetry,
}: {
  sharing: boolean;
  result: ContributionResult | null;
  onRetry: () => void;
}) {
  if (sharing) {
    return (
      <View style={s.shareRow} testID="share-status-pending">
        <ActivityIndicator size="small" color={colors.textSecondary} />
        <Text style={s.shareText}>Sharing with the Vials database…</Text>
      </View>
    );
  }

  if (!result) return null;

  if (result.status === 'success') {
    return (
      <View style={s.shareRow} testID="share-status-success">
        <Icon name="check-circle" size={16} color={palette.bottleGreen} />
        <Text style={s.shareText}>
          {result.withPhoto
            ? 'Shared for review, with your photo.'
            : 'Shared for review — text only, no photo attached.'}
        </Text>
      </View>
    );
  }

  if (result.status === 'unavailable') {
    return (
      <View style={s.shareRow} testID="share-status-unavailable">
        <Icon name="info" size={16} color={colors.statusInfo} />
        <Text style={s.shareText}>
          Sharing isn&apos;t available in this build. Your product is saved on this device.
        </Text>
      </View>
    );
  }

  return (
    <View style={s.shareRow} testID="share-status-error">
      <Icon name="alert-triangle" size={16} color={colors.statusWarningAccent} />
      <View style={s.shareErrorBody}>
        <Text style={s.shareText}>
          Couldn&apos;t share this product. It&apos;s still saved on your shelf.
        </Text>
        <Button variant="textActive" size="sm" onPress={onRetry}>
          Try again
        </Button>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ManualProductFormScreen({ route, navigation }: Props) {
  const {
    prefillCorpusProduct,
    editingProductId,
    initialStatus,
    ocrPrefill,
    capturedPhotoUri,
    explorePrefill,
  } = route.params;

  const products = useProductsStore((st) => st.products);
  const addProduct = useProductsStore((st) => st.addProduct);
  const updateProduct = useProductsStore((st) => st.updateProduct);
  const profile = useProfileStore((s) => s.profile);
  const productRepository = useProductRepository();
  // Explore Composition flow (docs/specs/explore-composition.md Story 5) —
  // only used to remove a promoted WishlistEntry, and only after a
  // successful save (see handleSave's explorePrefill branch below).
  const removeWishlistEntry = useWishlistStore((s) => s.removeEntry);

  // Product-contribution consent (docs/specs/contribution-consent-flow/) —
  // only applies to genuinely manual, new saves (no corpus/OBF prefill, not
  // an edit). Distinct from `contributionConsent` above, which gates the
  // photo blob only.
  const contributionConsentStatus = useSettingsStore((s) => s.contributionConsentStatus);
  const declinedSaveCountSinceLastReminder = useSettingsStore(
    (s) => s.declinedSaveCountSinceLastReminder,
  );
  const reminderCountShown = useSettingsStore((s) => s.reminderCountShown);
  const setContributionConsentStatus = useSettingsStore((s) => s.setContributionConsentStatus);
  const incrementDeclinedSaveCount = useSettingsStore((s) => s.incrementDeclinedSaveCount);
  const resetDeclinedSaveCount = useSettingsStore((s) => s.resetDeclinedSaveCount);
  const incrementReminderCountShown = useSettingsStore((s) => s.incrementReminderCountShown);

  const editingProduct = editingProductId
    ? (products.find((p) => p.id === editingProductId) ?? null)
    : null;

  const isEditMode = !!editingProduct;

  // Stable id established once, so a photo can be captured (and its files named)
  // before the product is saved. Reused as the product id on save.
  const productId = useRef(editingProduct?.id ?? generateId()).current;

  const [name, setName] = useState('');
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [brand, setBrand] = useState('');
  const [productType, setProductType] = useState<ProductType | null>(null);
  // Labelled SPF, captured only for sunscreens (US-29). Empty = unknown.
  const [spfText, setSpfText] = useState('');
  const [selectedIngredients, setSelectedIngredients] = useState<ActiveIngredient[]>([]);
  const [fullIngredientText, setFullIngredientText] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [obfId, setObfId] = useState<string | null>(null);
  // Provenance of a corpus/search-result prefill (obf_import, vials_seed, or
  // community) — distinct from `obfId`, which only fires for OBF rows.
  // Gates the manual-entry contribution-consent flow below: any corpus
  // prefill is a database pick, not a genuinely manual entry, regardless of
  // which of the three corpus sources it came from.
  const [prefillSource, setPrefillSource] = useState<ProductSource | null>(null);
  const [showOcrScanner, setShowOcrScanner] = useState(false);
  const [ocrScanned, setOcrScanned] = useState(false);
  const [schedulerProduct, setSchedulerProduct] = useState<Product | null>(null);
  const [paoMonths, setPaoMonths] = useState<number | null>(null);
  const [isCustomPao, setIsCustomPao] = useState(false);
  const [customPaoText, setCustomPaoText] = useState('');
  const [paoError, setPaoError] = useState<string | null>(null);
  const [isOpened, setIsOpened] = useState(false);
  const [openedDate, setOpenedDate] = useState(todayIso());
  const [isPhysicalExfoliant, setIsPhysicalExfoliant] = useState(false);
  const [showObfAttribution, setShowObfAttribution] = useState(false);
  const [corpusProductUrl, setCorpusProductUrl] = useState<string | null>(null);
  // Community-contribution state. Separate from the local save, which never
  // waits on it and never fails because of it.
  const [sharing, setSharing] = useState(false);
  const [shareResult, setShareResult] = useState<ContributionResult | null>(null);

  // Inline toggle default: on while `accepted`, off while `declined` — n/a
  // while `unset` (modal shown instead) or `disabled` (toggle hidden).
  const [shareToggleOn, setShareToggleOn] = useState(contributionConsentStatus === 'accepted');
  // Resyncs if the global status changes via the Profile screen while this
  // form stays mounted in a backgrounded tab (React Navigation keeps stack
  // screens alive) — otherwise the toggle can display a stale default.
  useEffect(() => {
    setShareToggleOn(contributionConsentStatus === 'accepted');
  }, [contributionConsentStatus]);
  const [consentModalVariant, setConsentModalVariant] =
    useState<ContributionConsentModalVariant | null>(null);
  // The just-saved product waiting on a modal decision (first-time) or just
  // waiting for the modal to close before continuing to the scheduler sheet
  // (reminder — that save already resolved, see handleConsentContinue).
  const [pendingConsentProduct, setPendingConsentProduct] = useState<Product | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (editingProduct) {
      setName(editingProduct.name);
      setBrand(editingProduct.brand ?? '');
      setProductType(editingProduct.productType);
      setSpfText(
        editingProduct.spfValue !== null && editingProduct.spfValue !== undefined
          ? String(editingProduct.spfValue)
          : '',
      );
      setFullIngredientText(editingProduct.fullIngredientText ?? '');
      setObfId(editingProduct.openBeautyFactsId);
      setImageUrl(editingProduct.imageUrl);
      setLocalImageUri(editingProduct.localImageUri ?? null);
      const tagKeys: ActiveIngredientKey[] =
        editingProduct.activeTags ?? editingProduct.activeIngredients.map((i) => i.key);
      setSelectedIngredients(keysToIngredients(tagKeys));

      const pm = editingProduct.paoMonths;
      if (pm !== null && pm !== undefined) {
        const isPreset = PAO_PRESETS.some((p) => p.months === pm);
        setPaoMonths(pm);
        setIsCustomPao(!isPreset);
        if (!isPreset) setCustomPaoText(String(pm));
      }
      if (editingProduct.openedDate) {
        setIsOpened(true);
        setOpenedDate(editingProduct.openedDate);
      }
      setIsPhysicalExfoliant(editingProduct.isPhysicalExfoliant === true);
    } else if (prefillCorpusProduct) {
      const p = prefillCorpusProduct;
      setName(p.name);
      setBrand(p.brand ?? '');
      setFullIngredientText(p.inciRaw ?? '');
      setObfId(p.source === 'obf_import' ? p.uid : null);
      setShowObfAttribution(p.source === 'obf_import');
      setPrefillSource(p.source);
      setCorpusProductUrl(p.url);
      setProductType(resolveProductType(p.type));

      // Prefer the corpus's curated tags over a local re-parse of the INCI text.
      if (productRepository) {
        productRepository.getActiveKeys(p.uid).then((tags) => {
          setSelectedIngredients(keysToIngredients(tags));
        });
      } else if (p.inciRaw) {
        setSelectedIngredients(keysToIngredients(parseActiveIngredientsFromInci(p.inciRaw)));
      }
    } else if (ocrPrefill) {
      // CaptureFlowScreen's no-match path — carries forward whatever it
      // recognized rather than sending the user back to a blank form
      // (docs/tasks/ux-explore-vials/07-capture-flow.md §4a).
      if (ocrPrefill.brand) setBrand(ocrPrefill.brand);
      if (ocrPrefill.name) setName(ocrPrefill.name);
      if (ocrPrefill.fullIngredientText) {
        setFullIngredientText(ocrPrefill.fullIngredientText);
        setSelectedIngredients(
          keysToIngredients(parseActiveIngredientsFromInci(ocrPrefill.fullIngredientText)),
        );
        setOcrScanned(true);
      }
    } else if (explorePrefill) {
      // Explore Composition flow (docs/specs/explore-composition.md Story
      // 4/5, tech design FE-6) — brand/name are pre-filled when the entry
      // already has them (e.g. promoted via "Move to Shelf", spec Story 5
      // AC1), otherwise left empty for the user to fill in; the
      // already-resolved activeKeys are used as-is (never a re-parse of the
      // text), and the ingredients photo captured in that flow is
      // deliberately never written to localImageUri (tech design
      // Assumption 6) — only a front/jar photo satisfies that slot.
      if (explorePrefill.brand) setBrand(explorePrefill.brand);
      if (explorePrefill.name) setName(explorePrefill.name);
      setFullIngredientText(explorePrefill.rawIngredientsText);
      setSelectedIngredients(keysToIngredients(explorePrefill.activeKeys));
      if (explorePrefill.category) setProductType(explorePrefill.category);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // CaptureFlowScreen's Shot 1 photo — kept as the cover photo regardless of
  // whether it led to a corpus match, a no-match ocrPrefill, or nothing
  // (docs/tasks/ux-explore-vials/07-capture-flow.md). Never touches an
  // existing edit's photo.
  useEffect(() => {
    if (isEditMode || !capturedPhotoUri) return;
    void storeExistingPhotoAsProductPhoto(productId, capturedPhotoUri).then((result) => {
      if (result) setLocalImageUri(result.localImageUri);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handlePaoPreset(months: number) {
    setPaoMonths(months);
    setIsCustomPao(false);
    setCustomPaoText('');
    setPaoError(null);
  }

  function handlePaoCustomSelect() {
    setPaoMonths(null);
    setIsCustomPao(true);
    setPaoError(null);
  }

  function handlePaoCustomText(t: string) {
    setCustomPaoText(t);
    if (paoError) setPaoError(null);
  }

  function toggleIngredient(ing: ActiveIngredient) {
    setSelectedIngredients((prev) =>
      prev.some((item) => item.key === ing.key)
        ? prev.filter((item) => item.key !== ing.key)
        : [...prev, ing],
    );
  }

  function detectFromInci() {
    const trimmed = fullIngredientText.trim();
    if (!trimmed) return;
    const parsedKeys = parseActiveIngredientsFromInci(trimmed);
    setSelectedIngredients(keysToIngredients(parsedKeys));
  }

  function handleOcrResult(text: string, sourceUri?: string) {
    setFullIngredientText(text);
    const parsedKeys = parseActiveIngredientsFromInci(text);
    setSelectedIngredients(keysToIngredients(parsedKeys));
    setOcrScanned(true);
    setShowOcrScanner(false);

    // Reuse the just-captured label shot as the product photo when the user
    // hasn't attached one — staged like any other photo edit, so it shows in
    // the preview and can be changed/removed before save (img-02).
    if (sourceUri && !localImageUri) {
      void storeExistingPhotoAsProductPhoto(productId, sourceUri).then((result) => {
        if (result) setLocalImageUri(result.localImageUri);
      });
    }
  }

  function buildProduct(contributionOptIn = false): Product {
    const resolvedPaoMonths: number | null = isCustomPao
      ? (parseInt(customPaoText, 10) || null)
      : paoMonths;

    return {
      id: productId,
      name: name.trim(),
      brand: brand.trim() || null,
      productType: productType ?? 'other',
      // Carry the server-owned URL (edit/corpus); stop hardcoding null.
      imageUrl,
      localImageUri,
      activeIngredients: selectedIngredients,
      activeTags: selectedIngredients.map((i) => i.key),
      fullIngredientText: fullIngredientText.trim() || null,
      usageTime: editingProduct?.usageTime ?? 'both',
      openBeautyFactsId: obfId,
      addedAt: editingProduct?.addedAt ?? new Date().toISOString(),
      notes: null,
      openedDate: isOpened ? openedDate : null,
      paoMonths: resolvedPaoMonths,
      isPhysicalExfoliant,
      // Only meaningful on a sunscreen; anything unparseable stays unknown so
      // the adequacy check skips the product rather than guessing.
      spfValue: productType === 'spf' ? (parseInt(spfText, 10) || null) : null,
      // Edits preserve the original provenance; new records take the
      // corpus row's own source (obf_import / vials_seed / community) when
      // prefilled, or 'user_local' for a genuinely manual entry.
      source: editingProduct?.source ?? prefillSource ?? 'user_local',
      // Set once at save time, never mutated afterward on edits.
      contributionOptIn: editingProduct?.contributionOptIn ?? contributionOptIn,
      // Edits preserve the existing status; new records take the entry
      // point's intent ("Explore new" -> wishlist), undefined (-> owned)
      // for a plain "Add new" save.
      status: editingProduct?.status ?? initialStatus,
    };
  }

  async function attachPhoto(source: PhotoSource) {
    const result = await pickAndStoreProductPhoto(productId, source);
    if (result) setLocalImageUri(result.localImageUri);
  }

  function handlePhotoPress() {
    // Photo edits are staged like every other field: capture writes files
    // immediately (keyed to the stable productId), but "Remove" only clears
    // local state — the files are cleaned on save (see handleSave).
    Alert.alert('Product Photo', 'Photograph only the product.', [
      { text: 'Take Photo', onPress: () => void attachPhoto('camera') },
      { text: 'Choose from Gallery', onPress: () => void attachPhoto('library') },
      ...(localImageUri
        ? [
            {
              text: 'Remove Photo',
              style: 'destructive' as const,
              onPress: () => setLocalImageUri(null),
            },
          ]
        : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }

  /**
   * Shares the product with the community database. Deliberately awaited and
   * its outcome surfaced — the local save has already happened and is never
   * rolled back, so a failure here only affects the sharing status line.
   */
  async function shareProduct(product: Product) {
    if (!COMMUNITY_CONTRIBUTION_ENABLED) return;
    setSharing(true);
    setShareResult(null);
    try {
      const blob = canShareContributionPhoto(profile?.contributionConsent)
        ? await renderContributionBlob(product.localImageUri)
        : null;
      const result = await submitContribution(
        {
          brand: product.brand ?? '',
          name: product.name,
          productType: product.productType,
          barcode: product.barcode ?? null,
          inciRaw: product.fullIngredientText,
          status: 'pending',
        },
        blob,
      );
      setShareResult(result);
    } catch (e) {
      setShareResult({
        status: 'error',
        message: e instanceof Error ? e.message : 'Could not share this product.',
      });
    } finally {
      setSharing(false);
    }
  }

  function handleRetryShare() {
    void shareProduct(buildProduct());
  }

  /**
   * Continue/Not-now handlers for ContributionConsentModal (either variant).
   * Reminder-modal decisions never retroactively change the product that
   * already saved (per the "no retroactive share" scope decision) — they
   * only govern the global status/toggle for future saves.
   */
  // Lands the user back on My Shelf with the usual "Saved" toast — the exit
  // both the routine scheduler's own close AND a skipped scheduler share.
  function finishSave(product: Product) {
    navigation.navigate('Catalog', {
      toast: {
        savedAt: Date.now(),
        contributionOptIn: product.contributionOptIn === true,
        contributedCount: contributedProductsCount(useProductsStore.getState().products),
      },
    });
  }

  // A Wishlist save has no routine to place it in — it isn't physically
  // owned yet (docs/tasks/ux-explore-vials/00-user-journey.md §5), so it
  // skips the scheduler prompt entirely rather than offering an empty one.
  function maybeOpenScheduler(product: Product) {
    if (product.status === 'wishlist') {
      finishSave(product);
      return;
    }
    setSchedulerProduct(product);
  }

  function handleConsentContinue(shareThisProduct: boolean) {
    const wasFirstTime = consentModalVariant === 'first-time';
    setConsentModalVariant(null);
    setContributionConsentStatus('accepted');
    setShareToggleOn(true);

    if (!pendingConsentProduct) return;

    if (wasFirstTime) {
      updateProduct(pendingConsentProduct.id, { contributionOptIn: shareThisProduct });
      if (shareThisProduct) {
        void shareProduct({ ...pendingConsentProduct, contributionOptIn: true });
      }
      maybeOpenScheduler({ ...pendingConsentProduct, contributionOptIn: shareThisProduct });
    } else {
      maybeOpenScheduler(pendingConsentProduct);
    }
    setPendingConsentProduct(null);
  }

  function handleConsentNotNow() {
    const wasFirstTime = consentModalVariant === 'first-time';
    setConsentModalVariant(null);
    if (wasFirstTime) {
      setContributionConsentStatus('declined');
      setShareToggleOn(false);
    }
    if (pendingConsentProduct) {
      maybeOpenScheduler(pendingConsentProduct);
      setPendingConsentProduct(null);
    }
  }

  function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('Product name is required');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    setNameError(null);

    if (isCustomPao && !customPaoText.trim()) {
      setPaoError('Enter the number of months');
      return;
    }
    setPaoError(null);

    if (isEditMode) {
      const product = buildProduct();
      // The user removed a previously attached photo → clean up its file.
      if (editingProduct?.localImageUri && !product.localImageUri) {
        void deleteProductPhoto(productId);
      }
      updateProduct(product.id, product);
      navigation.goBack();
      return;
    }

    // Contribution consent only governs genuinely manual entries — a
    // corpus-prefilled save (obf_import, vials_seed, or community) keeps
    // today's unconditional background sync, unchanged by this flow (see
    // scope decisions in
    // docs/specs/contribution-consent-flow/00-IMPLEMENTATION-PROMPT.md §"No
    // consent flow for editing/completing existing database-sourced
    // products").
    if (prefillSource) {
      const product = buildProduct();
      addProduct(product);
      void shareProduct(product);
      maybeOpenScheduler(product);
      return;
    }

    // Explore Composition flow (docs/specs/explore-composition.md Story 4/5,
    // tech design FE-6) — same unconditional-share pattern as a corpus
    // prefill above (this is also not a genuinely-manual entry): no
    // contribution-consent gating. The promoted WishlistEntry, if any, is
    // removed only AFTER addProduct succeeds — never before, never instead
    // of creating the product (Story 5 AC3).
    if (explorePrefill) {
      const product = buildProduct();
      addProduct(product);
      if (explorePrefill.wishlistEntryId) {
        removeWishlistEntry(explorePrefill.wishlistEntryId);
      }
      void shareProduct(product);
      maybeOpenScheduler(product);
      return;
    }

    const decision = decideManualSave(
      {
        status: contributionConsentStatus,
        declinedSaveCountSinceLastReminder,
        reminderCountShown,
      },
      shareToggleOn,
    );

    // Local shelf save is instant and never awaits the contribution.
    const product = buildProduct(decision.contributionOptIn);
    addProduct(product);

    if (decision.nextStatus) setContributionConsentStatus(decision.nextStatus);
    if (decision.incrementDeclinedCount) incrementDeclinedSaveCount();
    if (decision.resetDeclinedCount) resetDeclinedSaveCount();
    if (decision.incrementReminderCount) incrementReminderCountShown();
    if (decision.nextStatus === 'accepted') setShareToggleOn(true);

    if (decision.contributionOptIn) {
      void shareProduct(product);
    }

    if (decision.showModal) {
      // Defer the scheduler sheet until the modal resolves, so it never
      // appears underneath a still-open consent decision.
      setPendingConsentProduct(product);
      setConsentModalVariant(decision.showModal);
      return;
    }

    maybeOpenScheduler(product);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={s.safe}>
        <AppHeader
          title={isEditMode ? 'Edit Product' : 'Add Product'}
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
          ref={scrollRef}
          style={s.scroll}
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {showObfAttribution ? (
            <InlineAlert
              tone="info"
              icon={<Icon name="info" size={16} color={colors.statusInfo} />}
            >
              Product data from Open Beauty Facts (ODbL)
            </InlineAlert>
          ) : null}

          {corpusProductUrl ? (
            <InlineAlert
              tone="info"
              icon={<Icon name="external-link" size={16} color={colors.statusInfo} />}
              action={
                <Button
                  variant="textActive"
                  size="sm"
                  onPress={() => Linking.openURL(corpusProductUrl)}
                  accessibilityLabel="Open product page"
                >
                  Open
                </Button>
              }
            >
              Product page available
            </InlineAlert>
          ) : null}

          {/* ── Block 1: Product Basics ──────────────────────────────── */}
          <Card variant="raised" padding="none" style={s.card}>
            <View style={s.cardContent}>
              <SectionEyebrow num="01" label="Product Basics" />

              <View style={s.photoRow}>
                <ProductThumbnail product={buildProduct()} size={72} />
                <View style={s.photoActions}>
                  <Text style={s.featureTitle}>Product Photo</Text>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Icon name="camera" size={16} color={colors.textPrimary} />}
                    onPress={handlePhotoPress}
                  >
                    {localImageUri ? 'Change photo' : 'Add photo'}
                  </Button>
                </View>
              </View>

              <Input
                label="Product Name *"
                value={name}
                onChangeText={(t) => { setName(t); if (nameError) setNameError(null); }}
                placeholder="e.g. Daily Moisturiser SPF 50"
                error={nameError}
                returnKeyType="next"
              />

              {/* Corpus-backed brand autocomplete (2026-08-27, real-device
                  finding) — this screen has no Explore Composition guardrail
                  (it's the shared manual-entry completion form for both the
                  ordinary "Add new" wizard and Explore Composition's own
                  "Put on Shelf"/"Move to Shelf" step, already uses
                  useProductRepository/corpus access elsewhere), so it opts
                  into the full-corpus search variant unlike the
                  Save-to-Wishlist modal's local-only one. */}
              <BrandAutocompleteInput
                value={brand}
                onSelectSuggestion={setBrand}
                onCommitTyped={setBrand}
                searchFn={searchBrandsWithCorpus}
              />

              <View style={s.fieldGroup}>
                <Text style={s.featureTitle}>Product Type</Text>
                <View style={s.chipsWrap}>
                  {PRODUCT_TYPE_OPTIONS.map(({ value: val, label }) => (
                    <FilterChip
                      key={val}
                      selected={productType === val}
                      onPress={() => setProductType(val)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: productType === val }}
                    >
                      {label}
                    </FilterChip>
                  ))}
                </View>
              </View>

              {/* SPF strength — sunscreens only (US-29). Optional: leaving it
                  blank means "unknown", never "assume the worst". */}
              {productType === 'spf' ? (
                <Input
                  label="SPF (optional)"
                  value={spfText}
                  onChangeText={(t) => setSpfText(t.replace(/[^0-9]/g, ''))}
                  placeholder="e.g. 50"
                  keyboardType="number-pad"
                  maxLength={3}
                  returnKeyType="done"
                />
              ) : null}
            </View>
          </Card>

          {/* ── Block 2: Ingredients (INCI) ──────────────────────────── */}
          <Card variant="raised" padding="none" style={s.card}>
            <View style={s.cardContent}>
              <SectionEyebrow num="02" label="Ingredients (INCI)" />
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
              <View style={s.divider} />
              <IngredientChips
                selected={selectedIngredients}
                onToggle={toggleIngredient}
              />
            </View>
          </Card>

          {/* ── Block 3: Details ─────────────────────────────────────── */}
          <Card variant="raised" padding="none" style={s.card}>
            <View style={s.cardContent}>
              <SectionEyebrow num="03" label="Details" />

              <PaoField
                selected={paoMonths}
                isCustom={isCustomPao}
                customText={customPaoText}
                error={paoError}
                onSelectPreset={handlePaoPreset}
                onSelectCustom={handlePaoCustomSelect}
                onCustomTextChange={handlePaoCustomText}
              />

              <View style={s.divider} />

              <OpenedDateField
                isOpened={isOpened}
                dateValue={openedDate}
                onToggle={setIsOpened}
                onDateChange={setOpenedDate}
              />

              <View style={s.divider} />

              <PhysicalExfoliantField
                checked={isPhysicalExfoliant}
                onToggle={setIsPhysicalExfoliant}
              />
            </View>
          </Card>
        </ScrollView>

        <View style={s.footer}>
          {!isEditMode && !prefillSource && !explorePrefill && contributionConsentStatus !== 'disabled' && contributionConsentStatus !== 'unset' ? (
            <ContributionToggle checked={shareToggleOn} onValueChange={setShareToggleOn} />
          ) : null}
          <ShareStatus
            sharing={sharing}
            result={shareResult}
            onRetry={handleRetryShare}
          />
          <Button fullWidth size="lg" onPress={handleSave} disabled={!name.trim()}>
            {isEditMode
              ? 'Save Changes'
              : initialStatus === 'wishlist'
                ? 'Add to Wishlist'
                : 'Put on My Shelf'}
          </Button>
        </View>
      </SafeAreaView>

      <OcrScannerSheet
        visible={showOcrScanner}
        onClose={() => setShowOcrScanner(false)}
        onResult={handleOcrResult}
      />

      <ContributionConsentModal
        visible={consentModalVariant !== null}
        variant={consentModalVariant ?? 'first-time'}
        onContinue={handleConsentContinue}
        onNotNow={handleConsentNotNow}
      />

      <RoutineSchedulerSheet
        visible={schedulerProduct !== null}
        productId={schedulerProduct?.id ?? ''}
        productType={schedulerProduct?.productType ?? 'serum'}
        cancelLabel="Skip"
        saveLabel="Save & Next"
        onClose={() => {
          const savedProduct = schedulerProduct;
          setSchedulerProduct(null);
          if (savedProduct) finishSave(savedProduct);
        }}
      />
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const BADGE_SIZE = 26;

const s = StyleSheet.create({
  // Screen layout
  flex: { flex: 1 },
  safe: {
    flex: 1,
    backgroundColor: colors.bgScreen,
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[8],
    paddingBottom: space[20],
    gap: space[8],
  },
  footer: {
    paddingHorizontal: space.gutterScreen,
    paddingVertical: space[4],
    borderTopWidth: 1,
    borderTopColor: colors.borderDivider,
    backgroundColor: colors.bgScreen,
  },

  // Card shell
  card: {
    borderRadius: radius.xl,
  },
  cardContent: {
    paddingHorizontal: space[3],
    paddingVertical: space[6],
    gap: space[5],
  },

  // Section eyebrow
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  eyebrowBadge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrowNum: {
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
    lineHeight: 18,
    color: colors.textOnDark,
    includeFontPadding: false,
  },
  eyebrowLabel: {
    flex: 1,
    fontFamily: 'DMSans-Medium',
    fontSize: 16,
    color: colors.textPrimary,
  },

  // Community-share status
  shareRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[2],
    paddingBottom: space[3],
  },
  shareText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  shareErrorBody: {
    flexShrink: 1,
    gap: space[1],
  },

  // Photo attach row
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
  },
  photoActions: {
    flex: 1,
    gap: space[2],
    alignItems: 'flex-start',
  },

  // Field layout helpers
  fieldGroup: {
    gap: space[3],
  },
  chipsRow: {
    flexDirection: 'row',
    gap: space[2],
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },

  sectionHint: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    lineHeight: 22,
    color: colors.textTertiary,
    marginTop: -space[2],
  },

  // Sub-section wrapper (uniform gap inside Block 3 sections)
  subSection: {
    gap: space[4],
  },

  // INCI field
  inciStack: {
    gap: space[4],
  },
  alertTitleWarning: {
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
    lineHeight: 20,
    color: colors.statusWarning,
  },
  alertBodyWarning: { ...typography.bodySmall, color: colors.statusWarning },
  alertBodyInfo: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    lineHeight: 22,
    color: colors.statusInfo,
  },
  textArea: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    color: colors.textPrimary,
    borderWidth: 1.5,
    borderColor: colors.borderInput,
    borderRadius: radius.md,
    padding: space[3],
    minHeight: 120,
    backgroundColor: colors.surfaceRaised,
    includeFontPadding: false,
    textAlignVertical: 'top',
  },
  detectRow: {
    alignSelf: 'flex-end',
  },

  // PAO custom input
  customPaoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  customPaoInput: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    color: colors.textPrimary,
    borderWidth: 1.5,
    borderColor: colors.borderInput,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    paddingVertical: space[3],
    width: 80,
    backgroundColor: colors.surfaceRaised,
    includeFontPadding: false,
  },
  customPaoUnit: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },

  // Already opened
  featureTitle: {
    fontFamily: 'DMSans-Medium',
    fontSize: 17,
    lineHeight: 24,
    letterSpacing: -0.2,
    color: colors.textPrimary,
  },
  featureDesc: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },

  // Date picker
  dateBlock: {
    gap: space[2],
  },
  dateInput: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    color: colors.textPrimary,
    borderWidth: 1.5,
    borderColor: colors.borderInput,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    paddingVertical: space[3],
    backgroundColor: colors.surfaceRaised,
    includeFontPadding: false,
  },
  dateHint: { ...typography.bodySmall, color: colors.textTertiary },

  // Divider between sub-sections
  divider: {
    height: 1,
    backgroundColor: colors.borderDivider,
  },

  // Error states
  inputError: {
    borderColor: colors.statusError,
  },
  fieldError: { ...typography.bodySmall, color: colors.statusError },
});
