Status: PR_REVIEW
Tech Design: docs/specs/engine 4.0/engine4.1/ENGINE_4.0_RECONCILIATION_AND_PHASE11_HANDOFF.md (supersedes the Phase 11 section of docs/specs/engine 4.0/IMPLEMENTATION_PLAN.md where they conflict)
Code: implemented on branch goal-coverage-safety-guard (off dev, includes 9078369)

## Карточка задачи
- [x] Product requirements (handoff doc provided directly, no planner pass — same precedent as routine-engine-v2-2)
- [x] Technical design (engine4.1 handoff doc; reconciled live against source during a conversation with the user before implementation — see Log)
- [ ] QA tests (no qa-lead pass — engineer wrote unit tests directly, same precedent as routine-engine-v2-2)
- [x] Implementation (engineer)
- [x] Architecture review (tech-lead)

## Log

2026-08-04 — engineer: implemented the two NEW-WORK items from
`docs/specs/engine 4.0/engine4.1/ENGINE_4.0_RECONCILIATION_AND_PHASE11_HANDOFF.md`
§3–4. Phases 8–10 of the same spec package were verified already shipped
(commit 9078369, see `progress/routine-engine-v2-2.md`) and were NOT
reimplemented. The handoff doc's Phase 11 data model
(`skinGoals: SkinGoalType[]`, hand-authored `GOAL_TAG_MAP`,
`PREGNANCY_TIER_MAP`) was explicitly rejected as stale against the shipped
`primaryGoal`/`secondaryGoal: SkinGoal` model and the already-shipped,
architecturally different pregnancy freeze
(`RoutineContext.pregnancyRules`/`eligibility.ts`/`pregnancy.ts`,
`PREGNANCY_SAFETY_ENABLED`). This reconciliation was done live, in
conversation, against source before writing anything — findings:

1. `resolveGoalContext()` must be called ONCE with the real
   `(primaryGoal, secondaryGoal)` pair, never per-goal in isolation — the
   `barrier_repair` irritancy-drop modifier applies across the merged
   ranking, so isolated resolution would falsely credit classes a real
   generation would have dropped. Per-goal attribution instead comes from
   `coverageClasses(g) = treatmentClassRanking ∩ ACTIVES_RULESET.goals[g]`.
2. The pregnancy freeze does NOT pre-filter `treatmentClassRanking` —
   confirmed by reading `resolveGoalContext()`'s parameter type (no
   `pregnantOrBreastfeeding`) and `generate.ts`'s pipeline order
   (`buildRoutineContext` then `applyEligibilityGates` are separate stages
   operating on different objects, `ActiveIngredientKey[]` vs `Product[]`).
   This is the reason `getGoalCoverageFindings()` needs its own shelf-level
   safety check — the exact false-negative the feature exists to prevent
   (pregnant user, only owned match is retinoid → naive coverage check would
   report the goal "uncovered" and nudge toward the restricted active).
3. `RoutinePlan.frozen` is transient (never persisted, discarded after
   `applyRoutinePlan`) — cannot be read from a saved routine. `RoutinesScreen`
   already recomputes `frozenRows`/`allFrozen` every render via
   `getDailyView`, so the standing check reuses that instead of a third
   gate run.
4. `frozenRows` alone is insufficient even for the routine-level question —
   a product gated out at `applyEligibilityGates` before it ever became a
   step is in neither the steps nor `frozenRows`, indistinguishable from
   "not owned." `getGoalCoverageFindings()` therefore does its own
   shelf-level pass (`products` + `pregnancyRules` via `findMatchingRule`),
   not just a `frozenRows` read.
5. `maintenance` (empty goals list) and an unconfirmed
   (`goalNeedsConfirmation: true`) goal must never nag — both fall out of
   the intersection/skip logic rather than being special-cased ad hoc.

### Files added
- `src/utils/goalCoverage.ts` — `coverageClasses()`, `getGoalCoverageFindings()`,
  message builders (`buildNotOwnedMessage`, `buildOnShelfMessage`,
  `buildSafetyRedirectMessage`)
- `src/utils/goalCoverage.test.ts` — 19 unit tests covering every skip
  condition, all three tones, the mixed-owned-matches case (falls back to
  `on_shelf`, not `safety_redirect`, when a safe alternative is already
  owned), and the pregnancyRules-empty no-op
- `src/components/routine/GoalCoverageBanner.tsx` — dismissible presenter,
  mirrors `SeasonalNoticeBanner`'s pattern; `safety_redirect` renders
  `tone="warning"` (Amber), the other two render `tone="info"` (Cobalt),
  never `tone="sos"` (Cabernet)

### Files modified
- `src/types/index.ts` — `hydroquinone` added to `ActiveIngredientKey`
- `src/constants/rulesets/actives.json` — new `hydroquinone` class (matcher,
  properties, PM-only allowedPeriods) so `ingredientParser.ts` can attribute
  it from INCI text at all — previously invisible to the engine
- `src/constants/rulesets/pregnancy.ts` — second freeze rule
  (`pregnancy_hydroquinone_freeze`, same `pregnancy_blocked` reason code as
  retinoid); docblock updated, acids/BPO exclusion reasoning carried forward
  unchanged (concentration-dependent, `RuleTargets` has no potency
  condition, needs explicit reviewer sign-off before any freeze)
- `src/constants/rulesets/pregnancy.test.ts` — updated for the two-rule shape
- `src/constants/labels.ts` — `ACTIVE_INGREDIENT_LABELS.hydroquinone`
- `src/screens/RoutinesScreen.tsx` — new `goalCoverageInput` memo (one
  `buildRoutineContext()` call reused for `treatmentClassRanking` +
  `pregnancyRules`) and `<GoalCoverageBanner>` mounted after
  `SeasonalNoticeBanner` in `listHeader`
- `src/utils/advisoryCopy.test.ts` — banned-phrase lint (US-26) extended to
  cover all goalCoverage message templates across all three tones
- `tests/pregnancy-safety-handling/fixtures.ts` — `makeHydroquinoneProduct`
- `tests/pregnancy-safety-handling/pregnancy-freeze-enabled.test.ts` — two new
  tests proving hydroquinone freezes the same way retinoid does, and that a
  non-pregnant profile never rejects it
- `tests/routine-engine/goal-confirm-routines-screen.test.tsx` — fixed a real
  regression this task surfaced: this suite's `settingsStore` mock predated
  `GoalCoverageBanner` and didn't provide `dismissedBanners`/`dismissBanner`,
  so the (unmocked, unlike `SeasonalNoticeBanner`) banner crashed reading
  `dismissedBanners.includes(...)` on `undefined`. Added both fields to the
  mock, matching the real store's shape.

### Deliberately NOT built (per the handoff doc)
- No `skinGoals: SkinGoalType[]` field, no `GOAL_TAG_MAP` — reuses the
  shipped `primaryGoal`/`secondaryGoal` model and `actives.json`'s existing
  `goals` block
- No `PREGNANCY_TIER_MAP` / parallel pregnancy engine — reuses the shipped
  `RoutineContext.pregnancyRules` freeze mechanism, only extended with a
  second targeted class
- No AHA/BHA/benzoyl peroxide/salicylic-acid freeze — concentration-
  dependent, engine cannot read concentration, explicitly flagged for
  reviewer sign-off rather than silently added

### Verification
- `npx tsc --noEmit` — clean, 0 errors
- `npx jest --testPathIgnorePatterns="worktrees"` — 139/149 suites,
  1609/1692 tests passed, 2 todo. Exactly the same 10 pre-existing failing
  suites as the branch baseline before this task (verified by name):
  `tests/product-shelf-card/ProductShelfCard.test.tsx`,
  `tests/catalog/catalog-screen-hide-toggle.integration.test.tsx`,
  `tests/routines/weekly-plan-view-hidden-filter.test.tsx`,
  `tests/product-images/RoutineCalendarView.test.tsx`,
  `tests/catalog/product-shelf-card-hidden.test.tsx`,
  `tests/shelf-filtering/PaoChip.integration.test.tsx`,
  `tests/inci-attribution-highlighting/DetectedActiveBadgeWiring.test.tsx`,
  `tests/catalog/product-detail.test.tsx`, `tests/catalog/catalog-screen.test.tsx`,
  `tests/catalog/add-product-hub.test.tsx` — all pre-existing `shadow.sm` /
  `palette.goldenTint` module-mock issues from unrelated dev-branch UI
  redesign commits, none touch a file this task modified.
- One real regression found and fixed during verification:
  `goal-confirm-routines-screen.test.tsx` (see above) — confirmed fixed,
  re-ran clean.

## Open questions for product
- The exact restricted-actives list beyond retinoid/hydroquinone (salicylic
  acid, benzoyl peroxide) needs the same clinical sign-off gate as
  `PRD_Spec.md` §6 — not decided here, per explicit instruction.

## Tech-lead review (2026-08-04)

The `tech-lead` subagent became unregistered mid-session (see handoff json
`not_part_of_this_task` — it had self-edited its own definition file during
the routine-engine-v2-2 review, which appears to have dropped it from this
session's agent roster). Review was carried out directly, walking the same
checklist `.claude/agents/tech-lead.md` defines, rather than blocking on a
harness reload.

**Part A — hydroquinone freeze:**
- `rulesetIntegrity.test.ts`, `pregnancy.test.ts`, `ingredientParser.test.ts` —
  all pass (95/95). The new `hydroquinone` class compiles as a valid regex,
  has all required `ActiveClass` fields, and is `pm`-only. The freeze rule
  targets it identically to retinoid, reuses `reasonCode: 'pregnancy_blocked'`
  (no new decision-reason code needed). Acids/BPO confirmed still excluded —
  `pregnancy.test.ts`'s "does not declare a freeze for acids or benzoyl
  peroxide" test still passes unmodified.

**Part B — goal-coverage check:**
- Confirmed `RoutinesScreen.tsx` calls `buildRoutineContext()` exactly once
  for the `goalCoverageInput` memo and reuses `context.treatmentClassRanking`
  — no per-goal re-resolution, so the `barrier_repair` cross-goal modifier
  cannot be silently bypassed.
- Confirmed the core correctness property directly in source: in
  `findingForGoal()`, `frozenMatches.length === ownedMatches.length` can only
  be true once `ownedMatches.length >= 1` (the `=== 0` case already returned
  `not_owned` earlier), so `safety_redirect` fires exactly when EVERY owned
  match is pregnancy-frozen — one safe owned alternative correctly falls
  through to `on_shelf`. `goalCoverage.test.ts`'s "falls back to on_shelf
  instead of safety_redirect when a non-frozen owned match also exists" test
  exercises this directly and passes.
- `GoalCoverageBanner.tsx`'s `TONE_MAP`: `safety_redirect → 'warning'`
  (Amber), `on_shelf`/`not_owned → 'info'` (Cobalt). Grepped for `tone="sos"`
  — absent. No hardcoded colors in either new file (`grep` for hex literals
  returns nothing) — everything routes through `colors`/`AlertTone`.
- `goalCoverage.ts` has zero React/react-native imports — pure util, correct
  layer.
- Confirmed `settingsStore.ts`'s real default is `dismissedBanners: []`
  (never undefined) — the `goal-confirm-routines-screen.test.tsx` mock fix
  (adding `dismissedBanners`/`dismissBanner` to that file's stale mock) is a
  legitimate fixture completion, not a workaround for a real component bug.
  `GoalCoverageBanner.tsx` correctly does NOT carry a defensive `?? []` for a
  case that can't happen against the real store.
- `advisoryCopy.test.ts`'s `allTemplates()` collector calls `goalCoverage.ts`'s
  message builders across representative renderings of all three tones,
  including the safety_redirect variant with and without a nameable safe
  alternative — confirmed by reading the collector, not just its import list.

**WARNING (non-blocking), found and fixed during this review:**
`getGoalCoverageFindings()` was 69 lines, over the project's 50-line
guideline (same class of finding the Phase 8-10 review flagged on
`ConflictWarningInline`). Split into a per-goal `findingForGoal()` helper (49
lines) plus a 14-line loop, mirroring that precedent's fix. Re-verified
`npx tsc --noEmit` clean and `goalCoverage.test.ts`/`advisoryCopy.test.ts`
still 61/61 after the split.

**Gates:**
- `npx tsc --noEmit` — clean, 0 errors.
- `npx jest --testPathIgnorePatterns="worktrees"` — 139/149 suites,
  1609/1692 tests, 2 todo. Exactly the same 10 pre-existing failing suites as
  the baseline recorded above, verified by name — no regression, including
  after the `findingForGoal()` refactor.

**Verdict: ACCEPT.**
