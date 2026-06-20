import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
// This file is superseded by CatalogScreen.tsx and kept only for reference.
// AppNavigator.tsx now imports CatalogScreen directly.

import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import { AddProductModal } from '@/components/product/AddProductModal';
import type { RoutineTarget } from '@/components/product/AddProductModal';
import { DeleteProductModal } from '@/components/product/DeleteProductModal';
import { Input } from '@/components/ui/forms/Input';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import { useProductsStore } from '@/store/productsStore';
import { useRoutinesStore } from '@/store/routinesStore';
import { generateId } from '@/utils/generateId';
import type { Product, RoutineStep } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = BottomTabScreenProps<{ Vials: undefined }, 'Vials'>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  cleanser: 'Cleanser',
  toner: 'Toner',
  essence: 'Essence',
  serum: 'Serum',
  gel: 'Gel',
  moisturizer: 'Moisturizer',
  oil: 'Oil',
  spf: 'SPF',
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProductsScreen({ navigation }: Props) {
  const products = useProductsStore((s) => s.products);
  const addProduct = useProductsStore((s) => s.addProduct);
  const updateProduct = useProductsStore((s) => s.updateProduct);
  const removeProduct = useProductsStore((s) => s.removeProduct);

  const routines = useRoutinesStore((s) => s.routines);
  const updateRoutine = useRoutinesStore((s) => s.updateRoutine);

  const [searchText, setSearchText] = useState('');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  // Header "+" button
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => {
            setEditingProduct(null);
            setAddModalVisible(true);
          }}
          style={styles.headerBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Add product"
        >
          <Feather name="plus" size={22} color={palette.black} />
        </Pressable>
      ),
    });
  }, [navigation]);

  // Filter locally
  const query = searchText.trim().toLowerCase();
  const filteredProducts = query
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          (p.brand ?? '').toLowerCase().includes(query),
      )
    : products;

  // ── Routine linking ───────────────────────────────────────────────────────

  function addProductToRoutine(product: Product, target: RoutineTarget) {
    if (target === 'none') return;

    function makeStep(): RoutineStep {
      return {
        id: generateId(),
        productType: product.productType,
        productId: product.id,
        hidden: false,
        scheduledDays: [],
      };
    }

    if (target === 'morning' || target === 'both') {
      const r = routines.find((x) => x.timeOfDay === 'morning');
      if (r) updateRoutine(r.id, { steps: [...r.steps, makeStep()] });
    }
    if (target === 'evening' || target === 'both') {
      const r = routines.find((x) => x.timeOfDay === 'evening');
      if (r) updateRoutine(r.id, { steps: [...r.steps, makeStep()] });
    }
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleSave(product: Product, routineTarget: RoutineTarget) {
    if (editingProduct) {
      updateProduct(product.id, product);
    } else {
      addProduct(product);
      addProductToRoutine(product, routineTarget);
    }
    setAddModalVisible(false);
    setEditingProduct(null);
  }

  function handleEdit(product: Product) {
    setEditingProduct(product);
    setAddModalVisible(true);
  }

  function handleDeleteConfirm() {
    if (deleteTarget) {
      removeProduct(deleteTarget.id);
      setDeleteTarget(null);
    }
  }

  // ── Render item ───────────────────────────────────────────────────────────

  function renderItem({ item }: { item: Product }) {
    return (
      <Pressable
        style={({ pressed }) => [cardStyles.row, pressed && cardStyles.rowPressed]}
        onPress={() => handleEdit(item)}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, edit product`}
      >
        {/* Left content */}
        <View style={cardStyles.content}>
          <View style={cardStyles.nameRow}>
            <Text style={cardStyles.name} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={cardStyles.typePill}>
              <Text style={cardStyles.typeText}>
                {PRODUCT_TYPE_LABELS[item.productType] ?? item.productType}
              </Text>
            </View>
          </View>

          {item.brand ? (
            <Text style={cardStyles.brand} numberOfLines={1}>
              {item.brand}
            </Text>
          ) : null}

          {item.activeIngredients.length > 0 ? (
            <Text style={cardStyles.ingredients} numberOfLines={1}>
              {item.activeIngredients.map((a) => a.displayName).join(' · ')}
            </Text>
          ) : null}
        </View>

        {/* Right actions */}
        <View style={cardStyles.actions}>
          <Pressable
            onPress={() => handleEdit(item)}
            style={cardStyles.actionBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.name}`}
          >
            <Feather name="edit-2" size={15} color={colors.textTertiary} />
          </Pressable>
          <Pressable
            onPress={() => setDeleteTarget(item)}
            style={cardStyles.actionBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${item.name}`}
          >
            <Feather name="trash-2" size={15} color={colors.textTertiary} />
          </Pressable>
        </View>
      </Pressable>
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
        ListHeaderComponent={
          <View style={styles.searchWrap}>
            <Input
              icon={<Feather name="search" size={15} color={colors.textTertiary} />}
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search your catalog…"
              clearButtonMode="while-editing"
              returnKeyType="search"
            />
          </View>
        }
        ListEmptyComponent={
          <CatalogEmptyState
            hasProducts={products.length > 0}
            onAdd={() => {
              setEditingProduct(null);
              setAddModalVisible(true);
            }}
          />
        }
      />

      <AddProductModal
        visible={addModalVisible}
        editingProduct={editingProduct}
        onClose={() => {
          setAddModalVisible(false);
          setEditingProduct(null);
        }}
        onSave={handleSave}
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
          ? 'Try a different name or brand.'
          : 'Add your first product by searching Open Beauty Facts or entering it manually.'}
      </Text>
      {!hasProducts ? (
        <Pressable
          onPress={onAdd}
          style={emptyStyles.addBtn}
          accessibilityRole="button"
          accessibilityLabel="Add first product"
        >
          <Feather name="plus" size={16} color={palette.white} />
          <Text style={emptyStyles.addBtnLabel}>Add Product</Text>
        </Pressable>
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
    paddingRight: space.gutterScreen,
  },
  searchWrap: {
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[4],
    paddingBottom: space[2],
  },
  listContent: {
    paddingBottom: space[12],
  },
  listContentEmpty: {
    flexGrow: 1,
  },
});

const cardStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.gutterScreen,
    paddingVertical: space[3] + 2,
    gap: space[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDivider,
    backgroundColor: colors.bgBase,
  },
  rowPressed: {
    backgroundColor: colors.surfaceSunken,
  },
  content: {
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
  name: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  typePill: {
    paddingHorizontal: space[2],
    paddingVertical: 2,
    borderRadius: radius.xs,
    backgroundColor: colors.surfaceSunken,
    flexShrink: 0,
  },
  typeText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  brand: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  ingredients: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    flexShrink: 0,
  },
  actionBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSunken,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[5],
    paddingVertical: space[3],
    borderRadius: radius.md,
    backgroundColor: palette.black,
    marginTop: space[2],
  },
  addBtnLabel: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: palette.white,
  },
});
