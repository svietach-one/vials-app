import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, space, typography } from '@/constants/tokens';
import { searchBrands } from '@/utils/productForm/brandLookup';

export interface BrandAutocompleteInputProps {
  value: string;
  /** User picked a suggestion from the dropdown. */
  onSelectSuggestion: (brand: string) => void;
  /** User typed freely; committed on blur or submit. */
  onCommitTyped: (text: string) => void;
}

const DEBOUNCE_MS = 150;

/**
 * Brand input with a local-only autocomplete dropdown (searchBrands filters
 * the in-memory shelf — no network call happens here, fully offline).
 */
export function BrandAutocompleteInput({
  value,
  onSelectSuggestion,
  onCommitTyped,
}: BrandAutocompleteInputProps) {
  const [text, setText] = useState(value);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);
  // Set when a suggestion row is pressed, so the following blur doesn't
  // overwrite the selection with a 'typed' commit.
  const suppressCommit = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local text in sync when the draft changes from outside (label OCR).
  useEffect(() => {
    setText(value);
  }, [value]);

  useEffect(() => () => {
    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
  }, []);

  function handleChangeText(next: string) {
    setText(next);
    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void searchBrands(next).then(setSuggestions);
    }, DEBOUNCE_MS);
  }

  function handleSelect(brand: string) {
    suppressCommit.current = true;
    setText(brand);
    setSuggestions([]);
    onSelectSuggestion(brand);
  }

  function handleBlur() {
    setFocused(false);
    if (suppressCommit.current) {
      suppressCommit.current = false;
      return;
    }
    if (text !== value) onCommitTyped(text);
  }

  const showDropdown = focused && suggestions.length > 0 && text.trim().length > 0;

  return (
    <View>
      <TextInput
        value={text}
        onChangeText={handleChangeText}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
        onSubmitEditing={() => onCommitTyped(text)}
        placeholder="Brand"
        placeholderTextColor={colors.textTertiary}
        autoCapitalize="words"
        autoCorrect={false}
        style={styles.input}
        accessibilityLabel="Brand"
      />
      {showDropdown ? (
        <View style={styles.dropdown}>
          {suggestions.map((brand) => (
            <Pressable
              key={brand}
              // onPressIn fires before the input's blur, so selection wins.
              onPressIn={() => handleSelect(brand)}
              style={({ pressed }) => [styles.suggestion, pressed && styles.suggestionPressed]}
              accessibilityRole="button"
              accessibilityLabel={`Use brand ${brand}`}
            >
              <Text style={styles.suggestionText}>{brand}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    ...typography.body,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    paddingVertical: space[3],
    backgroundColor: colors.surfaceRaised,
  },
  dropdown: {
    marginTop: space[1],
    borderWidth: 1,
    borderColor: colors.borderDivider,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceCard,
    overflow: 'hidden',
  },
  suggestion: {
    paddingHorizontal: space[3],
    paddingVertical: space[3],
  },
  suggestionPressed: {
    backgroundColor: colors.surfaceSunken,
  },
  suggestionText: {
    ...typography.body,
    color: colors.textPrimary,
  },
});
