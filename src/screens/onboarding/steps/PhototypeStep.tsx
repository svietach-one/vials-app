import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FitzpatrickCard } from '@/components/onboarding/PhototypeCard';
import { PhototypeQuizSheet } from '@/components/onboarding/PhototypeQuizSheet';
import { Button } from '@/components/ui/core/Button';
import { colors, radius, space, typography } from '@/constants/tokens';
import { FITZPATRICK_DESCRIPTIONS } from '@/constants/labels';
import { deriveFitzpatrick } from '@/utils/routineEngine/migrations';
import type { FitzpatrickType, SkinPhototype, UserProfile } from '@/types';
import { StepLayout } from './StepLayout';

// ─── Data ─────────────────────────────────────────────────────────────────────

const FITZPATRICK_TYPES: FitzpatrickType[] = [1, 2, 3, 4, 5, 6];

// testID contract (qa-lead binding contract, vials-onboarding-quizzes).
const NOT_SURE_TEST_ID = 'not-sure-phototype-button';
const SOFT_COPY_HINT_TEST_ID = 'quiz-soft-copy-hint';

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
 * arranged in a 2-column grid. Also hosts the "Not sure?" quiz entry point
 * (vials-onboarding-quizzes FE-6): a quiz result only pre-selects a card and
 * shows a soft-copy hint — `onNext` (Next tap) stays the sole write path.
 */
export function PhototypeStep({
  initialFitzpatrick,
  onNext,
  onSkip,
  onBack,
  progressRing,
}: PhototypeStepProps) {
  const [fitzpatrick, setFitzpatrick] = useState<FitzpatrickType | null>(initialFitzpatrick);
  const [quizVisible, setQuizVisible] = useState(false);
  const [softCopyHint, setSoftCopyHint] = useState<string | null>(null);

  function handleCardSelect(type: FitzpatrickType) {
    setFitzpatrick(type);
    setSoftCopyHint(null);
  }

  function handleQuizComplete(result: { phototype: SkinPhototype }) {
    setQuizVisible(false);
    const derived = deriveFitzpatrick(result.phototype);
    if (derived === null) return;
    setFitzpatrick(derived);
    setSoftCopyHint(
      `Looks like you're closest to ${FITZPATRICK_DESCRIPTIONS[derived]}. Tap Next to confirm.`,
    );
  }

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
              onSelect={() => handleCardSelect(type)}
              style={styles.card}
            />
            <Text style={styles.description}>{FITZPATRICK_DESCRIPTIONS[type]}</Text>
          </View>
        ))}
      </View>

      <Button
        variant="ghost"
        size="md"
        testID={NOT_SURE_TEST_ID}
        onPress={() => setQuizVisible(true)}
        style={styles.notSureButton}
      >
        Not sure? Help me figure it out
      </Button>

      {softCopyHint ? (
        <View testID={SOFT_COPY_HINT_TEST_ID} style={styles.hint}>
          <Text style={styles.hintText}>{softCopyHint}</Text>
        </View>
      ) : null}

      {quizVisible ? (
        <PhototypeQuizSheet
          visible={quizVisible}
          onDismiss={() => setQuizVisible(false)}
          onComplete={handleQuizComplete}
        />
      ) : null}
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
  notSureButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 0,
  },
  // Same info-tone tokens InlineAlert's tone="info" uses — not that
  // component itself (spec §3 Non-Goals): this hint is transient, per-host
  // local state, not wired to phototypeNeedsConfirmation.
  hint: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    backgroundColor: colors.statusInfoTint,
    borderColor: colors.statusInfoLine,
  },
  hintText: {
    ...typography.bodySmall,
    color: colors.statusInfo,
  },
});
