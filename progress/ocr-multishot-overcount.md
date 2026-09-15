Status: PR_REVIEW
Tech Design: docs/tech-design/ocr-multishot-overcount.md
Code: src/utils/productProfile/mergeIngredientCaptures.ts, src/utils/productProfile/mergeIngredientCaptures.test.ts

## Карточка задачи
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [x] QA tests (qa-lead)
- [x] Implementation (engineer)
- [x] Architecture review (tech-lead)

## Log

### 2026-09-15 — planner: spec + tech design written (bug-fix task)
Entering directly at the planner phase per explicit task instructions from the coordinating
session — a full root-cause investigation had already been completed there, from real
user-reported evidence (a screenshot of the actual bug plus close inspection of the two real
source photos involved), not re-investigated here.

**Ground truth (not re-derived, per task instructions):** user photographed a serum's ingredient
list twice in Explore Composition's capture screen — two near-duplicate re-shoots of almost the
entire same ~47-ingredient list, not two complementary halves of a too-long list (shot 2 starts
~2 lines earlier than shot 1 within the same physical label, and is not a continuation of where
shot 1 left off). The app reported "2 photos combined — 124 ingredients recognized," roughly 2.5x
the true count.

**Two confirmed, compounding root causes:**
- **Bug A** (`src/utils/productProfile/mergeIngredientCaptures.ts`): the merge function only
  detects a classic panorama-style seam (shot 2 continues exactly where shot 1's frame physically
  ended). When shot 2's head instead lines up with the MIDDLE of shot 1's list (this report's
  actual shape), the seam search finds `overlapLength === 0` and falls back to a near-full
  concatenation of two near-identical lists — the dominant cause of the doubling.
  **FIXED IN THIS TASK** (Task 1 / FE-1, must-fix).
- **Bug B** (`ExploreCompositionCaptureScreen.tsx`'s `finalizeCapturedText`): deliberately skips
  `extractIngredientSection()` trimming for any 2+-shot capture — a pre-existing, intentional,
  already-documented gap (`docs/investigations/ocr-incomplete-ingredient-capture.md` §6d). A prior
  attempt to trim multi-shot text safely was tried twice and reverted both times because it risked
  silently dropping real ingredient data.
  **NOT FIXED IN THIS TASK** — see spec §3 Non-Goals and tech design Assumption 2.
  **Forward-pointer (not a blocking open question):** once more real multi-shot samples exist to
  design against, a future planner task should revisit this. Expected to be a much smaller residual
  (a few footer/prose tokens riding along) once Bug A's dedup ships, not the doubling this report
  is about.

**Recommended fix scope** (from the coordinating session, adopted directly as a Type B technical
assumption — tech design Assumption 1, not escalated as a business gap): a second, global
fuzzy-dedup pass in `mergeIngredientCaptures.ts`, reusing the module's own existing `tokensMatch`
helper, applied to whatever the positional seam search doesn't already consume — checked against
the full accumulating merged list, not just the first shot's tokens (tech design Assumption 4).

**Also documented, explicitly optional/stretch and non-blocking:** a secondary, lower-priority
defect where an INCI name with a real internal comma (e.g. "1,2-Hexanediol", OCR'd as
"L,2-HEXANEDIOL" in the real sample) fragments into two fake tokens under the naive comma-split
tokenizer (`tokenizeIngredientsText`) — affects single-shot captures too, not just multi-shot.
Left to engineer's judgment whether to bundle into the same PR (Task 2 / FE-2) or defer to its own
follow-up task.

**Explicit non-goal, carried forward from a prior lesson in this exact codebase**
(`docs/investigations/ocr-incomplete-ingredient-capture.md` §6a): no new capture-time UI
heuristic/prompt — a geometry-based "is this a duplicate shot?" heuristic was already shipped and
fully reverted the same day in this codebase after firing on nearly every real capture.

No production code written this phase. Artifacts: `docs/specs/ocr-multishot-overcount.md`,
`docs/tech-design/ocr-multishot-overcount.md`.

Next agent: qa-lead, per `.claude/rules/agent-layer-protocol.md` §12. Given this fix touches only
a pure utility module with no new/changed screen or component, qa-lead's role here is expected to
be confirmatory (re-run `tests/explore-composition/` for regression) rather than new integration
test authoring — see tech design §3's qa-lead task note. Exact scope remains qa-lead's own call.

### 2026-09-15 — qa-lead: confirmatory review, no new integration test needed

**Baseline (before any fix lands):**
- `npx tsc --noEmit` — clean, zero errors.
- `npm test` (full suite) — 24 suites / 114 tests failing, all pre-existing and unrelated to this
  task: (a) `.claude/worktrees/agent-*` contains stray leftover sub-worktrees from other agent
  sessions whose `tests/catalog/*.test.tsx` duplicate-mock the real `tests/catalog/` files and fail
  with module-resolution errors; (b) `tests/catalog/product-detail.test.tsx`,
  `catalog-screen.test.tsx`, `add-product-hub.test.tsx` fail on undefined `palette.plumTint` /
  `palette.goldenTint` / `shadow.sm` — a design-token/palette regression unrelated to
  `mergeIngredientCaptures.ts` or Explore Composition. Not investigated or fixed here — out of this
  task's scope, flagged for a separate task.
- `npx jest tests/explore-composition` (the suite this task's caller is checked against) — **14
  suites / 226 tests, all green.**

**Judgment call — no new/updated integration test authored for this task:**
Read `tests/explore-composition/ExploreCompositionCaptureScreen.test.tsx` in full (526 lines,
14 KB). It calls the real `mergeIngredientCaptures` (not mocked — no `jest.mock` boundary around
`@/utils/productProfile/mergeIngredientCaptures` anywhere in the file or elsewhere in
`tests/explore-composition/`), and does assert on merged output in three places: (1) the "genuine
continuation" case (`'Aqua, Niacinamide, Glycerin'` + `'Glycerin, Sodium Hyaluronate'` →
`'Aqua, Niacinamide, Glycerin, Sodium Hyaluronate'`, both the navigation-payload assertion at line
~323 and the "2 photos combined — 4 ingredients recognized" status-line assertion at line ~362);
(2) the fully-disjoint footer/Directions regression case (line ~377). Both shapes are classic
positional-seam or fully-disjoint merges — exactly the two behaviors the tech design (Assumptions 1
and the spec's AC 2/AC 3) requires to stay byte-for-byte unchanged by this fix. Neither fixture
exercises the "second shot starts mid-way through the first shot's list, no valid positional seam"
shape this fix targets (spec AC 1/AC 4, the real ~124-vs-~47 bug shape) — so no existing assertion
in this component suite is expected to need updating once FE-1 lands, and no hardcoded merged-count
or "N ingredients recognized" / "N photos combined" string in this suite is at risk.
Conclusion: re-verifying the existing `tests/explore-composition/` suite stays green after FE-1
lands is sufficient qa-lead coverage for this task, per the tech design's own default expectation
(§3 qa-lead task note). No new integration/E2E test authored. The Story 1 near-duplicate/no-seam
case remains covered exclusively by the engineer-owned co-located unit test
(`src/utils/productProfile/mergeIngredientCaptures.test.ts`), per `.claude/rules/testing.md`'s
unit/component test ownership split — appropriate here since that shape is pure-function-level
behavior with no screen/component surface exercising it distinctly from the two cases already
covered above.

Next agent: engineer, per `.claude/rules/agent-layer-protocol.md` §12. Once FE-1 (and optionally
FE-2) land, re-run `npx jest tests/explore-composition` (must stay 14/14 green, unmodified) plus
`src/utils/productProfile/mergeIngredientCaptures.test.ts` (7 existing cases unmodified + new
case(s) for the near-duplicate/no-seam shape) before handing off to tech-lead.

### 2026-09-15 — engineer: FE-1 implemented, FE-2 deferred

**FE-1 (Task 1, must-fix) — implemented in
`src/utils/productProfile/mergeIngredientCaptures.ts`.** Kept the existing positional
seam-detection loop exactly as-is (still correct for a genuine continuation shot). Replaced the
final blind-concatenation return line
(`[...firstTokens, ...secondTokens.slice(overlapLength)].join(', ')`) with an incremental build:
start from `[...firstTokens]`, then for each post-seam second-shot token, in order, append it only
if it does not `tokensMatch` any token already present in the growing merged list so far (per tech
design Assumption 4 — checked against the full accumulating list, not just the original
`firstTokens`). No signature change; no caller changes needed.

**Tests — `src/utils/productProfile/mergeIngredientCaptures.test.ts`.** All 7 existing cases pass
unmodified (backward-compat proof). Added one new case:
`'drops second-shot tokens that duplicate the middle of the first shot when there is no valid
positional seam'` — first shot `[Aqua, Niacinamide, Glycerin, Panthenol, Tocopherol]`, second shot
`[Niacinamlde, Glycerin, Panthenol, Retinol]` (head `Niacinamlde` does not match first's tail
`Tocopherol`, so the seam search correctly finds `overlapLength === 0`, mirroring the real bug
shape). The near-miss spelling `Niacinamlde` (vs. `Niacinamide`) proves the new global-dedup pass
uses `tokensMatch`'s fuzzy equality, not exact string comparison. Expected/actual result:
`'Aqua, Niacinamide, Glycerin, Panthenol, Tocopherol, Retinol'` — every unique ingredient present
exactly once, only the genuinely new `Retinol` token added.

**FE-2 (Task 2, optional/stretch) — deferred, not bundled into this PR.** `tokenizeIngredientsText`
(`resolve.ts`) is shared by `resolveFromProduct`, `resolveFromRawText`, `shelfComparison.ts`, and
`ExploreCompositionResultScreen.tsx` — not just the merge path this task targets. A coalescing fix
for internal-comma INCI names (e.g. "1,2-Hexanediol") would touch behavior across all those call
sites and needs its own dedicated tests/review, so it does not meet the "cheap and low-risk" bar
for bundling here. Remains tracked as a known, documented secondary defect (spec §10, tech design
Assumption 5) — owner: future follow-up task, does not block this task's Definition of Done.

**Quality gates (all green, in order):**
1. `npx tsc --noEmit` — clean, zero errors.
2. `npx jest src/utils/productProfile/mergeIngredientCaptures.test.ts` — 8/8 passed (7 existing +
   1 new).
3. `npx jest tests/explore-composition` — 14 suites / 226 tests, all green, unmodified — matches
   qa-lead's confirmed baseline exactly, no regression to the continuation or disjoint-shots
   behavior.

Pre-existing, unrelated failures (`.claude/worktrees/agent-*` module-resolution errors,
`palette.plumTint`/`palette.goldenTint`/`shadow.sm` catalog-screen failures) were not investigated
or touched, per task instructions — out of scope.

Files changed: `src/utils/productProfile/mergeIngredientCaptures.ts`,
`src/utils/productProfile/mergeIngredientCaptures.test.ts`.

Next agent: tech-lead, per `.claude/rules/agent-layer-protocol.md` §12.

### 2026-09-15 — tech-lead: ACCEPT (PR_REVIEW, ready for human merge)

**Design fidelity — MATCH.** Diff touches only the final return line of `mergeIngredientCaptures`;
the existing positional seam-detection loop is byte-for-byte unchanged. The new code builds
`mergedTokens` starting from `[...firstTokens]` and appends each post-seam second-shot token only
if `tokensMatch` finds no match already inside the growing `mergedTokens` array itself (the `.some()`
check runs against the same array being `.push()`-ed into on each iteration) — i.e. checked against
the full accumulating list, not a frozen `firstTokens` snapshot, exactly matching tech design §3
FE-1 / Assumption 4. No signature change, no caller changes, `tokensMatch` reused as-is.

**Layer separation — CLEAN.** `mergeIngredientCaptures.ts` still imports only
`tokenizeIngredientsText` from co-located `./resolve`. Grep confirms no React/react-native/store
imports, no `AsyncStorage`, no `fetch(` in either changed file.

**Type safety — CLEAN.** `npx tsc --noEmit` run personally: zero errors.

**Tests — personally run, both green, matching claimed baselines exactly:**
- `npx jest src/utils/productProfile/mergeIngredientCaptures.test.ts` → **8/8 passed** (7
  pre-existing unmodified + 1 new).
- `npx jest tests/explore-composition` → **14 suites / 226 tests, all green** — identical counts to
  qa-lead's pre-fix baseline, confirming zero regression to continuation/disjoint-shot behavior.

**Scope — CLEAN.** `git diff origin/dev..HEAD --name-only`: exactly 6 files (2 docs, 2 progress, the
merge util + its co-located test). No touch to `ExploreCompositionCaptureScreen.tsx` /
`finalizeCapturedText`, the OCR pipeline, camera code, or `resolve.ts` (FE-2 correctly left
untouched/deferred, matching the engineer's log).

**New test case — hand-verified against the fixture, not just trusted by name.** Confirmed
`tokenizeIngredientsText` is a plain comma-split/trim/filter-empty (no dedup at that layer), then
traced the seam loop by hand for first=[Aqua, Niacinamide, Glycerin, Panthenol, Tocopherol],
second=[Niacinamlde, Glycerin, Panthenol, Retinol]: every candidate window (len 4 down to 1) fails —
len=4 fails on its last pair (Tocopherol vs Retinol, Levenshtein ratio well above the 0.25
threshold), and len 1-3 fail immediately since second's head token only fuzzy-matches first's *2nd*
token, never a tail-aligned one. `overlapLength` genuinely resolves to 0, confirming this fixture
exercises the new global-dedup pass, not the seam path. That pass then correctly drops Niacinamlde
(fuzzy dup of Niacinamide), Glycerin and Panthenol (exact dups), keeping only the genuinely-new
Retinol — matches both the test's expected string and the observed jest run. Cross-checked against
the pre-fix formula (`[...firstTokens, ...secondTokens.slice(0)]`): it would have produced 9 tokens
with the duplicates intact, so this test is a real regression guard, not a vacuous one.

**Quality signals — CLEAN.** No TODO/FIXME/HACK, no console.log/debugger in either changed file.
`mergeIngredientCaptures` is 28 lines total, well under the 50-line threshold. No hardcoded
colors/spacing (no UI touched).

**Process note, non-blocking, flagged for the human:** the spec's header states it was "not yet
re-confirmed interactively against this exact document by the human" — planner adopted the
coordinating session's root-cause + fix mechanism directly as a Type B technical assumption per
`.claude/rules/tech-design-template.md`'s gap-type table, which permits proceeding without
escalation for this gap type. No business-level assumption was smuggled in under that framing.
Noting for awareness before merge, not as a review blocker.

Verdict: **ACCEPT.** No blockers, no warnings requiring rework. Ready for human merge.

Next: human (PR / merge). Pipeline complete per `.claude/rules/agent-layer-protocol.md` §12.
