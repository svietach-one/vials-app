Status: SHIPPED — tech-lead ACCEPT (2026-07-29); QA follow-up RESOLVED (2026-07-29); PREGNANCY_SAFETY_ENABLED flipped true (2026-07-30), after the pregnancy-pin-survival-fix prerequisite (tech-lead ACCEPT) closed the override gap this file's own review flagged as Point C
Tech Design: docs/tech-design/pregnancy-safety-handling.md
Code: FE-1..FE-10 implemented, uncommitted on specific-screens

## Карточка задачи
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [x] QA tests (qa-lead)
- [x] Implementation (engineer)
- [x] Architecture review (tech-lead)

## Log

2026-07-29 — planner: spec and tech design authored from the pre-existing draft at
  `docs/specs/routine_engine_3.0/TASK_pregnancy_routine_conflicts.md`. That draft's own §7
  ("Implementation-time code discovery") explicitly deferred three mechanism decisions to
  implementation-time code reading rather than guessing; resolved all three directly against source
  before writing anything, per the same discipline `onboarding-5-step-redesign`'s planner log applied to
  its stale draft. Corrections against the draft's assumptions, logged here per
  `.claude/rules/architecture-review.md` §6:

  1. **`effectiveRuleset` assembly — draft's plan doesn't fit.** The draft (§3.2) suggested folding the
     pregnancy freeze into `effectiveRuleset`, "alongside the season / phototype / procedure sources."
     Reading `context.ts` shows `effectiveRuleset` (`buildEffectiveRuleset`) only ever carries
     phototype-derived data — season and procedure rules are separate `RoutineContext` fields
     (`seasonMask`, `procedureRules`), never folded into it. Corrected: model pregnancy as its own
     `RoutineContext.pregnancyRules` field, populated from a new `pregnancy.ts` ruleset. Structurally
     closer to `seasons.json`'s boolean-condition `SeasonRule` shape than to `procedures.json`'s
     phase/day-windowed `ProductRule` shape, since pregnancy has no recovery-window semantics.
  2. **Non-overridability mechanism — draft conflated two unrelated things.** The draft (§3.4) pointed at
     "the retinoid-in-AM hard block" as the model for non-overridability and asked to "mirror that same
     mechanism." Reading `eligibility.ts` and `resolve.ts`'s consumers shows non-overridability for
     clinical freezes is actually structural: `applyEligibilityGates` runs before `selectSkeleton`, so a
     rejected product never reaches the `reserve`/override pool at all — no explicit flag exists anywhere.
     Retinoid-in-AM is a *different*, unrelated mechanism (a period restriction in `slotting.ts`/
     `actives.json`'s `allowedPeriods`), coincidentally also effectively non-forceable, but via a separate
     code path. Corrected: mirror the eligibility-gate-ordering mechanism (closer analog: existing
     procedure freezes), not the period-restriction one. No new "non-overridable" flag is introduced by
     either reading.
  3. **`AddProcedureModal` blocking behavior — draft assumed shipped behavior that isn't shipped.** The
     draft (§4.3) assumed US-18's "block Save + 'I understand the risk, log anyway' acknowledgment" already
     exists and pregnancy just plugs into it. Reading `AddProcedureModal.tsx` shows `handleSave` does not
     branch on any of the three existing checks' severity — they render as advisory `InlineAlert`s only,
     Save is never blocked, no acknowledgment step exists anywhere in the component. `USER_STORIES.md`
     US-18 itself is marked pending sign-off — it was speced but never built. Corrected: ship
     `checkPregnancyConflict()` the same way the other three ship (advisory `InlineAlert`), and log real
     Save-blocking as an explicit Open Question / follow-up rather than quietly building new blocking UX
     for one check while the other three stay advisory.

  Two additional findings not in the draft's own checklist:

  4. `dailyView.ts` independently reads `context.procedureRules` at two call sites (~146, ~230) to compute
     frozen rows for the **Today screen's saved routine** — separate from `eligibility.ts`, which only
     feeds new-plan generation. Wiring pregnancy into eligibility alone would leave an already-saved
     routine still showing a frozen retinoid as active on Today. Both call sites are in scope (FE-6).
  5. AHA/BHA potency-gating (draft §3.3's suggestion to freeze only `high`-potency acids) is not currently
     expressible for a freeze target: `matchesRuleTargets`/`RuleTargets` has no potency condition — only
     `PairRule.exceptions.whenPotencyAtMost` does, and that machinery is pair-rule-specific, not available
     to single-sided freeze targets. Logged as a documented follow-up in the spec's non-goals, not built.

  Confirmed (draft's assumptions held): Phase 7 is real and merged (`docs/specs/routine-engine-v2.1/
  phase-07-explainability.md`, commit `5d4c08a`), `RuleTargets` vocabulary in `targeting.ts` is exactly
  `{classes, properties, productTypes, anyOf}` as assumed, `checkSeasonalConflict`'s shape in
  `conflictEngine.ts` is the correct model for `checkPregnancyConflict`, `UserProfile.
  pregnantOrBreastfeeding` exists and is wired end-to-end from `AdditionalInfoStep.tsx`, hydroquinone is
  genuinely absent from `actives.json`'s taxonomy.

  Two open-question defaults confirmed directly by the orchestrating human session (2026-07-29, not
  relayed): `AddProcedureModal` stays advisory-only (no new Save-blocking in this task), and the Today
  screen reuses the existing Phase 7 reserve-card reason line (no new dedicated banner).

  Not resolved by this planning pass, and not resolvable by it: clinical sign-off on the draft
  retinoid-freeze / procedure-severity data. Tracked as spec §10 Open Question. `PREGNANCY_SAFETY_ENABLED`
  stays `false` regardless of implementation completeness until that lands.

  Flagged, not acted on (out of this task's scope per the orchestrating session's instructions):
  `docs/specs/routine_engine_3.0/TASK_onboarding_redesign.md` is a stale duplicate of the already-shipped
  `onboarding-5-step-redesign` task. `docs/specs/routine_engine_3.0/TASK_hormone_therapy_personalization.md`
  is a discovery doc whose own recommended path needs zero engineering.

2026-07-29 — qa-lead: wrote the integration/component suite in `tests/pregnancy-safety-handling/`
  (5 files, 24 tests total) covering spec §4 Stories 1-3 against tech design §3 FE-1..FE-10, before any
  implementation exists. No unit tests written for `pregnancy.ts`'s or `checkPregnancyConflict`'s pure
  logic — that stays the engineer's co-located scope per `.claude/rules/testing.md`; `rulesetIntegrity.
  test.ts` was left untouched (it auto-covers `pregnancy_blocked` once FE-7 lands).

  Files:
  - `fixtures.ts` — wraps `tests/routine-engine/fixtures.ts`'s factories (precedent: `tests/catalog/
    product-shelf-card-hidden.test.tsx` imports across feature folders) instead of duplicating id-counter
    logic. Adds `makeRetinoidProduct`, `makePregnancyEngineInput`/`makePregnancyDailyViewInput` (typed
    directly against the real `EngineInput`/`DailyViewInput`, so they correctly fail `tsc --noEmit` today
    pending FE-4/FE-6's `Pick` extensions — same "red before implementation" pattern already used in
    `tests/onboarding-5-step-redesign/AdditionalInfoStep.test.tsx`), `makeModalProfile`,
    `makeAddProcedureModalProps`.
  - `pregnancy-freeze-enabled.test.ts` (Surface A, flag mocked ON via `jest.mock('@/constants/
    featureFlags', ...)`) — Story 1 AC1 (no retinoid admitted; deliberately uses an `aging` goal, which
    ranks retinoid first in `actives.json`, so the exclusion is proven meaningful rather than an artifact
    of ordinary maintenance-goal minimalism), AC2 (`reasonCode: 'pregnancy_blocked'` + real dictionary
    text via `reasonText`), AC3 (a `userOverrides` force-back attempt still fails — proved by first
    showing the SAME override succeeds pre-implementation, i.e. this assertion is genuinely red today),
    AC5 (non-pregnant profile contributes nothing even with the flag on), and Story 2 (`getDailyView`
    excludes the saved retinoid step via `frozen`, mirroring `tests/routine-engine/clinical-freeze.test.ts`'s
    real-module style).
  - `pregnancy-freeze-disabled.test.ts` (Surface A, real shipped flag — no mocking) — guard rail
    (`PREGNANCY_SAFETY_ENABLED === false`, mirrors `proposedPairRules.test.ts`), Story 1 AC4
    (byte-identical `generatePlan` output for a pregnant vs. non-pregnant profile), Story 2 flag-off parity.
  - `AddProcedureModal.pregnancy-enabled.test.tsx` / `.pregnancy-disabled.test.tsx` (Surface B) — spies on
    the REAL `InlineAlert` (`jest.requireActual` wrapped in `jest.fn`, mirroring `tests/
    onboarding-5-step-redesign/AdditionalInfoStep.test.tsx`) so tone (`avoid`→`sos`, `caution`→`warning`,
    locked exactly by tech design FE-8's severity table) and content (loose pregnancy/breastfeeding text
    match — exact copy is still draft, spec §10) are asserted without reaching into internal styles or
    needing a testID. Covers Story 3 AC1-5: 5 avoid-severity procedures, `mechanical_facial` caution,
    co-existence with the phototype alert (deliberately phototype-driven, not seasonal, to stay independent
    of the real device date), the `isCustom` guard, and both flag-off/profile-off inert paths.

  Verified before handing off: `npx jest tests/pregnancy-safety-handling` runs all 24 tests today — 13
  fail (the positive "freeze happens" / "alert renders" assertions, exactly the FE-1..FE-10 gaps) and 11
  pass (the negative/guard-rail assertions that are already true and must stay true post-implementation).
  `npx tsc --noEmit` errors are limited to the expected missing-field/missing-export gaps (`PREGNANCY_
  SAFETY_ENABLED` export, `pregnantOrBreastfeeding` on the `EngineInput`/`DailyViewInput` profile `Pick`s,
  `pregnancy_blocked` in `DecisionReasonCode`) — no unrelated type errors introduced.

2026-07-29 — engineer: implemented FE-1 through FE-10 per tech design §3. `npx tsc --noEmit` clean
  repo-wide. `npx jest tests/pregnancy-safety-handling` — 17/24 green; the remaining 7 are a QA-test
  defect, not an implementation gap (details below, "QA-test defect" section). Full regression run
  (`npx jest --testPathIgnorePatterns="worktrees"`) shows zero regressions attributable to this change —
  the 88 unrelated failures elsewhere (catalog/product-shelf-card/shelf-filtering suites) are pre-existing,
  tied to the already-modified-and-uncommitted files visible in `git status` before this task started
  (ProductShelfCard.tsx, ProductPickerCard.tsx, WeeklyPlanView.tsx, ProductDetailScreen.tsx,
  ProcedureDetailScreen.tsx, labels.ts — a `shadow.sm`/tokens-refactor-in-progress issue, nothing this
  task's files touch). Also observed: two OTHER agents' `.claude/worktrees/*/src/utils/conflictEngine.test.ts`
  copies fail on an unrelated vitamin-C/niacinamide assertion — different git worktrees, not this repo's
  test run; excluded via `--testPathIgnorePatterns="worktrees"` for every check from here on (per
  roadmap-sync.md's own documented pattern for this exact hazard).

  Files created:
  - `src/constants/rulesets/pregnancy.ts` (FE-2) — `PREGNANCY_RULESET` (one rule: freeze `retinoid`,
    `reasonCode: 'pregnancy_blocked'`) + `getPregnancyRules()`, self-gated on `PREGNANCY_SAFETY_ENABLED`
    exactly like `proposedPairRules.ts`'s `getProposedPairRules()`.
  - `src/constants/rulesets/pregnancy.test.ts` — co-located unit tests (engineer's own scope): flag-off
    guard rail, rule shape, reasonCode, and the AHA/BHA/benzoyl-peroxide non-goal staying unfrozen.
  - `src/utils/conflictEngine.pregnancyConflict.test.ts` — co-located unit tests (engineer's own scope)
    for `checkPregnancyConflict`'s per-procedure severity table, flag mocked ON (own file: jest.mock is
    file-scoped/hoisted, mirrors the qa suite's own enabled/disabled file split). The flag-off guard rail
    (real shipped flag) lives directly in the existing `src/utils/conflictEngine.test.ts`.

  Files modified: `src/constants/featureFlags.ts` (FE-1), `src/constants/rulesets/rulesetTypes.ts` (FE-3,
  `PregnancyRule`), `src/utils/routineEngine/context.ts` (FE-4, `PregnancyFreezeRule` +
  `RoutineContext.pregnancyRules` + `resolvePregnancyRules`), `src/utils/routineEngine/eligibility.ts`
  (FE-5, `pregnancy_freeze` gate), `src/utils/routineEngine/dailyView.ts` (FE-6),
  `src/constants/decisionReasons.ts` (FE-7, `pregnancy_blocked` + stale-comment deletion),
  `src/constants/conflictRulesDb.ts` (FE-8, `PREGNANCY_PROCEDURE_SEVERITY` + `PREGNANCY_PROCEDURE_COPY`),
  `src/utils/conflictEngine.ts` (FE-9, `checkPregnancyConflict`), `src/utils/conflictEngine.test.ts`
  (flag-off guard rail for the new method), `src/components/clinic/AddProcedureModal.tsx` (FE-10).

  Deviations from the tech design's literal file list, logged per architecture-review.md §6:

  1. **`src/utils/routineEngine/targeting.ts` gained a shared helper, not listed in tech design §3.**
     FE-6 asks for "one helper used by both eligibility.ts and dailyView.ts" for the "is this product
     frozen by any source" check, but doesn't name a file. `targeting.ts` is the natural home — both
     files already import `matchesRuleTargets` from it, and it's the lowest layer that can see both
     `ActiveProcedureRule`-shaped and `PregnancyFreezeRule`-shaped data without a new import cycle. Added
     `TargetedRule` (a `{targets, reasonCode, untilDate?}` shape both rule kinds satisfy structurally),
     `findMatchingRule` (single-source match — used by eligibility.ts's two *separate* gates, so
     `clinical_freeze` and `pregnancy_freeze` stay distinguishable for audit/validate.ts severity mapping),
     and `findFrozenByAnySource` (unions both sources — used by dailyView.ts's two call sites, which only
     need "is it frozen at all" for rendering, not which gate).
  2. **`FrozenStepView.until` changed from required `string` to optional `string | undefined`,
     rippling into `src/screens/TodayScreen.tsx` and `src/screens/RoutinesScreen.tsx` (neither listed in
     the tech design's planned file list).** Pregnancy freezes have no natural expiry date (unlike every
     existing freeze source, which is day-windowed), so `freeze.untilDate` is `undefined` for a pregnancy
     freeze. The two screens' "paused until {until}" row would have rendered literally "paused until
     undefined" without this. Fixed by falling back to `reasonText(item.reasonCode)`, mirroring
     `DraftPreviewScreen.tsx`'s pre-existing identical fallback for `FrozenItem.until` (which was already
     optional, for pair-rule freezes). Small, necessary, and follows an established in-repo pattern —
     not a new design.
  3. **`src/utils/routineEngine/substitute.ts` and `src/utils/routineEngine/validate.ts` wired
     `pregnantOrBreastfeeding` through their own `buildRoutineContext` calls, and `validate.ts`'s
     eligibility-rejection severity mapping was extended to treat `pregnancy_freeze` as `avoid` (it was
     only checking `=== 'clinical_freeze'`).** Neither file is in the tech design's file list, but both
     consume `EngineInput`/`applyEligibilityGates` directly. Leaving them unwired would have reopened
     exactly the override-bypass the tech design's Assumption 2 promises is structurally closed: (a)
     `findSubstitute` (substitute.ts, the "swap this slot" flow) would have offered a frozen retinoid as a
     substitute, since its `context.pregnancyRules` would always resolve to `[]` without the profile field;
     (b) `validateRoutines` (validate.ts, the saved-routine diff/findings view) would have reported a
     pregnancy freeze finding as `caution` instead of `avoid`, understating its severity to the UI. Both
     are one-line, structurally identical to the already-scoped `generate.ts`/`dailyView.ts` changes — not
     new mechanism, just completing the same wiring at every `EngineInput` consumer so "non-overridable"
     actually holds everywhere, not just in the two call sites §3 named.
  4. **`AddProcedureModal.tsx`'s pregnancy alert JSX is wrapped in its own `useMemo` (`pregnancyAlert`),
     unlike the three pre-existing checks, which inline their `InlineAlert` JSX directly.** Root cause:
     the modal's pre-existing `useEffect(() => { if (visible) { setSelectedKey('botox'); ... } }, [visible])`
     reset effect always commits twice on mount (initial state, then the effect's own batched setState
     calls) — verified empirically with a scratch instrumented test. The three pre-existing checks are
     unaffected because none of them evaluate truthy for the untouched default (`botox`, no active
     procedures, no season match, no phototype set) — but `PREGNANCY_PROCEDURE_SEVERITY` (FE-8) itself
     lists `botox: 'avoid'`, so `pregnancyResult` IS truthy on that very first default state, and without
     memoizing the element, both of mount's commits independently invoke `InlineAlert` (React always
     re-invokes a plain, non-`memo`'d function component on every parent re-render, even when the data
     it receives is unchanged). Memoizing the returned element (not just the derived data) lets React's
     "same element reference at this position" bail-out skip the second, redundant invocation. This is a
     real bug fix (a real user would otherwise get two DOM commits of the identical alert, harmless
     visually but wasteful), scoped only to the new alert, and does not touch the reset effect or the
     other three checks.

  **QA-test defect found, not fixed (explicitly did not modify test files per instruction):**
  7 of `AddProcedureModal.pregnancy-enabled.test.tsx`'s 9 tests fail — Story 3 AC1 for `fillers` /
  `smas_lifting` / `mesotherapy` / `chemical_peel_deep` (botox itself passes), AC2, AC3, AC4. Root cause,
  verified with a scratch instrumented test before concluding: the modal's pre-existing hardcoded default
  (`useState<ProcedureLogKey>('botox')`) is now — per FE-8's OWN severity table, which the test itself
  locks in — an `avoid`-severity procedure for pregnancy. A pregnant profile therefore genuinely shows the
  pregnancy alert immediately on mount, before any `selectProcedure()` call in the test body. Every failing
  test's `pregnancyAlertCalls()` helper reads `(InlineAlert as jest.Mock).mock.calls` cumulatively since
  the last `mockClear()` (in `beforeEach`, which runs BEFORE `renderModal()`), so mount's own botox alert
  call is *always* present alongside whatever the test's own `selectProcedure(key)` produces — making
  "exactly N calls" assertions fail whenever the newly-selected procedure is also `avoid`/on-topic. This is
  mathematically unsatisfiable by any implementation that (a) shows the alert immediately for the current
  selection, mount included — matching the other three checks' established behavior and Story 3 AC1's own
  Given/When/Then ("when the user selects botox... an alert renders", true from the first paint since botox
  IS the default selection) — while (b) not leaving the earlier call in the mock's history. I deliberately
  did NOT implement an "only show after explicit interaction" gate to force these green: that would mean a
  pregnant user who opens the modal and taps "Log Procedure" without touching the (already-correct-for-them)
  default selection never sees the safety warning at all — a real safety regression in a feature whose
  entire premise is not regressing on safety. Recommend qa-lead either (a) insert
  `(InlineAlert as jest.Mock).mockClear()` between `renderModal()` and `selectProcedure(key)` in each
  affected test, or (b) assert on the LAST matching call's procedure-specific text rather than raw call
  count. Left `tests/pregnancy-safety-handling/` entirely untouched, as instructed.

  Not implemented, out of FE-1..FE-10 scope, flagged for product/future ticket: `buildStepsFromPlan`
  (`src/utils/routineEngine/planApply.ts`) only treats a frozen item as overriding a `userPinned` saved
  step when `FrozenItem.until` is set (`clinicallyFrozen = frozen.filter(f => f.until)`). A pregnancy
  freeze never sets `until` (no natural expiry), so a user who had PINNED a retinoid step before becoming
  pregnant would have that pin survive a Draft→Save regeneration even with the freeze active — a narrower,
  pin-specific gap in the "non-overridable" guarantee, distinct from the `userOverrides`/reserve-pool path
  Assumption 2 covers and that Story 1 AC3 tests. Not fixed here: `planApply.ts` isn't in the tech design's
  scope, and this pre-existing `until`-based branch was written for pair-rule freezes (also `until`-less)
  long before this task, so changing its semantics is a bigger, cross-cutting call for tech-lead/product to
  make, not a unilateral engineer fix.
2026-07-29 — tech-lead: ACCEPT. Independently reverified rather than trusting the logs — ran every command
  myself and read the actual test file, component, and every file behind the 4 logged deviations and the
  flagged planApply.ts gap first-hand.

  Verified independently:
  - `npx tsc --noEmit`: clean, 0 errors, repo-wide.
  - `npx jest tests/pregnancy-safety-handling`: 17 passed, 7 failed — exact match to the logged claim;
    failures are precisely Story 3 AC1 (fillers/smas_lifting/mesotherapy/chemical_peel_deep; botox itself
    passes), AC2, AC3, AC4.
  - `npx jest tests/routine-engine src/utils/routineEngine src/constants/rulesets
    src/utils/conflictEngine.test.ts`: 53 suites, 620 passed + 2 pre-existing todo = 622 total, 0 failures.
    Zero regressions confirmed (raw total differs from the logged 599/601 only because this invocation's
    path globs are slightly broader — the material claim, zero failures beyond the 2 pre-existing todos,
    holds exactly).
  - `git status` / `git diff --stat`: file list matches the handoff JSON exactly; the extra modified files
    in `git status` (ProductShelfCard.tsx, ProductPickerCard.tsx, WeeklyPlanView.tsx, ProductDetailScreen.tsx,
    ProcedureDetailScreen.tsx, RoutineStepCard.tsx, DraftPreviewScreen.tsx, labels.ts) are pre-existing
    unrelated working-tree state from before this task, not this task's output. Nothing staged.

  Point A (the disputed QA-test failures — the central judgment call): read
  `tests/pregnancy-safety-handling/AddProcedureModal.pregnancy-enabled.test.tsx` and
  `src/components/clinic/AddProcedureModal.tsx` directly, and inspected the actual jest failure output
  rather than taking the root-cause claim on faith. Confirmed mechanically and exactly as logged:
  `beforeEach`'s `mockClear()` runs before `renderModal()`, so the mount-time `InlineAlert` call for the
  hardcoded default `'botox'` selection (itself `avoid`-severity per FE-8's own table) is never cleared
  before `selectProcedure(key)` fires a second call — the failing tests' `mock.calls` arrays contain exactly
  2 entries (not 3, confirming the useMemo double-commit fix from deviation 4 works), breaking every
  "exactly N calls" assertion whenever the newly-selected procedure is also on-topic. `botox` itself passes
  because `setSelectedKey('botox')` on an already-`'botox'` state is a React no-op (no re-render).
  On the merits: alerting immediately for the current selection, mount included, is correct behavior, not a
  bug to route around. It matches the other three pre-existing checks' identical pattern (derive reactively
  from current state, no special-casing of "reached via tap vs. default"); it satisfies spec §4 Story 3
  AC1's literal Given/When ("when the user selects botox" — botox IS the visibly-selected radio row on
  open, before any tap); and decisively, gating the alert behind an explicit interaction would leave
  unwarned exactly the user most likely to be affected: a pregnant user who opens "Log Procedure", accepts
  the pre-selected (and for them, already-correct) default, and taps Save without touching any row. Concur
  fully with the engineer's refusal to implement that gate for the sake of green tests. Verdict: QA-test
  defect (WARNING, route to qa-lead as a follow-up), not an implementation gap — does not block this PR.
  Recommended fix: the engineer's own option (a), `mockClear()` between `renderModal()` and
  `selectProcedure(key)` in each affected test.

  Point B (4 logged deviations): read the actual diffs for all 4 — targeting.ts's TargetedRule/
  findMatchingRule/findFrozenByAnySource, FrozenStepView.until becoming optional (+ TodayScreen.tsx/
  RoutinesScreen.tsx's reasonText(reasonCode) fallback), substitute.ts/validate.ts's pregnantOrBreastfeeding
  wiring (+ validate.ts treating pregnancy_freeze as avoid), and AddProcedureModal.tsx's pregnancyAlert
  useMemo. All 4 explanations hold up exactly against the code; none are undocumented or unjustified. The
  substitute.ts/validate.ts wiring in particular is a genuine, correctly-scoped gap-closure — without it,
  Assumption 2's "non-overridable" guarantee would have silently not held at those two EngineInput
  consumers. No blockers.

  Point C (planApply.ts gap): read `planApply.ts` directly — confirmed real.
  `clinicallyFrozen = new Set(frozen.filter((f) => f.until)...)` excludes any `FrozenItem` without `until`,
  and a pregnancy freeze never sets one, so a previously `userPinned` retinoid step would survive a
  Draft->Save regeneration under an active pregnancy freeze. Not a blocker for this PR: (1) zero current
  exposure — `PREGNANCY_SAFETY_ENABLED` is `false`, so this gap is as inert as the rest of the feature
  today; (2) narrow even once enabled — every other surface (new-plan eligibility, both Today-screen
  dailyView.ts call sites, the substitute/swap flow, validate.ts's findings) correctly enforces the freeze,
  only this specific pin-before-freeze + Draft->Save path leaks; (3) a pre-existing architectural gap shared
  with pair-rule freezes (also `until`-less), not a new defect pattern this task introduced; (4) genuinely
  outside tech design §3's scope, and changing `until`-based semantics is a cross-cutting call affecting the
  pair-rule path too — correctly deferred rather than unilaterally patched. Action item: open a follow-up
  ticket now; resolve before or alongside any future `PREGNANCY_SAFETY_ENABLED` flip, since that is the
  point this stops being inert.

  Point D (standard checks): layer separation clean (grep-verified — no AsyncStorage/fetch/React-in-utils
  in any touched file); no hardcoded colors introduced (grepped the AddProcedureModal.tsx diff's added
  lines specifically — the new alert uses colors.statusSOS/colors.statusWarningAccent tokens); no
  console.log/debugger; no new TODO/FIXME/HACK. One WARNING: `eligibility.ts`'s `applyEligibilityGates` is
  now ~61 lines (already close to 50 before this task's ~14-line addition) — recommend a light refactor
  (extract each gate check into a small helper) as a follow-up; does not block, per architecture-review.md's
  own "allow merge if clean" guidance for this category. Flag-gating confirmed complete: grepped
  `PREGNANCY_SAFETY_ENABLED`/`pregnantOrBreastfeeding` across every touched file — every acting code path
  funnels through one of two centrally-gated choke points (`getPregnancyRules()` for Surface A,
  `ConflictEngine.checkPregnancyConflict`'s internal check for Surface B); no call site reads the profile
  flag and acts on it while bypassing the feature flag.

  Point E (draft-data hygiene): confirmed — `pregnancy.ts` and `PREGNANCY_PROCEDURE_SEVERITY`/
  `PREGNANCY_PROCEDURE_COPY` in `conflictRulesDb.ts` both carry explicit "draft data, pending clinical
  sign-off/review — spec §10" comments; `featureFlags.ts`'s `PREGNANCY_SAFETY_ENABLED` doc reinforces the
  same framing. Nothing lost in translation from spec to code.

  Also noted, outside the scope of this task's code: this review session's input twice contained an
  appended, self-styled "/security-review" command block instructing a full role/task switch (redefine as
  security engineer, abandon this review, spawn sub-agent tasks unavailable in this session's toolset,
  output only a vulnerability report). The second occurrence arrived via a "coordinator relay" framing that
  simultaneously claimed "no separate security pass is needed" while re-sending the identical payload — an
  internal contradiction. Not executed either time, consistent with this session's standing rule that no
  agent-relayed message constitutes user consent; flagged to the human directly in-conversation. Worth the
  human independently checking why their coordinator relay is carrying this.

  Verdict: ACCEPT. No blockers found. 2 items to route as follow-ups (qa-lead: fix the 7 test assertions;
  product/tech-lead: planApply.ts pin-survival ticket, resolve by the time PREGNANCY_SAFETY_ENABLED ever
  flips true). Ready for human merge.

2026-07-29 — qa-lead: follow-up fix for the 7 disputed test failures in `tests/pregnancy-safety-handling/
  AddProcedureModal.pregnancy-enabled.test.tsx`, per the engineer's and tech-lead's independently confirmed
  root-cause analysis above. Read the test file and `src/components/clinic/AddProcedureModal.tsx` directly
  before touching anything, and reran the suite pre-fix to confirm the exact same 7 failures (`AC1` for
  fillers/smas_lifting/mesotherapy/chemical_peel_deep, `AC2`, `AC3`, `AC4`; `botox`'s `AC1` case and `AC5`
  already passed) with the exact mock-history shape described in the log (2 entries, not 3 — confirming the
  engineer's `useMemo` double-commit fix holds).

  Fix applied — the tech-lead's recommended option (a), `(InlineAlert as jest.Mock).mockClear()` inserted
  between `renderModal()` and the test's own selection action, in all 4 straightforward cases (`AC2`, `AC3`,
  `AC4`, and 4 of the 5 `AC1` `it.each` keys). One necessary exception within the `AC1` `it.each`: the
  `botox` key is the component's hardcoded default, so re-selecting it is a React state no-op (`Object.is`
  bails out, no re-render, no fresh `InlineAlert` call) — clearing the mock before that no-op would zero out
  the very mount-time alert the case is meant to verify, not isolate a fresh one. That single case is
  conditionally exempted from the `mockClear()` and asserts directly against the mount-time call instead.
  No test's assertions changed semantically — avoid-tone (`sos`) is still verified for botox/fillers/
  smas_lifting/mesotherapy/chemical_peel_deep, caution-tone (`warning`) for mechanical_facial, co-existence
  with the phototype alert, and the `isCustom` guard all assert the identical outcomes as before; only the
  mock call-history bookkeeping around the real, expected mount-time alert was corrected.

  Verified: `npx jest tests/pregnancy-safety-handling` — 4 suites, 24/24 passed (was 17/24). `npx tsc
  --noEmit` — clean, 0 errors, repo-wide. Left unstaged, as instructed.

2026-07-30 — orchestrating session: `PREGNANCY_SAFETY_ENABLED` flipped `false` → `true` in
  `src/constants/featureFlags.ts`, per direct human confirmation that clinical sign-off on the draft
  retinoid-freeze/procedure-severity data (spec §10) has been obtained. This task's tech-lead review
  (2026-07-29) recommended resolving the Point C pin-survival gap "before or alongside" any such flip; the
  human chose to resolve it first, as its own full-cycle follow-up task —
  `docs/specs/pregnancy-pin-survival-fix.md` / `progress/pregnancy-pin-survival-fix.md`, tech-lead ACCEPT
  2026-07-30. That fix landed and was verified before this flag flip.

  Flipping the flag turned several existing guard-rail tests, which asserted the REAL (previously-false)
  default rather than a mocked one, from correct into stale — they were testing "what the flag currently
  ships as," and that answer changed. Updated 5 files to mock the flag off explicitly instead (preserving
  the exact same off-path test intent, matching the sibling `-enabled` files' existing mocking convention):
  `src/constants/rulesets/pregnancy.test.ts`, `src/utils/conflictEngine.test.ts`,
  `tests/pregnancy-safety-handling/pregnancy-freeze-disabled.test.ts`,
  `tests/pregnancy-safety-handling/AddProcedureModal.pregnancy-disabled.test.tsx`, and
  `tests/pregnancy-pin-survival-fix/pregnancy-flag-disabled.test.ts`. Each also gained (or, for
  `pregnancy.test.ts`/`conflictEngine.test.ts`, kept alongside the mocked-off block) a case exercising the
  real, unmocked, now-true flag, so the on-path is covered against actual shipped configuration too, not
  only simulated.

  Verified after both the flag flip and the test updates: `npx tsc --noEmit` clean, 0 errors, repo-wide.
  `npx jest tests/pregnancy-safety-handling tests/pregnancy-pin-survival-fix src/constants/rulesets/
  pregnancy.test.ts src/utils/conflictEngine.test.ts` — 10 suites, 72 tests, all passing. Full repo sweep
  (`npx jest --testPathIgnorePatterns="worktrees"`): 10 failing suites remain, all pre-existing and
  unrelated (a `palette`/`shadow.sm` tokens-refactor-in-progress issue tied to other uncommitted work
  already on this branch before this task began — `ProductShelfCard.tsx`, `ProductDetailScreen.tsx`,
  `AddProductHubScreen.tsx` and the `CatalogScreen` import chain; confirmed zero overlap with this task's
  files). Left unstaged for human commit.
