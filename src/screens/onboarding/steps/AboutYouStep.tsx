import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FilterChip } from '@/components/ui/core/FilterChip';
import { ListRow } from '@/components/ui/core/ListRow';
import { Input } from '@/components/ui/forms/Input';
import { Switch } from '@/components/ui/forms/Switch';
import { colors, space, typography } from '@/constants/tokens';
import type { UserProfile } from '@/types';
import { StepLayout } from './StepLayout';

// ─── Data ─────────────────────────────────────────────────────────────────────

const GENDER_OPTIONS: { value: 'female' | 'male' | null; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: null, label: 'Prefer not to say' },
];

const HORMONE_LABEL = 'Currently on hormone therapy';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AboutYouStepProps {
  initialAge: number | null;
  initialGender: 'female' | 'male' | null;
  initialHormoneTherapy: boolean;
  onNext: (patch: Partial<UserProfile>) => void;
  onSkip: () => void;
  onBack: () => void;
  /** The container's OnboardingProgressRing, forwarded into the header row next to Back. */
  progressRing?: React.ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

/** Step 4 of 5 — about you. Every field is optional; Next is never gated. */
export function AboutYouStep({
  initialAge,
  initialGender,
  initialHormoneTherapy,
  onNext,
  onSkip,
  onBack,
  progressRing,
}: AboutYouStepProps) {
  const [ageText, setAgeText] = useState(initialAge != null ? String(initialAge) : '');
  const [gender, setGender] = useState<'female' | 'male' | null>(initialGender);
  const [hormoneTherapy, setHormoneTherapy] = useState(initialHormoneTherapy);

  function handleNext() {
    const age = parseInt(ageText, 10);
    onNext({
      age: Number.isFinite(age) && age > 0 ? age : null,
      gender,
      hormoneTherapy,
    });
  }

  return (
    <StepLayout
      title="A little about you"
      subtitle="Optional, but helps us personalize even better."
      onBack={onBack}
      onSkip={onSkip}
      onNext={handleNext}
      progressRing={progressRing}
    >
      <Input
        value={ageText}
        onChangeText={setAgeText}
        placeholder="e.g. 28"
        keyboardType="number-pad"
        maxLength={3}
        returnKeyType="done"
      />

      <View style={styles.chipRow}>
        {GENDER_OPTIONS.map((g) => (
          <FilterChip
            key={g.label}
            selected={gender === g.value}
            onPress={() => setGender(g.value)}
          >
            {g.label}
          </FilterChip>
        ))}
      </View>

      <Text style={styles.caption}>
        Skin differs physiologically between men and women — this affects how products perform. We
        ask to personalize, not out of curiosity.
      </Text>

      <View style={styles.divider} />

      <ListRow
        title={HORMONE_LABEL}
        subtitle="Affects oil production and sensitivity, regardless of the gender selected above."
        divider={false}
        trailing={
          <Switch
            checked={hormoneTherapy}
            onValueChange={setHormoneTherapy}
            accessibilityLabel={HORMONE_LABEL}
          />
        }
      />
    </StepLayout>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  caption: { ...typography.bodySmall, color: colors.textSecondary },
  divider: { height: 1, backgroundColor: colors.borderDivider },
});
