import React from 'react';

import { QuizSheet, type QuizQuestionDef } from '@/components/onboarding/QuizSheet';
import {
  MARKS_ANSWERS,
  PHOTOTYPE_QUESTION_IDS,
  SUN_REACTION_ANSWERS,
  TANNING_ANSWERS,
  TONE_ANSWERS,
  scorePhototype,
} from '@/utils/onboardingQuiz/quizScoring';
import type { SkinPhototype } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PhototypeQuizSheetProps {
  visible: boolean;
  onDismiss: () => void;
  onComplete: (result: { phototype: SkinPhototype }) => void;
  /** Whether tapping the backdrop dismisses the sheet mid-quiz. Defaults to true. */
  dismissOnBackdrop?: boolean;
}

// ─── Content (Quiz A) ───────────────────────────────────────────────────────
// Copy per docs/tasks/vials-onboarding-quizzes-task.md §Quiz A. No
// eye/hair-color question, no race/ethnicity labels anywhere (US-03).
// Provisional — exact copy/weights are not final (spec §3 Non-Goals).

const QUESTIONS: QuizQuestionDef[] = [
  {
    id: PHOTOTYPE_QUESTION_IDS.tone,
    text: 'What is the natural tone of skin that rarely sees the sun (e.g. inner forearm)?',
    answers: [
      { id: TONE_ANSWERS[0], label: 'Very light, almost translucent' },
      { id: TONE_ANSWERS[1], label: 'Light beige' },
      { id: TONE_ANSWERS[2], label: 'Medium, golden beige' },
      { id: TONE_ANSWERS[3], label: 'Tan or olive' },
      { id: TONE_ANSWERS[4], label: 'Deep, rich brown' },
    ],
  },
  {
    id: PHOTOTYPE_QUESTION_IDS.sunReaction,
    text: 'How does your skin react to sun with no protection?',
    answers: [
      { id: SUN_REACTION_ANSWERS[0], label: 'Always burns, never tans' },
      { id: SUN_REACTION_ANSWERS[1], label: 'Usually burns, tans only slightly' },
      { id: SUN_REACTION_ANSWERS[2], label: 'Sometimes a mild burn, then tans' },
      { id: SUN_REACTION_ANSWERS[3], label: 'Rarely burns, tans easily' },
    ],
  },
  {
    id: PHOTOTYPE_QUESTION_IDS.marks,
    text: 'After a spot, cut, or irritation, do you tend to get a dark mark left behind?',
    answers: [
      { id: MARKS_ANSWERS[0], label: 'Rarely leaves a mark' },
      { id: MARKS_ANSWERS[1], label: 'Sometimes, fades within a few weeks' },
      { id: MARKS_ANSWERS[2], label: 'Often, and it can take months to fade' },
    ],
  },
  {
    id: PHOTOTYPE_QUESTION_IDS.tanning,
    text: 'How easily does your skin tan?',
    answers: [
      { id: TANNING_ANSWERS[0], label: "Doesn't tan at all" },
      { id: TANNING_ANSWERS[1], label: 'Tans a little' },
      { id: TANNING_ANSWERS[2], label: 'Tans easily and deeply' },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * The phototype "not sure?" quiz — wraps the generic `QuizSheet` shell with
 * Quiz A's 4 questions and `scorePhototype`. Ships standalone: no
 * `UserProfile`/`profileStore` write, no screen integration (spec §3
 * Non-Goals) — `onComplete` is the sheet's only output.
 */
export function PhototypeQuizSheet({
  visible,
  onDismiss,
  onComplete,
  dismissOnBackdrop = true,
}: PhototypeQuizSheetProps) {
  return (
    <QuizSheet
      visible={visible}
      onDismiss={onDismiss}
      dismissOnBackdrop={dismissOnBackdrop}
      questions={QUESTIONS}
      scoreAnswers={(answersByQuestionId) => ({ phototype: scorePhototype(answersByQuestionId) })}
      onComplete={onComplete}
    />
  );
}
