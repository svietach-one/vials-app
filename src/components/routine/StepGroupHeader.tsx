import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';

import { STEP_ACTION_LABELS } from '@/constants/rulesets/stepActions';
import { colors, space, typography } from '@/constants/tokens';
import type { StepAction } from '@/types';

/**
 * One header per rendered step group (routine-step-grouping SCREENS.md §3).
 * Sits directly on the screen background — no container, no border, no
 * shadow; the cards below it carry all of those. That contrast, plus the
 * vertical-rhythm gap tokens applied by the caller, IS the grouping signal.
 */

export interface StepGroupHeaderProps {
  /** 1-based position among today's RENDERED groups — no gaps (SCREENS.md §3.1). */
  ordinal: number;
  action: StepAction;
  /** True when every card in the group is completed. Dims the header — never
   *  struck through (SCREENS.md §3.3, US-41). */
  allCompleted?: boolean;
  /** Shows the drag affordance. Label/position are unaffected by edit mode. */
  editMode?: boolean;
}

export function StepGroupHeader({ ordinal, action, allCompleted = false, editMode = false }: StepGroupHeaderProps) {
  const text = `${ordinal}. ${STEP_ACTION_LABELS[action]}`;
  const accessibilityLabel = allCompleted ? `${text}, all done` : text;

  return (
    <View style={styles.row} accessibilityLabel={accessibilityLabel}>
      <Text style={[styles.label, allCompleted && styles.labelDimmed]}>{text}</Text>
      {editMode ? (
        <View testID="step-group-drag-handle" accessibilityLabel={`Reorder ${STEP_ACTION_LABELS[action]}`}>
          <Icon name="menu" size={18} color={colors.textTertiary} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[1],
  },
  label: {
    ...typography.body,
    fontFamily: 'DMSans-Bold',
    color: colors.textPrimary,
  },
  labelDimmed: {
    color: colors.textTertiary,
  },
});
