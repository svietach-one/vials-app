import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '@/components/ui/core/Button';
import { Card } from '@/components/ui/core/Card';
import { Input } from '@/components/ui/forms/Input';
import { colors, radius, space, typography } from '@/constants/tokens';
import { useProductRepository } from '@/hooks/useCorpusRepositories';
import type { CorpusProduct } from '@/services/corpus/types';
import { useProductsStore } from '@/store/productsStore';
import { useProfileStore } from '@/store/profileStore';
import type { Product } from '@/types';
import { generateId } from '@/utils/generateId';
import { resolveProductType } from '@/utils/productType';
import type { OnboardingStackParamList } from '@/navigation/AppNavigator';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<OnboardingStackParamList, 'FirstProduct'>;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FirstProductScreen({ navigation: _navigation }: Props) {
  const addProduct = useProductsStore((s) => s.addProduct);
  const updateProfile = useProfileStore((s) => s.updateProfile);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CorpusProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const productRepository = useProductRepository();

  async function handleSearch(text: string) {
    setQuery(text);
    if (text.trim().length < 3 || !productRepository) {
      setResults([]);
      return;
    }
    setSearching(true);
    const products = await productRepository.search(text);
    setResults(products);
    setSearching(false);
  }

  async function handleSelect(item: CorpusProduct) {
    const activeTags = productRepository ? await productRepository.getActiveKeys(item.uid) : [];
    const product: Product = {
      id: generateId(),
      name: item.name,
      brand: item.brand || null,
      productType: resolveProductType(item.type),
      imageUrl: item.imageUrl,
      activeIngredients: [],
      activeTags,
      fullIngredientText: item.inciRaw || null,
      usageTime: 'both',
      openBeautyFactsId: item.source === 'obf_import' ? item.uid : null,
      addedAt: new Date().toISOString(),
      notes: null,
      openedDate: null,
      paoMonths: null,
      source: item.obfId ? 'obf_import' : 'user_local',
    };
    addProduct(product);
    completeOnboarding();
  }

  function completeOnboarding() {
    updateProfile({ onboardingCompleted: true });
    // AppNavigator re-renders automatically when the store updates
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Step 2 of 2</Text>
          <Text style={styles.title}>Add your first{'\n'}product.</Text>
          <Text style={styles.subtitle}>
            Search by name or brand to pull in ingredients automatically.
          </Text>
        </View>

        {/* Search input */}
        <View style={styles.searchWrap}>
          <Input
            label="Product name or brand"
            value={query}
            onChangeText={handleSearch}
            placeholder="e.g. The Ordinary Niacinamide"
            icon={<Feather name="search" size={16} color={colors.textTertiary} />}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
        </View>

        {/* Results / states */}
        <View style={styles.resultsArea}>
          {searching ? (
            <ActivityIndicator
              size="small"
              color={colors.textSecondary}
              style={styles.spinner}
            />
          ) : results.length > 0 ? (
            <FlatList
              data={results}
              keyExtractor={(item) => item.uid}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListFooterComponent={
                results.some((r) => r.source === 'obf_import') ? (
                  <Text style={styles.attribution}>
                    Product data from Open Beauty Facts (ODbL)
                  </Text>
                ) : null
              }
              renderItem={({ item }) => (
                <Pressable onPress={() => handleSelect(item)}>
                  {({ pressed }) => (
                    <Card
                      variant="flat"
                      padding="sm"
                      style={[styles.resultCard, pressed && styles.resultCardPressed]}
                    >
                      <Text style={styles.resultName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {item.brand ? (
                        <Text style={styles.resultBrand} numberOfLines={1}>
                          {item.brand}
                        </Text>
                      ) : null}
                    </Card>
                  )}
                </Pressable>
              )}
            />
          ) : query.length >= 3 && !searching ? (
            <View style={styles.emptyState}>
              <Feather name="inbox" size={32} color={colors.textTertiary} />
              <Text style={styles.emptyText}>No results found.</Text>
              <Text style={styles.emptySubtext}>
                You can add products manually from the Catalog tab.
              </Text>
            </View>
          ) : null}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onPress={completeOnboarding}
          >
            Skip for now
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  flex: { flex: 1 },

  header: {
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[6],
    gap: space[2],
    marginBottom: space[5],
  },
  eyebrow: { ...typography.label, color: colors.textSecondary },
  title: { ...typography.h1, color: colors.textPrimary },
  subtitle: { ...typography.body, color: colors.textSecondary },

  searchWrap: {
    paddingHorizontal: space.gutterScreen,
    marginBottom: space[4],
  },

  resultsArea: {
    flex: 1,
    paddingHorizontal: space.gutterScreen,
  },
  spinner: {
    marginTop: space[6],
  },
  separator: {
    height: 1,
    backgroundColor: colors.borderDivider,
    marginHorizontal: space[1],
  },
  resultCard: {
    borderRadius: radius.sm,
    gap: 2,
  },
  attribution: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: space[3],
  },
  resultCardPressed: {
    backgroundColor: colors.surfaceSunken,
  },
  resultName: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.body.fontSize,
    color: colors.textPrimary,
  },
  resultBrand: { ...typography.bodySmall, color: colors.textSecondary },

  emptyState: {
    marginTop: space[10],
    alignItems: 'center',
    gap: space[2],
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  emptySubtext: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
  },

  footer: {
    paddingHorizontal: space.gutterScreen,
    paddingBottom: space[8],
  },
});
