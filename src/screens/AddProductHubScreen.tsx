import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AddProductModal } from '@/components/product/AddProductModal';
import type { RoutineTarget } from '@/components/product/AddProductModal';
import { Button } from '@/components/ui/core/Button';
import { Input } from '@/components/ui/forms/Input';
import { colors, radius, space, typography } from '@/constants/tokens';
import type { CatalogStackParamList } from '@/navigation/AppNavigator';
import { searchProducts } from '@/services/openBeautyFacts/search';
import type { OBFProduct } from '@/services/openBeautyFacts/types';
import { useProductsStore } from '@/store/productsStore';
import { useRoutinesStore } from '@/store/routinesStore';
import { generateId } from '@/utils/generateId';
import type { Product, RoutineStep } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<CatalogStackParamList, 'AddProductHub'>;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AddProductHubScreen({ navigation }: Props) {
  const addProduct = useProductsStore((s) => s.addProduct);
  const routines = useRoutinesStore((s) => s.routines);
  const updateRoutine = useRoutinesStore((s) => s.updateRoutine);

  // OBF search
  const [searchText, setSearchText] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchResults, setSearchResults] = useState<OBFProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);

  // Add modal
  const [modalVisible, setModalVisible] = useState(false);
  const [prefillOBF, setPrefillOBF] = useState<OBFProduct | null>(null);

  // Debounce
  useEffect(() => {
    if (searchText.trim().length < 3) {
      setSearchResults([]);
      setDebouncedQuery('');
      setSearchFailed(false);
      return;
    }
    const t = setTimeout(() => setDebouncedQuery(searchText.trim()), 600);
    return () => clearTimeout(t);
  }, [searchText]);

  // Fetch from OBF
  useEffect(() => {
    if (!debouncedQuery) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    searchProducts(debouncedQuery).then(({ products, failed }) => {
      if (!cancelled) {
        setSearchResults(products);
        setSearchFailed(failed);
        setSearching(false);
      }
    });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  // ── Routine linking (Blocker 1 fix: preserved from original ProductsScreen) ─

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
    addProduct(product);
    addProductToRoutine(product, routineTarget);
    setModalVisible(false);
    setPrefillOBF(null);
    navigation.goBack();
  }

  function openWithOBF(item: OBFProduct) {
    setPrefillOBF(item);
    setModalVisible(true);
  }

  function openManual() {
    setPrefillOBF(null);
    setModalVisible(true);
  }

  function closeModal() {
    setModalVisible(false);
    setPrefillOBF(null);
  }

  const hasTypedEnough = searchText.trim().length >= 3;
  const showNotFound = hasTypedEnough && !searching && !searchFailed && searchResults.length === 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {/* ── OBF Search ─────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Search Database</Text>
        <Input
          icon={<Feather name="search" size={16} color={colors.textTertiary} />}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search Open Beauty Facts…"
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoFocus
        />

        {/* Results area */}
        {searching ? (
          <ActivityIndicator
            size="small"
            color={colors.textSecondary}
            style={styles.loader}
          />
        ) : hasTypedEnough && searchFailed ? (
          <Text style={styles.hint}>
            Search unavailable — add your product manually below.
          </Text>
        ) : searchResults.length > 0 ? (
          <View style={styles.resultList}>
            {searchResults.map((item) => (
              <Pressable
                key={item.obfId || item.name}
                style={({ pressed }) => [
                  styles.resultRow,
                  pressed && styles.resultRowPressed,
                ]}
                onPress={() => openWithOBF(item)}
                accessibilityRole="button"
                accessibilityLabel={`Add ${item.name}`}
              >
                <View style={styles.resultContent}>
                  <Text style={styles.resultName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.brand ? (
                    <Text style={styles.resultBrand} numberOfLines={1}>
                      {item.brand}
                    </Text>
                  ) : null}
                </View>
                <Feather name="plus" size={18} color={colors.textSecondary} />
              </Pressable>
            ))}
          </View>
        ) : showNotFound ? (
          <View style={styles.notFoundWrap}>
            <Text style={styles.hint}>
              No results for "{searchText.trim()}"
            </Text>
            <Button variant="secondary" onPress={openManual}>
              Add Manually
            </Button>
          </View>
        ) : null}

        {/* ── Scan Barcode ───────────────────────────────────────────────── */}
        <View style={styles.divider} />
        <Text style={styles.sectionLabel}>Scan</Text>
        <Pressable
          style={({ pressed }) => [
            styles.actionRow,
            pressed && styles.actionRowPressed,
          ]}
          onPress={() => navigation.navigate('BarcodeScanner')}
          accessibilityRole="button"
          accessibilityLabel="Scan product barcode"
        >
          <View style={styles.actionIconWrap}>
            <Feather name="aperture" size={20} color={colors.textPrimary} />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Scan Barcode</Text>
            <Text style={styles.actionSubtitle}>Look up product by barcode</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.textTertiary} />
        </Pressable>

        {/* ── Manual Entry ───────────────────────────────────────────────── */}
        <View style={styles.divider} />
        <Text style={styles.sectionLabel}>Manual Entry</Text>
        <Button variant="secondary" fullWidth onPress={openManual}>
          Create Product Manually
        </Button>
      </ScrollView>

      <AddProductModal
        visible={modalVisible}
        prefillOBFProduct={prefillOBF}
        onClose={closeModal}
        onSave={handleSave}
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
  content: {
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[5],
    paddingBottom: space[12],
    gap: space[3],
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: -space[1],
  },
  loader: {
    marginVertical: space[4],
  },
  hint: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingVertical: space[2],
  },
  resultList: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderDivider,
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    gap: space[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDivider,
  },
  resultRowPressed: {
    backgroundColor: colors.surfaceSunken,
  },
  resultContent: {
    flex: 1,
    gap: 2,
  },
  resultName: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  resultBrand: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  notFoundWrap: {
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[2],
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderDivider,
    marginVertical: space[2],
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderDivider,
    backgroundColor: colors.surfaceCard,
  },
  actionRowPressed: {
    backgroundColor: colors.surfaceSunken,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderDivider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionContent: {
    flex: 1,
    gap: 2,
  },
  actionTitle: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  actionSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
