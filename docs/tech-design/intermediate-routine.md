# Technical Design: Intermediate routine (toner, eye cream, enzyme exfoliant, "Not in your routine")
Spec: docs/specs/intermediate-routine.md
Author: tech-designer
Date: 2026-10-14 (revised 2026-10-15: one routine, no style concept; owner answers applied)

## 1. Architecture Overview

One engine behaviour, no style input. `selectSkeleton` decides who enters each period's pool; this task widens only that:
toner and eye cream join `SKELETON_SLOTS` (candidates AND required slots that raise gap placeholders) and enzyme carriers
get one weekly exfoliate slot from a helper. `resolvePeriods`, mandates, Phase 9 buckets and determinism are untouched.
The Routines screen renders `validateCurrentRoutines().proposedPlan.placeholders` as `GapCard`s; that plan is built from
OWNED shelf + profile only, never from saved steps or UI state, so removing a step can neither raise nor clear a gap.
"Not for me" on a toner/eye-cream card is a presentation-only filter over that plan, kept in settings and cleared by the
next save of its period. Saved steps are written only by Draft Preview save, Reset all, and manual add/remove/reorder.

```
owned products ─► buildEngineInputFromStores ─► generatePlan(EngineInput — shape unchanged)
  normalizeProductType (+enzyme⇒peeling) ─► selectSkeleton: SKELETON_SLOTS · REQUIRED_SLOTS (+toner, eye_cream) · selectExfoliants
  ─► resolvePeriods (unchanged) ─► RoutinePlan {periods, frozen, reserve, placeholders, slotAlternatives}
RoutinesScreen: visibleGaps(placeholders, dismissedGapCards) ─► GapCard(onDismiss) · buildLeftOutItems ─► LeftOutSection
Edit mode ─► RoutineStepActionSheet(allowRemoval) · RoutineCalendarView(editMode) ─► routinesStore (no tombstones)
applyRoutinePlan / resetAllRoutines ─► clearDismissedGapCards(periods saved); on a save the plan wins over removals
```

## 2. API Contracts

N/A — fully local, no network surface (CLAUDE.md local-only constraint).

## 3. Implementation Tasks

### engineer (scope=frontend/utils — this app has no backend layer)
Phase A — toner, eye cream, gap cards, owned-only input:
- FE-1: `src/utils/routineEngine/slotting.ts` — add `toner: ['toner']`, `eye_cream: ['eye_cream']` to `SKELETON_SLOTS`; fix its
  "types outside this map do not enter" comment. Safe: other `structuralSlotFor` callers compare to `'cleanser'` or
  `'pre_cleanse'` only; `classifyEntries` adopts the slots with no edit to `selectSkeleton` (125 lines) or `generatePlan` (118).
- FE-2: `skeleton.ts` `REQUIRED_SLOTS` gains toner and eye_cream in both periods; `decisionReasons.ts` gains
  `toner_recommended`, `eye_cream_recommended` (compile-enforced). `dedupePlaceholders` unchanged. Any late promotion of a
  same-slot loser must pass `findViolationsAgainst` and be pruned from `slotAlternatives`; none is added.
- FE-3: new `src/utils/productOwnership.ts` `isOwnedProduct` (`status !== 'wishlist'`); `buildEngineInputFromStores` passes
  owned products only. Its only callers are `generateDraftPlan` and `validateCurrentRoutines`, so live gap cards and the
  Draft Preview share one input. `currentOverrideHash` hashes owned ids too (a wishlist save must not drop "Add anyway").
Phase B — enzyme exfoliant:
- FE-4: class `enzyme_exfoliant` in `src/constants/rulesets/actives.json`: matchers `papain|bromelain|subtilisin`;
  `photosensitizing:false, exfoliating:true, irritancy:1, barrierRepair:false`; `allowedPeriods:[am,pm]`;
  `preferredPeriod:'am'`; `attribution.requireWithinPosition:12`; bump `version`. Add the key to `ActiveIngredientKey` and
  entries in `labels.ts` ("Enzyme Exfoliant"; compile-enforced), `activeBadges.ts` (exfoliant bucket),
  `addProduct/activesGroups.ts`; reasons `enzyme_exfoliant_cap`, `exfoliant_deferred_barrier_repair`.
- FE-5: `categoryDetector.ts` — `reclassifyEnzymeExfoliant` (type `cleanser|other`, class via `getProductActiveKeys`, name
  not matching `isHairProductName`/`isLipProductName` ⇒ `peeling`; type checked first), composed in `normalizeProductType`
  after `reclassifyMakeupRemover` (a cleansing balm with enzymes stays a pre-cleanse); still the one normalisation entry.
- FE-6: `skeleton.ts` helper `selectExfoliants`: non-strong enzyme carriers → at most one per period, in
  `preferredPeriodFor`; extras ⇒ `duplicate_function`; barrier_repair as either goal ⇒ reserve
  `exfoliant_deferred_barrier_repair`. `treatmentCapFor` returns `ENZYME_EXFOLIANT_MAX_DAYS = 3` for an enzyme carrier BEFORE
  its `isStrongCarrier` return (draft constant beside `EXFOLIANT_TREATMENT_MAX_DAYS`), applied at selection AND in the
  override block, where an enzyme override re-enters its preferred period only (unguarded, "Add anyway" schedules it AM and
  PM every day — spike-verified). `selectSkeleton` must not grow: extract the override block into a helper, then add the
  one `selectExfoliants` call. No placeholder is ever raised for an exfoliant.
Phase C — nothing vanishes, trimming, calendar:
- FE-7: new `src/utils/routineLeftOut.ts` (pure): `buildLeftOutItems(plan, products, routines)` → `LeftOutItem
  { productId; kind: 'ready'|'reserve'|'frozen'|'alternative'; reasonCode: DecisionReasonCode | null; until?: string }`.
  Considered iff `isOwnedProduct`, not `isHidden`, and no step with `hidden === false` in any routine (any weekday). Kind
  precedence ready (scheduled in the plan) > reserve > frozen > alternative (slot loser), shelf order within a kind;
  removed, hidden and never-added products alike. Total: fallback `reserve`/`not_needed_for_goals`, asserted unreachable.
- FE-8: new `LeftOutSection.tsx` (props `{ items, products, onAdd(productId), onReview() }`) and ONE copy module
  `src/constants/routineScreenCopy.ts`, all PLACEHOLDER (Q4b): `LEFT_OUT_COPY { leftOutHeader(n), readyToAdd, backup,
  addAction, reviewAction }`, `GAP_DISMISS_COPY { action }`, `CALENDAR_HINT_COPY { view, edit, rowHintView, rowHintEdit }`
  (the previous drafts' style-named module, renamed: no style copy, three surfaces). Footer wiring in `RoutinesScreen.tsx`
  between `PausedSteps` and "Add product": collapsed "Not in your routine · N"; actions reuse `handleOverride` and
  `handleOpenDraftPreview`; items derive from the `validation` memo.
- FE-9: `RoutineStepActionSheet.tsx` gains `allowRemoval?: boolean` (default true; false omits "Remove from routine" and
  "Hide from routine" and the divider on the last visible row); `RoutinesScreen.tsx` passes `allowRemoval={editMode}`.
  Outside edit mode the sheet keeps "View product details" and "Edit product", both acting on the product only.
- FE-10: `RoutineCalendarView.tsx` stays presentational: new optional `editMode?: boolean` (default false; no store access).
  With rows present it renders one caption (`CALENDAR_HINT_COPY.view|edit`, `typography.bodySmall`, `colors.textSecondary`)
  under the month label; in edit mode the identity column takes `colors.statusInfoTint` and a `colors.statusInfoLine` edge
  (not plum tints: they read pink); none of it in the empty state. Keep each row's label `${name}, open actions` (an existing
  green test finds rows by it) and add `accessibilityHint` per mode; add no "Morning"/"Evening" text or sun/moon icon.
  `RoutinesScreen` passes `editMode`.
Phase D — "Not for me" on optional gap cards:
- FE-11: new `src/utils/gapDismissal.ts` (pure): `gapDismissKey(p: PlaceholderSlot): string | null` → `'am:toner'` etc. iff
  `reasonCode` is `toner_recommended`/`eye_cream_recommended` (never a mandate, follow-up or core-slot placeholder);
  `visibleGaps(placeholders, keys)`; `keysAfterSave(keys, periods)`. `AppSettings.dismissedGapCards: string[]` (default `[]`,
  add to `pickSettings`) with `dismissGapCard(key)` and `clearDismissedGapCards(periods)` in `settingsStore`.
  `applyRoutinePlan` clears the periods it wrote; `resetAllRoutines` clears both (cross-store work stays in `src/domain/`).
- FE-12: `GapCard` gains optional `onDismiss` → a second ghost button (`GAP_DISMISS_COPY.action`); `RoutinesScreen` applies
  `visibleGaps` to `placeholders` before both `attachPlaceholderGaps` memos and passes `onDismiss` only when
  `gapDismissKey(gap)` is non-null. Available with edit mode on or off.
Docs:
- DOC-1: `docs/specs/routine-engine-v2.1/phase-04-skeleton-buildup.md` §4.1 — diagram and step 4 "Nothing else enters":
  toner and eye cream are structural slots; an enzyme exfoliant is placed by its own rule (intermediate-routine).
- DOC-2: comments only — `planApply.ts`: a hidden step survives `buildStepsFromPlan` untouched ONLY when the plan does not
  schedule its product, otherwise it keeps id and pin, becomes `hidden:false`, takes the plan's days; `RoutineCalendarView.tsx`
  header: drop "Read-only" (rows open the step sheet; Remove/Hide only in edit mode).

### engineer (unit tests, both scopes)
- Each task ships its tests (`skeleton`, `slotting`, `categoryDetector`, `rulesetIntegrity`, new `routineLeftOut`,
  `gapDismissal`, `productOwnership`, `settingsStore` clear-by-period; property "non-hidden saved steps ∪ listed ⊇ owned
  shelf" over shelves with removed, hidden and wishlist products). Pin in `planApply.test.ts`: a removed step for a planned
  product is re-created; a hidden step for a planned product is un-hidden (id, pin kept); an unplanned one stays hidden.
- `tests/routine-engine/fixtures.ts`: add `enzyme_exfoliant` to `RANDOM_ACTIVE_KEYS`; weight toner, eye cream, enzyme and
  wishlist products into the sweeps. Update assertions encoding the old minimal routine (`generate.test.ts` "minimal
  goal-driven routine", "maintenance goal → minimal routine", "all-gaps morning"; `skeleton.test.ts` "minimalism"): the full
  set is whatever fails after FE-1/FE-2. `tests/product-images/RoutineCalendarView.test.tsx` is red only for empty-state
  copy drift (2 tests); FE-10 does not touch that branch and must keep its 9 green tests green.
- Latent gap: explainability/determinism suites assert scheduled ∩ frozen = ∅, yet frozen in one period and scheduled in the
  other is legal (seeds 157, 362 of a 1000-seed sweep); assert per hard gate before widening seeds.

## 4. Assumptions

- Toner and eye cream join `SKELETON_SLOTS` directly and raise per-period gap placeholders by candidacy, like core slots.
  Alternative: a separate extras table; owned-only placement; one consolidated card.
  Reason: one mode leaves no tier to protect; owner: never silent; reuses dedupe, `attachPlaceholderGaps`, `GapCard`.
- Morning exfoliation: enzymes prefer AM, may run PM, one product per period, at most 3 days a week; no purchase prompt.
  Alternative: PM like the acids, or both periods.
  Reason: non-photosensitizing, irritancy 1, so the PM-only ruling for retinoid/AHA/BHA does not apply; Fitzpatrick 4–6,
  summer and rehab freezes already act on `exfoliating:true` (spike-verified). Values are constants for the Q3 review.
- Enzyme cleansers read as `peeling`, never the daily cleanse step; hair and lip names are skipped.
  Alternative: let them compete for the cleanser slot under a day cap.
  Reason: the cap would drop the plain cleanser on non-enzyme days; this surfaces a cleanser gap instead of hiding it.
- The left-out list reuses the plan and adds no state; a product whose only step is removed or hidden is listed (supersedes
  "a hidden step counts as saved"). Alternative: persist removal markers so deliberately removed products stay out.
  Reason: owner declined remembering removals and accepted that the list cannot tell removed-on-purpose from never-added;
  a hidden step is invisible and un-hidden by a save, so excluding it left the product nowhere.
- Removal is not remembered: Remove and Hide both yield to the plan on a Draft Preview save; `buildStepsFromPlan` unchanged.
  Alternative: keep `hidden` through a save, or tombstones. Reason: owner — regeneration shows steps again; code already so.
- Calendar: Remove/Hide rows are omitted outside edit mode; caption and highlight follow `editMode`.
  Alternative: no sheet outside edit mode; an always-on caption and highlight.
  Reason: keeps details reachable and applies her rule at the one ungated entry; outside edit mode "tap to edit" would be false.
- "Not for me" state is `AppSettings.dismissedGapCards` (at most 4 keys `am|pm:toner|eye_cream`), cleared per period by
  `applyRoutinePlan` and wholly by `resetAllRoutines`. "Next save" = a Draft Preview save covering the period; manual edits,
  shelf edits and restarts do not reset it.
  Alternative: screen state like `dismissedCycleSplitRivalIds` (returns on every restart); `routineNoticeDismissedAt` (its
  hash also changes on manual edits and not on a no-op save); `dismissedBanners` (permanent, no removal action).
  Reason: only a persisted field cleared by the save path is "until the next save"; keys are per period and type, never per
  product or step, so it cannot become the tombstone store she declined. A dismissal may outlive its gap until the next save.
- The filter runs after the engine (never inside it), works with edit mode on or off, and checks `reasonCode`.
  Alternative: gate it in edit mode; filter inside `generatePlan`.
  Reason: a card is a prompt, reversible at the next save; the engine stays UI-free and deterministic; a mandate or follow-up
  card that wins the (period, type) dedupe is never dismissible.
- Wishlist products are excluded at the engine boundary (FE-3), not only in the left-out util.
  Alternative: filter in the util only. Reason: one owned-only input keeps live cards, Draft Preview and list in agreement.

## 5. Open Questions

- None blocking: Q5 (option B), Q6, Q7 and the wishlist question are answered by the owner (spec §10).
- Q4b — PLACEHOLDER copy (left-out, "Not for me", calendar hints) → design; it lives in `routineScreenCopy.ts`.
- For her read-through (vetoable): calendar gating, dismissal in view mode, and the calendar entry's unchanged limits.
