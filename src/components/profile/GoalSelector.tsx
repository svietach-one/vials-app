import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GOAL_LABELS } from '@/constants/labels';
import { colors, radius, space, typography } from '@/constants/tokens';
import type { SkinGoal } from '@/types';

/**
 * Care-goal picker (V2.1 phase-03 §3.1): at most two goals; the first
 * selected is the primary, the second the secondary. No selection means
 * maintenance — deliberately not a chip, it is the absence of a goal, and the
 * engine's treatment slot stays empty for it.
 *
 * Not built on the shared FilterChip (whose children must be a plain string)
 * because the primary chip needs a second, separately-queryable "Primary"
 * label alongside the goal name — so the visual tokens below are copied from
 * FilterChip 1:1 (radius, height, colors) to keep every pill in the app
 * looking identical without forcing incompatible content through one component.
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
    height: space[8],
    paddingHorizontal: space[3],
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
  },
  chipActive: {
    backgroundColor: colors.controlFill,
    borderColor: colors.controlFill,
  },
  chipDim: {
    opacity: 0.45,
  },
  label: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: 'DMSans-Medium',
    includeFontPadding: false,
    color: colors.textSecondary,
  },
  labelActive: {
    color: colors.controlOn,
  },
  primaryTag: {
    ...typography.caption,
    fontFamily: 'DMSans-Medium',
    color: colors.controlOn,
    opacity: 0.75,
  },
});
