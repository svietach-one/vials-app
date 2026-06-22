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

import { AddProductModal } from '@/components/product/AddProductModal';
import { DeleteProductModal } from '@/components/product/DeleteProductModal';
import { ProductActionSheet } from '@/components/product/ProductActionSheet';
import { Button } from '@/components/ui/core/Button';
import { Card } from '@/components/ui/core/Card';
import { IconButton } from '@/components/ui/core/IconButton';
import { Tag } from '@/components/ui/core/Tag';
import { Input } from '@/components/ui/forms/Input';
import { colors, space, typography } from '@/constants/tokens';
import { ACTIVE_INGREDIENT_LABELS, PRODUCT_TYPE_LABELS } from '@/constants/labels';
import type { CatalogStackParamList } from '@/navigation/AppNavigator';
import { useProductsStore } from '@/store/productsStore';
import { useRoutinesStore } from '@/store/routinesStore';
import type { Product } from '@/types';
import { getProductRoutineStatus, type RoutineStatusResult } from '@/utils/routineStatus';

type Props = NativeStackScreenProps<CatalogStackParamList, 'Catalog'>;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CatalogScreen({ navigation }: Props) {
  const products = useProductsStore((s) => s.products);
  const updateProduct = useProductsStore((s) => s.updateProduct);
  const removeProduct = useProductsStore((s) => s.removeProduct);
  const routines = useRoutinesStore((s) => s.routines);

  const [searchText, setSearchText] = useState('');
  const [actionTarget, setActionTarget] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
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

  // Filter on name, brand, and validated activeTags (reliable — no raw text search)
  const query = searchText.trim().toLowerCase();
  const filteredProducts = query
    ? products.filter((p) => {
        if (p.name.toLowerCase().includes(query)) return true;
        if ((p.brand ?? '').toLowerCase().includes(query)) return true;
        return (p.activeTags ?? []).some((key) =>
          ACTIVE_INGREDIENT_LABELS[key]?.toLowerCase().includes(query),
        );
      })
    : products;

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleEditSave(product: Product) {
    updateProduct(product.id, product);
    setEditModalVisible(false);
    setEditingProduct(null);
  }

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
          </View>

          {/* Three-dot — sibling of cardContent, always opacity 1 even on hidden cards */}
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
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search by name, brand or ingredient…"
              clearButtonMode="while-editing"
              returnKeyType="search"
            />
          </View>
        }
        ListEmptyComponent={
          <CatalogEmptyState
            hasProducts={products.length > 0}
            onAdd={() => navigation.navigate('AddProductHub')}
          />
        }
      />

      <ProductActionSheet
        product={actionTarget}
        onEdit={(p) => {
          setActionTarget(null);
          setEditingProduct(p);
          setEditModalVisible(true);
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

      {/* Edit modal — only for editing existing products; adding goes via Hub */}
      <AddProductModal
        visible={editModalVisible}
        editingProduct={editingProduct}
        onClose={() => {
          setEditModalVisible(false);
          setEditingProduct(null);
        }}
        onSave={(product) => handleEditSave(product)}
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
  return (
    <View style={badgeStyles.pill}>
      {(status === 'morning' || status === 'both') && (
        <Feather name="sun" size={13} color={colors.textSecondary} />
      )}
      {(status === 'evening' || status === 'both') && (
        <Feather name="moon" size={13} color={colors.textSecondary} />
      )}
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: space[2],
    paddingVertical: 3,
    borderRadius: 99,
    backgroundColor: colors.borderDivider,
  },
});

// ─── Empty state ──────────────────────────────────────────────────────────────

function CatalogEmptyState({
  hasProducts,
  onAdd,
}: {
  hasProducts: boolean;
  onAdd: () => void;
}) {
  return (
    <View style={emptyStyles.wrap}>
      <Feather name="package" size={32} color={colors.textTertiary} />
      <Text style={emptyStyles.title}>
        {hasProducts ? 'No matching products' : 'Your catalog is empty'}
      </Text>
      <Text style={emptyStyles.body}>
        {hasProducts
          ? 'Try a different name, brand, or ingredient.'
          : 'Add your first product by searching Open Beauty Facts, scanning a barcode, or entering it manually.'}
      </Text>
      {!hasProducts ? (
        <Button
          variant="primary"
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
