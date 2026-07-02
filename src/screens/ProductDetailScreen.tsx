import React, { useState } from 'react';
import {
  Pressable,
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
import { RemoveRoutineActionSheet } from '@/components/routine/RemoveRoutineActionSheet';
import { RoutineSchedulerSheet } from '@/components/routine/RoutineSchedulerSheet';
import { AppHeader } from '@/components/ui/core/AppHeader';
import { Button } from '@/components/ui/core/Button';
import { IconButton } from '@/components/ui/core/IconButton';
import { InlineAlert } from '@/components/ui/feedback/InlineAlert';
import { Tag } from '@/components/ui/core/Tag';
import { colors, space, typography } from '@/constants/tokens';
import { ACTIVE_INGREDIENT_LABELS, PRODUCT_TYPE_LABELS } from '@/constants/labels';
import type { CatalogStackParamList } from '@/navigation/AppNavigator';
import { useProductsStore } from '@/store/productsStore';
import { useRoutinesStore } from '@/store/routinesStore';
import { deriveProductSchedule, formatRoutineLabel } from '@/utils/routineLabel';
import type { ActiveIngredientKey, Product } from '@/types';

type Props = NativeStackScreenProps<CatalogStackParamList, 'ProductDetail'>;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProductDetailScreen({ route, navigation }: Props) {
  const { productId } = route.params;
  const products = useProductsStore((s) => s.products);
  const updateProduct = useProductsStore((s) => s.updateProduct);
  const removeProduct = useProductsStore((s) => s.removeProduct);

  const product = products.find((p) => p.id === productId) ?? null;

  const routines = useRoutinesStore((s) => s.routines);

  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [schedulerVisible, setSchedulerVisible] = useState(false);
  const [removeSheetVisible, setRemoveSheetVisible] = useState(false);

  // ── Not found guard ───────────────────────────────────────────────────────

  if (!product) {
    return (
      <SafeAreaView style={styles.safe}>
        <AppHeader
          title="Product"
          leftAction={
            <IconButton
              icon={<Feather name="arrow-left" size={20} color={colors.textPrimary} />}
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
      <AppHeader
        title={product.name}
        leftAction={
          <IconButton
            icon={<Feather name="arrow-left" size={20} color={colors.textPrimary} />}
            label="Back"
            variant="ghost"
            size="sm"
            onPress={() => navigation.goBack()}
          />
        }
        rightAction={
          <IconButton
            icon={<Feather name="more-vertical" size={20} color={colors.textPrimary} />}
            label="Product options"
            variant="ghost"
            size="sm"
            onPress={() => setActionSheetVisible(true)}
          />
        }
      />
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
          <Pressable
            style={styles.removeLink}
            onPress={() => setRemoveSheetVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Remove from routine"
          >
            <Text style={styles.removeLinkText}>Remove from Routine</Text>
          </Pressable>
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
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgBase,
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
    backgroundColor: colors.bgBase,
    gap: space[3],
  },
  removeLink: {
    alignItems: 'center',
    paddingVertical: space[2],
  },
  removeLinkText: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: colors.statusSOS,
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
