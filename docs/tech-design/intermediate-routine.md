# Technical Design: Intermediate routine (toner, eye cream, enzyme exfoliant, "Not in your routine")
Spec: docs/specs/intermediate-routine.md
Author: tech-designer
Date: 2026-10-14 (revised 2026-10-15: one routine; owner answers applied; FE-13/FE-14 added for qa-lead findings)

> Revision 2026-10-16 (as built; supersedes FE-5/FE-6 and the enzyme-cleanser assumption below where they differ): `normalizeProductType` reads a NON-strong enzyme
> carrier of ANY format as a `peeling` (SPF, makeup remover and strong carriers keep their role), so it has its own slot for every consumer and never displaces a plain product;
> the skeleton extracts only peelings; the enzyme cap (3 days) applies to non-strong carriers only; `RoutineSchedulerSheet` persists the normalised type; INCI position counts top-level tokens.

## 1. Architecture Overview

One engine behaviour, no style input. `selectSkeleton` decides who enters each period's pool; this task widens only that: toner and eye cream join
`SKELETON_SLOTS` (candidates AND required slots that raise gap placeholders) and enzyme carriers get one weekly exfoliate slot. `resolvePeriods`
gains one rule (FE-13: one terminal outcome per product per period); mandates, Phase 9 buckets and determinism are untouched. The Routines screen
renders `validateCurrentRoutines().proposedPlan.placeholders` as `GapCard`s; that plan is built from OWNED shelf + profile only, never from saved
steps or UI state, so removing a step can neither raise nor clear a gap. "Not for me" on a toner/eye-cream card is a presentation-only filter over
it, kept in settings and cleared by the next save of its period. Saved steps are written only by Draft Preview save, Reset all, and manual edits.

```
owned products ─► buildEngineInputFromStores ─► generatePlan(EngineInput — shape unchanged)
  normalizeProductType (+enzyme⇒peeling) ─► selectSkeleton: SKELETON_SLOTS · REQUIRED_SLOTS (+toner, eye_cream) · selectExfoliants
  ─► resolvePeriods (one terminal outcome per product per period) ─► RoutinePlan {periods, frozen, reserve, placeholders, slotAlternatives}
RoutinesScreen: visibleGaps(placeholders, dismissedGapCards) ─► GapCard(onDismiss) · buildLeftOutItems ─► LeftOutSection
Edit mode ─► RoutineStepActionSheet(allowRemoval) · RoutineCalendarView(editMode) ─► routinesStore (no tombstones)
applyRoutinePlan / resetAllRoutines ─► clearDismissedGapCards(periods saved); DraftPreview ─► buildDraftSummaryLines(plan, diff, products, routines)
```

## 2. API Contracts

N/A — fully local, no network surface (CLAUDE.md local-only constraint).

## 3. Implementation Tasks

### engineer (scope=frontend/utils — no backend layer; each task includes its own unit tests)
Phases: A FE-1–3 · B FE-4–6 · C FE-7–10 · D FE-11–12 · E FE-13–14 (qa-lead findings, owner-approved into this task) · docs DOC-1–2.
- FE-1: `src/utils/routineEngine/slotting.ts` — add `toner: ['toner']`, `eye_cream: ['eye_cream']` to `SKELETON_SLOTS`; fix its "types outside this
  map do not enter" comment. Safe: other `structuralSlotFor` callers compare to `'cleanser'`/`'pre_cleanse'` only; `classifyEntries` adopts the slots
  with no edit to `selectSkeleton` (125 lines) or `generatePlan` (118). Tests: `slotting`, `skeleton`.
- FE-2: `skeleton.ts` `REQUIRED_SLOTS` gains toner and eye_cream in both periods; `decisionReasons.ts` gains `toner_recommended`,
  `eye_cream_recommended` (compile-enforced). `dedupePlaceholders` unchanged; any late promotion of a slot loser must pass `findViolationsAgainst` and
  be pruned from `slotAlternatives` (none added). Tests: `skeleton`, `rulesetIntegrity`.
- FE-3: new `src/utils/productOwnership.ts` `isOwnedProduct` (`status !== 'wishlist'`); `buildEngineInputFromStores` passes owned products only (its
  only callers are `generateDraftPlan` and `validateCurrentRoutines`, so live gap cards and the Draft Preview share one input); `currentOverrideHash`
  hashes owned ids too. Tests: `productOwnership`; a wishlist toner neither fills the slot nor is listed.
- FE-4: class `enzyme_exfoliant` in `src/constants/rulesets/actives.json`: matchers `papain|bromelain|subtilisin`; `photosensitizing:false,
  exfoliating:true, irritancy:1, barrierRepair:false`; `allowedPeriods:[am,pm]`; `preferredPeriod:'am'`; `attribution.requireWithinPosition:12`; bump
  `version`. Add the key to `ActiveIngredientKey` and entries in `labels.ts` ("Enzyme Exfoliant"), `activeBadges.ts` (exfoliant bucket),
  `addProduct/activesGroups.ts`; reasons `enzyme_exfoliant_cap`, `exfoliant_deferred_barrier_repair`. Tests: `rulesetIntegrity`, badges.
- FE-5: `categoryDetector.ts` — `reclassifyEnzymeExfoliant` (type `cleanser|other`, class via `getProductActiveKeys`, name not matching
  `isHairProductName`/`isLipProductName` ⇒ `peeling`; type checked first), composed in `normalizeProductType` after `reclassifyMakeupRemover` (a
  cleansing balm with enzymes stays a pre-cleanse); still the one normalisation entry. Tests: `categoryDetector`.
- FE-6: `skeleton.ts` helper `selectExfoliants`: non-strong enzyme carriers → at most one per period, in `preferredPeriodFor`; extras ⇒
  `duplicate_function`; barrier_repair as either goal ⇒ reserve `exfoliant_deferred_barrier_repair`. `treatmentCapFor` returns `ENZYME_EXFOLIANT_MAX_DAYS
  = 3` for an enzyme carrier BEFORE its `isStrongCarrier` return (draft constant beside `EXFOLIANT_TREATMENT_MAX_DAYS`), applied at selection AND in the
  override block, which re-enters an enzyme in its preferred period only (unguarded it runs AM and PM daily). `selectSkeleton` must not grow: extract
  the override block, add one `selectExfoliants` call. No placeholder for an exfoliant. Tests: `skeleton` (cap, override, barrier repair, freeze).
- FE-7: new `src/utils/routineLeftOut.ts` (pure): `buildLeftOutItems(plan, products, routines)` → `LeftOutItem { productId; kind:
  'ready'|'reserve'|'frozen'|'alternative'; reasonCode: DecisionReasonCode | null; until?: string }`. Considered iff `isOwnedProduct`, not `isHidden`,
  and no step with `hidden === false` in any routine (any weekday); precedence ready > reserve > frozen > alternative, shelf order within a kind; total
  (fallback `reserve`/`not_needed_for_goals`, asserted unreachable). Tests: `routineLeftOut` incl. "non-hidden saved steps ∪ listed ⊇ owned shelf" over
  shelves with removed, hidden and wishlist products.
- FE-8: new `LeftOutSection.tsx` (props `{ items, products, onAdd(productId), onReview() }`) and ONE copy module `src/constants/routineScreenCopy.ts`, all
  PLACEHOLDER (Q4b): `LEFT_OUT_COPY { leftOutHeader(n), readyToAdd, backup, addAction, reviewAction }`, `GAP_DISMISS_COPY { action }`, `CALENDAR_HINT_COPY
  { view, edit, rowHintView, rowHintEdit }` (renamed from the style-named module). Footer wiring in `RoutinesScreen.tsx` between `PausedSteps` and "Add
  product": collapsed "Not in your routine · N"; actions reuse `handleOverride`/`handleOpenDraftPreview`; items from the `validation` memo. Tests:
  `LeftOutSection`.
- FE-9: `RoutineStepActionSheet.tsx` gains `allowRemoval?: boolean` (default true; false omits "Remove from routine", "Hide from routine" and the
  divider on the last visible row); `RoutinesScreen.tsx` passes `allowRemoval={editMode}`. Outside edit mode the sheet keeps "View product details"
  and "Edit product" (product-only actions). Tests: sheet rows per flag.
- FE-10: `RoutineCalendarView.tsx` stays presentational: new optional `editMode?: boolean` (default false; no store access). With rows present it renders
  one caption (`CALENDAR_HINT_COPY.view|edit`, `typography.bodySmall`, `colors.textSecondary`) under the month label; in edit mode the identity column
  takes `colors.statusInfoTint` and a `colors.statusInfoLine` edge (plum tints read pink); none of it in the empty state. Keep each row's label
  `${name}, open actions` (a green test finds rows by it; its 2 red tests are unrelated empty-state copy) and add `accessibilityHint` per mode; no
  "Morning"/"Evening" text or sun/moon icon. `RoutinesScreen` passes `editMode`. Tests: caption/hint/empty per mode.
- FE-11: new `src/utils/gapDismissal.ts` (pure): `gapDismissKey(p: PlaceholderSlot): string | null` → `'am:toner'` etc. iff `reasonCode` is
  `toner_recommended`/`eye_cream_recommended` (never a mandate, follow-up or core-slot placeholder); `visibleGaps(placeholders, keys)`;
  `keysAfterSave(keys, periods)`. `AppSettings.dismissedGapCards: string[]` (default `[]`, add to `pickSettings`) with `dismissGapCard(key)` and
  `clearDismissedGapCards(periods)` in `settingsStore`; `applyRoutinePlan` clears the periods it wrote, `resetAllRoutines` clears both (cross-store
  work stays in `src/domain/`). Tests: `gapDismissal`, `settingsStore`, `routinePlanActions` scope clearing.
- FE-12: `GapCard` gains optional `onDismiss` → a second ghost button (`GAP_DISMISS_COPY.action`); `RoutinesScreen` applies `visibleGaps` to
  `placeholders` before both `attachPlaceholderGaps` memos and passes `onDismiss` only when `gapDismissKey(gap)` is non-null; works with edit mode on
  or off. Tests: `GapCard`, screen wiring.
- FE-13: `src/utils/routineEngine/resolve.ts` — a swap must never offer a scheduled product (spec Story 1 AC3). Cause, measured not guessed: a product
  relocated by a `separate_periods` rule is attempted twice in the target period (AM→PM adds a twin pool entry; PM→AM `retryRelocatedInAm`), so it
  also becomes its own alternative, a duplicate alternative or a second scheduled step; day-split is incidental. Fix at the source:
  `ResolveRun.settled` per period (terminal = admitted, same-slot loser, frozen; a relocate is not terminal, so ping-pong still ends in a bucket);
  `runPeriodPass` and `retryRelocatedInAm` skip settled products; extract run creation (`resolvePeriods` is 56 lines). Consumers:
  `fillPreCleanseGapFromAlternatives`, `applySlotAlternativeSwap`, `DraftPreviewScreen` "Change", explainability suites. Invariants: every non-hidden
  product in a bucket; no scheduled product in ANY same-period alternatives list; no id twice in an entry or a period; entry members share the slot; a
  stored snapshot is never re-added without `findViolationsAgainst`. Tests: failing-first repro; corpus property of these invariants.
- FE-14: `src/utils/routineEngine/planApply.ts` — `buildDraftSummaryLines(plan, diff, products, routines?)` (the signature qa-lead's
  `draft-summary.test.ts` assumes; without `routines` it keeps today's diff-based line). New pure `findReaddedProductIds(plan, routines)`: products
  with a planned (period, weekday) that no non-hidden saved step of that period covers (`[]` = every day), minus products narrated as `moved`. The line
  stays "N product(s) added", reserved outside the cap of 3 and last (max 4 lines); update the doc comment. `computeDiff` is unchanged;
  `DraftPreviewScreen` passes the `routines` it already reads. Tests: `planApply` (replace "never emits more than three lines"; full, one-weekday,
  un-hide, both periods counted once, crowded draft, nothing to add).
- DOC-1: `docs/specs/routine-engine-v2.1/phase-04-skeleton-buildup.md` §4.1 — diagram and step 4 "Nothing else enters": toner and eye cream are
  structural slots; an enzyme exfoliant is placed by its own rule (intermediate-routine).
- DOC-2: comments only — `planApply.ts`: a hidden step survives `buildStepsFromPlan` untouched ONLY when the plan does not schedule its product, else
  it is un-hidden with the plan's days; `RoutineCalendarView.tsx` header: drop "Read-only".
- Cross-cutting tests: pin in `planApply.test.ts` (removed step re-created; hidden step un-hidden, id and pin kept; unplanned hidden stays hidden);
  `tests/routine-engine/fixtures.ts`: `enzyme_exfoliant` in `RANDOM_ACTIVE_KEYS`, weight toner/eye cream/enzyme/wishlist into the sweeps; update the old
  minimal-routine assertions (`generate.test.ts` "minimal goal-driven routine", "maintenance goal → minimal routine", "all-gaps morning"; `skeleton.test.ts`
  "minimalism"). The old scheduled∩frozen "latent gap" was partly FE-13 (12 of 35 shelves); 23 legitimate freezes remain, so keep asserting per hard gate.

## 4. Assumptions

- Toner and eye cream join `SKELETON_SLOTS` directly and raise per-period gap placeholders by candidacy, like the core slots.
  Alternative: a separate extras table; owned-only placement; one consolidated card.
  Reason: one mode leaves no tier to protect; owner: never silent; reuses dedupe, `attachPlaceholderGaps`, `GapCard`.
- Morning exfoliation: enzymes prefer AM, may run PM, one product per period, at most 3 days a week; no purchase prompt.
  Alternative: PM like the acids, or both periods.
  Reason: non-photosensitizing, irritancy 1, so the PM-only ruling for retinoid/AHA/BHA does not apply; phototype, summer and rehab limits already act.
- Enzyme cleansers read as `peeling`, never the daily cleanse step; hair and lip names are skipped.
  Alternative: let them compete for the cleanser slot under a day cap.
  Reason: the cap would drop the plain cleanser on non-enzyme days; this surfaces a cleanser gap instead of hiding it.
- The left-out list reuses the plan and adds no state; a product whose only step is removed or hidden is listed; Remove and Hide both yield to the plan.
  Alternative: persist removal markers, or keep `hidden` through a save.
  Reason: owner — regeneration shows steps again; the list cannot tell removed-on-purpose from never-added; a hidden step is un-hidden by a save.
- Calendar: Remove/Hide rows are omitted outside edit mode; caption and highlight follow `editMode`.
  Alternative: no sheet outside edit mode; an always-on caption and highlight.
  Reason: keeps details reachable and applies her rule at the one ungated entry; outside edit mode "tap to edit" would be false.
- "Not for me" state is `AppSettings.dismissedGapCards` (at most 4 keys `am|pm:toner|eye_cream`), cleared per period by `applyRoutinePlan`, wholly by
  `resetAllRoutines`; "next save" = a Draft Preview save covering the period (manual edits, shelf edits and restarts do not reset it).
  Alternative: screen state (returns on every restart); `routineNoticeDismissedAt` (its hash changes on manual edits, not on a no-op save); `dismissedBanners`.
  Reason: only a persisted field cleared by the save path is "until the next save"; keys are per period and type, never per product or step: no tombstones.
- The dismissal filter runs after the engine, with edit mode on or off, and checks `reasonCode`.
  Alternative: edit-mode only; filter inside `generatePlan`.
  Reason: a card is a prompt, reversible at the next save; the engine stays UI-free; a mandate or follow-up card winning the (period, type) dedupe is safe.
- Wishlist products are excluded at the engine boundary (FE-3), not only in the left-out util.
  Alternative: filter in the util only.
  Reason: one owned-only input keeps live cards, Draft Preview and list in agreement.
- A product has one terminal outcome per period (FE-13).
  Alternative: hide self-offers in `applySlotAlternativeSwap`/Draft Preview; prune alternatives after the engine; only skip the relocation twin.
  Reason: pruning leaves 17 double-scheduled period views (a duplicate step id on save), 1 avoid-pair co-schedule and 12 spurious "frozen while scheduled"
  records; skipping the twin misses PM→AM retries. Scratch prototype, 6,000 seeded shelves: self-offers 259 and duplicates 90 of 8,867 alternatives (all
  with a relocate) → 0; every product still in a bucket; 43 engine suites green; 343 plans (5.7%) change. Re-measure after FE-1/FE-2.
- The summary's added line comes from the saved routines and sits outside the cap of 3 (max 4 lines), always last (FE-14).
  Alternative: widen `computeDiff` to weekdays; let "added" outrank inside 3; raise the cap to 4.
  Reason: `computeDiff` compares period membership and only feeds this summary; outranking drops the set-aside/reserve/moved narration that exists so
  nothing vanishes silently; a uniform 4 still crowds "added" out. Cost: one more line on a busy draft (research asked for 2–3 quiet lines).

## 5. Open Questions

- None blocking: Q5 (option B), Q6, Q7, the wishlist question and both qa-lead findings are decided by the owner (spec §10, this revision).
- Q4b — PLACEHOLDER copy (left-out, "Not for me", calendar hints) → design. For her read-through (vetoable): calendar gating, dismissal in view mode,
  the calendar entry's unchanged limits, the summary's fourth line.
