import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Input } from '@/components/ui/forms/Input';
import { BARCODE_HUB_ENTRY_ENABLED, SCAN_PRODUCT_ENABLED } from '@/constants/featureFlags';
import { colors, palette, radius, shadow, space, typography } from '@/constants/tokens';
import { useProductRepository } from '@/hooks/useCorpusRepositories';
import type { AddProductFlowParamList } from '@/navigation/AppNavigator';
import type { CorpusProduct } from '@/services/corpus/types';
import type { ProductStatus } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AddProductOptionsListProps {
  navigation: NativeStackNavigationProp<AddProductFlowParamList>;
  initialStatus?: ProductStatus;
  /**
   * Which flow this list is rendered inside — 'catalog' (My Shelf) or
   * 'onboarding' (FirstProductScreen). Threaded, unmodified, into every
   * downstream navigate call so the shared screens know where a completed
   * save should land (tech design FE-5/FE-6/FE-7). Left undefined for
   * existing "My Shelf" call sites — see Assumption 5.
   */
  entryContext?: 'catalog' | 'onboarding';
}

// ─── Component ──────────────────────────────────────────────────────────────
//
// Extracted from AddProductHubScreen's body (tech design FE-7) so onboarding's
// FirstProductScreen can offer the exact same Scan/Search/Manual entry points
// via the exact same component — not a reimplementation. AddProductHubScreen
// keeps its own AppHeader/back button and renders this component unchanged;
// "My Shelf" behavior is unchanged by this extraction.

export function AddProductOptionsList({
  navigation,
  initialStatus,
  entryContext,
}: AddProductOptionsListProps) {
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
        if (__DEV__) console.error('[AddProductOptionsList] corpus search failed', err);
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

  function goToCaptureFlow() {
    navigation.navigate('CaptureFlow', { initialStatus, entryContext });
  }

  function goToManualEntry() {
    navigation.navigate('AddProduct', { initialStatus, entryContext });
  }

  function pickSearchResult(item: CorpusProduct) {
    navigation.navigate('ManualProductForm', {
      prefillCorpusProduct: item,
      initialStatus,
      entryContext,
    });
  }

  function goToBarcodeScanner() {
    if (entryContext) {
      navigation.navigate('BarcodeScanner', { entryContext });
    } else {
      navigation.navigate('BarcodeScanner');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  // Note: no-result/error/unavailable states below show only a notice — the
  // persistent "Manual Entry" section further down stays the single, always-
  // present manual-add entry point (CLAUDE.md: never block the user), so we
  // don't duplicate it inline here.

  return (
    <>
      {/* ── Scan Product ── the primary identify-by-photo path, see
          docs/tasks/ux-explore-vials/07-capture-flow.md. Gated behind
          SCAN_PRODUCT_ENABLED (off by default — see featureFlags.ts); the
          capture/OCR flow isn't ready to offer users yet, so Search Database
          and Manual Entry are the two entry points shown while it's off. ── */}
      {SCAN_PRODUCT_ENABLED ? (
        <>
          <Text style={styles.sectionLabel}>Scan</Text>
          <Pressable
            style={({ pressed }) => [
              styles.actionRow,
              styles.manualCard,
              pressed && styles.actionRowPressed,
            ]}
            onPress={goToCaptureFlow}
            accessibilityRole="button"
            accessibilityLabel="Scan product"
          >
            <View style={styles.manualIconWrap}>
              <Icon name="camera" size={20} color={palette.plum} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Scan Product</Text>
              <Text style={styles.actionSubtitle}>Photograph the front label</Text>
            </View>
            <Icon name="chevron-right" size={18} color={colors.textTertiary} />
          </Pressable>

          <View style={styles.divider} />
        </>
      ) : null}

      {/* ── Corpus Search ──────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>Search Database</Text>
      <Input
        icon={<Icon name="search" size={16} color={colors.textTertiary} />}
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
                onPress={() => pickSearchResult(item)}
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
                <Icon name="plus" size={18} color={colors.textSecondary} />
              </Pressable>
            ))}
          </View>
          {showObfAttribution ? (
            <Text style={styles.attribution}>Product data from Open Beauty Facts (ODbL)</Text>
          ) : null}
        </View>
      ) : showSearchError ? (
        <View style={styles.noticeBanner}>
          <Icon name="wifi-off" size={16} color={colors.statusWarning} />
          <Text style={styles.noticeText}>
            Couldn't reach the product database. Check your connection and try again.
          </Text>
        </View>
      ) : showCorpusUnavailable ? (
        <View style={styles.noticeBanner}>
          <Icon name="alert-triangle" size={16} color={colors.statusWarning} />
          <Text style={styles.noticeText}>
            Product database isn't available in this build. You can still add a product manually.
          </Text>
        </View>
      ) : showNotFound ? (
        <Text style={styles.hint}>
          No results for "{searchText.trim()}"
        </Text>
      ) : null}

      {/* ── Scan Barcode ── moved into Add Product step 2; hub entry off ── */}
      {BARCODE_HUB_ENTRY_ENABLED ? (
        <>
          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>Scan</Text>
          <Pressable
            style={({ pressed }) => [
              styles.actionRow,
              pressed && styles.actionRowPressed,
            ]}
            onPress={goToBarcodeScanner}
            accessibilityRole="button"
            accessibilityLabel="Scan product barcode"
          >
            <View style={styles.actionIconWrap}>
              <Icon name="aperture" size={20} color={colors.textPrimary} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Scan Barcode</Text>
              <Text style={styles.actionSubtitle}>Look up product by barcode</Text>
            </View>
            <Icon name="chevron-right" size={18} color={colors.textTertiary} />
          </Pressable>
        </>
      ) : null}

      {/* ── Manual Entry ───────────────────────────────────────────────── */}
      <View style={styles.divider} />
      <Text style={styles.sectionLabel}>Manual Entry</Text>
      <Pressable
        style={({ pressed }) => [
          styles.actionRow,
          styles.manualCard,
          pressed && styles.actionRowPressed,
        ]}
        onPress={goToManualEntry}
        accessibilityRole="button"
        accessibilityLabel="Create product manually"
      >
        <View style={styles.manualIconWrap}>
          <Icon name="edit-3" size={20} color={palette.plum} />
        </View>
        <View style={styles.actionContent}>
          <Text style={styles.actionTitle}>Create Product Manually</Text>
          <Text style={styles.actionSubtitle}>Enter details yourself</Text>
        </View>
        <Icon name="chevron-right" size={18} color={colors.textTertiary} />
      </Pressable>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
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
  manualCard: {
    borderWidth: 0,
    ...shadow.sm,
  },
  manualIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: palette.plumTint,
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
