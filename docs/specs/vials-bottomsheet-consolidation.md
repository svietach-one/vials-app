# Vials — Reusable BottomSheet Component + Onboarding Quiz Sheets
Date: 2026-08-21
Author: planner-agent
Jira: N/A (kebab-case task slug per agent-layer-protocol.md: `vials-bottomsheet-consolidation`)
Status: APPROVED

## AI-SDLC Flags
```
backend_layer:  false
frontend_layer: true
infra_changes:  false
```

## 1. Problem Statement

Every screen that needs a slide-up bottom sheet today either hand-rolls its own `Modal` + backdrop +
dismiss logic (`DuplicateSlotChoiceSheet`, `ReplaceStepSheet`, and the one-off
`src/components/ui/core/BottomSheet.tsx` used only by `RoutineSchedulerSheet`) or reaches for
`@gorhom/bottom-sheet` directly with its own snap points and backdrop wiring (`FilterSheet`,
`AddToRoutineSheet`, `DraftPreviewScreen`). None of the plain-`Modal` sheets handle safe-area insets
consistently — `core/BottomSheet.tsx` still pads its bottom edge with a static design-token value instead
of the device's actual inset. Two upcoming onboarding "I'm not sure" quizzes (phototype and skin-type)
need exactly this kind of sheet and have no existing pattern to build on without either duplicating one of
the two approaches above or picking one ad hoc. This task formalizes the plain-`Modal` DS pattern that
already exists in `src/components/ui/core/BottomSheet.tsx` into the one shared, safe-area-correct
component new sheet consumers build on, before the onboarding quiz work becomes another independent,
divergent implementation.

## 2. Goals

- One shared `BottomSheet` DS component handles backdrop dismissal, the Android back button, and bottom
  safe-area insets once, so no consumer hand-rolls any of the three.
- `dismissible` behavior (backdrop-tap + hardware back button) is a per-usage prop the consumer sets
  explicitly — never inferred from content or route.
- A reusable quiz-sheet shell (progress indicator, one question per screen, chip-answer auto-advance, back
  navigation, final-question explicit action) exists and is demonstrated by two working quiz sheets
  (phototype, skin-type), each buildable and testable in isolation from any screen or store integration.
- The audit requested by the source brief (`docs/tasks/vials-bottomsheet-consolidation-task.md`) is
  actually performed against current code, not assumed — every claim in its audit table is confirmed or
  corrected in this spec before anything is scoped.

## 3. Non-Goals (explicitly out of scope)

- **`DeleteProductModal` migration.** Confirmed by reading `src/components/product/DeleteProductModal.tsx`:
  it is a centered `Modal` (`alignItems:'center', justifyContent:'center'`, `animationType="fade"`), not a
  bottom sheet. Not touched.
- **`AddProcedureModal` migration.** Confirmed by reading `src/components/clinic/AddProcedureModal.tsx`: it
  is a native `presentationStyle="pageSheet"` full-screen form (`KeyboardAvoidingView` + `SafeAreaView` +
  `ScrollView`), not a content-sized bottom sheet. Its pregnancy/collision/seasonal warnings render as
  inline `InlineAlert` banners inside the scrollable form, not as a separate dismissible layer — the
  brief's framing of a nested "blocking Cabernet warning" needing `dismissible:false` does not match how
  this screen is actually built. Not touched.
- **`LocalDataWarningModal` and the Import/Restore confirmation summary (US-19).** Neither component exists
  anywhere in the current codebase under any name a repo-wide search could find. There is nothing to audit
  or migrate. Not touched.
- **`DisambiguationSheet` migration, as literally specified.** `DisambiguationSheet` does not exist anywhere
  in `src/` — it was only ever planned in `docs/database/db-setup-guide.md`'s Sprint 4 section and never
  built. See Open Question 1. This task performs no migration of it.
- **`CaptureFlowScreen`'s existing candidate-list UI.** The app's actual, shipped "is this your product?"
  flow lives in `CaptureFlowScreen.tsx`'s inline `MatchResultsStep` (a full-screen step, not a modal or
  sheet), built independently during the Product Intelligence milestones without ever using
  `DisambiguationSheet`. It is not named in the source brief's "Touches" list and is not modified here. See
  Open Question 1.
- **Rebuilding the DS sheet on `@gorhom/bottom-sheet`.** `@gorhom/bottom-sheet` is already installed
  (`^5.2.14`) and already used by `FilterSheet`, `AddToRoutineSheet`, and `DraftPreviewScreen` for
  snap-point/gesture-driven sheets. This task keeps the DS `BottomSheet` on its existing plain-`Modal`
  implementation instead (see tech design §4); the gorhom-based pattern is untouched and remains the right
  choice for those existing consumers.
- **Installing any new dependency.** `@gorhom/bottom-sheet` is already in `package.json` and already proven
  to run in Expo Go across three shipped features. No `npx expo install` step is needed; the brief's
  dependency-approval-check instruction does not apply.
- **`UserProfile`/`profileStore` schema changes, or wiring "Not sure?" entry points into
  `SkinProfileSetupScreen`/`ProfileScreen` (Tab 4).** Owned by the separate `vials-onboarding-quizzes` task.
  See Open Question 2.
- **Finalizing quiz copy or exact scoring point-values.** Both quiz sheets ship with the question structure
  and answer text already drafted in `docs/tasks/vials-onboarding-quizzes-task.md`, but with provisional
  relative weights, not final calibrated values. Placeholder-level precision is acceptable for this pass.
- **A `.d.ts` stub file for `BottomSheet`.** See tech design §4 — this is a retired pattern, not the DS's
  current convention.

## 4. User Stories

### Story 1: One shared, safe-area-correct BottomSheet
As an engineer building any bottom-sheet UI in Vials, I want one shared DS component that handles backdrop
dismissal, the hardware back button, and safe-area insets, so I never re-implement any of the three per
screen.

**Acceptance Criteria:**
- [ ] Given a consumer renders `BottomSheet` with `dismissOnBackdrop` omitted or `true`, when the user taps
  the backdrop or presses the Android back button, then `onClose` fires.
- [ ] Given a consumer renders `BottomSheet` with `dismissOnBackdrop={false}`, when the user taps the
  backdrop or presses the Android back button, then nothing happens — the sheet only closes via an explicit
  action the consumer wires up itself.
- [ ] Given the sheet is visible on a device with bottom safe-area insets, when its content renders, then
  the bottom-most content clears the safe area using the device's actual inset value, not a fixed token,
  with no per-consumer inset code.
- [ ] Given `RoutineSchedulerSheet` (the component's one existing consumer), when this task ships, then it
  renders and dismisses exactly as it did before — no visual or behavioral regression.

### Story 2: DisambiguationSheet migration — audited, not assumed
As the engineer picking this task up, I want the DisambiguationSheet migration evaluated against real code
before I start, so I don't spend time migrating a component that was never built.

**Acceptance Criteria:**
- [ ] Given a full-text search of `src/` for `DisambiguationSheet`, when the search runs, then it returns
  zero matches (confirmed 2026-08-21 during planning).
- [ ] Given that, when this task ships, then no file named `DisambiguationSheet.tsx` is introduced and no
  migration of it is attempted.
- [ ] Given the OCR/barcode candidate-picker UX exists today under a different name and shape
  (`CaptureFlowScreen`'s `MatchResultsStep`), when this task evaluates folding it into `BottomSheet`, then
  that decision is explicitly deferred to Open Question 1 rather than decided here, and `CaptureFlowScreen.tsx`
  is not modified.

### Story 3: Reusable quiz-sheet shell
As a user who taps "Not sure? Help me figure it out" beside either card selector, I want a consistent,
low-commitment, one-question-at-a-time sheet, so answering feels quick rather than like a form.

**Acceptance Criteria:**
- [ ] Given the user opens a quiz sheet, when it renders, then it shows exactly one question at a time with
  a progress indicator reflecting the current step out of the total question count.
- [ ] Given the user taps an answer chip on any non-final question, when roughly 250–300ms elapses after
  the tap, then the sheet auto-advances to the next question with no separate "Next" button shown.
- [ ] Given the user reaches the final question, when it renders, then it shows an explicit "Show result"
  button instead of auto-advancing.
- [ ] Given the user is on any question after the first, when they tap the back arrow, then the sheet
  returns to the previous question with that question's previously chosen answer still visible/selectable.
- [ ] Given the sheet is open (default `dismissible: true`), when the user taps the backdrop or otherwise
  dismisses it mid-quiz, then it closes via `onDismiss` and emits no result.

### Story 4: Phototype "not sure" quiz
As a user unsure of my phototype, I want a short guided quiz that works for my actual skin tone, so I land
on a phototype card that fits me, not just users with lighter skin.

**Acceptance Criteria:**
- [ ] Given the phototype quiz, when it renders, then it asks exactly 4 questions — unexposed-skin-tone
  (A1), sun-reaction (A2), post-inflammatory-marks tendency (A3), tanning tendency (A4) — with no eye-color
  or hair-color question and no race/ethnicity label in any copy.
- [ ] Given a user's answers, when the result is scored, then A4 (tanning) alone can never move the result
  away from what A1 (tone) points to — A1's contribution always outweighs A4's.
- [ ] Given the quiz completes, when `onComplete` fires, then it receives one of the app's three existing
  phototype buckets (`type_1_2` / `type_3_4` / `type_5_6`) — never a raw 6-point Fitzpatrick value.
- [ ] Given `onComplete` fires, when no caller has wired it to anything yet (this task ships the sheet
  standalone), then no `UserProfile` field changes as a side effect of the sheet itself.

### Story 5: Skin-type "not sure" quiz
As a user unsure of my skin type, I want a short guided quiz that separates how oily/dry my skin is from
how it reacts to new products, so I don't get a result that conflates the two.

**Acceptance Criteria:**
- [ ] Given the skin-type quiz, when it renders, then it asks exactly 4 questions (B1–B4) as described in
  `docs/tasks/vials-onboarding-quizzes-task.md` §Quiz B, and B4 alone determines the `sensitive` result,
  independent of the sebum-axis questions.
- [ ] Given a user answers B1 as "tight" while also reporting shine in B1 or B2, when the result is scored,
  then the quiz does not resolve to `dry` from tightness alone — the dehydration guard favors the shine
  signal instead.
- [ ] Given the quiz completes, when `onComplete` fires, then it receives `{ skinType, sensitive }` matching
  the existing `SkinType` union plus a boolean, and never emits a `dehydrated` value.

## 5. UX / Behaviour

`BottomSheet` slides up from the bottom over a semi-transparent backdrop (`animationType="slide"`, existing
behavior, unchanged). With a `title`, it shows a centered header row with a close (X) button and no drag
handle; without one, it shows a small drag-handle bar instead (existing behavior). Quiz sheets always
render without a `title`, using their own in-content progress indicator instead.

Each quiz sheet: shows a progress indicator (dots) above the question, the question text, and its answer
chips. Tapping a chip highlights it, waits ~250–300ms, then advances — long enough to register the
selection, short enough not to feel laggy. The first question shows no back arrow (there is nothing to go
back to); every later question does. The final question replaces auto-advance with a "Show result" button.
The result view shows the computed card with soft copy ("Looks like you're closest to…") and requires an
explicit confirm tap from the caller's own screen — this sheet only emits the result via `onComplete`; the
confirm-tap UX itself lives wherever the sheet is consumed (out of scope here, see Non-Goals).

No loading state (fully static, local scoring) and no network-error state (no network call is made). If
the sheet is dismissed mid-quiz, in-progress answers are discarded — they were only ever component-local
state.

## 6. Data Requirements

- New data needed: none persisted by this task. Quiz answers are transient component state, matching the
  "session-local answers" principle already drafted in `docs/tasks/vials-onboarding-quizzes-task.md` — this
  task's components never call AsyncStorage or a Zustand store directly.
- Existing data consumed: `SkinPhototype` and `SkinType` (`src/types/index.ts`) — both already exist and
  are reused as-is for the two quizzes' result shapes. `UserProfile.sensitive` does not exist yet; it is
  out of scope here (Non-Goals) and owned by `vials-onboarding-quizzes`.
- Data retention: N/A — nothing this task ships persists anything.

## 7. Dependencies

- Depends on spec: none. `@gorhom/bottom-sheet` (already installed, already used elsewhere) and
  `src/components/ui/core/BottomSheet.tsx` (already exists) are both pre-existing; this task extends the
  latter in place.
- Blocks: the screen/store-integration half of `vials-onboarding-quizzes` (entry buttons in
  `SkinProfileSetupScreen`/`ProfileScreen`, `UserProfile.sensitive`, final copy/weight sign-off) — that task
  can only wire real screens to the quiz sheets once this one ships.
- External services: none. Fully local, no network calls, consistent with `CLAUDE.md`'s "no AI features
  ship in Phase 1" constraint.

## 8. Security & Privacy

- Authentication required: no (no accounts in Phase 1).
- Data sensitivity: quiz answers touch self-reported skin-tone/skin-type signals but are never persisted or
  transmitted by this task's components — they exist only as in-memory component state and are discarded
  on dismiss or on `onComplete`.
- Compliance considerations: none new. No data leaves the device.

## 9. Success Metrics

No production install base or in-feature analytics exists yet, so success here is engineering/QA
completeness:
- Every Acceptance Criterion above (Stories 1, 3, 4, 5) has a corresponding automated test, and Story 2's
  negative claim (`DisambiguationSheet` does not exist) is documented, not silently dropped.
- `RoutineSchedulerSheet` (the one pre-existing `BottomSheet` consumer) has zero regressions — its existing
  behavior/tests, if any, keep passing unmodified.
- `npx tsc --noEmit` and the full `npm test` suite are clean, per `.claude/rules/testing.md`.

## 10. Open Questions

- [x] **DisambiguationSheet doesn't exist — what, if anything, replaces this deliverable?** Confirmed via
  full-text search: never built, only ever planned in `docs/database/db-setup-guide.md` Sprint 4.
  **Resolved 2026-08-21 by human requester: option (a) — drop the migration deliverable entirely.** No
  `DisambiguationSheet.tsx` is introduced, no migration attempted, `CaptureFlowScreen.tsx` is not touched.
  Story 2's negative-finding ACs stand as written.
- [x] **Scope conflict with `docs/tasks/vials-onboarding-quizzes-task.md`.** That task's own brief treats
  the full quiz build (content, scoring sign-off, `UserProfile`/`profileStore` changes,
  `SkinProfileSetupScreen`/`ProfileScreen` entry points) as its own scope and lists this task only as an
  infrastructure prerequisite ("reusable BottomSheet must exist first") — but this task's own brief
  separately lists "build the onboarding quiz sheets... directly on it" as its own deliverable #3.
  **Resolved 2026-08-21 by human requester: confirmed the planner's proposed split.** This task ships a
  standalone, unwired quiz-sheet shell + two content-complete-but-unwired quiz components (Stories 3–5).
  `vials-onboarding-quizzes` owns store/screen wiring, entry points, and final copy/weight sign-off.
- [ ] **`LocalDataWarningModal` and the Import/Restore confirmation (US-19) don't appear to exist anywhere
  in the codebase**, under any name a repo-wide search could find. Non-blocking — both stay out of scope
  regardless — flagged only so a future migration task doesn't start from the same false premise the source
  brief did. → owner: whoever scopes that future task (no action needed now).
