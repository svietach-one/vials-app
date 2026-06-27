import React, { useEffect, useState } from 'react';
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
import { CatalogFilterHeader } from '@/components/catalog/CatalogFilterHeader';
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
  CategoryFilter,
  Product,
  ProductType,
} from '@/types';
import { CATALOG_FILTER_DEFAULT } from '@/types';
import { getProductRoutineStatus, type RoutineStatusResult } from '@/utils/routineStatus';
import { getProductPaoStatus } from '@/utils/paoHelpers';

type Props = NativeStackScreenProps<CatalogStackParamList, 'Catalog'>;

// ─── Module-level filter constants ────────────────────────────────────────────

const CATEGORY_PRODUCT_TYPES: Record<Exclude<CategoryFilter, 'All'>, ProductType[]> = {
  Serums:       ['serum', 'essence', 'ampoule'],
  Moisturizers: ['moisturizer', 'cream', 'lotion', 'oil'],
  SPF:          ['spf'],
};

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
    if (selectedCategory !== 'All') {
      const allowed = CATEGORY_PRODUCT_TYPES[selectedCategory];
      if (!allowed.includes(p.productType)) return false;
    }

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
  const [actionTarget, setActionTarget] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  // Header "+" button — navigates to the Add Product Hub
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <IconButton
          icon={<Feather name="plus" size={20} color={colors.textOnDark} />}
          label="Add product"
          variant="filled"
          size="sm"
          round
          onPress={() => navigation.navigate('AddProductHub')}
          style={styles.headerBtn}
        />
      ),
    });
  }, [navigation]);

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
    const routineStatus = getProductRoutineStatus(item.id, routines);
    return (
      <Card
        variant="surface"
        padding="sm"
        interactive
        onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
        style={styles.card}
      >
        <View style={styles.cardInner}>
          {/* Content layer — dimmed independently so the three-dot button stays opaque */}
          <View style={[styles.cardContent, item.isHidden && styles.cardContentHidden]}>
            <View style={styles.nameRow}>
              {item.isHidden ? (
                <Feather name="eye-off" size={12} color={colors.textTertiary} />
              ) : null}
              <Text style={styles.productName} numberOfLines={1}>
                {item.name}
              </Text>
              <Tag tone="neutral">
                {PRODUCT_TYPE_LABELS[item.productType] ?? item.productType}
              </Tag>
              <RoutineBadge status={routineStatus} />
            </View>
            {item.brand ? (
              <Text style={styles.brand} numberOfLines={1}>
                {item.brand}
              </Text>
            ) : null}
            <PaoChip product={item} />
          </View>

          {/* Three-dot — inner Pressable captures the responder; card onPress won't fire */}
          <IconButton
            icon={<Feather name="more-vertical" size={18} color={colors.textSecondary} />}
            label={`Options for ${item.name}`}
            variant="ghost"
            size="sm"
            onPress={() => setActionTarget(item)}
          />
        </View>
      </Card>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
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

      <ProductActionSheet
        product={actionTarget}
        onEdit={(p) => {
          setActionTarget(null);
          navigation.navigate('ManualProductForm', { editingProductId: p.id });
        }}
        onDelete={(p) => {
          setActionTarget(null);
          setDeleteTarget(p);
        }}
        onToggleHidden={(p) => {
          updateProduct(p.id, { isHidden: !p.isHidden });
          setActionTarget(null);
        }}
        onClose={() => setActionTarget(null)}
      />

      <DeleteProductModal
        product={deleteTarget}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </SafeAreaView>
  );
}

// ─── Routine badge ────────────────────────────────────────────────────────────

function RoutineBadge({ status }: { status: RoutineStatusResult }) {
  if (status === 'none') return null;
  const label =
    status === 'both' ? 'AM · PM' : status === 'morning' ? 'AM' : 'PM';
  return <Badge status="Default" type="Outline">{label}</Badge>;
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
  headerBtn: {
    marginRight: space.gutterScreen,
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
