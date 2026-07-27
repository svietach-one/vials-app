import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GoalSelector } from '@/components/profile/GoalSelector';
import { FilterChip } from '@/components/ui/core/FilterChip';
import { GOAL_LABELS } from '@/constants/labels';
import { space } from '@/constants/tokens';
import type { SkinGoal, UserProfile } from '@/types';
import { StepLayout } from './StepLayout';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GoalsStepProps {
  initialPrimaryGoal: SkinGoal;
  initialSecondaryGoal: SkinGoal | null;
  onNext: (patch: Partial<UserProfile>) => void;
  onSkip: () => void;
  onBack: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/** Step 2 of 5 — care goals. Next is never gated; empty selection = maintenance. */
export function GoalsStep({
  initialPrimaryGoal,
  initialSecondaryGoal,
  onNext,
  onSkip,
  onBack,
}: GoalsStepProps) {
  const [primaryGoal, setPrimaryGoal] = useState<SkinGoal>(initialPrimaryGoal);
  const [secondaryGoal, setSecondaryGoal] = useState<SkinGoal | null>(initialSecondaryGoal);

  return (
    <StepLayout
      title="What would you like to improve?"
      subtitle="Choose up to two goals. We'll build routines around your primary goal."
      onBack={onBack}
      onSkip={onSkip}
      onNext={() => onNext({ primaryGoal, secondaryGoal })}
    >
      <View style={styles.maintenanceRow}>
        <FilterChip
          selected={primaryGoal === 'maintenance'}
          onPress={() => {
            setPrimaryGoal('maintenance');
            setSecondaryGoal(null);
          }}
        >
          {GOAL_LABELS.maintenance}
        </FilterChip>
      </View>

      <GoalSelector
        primaryGoal={primaryGoal}
        secondaryGoal={secondaryGoal}
        onChange={(primary, secondary) => {
          setPrimaryGoal(primary);
          setSecondaryGoal(secondary);
        }}
      />
    </StepLayout>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  maintenanceRow: {
    flexDirection: 'row',
    marginBottom: space[1],
  },
});
