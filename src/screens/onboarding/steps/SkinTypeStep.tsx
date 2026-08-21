import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SkinTypeQuizSheet } from '@/components/onboarding/SkinTypeQuizSheet';
import { Button } from '@/components/ui/core/Button';
import { FilterChip } from '@/components/ui/core/FilterChip';
import { ListRow } from '@/components/ui/core/ListRow';
import { Switch } from '@/components/ui/forms/Switch';
import { colors, radius, space, typography } from '@/constants/tokens';
import { SENSITIVE_HINT, SENSITIVE_LABEL, SKIN_TYPE_OPTIONS } from '@/constants/labels';
import type { SkinType, UserProfile } from '@/types';
import { StepLayout } from './StepLayout';

// ─── Data ─────────────────────────────────────────────────────────────────────

// testID contract (qa-lead binding contract, vials-onboarding-quizzes).
const NOT_SURE_TEST_ID = 'not-sure-skintype-button';
const SOFT_COPY_HINT_TEST_ID = 'quiz-soft-copy-hint';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SkinTypeStepProps {
  initialSkinType: SkinType | null;
  initialSensitive: boolean;
  onNext: (patch: Partial<UserProfile>) => void;
  onSkip: () => void;
  /** The container's OnboardingProgressRing, forwarded into the header row next to Back. */
  progressRing?: React.ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Step 1 of 6 — skin type. First step in the flow, so there is no Back.
 * Also hosts the "Not sure?" quiz entry point and the manual Sensitive skin
 * toggle (vials-onboarding-quizzes FE-5): a quiz result only pre-selects the
 * chip/switch and shows a soft-copy hint — `onNext` (Next tap) stays the
 * sole write path.
 */
export function SkinTypeStep({
  initialSkinType,
  initialSensitive,
  onNext,
  onSkip,
  progressRing,
}: SkinTypeStepProps) {
  const [skinType, setSkinType] = useState<SkinType | null>(initialSkinType);
  const [sensitive, setSensitive] = useState(initialSensitive);
  const [quizVisible, setQuizVisible] = useState(false);
  const [softCopyHint, setSoftCopyHint] = useState<string | null>(null);

  function handleChipPress(value: SkinType) {
    setSkinType(value);
    setSoftCopyHint(null);
  }

  function handleQuizComplete(result: { skinType: SkinType; sensitive: boolean }) {
    setQuizVisible(false);
    setSkinType(result.skinType);
    setSensitive(result.sensitive);
    const label =
      SKIN_TYPE_OPTIONS.find((o) => o.value === result.skinType)?.label ?? result.skinType;
    setSoftCopyHint(`Looks like you're closest to ${label}. Tap Next to confirm.`);
  }

  return (
    <StepLayout
      title="What's your skin type?"
      subtitle="Choose the option that best describes your skin most of the time."
      onSkip={onSkip}
      onNext={() => onNext({ skinType, sensitive })}
      nextDisabled={skinType === null}
      progressRing={progressRing}
    >
      <View style={styles.chipRow}>
        {SKIN_TYPE_OPTIONS.map((t) => (
          <FilterChip
            key={t.value}
            selected={skinType === t.value}
            onPress={() => handleChipPress(t.value)}
          >
            {t.label}
          </FilterChip>
        ))}
      </View>

      <Button
        variant="ghost"
        size="sm"
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

      <View style={styles.divider} />

      <ListRow
        title={SENSITIVE_LABEL}
        subtitle={SENSITIVE_HINT}
        divider={false}
        style={styles.listRowFlush}
        trailing={
          <Switch
            checked={sensitive}
            onValueChange={setSensitive}
            accessibilityLabel={SENSITIVE_LABEL}
          />
        }
      />

      {quizVisible ? (
        <SkinTypeQuizSheet
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  notSureButton: {
    alignSelf: 'flex-start',
  },
  // Same info-tone tokens InlineAlert's tone="info" uses — not that
  // component itself (spec §3 Non-Goals): this hint is transient, per-host
  // local state, not wired to any persisted confirmation flag.
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
  divider: { height: 1, backgroundColor: colors.borderDivider },
  listRowFlush: { paddingVertical: 0, paddingHorizontal: 0 },
});
