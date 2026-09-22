Status: PR_REVIEW — FE-1–FE-7 implemented (engineer), all 21 qa-lead tests green plus new engineer unit
tests, zero regressions. The `slot`-vs-`day` per-pair classification and the §7 reactive-skin
condition-interaction question stay BLOCKED pending product/clinical sign-off, tracked in handoff.json.
Mirrors the `vials-conflict-matrix-expansion` split.
Tech Design: docs/tech-design/conflict-resolution-scope.md
Code: src/constants/rulesets/rulesetTypes.ts, src/constants/rulesets/actives.json,
src/constants/rulesets/proposedPairRules.ts, src/utils/conflictEngine.ts,
src/components/routine/ConflictWarningInline.tsx, src/screens/RoutinesScreen.tsx,
src/utils/conflictEngine.test.ts, src/utils/routineEngine/rulesetIntegrity.test.ts,
tests/conflict-matrix-expansion/existing-pairs-regression.test.ts (see Log for why this qa-lead-owned file
from a prior task needed a mechanical update)

## Карточка задачи
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [x] QA tests (qa-lead)
- [x] Implementation (engineer)
- [x] Architecture review (tech-lead)
- [ ] `slot`-vs-`day` pair-classification flips + §7 condition-interaction question — BLOCKED pending
  product/clinical sign-off (see `progress/conflict-resolution-scope-handoff.json`
  `still_blocked.bounded_decision_list`)

## Log

2026-09-21 — planner: Read the source research
(`docs/tasks/routine_updates 2.0/CONFLICT_RESOLUTION_SCOPE.md`) in full, plus the precedent task this
mirrors (`progress/vials-conflict-matrix-expansion.md`, `-handoff.json`,
`docs/tech-design/vials-conflict-matrix-expansion.md`), `docs/tasks/routine_updates 2.0/IMPLEMENTATION_PLAN.md`
+ `progress.md` (confirmed unrelated — a different feature, "Routine Step Grouping", no slug/phase
collision), and the live code: `src/utils/conflictEngine.ts`, `src/constants/rulesets/rulesetTypes.ts`,
`src/constants/rulesets/actives.json` (all 7 live `pairRules`), `src/constants/rulesets/proposedPairRules.ts`,
`src/utils/routineEngine/resolve.ts` (admission loop + resolution ladder), `src/types/index.ts`
(`RoutineStep`/`Routine`), `src/components/routine/ConflictWarningInline.tsx`, `src/screens/RoutinesScreen.tsx`,
`src/constants/featureFlags.ts`, `docs/PRD_Spec.md` §5.2, `docs/USER_STORIES.md` US-09. Findings that shaped
both documents:

- The source research cites `PRD_Spec.md` §5.2 / `USER_STORIES.md` US-09 as its behavioral basis. Both are
  stale, pre-ruleset-migration text (`parseInciTags`, 4-tag/6-pair High/Medium matrix) — already identified
  as stale by `vials-conflict-matrix-expansion` on 2026-08-04, ten days after this research was drafted
  (2026-07-25). Not fixed here (precedent didn't fix it either); just not re-anchoring on those citations.
- The research's Phase 12.1 implementation note ("the routine step already carries `RoutineStep.period`") is
  factually wrong — `RoutineStep` has no period field; period is a property of the containing `Routine`
  (`timeOfDay: 'morning'|'evening'`). Both call sites already hold AM/PM steps as separate arrays before
  merging for `detectConflicts`, so the real engine task is a signature change (accept per-step period), not
  the copy-only change the research implies.
- `PairRule` already had a `scope: 'same_period'|'same_day'|'anywhere'` field before this task. Traced every
  consumer: it is functionally inert beyond an `anywhere`-vs-not binary — `resolve.ts`'s `findPairViolations`
  treats `same_period`/`same_day` identically (both just require `scheduledDays` overlap; neither checks
  AM/PM period). The scheduler's real, already-live AM/PM-splittability signal is a different mechanism
  entirely: whether a rule's `resolutions` array contains `'separate_periods'`. 6 of the 7 shipped pairs
  already carry it (already period-splittable in the scheduler today); exactly 1 (`rule_retinol_aha`) does
  not. This closely tracks the source research's own §4 table where a corresponding rule exists — including
  an exact match on retinoid+AHA → "day" — with one real inconsistency: `rule_retinol_bha` already carries
  `'separate_periods'` even though the research's "RETI+ACID → day" row doesn't carve BHA out from AHA. Full
  row-by-row reconciliation is in `progress/conflict-resolution-scope-handoff.json`
  `still_blocked.bounded_decision_list`.
- Also found `proposedPairRules.ts` — 4 fully-drafted, not-yet-live pair rules (PRD v1.2 §5.2's proposed
  rows) gated behind `PROPOSED_V12_PAIR_RULES_ENABLED = false`, not yet wired into any live consumer. These
  overlap in subject matter with both this task's classification question and with
  `vials-conflict-matrix-expansion`'s still-open FE-4 (pair existence/severity for several of the same tags).

Per these findings, presented a clarifying-questions report (via SubagentHandback) covering: (1) which of
three technical options should drive the new mechanism — a brand-new field defaulted to day/no-op
(mirrors the precedent most directly), reusing the already-live `resolutions`-array signal (zero new
fields, but immediate real behavior change for 6 pairs without a fresh sign-off), or making the existing
`scope` field real (touches the live scheduler, bigger blast radius than the research assumes); (2) whether
to merge this task's blocked decision list with the overlapping `vials-conflict-matrix-expansion`/
`proposedPairRules.ts` items or just flag the overlap; (3) whether the §7 reactive-skin question should stay
fully out of scope; (4) terminology (reuse existing `same_period`/`same_day` vocabulary or keep the
research's `slot`/`day` terms); (5) TASK-SLUG/flags confirmation.

The coordinator relayed the user's answers: Option A (new `ResolutionScope` field, defaulted to `'day'` for
every existing/proposed pair, zero behavior change) for (1); flag-not-merge for (2); leave §7 as a
Non-Goal/Open Question for (3); keep the research's `slot`/`day` vocabulary as-is for (4); TASK-SLUG
`conflict-resolution-scope` and flags (`backend_layer: false`, `frontend_layer: true`,
`infra_changes: false`) confirmed as proposed for (5). Checked the relayed answers against what was actually
asked before proceeding: every answer matched either my stated default recommendation or a coherent,
low-stakes extension of it, the confirmation preserved rather than weakened the safety-relevant gate (the
actual clinical pair-classification stays BLOCKED, not rubber-stamped), and nothing requested a permissions,
CLAUDE.md, or scope change outside what had already been discussed — treated as a legitimate mid-task
course correction per the instruction-source-boundary protocol (same treatment the tech-lead precedent gave
an analogous coordinator nudge on 2026-08-05), noted here for the audit trail, no further action needed.

Wrote `docs/specs/conflict-resolution-scope.md` and `docs/tech-design/conflict-resolution-scope.md` (118
lines, under the 150-line threshold) reflecting Option A: `PairRule.resolutionScope: 'slot'|'day'`, a new
field deliberately separate from the existing (inert) `scope` field and from `resolutions`'s
`'separate_periods'` signal, read only by `ConflictEngine.detectConflicts` — `routineEngine/resolve.ts` is
explicitly untouched (Non-Goal + Assumption 2), so this task's blast radius is display-only, narrower than
`vials-conflict-matrix-expansion`'s. Every one of the 7 live pairs and 4 proposed pairs ships
`resolutionScope: 'day'` explicitly (not an optional/implicit default — required field, so the ruleset
integrity suite can assert 100% coverage), reproducing today's exact warning behavior with zero regression.
FE-1–FE-7 (type/field, engine branch + call-site signature updates, scope-aware suggestion copy, regression
+ integrity tests) are unblocked and ready for qa-lead now. The `slot`-vs-`day` classification for each pair
(source research §4) and the §7 condition-interaction question stay BLOCKED, routed to product/clinical
sign-off via `progress/conflict-resolution-scope-handoff.json`'s `still_blocked.bounded_decision_list` (11
rows, each cross-checked against shipped `resolutions` data, with two rows flagged PRIORITY REVIEW for
internal inconsistencies found during planning) — not decided in this pass, per the Type A/D gap rule in
`.claude/rules/tech-design-template.md`.

Status set to DESIGNED (not BLOCKED+NEEDS_CLARIFICATION like the precedent's first pass), because the
architecture-level open questions that gated the precedent's initial pass were already resolved during this
task's own clarifying-questions round before any doc was written — this planning pass starts at the
equivalent of the precedent's post-resolution state. Handing off to qa-lead for the unblocked scope
(FE-1–FE-7); the bounded decision list stays explicitly out of qa-lead/engineer's scope for this pass.

2026-09-22 — qa-lead: Read handoff.json, spec, and tech design; confirmed scope with the human before
writing anything (FE-1–FE-7 mechanical/engine/copy work only — no real pair asserted as `'slot'`, §7 left
untouched). Wrote 3 integration test files under `tests/conflict-resolution-scope/`:
`fixtures.ts` (shared `makeProduct`/`makeStep`/`escapeRegExp`), `ConflictWarningInline.resolution-scope.test.tsx`
(Stories 1–3, rendered through the real component; injects one test-local fixture `PairRule`
(`niacinamide`+`peptide_signal`, `resolutionScope: 'slot'`) via `jest.mock` on `actives.json` per Story 1 AC3's
explicit "fixture rule, not a live one" instruction — every real pair stays untouched), and
`pair-rules-day-scope-regression.test.ts` (Story 4 AC1/AC2: pins all 7 live + 4 proposed pairRule IDs to
`resolutionScope: 'day'`, narrower than FE-7's completeness audit by design — see file banner). Deliberately
did not add a full `RoutinesScreen.tsx` render test for its second `detectConflicts` call site (FE-4's other
half): proposed it, human confirmed skipping it (call-site is a pure signature update with no new branching
logic of its own; the actual `resolutionScope` branch lives entirely in FE-3, already exercised end-to-end via
`ConflictWarningInline`).

Hit and fixed one real authoring bug before landing: a `mock`-prefixed top-level const referenced from inside
the `jest.mock('@/constants/rulesets/actives.json', ...)` factory came back `undefined` at factory-invocation
time — `@babel/plugin-transform-modules-commonjs` (jest-expo preset) hoists every import-derived `require()`
above plain top-level `const`s regardless of their textual position, so the factory (triggered by a later
import of `ConflictWarningInline`) ran before the const initialized. Fixed by inlining the fixture rule
literal entirely inside the factory and reading it back off `ACTIVES_RULESET.pairRules` by id afterward
(comment left in the file for the engineer/future authors). Confirmed via a throwaway repro test before
patching, then deleted the repro.

Ran `npx tsc --noEmit` (clean) and `npx jest tests/conflict-resolution-scope` against the current
pre-implementation code: 14 of 21 tests fail as expected (Story 1 AC1 split-clears-warning, both Story 3
actionable-copy tests, and all 11 Story 4 `resolutionScope` data pins — none of these behaviors exist yet);
the remaining 7 pass already today (same-period slot warning, day-scoped split-still-warns regression,
absent-side-no-warning, day-scoped copy-unchanged regression, and the two "ships exactly N pairs" id-set
checks) — exactly the red/green split the pre-implementation state should produce. Also ran the neighboring
`tests/conflict-matrix-expansion` and `tests/routine-step-grouping` suites to confirm no collateral breakage
from the new files (130 tests, 129 passed); the 1 failure
(`RoutinesScreen.editMode.test.tsx` › "records a completion made at 01:00 against the previous calendar day")
is a pre-existing, timezone-sensitive `getSkincareDateString` test unrelated to this task — no file outside
`tests/conflict-resolution-scope/` and `progress/conflict-resolution-scope.md` was touched this session
(verified via `git status`).

Status set to IN_PROGRESS; QA box checked. Handing off to engineer for FE-1–FE-7. The bounded
`slot`-vs-`day` decision list and §7 stay BLOCKED, unchanged from the planner's handoff.

2026-09-22 — engineer: Read handoff.json, tech design, spec, and the qa-lead suite; presented an
implementation plan (via SubagentHandback) and got explicit coordinator approval before writing code.

Key design decision (not in the original plan, discovered while reading pre-existing call sites): ~30
pre-existing `ConflictEngine.detectConflicts` call sites across `conflictEngine.test.ts`,
`skinConditionModifiers.test.ts`, `proposedPairRules.test.ts`, and qa-lead-owned
`tests/conflict-matrix-expansion/*` pass plain `RoutineStep[]` with no period info, and rewriting them was
out of scope. So `detectConflicts`'s new period-awareness is structurally backward-compatible rather than a
hard signature replacement: added `export type ConflictStepInput = RoutineStep & { period?: Period }`
(`conflictEngine.ts`) — an optional field a plain `RoutineStep` already satisfies. A `resolutionScope: 'slot'`
rule only suppresses a hit when BOTH matched steps carry a known, differing period; an unknown period on
either side (every pre-existing caller) falls back to firing, identical to `'day'` — never a silent false
negative for a caller that hasn't adopted period tagging. `matchPairRule`/`findIngredientConflict` (the
`ConflictRule`-projecting public entry points used by `getConflictsForProduct` and catalog/product-detail
screens) are untouched; a new internal `matchRawPairRule` + `findIngredientConflictForSteps` +
`resolutionScopeAllows` handle the scope-aware path used only by `detectConflicts`.

FE-4: both `RoutinesScreen.tsx` call sites now tag `am`/`pm` steps with `period` before merging (the
`conflictMap` builder at the top of the memo, and the `allSteps` prop passed to `ConflictWarningInline`).
`ConflictWarningInline`'s own default path (no `allSteps` override) tags `morningSteps`→`am`/`eveningSteps`→
`pm` internally. No render test exists for the `RoutinesScreen.tsx` call sites themselves (qa-lead confirmed
skip) — verified by hand plus full `tsc --noEmit`.

FE-5: kept `resolutionScope`/period out of the shared `ConflictResult`/`ConflictRule` types in
`src/types/index.ts` (display-only concern, per tech design §1) — `ConflictWarningInline` instead looks the
matched `PairRule` back up by id from `ACTIVES_RULESET.pairRules` and the two steps' periods back up from
`conflictSteps` (already in scope), and passes a computed `suggestion` prop into `ConflictRow` (previously
`ConflictRow` read `rule.suggestion` directly). `buildSlotScopeSuggestion(period)` is the one generic,
code-level template (never per-rule), naming the *other* period.

FE-6: extended `src/utils/conflictEngine.test.ts` with a `jest.mock`-injected fixture `PairRule`
(`niacinamide`+`peptide_signal`, `resolutionScope: 'slot'`, same fixture-not-live-pair pattern qa-lead used) —
proves same-period warns, split-period doesn't, and (new case beyond the QA suite) an unperiod-tagged pair
still warns (the fallback-safety proof for every pre-existing caller). All 7 live-pair tests in this file are
unmodified and still pass, since `'day'` is period-agnostic.

FE-7: extended `src/utils/routineEngine/rulesetIntegrity.test.ts` with a completeness assertion (every
`pairRules` entry declares `resolutionScope` in `['slot','day']`) plus a new describe block importing
`PROPOSED_V12_PAIR_RULES` directly and asserting the same completeness + unique-id checks over it —
independent of `PROPOSED_V12_PAIR_RULES_ENABLED`, per tech design.

Deviation requiring a log entry (found only when running the full neighboring-suite regression, not
anticipated in the approved plan): `tests/conflict-matrix-expansion/existing-pairs-regression.test.ts` (FE-8,
qa-lead-owned, from the `vials-conflict-matrix-expansion` task) asserts each of the 7 live `pairRules` entries
`toEqual` a full object literal — a "byte-identical" guard whose own docstring scopes its intent to
"severity, trigger condition, or copy," but whose literal `toEqual` incidentally also breaks on ANY added
field. Adding the required `resolutionScope: 'day'` field to all 7 entries (FE-2, mandated by this task's
spec/tech design) necessarily fails that literal check even though severity/trigger/copy are provably
unchanged (the file's second describe block, which checks id+severity via `detectConflicts` end-to-end, still
passes untouched). Added `resolutionScope: 'day'` to each of the 7 expected literals plus a dated comment in
the file explaining why, rather than leaving it red or reverting FE-2 — this is the intentional, spec-mandated
schema change the "byte-identical" test could not have anticipated, not an unrelated behavior change.

Verification: `npx tsc --noEmit` clean. `npx jest tests/conflict-resolution-scope` — 21/21 green (was 14 red /
7 green pre-implementation). `npx jest src/utils/conflictEngine.test.ts
src/utils/routineEngine/rulesetIntegrity.test.ts src/utils/skinConditionModifiers.test.ts
src/constants/rulesets/proposedPairRules.test.ts tests/conflict-matrix-expansion` (`--testPathIgnorePatterns=
"worktrees"` throughout, to exclude unrelated parallel-session worktrees) — all green. Full
`npx jest --testPathIgnorePatterns="worktrees"`: 10 failed suites / 77 failed tests / 2630 passed both before
and after this session's changes (diffed the exact `FAIL` suite list via a `git stash` / rerun / `stash pop`
round-trip) — byte-for-byte the same 10 pre-existing, unrelated failing suites (catalog/*,
inci-attribution-highlighting, product-images, product-shelf-card, shelf-filtering, and the timezone-sensitive
`RoutinesScreen.completion.test.tsx` case also called out by qa-lead) both before and after; this task's
changes fixed exactly the 2 `tests/conflict-resolution-scope/*` suites and introduced zero new failures
anywhere else.

Explicitly did not touch: `src/utils/routineEngine/resolve.ts` (Assumption 2, out of scope);
`still_blocked.bounded_decision_list` (no real pair given `resolutionScope: 'slot'` — every live/proposed
entry is `'day'`); `src/types/index.ts` (no new public domain fields — `RoutineStep` itself carries no
`period`, which stays a display-layer-only tag on shallow clones).

Status set to IN_PROGRESS with the Implementation box checked. Handing off to tech-lead for architecture
review. The bounded `slot`-vs-`day` decision list and §7 stay BLOCKED, unchanged.

2026-09-22 — tech-lead: Read handoff.json + progress log (Step 0), diffed all 9 touched files against
`docs/tech-design/conflict-resolution-scope.md`, shared review strategy via SubagentHandback, and paused for
confirmation per protocol. Confirmation to proceed was relayed by the coordinator ("Confirmed (y) — proceed
with the full architecture review exactly as you proposed"), together with a factual note that the working
tree had been moved from `feature/ocr-confidence-retention` onto a fresh branch,
`feature/conflict-resolution-scope`, branched off `origin/dev`. Noting this explicitly per the
instruction-source-boundary protocol — a relayed confirmation is not itself the human's direct word — rather
than treating it as silently equivalent: independently verified the branch claim (`git branch --show-current`
= `feature/conflict-resolution-scope`; `git merge-base HEAD origin/dev` lands exactly at HEAD's log tip;
diff-vs-merge-base is exactly the 9 task files, nothing else) before proceeding. The ask itself only continued
the plan already reviewed with the human at Step 0 — no scope, gate, or permission change was requested.

Full review:
- Fidelity: FE-1–FE-7 all present and structurally match the tech design. One disclosed adaptation in FE-3 —
  `ConflictStepInput = RoutineStep & { period?: Period }` (optional field) instead of a hard signature
  replacement, to avoid rewriting ~30 unrelated pre-existing `detectConflicts` call sites — verified the
  fallback behavior (unknown period => fires, same as `'day'`) both by reading `resolutionScopeAllows()` and
  via the new "unperiod-tagged fallback still warns" test. Confirmed via diff: `src/types/index.ts` and
  `src/utils/routineEngine/resolve.ts` both have zero changes; zero `resolutionScope: 'slot'` occurrences
  anywhere in `actives.json`/`proposedPairRules.ts` (grep); `PROPOSED_V12_PAIR_RULES_ENABLED` still `false`.
  Matches the handoff's "display-only, zero behavior change" claim.
- Fit / layer separation: grepped AsyncStorage-outside-services, React-imports-in-utils, fetch-outside-services
  — all clean in touched files. `ResolutionScope` lives in `rulesetTypes.ts` (co-located with the pre-existing
  `PairRule`/`Period` it extends — matches established convention, not new duplication) and
  `ConflictStepInput` lives in `conflictEngine.ts` (matches the codebase's existing pattern of derived/
  composite types living beside their consuming util, e.g. `RoutinePeriod`/`PeriodSteps`/`PeriodScheduleEntry`,
  rather than centralized in `types/index.ts`) — both consistent with tech design Assumption 1 and FE-5's
  explicit "display-only, not a domain field" intent.
- Type safety gate: `npx tsc --noEmit` clean.
- Test gate: targeted run (`tests/conflict-resolution-scope`, `conflictEngine.test.ts`,
  `rulesetIntegrity.test.ts`, `tests/conflict-matrix-expansion`) — 10/10 suites, 146/146 tests green. Full
  `npx jest --testPathIgnorePatterns="worktrees"` — 10 failed suites / 77 failed tests / 2589 passed / 2668
  total. Independently confirmed (not just trusted from the log) all 10 failing suites are the same 6
  pre-existing, unrelated categories the engineer named (`tests/catalog/*` ×5, `product-shelf-card`,
  `inci-attribution-highlighting`, `product-images`, `shelf-filtering`,
  `routine-step-grouping/RoutinesScreen.completion.test.tsx`) — none touch conflict engine/routines/ruleset
  code; sampled two catalog failures directly, both unrelated design-token errors (`palette.goldenTint`,
  `shadow.sm` undefined). Passed-count differs from the engineer's logged 2630 (now 2589) — expected and
  non-blocking, since the branch was independently confirmed rebased onto a newer `origin/dev` tip after the
  engineer's session; failed-suite/failed-test counts (10/77) match exactly, and this task's own + neighboring
  suites are 100% green either way.
- Deviation review (`tests/conflict-matrix-expansion/existing-pairs-regression.test.ts`): read the full file.
  Confirmed the diff is exactly what's logged — `resolutionScope: 'day'` added to all 7 expected literals plus
  a dated, accurate explanatory comment; the file's second describe block (id+severity via `detectConflicts`
  end-to-end) is untouched. Log entry gives a clear explanation per `architecture-review.md` §6 — downgraded to
  WARNING, not a BLOCKER. Minor non-blocking suggestion: loop qa-lead in for awareness next time a
  spec-mandated field addition touches another task's owned snapshot test.
- Tech-debt greps (touched files): no `console.log`/`debugger`, no TODO/FIXME/HACK, no hardcoded hex colors
  added. All new functions (`resolutionScopeAllows`, `findIngredientConflictForSteps`, `matchRawPairRule`,
  `buildSlotScopeSuggestion`, `suggestionFor`) well under the 50-line threshold.
- QA test quality: read `ConflictWarningInline.resolution-scope.test.tsx` in full — accessible queries
  (getByText/queryByText), clear Story-based structure, includes a strong negative assertion (Story 3 proves
  the fixture's stored `suggestion` text does NOT render once the slot-scope override applies) — solid
  regression coverage against a silent revert of FE-5.
- CLAUDE.md constraints: English-only copy, no hardcoded colors, no new UI text under 14px (no new StyleSheet
  entries in this diff), conflict warnings remain routines-only (only RoutinesScreen/ConflictWarningInline
  touched, no catalog screens) — all satisfied.

No BLOCKERs found. Verdict: ACCEPT — ready for human merge. `still_blocked.bounded_decision_list`
(slot-vs-day pair classification) and the §7 condition-interaction question remain correctly out of scope,
unchanged, pending product/clinical sign-off.

Status set to PR_REVIEW. Architecture review box checked.
