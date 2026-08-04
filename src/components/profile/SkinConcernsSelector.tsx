import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FilterChip } from '@/components/ui/core/FilterChip';
import { colors, space, typography } from '@/constants/tokens';
import { CONDITION_MODIFIERS } from '@/utils/skinConditionModifiers';
import type { SkinConcern, SkinConditionType } from '@/types';

/**
 * Combined skin-concerns picker: merges the plain "concerns" list with the
 * clinical skin-condition list (v1.2, US-23) into one deduplicated chip row so
 * "eczema" only ever appears once, under its richer condition label. Shared by
 * onboarding and the profile editor so the two screens can't drift apart.
 */

const CONDITION_ORDER: SkinConditionType[] = ['eczema', 'rosacea', 'seborrheic_dermatitis'];
const CONDITION_LABELS: Record<SkinConditionType, string> = CONDITION_MODIFIERS.reduce(
  (acc, modifier) => ({ ...acc, [modifier.condition]: modifier.label }),
  {} as Record<SkinConditionType, string>,
);

const CONCERNS: { value: SkinConcern; label: string }[] = [
  { value: 'acne', label: 'Acne' },
  { value: 'dryness', label: 'Dryness' },
  { value: 'wrinkles', label: 'Wrinkles' },
  { value: 'sensitivity', label: 'Sensitivity' },
  { value: 'redness', label: 'Redness' },
  { value: 'hyperpigmentation', label: 'Hyperpigmentation' },
  { value: 'pores', label: 'Pores' },
  { value: 'dark_spots', label: 'Dark spots' },
];

type SkinConcernOption =
  | { kind: 'condition'; value: SkinConditionType; label: string }
  | { kind: 'concern'; value: SkinConcern; label: string };

const OPTIONS: SkinConcernOption[] = [
  ...CONDITION_ORDER.map(
    (value): SkinConcernOption => ({ kind: 'condition', value, label: CONDITION_LABELS[value] }),
  ),
  ...CONCERNS.map(({ value, label }): SkinConcernOption => ({ kind: 'concern', value, label })),
];

export const SKIN_CONCERNS_DISCLAIMER =
  "These don't change your diagnosis—they simply make Vials more careful when suggesting routines and warning about ingredient or procedure conflicts.";

export interface SkinConcernsSelectorProps {
  concerns: SkinConcern[];
  skinConditions: SkinConditionType[];
  onChangeConcerns: (next: SkinConcern[]) => void;
  onChangeConditions: (next: SkinConditionType[]) => void;
}

export function SkinConcernsSelector({
  concerns,
  skinConditions,
  onChangeConcerns,
  onChangeConditions,
}: SkinConcernsSelectorProps) {
  function toggle(option: SkinConcernOption) {
    if (option.kind === 'condition') {
      onChangeConditions(
        skinConditions.includes(option.value)
          ? skinConditions.filter((c) => c !== option.value)
          : [...skinConditions, option.value],
      );
    } else {
      onChangeConcerns(
        concerns.includes(option.value)
          ? concerns.filter((c) => c !== option.value)
          : [...concerns, option.value],
      );
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.chipRow}>
        {OPTIONS.map((option) => {
          const active =
            option.kind === 'condition'
              ? skinConditions.includes(option.value)
              : concerns.includes(option.value);
          return (
            <FilterChip
              key={`${option.kind}-${option.value}`}
              selected={active}
              onPress={() => toggle(option)}
            >
              {option.label}
            </FilterChip>
          );
        })}
      </View>
      <Text style={styles.disclaimer}>{SKIN_CONCERNS_DISCLAIMER}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[2] },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  disclaimer: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
