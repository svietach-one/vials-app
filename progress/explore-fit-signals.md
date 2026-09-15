Status: IN_PROGRESS
Tech Design: docs/tech-design/explore-fit-signals.md
Code:
- src/utils/productProfile/goalFit.ts (new, FE-1)
- src/utils/productProfile/goalFit.test.ts (new, co-located unit tests)
- src/components/catalog/GoalFitCard.tsx (new, FE-2)
- src/utils/productProfile/conditionCaution.ts (new, FE-3)
- src/utils/productProfile/conditionCaution.test.ts (new, co-located unit tests)
- src/components/catalog/SkinTypeCautionNotice.tsx (modified, FE-4)
- src/hooks/useCompositionInsights.ts (modified, FE-5)
- src/hooks/useCompositionInsights.test.ts (extended, FE-5 coverage)
- src/components/catalog/CompositionInsightsSection.tsx (modified, FE-6)
Target branch `feature/explore-personalization` (branched from origin/dev, checked out locally,
not yet pushed to remote)

## Карточка задачи
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [x] QA tests (qa-lead)
- [x] Implementation (engineer)
- [ ] Architecture review (tech-lead)

## Log

2026-09-14 — planner: Wrote `docs/specs/explore-fit-signals.md` and
`docs/tech-design/explore-fit-signals.md` for the human-approved A+D+E scope (goal-fit signal,
condition-aware caution enrichment, skin-type-unset nudge) on the Explore Composition result screen.
No production code touched — read-only research plus these two docs and this progress pair.

Verified every claim in the task brief against direct file reads before writing, per instruction, and
found the brief's "Context" section was stale relative to the current codebase: a prior,
untracked-by-this-task-slug "explore-insights-v2" round (git commits `47ad52c`/`0d7a47d`/`9280677`/
`11db0e1`/`1694419`, tasks 01/04/05/06 + a code-review pass) already shipped on top of the original
Explore Composition feature and changed the exact shape of `SkinTypeCautionNotice.tsx` and
`useCompositionInsights.ts` the brief described. Concretely: `SkinTypeCautionNotice.tsx` already
renders a "Set your skin type to see how these ingredients suit you" nudge (commit `9280677`, "Task
05: nudge to set skin type instead of silently rendering nothing") — but gated on `caution !== null &&
skinType === null`, not unconditionally on `skinType === null` as the brief's Story E assumed. This is
a real, deliberate, already-documented product decision (the component's own comment argues an
unconditional nudge "would be a lie" when nothing is actually caution-worthy) — reversing it is a
business decision, not something this pass resolved on its own; it is spec §10 Open Question 3.

Confirmed structurally (per the task's own instruction to verify before assuming) that
`skinConditionModifiers.ts`'s `CONDITION_MODIFIERS` advisory templates can be read as a static lookup
table without invoking `conflictEngine.ts` or that module's conflict-wrapping half
(`applyConditionSeverityModifiers`/`getConditionRiskWarnings`, both `Product[]`-shaped). Found a
concrete proof case that the new condition-caution signal is NOT redundant with the existing
skin-type-only trigger: azelaic acid (`actives.json`: `irritancy: 2`, `exfoliating: false`,
`photosensitizing: false`) never trips `buildSkinTypeCaution`'s flat-tier threshold, but IS an eczema
advisory tag in `CONDITION_MODIFIERS` — so `SkinTypeCautionNotice`'s top-level render guard must change
from `caution === null` to `caution === null && conditionCaution.length === 0`, not just gain a new
prop.

Left 3 genuine business-level gaps as Open Questions (spec §10), per explicit instruction not to
silently resolve them as assumptions: (1) whether the goal-fit "no overlap" case renders a miss
sentence or stays silent; (2) exact layout when both `primaryGoal` and `secondaryGoal` produce a
finding; (3) whether the already-shipped skin-type nudge should widen beyond its current gate. Tech
design FE-1/FE-2 wire the miss-case copy builder but leave it unwired pending (1); all other FE-1..FE-6
tasks are unblocked and ready for qa-lead/engineer.

2026-09-14 — planner: Coordinator relayed product's resolution of 3 of the 4 Open Questions above.
Updated `docs/specs/explore-fit-signals.md` and `docs/tech-design/explore-fit-signals.md` accordingly:
(1) goal-fit "no overlap" — RESOLVED, SHOW the miss sentence (matches `goalCoverage.ts`'s "not_owned"
tone); Story 1 AC4 rewritten as concrete/testable, `GoalFitCard`'s miss branch (FE-2) unblocked and now
a required implementation, not a stub. (2) two-simultaneous-goal-findings layout — RESOLVED, ONE card /
one line per goal, confirmed as proposed (mirrors `GoalCoverageBanner`); Story 1 AC2 finalized, FE-2
gets a `testID="goal-fit-row-{goal}"` per line for qa-lead to assert both rows independently. (3)
skin-type-unset nudge scope — RESOLVED, KEEP current scope (`caution !== null && skinType === null`,
unchanged); documented explicitly in both docs as a confirmed non-change, not an oversight (spec Story
3 AC3, tech design FE-4). Open Question 4 (exact copy wording for the goal-fit sentences) stays open,
owner design, `PLACEHOLDER` per the project's established convention — not invented here. Spec Status
flipped DRAFT → APPROVED (only the trailing copy-wording item remains open, same pattern
`docs/specs/explore-composition.md` used before Story 7's caution copy was finalized). Also refreshed
`progress/explore-fit-signals-handoff.json`'s `planner_notes` for consistency with the resolved
questions (not explicitly requested, but leaving it stale would mislead the next agent reading it).

Confirmed via `git branch --show-current` that this session is already on
`feature/explore-personalization` (checked out locally, branched from `origin/dev` per the coordinator,
no matching remote branch yet — not pushed). Noted in the `Code:` line above. Still no production code
touched — `git status --short` shows only the 4 doc files in `docs/specs/`, `docs/tech-design/`, and
`progress/` for this task slug.

2026-09-15 — qa-lead: Read the approved spec/tech design and
`docs/specs/explore-composition.md` / `docs/tech-design/explore-composition.md`
for style/fixture precedent, then wrote the integration/component test suite
for this task's scope (tech design FE-1..FE-6) BEFORE any production code
exists, per `.claude/rules/agent-layer-protocol.md` §12. No `src/` files were
created or edited.

Files created/extended:
- `tests/explore-composition/GoalFitCard.test.tsx` (NEW) — no-goal empty case,
  single-goal match branch (names the active + goal, no score/%), single-goal
  miss branch (spec §10 Open Question 1, RESOLVED: the miss sentence is a
  required render, not a stub), and the two-simultaneous-goal-findings layout
  (Open Question 2, RESOLVED: exactly ONE card, one `testID="goal-fit-row-
  {goal}"` line per goal, never two cards, never a silently dropped goal).
- `tests/explore-composition/SkinTypeCautionNotice.test.tsx` (EXTENDED) — kept
  the 4 original caution x skinType branches verbatim as regression coverage
  (now passing the new required `conditionCaution: []` prop explicitly), then
  added: the azelaic-acid-under-eczema case proving the top-level render gate
  changed from `caution === null` to `caution === null && conditionCaution
  .length === 0` (this active never trips the generic skin-type trigger —
  verified directly against `actives.json`: irritancy 2, exfoliating/
  photosensitizing both false); the KEY REGRESSION test proving the skin-
  type-unset nudge's gate did NOT widen (`caution !== null && skinType ===
  null` unchanged, spec §10 Open Question 3 RESOLVED — a condition-only
  finding with `skinType === null` must NOT fire the nudge); same-active
  precedence (condition-specific line wins, generic sentence excludes that
  key but still names any other non-covered triggering key); and an explicit
  "no skinConditions set" block proving the no-conditions path is unchanged.
- `tests/explore-composition/fixtures.ts` (EXTENDED) — added
  `makeGoalFitFinding`/`makeConditionCautionFinding` factories (types don't
  exist yet — FE-1/FE-3), `makeProfileLike`/`ProfileGoalConditionLike` so both
  result-screen suites share one typed `mockProfile` shape now that it must
  carry `primaryGoal`/`secondaryGoal`/`skinConditions` alongside `skinType`,
  and `collectRenderOrder` (a single depth-first testID+text collector,
  needed because the result-screen order spans one untagged section —
  `FunctionalProfileCard` has no wrapper testID, only a "Functional profile"
  text heading — and several testID-tagged ones).
- `tests/explore-composition/ExploreCompositionResultScreen.test.tsx`
  (EXTENDED) — added a `skinConditionModifiers.ts` guardrail spy
  (`applyConditionSeverityModifiers`/`getConditionRiskWarnings` real-impl
  spies, alongside the pre-existing `conflictEngine.ts` guardrail), widened
  `mockProfile`'s type/factory to `ProfileGoalConditionLike` (all 7 existing
  reassignment sites updated to the spread form, verified via `tsc` that no
  existing assertion changed), and appended new describe blocks: Story 1
  goal-fit wired end-to-end through the REAL `buildGoalFit`/pipeline (not
  just the component-level fixture), Story 2 condition-aware caution wired
  end-to-end, a Story 3 regression block at screen level, a result-screen
  ordering test (Functional profile → Detected actives → caution → Goal-fit
  card → Comparison matrix → Routine placement → disclaimer) via the new
  `collectRenderOrder` helper, and a guardrails block asserting `conflictEngine`
  /`applyConditionSeverityModifiers`/`getConditionRiskWarnings` are never
  called and that neither the `WishlistEntry` save payload nor the "Put on
  Shelf" `explorePrefill` navigation payload ever carries a `goalFit`/
  `conditionCaution`/`primaryGoal`/`skinConditions` key (no new persisted
  fields — spec §3 Non-Goals).
- `tests/explore-composition/WishlistEntryDetailScreen.test.tsx` (EXTENDED) —
  the same guardrail mocks, `mockProfile` type widening, and Story 1/2/3/
  ordering/guardrails blocks as the result screen, proving parity through the
  shared `CompositionInsightsSection.tsx` (the "identical behavior on both
  screens" requirement); the persisted-fields guardrail here checks
  `wishlistStore.updateEntry`'s patch (via the Notes-card blur-commit path)
  instead of `addEntry`/`explorePrefill`.

Pre-existing, unrelated in-flight work discovered in the same working tree
during this session (NOT touched, NOT reverted — a live parallel-session
situation, matching the precedent already logged in this repo's memory):
`DetectedActivesCard.test.tsx`, `WishlistEntryDetailScreen.test.tsx`,
`ExploreCompositionResultScreen.test.tsx`, and a new `InfoTooltip.test.tsx`
already carried uncommitted `explore-actives-order-info` changes (a sibling
task, also referenced in this branch's `057827d` planning commit) when this
session resumed after an interruption. Verified via `git diff` line-by-line
before editing that my own fixtures.ts `Write` call and every
`ExploreCompositionResultScreen.test.tsx`/`WishlistEntryDetailScreen.test.tsx`
edit were anchor-based text substitutions/appends against content that
existed BEFORE that other session's changes and were unaffected by them —
confirmed no clobbering in either direction by re-diffing after every edit.

Verification: `npx tsc --noEmit` shows only the expected `TS2307`/`TS2322`
errors for modules/props that don't exist until FE-1/FE-2/FE-3/FE-4/FE-5 land
(no errors in files this task didn't need to touch). `npx jest
tests/explore-composition/` — 178 passing / 30 failing; every failure traces
to either this task's new not-yet-implemented behavior or the pre-existing,
unrelated `explore-actives-order-info` tooltip work; the 4 original
`SkinTypeCautionNotice` regression tests pass unmodified, confirming the
no-conditions-set path is untouched by this task's own changes.

2026-09-15 — engineer: Implemented tech design FE-1 through FE-6 against the qa-lead's suite, no
test-file edits.

- FE-1 `src/utils/productProfile/goalFit.ts` (+ co-located `goalFit.test.ts`) — pure
  `buildGoalFit(resolvedActiveKeys, primaryGoal, secondaryGoal): GoalFitFinding[]`, reusing
  `goalCoverage.ts`'s exported `coverageClasses` directly (no `GOALS` re-export, per tech design
  assumption). `buildGoalFitMatchMessage`/`buildGoalFitMissMessage` copy builders are wired and
  non-stub (Open Question 1 resolved: SHOW the miss sentence) — copy stays `PLACEHOLDER` per spec §10
  Open Question 4, matching `goalCoverage.ts`'s "not_owned" tone, no score/percentage anywhere.
- FE-2 `src/components/catalog/GoalFitCard.tsx` — icon-circle-header `Card` (never
  `SkinTypeCautionNotice`'s tinted-alert style), `testID="goal-fit-card"` + one
  `testID="goal-fit-row-{goal}"` per finding (up to 2), returns `null` for an empty `goalFit` array.
- FE-3 `src/utils/productProfile/conditionCaution.ts` (+ co-located `conditionCaution.test.ts`) — pure
  `buildConditionCaution(resolvedActiveKeys, skinConditions): ConditionCautionFinding[]`, adapting
  `getConditionRiskWarnings`'s algorithm (filter `CONDITION_MODIFIERS`, one finding per matching tag,
  merge-by-tag taking highest severity) from a `Product[]` carriers map to a direct
  `resolvedActiveKeys.includes(tag)` check. Imports only `CONDITION_MODIFIERS`/`ConditionModifier` —
  never `applyConditionSeverityModifiers`/`getConditionRiskWarnings`, never `conflictEngine.ts`
  (verified via grep, guardrail tests in `ExploreCompositionResultScreen.test.tsx`/
  `WishlistEntryDetailScreen.test.tsx` also pass). Message text is `CONDITION_MODIFIERS`'s existing
  strings verbatim.
- FE-4 `src/components/catalog/SkinTypeCautionNotice.tsx` — added required `conditionCaution` prop;
  top-level guard changed to `caution === null && conditionCaution.length === 0`; render order is
  condition line(s) first (`testID="condition-caution"`, independent of `skinType`/`caution`), then
  the skin-type-unset nudge (gate unchanged: `caution !== null && skinType === null` — verified via the
  qa-lead's KEY REGRESSION test that this did NOT widen), then the generic sentence built from
  `caution.triggeringKeys` minus any key already covered by a `conditionCaution` finding, suppressed
  entirely when that remainder is empty.
- FE-5 `src/hooks/useCompositionInsights.ts` — added `goalFit`/`conditionCaution` to
  `CompositionInsights`, each its own `useMemo` computed at the top-level hook only (mirrors how
  `skinType` itself is read directly from `profile`), reading `profile?.primaryGoal ?? 'maintenance'`,
  `profile?.secondaryGoal ?? null`, `profile?.skinConditions ?? []`. Extended the existing
  `useCompositionInsights.test.ts` with new describe blocks for both fields (widened the local
  `mockProfile` type to include the three new optional fields).
- FE-6 `src/components/catalog/CompositionInsightsSection.tsx` — wired `<GoalFitCard>` immediately
  after `<SkinTypeCautionNotice>` (now passing `conditionCaution`), before the comparison matrix —
  matches the documented order Functional profile → Detected actives → caution → Goal-fit card →
  Comparison matrix → Routine placement → disclaimer, verified by the qa-lead's `collectRenderOrder`
  tests on both result screens.

No qa-lead test files were edited — every assertion passed as originally written; no genuine test bug
was found. Discovered and left untouched, as instructed: the same parallel-session
`explore-actives-order-info` in-flight work qa-lead's log already documented (`DetectedActivesCard.tsx`
diff, new `InfoTooltip.tsx`, `progress/explore-actives-order-info*` files) — confirmed via `git status
--short` these remain someone else's uncommitted changes, not touched by any edit in this session.

Verification: `npx tsc --noEmit` clean (zero errors). `npx jest tests/explore-composition/
src/utils/productProfile/goalFit.test.ts src/utils/productProfile/conditionCaution.test.ts
src/hooks/useCompositionInsights.test.ts` — 17 suites / 271 tests, all passing. Also ran the full repo
suite (`npx jest --testPathIgnorePatterns="worktrees"`) to confirm no regressions outside this task's
scope: 10 pre-existing failing suites remain (catalog/shelf-card/PAO-chip/routine-grouping tests,
unrelated `palette`/`shadow` token resolution errors in that area), none of them touching any file this
task created or modified. Guardrail greps confirm zero hardcoded hex colors, zero
`console.log`/TODO/FIXME/HACK, zero direct `AsyncStorage` use, zero React import in the new
`src/utils/` modules, and zero new `conflictEngine.ts` call sites in the files this task touched.
