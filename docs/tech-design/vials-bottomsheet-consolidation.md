# Technical Design: Reusable BottomSheet Component + Onboarding Quiz Sheets
Spec: docs/specs/vials-bottomsheet-consolidation.md
Author: tech-designer
Date: 2026-08-21

## AI-SDLC Flags
```
backend_layer:  false
frontend_layer: true
infra_changes:  false
```

## 1. Architecture Overview

The source brief describes `BottomSheet` and `@gorhom/bottom-sheet` as net-new. Neither is: `@gorhom/bottom-sheet`
(`^5.2.14`) is already installed and already runs in Expo Go via `FilterSheet.tsx`, `AddToRoutineSheet.tsx`,
`DraftPreviewScreen.tsx`; and `src/components/ui/core/BottomSheet.tsx` already exists (plain RN `Modal` +
backdrop `Pressable`, one consumer: `RoutineSchedulerSheet`). The codebase already runs two deliberate,
documented sheet patterns side by side — plain `Modal` (nesting-safe; `ReplaceStepSheet.tsx`'s header
comment documents a real gorhom nested-stack bug that plain `Modal` avoids) and gorhom `BottomSheetModal`
(snap points/gestures, for standalone lists/forms). This task formalizes the plain-`Modal` pattern in place
rather than starting a second, competing file, and rather than porting it onto gorhom.

```
RoutineSchedulerSheet ─┐
PhototypeQuizSheet ────┼──> BottomSheet (src/components/ui/core/BottomSheet.tsx)
SkinTypeQuizSheet ─────┘        plain Modal, dismissOnBackdrop, sizing, useSafeAreaInsets

PhototypeQuizSheet ──┐
SkinTypeQuizSheet ───┴──> QuizSheet (src/components/onboarding/QuizSheet.tsx)
                              generic shell: progress dots, question/chip flow, back arrow
                          └─> quizScoring.ts (pure; src/utils/onboardingQuiz/)

[unchanged] FilterSheet / AddToRoutineSheet / DraftPreviewScreen ──> @gorhom/bottom-sheet
```

`DisambiguationSheet` does not exist in `src/` — never built, only planned in `docs/database/db-setup-guide.md`.
No migration task is defined; see §5.

## 2. API Contracts

N/A — local-only Expo/RN app (AsyncStorage + Zustand), no backend/API layer exists in Phase 1
(`CLAUDE.md`). Component prop shapes are covered under Implementation Tasks below.

## 3. Implementation Tasks

### engineer (scope=frontend)
- FE-1: Replace `core/BottomSheet.tsx`'s static `paddingBottom: space[8]` with `useSafeAreaInsets()`-driven
  bottom padding (e.g. `insets.bottom + space[X]`), satisfying "safe-area insets handled once inside the
  component." Keep the existing `visible/onClose/children/title?/dismissOnBackdrop?/contentStyle?/sizing?`
  API and `RoutineSchedulerSheet`'s current rendering/dismiss behavior unchanged. No `.d.ts` stub
  (Assumption 3). Files: `src/components/ui/core/BottomSheet.tsx`.
- FE-2: `src/utils/onboardingQuiz/quizScoring.ts` — pure (no React/react-native imports), exports
  `scorePhototype(answers) => SkinPhototype` and `scoreSkinType(answers) => { skinType: SkinType; sensitive: boolean }`,
  implementing the weighting/tie-break (A4 never outweighs A1) and dehydration-guard rules from
  `docs/tasks/vials-onboarding-quizzes-task.md` §Quiz A/B, with provisional ordinal weights (Assumption 7).
- FE-3: `src/components/onboarding/QuizSheet.tsx` — generic quiz-flow shell on `BottomSheet` (`sizing="auto"`,
  default `dismissOnBackdrop`/dismissible): progress-dot header (own local styles — no shared dots component
  exists; `MarketingSlidesScreen` only has inline ones), one-question-per-screen body, chip answers with
  ~250–300ms auto-advance (skipped on the last question), back arrow (hidden on question 1), final-question
  "Show result" button, result slot. Takes questions/answers/scoring as props — content-agnostic.
- FE-4: `src/components/onboarding/PhototypeQuizSheet.tsx` — wraps `QuizSheet` with the 4 Quiz-A
  questions/answers and `scorePhototype`; emits `onComplete({ phototype: SkinPhototype })`.
- FE-5: `src/components/onboarding/SkinTypeQuizSheet.tsx` — wraps `QuizSheet` with the 4 Quiz-B
  questions/answers and `scoreSkinType`; emits `onComplete({ skinType, sensitive })`.
- Not included — `DisambiguationSheet` migration: no file, no task. See §5 Open Questions.

### engineer (unit tests, scope=frontend)
- FE-2 ships its own co-located `quizScoring.test.ts` (pure-logic unit tests, per `.claude/rules/testing.md`).
- Component/integration coverage for FE-1/3/4/5 (dismiss/safe-area behavior, `RoutineSchedulerSheet`
  regression, quiz navigation/auto-advance/back-arrow, both quizzes' answer-to-result flow) is qa-lead's
  `tests/vials-bottomsheet-consolidation/` suite per `testing.md`'s layer split — not enumerated here.
  Note for qa-lead: since `BottomSheet`/`QuizSheet` stay plain-`Modal`-based, this suite needs none of the
  `@gorhom/bottom-sheet` jest.mock boundary that `FilterSheet.test.tsx`/`draft-preview-sheet.test.tsx` require.

## 4. Assumptions

- Extend `src/components/ui/core/BottomSheet.tsx` in place instead of creating the brief's literal
  `src/components/ui/BottomSheet.tsx`.
  Alternative: create a second, new top-level file as literally specified.
  Reason: a working, committed `core/BottomSheet.tsx` already exists with a live consumer; a second
  same-named file one directory up would fragment, not consolidate, the exact thing the brief's goal
  targets — every other DS atom (Button, Card, IconButton, Tag, ListRow, TimeChip, FilterChip, PillToggle,
  AppHeader, EmptyState) already lives in `core/`.
- Keep the existing prop names (`onClose`, `dismissOnBackdrop`, `sizing: 'auto'|'fixed'`) instead of the
  brief's proposed (`onDismiss`, `dismissible`, `heightMode: 'content'|'full'`).
  Alternative: rename to match the brief literally.
  Reason: renaming is pure churn on the one working consumer for zero behavioral gain; existing names
  already carry the same semantics (`'fixed'` caps at 90% of window height, the existing meaning of the
  brief's `'full'`).
- No `.d.ts` stub file.
  Alternative: add one, per the brief's literal AC.
  Reason: the `.d.ts`/`.jsx`/`.prompt.md` trio is a leftover from the project's earliest (Jun 19) scaffold;
  every DS component shipped since — including `BottomSheet.tsx` itself — ships `.tsx`-only.
- Underlying implementation stays plain RN `Modal`, not rebuilt on `@gorhom/bottom-sheet`.
  Alternative: rebuild on gorhom for real swipe gestures/snap points.
  Reason: `ReplaceStepSheet.tsx`/`DuplicateSlotChoiceSheet.tsx` already document a real gorhom nested-stack
  hazard that plain `Modal` avoids; neither real consumer here (`RoutineSchedulerSheet`, the two quiz
  sheets) needs snap points, and a plain `Modal` has no swipe gesture to begin with, so `dismissible:false`
  is already fully satisfied without extra gesture-disabling work.
- `DisambiguationSheet` migration is not attempted.
  Alternative: build it fresh, or fold `CaptureFlowScreen`'s `MatchResultsStep` into `BottomSheet`.
  Reason: Type A/D gap — the brief frames this as migrating something that exists; deciding to build new UI
  or refactor a shipped, unrelated screen is a product call this document shouldn't make unilaterally (§5).
- Quiz sheets ship standalone (`onComplete`/`onDismiss` only) — no `UserProfile`/`profileStore` changes, no
  screen integration.
  Alternative: fully wire both quizzes per `docs/tasks/vials-onboarding-quizzes-task.md`.
  Reason: that document's own scope directly overlaps this task's brief (Type D contradiction, §5);
  building it here preempts product decisions this task's brief never specifies.
- Quiz scoring uses provisional ordinal weights (e.g. High=3/Medium=2/Low=1), not final calibrated values.
  Alternative: leave scoring unimplemented until finalized.
  Reason: `vials-onboarding-quizzes-task.md` marks exact weights as "needed before ship" but non-blocking
  for structure; the one testable invariant (A4 never outweighs A1) holds under any correctly-ordered
  weight set.

## 5. Open Questions

- **Resolved 2026-08-21 (human requester):** `DisambiguationSheet` migration dropped entirely (option a).
  No file introduced, `CaptureFlowScreen.tsx` untouched.
- **Resolved 2026-08-21 (human requester):** confirmed the split above — this task ships an unwired shell +
  two unwired quiz components only; `vials-onboarding-quizzes` owns wiring/copy/weight sign-off.
- `LocalDataWarningModal` / Import-Restore confirmation (US-19): not found anywhere in the codebase under
  any name. Non-blocking (out of scope regardless) — flagged for whoever scopes a future migration of
  them. → owner: future task owner, no action needed now.
