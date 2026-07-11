Status: IN_PROGRESS
Tech Design: docs/tech-design/routine-similar-product-priority.md
Code: —

## Task card
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [x] QA tests (qa-lead)
- [ ] Implementation (engineer)
- [ ] Architecture review (tech-lead)

## Log
- [2026-07-11] planner: wrote the technical design for same-slot duplicate
  handling across the three flows in
  `docs/specs/2026-07-11-routine-similar-product-priority.md` (all 4 open
  questions already resolved by the product owner/planner default in the
  approved spec — none carried forward). Read the actual engine code
  (`resolve.ts`, `slotting.ts`, `substitute.ts`, `generate.ts`, `validate.ts`,
  `dailyView.ts`, `planApply.ts`, `routinesStore.ts`, `AddToRoutineSheet.tsx`,
  `ConflictWarningInline.tsx`) rather than trusting the initial context brief
  at face value — confirmed `tryAdmit`'s admission loop in `resolve.ts`
  currently has no same-slot cap at all (two SPFs or two moisturizers can
  both be admitted today unless they happen to also trip an ingredient pair
  rule), so Story 2 requires a real engine change, not just a rendering
  change. Also found `findSubstitute()` is implemented and tested
  (`entryPoints.test.ts`) but not yet wired into any screen — there is no
  existing "swap" UI to match, only an engine primitive to parallel.

  Key design decisions (full detail + decision/alternative/reason in the tech
  design's Assumptions):
  - New `src/utils/routineEngine/duplicateSlot.ts` holds all pure
    slot-duplicate detection/ranking (Story 1 pre-check, Story 3 grouping +
    `scoreCandidate`-based ranking); `other` slot (index 7) exempted
    everywhere per spec §5.
  - `resolve.ts`'s `tryAdmit` gains a `slot_loser` outcome: first candidate
    admitted per slot/period wins, later same-slot candidates are recorded
    as ranked alternatives (`ResolveResult`/`RoutinePlan.slotAlternatives`)
    rather than frozen or dropped — kept strictly separate from the existing
    ingredient pair-rule/cap freeze path (Non-Goals: this feature does not
    modify `findPairViolations`/`findCapViolations`).
  - Story 2's Draft Preview swap is a pure `planApply.ts` splice
    (`applySlotAlternativeSwap`) over already-uncommitted draft state; no
    change to the existing `applyRoutinePlan`/`buildStepsFromPlan` commit
    path.
  - Story 1 (manual add) needs one new store read (`findSameSlotConflict`)
    and one new store write (`replaceProductStep`, in-place splice to
    preserve layering position) on `routinesStore.ts`; "Keep both" and exact
    re-add need zero changes to today's `upsertProductStep`.
  - Story 3 (existing duplicates) reuses the existing `removeProductStep`
    for its resolution-sheet removal action — no swap-in capability added
    there, to keep it scoped to the spec's stated AC.
  - New components: `DuplicateSlotChoiceSheet` (Story 1), sibling
    `DuplicateSlotWarningInline` + `DuplicateSlotResolutionSheet` (Story 3),
    `SlotAlternativeRow` in `DraftPreviewSheet` (Story 2). No new screens, no
    `AppNavigator.tsx` changes — confirmed not needed.
  - No `ConflictSeverity` extension; the duplicate warning is a flat,
    single-tier advisory signal, separate from `ValidationFinding`.
  - Documented one deliberate scope-filling assumption not spelled out in
    the spec: when a manual add is checked for both Morning and Evening and
    both hit a same-slot conflict, the choice sheet resolves them one period
    at a time (AM first) rather than merging into one sheet.

  Tech design is 63 lines (well under the 150-line ceiling), all 5 template
  sections present, API Contracts marked N/A (fully local/offline, no
  backend, no new storage keys), zero open questions carried into
  implementation. Ready for qa-lead.

- [2026-07-11] qa-lead: wrote the component/integration test suite in
  `tests/routine-similar-product-priority/` per `.claude/rules/testing.md`
  (component/integration layer only — pure-util unit tests for
  `duplicateSlot.ts`/`resolve.ts`/`planApply.ts` are explicitly the
  engineer's, not written here). All 8 files read before writing tests:
  `slotting.ts`, `planTypes.ts`, `resolve.ts`, `generate.ts`, `planApply.ts`,
  `substitute.ts`, `routinesStore.ts`, `AddToRoutineSheet.tsx`,
  `ConflictWarningInline.tsx`, `DraftPreviewSheet.tsx`, `RemoveStepModal.tsx`,
  `RemoveRoutineActionSheet.tsx`, `RoutinesScreen.tsx`, `InlineAlert.tsx` —
  plus the `tests/clinic-forecast-timeline/fixtures.ts` precedent for the
  binding-contract pattern.

  Noted one discrepancy vs. the tech design: `ConflictWarningInline` is not
  actually rendered anywhere in current `RoutinesScreen.tsx` (it reads
  `ConflictEngine.detectConflicts` inline instead, per-step) — the design's
  "beside the existing ConflictWarningInline render call" phrasing is stale.
  The RoutinesScreen wiring test does not assert adjacency to it; it only
  asserts `DuplicateSlotWarningInline` renders and that tapping a group opens
  `DuplicateSlotResolutionSheet` with the right `routineId` + ranked list, so
  engineer has room to wire it wherever fits without failing this suite.

  Files written (all new, 7 test files + 1 shared fixtures/contract file):
  - `tests/routine-similar-product-priority/fixtures.ts` — product/step/routine
    factories + prop factories for the 4 new components, and a binding
    testID/accessibility/prop-shape contract in the header docblock (same
    pattern as `tests/clinic-forecast-timeline/fixtures.ts`), since the tech
    design intentionally leaves exact component shapes unspecified.
  - `duplicate-slot-choice-sheet.test.tsx` — Story 1 ACs 1-4, 5 tests
    (title/naming, Replace, Keep both, Cancel, visible=false).
  - `add-to-routine-sheet-duplicate-flow.test.tsx` — Story 1 ACs 1-5 + the
    tech design's AM-then-PM sequencing assumption, 7 tests, wiring
    `AddToRoutineSheet.handleSave()` to a mocked `routinesStore` (
    `findSameSlotConflict`/`replaceProductStep`/`upsertProductStep`).
  - `duplicate-slot-warning-inline.test.tsx` — Story 3 ACs 1 & 4, 6 tests
    (renders warning text, null on no-duplicates/empty, no cross-routine
    merge, `other` slot exemption, tap reports the group).
  - `duplicate-slot-resolution-sheet.test.tsx` — Story 3 ACs 2 & 3, 8 tests
    (ranked list + single Recommended tag, Alert-confirmed removal calling
    `removeProductStep`, cancelled Alert removes nothing, Keep all dismisses
    without removing, visible=false).
  - `routines-screen-duplicate-wiring.test.tsx` — Story 3 screen wiring, 3
    tests (banner renders, sheet closed until tapped, tap calls
    `rankSlotGroup` and forwards routineId + ranked names into the sheet).
  - `slot-alternative-row.test.tsx` — Story 2 AC2 component layer, 3 tests
    (alternative name shown, winner never shown as its own alternative, swap
    action fires `onSwap`).
  - `draft-preview-sheet-alternatives.test.tsx` — Story 2 AC2 sheet wiring, 5
    tests (alternative row rendered under the winner, no mutation of
    `plan.periods`, empty `slotAlternatives` renders nothing, swap bubbles
    `onSwapAlternative(winnerId, chosenId)` without touching `onCommit`,
    multiple alternatives each get their own row).

  Total: 36 component/integration tests across all 3 stories' ACs from spec
  §4. Story 2's engine-level ACs (winner selection determinism, loser never
  deleted from shelf/other routines, next-ranked candidate considered after a
  pair/cap rejection) are intentionally NOT covered here — those are pure
  `resolve.ts`/`duplicateSlot.ts` logic, engineer's unit-test territory per
  `.claude/rules/testing.md`.

  Verification: `npx tsc --noEmit` shows only the expected drift errors
  (missing `DuplicateSlotChoiceSheet`/`DuplicateSlotWarningInline`/
  `DuplicateSlotResolutionSheet`/`SlotAlternativeRow` modules, missing
  `SlotAlternative` export from `planTypes.ts`, missing `RoutinePlan.
  slotAlternatives` field, missing `DraftPreviewSheetProps.onSwapAlternative`)
  — all trace directly to FE-2/FE-3/FE-6/FE-7/FE-8/FE-9/FE-10, nothing else.
  `npx jest tests/routine-similar-product-priority` -> all 7 suites fail
  (expected, tests-first). Full-repo `npx jest --testPathIgnorePatterns=
  worktrees` -> 10 failed / 65 passed suites; confirmed via `git stash` that
  the 3 non-suite failures outside this new folder (`PaoChip.integration`,
  `catalog-screen`, `product-detail`) are pre-existing baseline failures,
  unrelated to this task — no regression introduced.

  Status -> IN_PROGRESS, handoff -> engineer.
