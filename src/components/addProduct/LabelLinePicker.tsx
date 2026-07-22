import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors, palette, radius, space, typography } from '@/constants/tokens';

export type LabelLineField = 'brand' | 'name';

export interface LabelLinePickerProps {
  /** Cleaned OCR lines, in detection order. */
  lines: string[];
  /** Current chip → field assignments, keyed by line index. */
  assignments: Record<number, LabelLineField>;
  /** Fired when the user picks Brand / Product name for a line. */
  onAssign: (index: number, field: LabelLineField) => void;
  /** Dictionary spellings offered per line ("Did you mean …?"), keyed by line index. */
  suggestions?: Record<number, string>;
  /** User accepted the suggested spelling for a line. */
  onAcceptSuggestion?: (index: number) => void;
  /** User dismissed the suggestion for a line — keep the raw OCR text. */
  onDismissSuggestion?: (index: number) => void;
}

/**
 * Tap-to-assign pool for multi-line label OCR results: each detected line is
 * a chip; tapping one reveals a Brand / Product name choice. Assigned chips
 * stay in the pool (checked + dimmed) so they can be reassigned; never-tapped
 * lines simply stay unused — expected for tagline/subtitle lines.
 */
export function LabelLinePicker({
  lines,
  assignments,
  onAssign,
  suggestions = {},
  onAcceptSuggestion,
  onDismissSuggestion,
}: LabelLinePickerProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  function handleAssign(index: number, field: LabelLineField) {
    setOpenIndex(null);
    onAssign(index, field);
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Detected text — tap a line to assign it</Text>

      <View style={styles.pool}>
        {lines.map((line, index) => {
          const assigned = assignments[index];
          const open = openIndex === index;
          return (
            <Pressable
              key={`${index}-${line}`}
              onPress={() => setOpenIndex(open ? null : index)}
              style={[
                styles.chip,
                assigned !== undefined && styles.chipAssigned,
                // Open state wins visually: the tapped chip stays highlighted
                // while its Brand / Product name choice is showing below.
                open && styles.chipOpen,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Detected line: ${line}`}
              accessibilityState={{ selected: assigned !== undefined, expanded: open }}
            >
              {assigned !== undefined ? (
                <Feather
                  name="check"
                  size={14}
                  color={open ? palette.bottleGreen : colors.textSecondary}
                />
              ) : null}
              <Text
                style={[
                  styles.chipText,
                  assigned !== undefined && styles.chipTextAssigned,
                  open && styles.chipTextOpen,
                ]}
                numberOfLines={1}
              >
                {line}
              </Text>
              {assigned !== undefined ? (
                <Text style={styles.chipFieldTag}>
                  {assigned === 'brand' ? 'Brand' : 'Name'}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {Object.entries(suggestions).map(([key, suggestion]) => {
        const index = Number(key);
        return (
          <View style={styles.suggestionRow} key={`suggestion-${key}`}>
            <Text style={styles.suggestionText} numberOfLines={1}>
              Did you mean “{suggestion}”?
            </Text>
            <Pressable
              onPress={() => onAcceptSuggestion?.(index)}
              style={styles.suggestionUseBtn}
              accessibilityRole="button"
              accessibilityLabel={`Use suggested brand ${suggestion}`}
            >
              <Text style={styles.suggestionUseLabel}>Use</Text>
            </Pressable>
            <Pressable
              onPress={() => onDismissSuggestion?.(index)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Dismiss suggestion ${suggestion}`}
            >
              <Feather name="x" size={16} color={colors.textTertiary} />
            </Pressable>
          </View>
        );
      })}

      {openIndex !== null ? (
        <View style={styles.assignRow}>
          <Text style={styles.assignPrompt} numberOfLines={1}>
            “{lines[openIndex]}” is the…
          </Text>
          <View style={styles.assignButtons}>
            <Pressable
              onPress={() => handleAssign(openIndex, 'brand')}
              style={styles.assignBtn}
              accessibilityRole="button"
              accessibilityLabel="Assign to Brand"
            >
              <Text style={styles.assignBtnLabel}>Brand</Text>
            </Pressable>
            <Pressable
              onPress={() => handleAssign(openIndex, 'name')}
              style={styles.assignBtn}
              accessibilityRole="button"
              accessibilityLabel="Assign to Product name"
            >
              <Text style={styles.assignBtnLabel}>Product name</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space[2],
    borderWidth: 1,
    borderColor: colors.borderDivider,
    borderRadius: radius.lg,
    padding: space[3],
    backgroundColor: colors.surfaceSunken,
  },
  title: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  pool: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    maxWidth: '100%',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    backgroundColor: colors.surfaceRaised,
  },
  chipAssigned: {
    opacity: 0.55,
    borderColor: colors.borderDivider,
  },
  chipOpen: {
    borderColor: palette.bottleGreen,
    backgroundColor: palette.bottleGreenTint,
    opacity: 1,
  },
  chipText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  chipTextAssigned: {
    color: colors.textSecondary,
  },
  chipTextOpen: {
    fontFamily: 'DMSans-Medium',
    color: palette.bottleGreen,
  },
  chipFieldTag: {
    ...typography.caption,
    fontFamily: 'DMSans-Medium',
    color: colors.textSecondary,
  },
  assignRow: {
    gap: space[2],
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  suggestionText: {
    ...typography.caption,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  suggestionUseBtn: {
    borderRadius: radius.pill,
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    backgroundColor: palette.bottleGreenTint,
    borderWidth: 1,
    borderColor: palette.bottleGreenLine,
  },
  suggestionUseLabel: {
    ...typography.caption,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  assignPrompt: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  assignButtons: {
    flexDirection: 'row',
    gap: space[2],
  },
  assignBtn: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radius.md,
    paddingVertical: space[2],
    backgroundColor: palette.bottleGreenTint,
    borderWidth: 1,
    borderColor: palette.bottleGreenLine,
  },
  assignBtnLabel: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
});
