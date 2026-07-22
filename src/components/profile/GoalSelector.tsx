import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GOAL_LABELS } from '@/constants/labels';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import type { SkinGoal } from '@/types';

/**
 * Care-goal picker (V2.1 phase-03 §3.1): at most two goals; the first
 * selected is the primary, the second the secondary. No selection means
 * maintenance — deliberately not a chip, it is the absence of a goal, and the
 * engine's treatment slot stays empty for it.
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
          <Pressable
            key={goal}
            onPress={() => handlePress(goal)}
            style={[styles.chip, active && styles.chipActive, atCapacity && styles.chipDim]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            accessibilityLabel={GOAL_LABELS[goal]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{GOAL_LABELS[goal]}</Text>
            {isPrimary && <Text style={styles.primaryTag}>Primary</Text>}
          </Pressable>
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
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[3],
    paddingVertical: space[2] - 1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
  },
  chipActive: {
    backgroundColor: palette.black,
    borderColor: palette.black,
  },
  chipDim: {
    opacity: 0.45,
  },
  label: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: colors.textSecondary,
  },
  labelActive: {
    color: palette.white,
  },
  primaryTag: {
    ...typography.caption,
    fontFamily: 'DMSans-Medium',
    color: palette.white,
    opacity: 0.75,
  },
});
