import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { FilterChip } from '@/components/ui/core/FilterChip';
import { space } from '@/constants/tokens';
import type { BiomarkerTag, CatalogFilterState, CategoryFilter } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: CategoryFilter[] = ['All', 'Serums', 'Moisturizers', 'SPF'];
const BIOMARKERS: BiomarkerTag[] = ['Soothing', 'Actives', 'Hydration'];

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
      {/* Row 1 — Category */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {CATEGORIES.map((cat) => (
          <FilterChip
            key={cat}
            selected={cat === selectedCategory}
            onPress={() => handleCategoryPress(cat)}
            accessibilityLabel={cat === 'All' ? 'Show all products' : `Filter by ${cat}`}
          >
            {cat}
          </FilterChip>
        ))}
      </ScrollView>

      {/* Row 2 — Biomarkers */}
      <View style={styles.biomarkerRow}>
        {BIOMARKERS.map((tag) => (
          <FilterChip
            key={tag}
            size="sm"
            selected={selectedBiomarkers.includes(tag)}
            onPress={() => handleBiomarkerPress(tag)}
            accessibilityLabel={`Filter by ${tag}`}
          >
            {tag}
          </FilterChip>
        ))}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    gap: space[2],
    paddingBottom: space[2],
  },
  row: {
    gap: space[2],
    paddingHorizontal: space.gutterScreen,
    paddingVertical: space[1],
  },
  biomarkerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
    paddingHorizontal: space.gutterScreen,
  },
});
