import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Icon } from '@/components/ui/Icon';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { CompositionInsightsSection } from '@/components/catalog/CompositionInsightsSection';
import { AppHeader } from '@/components/ui/core/AppHeader';
import { Button } from '@/components/ui/core/Button';
import { IconButton } from '@/components/ui/core/IconButton';
import { InlineAlert } from '@/components/ui/feedback/InlineAlert';
import { Badge } from '@/components/ui/feedback/Badge';
import { Textarea } from '@/components/ui/forms/Textarea';
import { colors, space, typography } from '@/constants/tokens';
import { getProductTypeBadgeStatus, PRODUCT_TYPE_LABELS } from '@/constants/labels';
import type { CatalogStackParamList } from '@/navigation/AppNavigator';
import { useCompositionInsights } from '@/hooks/useCompositionInsights';
import { useWishlistStore } from '@/store/wishlistStore';

type Props = NativeStackScreenProps<CatalogStackParamList, 'WishlistEntryDetail'>;

/**
 * Every saved `WishlistEntry`'s own detail page (Story 9, tech design
 * FE-16..FE-23) — opened from `WishlistEntryCard.onCardPress` (FE-23).
 * Shows a text-only identity header (no photo — `WishlistEntry` has no
 * image field by design), the exact same 5 insight sections + disclaimer
 * already shipped on `ExploreCompositionResultScreen.tsx`, reused via
 * `CompositionInsightsSection`/`useCompositionInsights` rather than a
 * second implementation, a Notes card mirroring `ProductDetailScreen.tsx`'s
 * `Textarea` + local-state + onBlur-commit pattern, and a footer exposing
 * "Move to Shelf"/"Delete" additively to `WishlistEntryCard`'s own existing
 * versions of the same two actions. Never imports `DeleteProductModal` —
 * same no-confirmation rule Story 3 AC3 established for the card's own
 * Delete button.
 */
export default function WishlistEntryDetailScreen({ navigation, route }: Props) {
  const { wishlistEntryId } = route.params;
  const entries = useWishlistStore((s) => s.entries);
  const updateEntry = useWishlistStore((s) => s.updateEntry);
  const removeEntry = useWishlistStore((s) => s.removeEntry);

  const entry = entries.find((e) => e.id === wishlistEntryId) ?? null;

  // Declared before the not-found guard, same convention as
  // ProductDetailScreen.tsx's own `notesText` state.
  const [notesText, setNotesText] = useState(entry?.notes ?? '');

  // ── Not found guard (mirrors ProductDetailScreen.tsx's own block) ────────

  if (!entry) {
    return (
      <SafeAreaView style={styles.safe}>
        <AppHeader
          title="Composition"
          leftAction={
            <IconButton
              icon={<Icon name="arrow-left" size={20} color={colors.textPrimary} />}
              label="Back"
              variant="ghost"
              size="sm"
              onPress={() => navigation.goBack()}
            />
          }
        />
        <View style={styles.notFoundWrap}>
          <InlineAlert tone="sos" title="Composition not found">
            This composition may have been removed from your Wishlist.
          </InlineAlert>
          <Button variant="secondary" size="lg" onPress={() => navigation.goBack()}>
            Go Back
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const insights = useCompositionInsights(entry.rawIngredientsText, entry.category);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleNotesBlur = () => {
    const trimmed = notesText.trim();
    if (trimmed === (entry.notes ?? '')) return;
    updateEntry(entry.id, { notes: trimmed.length > 0 ? trimmed : null });
  };

  const handleMoveToShelf = () => {
    navigation.navigate('ManualProductForm', {
      explorePrefill: {
        rawIngredientsText: entry.rawIngredientsText,
        activeKeys: entry.parsedIngredientIds,
        brand: entry.brand,
        name: entry.name,
        category: entry.category,
        wishlistEntryId: entry.id,
      },
    });
  };

  const handleDelete = () => {
    removeEntry(entry.id);
    navigation.goBack();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader
        title={entry.name ?? 'Untitled composition'}
        leftAction={
          <IconButton
            icon={<Icon name="arrow-left" size={20} color={colors.textPrimary} />}
            label="Back"
            variant="ghost"
            size="sm"
            onPress={() => navigation.goBack()}
          />
        }
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerBlock}>
            {entry.brand ? (
              <View testID="wishlist-detail-brand">
                <Text style={styles.brand}>{entry.brand}</Text>
              </View>
            ) : null}
            <Text style={styles.name}>{entry.name ?? 'Untitled composition'}</Text>
            {entry.category ? (
              <View testID="wishlist-detail-category-badge">
                <Badge status={getProductTypeBadgeStatus(entry.category)} type="Light">
                  {PRODUCT_TYPE_LABELS[entry.category] ?? entry.category}
                </Badge>
              </View>
            ) : null}
          </View>

          <CompositionInsightsSection
            {...insights}
            onSetSkinType={() => navigation.navigate('Profile' as never)}
          />

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconCircle}>
                <Icon name="edit-3" size={18} color={colors.textPrimary} />
              </View>
              <Text style={styles.cardTitle}>Notes</Text>
            </View>
            <Textarea
              testID="wishlist-notes-input"
              value={notesText}
              onChangeText={setNotesText}
              onBlur={handleNotesBlur}
              placeholder="Add a note about this composition…"
              minHeight={56}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <Button size="lg" onPress={handleMoveToShelf} style={styles.footerBtn}>
          Move to Shelf
        </Button>
        <Button variant="ghost" size="lg" onPress={handleDelete}>
          Delete
        </Button>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgScreen,
  },
  flex: {
    flex: 1,
  },
  notFoundWrap: {
    flex: 1,
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[8],
    gap: space[4],
  },
  content: {
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[5],
    paddingBottom: space[8],
    gap: space[4],
  },
  headerBlock: {
    gap: space[2],
  },
  brand: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  name: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  card: {
    padding: space[4],
    gap: space[3],
    borderRadius: 16,
    backgroundColor: colors.surfaceCard,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  cardIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  footer: {
    flexDirection: 'row',
    gap: space[3],
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[3],
    paddingBottom: space[4],
    borderTopWidth: 1,
    borderTopColor: colors.borderDivider,
  },
  footerBtn: {
    flex: 1,
  },
});
