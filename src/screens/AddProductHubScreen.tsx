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

import { AppHeader } from '@/components/ui/core/AppHeader';
import { IconButton } from '@/components/ui/core/IconButton';
import { Input } from '@/components/ui/forms/Input';
import { colors, radius, space, typography } from '@/constants/tokens';
import { useProductRepository } from '@/hooks/useCorpusRepositories';
import type { CatalogStackParamList } from '@/navigation/AppNavigator';
import type { CorpusProduct } from '@/services/corpus/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<CatalogStackParamList, 'AddProductHub'>;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AddProductHubScreen({ navigation }: Props) {
  const [searchText, setSearchText] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CorpusProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const productRepository = useProductRepository();

  // Debounce
  useEffect(() => {
    if (searchText.trim().length < 3) {
      setSearchResults([]);
      setDebouncedQuery('');
      return;
    }
    const t = setTimeout(() => setDebouncedQuery(searchText.trim()), 600);
    return () => clearTimeout(t);
  }, [searchText]);

  // Fetch from the corpus (trigram FTS — tolerates OCR/typo noise)
  useEffect(() => {
    if (!debouncedQuery || !productRepository) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    productRepository.search(debouncedQuery).then((products) => {
      if (!cancelled) {
        setSearchResults(products);
        setSearching(false);
      }
    });
    return () => { cancelled = true; };
  }, [debouncedQuery, productRepository]);

  const hasTypedEnough = searchText.trim().length >= 3;
  const showNotFound = hasTypedEnough && !searching && searchResults.length === 0;
  const showObfAttribution = searchResults.some((p) => p.source === 'obf_import');

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader
        title="Add Product"
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
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Corpus Search ──────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Search Database</Text>
        <Input
          icon={<Feather name="search" size={16} color={colors.textTertiary} />}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search by name or brand…"
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
        ) : searchResults.length > 0 ? (
          <View style={{ gap: space[2] }}>
            <View style={styles.resultList}>
              {searchResults.map((item) => (
                <Pressable
                  key={item.uid}
                  style={({ pressed }) => [
                    styles.resultRow,
                    pressed && styles.resultRowPressed,
                  ]}
                  onPress={() =>
                    navigation.navigate('ManualProductForm', { prefillCorpusProduct: item })
                  }
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
            {showObfAttribution ? (
              <Text style={styles.attribution}>Product data from Open Beauty Facts (ODbL)</Text>
            ) : null}
          </View>
        ) : showNotFound ? (
          <View style={styles.notFoundWrap}>
            <Text style={styles.hint}>
              No results for "{searchText.trim()}"
            </Text>
            <Pressable
              style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
              onPress={() => navigation.navigate('ManualProductForm', {})}
              accessibilityRole="button"
              accessibilityLabel="Create product manually"
            >
              <View style={styles.actionIconWrap}>
                <Feather name="edit-3" size={20} color={colors.textPrimary} />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Add Manually</Text>
                <Text style={styles.actionSubtitle}>Enter details yourself</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.textTertiary} />
            </Pressable>
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
        <Pressable
          style={({ pressed }) => [
            styles.actionRow,
            pressed && styles.actionRowPressed,
          ]}
          onPress={() => navigation.navigate('ManualProductForm', {})}
          accessibilityRole="button"
          accessibilityLabel="Create product manually"
        >
          <View style={styles.actionIconWrap}>
            <Feather name="edit-3" size={20} color={colors.textPrimary} />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Create Product Manually</Text>
            <Text style={styles.actionSubtitle}>Enter details yourself</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.textTertiary} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgSubtle,
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
  attribution: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
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
    gap: space[3],
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
