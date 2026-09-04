import React from 'react';
import { StyleSheet, View } from 'react-native';

import { FilterChip } from '@/components/ui/core/FilterChip';
import { GOAL_LABELS } from '@/constants/labels';
import { space } from '@/constants/tokens';
import type { SkinGoal } from '@/types';

/**
 * Care-goal picker (V2.1 phase-03 §3.1): at most two goals; the first
 * selected is the primary, the second the secondary. No selection means
 * maintenance — deliberately not a chip, it is the absence of a goal, and the
 * engine's treatment slot stays empty for it.
 *
 * Built on the shared FilterChip's `subLabel` slot for the primary chip's
 * separately-queryable "Primary" tag.
 */

const SELECTABLE_GOALS: SkinGoal[] = [
  'acne',
  'pigmentation',
  'aging',
  'dehydration',
  'barrier_repair',
  'oil_control',
];

export interface GoalSelectorProps {
  primaryGoal: SkinGoal;
  secondaryGoal: SkinGoal | null;
  onChange: (primary: SkinGoal, secondary: SkinGoal | null) => void;
}

export function GoalSelector({ primaryGoal, secondaryGoal, onChange }: GoalSelectorProps) {
  const selectedCount = (primaryGoal !== 'maintenance' ? 1 : 0) + (secondaryGoal ? 1 : 0);

  function handlePress(goal: SkinGoal) {
    if (goal === primaryGoal) {
      // Deselecting the primary promotes the secondary; none left ⇒ maintenance
      onChange(secondaryGoal ?? 'maintenance', null);
      return;
    }
    if (goal === secondaryGoal) {
      onChange(primaryGoal, null);
      return;
    }
    if (primaryGoal === 'maintenance') {
      onChange(goal, null);
      return;
    }
    if (secondaryGoal === null) {
      onChange(primaryGoal, goal);
    }
    // Two already selected: a third tap is a no-op (max 2 goals)
  }

  return (
    <View style={styles.wrap}>
      {SELECTABLE_GOALS.map((goal) => {
        const isPrimary = goal === primaryGoal;
        const isSecondary = goal === secondaryGoal;
        const active = isPrimary || isSecondary;
        const atCapacity = selectedCount >= 2 && !active;
        return (
          <FilterChip
            key={goal}
            onPress={() => handlePress(goal)}
            selected={active}
            subLabel={isPrimary ? 'Primary' : undefined}
            style={atCapacity && styles.chipDim}
            accessibilityLabel={GOAL_LABELS[goal]}
          >
            {GOAL_LABELS[goal]}
          </FilterChip>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  chipDim: {
    opacity: 0.45,
  },
});
