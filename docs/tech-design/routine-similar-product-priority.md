# Technical Design: Routine Similar-Product Priority
Spec: docs/specs/2026-07-11-routine-similar-product-priority.md
Author: planner-agent
Date: 2026-07-11

## 1. Architecture Overview
Three local, offline flows share one existing similarity primitive — `getSlotIndex()` / `LAYERING_ORDER` in `src/utils/routineEngine/slotting.ts` — and touch no network code and no new storage keys.

1. **Manual add (Story 1):** `AddToRoutineSheet` asks a new read-only `routinesStore` check before committing; on a same-slot hit, `DuplicateSlotChoiceSheet` decides Replace / Keep both / Cancel.
2. **Engine generation (Story 2):** `resolve.ts`'s admission loop (`tryAdmit`) gains a same-slot cap — the first candidate admitted per slot/period wins, later same-slot candidates become ranked, non-dropped alternatives on `RoutinePlan.slotAlternatives`. `DraftPreviewSheet` renders a one-tap swap that rewrites the still-uncommitted draft via a pure `planApply.ts` helper; the existing `applyRoutinePlan`/`buildStepsFromPlan` commit path is unchanged.
3. **Existing duplicates (Story 3):** `RoutinesScreen` derives cheap duplicate groups straight from saved `routine.steps` (new `duplicateSlot.ts` util) for a passive banner; opening it ranks the group via the existing `scoreCandidate` (on demand) and removes losers through the existing `removeProductStep`.

```
AddToRoutineSheet --check--> routinesStore --conflict--> DuplicateSlotChoiceSheet --> upsertProductStep / replaceProductStep
resolve.ts(tryAdmit) --slotAlternatives--> RoutinePlan --> DraftPreviewSheet --swap--> planApply --> applyRoutinePlan (existing, unchanged)
RoutinesScreen --findSlotDuplicateGroups--> DuplicateSlotWarningInline --tap--> DuplicateSlotResolutionSheet --remove--> removeProductStep (existing)
```

## 2. API Contracts
N/A. Fully local/offline feature — per CLAUDE.md, no Supabase/Firebase in Phase 1, and this feature adds no network calls and no new AsyncStorage keys. All contracts are internal TypeScript function signatures, covered under §3.

## 3. Implementation Tasks

### engineer (scope=frontend)
- FE-1: New `src/utils/routineEngine/duplicateSlot.ts` — `findSameSlotStep(steps, productType, excludeProductId?)` (Story 1 pre-check, excludes the incoming product's own id so an exact re-add is unaffected); `findSlotDuplicateGroups(steps)` (Story 3 cheap grouping, hidden/`productId: null` steps skipped, same pattern as `dailyView.ts`/`validate.ts`); `rankSlotGroup(group, products, facts, context, concerns)` (Story 3 ranking, reuses `scoreCandidate` from `resolve.ts`). All three exempt the shared `other` slot (index 7) — it is a catch-all, not a category. Export from `routineEngine/index.ts`.
- FE-2: `src/utils/routineEngine/resolve.ts` + `planTypes.ts` — add a `SlotAlternative { winnerProductId, period, slotIndex, alternatives: PlannedStep[] }` type. In `tryAdmit`, before any pair/cap check, short-circuit to a new `slot_loser` outcome when `admitted[period]` already holds an entry with the candidate's `slotIndex` (excluding the `other` slot); record the loser (via the existing `makeStep()` shape) on `ResolveResult.slotAlternatives`, ranked best-first. Update both call sites (`runPeriodPass`, `retryRelocatedInAm`) to handle the new outcome kind.
- FE-3: `src/utils/routineEngine/generate.ts` — thread `resolved.slotAlternatives` onto a new `RoutinePlan.slotAlternatives` field.
- FE-4: `src/utils/routineEngine/planApply.ts` — pure `applySlotAlternativeSwap(plan, winnerProductId, chosenProductId): RoutinePlan`, splicing a draft step for one of its recorded alternatives (array replace only — no eligibility/score recomputation, since FE-2 already stored a full candidate step).
- FE-5: `src/store/routinesStore.ts` — `findSameSlotConflict(routineId, productType, excludeProductId?)` read helper (wraps FE-1's `findSameSlotStep` over `get().routines`); `replaceProductStep(routineId, oldProductId, newProduct: { id, productType }, scheduledDays)` write method, in-place array splice (preserves layering position) in one `set()`/persist call.
- FE-6: New `src/components/routine/DuplicateSlotChoiceSheet.tsx` — Story 1 modal (title "You already have a [category] in this routine", "Replace [existing]" / "Keep both" / "Cancel"), modeled on `RemoveStepModal.tsx`'s plain-`Modal` + backdrop `Pressable` pattern (no `@gorhom/bottom-sheet` needed for a 3-button confirm).
- FE-7: `src/components/routine/AddToRoutineSheet.tsx` — `handleSave()` calls FE-5's check for each selected period before committing; opens FE-6 on conflict; resolves AM/PM conflicts one period at a time when both are checked (see Assumptions). "Keep both" and "Cancel" require no new store calls; "Replace" calls FE-5's `replaceProductStep`.
- FE-8: New `src/components/routine/DuplicateSlotWarningInline.tsx` (sibling to the existing `ConflictWarningInline.tsx`, same props shape) — Story 3 passive banner: one `InlineAlert` (`tone="info"`, lower severity than the ingredient-conflict `tone="warning"`) per duplicate group, human-friendly slot label (e.g. "2 similar products (moisturizers) in this routine"); wired into `RoutinesScreen.tsx` beside the existing `ConflictWarningInline` render call.
- FE-9: New `src/components/routine/DuplicateSlotResolutionSheet.tsx` — Story 3 sheet opened by tapping FE-8's banner: ranked list from FE-1's `rankSlotGroup`, "Recommended" tag on index 0, remove-with-confirmation via the existing `removeProductStep` + `Alert.alert` (pattern already used in `RemoveRoutineActionSheet.tsx`), "Keep all" dismiss action.
- FE-10: New `src/components/routine/SlotAlternativeRow.tsx`, wired into `DraftPreviewSheet.tsx` — Story 2 "Also on your shelf: [name]" row per generated step that has `slotAlternatives`, swap action calling FE-4 and updating the screen's local draft state (`draft`/`setDraft` already present in `RoutinesScreen.tsx`).

### engineer (unit tests, both scopes)
- Each task above includes co-located unit tests: new `src/utils/routineEngine/duplicateSlot.test.ts`, and extensions to the existing `resolve.test.ts`, `planApply.test.ts`, and `entryPoints.test.ts`, per `.claude/rules/testing.md`. Component-level coverage for the new sheets/banner is qa-lead's next-phase responsibility, not part of this task list.

## 4. Assumptions
- Slot-loser candidates in `resolve.ts` are recorded as full `PlannedStep` snapshots (via the existing `makeStep()` helper), not bare product ids.
  Alternative: store only the loser's `productId` and recompute a step at swap time.
  Reason: keeps FE-4's swap a pure array splice with no re-run of eligibility/frequency-cap logic, and keeps `resolve.ts` the single source of admission math.
- Once a slot is occupied by an admitted step, later same-slot candidates are recorded purely as alternatives and never walk the ingredient pair-rule/cap resolution ladder.
  Alternative: still classify a same-slot loser as "frozen" if it would independently violate a pair or stacking-cap rule.
  Reason: avoids double-classifying one candidate under two mechanisms and keeps this feature strictly additive to `findPairViolations`/`findCapViolations`, per the spec's Non-Goals.
- `getSlotIndex()`/`LAYERING_ORDER` is the only logic shared between the render-time `duplicateSlot.ts` util (operates on saved `RoutineStep`s) and the generation-time cap inside `resolve.ts` (operates on internal `Candidate`/`AdmittedEntry`); the two are not unified into one function.
  Alternative: force one shared "slot competition" function reused verbatim by both call sites.
  Reason: input shapes genuinely differ (persisted steps vs. in-flight engine candidates); unifying would need an adapter layer with no behavioral benefit.
- Story 3's "remove a competing step" action reuses the existing `removeProductStep` store method; no new swap-in capability is added to the resolution sheet.
  Alternative: let the resolution sheet also swap in a new shelf product, like Story 2's Draft Preview flow.
  Reason: the spec's Story 3 AC only requires removal ("keep all" or remove any); adding swap here would duplicate Story 2's mechanism outside its stated scope.
- Story 1's "Replace" needs a new `replaceProductStep` store method (in-place splice) rather than composing the existing `removeProductStep` + `upsertProductStep`.
  Alternative: call the two existing single-purpose methods back-to-back from the component.
  Reason: one store method keeps the change a single `set()`/persist write and preserves the replaced step's layering position instead of appending the new one at the end of the array.
- When a manual add is checked for both Morning and Evening and both periods hit a same-slot conflict, `DuplicateSlotChoiceSheet` resolves them one period at a time (AM first).
  Alternative: merge both conflicts into one combined sheet/decision.
  Reason: keeps the sheet copy ("You already have a [category] in this routine") singular and unambiguous; the spec's AC is written for one period at a time and this case is not otherwise addressed.
- No new value is added to the existing `ConflictSeverity` type; the duplicate-slot warning carries no severity gradation (flat, advisory) and is a signal wholly separate from `ValidationFinding`.
  Alternative: extend `ConflictSeverity` with a third tier for advisory-level findings.
  Reason: matches the spec's §10 Q2 resolution directly, and keeps the ingredient-conflict severity model (`avoid`/`caution`) untouched, per the spec's Non-Goals.

## 5. Open Questions
No open questions — all four were resolved in the spec (§10), and every technical gap encountered while designing this document is closed via the Assumptions above.
