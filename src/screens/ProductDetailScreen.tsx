import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Icon } from '@/components/ui/Icon';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { DeleteProductModal } from '@/components/product/DeleteProductModal';
import { ProductActionSheet } from '@/components/product/ProductActionSheet';
import { ProductInsightsPanel } from '@/components/product/ProductInsightsPanel';
import { AttributionTooltip } from '@/components/routine/AttributionTooltip';
import { RemoveRoutineActionSheet } from '@/components/routine/RemoveRoutineActionSheet';
import { RoutineSchedulerSheet } from '@/components/routine/RoutineSchedulerSheet';
import { AppHeader } from '@/components/ui/core/AppHeader';
import { Button } from '@/components/ui/core/Button';
import { IconButton } from '@/components/ui/core/IconButton';
import { InlineAlert } from '@/components/ui/feedback/InlineAlert';
import { Tag } from '@/components/ui/core/Tag';
import { Badge } from '@/components/ui/feedback/Badge';
import { Textarea } from '@/components/ui/forms/Textarea';
import { ProductThumbnail } from '@/components/ui/ProductThumbnail';
import { colors, palette, radius, shadow, space, typography } from '@/constants/tokens';
import { ACTIVE_INGREDIENT_LABELS, getProductTypeBadgeStatus, PRODUCT_TYPE_LABELS } from '@/constants/labels';
import { deleteProductCascade } from '@/domain/productActions';
import type { CatalogStackParamList } from '@/navigation/AppNavigator';
import { useProductsStore } from '@/store/productsStore';
import { useRoutinesStore } from '@/store/routinesStore';
import { getProductAllergenMatches } from '@/utils/allergenDetector';
import { getMatchesForKey, hasAliasOverride } from '@/utils/attributionLookup';
import {
  deriveProductSchedule,
  formatRoutineLabel,
  formatScheduleDays,
  type ProductSchedule,
} from '@/utils/routineLabel';
import {
  buildProductProfileFromActiveKeys,
  buildProductProfileFromProduct,
} from '@/utils/productProfile';
import type { ActiveIngredientKey, Product, ProductProfile } from '@/types';

/** "Morning, daily" / "Evening, Mon, Wed, Fri" — used-schedule summary for the
 *  product hero. Returns null when the product isn't in any routine, so the
 *  callout can be hidden rather than showing a hollow "not scheduled" state. */
function formatUsedSummary(schedule: ProductSchedule): string | null {
  if (!schedule.morning && !schedule.evening) return null;
  const timeLabel =
    schedule.morning && schedule.evening
      ? 'Morning & Evening'
      : schedule.morning
      ? 'Morning'
      : 'Evening';
  const dayLabel =
    schedule.scheduledDays.length === 0 ? 'daily' : formatScheduleDays(schedule.scheduledDays);
  return `${timeLabel}, ${dayLabel}`;
}

/**
 * Builds this product's `ProductProfile` for the "Product Insights" panel
 * (product-profile-m1 FE-8). The builder is pure computation and should
 * never throw for a well-typed `Product` (tech-design product-profile-m1.md
 * §2), but per spec §5's error-state rule the screen must fail closed to the
 * insufficient-data state rather than crash if it somehow does — logged via
 * the existing `__DEV__`-guarded warning convention (see
 * `routineEngine/productFacts.ts`/`services/storage.ts`).
 */
function buildProductInsightsProfile(product: Product): ProductProfile {
  try {
    return buildProductProfileFromProduct(product);
  } catch (e) {
    if (__DEV__) console.warn('[ProductDetailScreen] product profile build failed:', e);
    return buildProductProfileFromActiveKeys({
      productId: product.id,
      productType: product.productType,
      brand: product.brand,
      name: product.name,
      activeKeys: [],
    });
  }
}

// EU fragrance-allergen "Allergens" card copy (tech design Assumption 5):
// one shared neutral one-liner for every non-restricted match, one shared
// note for restricted matches — not 26 hand-authored blurbs. Kept local to
// this screen (its only consumer) rather than exported from
// allergenDetector.ts, since that module is mocked as
// {getProductAllergenMatches, hasRestrictedAllergenMatch}-only in
// tests/vials-eu-allergen-detection/ProductDetailScreen.allergens-card.test.tsx
// — see the deviation note there and in progress/vials-eu-allergen-detection.md.
// Verbatim from the spec's own Story 3 AC1 example.
const ALLERGEN_NEUTRAL_COPY = 'Fragrance component regulated in the EU as a potential allergen.';
const ALLERGEN_RESTRICTED_NOTE =
  'No longer permitted in new EU products (banned 2021–2022) — this may be older stock, worth checking for expiry.';

type Props = NativeStackScreenProps<CatalogStackParamList, 'ProductDetail'>;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProductDetailScreen({ route, navigation }: Props) {
  const { productId } = route.params;
  const products = useProductsStore((s) => s.products);
  const updateProduct = useProductsStore((s) => s.updateProduct);

  const product = products.find((p) => p.id === productId) ?? null;

  const routines = useRoutinesStore((s) => s.routines);

  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [schedulerVisible, setSchedulerVisible] = useState(false);
  const [removeSheetVisible, setRemoveSheetVisible] = useState(false);
  const [attributionKey, setAttributionKey] = useState<ActiveIngredientKey | null>(null);
  const [notesText, setNotesText] = useState(product?.notes ?? '');

  // ── Not found guard ───────────────────────────────────────────────────────

  if (!product) {
    return (
      <SafeAreaView style={styles.safe}>
        <AppHeader
          title="Product"
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
        <View style={styles.notFoundWrap}>
          <InlineAlert tone="sos" title="Product not found">
            This product may have been deleted from your catalog.
          </InlineAlert>
          <Button variant="secondary" size="lg" onPress={() => navigation.goBack()}>
            Go Back
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const schedule = deriveProductSchedule(routines, product.id);
  const routineLabel: string | null = formatRoutineLabel(schedule);
  const usedSummary = formatUsedSummary(schedule);

  // Resolve active tags: use saved activeTags; fall back to activeIngredients keys
  // for products saved before activeTags was introduced.
  const activeTags: ActiveIngredientKey[] =
    product.activeTags ?? product.activeIngredients.map((i) => i.key);
  const allergenMatches = getProductAllergenMatches(product);
  // Screen-level cache is sufficient for Milestone 1 (spec §6 Data
  // Requirements, tech-design Assumption 3) — no store/persistence entity.
  const productProfile = useMemo(() => buildProductInsightsProfile(product), [product]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleDeleteConfirm() {
    if (deleteTarget) {
      deleteProductCascade(deleteTarget.id);
      setDeleteTarget(null);
      navigation.goBack();
    }
  }

  const handleNotesBlur = () => {
    const trimmed = notesText.trim();
    if (trimmed === (product.notes ?? '')) return;
    updateProduct(product.id, { notes: trimmed.length > 0 ? trimmed : null });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader
        title={product.name}
        leftAction={
          <IconButton
            icon={<Icon name="arrow-left" size={20} color={colors.textPrimary} />}
            label="Back"
            variant="ghost"
            size="sm"
            onPress={() => navigation.goBack()}
          />
        }
        rightAction={
          <IconButton
            icon={<Icon name="more-vertical" size={20} color={colors.textPrimary} />}
            label="Product options"
            variant="ghost"
            size="sm"
            onPress={() => setActionSheetVisible(true)}
          />
        }
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header block ──────────────────────────────────────────────── */}
        <View style={styles.headerBlock}>
          <ProductThumbnail product={product} size={140} />
          <View style={styles.headerInfo}>
            {product.brand ? (
              <Text style={styles.brand}>{product.brand}</Text>
            ) : null}
            <Text style={styles.productName}>{product.name}</Text>
            <Badge status={getProductTypeBadgeStatus(product.productType)} type="Light">
              {PRODUCT_TYPE_LABELS[product.productType] ?? product.productType}
            </Badge>
          </View>
        </View>

        {/* ── Used-in-routine summary ─────────────────────────────────── */}
        {usedSummary ? (
          <View style={styles.usedBar}>
            <View style={styles.usedIconCircle}>
              <Icon
                name={schedule.evening && !schedule.morning ? 'moon' : 'sun'}
                size={18}
                color={schedule.evening && !schedule.morning ? palette.cobalt : palette.golden}
              />
            </View>
            <Text style={styles.usedText}>
              <Text style={styles.usedTextBold}>Used: </Text>
              {usedSummary}
            </Text>
          </View>
        ) : null}

        {/* ── Active Ingredients ────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconCircle}>
              <Icon name="droplet" size={18} color={palette.plum} />
            </View>
            <Text style={styles.cardTitle}>Active Ingredients</Text>
          </View>

          {activeTags.length > 0 ? (
            <View style={styles.tagWrap}>
              {activeTags.map((key) => {
                const matches = getMatchesForKey(product.fullIngredientText, key);
                const showAliasIcon = hasAliasOverride(matches);
                return (
                  <Pressable
                    key={key}
                    testID={`active-badge-${key}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${ACTIVE_INGREDIENT_LABELS[key] ?? key} detected, tap for details`}
                    onPress={() => setAttributionKey(key)}
                    style={styles.attributionBadgeWrap}
                  >
                    <Tag tone="info">{ACTIVE_INGREDIENT_LABELS[key] ?? key}</Tag>
                    {showAliasIcon ? (
                      <View
                        testID={`active-badge-alias-icon-${key}`}
                        accessibilityLabel="Detected via regional ingredient name"
                        style={styles.aliasIconWrap}
                      >
                        <Icon name="globe" size={11} color={colors.textSecondary} />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Tag tone="neutral">None confirmed</Tag>
          )}

          {/* Vitamin C auto-migration infobox (research §2.1 — Story 9): the
              legacy tag was conservatively mapped to pure vitamin C; one tap
              reclassifies it as a derivative and clears the marker. */}
          {product.vitaminCAutoMigrated === true &&
          activeTags.includes('vitamin_c_pure') ? (
            <InlineAlert
              tone="info"
              icon={<Icon name="info" size={14} color={colors.statusInfo} />}
              title="Treated as pure vitamin C"
            >
              <Text style={styles.infoboxText}>
                We migrated this product&apos;s vitamin C tag to the pure
                (L-ascorbic acid) form — the safe default for conflict checks.{' '}
                <Text
                  style={styles.infoboxLink}
                  accessibilityRole="button"
                  accessibilityLabel="Mark as a vitamin C derivative"
                  onPress={() => {
                    updateProduct(product.id, {
                      activeTags: activeTags.map((key) =>
                        key === 'vitamin_c_pure' ? 'vitamin_c_derivative' : key,
                      ),
                      vitaminCAutoMigrated: false,
                    });
                  }}
                >
                  This is a derivative
                </Text>
              </Text>
            </InlineAlert>
          ) : null}
        </View>

        {/* ── Product Insights (product-profile-m1) ───────────────────── */}
        <ProductInsightsPanel profile={productProfile} />

        {/* ── Allergens ─────────────────────────────────────────────────── */}
        {allergenMatches.length > 0 ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconCircle}>
                <Icon name="info" size={18} color={palette.plum} />
              </View>
              <Text style={styles.cardTitle}>Allergens</Text>
            </View>
            <View style={styles.allergenList}>
              {allergenMatches.map((match) => (
                <View key={match.canonical} style={styles.allergenRow}>
                  <Text style={styles.allergenName}>{match.canonical}</Text>
                  <Text style={styles.allergenCopy}>{ALLERGEN_NEUTRAL_COPY}</Text>
                  {match.restricted ? (
                    <Text style={styles.allergenRestrictedNote}>{ALLERGEN_RESTRICTED_NOTE}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* ── Full Formula ─────────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconCircle}>
              <Icon name="list" size={18} color={palette.plum} />
            </View>
            <Text style={styles.cardTitle}>Full Ingredient List</Text>
          </View>
          {product.fullIngredientText ? (
            <Text style={styles.formulaText}>{product.fullIngredientText}</Text>
          ) : (
            <Text style={styles.emptyText}>Not available</Text>
          )}
        </View>

        {/* ── Notes ───────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconCircle}>
              <Icon name="edit-3" size={18} color={palette.plum} />
            </View>
            <Text style={styles.cardTitle}>Notes</Text>
          </View>
          <Textarea
            value={notesText}
            onChangeText={setNotesText}
            onBlur={handleNotesBlur}
            placeholder="Add a note about this product…"
            minHeight={56}
          />
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Routine footer ──────────────────────────────────────────────── */}
      <View style={styles.footer}>
        <Button
          fullWidth
          size="lg"
          variant={routineLabel !== null ? 'secondary' : 'primary'}
          onPress={() => setSchedulerVisible(true)}
        >
          {routineLabel !== null ? routineLabel : 'Add to Routine'}
        </Button>
        {routineLabel !== null ? (
          <Button
            variant="destructive"
            size="sm"
            fullWidth
            onPress={() => setRemoveSheetVisible(true)}
            accessibilityLabel="Remove from routine"
          >
            Remove from Routine
          </Button>
        ) : null}
      </View>

      <ProductActionSheet
        product={actionSheetVisible ? product : null}
        onEdit={(_p) => {
          setActionSheetVisible(false);
          navigation.navigate('ManualProductForm', { editingProductId: product.id });
        }}
        onDelete={(_p) => {
          setActionSheetVisible(false);
          setDeleteTarget(product);
        }}
        onToggleHidden={(p) => {
          updateProduct(p.id, { isHidden: !p.isHidden });
          setActionSheetVisible(false);
        }}
        onClose={() => setActionSheetVisible(false)}
      />

      <DeleteProductModal
        product={deleteTarget}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      <RoutineSchedulerSheet
        visible={schedulerVisible}
        productId={product.id}
        productType={product.productType}
        title={routineLabel !== null ? 'Edit Routine Settings' : 'Add to Routine'}
        cancelLabel="Cancel"
        saveLabel="Save"
        onClose={() => setSchedulerVisible(false)}
      />

      <RemoveRoutineActionSheet
        visible={removeSheetVisible}
        product={product}
        onClose={() => setRemoveSheetVisible(false)}
      />

      <AttributionTooltip
        visible={attributionKey !== null}
        onClose={() => setAttributionKey(null)}
        displayName={attributionKey ? (ACTIVE_INGREDIENT_LABELS[attributionKey] ?? attributionKey) : ''}
        matches={attributionKey ? getMatchesForKey(product.fullIngredientText, attributionKey) : []}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgScreen,
  },
  flex: {
    flex: 1,
  },
  notFoundWrap: {
    flex: 1,
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[8],
    gap: space[4],
  },
  content: {
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[6],
    paddingBottom: space[16],
    gap: space[6],
  },
  footer: {
    paddingHorizontal: space.gutterScreen,
    paddingVertical: space[4],
    borderTopWidth: 1,
    borderTopColor: colors.borderDivider,
    backgroundColor: colors.bgScreen,
    gap: space[3],
  },
  headerBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[4],
  },
  headerInfo: {
    flex: 1,
    gap: space[2],
    minWidth: 0,
  },
  brand: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: palette.plum,
  },
  productName: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  usedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[3],
    borderRadius: radius.lg,
    backgroundColor: palette.plumTint,
  },
  usedIconCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.bgBase,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  usedText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  usedTextBold: {
    fontFamily: 'DMSans-Medium',
  },
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: space[4],
    gap: space[3],
    ...shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  cardIconCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: palette.plumTint,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardTitle: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  attributionBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
  },
  aliasIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoboxText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  infoboxLink: {
    fontFamily: 'DMSans-Medium',
    color: colors.textLink,
    textDecorationLine: 'underline',
  },
  allergenList: {
    gap: space[3],
  },
  allergenRow: {
    gap: 2,
  },
  allergenName: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  allergenCopy: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  allergenRestrictedNote: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  formulaText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
});
