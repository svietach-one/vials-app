import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { CityPicker } from '@/components/profile/CityPicker';
import { colors, typography } from '@/constants/tokens';
import type { CityLocation, UserProfile } from '@/types';
import { StepLayout } from './StepLayout';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CityStepProps {
  initialCity: CityLocation | null;
  onNext: (patch: Partial<UserProfile>) => void;
  onSkip: () => void;
  onBack: () => void;
  /** The container's OnboardingProgressRing, forwarded into the header row next to Back. */
  progressRing?: React.ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Step 6 of 6 — optional city, driving weather-based seasonal routine rules
 * (research §1.7). Skippable like every other step; leaving it unset keeps
 * `city: null` and the routine engine falls back to calendar-based seasons.
 */
export function CityStep({ initialCity, onNext, onSkip, onBack, progressRing }: CityStepProps) {
  const [city, setCity] = useState<CityLocation | null>(initialCity);

  return (
    <StepLayout
      title="Where are you based?"
      subtitle="Optional — helps us fine-tune seasonal advice using real weather instead of just the calendar."
      onBack={onBack}
      onSkip={onSkip}
      onNext={() => onNext({ city })}
      nextLabel="Finish"
      progressRing={progressRing}
    >
      <Text style={styles.explanation}>
        Some routine rules change with the seasons — like limiting exfoliation
        in summer or prioritizing barrier repair in winter. Your city lets us
        base those rules on actual local temperature instead of the calendar
        date.
      </Text>

      <CityPicker city={city} onSelect={setCity} onClear={() => setCity(null)} />
    </StepLayout>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  explanation: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
