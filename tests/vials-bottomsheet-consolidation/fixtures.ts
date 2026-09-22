/**
 * Fixtures for the vials-bottomsheet-consolidation suite (qa-lead).
 *
 * Spec:        docs/specs/vials-bottomsheet-consolidation.md
 * Tech design: docs/tech-design/vials-bottomsheet-consolidation.md
 *
 * `BottomSheet` (FE-1) already exists — its prop type is imported straight
 * from the real, shipped module, unchanged. `QuizSheet`/`PhototypeQuizSheet`/
 * `SkinTypeQuizSheet` (FE-3/4/5) do NOT exist yet. Per the precedent in
 * tests/routine-similar-product-priority/fixtures.ts, this header is the
 * BINDING contract qa-lead picked for the details the tech design leaves
 * open (exact prop names/a11y conventions for the net-new components);
 * engineer implements FE-3/4/5 against it, not a guess. Prop types are
 * imported directly (as `import type`, erased at runtime) from the real
 * not-yet-existing component modules below so `tsc` catches any drift the
 * moment they land. This fixtures file itself loads fine before
 * implementation; only the individual *.test.tsx files (which import the
 * real components as VALUES, to render them) fail to resolve until FE-3/4/5
 * ship. That failure is expected and normal for this qa-first pipeline stage.
 *
 * ── BottomSheet (FE-1) — contract additions on top of the EXISTING props ──
 *   Existing public props are unchanged: visible/onClose/children/title?/
 *   dismissOnBackdrop?/contentStyle?/sizing?. FE-1 only changes how bottom
 *   padding is computed (useSafeAreaInsets instead of a static token).
 *   Two test-only hooks (not new public props — internal testIDs) are
 *   required for a11y/style-free assertions of the safe-area + backdrop
 *   behavior, since the sheet surface/backdrop carry no accessible role/text
 *   of their own:
 *     - testID="bottomsheet-backdrop" on the backdrop Pressable.
 *     - testID="bottomsheet-surface" on the sheet's outer surface View (the
 *       node whose padding must reflect insets.bottom).
 *   With a `title`, the close (X) button keeps its current
 *   accessibilityLabel="Close" (via IconButton's existing `label` prop —
 *   already true today, not a new requirement).
 *
 * ── QuizSheet (FE-3) — generic quiz-flow shell ────────────────────────────
 *   Callback naming: keeps the spec's literal Story 3 AC5 wording
 *   (`onDismiss`) for the abandon-mid-quiz callback — this is a NET-NEW
 *   component, not the existing BottomSheet, so tech design Assumption 2
 *   ("keep existing onClose/dismissOnBackdrop names") doesn't dictate its
 *   name. The backdrop-tap boolean keeps BottomSheet's own name
 *   (`dismissOnBackdrop`, default true) for naming consistency within the DS
 *   rather than introducing the brief's `dismissible` alongside it.
 *   props: {
 *     visible: boolean;
 *     onDismiss: () => void;
 *     questions: QuizQuestionDef[];
 *     scoreAnswers: (answersByQuestionId: Record<string, string>) => TResult;
 *     onComplete: (result: TResult) => void;
 *     dismissOnBackdrop?: boolean; // default true
 *   }
 *   Renders on the real (unmocked) BottomSheet — sizing="auto", no title.
 *   A11y contract (qa-lead-specified, no existing shared-dots component to
 *   match per tech design §3 FE-3 note):
 *     - Progress dots container: accessibilityLabel={`Step ${n} of ${total}`}
 *       (1-indexed) — dots stay a purely visual affordance; this is the
 *       screen-reader-accessible equivalent, standard practice for a
 *       dots-only progress indicator.
 *     - Question text: plain visible Text (queryable via getByText).
 *     - Each answer chip: accessibilityRole="radio" (single-select per
 *       question), accessibilityLabel = the answer's `label`,
 *       accessibilityState={{ selected: boolean }} reflecting the currently
 *       chosen answer for that question (radio, not checkbox/button, so
 *       chip queries never collide with the Back / Show result actions).
 *     - Back arrow: accessibilityRole="button", accessibilityLabel="Back".
 *       Absent (not rendered) on question 1; present from question 2 on.
 *       Navigating back preserves that question's previous selection
 *       (chip's accessibilityState.selected stays true).
 *     - Final question only: accessibilityRole="button",
 *       accessibilityLabel="Show result" (visible text "Show result")
 *       instead of auto-advance. No "Next" button is ever rendered on any
 *       question.
 *     - Tapping a chip on a non-final question auto-advances to the next
 *       question ~250-300ms later; no separate action is required.
 *     - Dismissing (backdrop tap, forwarded to the real BottomSheet
 *       underneath, testID="bottomsheet-backdrop") mid-quiz calls onDismiss,
 *       never onComplete. Re-opening (visible false -> true) after a
 *       mid-quiz dismiss starts over at question 1 with no chip selected —
 *       in-progress answers are transient component state, per spec §5.
 *
 * ── PhototypeQuizSheet (FE-4) ──────────────────────────────────────────────
 *   props: {
 *     visible: boolean;
 *     onDismiss: () => void;
 *     onComplete: (result: { phototype: SkinPhototype }) => void;
 *     dismissOnBackdrop?: boolean;
 *   }
 *   Wraps QuizSheet with its own 4 Quiz-A questions/answers (content per
 *   docs/tasks/vials-onboarding-quizzes-task.md §Quiz A — exact copy is
 *   provisional per spec Non-Goals, NOT pinned here) and `scorePhototype`
 *   from src/utils/onboardingQuiz/quizScoring.ts. This suite intentionally
 *   does NOT re-verify scorePhototype's internal weighting invariant
 *   (A4 never outweighs A1) — that pure-logic invariant is FE-2's own
 *   co-located unit-test scope per .claude/rules/testing.md and the task
 *   instructions ("FE-2 ships its own unit tests... NOT qa-lead's scope").
 *   This suite verifies the CONTRACT instead: exactly 4 questions, no
 *   eye/hair-color question or race/ethnicity copy, and onComplete firing
 *   with a validly-shaped SkinPhototype bucket regardless of which answers
 *   were picked.
 *
 * ── SkinTypeQuizSheet (FE-5) ───────────────────────────────────────────────
 *   props: {
 *     visible: boolean;
 *     onDismiss: () => void;
 *     onComplete: (result: { skinType: SkinType; sensitive: boolean }) => void;
 *     dismissOnBackdrop?: boolean;
 *   }
 *   Wraps QuizSheet with its own 4 Quiz-B questions/answers (content per
 *   docs/tasks/vials-onboarding-quizzes-task.md §Quiz B) and `scoreSkinType`.
 *   Same scoping note as PhototypeQuizSheet: the dehydration-guard weighting
 *   invariant is FE-2's unit-test scope, not re-verified here.
 * ───────────────────────────────────────────────────────────────────────────
 */

import type { SkinPhototype, SkinType } from '@/types';

import type { BottomSheetProps } from '@/components/ui/core/BottomSheet';
import type { RoutineSchedulerSheetProps } from '@/components/routine/RoutineSchedulerSheet';

// NOTE: these two imports intentionally target components that do not exist
// yet (QuizSheet, PhototypeQuizSheet, SkinTypeQuizSheet — FE-3/4/5). They are
// type-only (erased at runtime) so this fixtures file itself loads fine; the
// individual test files import the real components as VALUES to render
// them, and THOSE fail to resolve until FE-3/4/5 land — expected,
// tests-first, per progress/vials-bottomsheet-consolidation.md.
import type { QuizSheetProps, QuizQuestionDef } from '@/components/onboarding/QuizSheet';
import type { PhototypeQuizSheetProps } from '@/components/onboarding/PhototypeQuizSheet';
import type { SkinTypeQuizSheetProps } from '@/components/onboarding/SkinTypeQuizSheet';

// ─── BottomSheet prop factory ──────────────────────────────────────────────

export const BOTTOMSHEET_CONTENT_MARKER = 'bottomsheet-content-marker';

export function makeBottomSheetProps(
  overrides: Partial<BottomSheetProps> = {},
): BottomSheetProps {
  return {
    visible: true,
    onClose: () => {},
    children: undefined as unknown as React.ReactNode,
    ...overrides,
  };
}

// ─── RoutineSchedulerSheet prop factory (Story 1 AC4 regression) ─────────

export function makeRoutineSchedulerSheetProps(
  overrides: Partial<RoutineSchedulerSheetProps> = {},
): RoutineSchedulerSheetProps {
  return {
    visible: true,
    productId: 'product-1',
    productType: 'moisturizer',
    onClose: () => {},
    ...overrides,
  };
}

// ─── QuizSheet dummy question set (Story 3, generic shell tests) ──────────

export const DUMMY_QUIZ_QUESTIONS: QuizQuestionDef[] = [
  {
    id: 'q1',
    text: 'Dummy question one?',
    answers: [
      { id: 'q1-a', label: 'Answer A' },
      { id: 'q1-b', label: 'Answer B' },
    ],
  },
  {
    id: 'q2',
    text: 'Dummy question two?',
    answers: [
      { id: 'q2-a', label: 'Answer C' },
      { id: 'q2-b', label: 'Answer D' },
    ],
  },
  {
    id: 'q3',
    text: 'Dummy question three?',
    answers: [
      { id: 'q3-a', label: 'Answer E' },
      { id: 'q3-b', label: 'Answer F' },
    ],
  },
];

export function makeQuizSheetProps(
  overrides: Partial<QuizSheetProps<Record<string, string>>> = {},
): QuizSheetProps<Record<string, string>> {
  return {
    visible: true,
    onDismiss: () => {},
    questions: DUMMY_QUIZ_QUESTIONS,
    scoreAnswers: (answers: Record<string, string>) => answers,
    onComplete: () => {},
    ...overrides,
  };
}

// ─── PhototypeQuizSheet / SkinTypeQuizSheet prop factories ────────────────

export function makePhototypeQuizSheetProps(
  overrides: Partial<PhototypeQuizSheetProps> = {},
): PhototypeQuizSheetProps {
  return {
    visible: true,
    onDismiss: () => {},
    onComplete: () => {},
    ...overrides,
  };
}

export function makeSkinTypeQuizSheetProps(
  overrides: Partial<SkinTypeQuizSheetProps> = {},
): SkinTypeQuizSheetProps {
  return {
    visible: true,
    onDismiss: () => {},
    onComplete: () => {},
    ...overrides,
  };
}

// Re-exported so test files can annotate onComplete-call assertions without
// importing from src/types directly in every file.
export type { SkinPhototype, SkinType };
