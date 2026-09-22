Status: ACCEPTED
Tech Design: docs/tech-design/vials-bottomsheet-consolidation.md
Code: src/components/ui/core/BottomSheet.tsx (modified); src/utils/onboardingQuiz/quizScoring.ts,
src/utils/onboardingQuiz/quizScoring.test.ts, src/components/onboarding/QuizSheet.tsx,
src/components/onboarding/PhototypeQuizSheet.tsx, src/components/onboarding/SkinTypeQuizSheet.tsx (new)

## Карточка задачи
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [x] QA tests (qa-lead)
- [x] Implementation (engineer)
- [x] Architecture review (tech-lead)

## Log

2026-08-21 — planner: Read the source brief (`docs/tasks/vials-bottomsheet-consolidation-task.md`) in
full, plus `docs/tasks/vials-onboarding-quizzes-task.md` (skim, per instructions — checking only for
dependency/conflict with this task, not planning its scope), `CLAUDE.md`, the relevant `.claude/rules/*`
files, and the reference spec `docs/specs/vials-conflict-matrix-expansion.md` (for structure/flags
convention), before writing the spec and tech design. Verified every claim in the brief against actual
code rather than trusting its description, per the task instructions. Findings that materially changed
scope from what the brief assumed:

- **`@gorhom/bottom-sheet` is already installed** (`^5.2.14`, `package.json`) and already running in Expo
  Go via three shipped consumers (`FilterSheet.tsx`, `AddToRoutineSheet.tsx`, `DraftPreviewScreen.tsx`,
  confirmed via `grep` + `git log`). The brief's claim that it's "not currently in package.json" is false;
  no dependency-approval/`npx expo install` step is needed or included.
- **`src/components/ui/core/BottomSheet.tsx` already exists** (plain RN `Modal`-based, committed on this
  branch, dated Jul 25, one consumer: `RoutineSchedulerSheet.tsx`). The brief describes this as net-new
  work to be built at `src/components/ui/BottomSheet.tsx`. Recommended extending the existing file in place
  instead of creating a second, competing one at the brief's literal path — see tech design §4 Assumption 1.
- **`DisambiguationSheet` does not exist anywhere in `src/`.** A full-text search across the repo returns
  zero matches outside of docs. It was only ever planned in `docs/database/db-setup-guide.md`'s Sprint 4
  section ("Build DisambiguationSheet component (bottom sheet with candidate list)") and referenced as
  "already speced" (not built) in `docs/specs/ocr-brand-dictionary-reference.md`. The actual shipped
  "is this your product?" UX is `CaptureFlowScreen.tsx`'s inline `MatchResultsStep` (a full-screen step,
  not a modal/sheet, not in the brief's Touches list) — it shipped later, during the Product Intelligence
  milestones, without ever building `DisambiguationSheet`. No migration is possible as literally specified
  — flagged as Open Question 1 in both the spec and tech design; Story 2 rewritten to document the negative
  finding with testable ACs rather than assert a migration AC that can't be satisfied.
- **Audit table (brief's "Step 0"), confirmed by reading actual source, not inferred:**
  - `DeleteProductModal` (`src/components/product/DeleteProductModal.tsx`) — centered `Modal`
    (`alignItems:'center', justifyContent:'center'`, `animationType="fade"`). Confirmed NOT a bottom sheet.
  - `AddProcedureModal` (`src/components/clinic/AddProcedureModal.tsx`) — native
    `presentationStyle="pageSheet"` full-screen form (`KeyboardAvoidingView`+`SafeAreaView`+`ScrollView`).
    Its pregnancy/collision/seasonal warnings render as inline `InlineAlert` banners inside the scrollable
    form, not as a separate dismissible layer, so even the brief's own "blocking Cabernet warning needs
    dismissible:false" framing doesn't match how the screen is actually built. Confirmed NOT the
    content-sized sheet pattern this task's component targets.
  - `LocalDataWarningModal` and the Import/Restore confirmation (US-19) — no matching component found
    anywhere in the codebase under any name (`grep` across `src/` for both, plus common alternate names).
  - All four stay out of scope per the brief's explicit instruction, now with confirmed, source-verified
    reasons recorded directly in the spec's Non-Goals so engineer/qa-lead don't second-guess or expand
    scope into any of them.
- **`.d.ts` stub convention is retired, not current.** Only the earliest (Jun 19) scaffold batch (Button,
  Card, IconButton, Tag, ListRow, Switch, Input, Checkbox, SegmentedControl, InlineAlert, ProgressRing,
  TabBar) has leftover `.d.ts`/`.jsx`/`.prompt.md` sibling files from an early design-tool scaffold. Every
  DS component added since (AppHeader, EmptyState, FilterChip, PillToggle, TimeChip, Toast, Select,
  Textarea, Badge, and `BottomSheet.tsx` itself) ships `.tsx`-only. The brief's literal AC ("with a `.d.ts`
  stub matching the existing DS pattern") reflects a stale pattern; dropped via an explicit assumption
  rather than silently ignored.
- **Two coexisting, deliberately-chosen sheet architectures already exist in the codebase**: plain `Modal`
  (`core/BottomSheet.tsx`, `ReplaceStepSheet.tsx`, `DuplicateSlotChoiceSheet.tsx`) and gorhom
  `BottomSheetModal` (`FilterSheet.tsx`, `AddToRoutineSheet.tsx`, `DraftPreviewScreen.tsx`).
  `ReplaceStepSheet.tsx`'s own header comment documents a real, specific hazard: nesting a second
  `BottomSheetModal` inside a parent one breaks gorhom's `stackBehavior="switch"` bookkeeping and slams the
  child shut a frame after it opens. Resolved as an assumption to keep the shared `BottomSheet` on plain
  `Modal` — none of this task's real consumers need gorhom's snap points/gestures, and plain `Modal` is
  nesting-safe by construction.
- **Cross-task scope conflict found with `docs/tasks/vials-onboarding-quizzes-task.md`** (skimmed per
  instructions, not fully planned here): that task's own brief claims full ownership of the quiz build
  (question content, scoring sign-off, `UserProfile`/`profileStore` changes, `SkinProfileSetupScreen`/
  `ProfileScreen` entry points) and lists this task only as an infrastructure prerequisite ("reusable
  BottomSheet must exist first"), while THIS task's own brief separately lists "build the onboarding quiz
  sheets... directly on it" as its own deliverable #3 with its own AC. That sibling doc also carries stale
  assumptions against current code, discovered while checking for the conflict: `SkinType`/
  `UserProfile.skinType` already exist verbatim (`src/types/index.ts` line 171/214 — only `sensitive` is
  genuinely new, confirmed by grep), `PhototypeStep.tsx` already uses 6 individual `FitzpatrickCard`s
  (`src/components/onboarding/PhototypeCard.tsx`) rather than the "3 grouped phototype cards" it assumes,
  and there is no shared progress-dots component — `MarketingSlidesScreen`'s dots are local inline styles,
  not exported. Resolved by scoping this task's quiz deliverable to a standalone, unwired shell
  (`QuizSheet`) + two content-complete-but-unwired quiz components (`PhototypeQuizSheet`,
  `SkinTypeQuizSheet`), leaving store/screen wiring and final copy/weight sign-off to
  `vials-onboarding-quizzes` — flagged as Open Question 2 for explicit human confirmation rather than
  silently picked.

No code written yet. Spec and tech design both carry the same three open questions (DisambiguationSheet
target, onboarding-quizzes ownership split, LocalDataWarningModal/Import-Restore non-existence) — none of
them block Implementation Tasks FE-1 through FE-5, which are fully specified and ready for qa-lead to write
tests against.

2026-08-21 — human requester: resolved both blocking open questions. (1) DisambiguationSheet — option (a),
drop the migration deliverable entirely; no file introduced, `CaptureFlowScreen.tsx` untouched. (2)
Onboarding-quizzes scope split — confirmed planner's proposal as-is: this task ships a standalone, unwired
`QuizSheet` shell + `PhototypeQuizSheet`/`SkinTypeQuizSheet`; `vials-onboarding-quizzes` owns store/screen
wiring and copy/weight sign-off. Spec updated to Status: APPROVED, both questions checked off in
docs/specs/vials-bottomsheet-consolidation.md §10. Third open question (LocalDataWarningModal/Import-Restore
non-existence) remains open but was always non-blocking/informational. Proceeding to qa-lead.

2026-08-21 — qa-lead: read the spec, tech design, existing `src/components/ui/core/BottomSheet.tsx`,
its one real consumer `RoutineSchedulerSheet.tsx` (in full, before writing its regression test), and
`docs/tasks/vials-onboarding-quizzes-task.md` §Quiz A/B for question content grounding. Wrote
integration/component tests against Stories 1, 3, 4, 5's ACs in `tests/vials-bottomsheet-consolidation/`,
before FE-1..FE-5 exist (tests-first, per protocol) — new folder:

- `fixtures.ts` — binding contract for the two areas the tech design leaves open (QuizSheet/
  PhototypeQuizSheet/SkinTypeQuizSheet prop names + a11y conventions; two BottomSheet-internal testIDs),
  mirroring the precedent in `tests/routine-similar-product-priority/fixtures.ts`. Prop types imported
  directly from the real (BottomSheet, already exists) and not-yet-existing (QuizSheet family) component
  modules so `tsc` catches drift once engineer lands FE-3/4/5.
- `BottomSheet.test.tsx` — Story 1 ACs 1-3: dismissOnBackdrop omitted/true/false vs backdrop tap + Android
  back (`Modal.onRequestClose`); safe-area-insets-driven bottom padding (two renders, 0 vs 34pt bottom
  inset, asserts the surface's paddingBottom differs by exactly the delta). Requires two new test-only
  testIDs (`bottomsheet-backdrop`, `bottomsheet-surface`) — documented in fixtures.ts, not new public props.
  Verified against today's code: dismiss-behavior tests already partially pass (Android back-button path),
  backdrop/testID and safe-area tests fail cleanly with "Unable to find an element with testID" (expected,
  FE-1 not shipped yet).
- `RoutineSchedulerSheet.regression.test.tsx` — Story 1 AC4: grounded in the component's actual current
  behavior (always `dismissOnBackdrop={false}`, pre-populates from `deriveProductSchedule`, validates
  at-least-one-period-selected, upserts/removes per period on Save). 8/9 assertions already pass against
  today's implementation (confirms the regression baseline is real, not guessed); the 1 failure is the new
  `bottomsheet-backdrop` testID dependency, expected until FE-1 lands.
- `QuizSheet.test.tsx` — Story 3 ACs 1-5 against a content-agnostic 3-question dummy set: one question at a
  time with an accessible "Step N of total" progress label, chip auto-advance ~250-300ms later with no
  "Next" button, final-question "Show result" button (no auto-advance/complete from a chip alone), back
  arrow hidden on Q1/present after and preserving the prior selection, backdrop dismiss mid-quiz calling
  `onDismiss` (never `onComplete`) and discarding answers on reopen.
- `PhototypeQuizSheet.test.tsx` / `SkinTypeQuizSheet.test.tsx` — Story 4 ACs 1/3/4 and Story 5 AC1/3 driven
  through the REAL QuizSheet + REAL scoring functions (nothing quiz-related mocked): exactly 4 questions,
  no eye/hair-color or race/ethnicity copy (Phototype), `onComplete` payload shape validation (one of the 3
  `SkinPhototype` buckets / `{skinType, sensitive}` with no `dehydrated` value), and no `profileStore`/
  storage-service side effects. Deliberately does NOT re-verify the A4-never-outweighs-A1 tie-break or the
  B1 dehydration-guard weighting invariants — those are FE-2's own co-located `quizScoring.test.ts` unit-test
  scope per `.claude/rules/testing.md` and this task's explicit instructions, not qa-lead's.
- `disambiguation-sheet-not-migrated.test.ts` — Story 2 ACs 1-3 as a filesystem-level regression guard
  (fs.readFileSync source-scan, mirroring `tests/conflict-matrix-expansion/ConflictWarningInline.severity-
  prefix.test.tsx`'s precedent): no `DisambiguationSheet` reference or file anywhere under `src/`, and
  `CaptureFlowScreen.tsx` still defines `MatchResultsStep` with no `DisambiguationSheet`/`BottomSheet`
  reference. Passes today (confirms the negative finding is currently true).

Verified `npx tsc --noEmit` — zero errors outside this new suite; the only errors inside it are the expected
"Cannot find module" for QuizSheet/PhototypeQuizSheet/SkinTypeQuizSheet (don't exist yet). Verified
`npx jest --testPathIgnorePatterns="worktrees"` — no suites outside `tests/vials-bottomsheet-consolidation/`
regressed; pre-existing baseline failures (catalog/product-shelf-card/etc., unrelated to this task) are
unchanged. Judgment calls made where spec/tech design left prop-level detail open (all recorded in
fixtures.ts's header, flagged to human/tech-lead for confirmation): QuizSheet-family keeps the spec's
literal `onDismiss` callback name (Story 3 AC5) rather than BottomSheet's `onClose`, since it's a net-new
component tech design Assumption 2 doesn't cover; the backdrop-toggle prop keeps BottomSheet's existing
`dismissOnBackdrop` name for DS consistency; chip answers use `accessibilityRole="radio"` and Back/Show
result use `accessibilityRole="button"` so tests can query unambiguously; two new BottomSheet-internal
testIDs were added to the contract since the safe-area AC is untestable via accessibility/text alone.
Proceeding to engineer.

2026-08-21 — engineer: implemented FE-1 through FE-5 against qa-lead's binding fixtures.ts contract,
working test-file-by-test-file (`npx jest tests/vials-bottomsheet-consolidation/ src/utils/onboardingQuiz/`
after each piece).

- **FE-1** (`src/components/ui/core/BottomSheet.tsx`, modified in place): swapped the static
  `paddingBottom: space[8]` for `paddingBottom: space[8] + insets.bottom` via `useSafeAreaInsets()`
  (`react-native-safe-area-context`, already a transitive Expo dependency used elsewhere in the app).
  Added the two qa-lead-specified test-only testIDs (`bottomsheet-backdrop` on the backdrop `Pressable`,
  `bottomsheet-surface` on the sheet surface `View`) — no new public props, existing
  `visible/onClose/children/title?/dismissOnBackdrop?/contentStyle?/sizing?` API unchanged.
  `RoutineSchedulerSheet.regression.test.tsx` (Story 1 AC4) passes unmodified against this change.
- **FE-2** (`src/utils/onboardingQuiz/quizScoring.ts` + co-located `quizScoring.test.ts`, new, pure, no
  React/react-native imports): `scorePhototype`/`scoreSkinType` take a `Record<string, string>` keyed by
  question id -> chosen answer id (matching `QuizSheet`'s `scoreAnswers` contract).
  - Phototype: weighted-sum of A1(tone, weight 6)/A2(sun reaction, weight 5)/A3(marks, weight 3) forms a
    "coreTotal" that alone decides the bucket outside two narrow tie-break bands; A4 (tanning, weight 1)
    can only nudge the result inside those bands, and only ever to the *adjacent* bucket — it structurally
    cannot flip a decisive A1(+A2/A3) signal to the opposite bucket. Verified by an exhaustive property
    test (all tone x sunReaction x marks x tanning combinations; the set of buckets A4 alone can produce
    never spans more than one band) plus targeted extreme-value tests, in `quizScoring.test.ts`.
  - Skin type: `sensitive` is derived from B4 alone, independent of B1-B3. The dehydration guard is
    implemented as: `dry` is reachable ONLY when B1='tight_flaky' AND B2/B3 report zero shine — any shine
    corroboration (including via B1's dedicated `tight_but_also_shiny` option) routes to
    `combination`/`oily` instead, never `dry`. Never emits a `dehydrated` value.
- **FE-3** (`src/components/onboarding/QuizSheet.tsx`, new): generic shell on `BottomSheet`
  (`sizing="auto"`), content-agnostic (`questions`/`scoreAnswers`/`onComplete` as props). Chip
  auto-advance delay set to 260ms (within the spec's "~250-300ms" range) — qa-lead's test advances fake
  timers by exactly 260ms, so 280ms (my first attempt) missed it; narrowed to 260ms once the test made the
  upper bound of the acceptable window concrete. Answers reset via a `useEffect` on the `visible` prop
  (transient state, spec §5). Refactored the answer chip and back/show-result footer into local
  sub-components (`QuizAnswerChip`, `QuizFooter`) partway through to keep `QuizSheet` itself under the
  ~50-line function-size guideline in `.claude/rules/architecture-review.md` — no behavior change, all 12
  `QuizSheet.test.tsx` cases still green after the refactor.
- **FE-4/FE-5** (`PhototypeQuizSheet.tsx`, `SkinTypeQuizSheet.tsx`, new): thin wrappers supplying Quiz
  A/B's 4 questions each (copy per `docs/tasks/vials-onboarding-quizzes-task.md` §Quiz A/B, explicitly
  provisional per spec Non-Goals) and the FE-2 scoring functions. No eye/hair-color question or
  race/ethnicity copy anywhere in Quiz A. Neither component imports `profileStore` or the storage
  service — confirmed by qa-lead's mock-call-count assertions.

No deviations from the tech design's Implementation Tasks or Assumptions — FE-1..FE-5 match the spec'd
scope exactly, prop names/testIDs match fixtures.ts verbatim (component code was written against the
already-existing tests, not the reverse). The only judgment calls were the two documented above (auto-
advance delay tuned to 260ms; QuizSheet split into sub-components for line-count hygiene), both
non-behavioral.

Verification: `npx tsc --noEmit` clean (zero errors). `npx jest tests/vials-bottomsheet-consolidation/
src/utils/onboardingQuiz/` — 7 suites, 56/56 tests green. Full `npx jest --testPathIgnorePatterns="worktrees"`
sanity pass — 10 failing suites, all pre-existing and unrelated (catalog/product-shelf-card/routines
weekly-plan-view/shelf-filtering/product-images/inci-attribution — none touch BottomSheet, QuizSheet, or
onboardingQuiz; none of the files those suites import were modified by this task). No console.log/debugger/
TODO/FIXME/HACK in any file this task added or modified. Nothing committed — left for tech-lead review.
Proceeding to tech-lead.

2026-08-21 — tech-lead: ACCEPT. Verified independently, not just re-read the engineer's log:
- Design fidelity: `git diff dev --stat` shows exactly `BottomSheet.tsx` (12 lines) + the 5 new FE-2–FE-5
  files — matches tech design §3 file list precisely. Confirmed no `DisambiguationSheet.tsx` exists and no
  file under `src/components/product/` or `src/components/clinic/` was touched (spec Non-Goals).
- Layer separation: `grep -n "from 'react'" src/utils/onboardingQuiz/quizScoring.ts` — zero matches.
  `grep -rn "AsyncStorage\|fetch("` across all new/changed files — zero matches.
- Duplication: `grep -n "#[0-9a-fA-F]\{6\}"` across the new component files and `BottomSheet.tsx` — zero
  matches; all styling goes through `src/constants/tokens.ts`.
- Type safety gate: `npx tsc --noEmit` — clean.
- Tests: `npx jest tests/vials-bottomsheet-consolidation/ src/utils/onboardingQuiz/` — 7/7 suites, 56/56
  tests green. Full `npx jest --testPathIgnorePatterns="worktrees"` — 165/175 suites pass; independently
  confirmed the 10 failures (`catalog-screen`, `product-shelf-card`, `shelf-filtering`,
  `weekly-plan-view-hidden-filter`, `inci-attribution-highlighting`, `product-detail`, `add-product-hub`,
  `RoutineCalendarView`, `catalog-screen-hide-toggle`, `product-shelf-card-hidden`) all fail on the same
  root cause — `palette.goldenTint`/`shadow.sm` undefined in `tokens.ts` at import time — a pre-existing
  baseline defect with zero import-path overlap with any file this task touched. Not a regression.
- Quality signals: no TODO/FIXME/HACK, no console.log/debugger in any new/changed file. WARNING (non-
  blocking, per severity matrix): `QuizSheet`'s main function body (lines 109–209, ~101 lines including
  JSX render) exceeds the 50-line guideline even after the `QuizAnswerChip`/`QuizFooter` extraction —
  recommend a follow-up split of the render body itself; does not block this merge.
- Judgment-call sanity checks: 260ms auto-advance sits inside the spec's ~250–300ms range and reads as a
  reasonable in-range choice, not a test-chasing hack. `QuizAnswerChip`/`QuizFooter` are pure presentation
  (props in, JSX out, no scoring/state logic) — the single-shell-component design intent holds.

No BLOCKERs. Status set to ACCEPTED. Nothing committed — awaiting human go-ahead to stage/commit.
