import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FitzpatrickCard } from '@/components/onboarding/PhototypeCard';
import { colors, space, typography } from '@/constants/tokens';
import type { FitzpatrickType, UserProfile } from '@/types';
import { StepLayout } from './StepLayout';

// ─── Data ─────────────────────────────────────────────────────────────────────

const FITZPATRICK_TYPES: FitzpatrickType[] = [1, 2, 3, 4, 5, 6];

/** Brief visible caption per type, shown under the card — supplementary to the existing accessibilityLabel. */
const FITZPATRICK_DESCRIPTIONS: Record<FitzpatrickType, string> = {
  1: 'Always burns, never tans',
  2: 'Usually burns, tans minimally',
  3: 'Sometimes burns, tans gradually',
  4: 'Rarely burns, tans easily',
  5: 'Very rarely burns',
  6: 'Never burns',
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PhototypeStepProps {
  initialFitzpatrick: FitzpatrickType | null;
  onNext: (patch: Partial<UserProfile>) => void;
  onSkip: () => void;
  onBack: () => void;
  /** The container's OnboardingProgressRing, forwarded into the header row next to Back. */
  progressRing?: React.ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Step 3 of 5 — sun reaction (phototype). Reuses the already-shipped 6-card
 * `FitzpatrickCard` (resolved OQ-1 — 6 individual cards, not 3 grouped),
 * arranged in a 2-column grid.
 */
export function PhototypeStep({
  initialFitzpatrick,
  onNext,
  onSkip,
  onBack,
  progressRing,
}: PhototypeStepProps) {
  const [fitzpatrick, setFitzpatrick] = useState<FitzpatrickType | null>(initialFitzpatrick);

  return (
    <StepLayout
      title="How does your skin react to the sun?"
      subtitle="This helps us tailor product and procedure recommendations."
      onBack={onBack}
      onSkip={onSkip}
      onNext={() => onNext({ fitzpatrick })}
      nextDisabled={fitzpatrick === null}
      progressRing={progressRing}
    >
      <View style={styles.grid} accessibilityRole="radiogroup">
        {FITZPATRICK_TYPES.map((type) => (
          <View key={type} style={styles.gridItem}>
            <FitzpatrickCard
              type={type}
              selected={fitzpatrick === type}
              onSelect={() => setFitzpatrick(type)}
              style={styles.card}
            />
            <Text style={styles.description}>{FITZPATRICK_DESCRIPTIONS[type]}</Text>
          </View>
        ))}
      </View>
    </StepLayout>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: space[3],
  },
  gridItem: {
    width: '47%',
    gap: space[1],
  },
  // Explicit fixed height, not the shared component's flex/aspectRatio-based
  // square — flex:1 inside this grid's auto-height column items resolved
  // inconsistently per row (depending on the caption's wrapped line count),
  // producing visibly different card shapes. A fixed height sidesteps that
  // ambiguity entirely: every card is the same rectangle, full stop.
  card: {
    flex: 0,
    aspectRatio: undefined,
    height: 96,
  },
  description: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
