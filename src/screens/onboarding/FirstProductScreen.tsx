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
import { searchProducts } from '@/services/openBeautyFacts/search';
import type { OBFProduct } from '@/services/openBeautyFacts/types';
import { useProductsStore } from '@/store/productsStore';
import { useProfileStore } from '@/store/profileStore';
import type { Product, ProductType } from '@/types';
import { generateId } from '@/utils/generateId';
import type { OnboardingStackParamList } from '@/navigation/AppNavigator';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<OnboardingStackParamList, 'FirstProduct'>;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FirstProductScreen({ navigation: _navigation }: Props) {
  const addProduct = useProductsStore((s) => s.addProduct);
  const updateProfile = useProfileStore((s) => s.updateProfile);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OBFProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);

  async function handleSearch(text: string) {
    setQuery(text);
    if (text.trim().length < 3) {
      setResults([]);
      setSearchFailed(false);
      return;
    }
    setSearching(true);
    const { products, failed } = await searchProducts(text);
    setResults(products);
    setSearchFailed(failed);
    setSearching(false);
  }

  function handleSelect(item: OBFProduct) {
    const product: Product = {
      id: generateId(),
      name: item.name,
      brand: item.brand || null,
      productType: 'serum' as ProductType,
      imageUrl: null,
      activeIngredients: [],
      fullIngredientText: item.ingredientsText || null,
      usageTime: 'both',
      openBeautyFactsId: item.obfId || null,
      addedAt: new Date().toISOString(),
      notes: null,
      openedDate: null,
      paoMonths: null,
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
              keyExtractor={(item) => item.obfId || item.name}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
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
              <Feather
                name={searchFailed ? 'wifi-off' : 'inbox'}
                size={32}
                color={colors.textTertiary}
              />
              <Text style={styles.emptyText}>
                {searchFailed ? 'Search unavailable.' : 'No results found.'}
              </Text>
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
  eyebrow: {
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 1.32,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
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
  resultCardPressed: {
    backgroundColor: colors.surfaceSunken,
  },
  resultName: {
    fontFamily: 'DMSans-Medium',
    fontSize: 15,
    color: colors.textPrimary,
  },
  resultBrand: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },

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
