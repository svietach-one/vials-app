import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors, radius, shadow, space, typography } from '@/constants/tokens';

/**
 * A labeled, single-select picker: a field-style trigger (matching Input's
 * visual language) that opens a native Modal listing every option full-text,
 * never truncated. Built for candidate lists where each option needs a
 * product name plus a short reason fragment (e.g. Draft Preview's
 * "Replace with" control) — SegmentedControl clips labels to one line and
 * doesn't fit that shape.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type SelectOptionTone = 'recommended' | 'neutral' | 'info';

export interface SelectOption {
  value: string;
  /** Primary text, e.g. a product name — always rendered in full. */
  title: string;
  /** Short context fragment shown after the title, e.g. "recommended". */
  reason?: string;
  tone?: SelectOptionTone;
}

export interface SelectProps {
  /** Small label rendered above the control, e.g. "Replace with". */
  label?: string;
  value: string;
  options: SelectOption[];
  onValueChange: (value: string) => void;
  accessibilityLabel?: string;
}

/** Exported so inline option lists (DraftPreviewSheet's step dropdown) colour
 *  their reason fragments exactly like this control's own menu. */
export const selectToneColor: Record<SelectOptionTone, string> = {
  recommended: colors.statusSafe,
  neutral: colors.textSecondary,
  info: colors.statusInfo,
};

const toneColor = selectToneColor;

// ─── Component ────────────────────────────────────────────────────────────────

export function Select({ label, value, options, onValueChange, accessibilityLabel }: SelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value) ?? options[0];

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label ?? 'Select an option'}
        style={styles.trigger}
      >
        <View style={styles.triggerText}>
          <Text style={styles.triggerTitle}>{selected?.title ?? ''}</Text>
          {selected?.reason ? (
            <Text style={[styles.triggerReason, { color: toneColor[selected.tone ?? 'neutral'] }]}>
              {` — ${selected.reason}`}
            </Text>
          ) : null}
        </View>
        <Feather name="chevron-down" size={18} color={colors.textTertiary} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            {label ? <Text style={styles.sheetTitle}>{label}</Text> : null}
            <ScrollView showsVerticalScrollIndicator={false}>
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      onValueChange(option.value);
                      setOpen(false);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={option.reason ? `${option.title} — ${option.reason}` : option.title}
                    style={styles.option}
                  >
                    <View style={styles.optionText}>
                      <Text style={styles.optionTitle}>{option.title}</Text>
                      {option.reason ? (
                        <Text style={[styles.optionReason, { color: toneColor[option.tone ?? 'neutral'] }]}>
                          {option.reason}
                        </Text>
                      ) : null}
                    </View>
                    {isSelected ? <Feather name="check" size={18} color={colors.textPrimary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    gap: 7,
  },
  label: {
    ...typography.label,
    color: colors.textPrimary,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
    minHeight: 48,
    paddingHorizontal: space[3] + 2,
    paddingVertical: space[2],
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1.5,
    borderColor: colors.borderInput,
    borderRadius: radius.sm,
  },
  triggerText: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  triggerTitle: {
    ...typography.body,
    color: colors.textPrimary,
  },
  triggerReason: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
  },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(9,9,11,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[5],
  },
  sheet: {
    width: '100%',
    maxHeight: '70%',
    backgroundColor: colors.bgBase,
    borderRadius: radius.xl,
    padding: space[5],
    gap: space[3],
    ...shadow.lg,
  },
  sheetTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    paddingVertical: space[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDivider,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    ...typography.body,
    color: colors.textPrimary,
  },
  optionReason: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
  },
});
