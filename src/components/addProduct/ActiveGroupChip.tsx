import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';

import { IconButton } from '@/components/ui/core/IconButton';
import { colors, radius, space, typography } from '@/constants/tokens';

import type { ActivesGroup } from './activesGroups';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActiveGroupChipProps {
  label: string;
  group: ActivesGroup;
  checked: boolean;
  accessibilityLabel: string;
  /** Checkbox mode: tap anywhere on the chip to toggle. */
  onPress?: () => void;
  /** Removable mode: renders a trailing × instead of being tappable. */
  onRemove?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Shared visual for the manual-actives checklist chip and the OCR
 * detected-active chip — both render the same colored/bordered pill keyed
 * off an ActivesGroup, differing only in whether tapping toggles selection
 * (checkbox mode) or removes the chip (removable mode).
 */
export function ActiveGroupChip({
  label,
  group,
  checked,
  accessibilityLabel,
  onPress,
  onRemove,
}: ActiveGroupChipProps) {
  const colorStyle = checked
    ? { backgroundColor: group.tint, borderColor: group.line }
    : styles.unchecked;
  const textColor = checked ? group.color : colors.textSecondary;

  if (onRemove) {
    return (
      <View style={[styles.chip, styles.removableGap, colorStyle]}>
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
        <IconButton
          icon={<Icon name="x" size={14} color={textColor} />}
          label={`Remove ${label}`}
          variant="ghost"
          size="xs"
          onPress={onRemove}
        />
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.chip,
        styles.checkboxGap,
        colorStyle,
        pressed && styles.pressed,
      ]}
    >
      {checked ? <Icon name="check" size={12} color={textColor} /> : null}
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: space[3],
    height: space[8],
  },
  removableGap: {
    gap: space[2],
  },
  checkboxGap: {
    gap: space[1],
  },
  unchecked: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderStrong,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    includeFontPadding: false,
  },
});
