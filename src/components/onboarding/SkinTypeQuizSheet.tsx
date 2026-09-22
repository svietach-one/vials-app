import React from 'react';

import { QuizSheet, type QuizQuestionDef } from '@/components/onboarding/QuizSheet';
import {
  FEEL_ANSWERS,
  MIDDAY_SHINE_ANSWERS,
  PORES_BREAKOUTS_ANSWERS,
  REACTION_ANSWERS,
  SKINTYPE_QUESTION_IDS,
  scoreSkinType,
} from '@/utils/onboardingQuiz/quizScoring';
import type { SkinType } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SkinTypeQuizSheetProps {
  visible: boolean;
  onDismiss: () => void;
  onComplete: (result: { skinType: SkinType; sensitive: boolean }) => void;
  /** Whether tapping the backdrop dismisses the sheet mid-quiz. Defaults to true. */
  dismissOnBackdrop?: boolean;
}

// ─── Content (Quiz B) ───────────────────────────────────────────────────────
// Copy per docs/tasks/vials-onboarding-quizzes-task.md §Quiz B. B1's fifth
// option ("tight right after washing, but I also notice shine in places")
// is the dedicated dehydration-guard signal — see quizScoring.ts. Provisional
// — exact copy/weights are not final (spec §3 Non-Goals).

const QUESTIONS: QuizQuestionDef[] = [
  {
    id: SKINTYPE_QUESTION_IDS.feel,
    text: 'By midday, how does your skin usually feel a few hours after washing with nothing applied?',
    answers: [
      { id: FEEL_ANSWERS[0], label: 'Tight, rough, or flaky' },
      { id: FEEL_ANSWERS[1], label: 'Comfortable, nothing in particular' },
      { id: FEEL_ANSWERS[2], label: 'Slightly shiny, but only in the T-zone' },
      { id: FEEL_ANSWERS[3], label: 'Shiny all over' },
      { id: FEEL_ANSWERS[4], label: 'Tight right after washing, but I also notice shine in places later' },
    ],
  },
  {
    id: SKINTYPE_QUESTION_IDS.middayShine,
    text: 'By midday, where (if anywhere) do you notice shine?',
    answers: [
      { id: MIDDAY_SHINE_ANSWERS[0], label: 'Nowhere' },
      { id: MIDDAY_SHINE_ANSWERS[1], label: 'T-zone only' },
      { id: MIDDAY_SHINE_ANSWERS[2], label: 'Across the whole face' },
    ],
  },
  {
    id: SKINTYPE_QUESTION_IDS.poresBreakouts,
    text: 'How would you describe your pores and breakouts?',
    answers: [
      { id: PORES_BREAKOUTS_ANSWERS[0], label: 'Pores barely visible, breakouts are rare' },
      { id: PORES_BREAKOUTS_ANSWERS[1], label: 'Pores visible in the T-zone, occasional breakouts' },
      { id: PORES_BREAKOUTS_ANSWERS[2], label: 'Pores are large, breakouts are frequent' },
    ],
  },
  {
    id: SKINTYPE_QUESTION_IDS.reaction,
    text: 'How does your skin react when you try a new product?',
    answers: [
      { id: REACTION_ANSWERS[0], label: 'Often stings or turns red' },
      { id: REACTION_ANSWERS[1], label: 'Sometimes reacts' },
      { id: REACTION_ANSWERS[2], label: 'Almost never reacts' },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * The skin-type "not sure?" quiz — wraps the generic `QuizSheet` shell with
 * Quiz B's 4 questions and `scoreSkinType`. Ships standalone: no
 * `UserProfile`/`profileStore` write, no screen integration (spec §3
 * Non-Goals) — `onComplete` is the sheet's only output.
 */
export function SkinTypeQuizSheet({
  visible,
  onDismiss,
  onComplete,
  dismissOnBackdrop = true,
}: SkinTypeQuizSheetProps) {
  return (
    <QuizSheet
      visible={visible}
      onDismiss={onDismiss}
      dismissOnBackdrop={dismissOnBackdrop}
      questions={QUESTIONS}
      scoreAnswers={scoreSkinType}
      onComplete={onComplete}
    />
  );
}
