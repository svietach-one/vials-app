import React, { useRef } from 'react';
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

export interface InputProps extends Omit<TextInputProps, 'style'> {
  /** Mono uppercase label rendered above the field. */
  label?: string | null;
  /** Leading icon node (e.g. a Feather icon). */
  icon?: React.ReactNode;
  /** Trailing unit or hint rendered inside the field on the right. */
  suffix?: string | null;
  /** Helper text shown below the field in secondary color. */
  helper?: string | null;
  /** Error message shown below; overrides helper and turns the border red. */
  error?: string | null;
  disabled?: boolean;
  /** Wraps the whole label + field + helper block. */
  containerStyle?: StyleProp<ViewStyle>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Input({
  label,
  icon,
  suffix,
  helper,
  error,
  disabled = false,
  containerStyle,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const [focused, setFocused] = React.useState(false);
  const inputRef = useRef<TextInput>(null);

  const borderColor = error
    ? colors.statusError
    : focused
    ? colors.borderFocus
    : colors.borderInput;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View
        style={[
          styles.field,
          { borderColor },
          disabled && styles.fieldDisabled,
        ]}
      >
        {icon ? <View style={styles.iconSlot}>{icon}</View> : null}

        <TextInput
          ref={inputRef}
          editable={!disabled}
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          {...rest}
        />

        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>

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

  // Default field label — uppercase apothecary style, black (textPrimary = controlFill)
  label: {
    ...typography.label,
    color: colors.textPrimary,
  },

  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: space[3] + 2, // 14px
    gap: 10,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1.5,
    borderRadius: radius.sm,
  },
  fieldDisabled: {
    backgroundColor: colors.surfaceSunken,
    opacity: 0.6,
  },

  iconSlot: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    color: colors.textTertiary,
  },

  input: {
    flex: 1,
    fontFamily: 'DMSans-Regular',
    fontSize: typography.body.fontSize,
    color: colors.textPrimary,
    includeFontPadding: false,
    // Remove default RN TextInput padding on Android
    paddingVertical: 0,
  },

  suffix: {
    flexShrink: 0,
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    color: colors.textTertiary,
  },

  helper: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  helperError: {
    color: colors.statusError,
  },
});
