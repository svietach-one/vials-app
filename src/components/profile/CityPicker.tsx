import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/core/IconButton';
import { Input } from '@/components/ui/forms/Input';
import { colors, space, typography } from '@/constants/tokens';
import { MIN_QUERY_LENGTH, searchCities } from '@/utils/citySearch';
import type { CityLocation } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CityPickerProps {
  city: CityLocation | null;
  onSelect: (city: CityLocation) => void;
  onClear: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Offline city autocomplete over the bundled dataset (research §1.7: no GPS,
 * no network — a text field backed by src/constants/cities.json). Shared
 * between ProfileScreen and the onboarding CityStep.
 */
export function CityPicker({ city, onSelect, onClear }: CityPickerProps) {
  const [query, setQuery] = useState('');
  const suggestions = searchCities(query, 5);

  if (city) {
    return (
      <View style={styles.selectedRow}>
        <Icon name="map-pin" size={16} color={colors.textSecondary} />
        <Text style={styles.selectedName}>{city.name}</Text>
        <IconButton
          icon={<Icon name="x" size={16} color={colors.textTertiary} />}
          label="Clear city"
          variant="ghost"
          size="xs"
          onPress={onClear}
        />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Search your city…"
        autoCorrect={false}
        returnKeyType="search"
      />
      {suggestions.map((suggestion) => (
        <Pressable
          key={suggestion.name}
          onPress={() => {
            onSelect(suggestion);
            setQuery('');
          }}
          style={styles.suggestionRow}
          accessibilityRole="button"
          accessibilityLabel={`Select ${suggestion.name}`}
        >
          <Icon name="map-pin" size={14} color={colors.textTertiary} />
          <Text style={styles.suggestionText}>{suggestion.name}</Text>
        </Pressable>
      ))}
      {query.trim().length >= MIN_QUERY_LENGTH && suggestions.length === 0 && (
        <Text style={styles.noResultsText}>City not found</Text>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: { gap: space[1] },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingVertical: space[2],
  },
  selectedName: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingVertical: space[2],
    paddingHorizontal: space[2],
  },
  suggestionText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
  },
  noResultsText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    paddingVertical: space[2],
    paddingHorizontal: space[2],
  },
});
