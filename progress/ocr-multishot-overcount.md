Status: IN_PROGRESS
Tech Design: docs/tech-design/ocr-multishot-overcount.md
Code: —

## Карточка задачи
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [x] QA tests (qa-lead)
- [ ] Implementation (engineer)
- [ ] Architecture review (tech-lead)

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
