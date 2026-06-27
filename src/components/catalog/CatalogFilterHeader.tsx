import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, space, typography } from '@/constants/tokens';
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
    // Tapping current non-All category reverts to All; otherwise select the tapped category
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
      {/* Row 1 — Category pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryRow}
      >
        {CATEGORIES.map((cat) => {
          const isSelected = cat === selectedCategory;
          return (
            <Pressable
              key={cat}
              onPress={() => handleCategoryPress(cat)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={cat === 'All' ? 'Show all products' : `Filter by ${cat}`}
              style={({ pressed }) => [
                styles.pill,
                isSelected ? styles.pillSelected : styles.pillUnselected,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  isSelected ? styles.pillTextSelected : styles.pillTextUnselected,
                ]}
              >
                {cat}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Row 2 — Biomarker badges */}
      <View style={styles.biomarkerRow}>
        {BIOMARKERS.map((tag) => {
          const isSelected = selectedBiomarkers.includes(tag);
          return (
            <Pressable
              key={tag}
              onPress={() => handleBiomarkerPress(tag)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`Filter by ${tag}`}
              style={({ pressed }) => [
                styles.badge,
                isSelected ? styles.pillSelected : styles.pillUnselected,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  isSelected ? styles.pillTextSelected : styles.pillTextUnselected,
                ]}
              >
                {tag}
              </Text>
            </Pressable>
          );
        })}
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
  categoryRow: {
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
  pill: {
    height: 32,
    borderRadius: radius.pill,
    paddingHorizontal: space[3],
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillSelected: {
    backgroundColor: colors.textPrimary,
  },
  pillUnselected: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  pressed: {
    opacity: 0.7,
  },
  pillText: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
  },
  pillTextSelected: {
    color: colors.textOnDark,
  },
  pillTextUnselected: {
    color: colors.textSecondary,
  },
  badge: {
    height: 28,
    borderRadius: radius.pill,
    paddingHorizontal: space[2],
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
  },
});
