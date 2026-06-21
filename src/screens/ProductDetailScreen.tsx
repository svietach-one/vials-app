import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { DeleteProductModal } from '@/components/product/DeleteProductModal';
import { ProductActionSheet } from '@/components/product/ProductActionSheet';
import { Button } from '@/components/ui/core/Button';
import { IconButton } from '@/components/ui/core/IconButton';
import { InlineAlert } from '@/components/ui/feedback/InlineAlert';
import { Tag } from '@/components/ui/core/Tag';
import { colors, space, typography } from '@/constants/tokens';
import { ACTIVE_INGREDIENT_LABELS, PRODUCT_TYPE_LABELS } from '@/constants/labels';
import type { CatalogStackParamList } from '@/navigation/AppNavigator';
import { useProductsStore } from '@/store/productsStore';
import type { ActiveIngredientKey, Product } from '@/types';

type Props = NativeStackScreenProps<CatalogStackParamList, 'ProductDetail'>;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProductDetailScreen({ route, navigation }: Props) {
  const { productId } = route.params;
  const products = useProductsStore((s) => s.products);
  const updateProduct = useProductsStore((s) => s.updateProduct);
  const removeProduct = useProductsStore((s) => s.removeProduct);

  const product = products.find((p) => p.id === productId) ?? null;

  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  // Wire the three-dot button into the navigation header
  useEffect(() => {
    if (!product) return;
    navigation.setOptions({
      title: product.name,
      headerRight: () => (
        <IconButton
          icon={<Feather name="more-vertical" size={20} color={colors.textPrimary} />}
          label="Product options"
          variant="ghost"
          size="sm"
          onPress={() => setActionSheetVisible(true)}
          style={styles.headerBtn}
        />
      ),
    });
  }, [navigation, product]);

  // ── Not found guard ───────────────────────────────────────────────────────

  if (!product) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.notFoundWrap}>
          <InlineAlert tone="sos" title="Product not found">
            This product may have been deleted from your catalog.
          </InlineAlert>
          <Button variant="secondary" onPress={() => navigation.goBack()}>
            Go Back
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // Resolve active tags: use saved activeTags; fall back to activeIngredients keys
  // for products saved before activeTags was introduced.
  const activeTags: ActiveIngredientKey[] =
    product.activeTags ?? product.activeIngredients.map((i) => i.key);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleDeleteConfirm() {
    if (deleteTarget) {
      removeProduct(deleteTarget.id);
      setDeleteTarget(null);
      navigation.goBack();
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header block ──────────────────────────────────────────────── */}
        <View style={styles.headerBlock}>
          {product.brand ? (
            <Text style={styles.brand}>{product.brand}</Text>
          ) : null}
          <Text style={styles.productName}>{product.name}</Text>
          <Tag tone="neutral">
            {PRODUCT_TYPE_LABELS[product.productType] ?? product.productType}
          </Tag>
        </View>

        {/* ── Active Ingredients ────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Active Ingredients</Text>
          {activeTags.length > 0 ? (
            <View style={styles.tagWrap}>
              {activeTags.map((key) => (
                <Tag key={key} tone="info">
                  {ACTIVE_INGREDIENT_LABELS[key] ?? key}
                </Tag>
              ))}
            </View>
          ) : (
            <Tag tone="neutral">None confirmed</Tag>
          )}
        </View>

        {/* ── Full Formula ─────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Full Formula</Text>
          {product.fullIngredientText ? (
            <Text style={styles.formulaText}>{product.fullIngredientText}</Text>
          ) : (
            <Text style={styles.emptyText}>Not available</Text>
          )}
        </View>

        {/* ── Notes ───────────────────────────────────────────────────── */}
        {product.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Notes</Text>
            <Text style={styles.formulaText}>{product.notes}</Text>
          </View>
        ) : null}
      </ScrollView>

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
        onClose={() => setActionSheetVisible(false)}
      />

      <DeleteProductModal
        product={deleteTarget}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </SafeAreaView>
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
  notFoundWrap: {
    flex: 1,
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[8],
    gap: space[4],
  },
  content: {
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[6],
    paddingBottom: space[12],
    gap: space[6],
  },
  headerBlock: {
    gap: space[2],
  },
  brand: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  productName: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  section: {
    gap: space[3],
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
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
