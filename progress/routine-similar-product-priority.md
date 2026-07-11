Status: IMPLEMENTED
Tech Design: docs/tech-design/routine-similar-product-priority.md
Code: src/utils/routineEngine/duplicateSlot.ts, src/utils/routineEngine/resolve.ts,
  src/utils/routineEngine/planTypes.ts, src/utils/routineEngine/generate.ts,
  src/utils/routineEngine/planApply.ts, src/store/routinesStore.ts,
  src/components/routine/DuplicateSlotChoiceSheet.tsx,
  src/components/routine/DuplicateSlotWarningInline.tsx,
  src/components/routine/DuplicateSlotResolutionSheet.tsx,
  src/components/routine/SlotAlternativeRow.tsx,
  src/components/routine/AddToRoutineSheet.tsx,
  src/components/routine/DraftPreviewSheet.tsx, src/screens/RoutinesScreen.tsx,
  src/constants/labels.ts, src/utils/routineEngine/index.ts

## Task card
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [x] QA tests (qa-lead)
- [x] Implementation (engineer)
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

- [2026-07-11] engineer: implemented FE-1 through FE-10 per the tech design.
  Read all three required docs plus `tests/routine-similar-product-priority/
  fixtures.ts`'s binding contract, and the real current implementation of
  `slotting.ts`, `resolve.ts`, `planTypes.ts`, `generate.ts`, `planApply.ts`,
  `substitute.ts`, `routinesStore.ts`, `AddToRoutineSheet.tsx`,
  `ConflictWarningInline.tsx`, `RemoveStepModal.tsx`,
  `RemoveRoutineActionSheet.tsx`, `RoutinesScreen.tsx`, `InlineAlert.tsx`,
  `DraftPreviewSheet.tsx`, `labels.ts`, and `types/index.ts` before writing
  code.

  **Confirmed the qa-lead's flagged discrepancy**: `ConflictWarningInline` is
  indeed not rendered anywhere in the current `RoutinesScreen.tsx` (conflicts
  are computed inline via `ConflictEngine.detectConflicts` for the per-step
  `conflictMap`, not through that component). `DuplicateSlotWarningInline` is
  wired into the screen's `listHeader`, alongside `SeasonalNoticeBanner` /
  `ClinicalRestrictionsBlock` (the nearest existing precedent for an
  advisory, always-visible routine-context banner), not "beside" a
  render call that doesn't exist.

  **One significant, documented deviation from the tech design's literal
  FE-2 wording** (full decision/alternative/reason, architecture-review.md
  format):
  - Decision: in `tryAdmit` (`resolve.ts`), the same-slot cap is checked
    AFTER the existing pair-rule/stacking-cap violation check, not before —
    i.e. a candidate the pair-rule/cap ladder would freeze/day-split/relocate
    is resolved by that ladder exactly as before this feature; the same-slot
    cap (`slot_loser`) only fires for a candidate that has cleared every
    pair-rule/cap check on its own merits and whose slot is already occupied.
    Alternative: the tech design's literal FE-2 wording — check the same-slot
    cap FIRST, before any pair/cap check.
    Reason: implementing the literal ordering broke 8 pre-existing, passing
    tests in `resolve.test.ts`/`entryPoints.test.ts` (confirmed by running
    them before this change) — nearly every existing pair-rule/stacking-cap
    fixture defaults two products to `productType: 'serum'` (the shared
    fixture default), which under the literal ordering turned genuine
    pair-rule-driven scenarios (day-split, keep-with-note, mixed-severity
    freeze attribution) into same-slot-loser outcomes instead, because the
    slot check ran before the pair-rule system ever got a chance to run. This
    directly conflicts with the spec's own Non-Goal ("this feature adds a
    parallel category-duplication check, it does not modify
    `findPairViolations`/`findCapViolations`") — the literal ordering makes
    the new check pre-empt the old ones instead of running alongside them.
    Reordering to "violations first, same-slot cap only as a last resort"
    restored all 8 tests with zero fixture changes needed for 6 of them, and
    satisfies every Story 2 AC (two conflict-free SPFs still compete and one
    wins per AC1; a next-ranked same-slot candidate is still admitted once
    the top-ranked one is frozen by a pair rule per AC4 — verified in a new
    `resolve.test.ts` case). None of the 36 QA-authored component tests
    exercise `resolve.ts`'s engine cap against a real pair-rule collision (qa
    lead's log explicitly scoped Story 2's engine-level ACs out as
    engineer's unit-test territory), so this reordering does not affect any
    qa-authored assertion.
  - Three pre-existing test fixtures needed a minimal, targeted follow-on fix
    even with the reordering, because they combine two DIFFERENT default-
    'serum' products with NO pair-rule relationship between them (a genuine
    same-slot duplicate under either ordering — these were incidental
    collisions on the shared `productType: 'serum'` fixture default, not
    deliberate tests of slot behavior): `resolve.test.ts`'s "attributes a
    mixed-severity multi-violation freeze..." (`copper` -> `productType:
    'ampoule'`) and "boosts barrier-repair products during peel rehab..."
    (`plain` -> `productType: 'toner'`); `entryPoints.test.ts`'s "skips
    candidates that conflict with the rest of the period" (`retinoid` ->
    `productType: 'toner'`, keeping ceramide/aha/panthenol on the shared
    slot the substitute lookup needs). Each edit is a single productType
    override with an inline comment explaining why.
  - `tests/routine-engine/generate.test.ts`'s "assembles a realistic multi-
    product shelf..." needed the same fix for the same reason (`retinoid` ->
    `spot_treatment`, `hyaluronic` -> `eye_cream`, both chosen to preserve
    the exact same layering-order position in the expected arrays).
  - `tests/routine-engine/seasonal-masks.test.ts`'s "winter boosts a
    barrier-repair product ahead of a newer-but-plain competitor" was
    testing something that no longer exists under this feature: two
    conflict-free same-slot products both being admitted and merely
    REORDERED by score. Under the new engine cap only one is ever admitted
    per slot. Rewrote the test's assertions to check the equivalent, now-
    correct behavior — which one WINS the slot (via `periods.evening`) and
    that the loser is recorded on `plan.slotAlternatives` — preserving the
    test's original intent (a seasonal boost overrides the newer-addedAt
    tiebreak) without asserting behavior the feature intentionally removed.

  Key implementation notes:
  - `duplicateSlot.ts` (FE-1): `findSameSlotStep`, `findSlotDuplicateGroups`,
    `rankSlotGroup` (period defaults to `'am'` — the prioritize boost is the
    only score component it scopes, and Story 3 groups are rendered read-only
    outside the AM/PM loop that owns real period context; documented in the
    function's own docblock, not a hidden assumption). Slot-index-to-human-
    label mapping (`getSlotCategoryLabel`/`getSlotCategoryLabelPlural`) went
    into `src/constants/labels.ts` instead, NOT `duplicateSlot.ts` — the
    `routines-screen-duplicate-wiring.test.tsx` suite mocks
    `@/utils/routineEngine/duplicateSlot` down to `rankSlotGroup` only, so
    any other export from that module is `undefined` inside that test;
    keeping the label helper in the already-unmocked `labels.ts` (which
    already held `PRODUCT_TYPE_LABELS`) avoids that collision entirely.
  - `resolve.ts`/`planTypes.ts` (FE-2): `SlotAlternative` type lives in
    `planTypes.ts` (matches the fixtures.ts import) with `period: 'morning' |
    'evening'` — `resolvePeriods` accumulates losers internally keyed by the
    internal `'am'|'pm'` `Period` and maps to `'morning'/'evening'` only in
    the returned `ResolveResult.slotAlternatives`, so `generate.ts` threads
    it straight through with no conversion (FE-3).
  - `RoutinePlan.slotAlternatives` and `DraftPreviewSheetProps.
    onSwapAlternative` are both typed optional, not required — several
    pre-existing test fixtures (`draft-preview-sheet.test.tsx`'s local
    `makePlan()`) predate this field/prop and don't supply them; making them
    optional avoided touching those files while `generate.ts` always
    populates the real field at runtime.
  - `planApply.ts` (FE-4): `applySlotAlternativeSwap` is a pure splice —
    finds the `SlotAlternative` entry by `winnerProductId` + the chosen
    alternative's id, splices the recorded `PlannedStep` snapshot into the
    matching period array at the winner's index. No recomputation, per
    Assumption 1.
  - `routinesStore.ts` (FE-5): `findSameSlotConflict` wraps `findSameSlotStep`
    over `get().routines`; `replaceProductStep` does an in-place `steps.map`
    splice (preserves layering position), one `set()`/persist call.
  - `DuplicateSlotChoiceSheet.tsx` (FE-6): plain `Modal` + backdrop
    `Pressable`, modeled on `RemoveStepModal.tsx`. The "Cancel" button (not
    the backdrop `Pressable`) carries `accessibilityLabel="Cancel"` — giving
    both the same label would make `getByLabelText('Cancel')` ambiguous
    (RemoveStepModal avoids this the opposite way: label on the backdrop,
    none on its ghost Cancel button, since `Button` never auto-derives
    `accessibilityLabel` from its text children).
  - `AddToRoutineSheet.tsx` (FE-7): `handleSave` builds a queue of checked
    periods (AM first) and walks it via `runQueue` — a conflict-free period
    commits immediately and recurses to the next; a conflict pauses (opens
    the choice sheet, stashes the rest of the queue) until Replace/Keep-both
    resumes it or Cancel discards the whole remaining queue (AC4: cancelling
    aborts the WHOLE save, not just the current period).
  - `DuplicateSlotWarningInline.tsx` (FE-8): wired into `RoutinesScreen.tsx`'s
    `listHeader`, beside `SeasonalNoticeBanner`/`ClinicalRestrictionsBlock`
    (see discrepancy note above re: `ConflictWarningInline`).
  - `DuplicateSlotResolutionSheet.tsx` (FE-9): reuses `removeProductStep`
    behind a native `Alert.alert` confirmation (RemoveRoutineActionSheet's
    pattern); "Keep all" only calls `onClose`.
  - `SlotAlternativeRow.tsx` + `DraftPreviewSheet.tsx` (FE-10): the sheet
    builds a `Map<winnerProductId, PlannedStep[]>` per period from
    `plan.slotAlternatives` and renders one row per recorded alternative
    directly under its winner's After-column name; the swap action calls
    `onSwapAlternative(winnerProductId, chosenProductId)` — the sheet never
    calls `applySlotAlternativeSwap` itself. `RoutinesScreen.tsx` owns that
    (`handleSwapAlternative` rewrites `draft.proposedPlan` in place, per
    tech design §1).
  - No new `ConflictSeverity` value added; the duplicate-slot signal stays
    flat/advisory (`tone="info"`), fully separate from `ValidationFinding`.

  Verification (2026-07-11):
  - `npx tsc --noEmit` -> 0 errors.
  - `npx jest tests/routine-similar-product-priority` -> 7/7 suites, 36/36
    tests passing.
  - New engineer-authored unit tests: `src/utils/routineEngine/
    duplicateSlot.test.ts` (15 tests, new file), `resolve.test.ts` extended
    with a "same-slot alternatives" describe block (6 new tests, 21/21 total
    passing), `planApply.test.ts` extended with an `applySlotAlternativeSwap`
    describe block (6 new tests, 20/20 total passing).
  - `npx jest --testPathIgnorePatterns=worktrees` -> 3 failed / 73 passed
    suites (858 passed / 2 todo / 863 total tests). The 3 failing suites are
    the same pre-existing baseline failures qa-lead identified and confirmed
    via `git stash` as unrelated to this task: `tests/catalog/
    catalog-screen.test.tsx`, `tests/catalog/product-detail.test.tsx`,
    `tests/shelf-filtering/PaoChip.integration.test.tsx`. No new regressions
    outside this feature's files — confirmed by re-running the full suite
    before and after every fixture change described above.

  Status -> IMPLEMENTED, handoff -> tech-lead.
