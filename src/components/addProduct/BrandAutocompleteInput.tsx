import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Input } from '@/components/ui/forms/Input';
import { colors, radius, space, typography } from '@/constants/tokens';
import { searchBrands } from '@/utils/productForm/brandLookup';

export interface BrandAutocompleteInputProps {
  value: string;
  /** User picked a suggestion from the dropdown. */
  onSelectSuggestion: (brand: string) => void;
  /** User typed freely; committed on blur or submit. */
  onCommitTyped: (text: string) => void;
  /**
   * Suggestion source — defaults to the local-only `searchBrands` (Shelf
   * brands + static seed dictionary, no network call, fully offline). Pass
   * `searchBrandsWithCorpus` (from `@/utils/productForm/brandLookup`) for
   * screens allowed to also query the full remote corpus — NOT for
   * `ExploreCompositionResultScreen.tsx`'s Save-to-Wishlist modal, which must
   * stay local-only per its own guardrail (see that file's doc comment).
   */
  searchFn?: (query: string) => Promise<string[]>;
}

const DEBOUNCE_MS = 150;

/**
 * Brand input with an autocomplete dropdown. Local-only by default
 * (`searchBrands` filters the in-memory shelf — no network call, fully
 * offline); pass `searchFn` to opt into a different suggestion source.
 */
export function BrandAutocompleteInput({
  value,
  onSelectSuggestion,
  onCommitTyped,
  searchFn = searchBrands,
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
      void searchFn(next).then(setSuggestions);
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

  function handleClear() {
    setText('');
    setSuggestions([]);
    onCommitTyped('');
  }

  const showDropdown = focused && suggestions.length > 0 && text.trim().length > 0;

  return (
    // Elevated above later siblings (e.g. a Name field / Save button
    // rendered right after this component in a modal) — otherwise, being
    // earlier in document order, this view would paint BEHIND them and the
    // absolutely-positioned dropdown below would end up hidden underneath
    // rather than floating over them (2026-08-28 bug fix).
    <View style={styles.root}>
      {/* Shared Input: persistent label + no lineHeight on the native field
          (spreading typography.body's lineHeight onto a single-line iOS
          TextInput breaks caret placement/scroll in long values). */}
      <Input
        label="Brand"
        value={text}
        onChangeText={handleChangeText}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
        onSubmitEditing={() => onCommitTyped(text)}
        onClear={handleClear}
        placeholder="e.g. La Roche-Posay"
        autoCapitalize="words"
        autoCorrect={false}
        accessibilityLabel="Brand"
      />
      {showDropdown ? (
        // Two layers: `dropdown` (outer) carries the shadow and absolute
        // positioning; `dropdownInner` carries the rounded-corner clip.
        // `overflow: 'hidden'` and a shadow can't share one view on iOS —
        // overflow clips the shadow itself to nothing — so the clip lives
        // one level in, on a view with no shadow of its own.
        <View style={styles.dropdown}>
          <View style={styles.dropdownInner}>
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
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    zIndex: 10,
  },
  dropdown: {
    // Floats over whatever comes after this component (Name field, Save
    // button, etc.) instead of pushing it down the way a normal-flow
    // sibling would (2026-08-28 bug fix). `top: '100%'` anchors it right
    // below the Input+label block, whose height Yoga has already measured
    // by the time this absolute position resolves.
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: space[1],
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 10,
  },
  dropdownInner: {
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
