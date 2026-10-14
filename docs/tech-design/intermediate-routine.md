# Technical Design: Intermediate routine ("Balanced" style)
Spec: docs/specs/intermediate-routine.md
Author: tech-designer
Date: 2026-10-14

## 1. Architecture Overview

A routine style (`RoutineDepth`) is a new engine input that acts BEFORE admission. `selectSkeleton` (pipeline
step 4.5) decides who enters each period's pool; Balanced widens only that decision: toner and eye cream become
structural-style slots, enzyme-exfoliant carriers get one weekly exfoliate slot, and the two steps Balanced calls
for join the required-slot list that raises gap placeholders. `resolvePeriods` (pair rules, caps, same-slot cap),
mandates, the Phase 9 buckets and determinism are untouched, so Essential reproduces today's engine (throwaway
spike: 0 plan differences over 600 seeded shelves after one reserve-reason relabel). The live Routines screen
already renders `validateCurrentRoutines().proposedPlan.placeholders` as `GapCard`s, so Balanced gaps need no UI.
Products that still miss the routine are listed by a pure util + section fed by the same proposed plan.
Prerequisite: start after `fix/precleanse-gap-card` merges (uncommitted edits in the shared files); branch from origin/dev.

```
settingsStore.routineDepth ─► buildEngineInputFromStores ─► generatePlan(EngineInput.depth)
  normalizeProductType (+enzyme cleanser⇒peeling) ─► selectSkeleton(depth)
     classifyEntries: SKELETON_SLOTS ∪ DEPTH_EXTRA_SLOTS[depth] · selectExfoliants · requiredSlotsFor(period, depth)
  ─► resolvePeriods (unchanged) ─► RoutinePlan {periods, frozen, reserve, placeholders, slotAlternatives}
RoutinesScreen: placeholders ─► GapCard (unchanged) · buildLeftOutItems(plan, products, routines) ─► LeftOutSection
DraftPreviewScreen: SegmentedControl ─► setRoutineDepth ─► regenerate draft
```

## 2. API Contracts

N/A — fully local, no network surface (CLAUDE.md local-only constraint).

## 3. Implementation Tasks

### engineer (scope=frontend/utils — this app has no backend layer)

Phase A — style, toner, eye cream, gap cards:
- FE-1: `RoutineDepth = 'essential' | 'balanced'` and `AppSettings.routineDepth` in `src/types/index.ts`; new
  `src/constants/routineDepth.ts` (`DEFAULT_ROUTINE_DEPTH = 'balanced'`, option labels/sublabels). In
  `src/store/settingsStore.ts`: default, `pickSettings`, `setRoutineDepth`; the hydrate default merge fills old data.
- FE-2: `src/utils/routineEngine/slotting.ts` — `DEPTH_EXTRA_SLOTS` ({ balanced: toner, eye_cream }) and
  `slotAtDepth(type, depth)`. `SKELETON_SLOTS` / `structuralSlotFor` stay untouched.
- FE-3: `src/utils/routineEngine/skeleton.ts` — `SkeletonInput.depth`; `classifyEntries(…, depth)` via `slotAtDepth`;
  `requiredSlotsFor(period, depth)` (+toner, eye_cream, both periods, at Balanced) feeding
  `structuralGapPlaceholders(structural, depth)`; reserve `outside_routine_depth` for what Balanced would place (incl. enzymes).
  New logic goes in helpers: `selectSkeleton` is already 125 lines (tech-lead W6) — do not grow it.
- FE-4: `src/utils/routineEngine/generate.ts` — `EngineInput.depth?` (absent ⇒ `DEFAULT_ROUTINE_DEPTH`) into
  `selectSkeleton`; `src/constants/decisionReasons.ts` — `toner_recommended`, `eye_cream_recommended`,
  `outside_routine_depth` with text (compile-enforced; `rulesetIntegrity` checks emitted literals).
- FE-5: `src/domain/routinePlanActions.ts` `buildEngineInputFromStores` passes `depth`; `src/screens/RoutinesScreen.tsx`
  selects `routineDepth` and adds it to the `validation` memo deps (else gap cards go stale on a switch).
  `computeOverrideHash` is NOT extended.

Phase B — enzyme exfoliant:
- FE-6: class `enzyme_exfoliant` in `src/constants/rulesets/actives.json`: matchers `papain|bromelain|subtilisin`;
  `photosensitizing:false, exfoliating:true, irritancy:1, barrierRepair:false`; `allowedPeriods:[am,pm]`;
  `preferredPeriod:'am'`; `attribution.requireWithinPosition:12`; bump `version`. Add the key to `ActiveIngredientKey`
  and entries in `src/constants/labels.ts` (compile-enforced; also `FUNCTIONAL_BENEFIT_INGREDIENTS.exfoliation`),
  `src/utils/activeBadges.ts` (exfoliant bucket), `src/components/addProduct/activesGroups.ts`; reasons
  `enzyme_exfoliant_cap`, `exfoliant_deferred_barrier_repair`.
- FE-7: `src/utils/productForm/categoryDetector.ts` — `reclassifyEnzymeExfoliant` (type `cleanser|other` and class
  present via `getProductActiveKeys` ⇒ `peeling`), composed inside `normalizeProductType`.
- FE-8: `skeleton.ts` helper `selectExfoliants`: non-strong enzyme carriers at Balanced → at most one per period, in
  `preferredPeriodFor`; extras ⇒ `duplicate_function`; barrier_repair as either goal ⇒ reserve
  `exfoliant_deferred_barrier_repair`. `treatmentCapFor` returns `ENZYME_EXFOLIANT_MAX_DAYS = 3` (draft constant beside
  the other consultant-review caps), applied at selection AND in the override block, where an enzyme override
  re-enters its preferred period only (unguarded, "Add anyway" schedules it AM and PM every day — spike-verified).
  No placeholder is ever raised for it.

Phase C — nothing vanishes; style control:
- FE-9: new `src/utils/routineLeftOut.ts` (pure, no React/stores): `buildLeftOutItems(plan, products, routines)`.
  For each non-hidden product with no saved step (a hidden step counts as saved) emit one `LeftOutItem` of kind
  `ready` (scheduled in the plan) | `reserve` | `frozen` | `alternative` (slot loser), in that precedence, shelf
  order within a kind. Total function: fallback `reserve`/`not_needed_for_goals`, asserted unreachable by test.
- FE-10: new `src/components/routine/LeftOutSection.tsx` + footer wiring in `RoutinesScreen.tsx` (between
  `PausedSteps` and "Add product"): collapsed header "Not in your routine · N", rows, actions reuse
  `handleOverride` (reserve) and `handleOpenDraftPreview` (ready). No store writes, tokens only.
- FE-11: `DraftPreviewScreen.tsx` — `depth` / `onDepthChange` props, `SegmentedControl` with the selected style's
  sublabel; `RoutinesScreen.tsx` handler: `setRoutineDepth(d); setDraft(validateCurrentRoutines())`.
- DOC-1: `docs/specs/routine-engine-v2.1/phase-04-skeleton-buildup.md` §4.1 step 4 — one-line amendment: "Nothing
  else enters" is the Essential contract; Balanced widens it (intermediate-routine).

### engineer (unit tests, both scopes)
- Each task ships its tests (`skeleton.test.ts`, `slotting.test.ts`, `categoryDetector.test.ts`,
  `rulesetIntegrity.test.ts`, new `routineLeftOut.test.ts` incl. the "saved ∪ left-out ⊇ shelf" property).
- `tests/routine-engine/fixtures.ts`: add `enzyme_exfoliant` to `RANDOM_ACTIVE_KEYS`; parametrize
  explainability, determinism-and-safety and generate suites over both styles. Pin `depth: 'essential'` in the
  tier-contract tests (phase-04 acceptance, the minimal-routine test in `generate.test.ts`, the all-gaps ordering
  test) and update the one assertion expecting `not_needed_for_goals` for a toner/eye cream.
- Latent gap, not a Balanced regression: `explainability-invariant` and `determinism-and-safety` assert
  scheduled ∩ frozen = ∅, yet a product frozen in one period and scheduled in the other is legal (seeds 157 and 362
  of a 1000-seed sweep at today's engine: a cleanser and a balm, frozen by copper-peptide pair rules). Assert per
  hard gate (clinical, pregnancy, PAO, no_allowed_period) before widening seeds or parametrizing.

## 4. Assumptions

- The style changes slot SELECTION before admission, not a filter over a finished plan.
  Alternative: generate one maximal plan and drop steps for Essential.
  Reason: a post-hoc drop leaves day-splits, freezes and slot winners computed with the dropped steps present;
  selection upstream keeps the ladder authoritative, is small, and leaves Essential equal to today's engine (spike).
- Balanced slots live in a new `DEPTH_EXTRA_SLOTS`, a view over existing `LAYERING_ORDER` types.
  Alternative: add toner and eye_cream to `SKELETON_SLOTS`.
  Reason: `structuralSlotFor` also drives grouping, pre-cleanse coverage and validate; widening it would change
  Essential and saved-routine checks.
- Default is `balanced` for everyone through one constant (settings default and engine fallback); no migration.
  Alternative: engine fallback `essential` (tests untouched) while the app passes `balanced`.
  Reason: no release and no users (product owner). Balanced is best for a new user: it is the
  cosmetologist-aligned default, turns two common silently-reserved items (toner, eye cream) into steps, and every
  gap or exclusion is visible and reversible in one tap. Two defaults would be a footgun; the flip costs ~3 test pins.
- The style is a device preference in `AppSettings`; `computeOverrideHash` is unchanged.
  Alternative: a `UserProfile` field, or hashing the style into the override key.
  Reason: it changes engine behaviour like `routineCycleType`; hashing it would discard "Add anyway" on a switch.
- Balanced calls for toner and eye cream only; a missing one raises a per-period `PlaceholderSlot`, using
  candidacy exactly as the core slots do.
  Alternative: owned-only placement, or one consolidated "complete your routine" card.
  Reason: product owner — never silent. Per-slot cards reuse `dedupePlaceholders`, `attachPlaceholderGaps` and
  `GapCard` unchanged, sit where the step belongs, and are bounded (spike: at most 5 per period view).
- Exfoliation is opportunistic: placed when owned, never prompts a purchase (open question Q2).
  Alternative: a card when no enzyme product is owned.
  Reason: it depends on skin state (barrier_repair, post-procedure freeze, tone and season caps); a card could ask
  for what the engine then forbids. Goal coverage remains the channel for actives.
- Morning exfoliation decided: enzymes prefer AM, may run PM, one product per period, at most 3 days a week.
  Alternative: PM like the acids, or both periods.
  Reason: non-photosensitizing and irritancy 1, so the PM-only ruling for retinoid/AHA/BHA does not apply (`pha`
  is already morning-safe; that lock's test is untouched); matches the memo; Fitzpatrick 4–6 and summer already
  clamp any `exfoliating:true` product to 1 day and procedure rehab rules already freeze it (spike-verified).
- Enzyme cleansers read as `peeling`, never the daily cleanse step.
  Alternative: let them compete for the cleanser slot under a day cap.
  Reason: the same-slot cap would drop the plain cleanser on non-enzyme days; reclassifying follows the existing
  `normalizeProductType` pattern and surfaces a cleanser gap instead of hiding it.
- The left-out list reuses the proposed plan; no new persisted state.
  Alternative: persist dismissals, or show leftovers only in the Draft Preview.
  Reason: Draft-only leaves the saved screen (where reserve is invisible today) unchanged; dismissals need a new store.
- `LAYERING_ORDER` is unchanged (eye cream renders before the moisturiser), and tier-excluded products get a new
  reserve reason `outside_routine_depth`.
  Alternative: reorder to match the memo; keep `not_needed_for_goals`.
  Reason: ordering is global (saved routines, validation) and the memo's order is one consultant's preference; the
  old text blames the user's goals when the cause is the style.
- Balanced is not a strict superset of Essential (spike, 1000 shelves: 10 steps dropped, mostly cleansers carrying an
  active displaced by an admitted toner/eye cream's pair rule; 17 others added, mainly gels/serums that win the single
  treatment slot a mild-active toner/eye cream used to hold).
  Alternative: keep them in the treatment pool as well.
  Reason: simplicity; each effect is explained through frozen/reserve/left-out and the invariant holds. UI copy
  never promises "everything from Essential".

## 5. Open Questions

All non-blocking (planner default implemented; the answer changes a constant or copy); owners in spec §10:
Q1 third "Complete" style now? (default no) · Q2 gap card for a missing exfoliant? (default no) · Q3 clinical review
of draft values (matchers, 3 days, 12-ingredient window, barrier-repair deferral, AM) · Q4 style names and copy.
