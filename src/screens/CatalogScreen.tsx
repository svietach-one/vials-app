import React, { useEffect, useState } from 'react';
import {
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Icon } from '@/components/ui/Icon';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { DeleteProductModal } from '@/components/product/DeleteProductModal';
import { ProductActionSheet } from '@/components/product/ProductActionSheet';
import { ProductShelfCard } from '@/components/product/ProductShelfCard';
import { CatalogFilterTrigger } from '@/components/catalog/CatalogFilterTrigger';
import { FilterSheet } from '@/components/catalog/FilterSheet';
import { RoutineSchedulerSheet } from '@/components/routine/RoutineSchedulerSheet';
import { AppHeader } from '@/components/ui/core/AppHeader';
import { Button } from '@/components/ui/core/Button';
import { Card } from '@/components/ui/core/Card';
import { EmptyState } from '@/components/ui/core/EmptyState';
import { IconButton } from '@/components/ui/core/IconButton';
import { Badge } from '@/components/ui/feedback/Badge';
import { Toast } from '@/components/ui/feedback/Toast';
import { Tag } from '@/components/ui/core/Tag';
import { Input } from '@/components/ui/forms/Input';
import { colors, space, typography } from '@/constants/tokens';
import {
  ACTIVE_INGREDIENT_LABELS,
  FUNCTIONAL_BENEFIT_INGREDIENTS,
  PRODUCT_TYPE_LABELS,
} from '@/constants/labels';
import { deleteProductCascade } from '@/domain/productActions';
import type { CatalogStackParamList } from '@/navigation/AppNavigator';
import { useProductsStore } from '@/store/productsStore';
import { useRoutinesStore } from '@/store/routinesStore';
import type { CatalogFilterState, Product } from '@/types';
import { CATALOG_FILTER_DEFAULT } from '@/types';
import { getProductRoutineStatus, type RoutineStatusResult } from '@/utils/routineStatus';
import { getProductPaoStatus } from '@/utils/paoHelpers';
import { formatScheduleDays } from '@/utils/routineLabel';

type Props = NativeStackScreenProps<CatalogStackParamList, 'Catalog'>;

// ─── Module-level filter constants ────────────────────────────────────────────

const PAO_AMBER = '#D97706';

/** 1st / 2nd / 3rd / 4th… for the contribution-count toast line. */
function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

// ─── applyFilters ─────────────────────────────────────────────────────────────

export function applyFilters(
  products: Product[],
  { searchQuery, selectedCategory, selectedBenefits }: CatalogFilterState,
): Product[] {
  return products.filter((p) => {
    // Gate 1 — text search
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const nameMatch = p.name.toLowerCase().includes(q);
      const brandMatch = (p.brand ?? '').toLowerCase().includes(q);
      const tagMatch = (p.activeTags ?? []).some((k) =>
        ACTIVE_INGREDIENT_LABELS[k]?.toLowerCase().includes(q),
      );
      if (!nameMatch && !brandMatch && !tagMatch) return false;
    }

    // Gate 2 — category
    if (selectedCategory !== 'All' && p.productType !== selectedCategory) return false;

    // Gate 3 — functional benefits (ALL selected must pass)
    for (const benefit of selectedBenefits) {
      const matchingKeys = FUNCTIONAL_BENEFIT_INGREDIENTS[benefit];
      if (!(p.activeTags ?? []).some((k) => matchingKeys.includes(k))) return false;
    }

    return true;
  });
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CatalogScreen({ navigation, route }: Props) {
  const products = useProductsStore((s) => s.products);
  const updateProduct = useProductsStore((s) => s.updateProduct);
  const routines = useRoutinesStore((s) => s.routines);
  const removeProductStep = useRoutinesStore((s) => s.removeProductStep);

  const [filterState, setFilterState] = useState<CatalogFilterState>(CATALOG_FILTER_DEFAULT);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [schedulerTarget, setSchedulerTarget] = useState<Product | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // One-shot success toast forwarded from ManualProductFormScreen after a
  // save — captured into local state, then cleared from params so it never
  // reappears on refocus (docs/specs/contribution-consent-flow/03-visual-spec.md).
  const incomingToast = route.params?.toast;
  const [toastContent, setToastContent] = useState<{
    contributionOptIn: boolean;
    contributedCount: number;
  } | null>(null);
  useEffect(() => {
    if (!incomingToast) return;
    setToastContent(incomingToast);
    navigation.setParams({ toast: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingToast?.savedAt]);

  const filteredProducts = applyFilters(products, filterState);
  const activeFilterCount =
    (filterState.selectedCategory !== 'All' ? 1 : 0) + filterState.selectedBenefits.length;
  const hasActiveFilters =
    filterState.searchQuery.trim() !== '' ||
    filterState.selectedCategory !== 'All' ||
    filterState.selectedBenefits.length > 0;

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleDeleteConfirm() {
    if (deleteTarget) {
      deleteProductCascade(deleteTarget.id);
      setDeleteTarget(null);
    }
  }

  // ── Render item ───────────────────────────────────────────────────────────

  function renderItem({ item }: { item: Product }) {
    const isInRoutine = routines.some((r) => r.steps.some((s) => s.productId === item.id));
    const matchingStep = routines
      .flatMap((r) => r.steps)
      .find((s) => s.productId === item.id);
    const scheduleLabel = formatScheduleDays(matchingStep?.scheduledDays ?? []);

    return (
      <ProductShelfCard
        product={item}
        isInRoutine={isInRoutine}
        scheduleLabel={scheduleLabel}
        usageTime={item.usageTime}
        onCardPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
        onEdit={(p) => {
          navigation.navigate('ManualProductForm', { editingProductId: p.id });
        }}
        onDelete={(p) => {
          setDeleteTarget(p);
        }}
        onAddToRoutine={(p) => setSchedulerTarget(p)}
        onRemoveFromRoutine={(p) => {
          for (const r of routines) {
            if (r.steps.some((s) => s.productId === p.id)) {
              removeProductStep(r.id, p.id);
            }
          }
        }}
        onToggleHidden={(p) => {
          updateProduct(p.id, { isHidden: !p.isHidden });
        }}
      />
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader
        title="My Shelf"
        rightAction={
          <View style={styles.headerActions}>
            <CatalogFilterTrigger
              activeFilterCount={activeFilterCount}
              onPress={() => setSheetOpen(true)}
            />
            <IconButton
              icon={<Icon name="plus" size={20} color={colors.textPrimary} />}
              label="Add product"
              variant="ghost"
              size="sm"
              onPress={() => navigation.navigate('AddProductHub')}
            />
          </View>
        }
      />
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.searchWrap}>
            {/* Full-width — the filter trigger it used to share this row with
                now lives in the header, beside "+". */}
            <Input
              icon={<Icon name="search" size={15} color={colors.textTertiary} />}
              value={filterState.searchQuery}
              onChangeText={(t) => setFilterState((s) => ({ ...s, searchQuery: t }))}
              placeholder="Search by name, brand or ingredient…"
              clearButtonMode="while-editing"
              returnKeyType="search"
              containerStyle={styles.searchInputFlex}
            />
          </View>
        }
        ListEmptyComponent={
          <CatalogEmptyState
            hasProducts={products.length > 0}
            hasActiveFilters={hasActiveFilters}
            onAdd={() => navigation.navigate('AddProductHub')}
          />
        }
      />

      <DeleteProductModal
        product={deleteTarget}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      <RoutineSchedulerSheet
        visible={schedulerTarget !== null}
        productId={schedulerTarget?.id ?? ''}
        productType={schedulerTarget?.productType ?? 'serum'}
        title="Add to Routine"
        cancelLabel="Cancel"
        saveLabel="Add to routine"
        onClose={() => setSchedulerTarget(null)}
      />

      <FilterSheet
        visible={sheetOpen}
        initialState={filterState}
        onApply={setFilterState}
        onClose={() => setSheetOpen(false)}
      />

      <Toast
        visible={toastContent !== null}
        title="Saved"
        subtitle={
          toastContent?.contributionOptIn
            ? `That's your ${ordinal(toastContent.contributedCount)} jar in the Vials database.`
            : undefined
        }
        onHide={() => setToastContent(null)}
      />
    </SafeAreaView>
  );
}

// ─── Routine badge ────────────────────────────────────────────────────────────

function RoutineBadge({ status }: { status: RoutineStatusResult }) {
  if (status === 'none') return null;
  const label =
    status === 'both'
      ? 'Morning · Evening'
      : status === 'morning'
        ? 'Morning'
        : 'Evening';
  return <Badge status="Default" type="Light">{label}</Badge>;
}

// ─── PAO expiry chip ──────────────────────────────────────────────────────────

function PaoChip({ product }: { product: Product }) {
  const pao = getProductPaoStatus(product);
  if (!pao || (!pao.isExpired && !pao.isExpiringSoon)) return null;

  const label = pao.isExpired
    ? 'Expired'
    : pao.daysRemaining === 0
    ? 'Expires today'
    : `Expires in ${pao.daysRemaining}d`;

  return (
    <View style={paoStyles.row}>
      <Icon name="alert-triangle" size={12} color={PAO_AMBER} />
      <Text style={paoStyles.text}>{label}</Text>
    </View>
  );
}

const paoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  text: {
    ...typography.caption,
    color: PAO_AMBER,
  },
});

// ─── Empty state ──────────────────────────────────────────────────────────────

function CatalogEmptyState({
  hasProducts,
  hasActiveFilters,
  onAdd,
}: {
  hasProducts: boolean;
  hasActiveFilters: boolean;
  onAdd: () => void;
}) {
  const title = !hasProducts
    ? 'Your catalog is empty'
    : hasActiveFilters
    ? 'No products match the current filters'
    : 'No matching products';

  const body = !hasProducts
    ? 'Add your first product by searching Open Beauty Facts, scanning a barcode, or entering it manually.'
    : 'Try adjusting your filters or search query.';

  return (
    <View style={emptyStyles.wrap}>
      <EmptyState
        icon={<Icon name="package" size={24} color={colors.textSecondary} />}
        title={title}
        description={body}
        actions={
          !hasProducts
            ? [
                {
                  label: 'Add Product',
                  onPress: onAdd,
                  icon: <Icon name="plus" size={16} color={colors.textOnDark} />,
                },
              ]
            : undefined
        }
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgScreen,
  },
  searchWrap: {
    paddingTop: space[4],
    paddingBottom: space[3],
  },
  searchInputFlex: {
    flex: 1,
    alignSelf: 'stretch',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
  },
  listContent: {
    paddingHorizontal: space.gutterScreen,
    paddingBottom: space[12],
  },
  card: {
    // full-width cards with consistent horizontal padding already applied by listContent
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  cardContent: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  cardContentHidden: {
    opacity: 0.4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    flexWrap: 'nowrap',
  },
  productName: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  brand: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  separator: {
    height: space[2],
  },
});

const emptyStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingHorizontal: space[8],
    paddingTop: space[12],
  },
});
