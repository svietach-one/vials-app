import React, { useState } from 'react';
import {
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { DeleteProductModal } from '@/components/product/DeleteProductModal';
import { ProductActionSheet } from '@/components/product/ProductActionSheet';
import { ProductShelfCard } from '@/components/product/ProductShelfCard';
import { CatalogFilterHeader } from '@/components/catalog/CatalogFilterHeader';
import { RoutineSchedulerSheet } from '@/components/routine/RoutineSchedulerSheet';
import { AppHeader } from '@/components/ui/core/AppHeader';
import { Button } from '@/components/ui/core/Button';
import { Card } from '@/components/ui/core/Card';
import { IconButton } from '@/components/ui/core/IconButton';
import { Badge } from '@/components/ui/feedback/Badge';
import { Tag } from '@/components/ui/core/Tag';
import { Input } from '@/components/ui/forms/Input';
import { colors, space, typography } from '@/constants/tokens';
import { ACTIVE_INGREDIENT_LABELS, PRODUCT_TYPE_LABELS } from '@/constants/labels';
import type { CatalogStackParamList } from '@/navigation/AppNavigator';
import { useProductsStore } from '@/store/productsStore';
import { useRoutinesStore } from '@/store/routinesStore';
import type {
  ActiveIngredientKey,
  BiomarkerTag,
  CatalogFilterState,
  Product,
  ProductType,
} from '@/types';
import { CATALOG_FILTER_DEFAULT } from '@/types';
import { getProductRoutineStatus, type RoutineStatusResult } from '@/utils/routineStatus';
import { getProductPaoStatus } from '@/utils/paoHelpers';
import { formatScheduleDays } from '@/utils/routineLabel';

type Props = NativeStackScreenProps<CatalogStackParamList, 'Catalog'>;

// ─── Module-level filter constants ────────────────────────────────────────────

const ACTIVES_KEYS: ActiveIngredientKey[] = ['retinol', 'aha', 'bha', 'vitamin_c', 'benzoyl_peroxide'];
const SOOTHING_KEYS: ActiveIngredientKey[] = ['niacinamide', 'copper_peptides'];
const HYDRATION_TYPES: ProductType[] = ['moisturizer', 'cream', 'lotion', 'oil', 'essence', 'toner'];

const PAO_AMBER = '#D97706';

// ─── applyFilters ─────────────────────────────────────────────────────────────

export function applyFilters(
  products: Product[],
  { searchQuery, selectedCategory, selectedBiomarkers }: CatalogFilterState,
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

    // Gate 3 — biomarkers (ALL selected must pass)
    for (const biomarker of selectedBiomarkers) {
      if (biomarker === 'Actives') {
        if (!(p.activeTags ?? []).some((k) => ACTIVES_KEYS.includes(k))) return false;
      }
      if (biomarker === 'Soothing') {
        if (!(p.activeTags ?? []).some((k) => SOOTHING_KEYS.includes(k))) return false;
      }
      if (biomarker === 'Hydration') {
        if (!HYDRATION_TYPES.includes(p.productType)) return false;
      }
    }

    return true;
  });
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CatalogScreen({ navigation }: Props) {
  const products = useProductsStore((s) => s.products);
  const updateProduct = useProductsStore((s) => s.updateProduct);
  const removeProduct = useProductsStore((s) => s.removeProduct);
  const routines = useRoutinesStore((s) => s.routines);

  const [filterState, setFilterState] = useState<CatalogFilterState>(CATALOG_FILTER_DEFAULT);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [schedulerTarget, setSchedulerTarget] = useState<Product | null>(null);

  const filteredProducts = applyFilters(products, filterState);
  const hasActiveFilters =
    filterState.searchQuery.trim() !== '' ||
    filterState.selectedCategory !== 'All' ||
    filterState.selectedBiomarkers.length > 0;

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleDeleteConfirm() {
    if (deleteTarget) {
      removeProduct(deleteTarget.id);
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
          updateProduct(p.id, { isHidden: true });
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
          <IconButton
            icon={<Feather name="plus" size={20} color={colors.textOnDark} />}
            label="Add product"
            variant="filled"
            size="sm"
            round
            onPress={() => navigation.navigate('AddProductHub')}
          />
        }
      />
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          filteredProducts.length === 0 && styles.listContentEmpty,
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.searchWrap}>
            <Input
              icon={<Feather name="search" size={15} color={colors.textTertiary} />}
              value={filterState.searchQuery}
              onChangeText={(t) => setFilterState((s) => ({ ...s, searchQuery: t }))}
              placeholder="Search by name, brand or ingredient…"
              clearButtonMode="while-editing"
              returnKeyType="search"
              containerStyle={styles.searchInput}
            />
            <CatalogFilterHeader filterState={filterState} onFilterChange={setFilterState} />
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
    </SafeAreaView>
  );
}

// ─── Routine badge ────────────────────────────────────────────────────────────

function RoutineBadge({ status }: { status: RoutineStatusResult }) {
  if (status === 'none') return null;
  const label =
    status === 'both' ? 'AM · PM' : status === 'morning' ? 'AM' : 'PM';
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
      <Feather name="alert-triangle" size={12} color={PAO_AMBER} />
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
      <Feather name="package" size={32} color={colors.textTertiary} />
      <Text style={emptyStyles.title}>{title}</Text>
      <Text style={emptyStyles.body}>{body}</Text>
      {!hasProducts ? (
        <Button
          variant="primary"
          size="lg"
          icon={<Feather name="plus" size={16} color={colors.textOnDark} />}
          onPress={onAdd}
          style={emptyStyles.addBtn}
        >
          Add Product
        </Button>
      ) : null}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  searchWrap: {
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[4],
    paddingBottom: space[3],
  },
  searchInput: {
    marginBottom: space[2],
  },
  listContent: {
    paddingHorizontal: space.gutterScreen,
    paddingBottom: space[12],
  },
  listContentEmpty: {
    flexGrow: 1,
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[8],
    gap: space[3],
    paddingTop: space[12],
  },
  title: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  body: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  addBtn: {
    marginTop: space[2],
  },
});
