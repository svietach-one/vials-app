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
import { BARCODE_SCANNER_ENABLED } from '@/constants/featureFlags';
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
  const [searchError, setSearchError] = useState(false);
  const productRepository = useProductRepository();
  // Null repository = corpus not configured/reachable for this build. Surfaced
  // as its own notice (not a fake "no results"), while manual entry stays open.
  const corpusUnavailable = !productRepository;

  // Debounce — fires from the first character so the dropdown adapts live
  // as the user types (short queries fall back to a substring match in
  // ProductRepository.search, since trigram FTS needs 3+ chars per token).
  useEffect(() => {
    if (searchText.trim().length < 1) {
      setSearchResults([]);
      setDebouncedQuery('');
      return;
    }
    const t = setTimeout(() => setDebouncedQuery(searchText.trim()), 200);
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
    setSearchError(false);
    productRepository
      .search(debouncedQuery)
      .then((products) => {
        if (cancelled) return;
        setSearchResults(products);
        setSearching(false);
      })
      .catch((err) => {
        if (cancelled) return;
        // Surface the failure instead of masking it as an empty result: the
        // remote corpus is unreachable, the token is bad, or the query errored.
        if (__DEV__) console.error('[AddProductHub] corpus search failed', err);
        setSearchResults([]);
        setSearchError(true);
        setSearching(false);
      });
    return () => { cancelled = true; };
  }, [debouncedQuery, productRepository]);

  const hasTypedEnough = searchText.trim().length >= 1;
  // Guard against showing "not found" for text the user hasn't finished
  // typing yet: while a debounce is pending, debouncedQuery still holds the
  // *previous* query, so searchResults/searching are stale relative to the
  // live searchText until the two match again.
  const showNotFound =
    hasTypedEnough &&
    !searching &&
    !searchError &&
    !corpusUnavailable &&
    searchResults.length === 0 &&
    debouncedQuery === searchText.trim();
  // Corpus not configured/reachable for this build — distinct from a genuine
  // empty result, and shown as soon as the user starts typing.
  const showCorpusUnavailable = hasTypedEnough && corpusUnavailable;
  // The remote query failed (network/token/query error) for the current text.
  const showSearchError =
    hasTypedEnough &&
    !searching &&
    searchError &&
    debouncedQuery === searchText.trim();
  const showObfAttribution = searchResults.some((p) => p.source === 'obf_import');

  // Shared manual-entry fallback, offered alongside every no-result / error /
  // unavailable state so the user is never blocked (CLAUDE.md constraint).
  const manualFallbackRow = (
    <Pressable
      style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
      onPress={() => navigation.navigate('AddProduct')}
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
  );

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
                    {item.nameLacin ? (
                      <Text style={styles.resultNameLacin} numberOfLines={1}>
                        {item.nameLacin}
                      </Text>
                    ) : null}
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
        ) : showSearchError ? (
          <View style={styles.notFoundWrap}>
            <View style={styles.noticeBanner}>
              <Feather name="wifi-off" size={16} color={colors.statusWarning} />
              <Text style={styles.noticeText}>
                Couldn't reach the product database. Check your connection and try again.
              </Text>
            </View>
            {manualFallbackRow}
          </View>
        ) : showCorpusUnavailable ? (
          <View style={styles.notFoundWrap}>
            <View style={styles.noticeBanner}>
              <Feather name="alert-triangle" size={16} color={colors.statusWarning} />
              <Text style={styles.noticeText}>
                Product database isn't available in this build. You can still add a product manually.
              </Text>
            </View>
            {manualFallbackRow}
          </View>
        ) : showNotFound ? (
          <View style={styles.notFoundWrap}>
            <Text style={styles.hint}>
              No results for "{searchText.trim()}"
            </Text>
            {manualFallbackRow}
          </View>
        ) : null}

        {/* ── Scan Barcode ── feature-flagged off while lookup is unreliable ── */}
        {BARCODE_SCANNER_ENABLED ? (
          <>
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
          </>
        ) : null}

        {/* ── Manual Entry ───────────────────────────────────────────────── */}
        <View style={styles.divider} />
        <Text style={styles.sectionLabel}>Manual Entry</Text>
        <Pressable
          style={({ pressed }) => [
            styles.actionRow,
            pressed && styles.actionRowPressed,
          ]}
          onPress={() => navigation.navigate('AddProduct')}
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
    backgroundColor: colors.bgScreen,
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
  resultNameLacin: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  notFoundWrap: {
    gap: space[3],
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[2],
    padding: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.statusWarningLine,
    backgroundColor: colors.statusWarningTint,
  },
  noticeText: {
    ...typography.bodySmall,
    flex: 1,
    color: colors.textPrimary,
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
