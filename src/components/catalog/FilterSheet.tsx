import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/core/Button';
import { FilterChip } from '@/components/ui/core/FilterChip';
import { colors, radius, space, typography } from '@/constants/tokens';
import { PRODUCT_TYPE_LABELS } from '@/constants/labels';
import { CATALOG_FILTER_DEFAULT } from '@/types';
import type { CatalogFilterState, CategoryFilter, ProductType } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const PRODUCT_CATEGORIES = Object.keys(PRODUCT_TYPE_LABELS) as ProductType[];
const CATEGORIES: CategoryFilter[] = ['All', ...PRODUCT_CATEGORIES];

const SNAP_POINTS = ['75%'];

function categoryLabel(cat: CategoryFilter): string {
  return cat === 'All' ? 'All' : PRODUCT_TYPE_LABELS[cat];
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface FilterSheetProps {
  visible: boolean;
  initialState: CatalogFilterState;
  onApply: (next: CatalogFilterState) => void;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FilterSheet({ visible, initialState, onApply, onClose }: FilterSheetProps) {
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);
  const wasPresented = useRef(false);
  const [draftState, setDraftState] = useState<CatalogFilterState>(initialState);

  // Sync the imperative sheet to the declarative `visible` prop, and reset the
  // draft to the last committed selection on every transition into visible —
  // reopening always shows what was applied, never an abandoned edit.
  useEffect(() => {
    if (visible) {
      wasPresented.current = true;
      setDraftState(initialState);
      sheetRef.current?.present();
    } else if (wasPresented.current) {
      sheetRef.current?.dismiss();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function handleCategoryPress(cat: CategoryFilter) {
    setDraftState((s) => ({
      ...s,
      selectedCategory: cat !== 'All' && cat === s.selectedCategory ? 'All' : cat,
    }));
  }

  function handleClearAll() {
    setDraftState((s) => ({
      ...s,
      selectedCategory: CATALOG_FILTER_DEFAULT.selectedCategory,
      selectedBenefits: CATALOG_FILTER_DEFAULT.selectedBenefits,
    }));
  }

  function handleApply() {
    onApply(draftState);
    onClose();
  }

  const renderBackdrop = (backdropProps: BottomSheetBackdropProps) => (
    <BottomSheetBackdrop
      {...backdropProps}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      pressBehavior="close"
      opacity={0.45}
    />
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={SNAP_POINTS}
      enableDynamicSizing={false}
      onDismiss={onClose}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
      backdropComponent={renderBackdrop}
    >
      <BottomSheetScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>Product Type</Text>
        <View style={styles.chipWrap}>
          {CATEGORIES.map((cat) => (
            <FilterChip
              key={cat}
              selected={cat === draftState.selectedCategory}
              onPress={() => handleCategoryPress(cat)}
              accessibilityLabel={cat === 'All' ? 'Show all products' : `Filter by ${categoryLabel(cat)}`}
            >
              {categoryLabel(cat)}
            </FilterChip>
          ))}
        </View>
      </BottomSheetScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space[3] }]}>
        <Button variant="secondary" size="lg" onPress={handleClearAll} style={styles.footerBtn}>
          Clear All
        </Button>
        <Button size="lg" onPress={handleApply} style={styles.footerBtn}>
          Apply Filters
        </Button>
      </View>
    </BottomSheetModal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: colors.bgBase,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  handleIndicator: {
    backgroundColor: colors.borderStrong,
    width: 36,
    height: 4,
  },
  scrollContent: {
    paddingHorizontal: space[4],
    paddingTop: space[4],
    gap: space[3],
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  footer: {
    flexDirection: 'row',
    gap: space[3],
    paddingHorizontal: space[4],
    paddingTop: space[4],
    borderTopWidth: 1,
    borderTopColor: colors.borderDivider,
  },
  footerBtn: {
    flex: 1,
  },
});
