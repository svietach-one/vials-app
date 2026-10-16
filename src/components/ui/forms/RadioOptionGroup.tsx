import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, palette, space, typography } from '@/constants/tokens';

/**
 * Shared, presentational "pick one of N" control: always-visible radio rows,
 * no Modal/footer of its own. Introduced to replace the per-file 3-4-button
 * stacks that truncate long labels (multi-action-radio-picker tech design
 * §1) — `RadioConfirmModal` and `DraftPreviewScreen`'s commit-scope footer
 * each wrap this directly.
 *
 * Pure controlled component: selection lives in the caller (`value`), every
 * tap — including re-tapping the already-checked row — calls
 * `onChange(option.value)` unconditionally (matches `Select.tsx`'s
 * unconditional `onValueChange`).
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RadioOption<T extends string> {
  value: T;
  label: string;
  /** Optional auxiliary description, rendered as its own visible Text node
   *  below the label — never folded into the row's accessible name. */
  sublabel?: string;
}

export interface RadioOptionGroupProps<T extends string> {
  options: RadioOption<T>[];
  value: T;
  onChange: (value: T) => void;
  testID?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RadioOptionGroup<T extends string>({
  options,
  value,
  onChange,
  testID,
}: RadioOptionGroupProps<T>) {
  return (
    <View accessible accessibilityRole="radiogroup" testID={testID} style={styles.group}>
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked }}
            accessibilityLabel={option.label}
            style={styles.row}
          >
            <View style={[styles.ring, checked && styles.ringChecked]}>
              {checked ? <View style={styles.dot} /> : null}
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.label}>{option.label}</Text>
              {option.sublabel ? <Text style={styles.sublabel}>{option.sublabel}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const RING_SIZE = 22;
const DOT_SIZE = 10;

const styles = StyleSheet.create({
  group: {
    gap: space[3],
  },
  // Top-aligned, not centred: a row with a sublabel ("Reset all" carries one)
  // is two or more lines tall, and centring put the ring between the label and
  // its description instead of beside the label.
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
  },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    // Centre the ring on the FIRST line of the label (its line box is taller
    // than the ring), so it lines up with the label whatever follows it.
    marginTop: (typography.body.lineHeight - RING_SIZE) / 2,
  },
  ringChecked: {
    borderColor: palette.plum,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: palette.plum,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  label: {
    ...typography.body,
    color: colors.textPrimary,
  },
  sublabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
