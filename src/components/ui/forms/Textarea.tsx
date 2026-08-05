import React, { useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, radius, space, typography } from '@/constants/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TextareaProps extends Omit<TextInputProps, 'style' | 'multiline'> {
  /** Label rendered above the field. */
  label?: string | null;
  /** Helper text shown below the field in secondary color. */
  helper?: string | null;
  /** Error message shown below; overrides helper and turns the border red. */
  error?: string | null;
  disabled?: boolean;
  /** Minimum field height in px. Default 90 (roughly 3–4 lines). */
  minHeight?: number;
  /** Wraps the whole label + field + helper block. */
  containerStyle?: StyleProp<ViewStyle>;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Multiline sibling of {@link Input} — same field chrome (border, focus/error
 * states, label/helper) but grows with content instead of Input's fixed
 * single-line height. Use for free-text notes/comments; use Input for
 * everything single-line.
 */
export function Textarea({
  label,
  helper,
  error,
  disabled = false,
  minHeight = 90,
  containerStyle,
  onFocus,
  onBlur,
  ...rest
}: TextareaProps) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const borderColor = error
    ? colors.statusError
    : focused
    ? colors.borderFocus
    : colors.borderInput;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <TextInput
        ref={inputRef}
        editable={!disabled}
        multiline
        textAlignVertical="top"
        placeholderTextColor={colors.textTertiary}
        style={[
          styles.input,
          { minHeight, borderColor },
          disabled && styles.inputDisabled,
        ]}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        {...rest}
      />

      {(error || helper) ? (
        <Text style={[styles.helper, error ? styles.helperError : null]}>
          {error ?? helper}
        </Text>
      ) : null}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    gap: 7,
  },
  label: {
    ...typography.label,
    color: colors.textPrimary,
  },
  input: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: space[3] + 2,
    paddingVertical: space[3],
  },
  inputDisabled: {
    backgroundColor: colors.surfaceSunken,
    opacity: 0.6,
  },
  helper: { ...typography.bodySmall, color: colors.textSecondary },
  helperError: {
    color: colors.statusError,
  },
});
