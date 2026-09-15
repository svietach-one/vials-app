Status: DESIGNED
Tech Design: docs/tech-design/ocr-multishot-overcount.md
Code: —

## Карточка задачи
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [ ] QA tests (qa-lead)
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
