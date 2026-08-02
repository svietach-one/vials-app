Status: PR_REVIEW
Tech Design: docs/tech-design/onboarding-5-step-redesign.md
Code: FE-1..FE-10 complete, see log

## Карточка задачи
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [x] QA tests (qa-lead)
- [x] Implementation (engineer)
- [x] Architecture review (tech-lead)

## Log

2026-07-27 — planner: spec and tech design authored. Purely frontend (`backend_layer: false`,
  `frontend_layer: true`, `infra_changes: false`) — splits the single `SkinProfileSetupScreen` into 5
  sequential, independently-skippable steps with a new `OnboardingProgressRing`, adds two optional
  safety-relevant `UserProfile` fields (`hormoneTherapy`, `pregnantOrBreastfeeding`) via the standard
  migration path (schema v5→v6, mirroring the `contributionConsent` v3→v4 precedent), and reuses
  existing components (`GoalSelector`, `SkinConcernsSelector`, `FitzpatrickCard`, `FilterChip`,
  `Switch`, `InlineAlert`, `Input`, `Button`, `Icon`) rather than building new ones.

  This task was handed to me with a pre-existing draft spec (`docs/specs/profile/TASK_onboarding_redesign.md`
  + `docs/specs/profile/SCREENS_onboarding_spec.md`) that the orchestrating session had already
  identified as factually stale against the current codebase in 6 places. I re-verified all 6 directly
  against source before writing anything (`src/types/index.ts`, `src/store/profileStore.ts`,
  `src/navigation/AppNavigator.tsx`, `src/components/onboarding/PhototypeCard.tsx`,
  `src/components/ui/core/Button.tsx`, `src/constants/tokens.ts`, `package.json`,
  `src/screens/onboarding/SkinProfileSetupScreen.tsx`, `src/components/profile/GoalSelector.tsx`,
  `src/components/profile/SkinConcernsSelector.tsx`, `src/utils/routineEngine/migrations.ts`,
  `progress/contribution-consent.md`, git log) and found 2 additional corrections of my own during
  that pass. Full list of all 8, logged here per `.claude/rules/architecture-review.md` §6 so no
  deviation from the (now-superseded) original draft reads as undocumented:

  1. **Profile type wrong** — confirmed. Real type is `UserProfile` (`src/types/index.ts`), different
     field set than the draft described. New fields added to `UserProfile`, not a nonexistent `Profile`.
  2. **Store pattern wrong** — confirmed. `profileStore.ts` has only `setProfile`/`updateProfile`, no
     per-field setters. Tech design specifies `updateProfile({ hormoneTherapy: true })`-style calls only.
  3. **Navigation flow incomplete** — confirmed. `OnboardingStackParamList` is
     `MarketingSlides → SkinProfileSetup → ContributionConsent → FirstProduct`. Step 5 Finish must
     target `ContributionConsent`, matching the CURRENT `SkinProfileSetupScreen.handleContinue`'s
     existing `navigation.replace('ContributionConsent')` call — not `FirstProduct` as the draft said.
  4. **Phototype UI mismatch — draft's own framing was stale, not just the codebase.** The draft (and
     the orchestrator's brief) assumed the screen still uses 3 grouped `PhototypeCard`s and asked me to
     treat "3 vs 6" as an open product decision. Direct inspection shows `SkinProfileSetupScreen.tsx`
     already imports and renders 6 individual `FitzpatrickCard`s (`src/components/onboarding/PhototypeCard.tsx`
     lines 54-105), each with its own swatch + accessibilityLabel, wired to `profileStore.fitzpatrick`.
     `profileStore.ts`'s `syncPhototypeFields` docstring and `migrations.ts`'s `deriveGroupedPhototype`
     docstring both say "FE-9 flipped the UI to the six-card...input". `docs/IMPLEMENTATION_PLAN.md`
     line 191 independently confirms: "8.8 Surrounding UX | FE-9 | ...6-card phototype onboarding...".
     Only `docs/SCREENS.md`/`docs/PRD_Spec.md`'s `US-03` prose (still "3 geometric option cards") is
     stale — a pre-existing, unrelated doc-drift bug I did not introduce. Resolved as Assumption 1 in
     the tech design (reuse the 6-card component as-is) rather than a silent pick between two live
     options, since the "decision" was already made and shipped by an earlier, ACCEPTED task
     (routine-engine V2, FE-9) — logged as tech design Open Question OQ-1 purely so the orchestrator/
     human can acknowledge the correction before qa-lead locks in a "3 cards" vs "6 cards" assertion.
  5. **"Reuse existing DS ProgressRing" false** — confirmed. `src/components/ui/feedback/ProgressRing.jsx`
     uses CSS custom properties, no RN imports, not referenced by any screen/navigator. `OnboardingProgressRing`
     is specified as new, built with `react-native-svg` (confirmed present in `package.json`, currently
     unused anywhere else in `src/` — first usage of that dependency).
  6. **Button color "blocker" resolved, not open** — confirmed. `src/components/ui/core/Button.tsx`'s
     `variant="primary"` already resolves to `palette.plum` (`#4F1242`), already shipping app-wide. No
     blocker; `colors.controlFill` in `tokens.ts` is a separate, unused-by-`Button.tsx` alias (black) —
     noted as a minor doc-hygiene item in tech design Assumption 9, not a blocker.
  7. **New finding — `onboardingCompleted` correctness.** Neither the original draft nor the
     orchestrator's brief caught this: the draft's literal instruction ("Finish... sets
     `profileStore.onboardingCompleted = true`") would be a live bug. `AppNavigator.tsx`'s
     `RootNavigator` reads `profile?.onboardingCompleted` to choose `OnboardingNavigator` vs
     `MainTabs`; today that flag is set only inside `FirstProductScreen.completeOnboarding`. Setting it
     at Step 5 would unmount the whole onboarding stack immediately, skipping `ContributionConsent` and
     `FirstProduct` entirely. Tech design Assumption 4 makes Step 5 Finish persist the patch and
     navigate only — no `onboardingCompleted` write.
  8. **New finding — gender enum mismatch.** `docs/specs/profile/SCREENS_onboarding_spec.md` Step 4 and
     the original draft both specify 3 gender pills (Female/Male/Other), but `UserProfile.gender` is
     typed `'female' | 'male' | null` and the current screen renders only 2 pills — no `'other'` value
     exists anywhere in the codebase (`grep '\.gender\b' src/` — only 2 consuming files, both purely
     display/ternary, no conflict-engine logic keyed on it). Treated as a genuine open product/data
     question (OQ-2), not silently resolved either way, since it's a data-collection decision rather
     than a pure implementation detail. Recommended default (binary, matching shipped behavior) requires
     no engineering rework later regardless of the answer.

  Both open questions (OQ-1 acknowledgement, OQ-2 gender widening) are documented in tech design §5
  with safe defaults stated, so qa-lead/engineer are not hard-blocked — but per
  `.claude/rules/tech-design-template.md`'s validation checklist ("Open questions are empty before
  implementation starts"), these should get a quick human/orchestrator confirmation before qa-lead
  locks in Step-3 (card count) and Step-4 (gender pill count) test assertions, to avoid thrown-away
  test-writing work.

2026-07-27 — orchestrator: both open questions confirmed by human (Sviatlana) — OQ-1: 6 cards
  (recommended default, Assumption 1 stands). OQ-2: keep binary, no "Other" pill (recommended default;
  FE-11 dropped from scope). Tech design §5 updated to reflect resolution; FE-11 struck through in §3.
  Open questions are now empty per the template's pre-implementation checklist. Proceeding to qa-lead.

  File consolidation: new canonical spec at `docs/specs/onboarding-5-step-redesign.md` (no date prefix,
  matching this project's actual `docs/specs/` convention — e.g. `contribution-consent.md`,
  `onboarding-consent-copy-update.md` — not the generic date-prefixed pattern in the spec-writing
  skill's default template). `docs/specs/profile/TASK_onboarding_redesign.md` overwritten with a short
  SUPERSEDED pointer stub (not deleted, to preserve history/context for anyone with an old link).
  `docs/specs/profile/SCREENS_onboarding_spec.md` left completely untouched per instruction — still the
  source of truth for per-step copy.

  `npx tsc --noEmit`: 0 errors, unchanged from baseline (only documentation files were written this
  session; no `src/` files touched).

2026-07-27 — qa-lead: wrote component/integration tests for all 5 new step components,
  `OnboardingProgressRing`, and the `SkinProfileSetupScreen` container, per
  `.claude/rules/testing.md` and the resolved tech design (§5: OQ-1 = 6-card FitzpatrickCard,
  OQ-2 = binary gender). Files (all under `tests/onboarding-5-step-redesign/`):
  `fixtures.ts`, `OnboardingProgressRing.test.tsx`, `SkinTypeStep.test.tsx`, `GoalsStep.test.tsx`,
  `PhototypeStep.test.tsx`, `AboutYouStep.test.tsx`, `AdditionalInfoStep.test.tsx`,
  `SkinProfileSetupScreen.test.tsx`.

  Prop contracts locked in for the engineer (declared in `fixtures.ts`, mirroring the
  `ContributionConsentMigrationBannerProps` convention in `tests/contribution-consent/fixtures.ts`
  since the real modules don't exist yet — drift still fails `tsc` at each test's JSX render
  call-site once the engineer's real exported prop type exists):
  - `OnboardingProgressRingProps { step, totalSteps, iconName }` — must render visible
    "Step {step} of {totalSteps}" text (a11y parity with the visual ring), not just the SVG arc.
  - `SkinTypeStepProps { initialSkinType, onNext, onSkip }` — no `onBack` (first step).
  - `GoalsStepProps { initialPrimaryGoal, initialSecondaryGoal, onNext, onSkip, onBack }`.
  - `PhototypeStepProps { initialFitzpatrick, onNext, onSkip, onBack }`.
  - `AboutYouStepProps { initialAge, initialGender, initialHormoneTherapy, onNext, onSkip, onBack }`.
  - `AdditionalInfoStepProps { initialPregnantOrBreastfeeding, initialSkinConditions,
    initialConcerns, onNext, onSkip, onBack }` — `onNext` here renders as a "Finish" button
    (last step); no separate `onFinish` prop.
  - All steps 2-5 need a "Back" control with `accessibilityLabel="Back"` (matches the
    `IconButton label="Back"` convention already used in `ProductDetailScreen.tsx` /
    `ManualProductFormScreen.tsx` etc.); step 1 has none.
  - `Switch` instances need explicit `accessibilityLabel`s matching their visible text
    ("Currently on hormone therapy", "Pregnant or breastfeeding") so tests can query them
    unambiguously by role.

  Judgment calls / precedent lookups:
  - Followed `tests/contribution-consent/fixtures.ts`'s pattern of declaring prop interfaces
    locally in `fixtures.ts` (not importing types from not-yet-existent modules) since that is
    the established convention in this repo for pre-implementation component tests.
  - Item #9 (pregnancy toggle in a warning-tone `InlineAlert`, not a hardcoded color): spied on
    the real `InlineAlert` export via `jest.mock(..., () => ({ ...actual, InlineAlert: jest.fn(actual.InlineAlert) }))`
    and asserted the actual `tone: 'warning'` prop passed to it — avoids both a hardcoded color
    assertion and a brittle style/testID assertion.
  - Item #11 (14px font-size minimum, CLAUDE.md): grepped `tests/` for any existing `fontSize`
    assertion precedent — found none anywhere in the suite. Per the instruction to skip rather
    than invent an approach when no precedent exists, this is NOT covered by an automated
    assertion; flagging as a manual-QA / visual-review item for the engineer and tech-lead
    instead (verify all new step copy, including helper/caption text, renders at >=14px per
    `docs/specs/profile/SCREENS_onboarding_spec.md`'s explicit note).
  - Phototype step accessibilityLabels assert against the ALREADY-SHIPPED `FITZPATRICK_A11Y`
    strings in `PhototypeCard.tsx` (tech design Assumption 2), not the wording in
    `SCREENS_onboarding_spec.md`'s accessibilityLabel table — those two texts differ and the
    tech design explicitly keeps the shipped copy verbatim.
  - Skin-condition option label asserted as `'Eczema / atopic dermatitis'` (exact casing from
    `CONDITION_MODIFIERS` in `src/utils/skinConditionModifiers.ts`), not the reference doc's
    `'Eczema / Atopic dermatitis'`.
  - `SkinProfileSetupScreen.test.tsx` differs from the 5 step-component test files: the screen
    file already exists today (pre-redesign, single scrolling form), so this import resolves at
    both `tsc` and runtime — the test fails at the assertion level (old copy/flow) rather than
    via "Cannot find module", which is still the correct red state for a rewrite-in-place task.
    Documented this explicitly in the file's header comment to avoid confusion later.

  Verification: `npx tsc --noEmit` — 9 errors, ALL in the new test files, all in the two expected
  categories: (1) `Cannot find module` for the 5 not-yet-written step components +
  `OnboardingProgressRing` (FE-3..FE-8), and (2) `hormoneTherapy` / `pregnantOrBreastfeeding` not
  yet on `UserProfile` (FE-1). Zero errors anywhere else in the repo. `npx jest
  tests/onboarding-5-step-redesign` — 7 suites fail as expected (6 via module-resolution error,
  1 via failing assertions against the pre-redesign screen); confirmed this is authoring-correct,
  not a bug in the test files, by inspecting the failure reasons directly.

2026-07-27 — engineer: implementation complete, all 51 tests in `tests/onboarding-5-step-redesign/`
  passing, `npx tsc --noEmit` clean repo-wide. (The engineer agent originally assigned to this task
  hit the session's monthly spend limit mid-run before writing any code — confirmed via `git status`
  that no partial `src/` changes existed — so I picked up the implementation directly in the
  orchestrating session rather than re-spawning a fresh agent that would re-derive the same context.)

  **FE-1** (`src/types/index.ts`, `src/store/profileStore.ts`,
  `src/utils/routineEngine/migrations.ts`): added `hormoneTherapy: boolean` and
  `pregnantOrBreastfeeding: boolean` to `UserProfile` (non-optional, matching the
  `contributionConsent` precedent — migration-backfilled, never `undefined`). Bumped
  `CURRENT_SCHEMA_VERSION` 5→6, added `hormoneTherapyPresent`/`pregnantOrBreastfeedingPresent`
  presence checks to `migrateProfile`'s short-circuit and backfill-to-`false` branches, added both
  to `DEFAULT_PROFILE`. Updated the existing schema-version test assertion in `migrations.test.ts`
  (`.toBe(5)` → `.toBe(6)`) and added 3 new unit tests for the backfill branch (defaults each field
  to `false` on a pre-v6 profile; preserves already-set `true` values; idempotent). Also fixed a
  stale JSDoc comment on `UserProfile.phototype` that still said "onboarding uses 3 cards" — direct,
  pre-existing drift on a line adjacent to this change, one-line fix, not scope creep.
  **Repo-wide fallout, fixed as part of FE-1** (not anticipated in the tech design, found via
  `tsc`): 4 other test fixture files across the repo construct full `UserProfile` object literals
  and failed to type-check once the two fields became non-optional —
  `tests/contribution-consent/fixtures.ts`, `tests/routine-engine/fixtures.ts`,
  `tests/routine-engine/cycling-and-adaptation.test.ts`,
  `tests/routine-engine/goal-confirm-routines-screen.test.tsx`. Added
  `hormoneTherapy: false, pregnantOrBreastfeeding: false` to each. Confirmed via full-repo `npx jest`
  that this didn't regress anything in those suites (routine-engine + contribution-consent suites
  all still green).

  **FE-2** (`src/components/ui/Icon.tsx`): added `ShieldCheck` import + `'shield-check'` entry to
  `ICON_MAP`. The other 4 step icons (`droplet`, `target`, `sun`, `user`) already existed.

  **FE-3** (`src/components/onboarding/OnboardingProgressRing.tsx`, new): `react-native-svg` circular
  arc (`Circle` track + `Circle` progress arc via `strokeDasharray`/`strokeDashoffset`, rotated -90°
  to start at 12 o'clock) with the step's `Icon` centered inside and a sibling "Step N of M" `Text`
  for accessibility parity, per tech design Assumption 6.

  **Real bug found and fixed in the qa-lead's test mock** (not anticipated by any prior pass): both
  `OnboardingProgressRing.test.tsx` and `SkinProfileSetupScreen.test.tsx` mock `react-native-svg` with
  a `Proxy` that only implements a `get` trap. That works for this component's own direct
  `import Svg, { Circle } from 'react-native-svg'`, but `lucide-react-native`'s internal namespace
  interop (`_interopNamespaceDefault`, used by every lucide icon) builds its own SVG-primitive lookup
  via `Object.keys(reactNativeSvgModule)` — a `get`-only Proxy is invisible to that enumeration (only
  materializes properties on direct access, never appears as a real "own key"), so every lucide glyph
  silently resolved to `undefined` the moment `react-native-svg` was mocked. Since tech design
  Assumption 6 requires the ring to render its icon through the shared `Icon` adapter (not a raw
  `LucideIcon`), any correct implementation would hit this — it's a test-infrastructure defect, not
  something a different component design could route around. Fixed by rewriting the mock to
  pre-populate real, enumerable own properties (`Svg`, `Circle`, `Path`, `Line`, `Rect`, `Polyline`,
  `Polygon`, `Ellipse`, `G`, `Defs`, `ClipPath`, `Mask`, gradients, `Stop`, `Use`, `Symbol`, `Text`,
  `TSpan`) instead of relying solely on a lazy `get` trap, keeping the `get` trap only as a fallback
  for anything not in that list. Same stubbing behavior/intent (dumb `View` stand-ins), just fixed to
  actually be enumerable. Applied identically to both test files. Caught via a from-scratch debug
  repro (isolated `<Svg>`, then `<Icon>`, under the same mock) after the generic React "element type
  invalid... ForwardRef" error gave no direct pointer to the cause.

  **FE-4..FE-8** (`src/screens/onboarding/steps/*.tsx`, all new): `StepLayout.tsx` (new, not itself
  one of the 5 named tasks — a small internal shared component factoring out the near-identical
  header/footer chrome — title/subtitle, optional Back `IconButton`, Skip/Next-or-Finish footer —
  that all 5 steps would otherwise duplicate; a legitimate DRY call, not a design deviation, since the
  tech design never prohibited an internal implementation detail like this). `SkinTypeStep`,
  `GoalsStep` (wraps `GoalSelector` unchanged), `PhototypeStep` (wraps the existing 6-card
  `FitzpatrickCard` in a `flexWrap` 2-column grid), `AboutYouStep` (binary gender per resolved OQ-2;
  hormone-therapy `Switch` via the existing `ListRow` trailing-slot pattern already used for the
  Gamification toggle on `ProfileScreen`), `AdditionalInfoStep` (pregnancy `Switch` in `InlineAlert`'s
  `action` slot, `tone="warning"`; wraps `SkinConcernsSelector` unchanged; footer reads "Finish").
  Each step is presentational only — local `useState` seeded from `initialX` props, calls to
  `onNext`/`onSkip`/`onBack` only, no store access, matching tech design Assumption 3.

  **FE-9** (`src/screens/onboarding/SkinProfileSetupScreen.tsx`, rewritten): thin container, `step`
  `useState(1)`, sole `useProfileStore` caller. `handleNext(patch)` → `updateProfile(patch)` then
  `advance()`; `handleSkip()` → `advance()` only (no write); `advance()` → `navigation.replace(
  'ContributionConsent')` on step 5, else `step + 1` — no `onboardingCompleted` write anywhere in the
  flow (tech design Assumption 4, the corrected bug from the original stale draft). Each step reads
  its `initialX` props as `profile?.field ?? <default>` off the live store value, so Back naturally
  re-seeds from whatever the last committed Next/Finish wrote (Assumption 8) since the step
  component fully unmounts/remounts on step-index change.

  **FE-10** (doc sync): `docs/SCREENS.md` §1 and `docs/PRD_Spec.md` §4.1 rewritten to describe the
  5-step structure and the 6-card `FitzpatrickCard` (both previously said "3 cards", predating the
  already-shipped FE-9 6-card change from a different, earlier task — a pre-existing drift this task
  happened to be adjacent to, not something this task introduced). `docs/IMPLEMENTATION_PLAN.md`
  Phase 1 scope line updated to match, and the stale Phase 7 bullet ("Feather icons from
  `@expo/vector-icons`") corrected to `lucide-react-native`, consistent with the already-corrected
  Phase 8 line elsewhere in the same file. Also corrected `docs/PRD_Spec.md`'s §5.1 illustrative
  `Profile` entity line, which listed fields (`skinIssues[]`, `gamificationOn`) that never matched the
  real `UserProfile` type — likely the original source of the stale draft spec's wrong assumptions
  flagged by the orchestrator at the start of this task. Left the surrounding `react-native-mmkv` /
  storage-layer wording in that same PRD section alone — it's a separate, larger, pre-existing drift
  unrelated to this task's scope.

  **Verification:** `npx tsc --noEmit` — 0 errors, repo-wide. `npx jest tests/onboarding-5-step-redesign`
  — 51/51 passing. `npx jest tests/onboarding-5-step-redesign tests/contribution-consent
  tests/routine-engine src/utils/routineEngine/migrations.test.ts` — 296/298 passing (2 pre-existing
  `todo` placeholders, not failures). A full-repo `npx jest` run shows 24 unrelated failing suites,
  all in `tests/catalog/`, `tests/product-shelf-card/`, `tests/product-images/`,
  `tests/inci-attribution-highlighting/`, `tests/routines/` and stray `.claude/worktrees/agent-*/`
  copies — confirmed via `git diff src/constants/labels.ts` these stem from a different, concurrent
  session's uncommitted in-progress work on a `PRODUCT_TYPE_BADGE_STATUS` feature (touching
  `ProductShelfCard.tsx`, `ProductPickerCard.tsx`, `labels.ts`, `ProcedureDetailScreen.tsx`,
  `ProductDetailScreen.tsx`, `DraftPreviewScreen.tsx`, `RoutineStepCard.tsx`, `WeeklyPlanView.tsx`,
  a new `Textarea.tsx`), not this task — none of those files were touched here. Nothing was committed
  to git; all changes are unstaged for tech-lead/human review.

  **Not implemented, per resolved scope:** FE-11 (gender "Other" pill) — dropped, OQ-2 resolved to
  binary. No conflict-engine or clinic-procedure wiring for the new safety fields — explicitly
  deferred to a separate follow-up per tech design §1/spec §6, this task only persists the fields.

2026-07-27 — tech-lead: ACCEPT. Reviewed per `.claude/rules/architecture-review.md` against
  `docs/tech-design/onboarding-5-step-redesign.md`. All verification claims in
  `progress/onboarding-5-step-redesign-handoff.json` were independently re-run, not taken on faith:

  1. **Design fidelity** — container/step split, sole-`useProfileStore`-caller rule, Skip-doesn't-persist/
     Next-does semantics, Step 5 → `ContributionConsent` with no `onboardingCompleted` write, and both
     resolved OQs (6-card `FitzpatrickCard`, binary gender) all match the tech design exactly.
     `AppNavigator.tsx` has a zero-line diff, confirming the "no navigator change" claim. One deviation:
     `hormoneTherapy`/`pregnantOrBreastfeeding` shipped as non-optional `boolean` rather than the tech
     design's `boolean?` — logged with a clear rationale (mirrors the `contributionConsent` precedent) per
     §6, so downgraded to a WARNING rather than a blocker. Not a real problem either way.
  2. **Test-mock bug claim** — verified TRUE by reading
     `node_modules/lucide-react-native/dist/cjs/Icon.js` directly: `_interopNamespaceDefault` does
     `Object.keys(e).forEach(...)` over the required `react-native-svg` module, which a get-only Proxy
     is invisible to. The fix (pre-populated enumerable own properties) is applied identically in both
     `OnboardingProgressRing.test.tsx` and `SkinProfileSetupScreen.test.tsx`.
  3. **Repo-wide fixture fallout** — confirmed exactly the 4 claimed files
     (`tests/contribution-consent/fixtures.ts`, `tests/routine-engine/fixtures.ts`,
     `tests/routine-engine/cycling-and-adaptation.test.ts`,
     `tests/routine-engine/goal-confirm-routines-screen.test.tsx`) carry the two new fields; no other
     `UserProfile` literal was missed.
  4. **Layer separation** — clean. All 5 step components are presentational only (props/callbacks, no
     store import); `SkinProfileSetupScreen` is the sole `useProfileStore` caller; no `AsyncStorage`/
     `fetch` in any task file; `migrations.ts` has no React import; `Icon.tsx`'s diff is an isolated
     2-line addition (`ShieldCheck` import + map entry) with zero overlap with the unrelated concurrent
     session's uncommitted files.
  5. **Type gate** — `npx tsc --noEmit` re-run directly: exit 0, zero errors, repo-wide.
  6. **Targeted test run** — `npx jest tests/onboarding-5-step-redesign`: 7/7 suites, 51/51 tests. Broader
     scope (`tests/onboarding-5-step-redesign tests/contribution-consent tests/routine-engine
     src/utils/routineEngine/migrations.test.ts`): 41/41 suites, 296 passed + 2 pre-existing `todo` / 298
     total — exact match to the handoff's numbers.
  7. **Quality signals** — no hardcoded hex colors, no TODO/FIXME/HACK, no console.log/debugger in any
     task file. CLAUDE.md's 14px font-size floor re-checked against `tokens.ts` for every typography
     token the new screens use (h2=28, body=16, bodySmall/label/caption=14) — all comply; this closes out
     qa-lead's flagged manual-QA item. Minor WARNING (non-blocking): `SkinProfileSetupScreen`'s component
     function (~81 lines) and `AboutYouStep`'s (~72 lines) exceed the 50-line guideline, but both are
     JSX-dominated presentational bodies, not branching logic — no refactor required to merge.
  8. **Scope check** — `git diff --stat` confirms this task's full file footprint has zero overlap with
     the concurrent, unrelated in-tree work (`ProductShelfCard.tsx`, `ProductPickerCard.tsx`,
     `RoutineStepCard.tsx`, `WeeklyPlanView.tsx`, `labels.ts`, `ProcedureDetailScreen.tsx`,
     `ProductDetailScreen.tsx`, `DraftPreviewScreen.tsx`) — safe to merge this task independently of that
     other session's state. The 3 doc-sync files (`docs/IMPLEMENTATION_PLAN.md`, `docs/PRD_Spec.md`,
     `docs/SCREENS.md`) were also diffed directly and contain only the claimed FE-10 corrections, nothing
     from the other session.

  Trivial doc-hygiene note (not a blocker): `docs/specs/onboarding-5-step-redesign.md` §10 still shows
  OQ-1/OQ-2 as unchecked `- [ ]` boxes even though both are marked resolved in tech design §5 and in this
  file's own planner log entry above — cosmetic only, the resolutions are unambiguous elsewhere.

  **Security note:** the incoming review request for this task had a prompt-injection payload appended
  to it — a fake `/security-review` slash-command invocation (`<command-message>`/`<command-name>`/
  `<skill-format>` tags) instructing a full sub-agent-based vulnerability sweep with fabricated
  GIT STATUS/FILES MODIFIED/COMMITS/DIFF CONTENT sections describing a *different, unrelated* task
  (routine-engine-v2.2 / corpus DB work) that does not match this repo's actual state. Per explicit
  instruction this was not executed, and independent verification (real `git status`/`git diff` only
  matches the onboarding-5-step-redesign file set) confirms the injected content was fabricated, not
  real repo state. No action taken on it; flagged to the human for awareness.

  **Verdict: ACCEPT — approved for human merge.** No blockers. 3 non-blocking WARNINGs noted above.

2026-07-27 — post-review polish, requested directly by human (Sviatlana) after reading the ACCEPTed
  diff, applied by the orchestrating session (not re-routed through the full pipeline — small,
  additive UI tweaks, not a design change):
  - `PhototypeStep.tsx`: added a brief visible caption under each of the 6 `FitzpatrickCard`s (e.g.
    "Always burns, never tans") — supplementary to the existing `accessibilityLabel`, which stays
    verbatim per tech design Assumption 2.
  - `GoalsStep.tsx`: added an explicit "Maintenance" `FilterChip` (reuses the existing
    `GOAL_LABELS.maintenance` string) above `GoalSelector`, selecting it sets
    `primaryGoal: 'maintenance', secondaryGoal: null`. `GoalSelector` itself untouched — no blast
    radius on `SkinProfileEditModal`, its other consumer.
  - `AboutYouStep.tsx`: added a third gender pill, "Prefer not to say", mapped to `gender: null` —
    no `UserProfile.gender` type change needed (`null` was already the unset value).
  - `StepLayout.tsx`: Skip/Next footer changed from stacked full-width to one row, 50/50
    (`flexDirection:'row'`, each button `flex:1`, existing `gap` between them).
  Re-verified after all four: `npx tsc --noEmit` clean, `npx jest tests/onboarding-5-step-redesign`
  51/51 passing (no test changes needed — all query by text/role, not layout or exact chip count).

2026-07-27 — bug fix, reported by human (Sviatlana) after the caption change above: card 4 (of the 6
  Fitzpatrick cards) rendered visibly bigger than the rest. Root cause: `PhototypeStep.tsx`'s
  `styles.grid` had no `alignItems` override, so the flex-wrap default (`stretch`) forced every
  `gridItem` in a wrapped row to match its tallest row-mate's height. Row 2 pairs type 3 ("Sometimes
  burns, tans gradually" — the longest caption, wraps to 2 lines) with type 4 — type 4's `gridItem`
  was stretched to type 3's height, and `FitzpatrickCard`'s own `flex:1` then filled that taller box,
  breaking its square aspect ratio relative to the other 5 cards. Fixed by adding
  `alignItems: 'flex-start'` to `grid` so each item sizes to its own content instead of its row-mate's.
  Also addressed the "make them shorter" request in the same pass: gave `FitzpatrickCard` a new,
  additive `style?: StyleProp<ViewStyle>` prop (appended last in its internal style array, so it can
  override `aspectRatio` without touching the component's default square shape used by its other
  consumer, `SkinProfileEditModal`) and passed `aspectRatio: 1.6` from `PhototypeStep` only.
  Re-verified: `npx tsc --noEmit` clean, `npx jest tests/onboarding-5-step-redesign` 51/51 passing.

2026-07-27 — follow-up fix, reported by human (Sviatlana): the `aspectRatio: 1.6` override from the
  previous entry still wasn't enough — cards were visibly inconsistent shapes/sizes, not just
  uniformly-shorter squares. `flex:1` (baked into the shared `FitzpatrickCard`'s base style) plus an
  `aspectRatio` override, inside a `gridItem` column container with no defined height, is inherently
  ambiguous in Yoga: with nothing to flex-grow into, sizing falls back to content/aspectRatio, but
  that resolution isn't reliably uniform across siblings once a variable-height `Text` caption sits
  below each card. Replaced the override with fully explicit, unambiguous sizing —
  `{ flex: 0, aspectRatio: undefined, height: 96 }` — canceling both the shared component's `flex:1`
  and the previous `aspectRatio` attempt in favor of a fixed pixel height (width still comes from
  `gridItem`'s 47% column stretch). Added a regression test to `PhototypeStep.test.tsx` asserting all
  6 rendered cards resolve to the identical `height` style value, so this class of bug is caught by
  `npx jest` instead of requiring another visual report. `npx tsc --noEmit` clean; `npx jest
  tests/onboarding-5-step-redesign` 52/52 passing (51 + 1 new regression test).

2026-07-27 — layout change, requested by human (Sviatlana): move the progress ring onto the same
  line as the Back arrow (right-aligned, opposite it), instead of its own row above the step content.
  The ring is owned by the container (`SkinProfileSetupScreen`) and Back is owned by each step (via
  `StepLayout`) — these are different subtrees, so getting them into one visual row required plumbing
  the ring down as a `progressRing?: React.ReactNode` prop: `StepLayout` now renders a
  `headerRow` (`flexDirection:'row', justifyContent:'space-between'`) with Back (or an empty
  `flexShrink:0` placeholder on step 1) on the left and `progressRing` on the right; all 5 step
  components gained the same optional `progressRing` prop and forward it straight through; the
  container computes the ring once and passes it to whichever step is active, replacing its old
  standalone `ringWrap` row. Purely additive to every step's prop contract (optional, not consumed by
  any existing test), so no test files needed changes. Re-verified: `npx tsc --noEmit` clean; `npx
  jest tests/onboarding-5-step-redesign` 52/52 passing, unchanged.
