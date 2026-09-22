import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, space, typography } from '@/constants/tokens';
import type { StepTransition } from '@/types';

/**
 * The gap between two adjacent rendered steps (routine-step-grouping
 * SCREENS.md §5). Centred label, hairline rules either side — never a badge
 * on a step header, never interactive. `kind: 'none'` renders nothing at
 * all: no row, no reserved space (returning `null` here is load-bearing).
 */

export interface StepTransitionDividerProps {
  transition: StepTransition;
}

const COPY_BY_TEXT: Record<Exclude<StepTransition, { kind: 'none' }>['text'], string> = {
  dry_skin: 'on dry skin',
  immediate: 'apply next right away',
  until_dry: 'until fully dry',
  before_sun: '~15 min before sun exposure',
};

export function StepTransitionDivider({ transition }: StepTransitionDividerProps) {
  if (transition.kind === 'none') return null;

  return (
    <View style={styles.row}>
      <View style={styles.rule} />
      <Text style={styles.label}>{COPY_BY_TEXT[transition.text]}</Text>
      <View style={styles.rule} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderDivider,
  },
  label: {
    ...typography.caption,
    color: colors.textTertiary,
  },
});
