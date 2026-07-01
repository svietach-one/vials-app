import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { FilterChip } from '@/components/ui/core/FilterChip';
import { PRODUCT_TYPE_LABELS } from '@/constants/labels';
import { space } from '@/constants/tokens';
import type { BiomarkerTag, CatalogFilterState, CategoryFilter, ProductType } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

// Derived from PRODUCT_TYPE_LABELS so every known product type gets its own filter
// chip and stays in sync with the label copy in one place.
const PRODUCT_CATEGORIES = Object.keys(PRODUCT_TYPE_LABELS) as ProductType[];
const CATEGORIES: CategoryFilter[] = ['All', ...PRODUCT_CATEGORIES];
const BIOMARKERS: BiomarkerTag[] = ['Soothing', 'Actives', 'Hydration'];

function categoryLabel(cat: CategoryFilter): string {
  return cat === 'All' ? 'All' : PRODUCT_TYPE_LABELS[cat];
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CatalogFilterHeaderProps {
  filterState: CatalogFilterState;
  onFilterChange: (next: CatalogFilterState) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CatalogFilterHeader({ filterState, onFilterChange }: CatalogFilterHeaderProps) {
  const { selectedCategory, selectedBiomarkers } = filterState;

  function handleCategoryPress(cat: CategoryFilter) {
    const next: CategoryFilter =
      cat !== 'All' && cat === selectedCategory ? 'All' : cat;
    onFilterChange({ ...filterState, selectedCategory: next });
  }

  function handleBiomarkerPress(tag: BiomarkerTag) {
    const isSelected = selectedBiomarkers.includes(tag);
    const nextBiomarkers = isSelected
      ? selectedBiomarkers.filter((b) => b !== tag)
      : [...selectedBiomarkers, tag];
    onFilterChange({ ...filterState, selectedBiomarkers: nextBiomarkers });
  }

  return (
    <View style={styles.wrapper}>
      {/* Single row — categories + biomarkers together */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.rowScroll}
        contentContainerStyle={styles.row}
      >
        {CATEGORIES.map((cat) => (
          <FilterChip
            key={cat}
            selected={cat === selectedCategory}
            onPress={() => handleCategoryPress(cat)}
            accessibilityLabel={cat === 'All' ? 'Show all products' : `Filter by ${categoryLabel(cat)}`}
          >
            {categoryLabel(cat)}
          </FilterChip>
        ))}
        {BIOMARKERS.map((tag) => (
          <FilterChip
            key={tag}
            selected={selectedBiomarkers.includes(tag)}
            onPress={() => handleBiomarkerPress(tag)}
            accessibilityLabel={`Filter by ${tag}`}
          >
            {tag}
          </FilterChip>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    gap: space[2],
    paddingBottom: space[2],
  },
  // Negates the parent screen's gutter padding so the row can scroll edge-to-edge,
  // then re-applies it via contentContainerStyle to keep the first chip aligned
  // with the search field and cards above/below (same bleed pattern as
  // AddToRoutineSheet's filtersScroll).
  rowScroll: {
    marginHorizontal: -space.gutterScreen,
  },
  row: {
    gap: space[2],
    paddingHorizontal: space.gutterScreen,
    paddingVertical: space[1],
  },
});
