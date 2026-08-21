Status: IN_PROGRESS
Tech Design: docs/tech-design/vials-onboarding-quizzes.md
Code:
- src/types/index.ts (FE-1: UserProfile.sensitive)
- src/utils/routineEngine/migrations.ts (FE-2: v6->v7 bump + sensitive backfill)
- src/utils/routineEngine/migrations.test.ts (FE-2 co-located tests: version bump, backfill, idempotency)
- src/store/profileStore.ts (FE-3: DEFAULT_PROFILE.sensitive)
- src/constants/labels.ts (FE-4: SENSITIVE_LABEL/SENSITIVE_HINT, hoisted FITZPATRICK_DESCRIPTIONS)
- src/screens/onboarding/steps/SkinTypeStep.tsx (FE-5: initialSensitive prop, quiz wiring, Sensitive switch)
- src/screens/onboarding/steps/PhototypeStep.tsx (FE-6: quiz wiring, deriveFitzpatrick pre-select)
- src/screens/onboarding/SkinProfileSetupScreen.tsx (FE-7: initialSensitive plumbing)
- src/components/profile/SkinProfileEditModal.tsx (FE-8: both quiz entry points, Sensitive switch)
- tests/contribution-consent/fixtures.ts, tests/onboarding-5-step-redesign/fixtures.ts,
  tests/routine-engine/fixtures.ts, tests/routine-engine/cycling-and-adaptation.test.ts,
  tests/routine-engine/goal-confirm-routines-screen.test.tsx (fixture-parity: added `sensitive: false`
  to pre-existing full UserProfile literals now that the field is required — same treatment
  hormoneTherapy/pregnantOrBreastfeeding got when they were added)

## Карточка задачи
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [x] QA tests (qa-lead)
- [x] Implementation (engineer)
- [ ] Architecture review (tech-lead)

## Log

2026-08-21 — planner: Read the source brief (`docs/tasks/vials-onboarding-quizzes-task.md`, untracked on
this branch) in full, plus `progress/vials-bottomsheet-consolidation.md` in full (Status: ACCEPTED, PR #44
merged, commit `5f8c779` now on this branch's base — confirmed via `git log`). That log explicitly flagged
several of the source brief's assumptions as stale and instructed re-verification rather than trust. Verified
every one directly against current code before writing anything:

- **`skinType`/`phototype` already exist — confirmed, and the reality is bigger than the brief knew.**
  `src/types/index.ts`: `SkinType` (line 171), `UserProfile.skinType: SkinType | null` (line 214),
  `SkinPhototype` (line 154), `UserProfile.phototype: SkinPhototype | null` (line 220), **plus** a parallel
  `UserProfile.fitzpatrick: FitzpatrickType | null` (line 226, numeric 1–6, schema-v2) with its own sync
  machinery (`deriveFitzpatrick`/`deriveGroupedPhototype`/`syncPhototypeFields` in `migrations.ts`/
  `profileStore.ts`) that the brief's "Type changes" section never mentions at all. Only `sensitive: boolean`
  is genuinely net-new — confirmed by a repo-wide grep (zero matches for a `UserProfile.sensitive` field; the
  only "sensitive" hits are an unrelated clinic `barrierStatus: 'disrupted'|'sensitive'` type, and a
  *forward-referencing* docstring on `Product.isPhysicalExfoliant` that already anticipates "the `sensitive`
  profile flag" as a future addition) — independently corroborated by `docs/specs/vials-bottomsheet-
  consolidation.md` §3/§6, which explicitly names `UserProfile.sensitive` as not-yet-existing and owned by
  this task.
- **"3 grouped phototype cards" is stale — confirmed false in BOTH places, not just onboarding.** Read
  `PhototypeStep.tsx` (onboarding step 3) and `SkinProfileEditModal.tsx` (the actual file behind "Tab 4 /
  `SkinProfileEditor`" — see below): both render 6 individual `FitzpatrickCard`s
  (`src/components/onboarding/PhototypeCard.tsx`), not the grouped 3-card `PhototypeCard` (which still exists
  in the same file but is dead code, unused by either current screen since `onboarding-5-step-redesign`'s
  FE-9). `docs/SCREENS.md`/`PRD_Spec.md`/`IMPLEMENTATION_PLAN.md` and the archived `engine 4.0`/
  `routine-engine-v2.2` doc snapshots still say "3 unlabeled phototype card selectors" for the Tab-4 mention
  specifically — confirmed stale, out of scope to fix here (spec Non-Goals), same treatment as the dependency
  task gave `LocalDataWarningModal`.
- **No shared progress-dots component — confirmed, and moot.** `MarketingSlidesScreen`'s dots
  (`styles.dots`/`dot`/`dotActive`) are local inline styles, not exported. However `QuizSheet.tsx` (already
  shipped by the dependency task) ships its own independent dots implementation
  (`progressRow`/`dot`/`dotActive`) — visually similar, not literally shared, and already built. Nothing left
  for this task to do here.
- **`SkinProfileEditor` is not a component — it's `ProfileScreen.tsx`'s (Tab 4, confirmed 4th
  `Tab.Screen` in `AppNavigator.tsx`) "Skin Profile" card + Edit button, which opens
  `SkinProfileEditModal.tsx`** (a full-screen `pageSheet` `Modal`) — that's the actual file with the skin-type
  chips (line ~145) and Fitzpatrick cards (line ~181) to wire "Not sure?" into. Confirmed by reading both
  files plus grepping every "SkinProfileEditor" reference across `src/`+`docs/`.
- **Bonus staleness beyond what the dependency task flagged:** `SkinProfileSetupScreen.tsx` is a live
  **6-step** flow today (`TOTAL_STEPS = 6`: SkinType→Goals→Phototype→AboutYou→AdditionalInfo→City), not the
  5-step flow `docs/tech-design/onboarding-5-step-redesign.md`/`SCREENS.md`/`PRD_Spec.md` still describe (a
  `CityStep` was added later — see `progress/onboarding-city-step.md`). Used the *real* step numbers
  (SkinTypeStep=1, PhototypeStep=3) when designing; did not perpetuate the stale "5-step" claim.

**Quiz scoring audit against the brief's clinical rationale (`docs/tasks/vials-onboarding-quizzes-task.md`
§Quiz A/B), per the task's explicit instruction to audit rather than re-implement:**
- Read `src/utils/onboardingQuiz/quizScoring.ts` and its `quizScoring.test.ts` in full. Quiz A: exactly 4
  questions (tone/sun-reaction/marks/tanning), no eye/hair-color question, no race/ethnicity labels in any
  `TONE_ANSWERS` copy — confirmed by reading the literal answer label strings in `PhototypeQuizSheet.tsx`.
  Weighting is High/High/Medium/Low (A1=6, A2=5, A3=3, A4=tie-break-only) exactly matching the brief's table;
  A4 can only nudge the result to the *adjacent* bucket inside two narrow bands and has zero effect outside
  them — verified by an exhaustive property test iterating every tone×sunReaction×marks combination across
  all tanning values, confirming the bucket spread A4 alone can produce is never more than 1 band. This is
  **strictly stronger** than the brief's literal minimum bar ("A4 can never override A1"). No defect found.
- Quiz B: exactly 4 questions (B1–B4); B4 sets `sensitive` independent of the sebum axis — confirmed by
  source and dedicated tests. Dehydration guard: `dry` is reachable ONLY when B1=`tight_flaky` AND B2/B3
  report zero shine/breakout signal; any shine corroboration (including via B1's own dedicated
  `tight_but_also_shiny` option) routes to `combination`, never `dry` — matches the brief's described guard
  mechanism exactly (including the brief's own worked example: tight/flaky + T-zone shine → combination, not
  dry — directly covered by a named test). Never emits `dehydrated` — confirmed by source and an explicit
  test. No defect found. One previously-undocumented judgment call found and now written down as binding
  (spec Story 5 AC3): B4's threshold treats both "often reacts" and "sometimes reacts" as `sensitive: true`,
  only "almost never reacts" as `false` — a reasonable single-answer technical read, not a defect.
- **Conclusion: zero implementation tasks against `quizScoring.ts`, `PhototypeQuizSheet.tsx`, or
  `SkinTypeQuizSheet.tsx`.** Per the task's explicit instruction, this is recorded as a verified-correct
  audit finding (spec Story 5, tech design Assumption 6), not silently skipped.

**Real, novel scope for this task** (what the dependency task explicitly left undone): added
`UserProfile.sensitive` via the standard schema-migration path (v6→v7, mirroring the `hormoneTherapy`/
`pregnantOrBreastfeeding` v5→v6 precedent in `docs/tech-design/onboarding-5-step-redesign.md` exactly); "Not
sure?" entry buttons + quiz wiring in `SkinTypeStep.tsx`/`PhototypeStep.tsx` (onboarding) and
`SkinProfileEditModal.tsx` (Tab 4); a pre-select-then-confirm hand-off where `onComplete` only ever touches
each host's own existing local draft state (never calls `updateProfile` directly), so the pre-existing
Next/Save button is the "explicit final confirm tap" the brief's rule 7 requires, with zero new write path;
a `deriveFitzpatrick()`-based mapping (existing helper, reused, not reinvented) from the quiz's 3-bucket
phototype result to one specific pre-selected `FitzpatrickCard`.

**Genuine judgment call flagged, not silently decided:** added a manual "Sensitive skin" `Switch` next to the
quiz entry point (spec Story 4) — the brief only describes `sensitive` as a Quiz-B output, but every
structurally similar boolean flag on `UserProfile` already has a direct manual control, and without one
`sensitive` would be the only write-only-through-quiz field. Flagged in spec §10 Open Questions for explicit
human confirmation.

**Gap classification:** no Type A (business) or Type D (contradiction) gaps found — the ownership boundary
with `vials-bottomsheet-consolidation` was already fully resolved and double-confirmed by the human in that
task's own log before this one started. Every real gap resolved to a Type B assumption backed by direct,
in-repo precedent (schema migration shape, manual-control parity, `deriveFitzpatrick` reuse). Status:
**DESIGNED**, not BLOCKED. Three non-blocking, ship-relevant Open Questions remain (provisional copy,
PRD §6 clinical-review addition, manual-toggle confirmation) — spec Status left at DRAFT until a human
resolves them, matching how `vials-bottomsheet-consolidation`'s spec stayed open until its own two open
questions were answered.

`npx tsc --noEmit` verified clean before starting (no pre-existing errors this task's design could be
mistaken for). No code written — planner scope is spec + tech design only. Proceeding to commit
docs/specs/vials-onboarding-quizzes.md, docs/tech-design/vials-onboarding-quizzes.md, this file, the handoff
JSON, and the previously-untracked `docs/tasks/vials-onboarding-quizzes-task.md` brief itself (same precedent
as `docs/tasks/vials-bottomsheet-consolidation-task.md` being committed alongside that task's planner output
in `5f8c779`). Next: qa-lead, once a human has reviewed the three flagged Open Questions.

2026-08-21 — human requester: resolved the one blocking open question. Story 4's manual "Sensitive skin"
toggle — confirmed as designed: keep the manual control, ships alongside the quiz-driven path, matching
`hormoneTherapy`/`pregnantOrBreastfeeding`/`spfSensitivity` parity. Spec's §10 item checked off, Status
bumped to APPROVED. The other two open questions (provisional soft-copy wording; PRD §6 clinical-review
addition) remain open but are non-blocking/informational per the planner's own classification — do not block
qa-lead or engineer. Proceeding to qa-lead.

2026-08-21 — qa-lead: Wrote integration/component tests for all 8 FE tasks before any implementation
code exists, in `tests/vials-onboarding-quizzes/` (Jest + `@testing-library/react-native`, per
`.claude/rules/testing.md`). Read the spec, tech design, full planner log, the shipped dependency
components (`BottomSheet`, `QuizSheet`, `PhototypeQuizSheet`, `SkinTypeQuizSheet`, `quizScoring.ts`) and
their existing `tests/vials-bottomsheet-consolidation/` suite/fixtures, the real host files
(`SkinTypeStep.tsx`, `PhototypeStep.tsx`, `SkinProfileEditModal.tsx`, `SkinProfileSetupScreen.tsx`,
`profileStore.ts`, `migrations.ts`, `labels.ts`), and the closest sibling precedent
(`tests/onboarding-5-step-redesign/`) before writing anything.

**Files written:**
- `tests/vials-onboarding-quizzes/fixtures.ts` — binding contract for everything the tech design leaves
  open: `testID="not-sure-skintype-button"`/`"not-sure-phototype-button"` on the two ghost "Not sure?"
  buttons (disambiguates the two identical-copy buttons that coexist in `SkinProfileEditModal`);
  `SENSITIVE_LABEL`/`FITZPATRICK_DESCRIPTIONS` imported as VALUES from `@/constants/labels` (binds the
  FE-4 export names, not the still-provisional copy); `testID="quiz-soft-copy-hint"` for the new
  transient hint plus an `expectHintToContainText` helper (no jest-native `toHaveTextContent` in this
  repo — matched `tests/inci-attribution-highlighting/AttributionTooltip.test.tsx`'s existing
  `within(...).getByText(regex)` precedent instead); a `makeProfile()` factory carrying
  `sensitive: boolean`; and, computed directly against `quizScoring.ts`'s documented weight bands (not
  re-deriving or re-testing that math), exact deterministic answer-label sequences that reliably produce
  each phototype bucket (`type_1_2`/`type_3_4`→card IV/`type_5_6`) and each skin-type+sensitive
  combination, so host-wiring tests assert precise pre-selected values instead of "any valid result".
- `profileStore.sensitive-migration.test.ts` — Story 1 (all 3 ACs): `CURRENT_SCHEMA_VERSION === 7`;
  `migrateProfile` backfills `sensitive: false` for a legacy profile missing the field and is idempotent
  (same reference) for an already-migrated one; `useProfileStore.hydrate()` (real store, only
  `@/services/storage` mocked) persists the backfill for a legacy install, defaults to `false` on a
  fresh install, and does not gratuitously re-persist an already-migrated profile.
- `SkinTypeStep.test.tsx`, `PhototypeStep.test.tsx` — Stories 2/3 (and 4 for skin type): entry-button
  presence/style, opens the real quiz sheet, backdrop-dismiss leaves the host untouched, quiz completion
  pre-selects the chip/card + (skin type) the sensitive switch + shows the hint without ever calling
  `onNext`, Skip discards, a later manual tap clears the hint and wins, `deriveFitzpatrick`'s bucket→card
  mapping is asserted exactly (`type_3_4` → card "IV"), and the skin-type step's manual Sensitive switch
  works independently of which chip is selected.
- `SkinProfileEditModal.test.tsx` — same Story 2/3/4 coverage for both entry points living in one Tab-4
  tree at once (testID-disambiguated), Cancel/Close discards in place of Skip, and a reopen-re-seeds
  regression on the existing pre-fill `useEffect`.
- `SkinProfileSetupScreen.sensitive-wiring.test.tsx` — small, FE-7-only: confirms
  `initialSensitive={profile?.sensitive ?? false}` plumbs end-to-end through the real container into the
  real step 1, without re-covering the full 6-step flow already owned by
  `tests/onboarding-5-step-redesign/SkinProfileSetupScreen.test.tsx`.

Deliberately did NOT touch `quizScoring.test.ts` or re-verify `scorePhototype`/`scoreSkinType`'s weights
(Story 5 is a planner-audited, zero-code-change finding, out of qa-lead's scope per the task instructions).

**Verification:** `npx tsc --noEmit` on the pre-existing branch (git-stashing this suite) is clean — 0
errors — confirming every one of the 23 tsc errors introduced by this suite is new and expected
(`UserProfile.sensitive` missing, `SENSITIVE_LABEL`/`FITZPATRICK_DESCRIPTIONS` not exported,
`initialSensitive` excess prop on `SkinTypeStepProps`) — none are typos in the test code itself.
`npx jest --testPathIgnorePatterns="worktrees"` baseline (same stash) is 10 failed / 165 passed suites,
81 failed / 1942 passed tests (10 pre-existing, unrelated failures — stale `palette`/`shadow` token
references in `tests/catalog/*`, not touched by this task). With this suite added: 15 failed / 165
passed suites (exactly +5, all mine) and 119 failed / 1944 passed tests (+38 failed, all expected reds;
+2 passed — both are `migrateProfile` idempotency assertions in `profileStore.sensitive-migration.test.ts`
that legitimately already hold today and will continue to hold once FE-2 lands, not false positives).
Zero regression in any previously-passing suite. Removed one originally-drafted trivial test
(`patch.sensitive` type-only assertion) that would always pass under Babel's non-type-checked runtime
regardless of implementation status — tsc already gates that contract, so it added no real coverage.

Status: IN_PROGRESS. QA tests box checked. Next: engineer implements FE-1..FE-8 against this suite (and
its co-located unit-test obligations per tech design §3) until every test above goes green, then
tech-lead review.

2026-08-21 — engineer (Eva): Implemented FE-1..FE-8 exactly per the tech design, test-file-by-test-file
against qa-lead's suite (`profileStore.sensitive-migration.test.ts` -> `SkinTypeStep.test.tsx` ->
`PhototypeStep.test.tsx` -> `SkinProfileEditModal.test.tsx` -> `SkinProfileSetupScreen.sensitive-wiring
.test.tsx`), each green before moving to the next. No deviation from the tech design's FE shape or the
qa-lead binding contract (testIDs, `SENSITIVE_LABEL`/`FITZPATRICK_DESCRIPTIONS` export names,
`initialSensitive` prop name all used verbatim).

**Judgment calls / additions beyond the tech design's own file list, both logged as required:**

1. **Fixture-parity fix (planned and pre-approved before implementation started).** Adding
   `UserProfile.sensitive` as a required (non-optional) field breaks `tsc` for every pre-existing test
   file that builds a full `UserProfile` object literal under a real (non-`require()`) import — the same
   thing that happened when `hormoneTherapy`/`pregnantOrBreastfeeding` were added. Audited every
   `hormoneTherapy`-containing fixture in the repo (grepped for `contributionConsent:`/`spfSensitivity:
   false` as full-literal markers, then checked typed-`import` vs. untyped-`require()` per file to see
   which ones tsc actually checks) and found 5 that needed a one-line `sensitive: false,` addition:
   `tests/contribution-consent/fixtures.ts`, `tests/onboarding-5-step-redesign/fixtures.ts`,
   `tests/routine-engine/fixtures.ts`, `tests/routine-engine/cycling-and-adaptation.test.ts` (inline
   literal), `tests/routine-engine/goal-confirm-routines-screen.test.tsx` (`makeProfile` factory).
   `tests/routine-engine/draft-preview.test.ts`/`seasonal-masks.test.ts`/`city-field.test.tsx` were
   checked and confirmed safe (untyped `require('@/store/profileStore')`, not tsc-checked).
2. **A 6th fixture file, found only by running the full-suite `tsc` gate, not by the earlier audit:**
   `tests/onboarding-5-step-redesign/fixtures.ts` also declares its OWN local `SkinTypeStepProps`
   interface (a pre-existing drift-detection pattern, not imported from the real component) used by
   `makeSkinTypeStepProps`. Adding `initialSensitive: boolean` to that local interface too (plus the
   factory's default `false`) was required for `tests/onboarding-5-step-redesign/SkinTypeStep.test.tsx`
   to keep compiling. Not anticipated in the pre-approved plan; a direct, mechanical consequence of the
   new required prop, same rationale as item 1.
3. **Quiz sheets mounted conditionally (`{quizVisible && <XQuizSheet .../>}`), not always-mounted-with-
   a-`visible`-toggle as originally planned.** `tests/vials-onboarding-quizzes/
   SkinProfileSetupScreen.sensitive-wiring.test.tsx` is the one qa-lead file in this suite that does NOT
   mock `react-native-safe-area-context` (unlike every other suite touching `BottomSheet`), and it never
   opens the quiz. Always-mounting `SkinTypeQuizSheet` (which renders `BottomSheet` ->
   `useSafeAreaInsets()` regardless of its own `visible` prop, since RN's `Modal` still mounts children
   under `visible={false}` in this test renderer) crashed that one test with "No safe area value
   available." Since qa-lead's test file is binding and out of bounds to edit, switched
   `SkinTypeStep`/`PhototypeStep`/`SkinProfileEditModal` to only render their quiz sheet(s) while
   `quizVisible`/`...QuizVisible` is true. This is behaviorally equivalent (fresh mount at question 1
   every time, same as the sheet's own internal reset-on-`visible=false` effect would produce) and
   doesn't affect any other test's assertions — verified by re-running every affected suite green
   afterward.

**Soft-copy hint implementation note:** built as a plain token-styled `View`+`Text`
(`colors.statusInfoTint`/`statusInfoLine`/`statusInfo`, `radius.md` — the same tokens `InlineAlert`'s
`tone="info"` uses), not `InlineAlert` itself, per spec §3's explicit non-goal. In
`SkinProfileEditModal` (the one host where both quiz entry points live in the same tree), completing
either quiz clears the other's hint so at most one `testID="quiz-soft-copy-hint"` node ever exists at
once — not explicitly required by any single test, but necessary for `getByTestId`'s single-match
contract to hold if a user completed both quizzes in one visit, and cheap to guarantee.

**Verification:** `npx jest tests/vials-onboarding-quizzes/` — 5 suites / 40 tests, all green.
`npx tsc --noEmit` — 0 errors, full project. `npx jest --testPathIgnorePatterns="worktrees"` — 170
passed / 10 failed suites (2067 total: 1984 passed / 81 failed / 2 todo). The 10 failing suites are
byte-for-byte the documented pre-existing `palette.goldenTint`/`shadow.sm` token-drift baseline (fixture
error strings confirmed: `product-detail.test.tsx` "Cannot read properties of undefined (reading
'plumTint')", `catalog-screen.test.tsx` "...'goldenTint'", `add-product-hub.test.tsx` "...'sm'" off
`shadow.sm`, plus `weekly-plan-view-hidden-filter.test.tsx`'s cascading `getProductTypeBadgeStatus is
not a function`) — same count (10 suites / 81 tests) as qa-lead's own pre-implementation baseline
measurement, confirming zero regressions. The +42 newly-passing tests are exactly qa-lead's 40 plus the
2 `sensitive`-backfill cases I added to `migrations.test.ts` per FE-2's own co-located-test obligation.

Status: IN_PROGRESS. Implementation box checked, all tests green, not committing until this log entry
and the handoff JSON are updated (below) — see commit that follows. Next: tech-lead architecture review.
