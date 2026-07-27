import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FilterChip } from '@/components/ui/core/FilterChip';
import { space } from '@/constants/tokens';
import type { SkinType, UserProfile } from '@/types';
import { StepLayout } from './StepLayout';

// ─── Data ─────────────────────────────────────────────────────────────────────

const SKIN_TYPES: { value: SkinType; label: string }[] = [
  { value: 'oily', label: 'Oily' },
  { value: 'dry', label: 'Dry' },
  { value: 'combination', label: 'Combination' },
  { value: 'normal', label: 'Normal' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SkinTypeStepProps {
  initialSkinType: SkinType | null;
  onNext: (patch: Partial<UserProfile>) => void;
  onSkip: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/** Step 1 of 5 — skin type. First step in the flow, so there is no Back. */
export function SkinTypeStep({ initialSkinType, onNext, onSkip }: SkinTypeStepProps) {
  const [skinType, setSkinType] = useState<SkinType | null>(initialSkinType);

  return (
    <StepLayout
      title="What's your skin type?"
      subtitle="Choose the option that best describes your skin most of the time."
      onSkip={onSkip}
      onNext={() => onNext({ skinType })}
      nextDisabled={skinType === null}
    >
      <View style={styles.chipRow}>
        {SKIN_TYPES.map((t) => (
          <FilterChip key={t.value} selected={skinType === t.value} onPress={() => setSkinType(t.value)}>
            {t.label}
          </FilterChip>
        ))}
      </View>
    </StepLayout>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
});
