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
import { Button } from '@/components/ui/core/Button';
import { Card } from '@/components/ui/core/Card';
import { IconButton } from '@/components/ui/core/IconButton';
import { Tag } from '@/components/ui/core/Tag';
import { Input } from '@/components/ui/forms/Input';
import { colors, space, typography } from '@/constants/tokens';
import { ACTIVE_INGREDIENT_LABELS, PRODUCT_TYPE_LABELS } from '@/constants/labels';
import type { CatalogStackParamList } from '@/navigation/AppNavigator';
import { useProductsStore } from '@/store/productsStore';
import type { Product } from '@/types';

type Props = NativeStackScreenProps<CatalogStackParamList, 'Catalog'>;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CatalogScreen({ navigation }: Props) {
  const products = useProductsStore((s) => s.products);
  const updateProduct = useProductsStore((s) => s.updateProduct);
  const removeProduct = useProductsStore((s) => s.removeProduct);

  const [searchText, setSearchText] = useState('');
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

  function handleDeleteConfirm() {
    if (deleteTarget) {
      removeProduct(deleteTarget.id);
      setDeleteTarget(null);
    }
  }

  // ── Render item ───────────────────────────────────────────────────────────

  function renderItem({ item }: { item: Product }) {
    return (
      <Card
        variant="surface"
        padding="sm"
        interactive
        onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
        style={styles.card}
      >
        <View style={styles.cardInner}>
          <View style={styles.cardContent}>
            <View style={styles.nameRow}>
              <Text style={styles.productName} numberOfLines={1}>
                {item.name}
              </Text>
              <Tag tone="neutral">
                {PRODUCT_TYPE_LABELS[item.productType] ?? item.productType}
              </Tag>
            </View>
            {item.brand ? (
              <Text style={styles.brand} numberOfLines={1}>
                {item.brand}
              </Text>
            ) : null}
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
          navigation.navigate('ManualProductForm', { editingProductId: p.id });
        }}
        onDelete={(p) => {
          setActionTarget(null);
          setDeleteTarget(p);
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
