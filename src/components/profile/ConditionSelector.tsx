import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, palette, radius, space, typography } from '@/constants/tokens';
import { CONDITION_DISCLAIMER, CONDITION_MODIFIERS } from '@/utils/skinConditionModifiers';
import type { SkinConditionType } from '@/types';

/**
 * Optional skin-condition picker (US-23). Multi-select, defaults to none, and
 * skippable wherever it is embedded — selecting nothing is the supported
 * default state, not an unfinished form.
 *
 * Copy rules: plain language rather than clinical shorthand, one short
 * non-diagnostic description per option, and a persistent disclaimer that this
 * is a self-reported flag. Labels come from CONDITION_MODIFIERS so the picker
 * and the warning layer can never name the same condition differently.
 */

const CONDITION_ORDER: SkinConditionType[] = ['eczema', 'seborrheic_dermatitis', 'rosacea'];

const CONDITION_DESCRIPTIONS: Record<SkinConditionType, string> = {
  eczema: 'Skin that gets dry, itchy patches and reacts to a lot of products.',
  seborrheic_dermatitis: 'Flaking or redness around the nose, brows, or hairline.',
  rosacea: 'Skin that flushes or reacts easily.',
};

const LABELS: Record<SkinConditionType, string> = CONDITION_MODIFIERS.reduce(
  (acc, modifier) => ({ ...acc, [modifier.condition]: modifier.label }),
  {} as Record<SkinConditionType, string>,
);

export interface ConditionSelectorProps {
  selected: SkinConditionType[];
  onChange: (next: SkinConditionType[]) => void;
}

export function ConditionSelector({ selected, onChange }: ConditionSelectorProps) {
  function toggle(condition: SkinConditionType) {
    onChange(
      selected.includes(condition)
        ? selected.filter((c) => c !== condition)
        : [...selected, condition],
    );
  }

  return (
    <View style={styles.wrap}>
      {CONDITION_ORDER.map((condition) => {
        const active = selected.includes(condition);
        return (
          <Pressable
            key={condition}
            onPress={() => toggle(condition)}
            style={[styles.row, active && styles.rowActive]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            accessibilityLabel={LABELS[condition]}
          >
            <View style={styles.rowText}>
              <Text style={[styles.label, active && styles.labelActive]}>
                {LABELS[condition]}
              </Text>
              <Text style={[styles.description, active && styles.descriptionActive]}>
                {CONDITION_DESCRIPTIONS[condition]}
              </Text>
            </View>
          </Pressable>
        );
      })}
      <Text style={styles.disclaimer}>{CONDITION_DISCLAIMER}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[2] },
  row: {
    paddingHorizontal: space[3],
    paddingVertical: space[3],
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
  },
  rowActive: {
    backgroundColor: palette.black,
    borderColor: palette.black,
  },
  rowText: { gap: 2 },
  label: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  labelActive: { color: palette.white },
  description: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  descriptionActive: { color: palette.white, opacity: 0.8 },
  disclaimer: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: space[1],
  },
});
