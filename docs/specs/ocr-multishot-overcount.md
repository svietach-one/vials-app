# Vials — OCR Multi-Shot Overcount Fix
Date: 2026-09-15
Author: planner-agent
Jira: N/A (kebab-case task slugs only — see `.claude/rules/agent-layer-protocol.md` §1)
Status: APPROVED (bug-fix task on top of the already-shipped Explore Composition feature. Root
cause was investigated and the fix scope recommended by the coordinating session, from real
user-reported evidence — a screenshot of the actual bug plus close inspection of the two real
source photos involved — before this spec was written; this document formalizes that finding and
adopts the recommendation directly as a Type B technical assumption, see tech design Assumption 1.
Not yet re-confirmed interactively against this exact document by the human; the coordinating
session will relay this write-up back to them.)

## AI-SDLC flags
- `backend_layer`: false — this app is frontend-only (Expo/React Native, local storage, no server
  component owned by this repo), matching the parent feature's own convention
  (`docs/specs/explore-composition.md`).
- `frontend_layer`: true
- `infra_changes`: false

## 1. Problem Statement
Users of Explore Composition's ingredient-list capture screen (`ExploreCompositionCaptureScreen.tsx`)
sometimes take a second photo of the same physical label because the first shot looked unclear —
not because the printed list is genuinely too long for one frame. When the flow's multi-shot merge
treats this near-duplicate second shot as new content, the recognized ingredient count balloons. A
real user report: a serum with a true list of roughly 47 comma-separated INCI ingredients was
reported by the app as "2 photos combined — 124 ingredients recognized," after two near-full
duplicate shots of almost the entire same list, framed slightly differently (confirmed by
inspecting both real source photos — shot 2 starts about two lines earlier than shot 1 within the
same physical label, and is not a continuation of where shot 1 left off). 124 is roughly 2.5x the
true count; the result also mixes in some garbled/extra words. The existing merge logic
(`mergeIngredientCaptures.ts`) can only detect and deduplicate a classic panorama-style seam, where
shot 2 is a genuine continuation starting exactly where shot 1's frame physically ended — it has no
way to recognize that two shots are mostly-duplicate re-shoots of the same content, so it falls
back to a near-full concatenation of two near-identical lists, roughly doubling the count.

## 2. Goals
- A second capture shot that mostly duplicates the first shot's content (a near-full re-shoot, not
  a true continuation) no longer roughly doubles the recognized ingredient count.
- The existing, correct behavior for a genuine continuation shot (classic positional seam overlap)
  is unchanged.
- The existing, correct behavior for two genuinely disjoint shots (a list that legitimately didn't
  fit in one frame) is unchanged — both shots' content is still fully retained.
- No new user-facing interruption, prompt, or capture-time heuristic is introduced to reach this
  outcome.

## 3. Non-Goals (explicitly out of scope)
- Bug B — `finalizeCapturedText()`'s deliberate skip of `extractIngredientSection()` trimming for
  any 2+-shot capture — is NOT fixed in this task. This is a pre-existing, intentional, already
  -documented gap (`docs/investigations/ocr-incomplete-ingredient-capture.md` §6d): two different
  approaches to safely trim multi-shot text were already tried and reverted, both risking silent
  real-ingredient-data loss. Once Task 1 ships, this report's own case is expected to drop from
  ~124 to roughly the true single-list count, since deduplication removes nearly all of the second
  shot's contribution — so Bug B's residual inflation (a few footer/prose tokens riding along) is
  no longer the dominant, user-visible problem this report is about. This task's Definition of Done
  is "the reported doubling stops," not "achieve a perfectly exact ingredient count."
- No new capture-time UI heuristic, warning, or prompt is introduced (e.g. "this looks like a
  duplicate photo — replace instead of add?"). An equivalent geometry-based "is this shot
  incomplete/duplicate" heuristic was already shipped and fully reverted the same day in this exact
  codebase after it fired on nearly every real capture
  (`docs/investigations/ocr-incomplete-ingredient-capture.md` §6a) — this fix is purely algorithmic
  and adds no new interruption.
- The internal-comma INCI-name fragmentation defect (optional Story 2 / tech design FE-2) is not a
  required deliverable of this task — it may be deferred to its own follow-up task without blocking
  Story 1's Definition of Done.
- No changes to the OCR pipeline, camera capture code, or `extractIngredientSection`'s single-shot
  behavior — this task is scoped entirely to the token-level merge logic in
  `mergeIngredientCaptures.ts` (plus, optionally, `tokenizeIngredientsText`).
- No changes to the positional seam-overlap detection logic itself — it stays exactly as-is for
  genuine continuation shots; only a second pass is added after it.

## 4. User Stories

### Story 1: Merging near-duplicate multi-shot captures does not double-count ingredients
As a user who reshoots an ingredient-list photo because the first shot looked unclear, I want the
app to recognize that the second shot mostly repeats what the first one already captured, so the
recognized ingredient count reflects the real list, not roughly double it.

**Acceptance Criteria:**
- [ ] Given two capture shots of the same product where the second shot's recognized text is a
      near-total duplicate of the first shot's content — starting earlier in the physical label
      than where the first shot's text ends, not a genuine continuation — when the two are merged,
      then every token in the second shot's contribution that fuzzy-matches a token already
      present in the merged list is dropped, not concatenated a second time.
- [ ] Given two capture shots where the second shot is a genuine continuation of the first (the
      classic positional seam: the tail of shot 1's tokens matches the head of shot 2's tokens,
      exactly or fuzzily), when the two are merged, then the result is identical to before this fix
      — no regression to the existing, correct continuation-shot behavior.
- [ ] Given two capture shots with genuinely disjoint ingredient content (no shared tokens at all),
      when the two are merged, then all tokens from both shots are present in the result.
- [ ] Given this bug report's real-world shape (two near-full-duplicate shots of a roughly
      47-ingredient list), when the fix above is applied, then the merged/recognized ingredient
      count drops from roughly double the true count to roughly the true single-list count — this
      task's Definition of Done is "the reported doubling stops," not an exact match to any
      specific number.

### Story 2 (optional / stretch — may be deferred to a follow-up task): INCI names with an internal comma are not fragmented into fake tokens
As a user viewing a recognized ingredient count, I want an ingredient name that legitimately
contains a comma (e.g. "1,2-Hexanediol") to count as one ingredient, not two, so the count isn't
inflated by a name the tokenizer doesn't understand.

**Acceptance Criteria (optional — not blocking Story 1):**
- [ ] Given raw ingredient text containing an INCI name with an internal comma (e.g. OCR output
      "L,2-HEXANEDIOL" or "1,2-Hexanediol"), when it is tokenized, then it is not split into two
      separate fake tokens ("L" / "2-HEXANEDIOL" or "1" / "2-Hexanediol").
- [ ] Given this fix is deferred instead of implemented in this task, then it remains tracked as a
      known, documented secondary defect (see §10) rather than silently forgotten.

## 5. UX / Behaviour
No new screens, components, or user-facing copy — this is a logic-only fix inside the existing
multi-shot merge path.
- **Before:** two near-duplicate shots of the same ~47-ingredient label produce "2 photos combined
  — 124 ingredients recognized" on the capture screen's status line
  (`ExploreCompositionCaptureScreen.tsx`), and the same inflated count/list carries through to
  `ExploreCompositionResultScreen.tsx`.
- **After:** the same two shots produce a count close to the true single-list length instead (the
  exact figure depends on Bug B's separately-tracked, out-of-scope residual noise — see §3). The
  existing "N photos combined" phrasing and per-shot thumbnail UI are unchanged.
- The genuine-continuation case (a label that truly didn't fit in one frame) is visually unchanged
  — same status line, same thumbnails, same eventual Result screen.
- No new error, empty, or loading state — this fix cannot make the merge fail; at worst it returns
  the same output as before for the cases it doesn't target (continuation, fully disjoint shots).

## 6. Data Requirements
- New data needed: none.
- Existing data consumed: the raw OCR (or paste) text strings from each capture shot, already
  flowing through `mergeIngredientCaptures.ts`, and that module's own existing `tokensMatch` /
  `tokenizeIngredientsText` helpers.
- Data retention: unchanged — no new persisted fields, no change to `WishlistEntry`, `Product`, or
  any store shape.

## 7. Dependencies
- Depends on spec: `docs/specs/explore-composition.md` (the shipped parent feature this bug lives
  in) — this task fixes a bug in already-shipped code; it does not add new scope to that spec.
- Depends on: `docs/investigations/ocr-incomplete-ingredient-capture.md` §4, §6c–§6e (the merge/
  trim history and root-cause evidence this task is built on) — ground truth, not re-investigated
  here.
- Blocks: nothing.
- External services: none — no new dependency, no API/network call, consistent with the parent
  feature's own local-only posture.

## 8. Security & Privacy
- Authentication required: no (Phase 1 has no auth layer).
- Data sensitivity: none beyond what the parent feature already handles (ingredient text) — no
  PII, no new data sensitivity introduced.
- Compliance considerations: none beyond the existing local-only storage posture (CLAUDE.md).

## 9. Success Metrics
Phase 1 has no analytics pipeline (same as the parent feature); success is verified at acceptance
time:
- All Story 1 acceptance criteria pass.
- `npx tsc --noEmit` and `npm test` are clean, including the existing 7
  `mergeIngredientCaptures.test.ts` cases (unmodified, still passing — proof this fix is backward
  compatible) plus the new case(s) added for Story 1.
- Reasoned against this bug report's real shape: the merged count for two near-full-duplicate
  ~47-ingredient shots lands close to 47, not ~124 — an order-of-magnitude check, not a claim of an
  exact number (Bug B's residual noise is explicitly out of scope, see §3).

## 10. Open Questions
- [x] Fix approach for Bug A — RESOLVED, adopted directly from the coordinating session's
      already-evidenced investigation (tech design Assumption 1) — a Type B technical gap, not a
      business gap requiring further sign-off.
- [ ] Bug B (multi-shot trimming residual noise) — intentionally NOT fixed here; needs more real
      multi-shot samples to design against
      (`docs/investigations/ocr-incomplete-ingredient-capture.md` §6d) → owner: future planner
      task, not blocking this fix.
- [ ] Task 2 / FE-2 (internal-comma INCI fragmentation) bundling decision — left to engineer's
      judgment on whether it's cheap enough to include in this same PR → owner: engineer (this
      task), non-blocking either way.
