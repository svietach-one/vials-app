# Technical Design: OCR Multi-Shot Overcount Fix
Spec: docs/specs/ocr-multishot-overcount.md
Author: planner
Date: 2026-09-15

## 1. Architecture Overview
No new modules. This is a bug fix inside the existing multi-shot ingredient-capture merge path
shipped as part of Explore Composition (`docs/tech-design/explore-composition.md`).
`ExploreCompositionCaptureScreen.tsx` already calls `mergeIngredientCaptures(prev, result.rawText)`
on every shot after the first. That pure module already does positional seam-overlap detection via
its own `tokensMatch` fuzzy-equality helper (Levenshtein-based), but only within the seam window —
this fix extends the same module with a second, global dedup pass reusing that same helper.
`finalizeCapturedText()`'s existing multi-shot trimming skip (Bug B, root-cause doc §6d) is
untouched — out of scope, see Assumption 2.

```
Shot 1 OCR text ─┐
                 ├─► mergeIngredientCaptures(first, second)   [MODIFIED — FE-1]
Shot 2 OCR text ─┘        │
                           ├─ existing: positional seam-overlap detection (unchanged)
                           └─ NEW: global fuzzy-dedup pass over the remaining
                              second-shot tokens, reusing tokensMatch
                           ▼
                    merged, deduplicated text
                           ▼
              finalizeCapturedText()  [UNCHANGED — Bug B, out of scope]
                           ▼
     capture screen's live count  /  ExploreCompositionResultScreen's list
```

## 2. API Contracts
N/A — local-only app, no backend/HTTP surface in this repo (CLAUDE.md); this fix adds no network
calls, matching `docs/tech-design/explore-composition.md`'s own N/A framing for the same reason.

## 3. Implementation Tasks

### engineer (scope=frontend — app is frontend-only)

- FE-1 (Task 1, must-fix): Global fuzzy-dedup pass — file:
  `src/utils/productProfile/mergeIngredientCaptures.ts`. Keep the existing positional
  seam-detection loop exactly as-is (still correct for a genuine continuation shot — the label
  physically continues where the first photo's frame ended). After computing `overlapLength`,
  replace the current `[...firstTokens, ...secondTokens.slice(overlapLength)].join(', ')` with an
  incremental build: start from `[...firstTokens]`, then for each token in
  `secondTokens.slice(overlapLength)`, in order, append it only if it does not `tokensMatch` any
  token already in the accumulating result so far — checked against the growing merged list
  (`firstTokens` plus any already-accepted post-seam second-shot tokens), not just the original
  `firstTokens` (see Assumption 4). No signature change
  (`mergeIngredientCaptures(firstText: string, secondText: string): string`); no caller changes
  needed elsewhere.

- FE-1 tests (co-located, required): file:
  `src/utils/productProfile/mergeIngredientCaptures.test.ts` (existing, 7 cases). Cases (a) genuine
  seam-overlap and (c) fully-disjoint concatenation are already covered by the existing suite and
  must continue to pass unmodified — proof the fix is backward compatible. Add a new case for (b):
  a second shot whose recognized tokens duplicate content from the middle of the first shot's list,
  with no valid positional seam (today's code finds `overlapLength === 0` here and fully
  concatenates) — e.g. first = a list's back half, second = a heavily-overlapping list that starts
  earlier and ends earlier than first, mirroring the real reported shape (shot 2 starts ~2 items
  before shot 1's start, not a continuation of shot 1's end). Expected result: every unique
  ingredient present exactly once.

- FE-2 (Task 2, optional/stretch — not required for this task's Definition of Done): internal-comma
  INCI-name fragmentation — file: `src/utils/productProfile/resolve.ts`'s `tokenizeIngredientsText`,
  + its existing `resolve.test.ts`. An INCI name with a real internal comma (confirmed in the same
  real OCR sample: "L,2-HEXANEDIOL", OCR'd from "1,2-Hexanediol") currently splits into two fake
  tokens ("L" / "2-HEXANEDIOL") under the naive comma-split — a general precision defect affecting
  single-shot captures too, not just multi-shot. Engineer decides whether this is cheap enough to
  bundle into the same PR as FE-1 or should be its own follow-up task — do not block FE-1 on it.
  Non-binding direction if bundled: a coalescing pass rejoining a bare 1-2-character fragment with
  an immediately-following digit-leading fragment; exact approach is engineer's call.

### qa-lead
This fix touches only a pure utility module with no new/changed screen, component, or user-facing
copy — no new integration/E2E surface. qa-lead's role for this task is confirmatory (re-run
`tests/explore-composition/`, particularly `ExploreCompositionCaptureScreen.test.tsx`, to confirm
no regression) rather than new component-test authoring; exact scope is qa-lead's own call per
`.claude/rules/tech-design-template.md`'s "What NOT to Include."

### engineer (unit tests, both scopes)
FE-1 (and FE-2, if bundled) each include their own co-located `*.test.ts` coverage per
`.claude/rules/testing.md` — pure logic, Jest only, no React/store imports, Arrange/Act/Assert.

## 4. Assumptions
- Adopt the coordinating session's recommended mechanism for Bug A (a global fuzzy-dedup second
  pass reusing `tokensMatch`) directly, without a separate human sign-off round on the mechanism
  itself.
  Alternative: escalate the fix approach to the human before writing this tech design.
  Reason: this is a Type B technical gap with one clearly correct implementation given the
  already-completed, evidence-based root-cause investigation (real user screenshot + the two real
  source photos) — the investigating session explicitly framed it as adoptable, not a business
  gap; escalating a well-evidenced mechanism would add delay with no decision-quality benefit.
- Bug B (`finalizeCapturedText`'s multi-shot trimming skip) stays untouched, out of scope here.
  Alternative: fix Bug B in this same task, since it's a second confirmed contributor to the same
  symptom.
  Reason: `docs/investigations/ocr-incomplete-ingredient-capture.md` §6d already tried and reverted
  two different safe-trim approaches, both risking silent real-ingredient-data loss — the exact
  regression class that doc's "under-filtering over over-filtering" principle exists to prevent;
  it explicitly says this needs more real multi-shot samples to design against, not a fourth guess.
  Once FE-1 ships, this report's own case drops from ~124 to roughly the true single-list count,
  since dedup removes nearly all of the second shot's contribution — Bug B's residual few-token
  inflation is no longer the dominant, user-visible problem this report is about.
- No new capture-time UI heuristic or prompt is introduced (e.g. "this looks like a duplicate —
  replace instead of add?").
  Alternative: detect a likely-duplicate second shot at capture time and prompt before merging.
  Reason: `docs/investigations/ocr-incomplete-ingredient-capture.md` §6a is a direct, already
  -paid-for lesson in this exact codebase — an equivalent geometry-based heuristic was shipped and
  fully reverted the same day after firing on nearly every real capture. This fix is purely
  algorithmic, adds no new interruption, and doesn't repeat that mistake.
- The new dedup pass checks each second-shot token against the full accumulating merged list, not
  against `firstTokens` alone.
  Alternative: check only against the original `firstTokens`.
  Reason: checking the full accumulating list is strictly more correct (also catches an accidental
  duplicate within the second shot's own post-seam contribution) at the same cost, and produces
  identical results to the narrower alternative on every case this bug report and the existing
  suite care about — no tradeoff is made by choosing the more thorough option.
- FE-2 (internal-comma fragmentation) is scoped optional/stretch, not a required deliverable.
  Alternative: make it a mandatory Task 3 with its own blocking ACs and tests.
  Reason: it's a secondary, lower-priority precision defect confirmed in the same real OCR sample
  but not the cause of the reported ~124-vs-~47 doubling (that's Bug A); the coordinating session
  explicitly scoped it as an engineer-judgment call, so mandating it here would exceed the given
  fix scope without new evidence it's cheap or urgent.

## 5. Open Questions
No open questions blocking implementation. Bug B and the FE-2 bundling decision are deliberate
non-goals / engineer-judgment calls, not pending decisions — see Assumptions 2 and 5 above, and
spec §10 for their owners.
