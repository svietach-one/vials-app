# Routine Step Grouping — Implementation Plan

**Version:** 1.0
**Companion to:** `PRD_Spec.md`, `SCREENS.md`, `USER_STORIES.md` (this package)

Six phases, ordered so that each one leaves the app in a shippable state. Phases 1–3 are additive and invisible until Phase 4 turns grouping on.

**No new npm or Expo dependencies.** Everything needed is already in the project.

---

## Phase 0 — Verify the baseline

Before writing anything, confirm the assumptions this package rests on. All were true at 2026-08-24; if any has changed, the plan changes with it.

- [ ] `RoutineStep` is `{ id, productType, productId, hidden, scheduledDays, userPinned?, stepNote? }` in `src/types/index.ts`
- [ ] `Routine` is `{ id, name, timeOfDay, steps }` — no `order` field; order is array position
- [ ] `LAYERING_ORDER` in `src/constants/rulesets/productFacts.ts` still reads `makeup_remover 0, cleanser 1, peeling 2, toner 3, essence 4, ampoule 5, serum 6, gel 6, other 7, spot_treatment 8, eye_cream 9, mask 10, lotion 11, cream 11, moisturizer 11, oil 12, balm 12, spf 13` — the whole ordering design depends on these numbers
- [ ] `periodsForProduct` restricts **only** `spf`
- [ ] `actives.json` `classes` still contains `retinoid, aha, bha, pha, vitamin_c_pure, vitamin_c_derivative, niacinamide, benzoyl_peroxide, azelaic_acid, hydroquinone, copper_peptides, spf_filters, ceramides, hyaluronic_acid, panthenol, cica, peptide_signal, peptide_neuro, glycerin_class, physical_exfoliant` — every transition rule key must exist here
- [ ] `spf_filters` still has no chemical/mineral discriminator (its `matchers` mix zinc oxide and titanium dioxide with the organic filters, and `properties` carries only `spf: true`)
- [ ] `generatePlan` is pure and deterministic; `applyRoutinePlan` is the only write path
- [ ] `TodayScreen.tsx` and `WeeklyPlanView.tsx` are imported by nothing
- [ ] `AppSettings.gamificationEnabled` exists, defaults to `false`, and is read by no component
- [ ] The engine test suite passes on a clean checkout

Record the baseline generation output for a fixture shelf. Every later phase re-runs it and diffs — this is the cheapest possible guard on the regressions in US-45.

---

## Phase 1 — Types and constants

Additive only. Nothing renders differently.

**`src/types/index.ts`**

```ts
export type StepAction =
  | 'cleanse' | 'exfoliate' | 'tone' | 'treat'
  | 'moisturize' | 'mask' | 'seal' | 'protect';

export type Zone = 'face' | 'eyes' | 'neck' | 'lips' | 'hands';

export type StepTiming = 'inline' | 'reapply';

export type StepTransition =
  | { kind: 'note'; text: 'dry_skin' | 'immediate' | 'until_dry' | 'before_sun' }
  | { kind: 'none' };
```

Extend **`Product`** — not `RoutineStep` — with `zones?: Zone[]`, `timing?: StepTiming` and `reapplyAfterHours?: number`. All optional; absent means `['face']` and `'inline'`.

**New — `src/constants/rulesets/stepActions.ts`**

- `STEP_ACTION_FOR_TYPE: Record<ProductType, StepAction>` — the full 18-entry table from `PRD_Spec.md` §3.2, typed so a missing key is a compile error
- `STEP_ACTION_LABELS: Record<StepAction, string>`

There is deliberately **no** `STEP_ACTION_ORDER` constant, **no** `stepActionPosition` helper, and **no** `STEP_ACTION_PERIODS` constant.

Order is read off the persisted `Routine.steps` array at grouping time (Phase 2), not computed from constants. A hand-written list would be a second source of truth that drifts — and did, in the first draft of this spec, which placed `Mask` before `Tone` while the code places it at index 10, after both `Tone` (3) and `eye_cream` (9). Computing it from `LAYERING_ORDER` instead would be equally wrong in a different way: it would override every manual reorder, since drag persists by rewriting the array.

Periods are not restricted at all, because the only real restriction lives upstream in `periodsForProduct`, where `spf` is forced to AM. A renderer-side period table would be a **new** constraint that silently hides legitimately placed products — a morning exfoliant would be dropped with no card and no explanation.

**New — `src/constants/rulesets/stepTransitions.ts`**

- `TRANSITION_RULES: Partial<Record<ActiveIngredientKey, { after?: StepTransition; before?: StepTransition }>>` from `PRD_Spec.md` §5.3 — **four entries**: `retinoid`, `benzoyl_peroxide`, `hyaluronic_acid`, `spf_filters`
- Keys must be real class keys — assert every one against `actives.json` `classes` at test time so a typo cannot silently produce a rule that never fires. An earlier draft had `azelaic` for `azelaic_acid` and prose names for `hyaluronic_acid` and `spf_filters`; all three would have compiled and done nothing.
- Do **not** add numeric waits for acids or vitamin C. They were specified, then removed on evidence (`PRD_Spec.md` §5.2), and the type has no `wait` variant to put them in.

**Migration.** All new fields are optional with meaningful absent-defaults, so `migrations.ts` needs **no** new step and persisted routines and products are untouched. Confirm this rather than assume it: load a routine persisted before this change and check it renders.

**Tests:** exhaustiveness of `STEP_ACTION_FOR_TYPE` over `ProductType`; every `TRANSITION_RULES` key present in `actives.json` `classes`.

---

## Phase 2 — Grouping and transition logic

Pure functions, no UI. Fully unit-testable.

**New — `src/utils/routineGrouping.ts`**

```ts
groupStepsIntoActions(steps: RoutineStep[], products: Product[]): StepGroup[]
```

**Bucket, do not walk.** Assign every step to `STEP_ACTION_FOR_TYPE[reclassifiedType(step)]`, then emit one group per non-empty action, **ordered by the array index of each group's first member**.

A consecutive-run walk is the obvious implementation and it is wrong: any action whose layering index falls between two members of another action splits that action in two. `eye_cream` (9), `mask` (10), `cream` (11) produce `Moisturize → Mask → Moisturize`, which defeats the feature's central example. One group per action is the invariant, and bucketing gives it for free.

Use the **reclassified** product type — `reclassifyMakeupRemover` runs at read time and the ordering already accounts for it, so grouping must too.

Within a group, `reapply` cards sort last; everything else keeps its incoming `LAYERING_ORDER` position.

`products` is needed because `zones` and `timing` now live on `Product` (Phase 1).

```ts
resolveTransition(from: StepGroup, to: StepGroup | null): StepTransition
```

Implements `PRD_Spec.md` §5.4 exactly, over **adjacent rendered** groups — the input is the already period-, weekday- and pause-filtered list, so a step hidden today creates no phantom gap. `to === null` handles the final gap, which returns `none` except when the final step carries `spf_filters`, where it returns `note: before_sun`.

**Tests:** the whole cross-cutting matrix at the end of `USER_STORIES.md` runs here, at the unit level, before any pixel exists. Every row of it should be a case.

Two that are easy to omit and expensive to miss:

- a freshly generated routine groups to `Cleanse · Exfoliate · Tone · Treat · Moisturize · Mask · Seal · Protect`;
- an array reordered so a `moisturize` step precedes a `treat` step groups to `Moisturize` before `Treat` — proving group order follows the array and not the constants.

---

## Phase 3 — Product-level fields on the shelf

**`ProductDetail` screen** gains two controls, both writing to `Product` in `catalogStore`:

- `zones` — multi-select chips, defaulting to `face`
- `timing` — inline / reapply, with a numeric hours field shown only for reapply

**No write-through to `RoutineStep`.** The Routine screen reads these from the product record at render time. Copying them onto every step referencing the product would create as many copies as routines and guarantee drift the first time one is edited.

Do this before the Routine screen changes so the data exists to render.

---

## Phase 4 — Routine screen

The visible change.

**New components — `src/components/routine/`**

- `StepGroupHeader.tsx` — ordinal, label, dimmed and edit-mode states
- `StepTransitionDivider.tsx` — hairline rules, centred label, renders `null` for `kind: 'none'`
- `GapCard.tsx` — Cobalt placeholder card

**Modified**

- `RoutineStepCard.tsx` → `RoutineProductCard.tsx`. Rebuilt to the three-region anatomy in `SCREENS.md` §4.1 — thumbnail, text column with a conditional meta line, and a right cluster holding exactly one occupant. Geometry from the tokens table in §4.3; nothing hardcoded. Border removed, shadow only. Completed state per §4.6.

  **The right cluster is the part most likely to be got wrong.** Five things want that edge — completed badge, status badges, zone tags, and two edit-mode icons. §4.2 gives the priority: edit icons, else Completed alone, else status badges. Zone tags do **not** live there; they belong on the meta line. Build the cluster as a single slot with one occupant rather than a row that accumulates children, or the card will overflow the first time a completed product also carries an allergen badge.

  **The inner shadow needs the `react-native-svg` overlay described in `SCREENS.md` §4.6.** RN shadow props draw outside the view only; there is no inset variant, and a negative `shadowOffset` does not produce one. `react-native-svg` (15.12.1) is already a dependency, so this stays inside the no-new-dependencies rule. Do not add `expo-linear-gradient` — it is not in the project.
- `RoutinesScreen.tsx` — render `groupStepsIntoActions` output instead of a flat list; interleave transitions; move `ConflictWarningInline` under the owning step's header; bottom controls always visible.
- `PausedSteps` — copy changes from "hidden" to "paused".

**Vertical rhythm.** Three gap sizes, taken from the existing `space` scale and never hardcoded: header→card `space.gapInline` (8), card→card `space.gapStack` (12), step→step `space.gapSection` (32); a transition divider replaces the 32 with `space.gapCard` (16) above and below. The grouping reads through spacing at least as much as through the header (`SCREENS.md` §3), and if the ratio drifts the grouping stops working. A visual check at 3 steps and at 8 steps, with one-card and three-card steps, belongs in review.

---

## Phase 5 — Completion

**New — `src/store/completionStore.ts`**

Records keyed `(productId, routineId, date)`. Persisted alongside the other Zustand stores. `period` is not stored — `Routine.timeOfDay` already carries it, and a second copy is a chance for the two to disagree.

Reuse the existing 04:00 skincare-day boundary helper from `trackingActions.ts` rather than writing a second one — two boundary implementations will diverge.

**`settingsStore`** — `gamificationEnabled` default flips to `true`. `GamificationToggle` in Profile gets its new description.

Wire the tap target on `RoutineProductCard`, gated on the setting and on the selected date not being in the future.

**Explicitly not done:** completion records do not flow into `ProductApplicationStats` and do not touch the adaptation ramp (US-40 negative).

---

## Phase 6 — Duplicate-slot rework and cleanup

**Duplicate slot.** Add the suppression rule from `SCREENS.md` §6.5 to the duplicate detection: suppress when products differ by `zones` or by `timing`; keep the warning for same-zone, same-timing, both-`inline`.

This phase is last on purpose: it is the only one that changes existing user-facing safety-adjacent behaviour, and it should land when the grouping it depends on is already stable and reviewable.

Verify the density rows are unaffected — they are a separate mechanism and must still fire regardless of zones.

**Dead code.** All confirmed unreferenced; delete rather than leave as traps:

- `src/screens/TodayScreen.tsx`
- `src/components/routine/WeeklyPlanView.tsx`
- `src/components/routine/TabButton.tsx`
- `src/components/routine/ContributionConsentMigrationBanner.tsx`

`RoutineSchedulerSheet.tsx` is also unreferenced but is **revived**, not deleted — it already implements the Schedule picker Phase 4 needs.

**`HiddenStepsManager`** is removed from the Clinic tab footer. Paused cards live on the Routine screen.

**Colour map** entry in the design-system docs reworded from "completed-checkbox fill state" to "completed-card badge".

---

## Test plan

Three layers.

**Unit.** Phases 1–2 carry the weight: mapping exhaustiveness, transition resolution, grouping walk. Every row of the cross-cutting matrix in `USER_STORIES.md` is a case here.

**Regression — the engine must not move.** Run before and after every phase:

- generation determinism on the fixture shelf — byte-identical plan
- pregnancy freeze still emits `reasonCode: 'pregnancy_blocked'`
- adaptation ramp: 2 days/week through application 4, 4 through 8, uncapped after
- seasonal cap: strong exfoliants 1 day/week in summer
- phototype cap: exfoliants 1 day/week for Fitzpatrick 4–6
- 7 pair rules fire; 4 proposals stay disabled
- `frozen` / `reserve` / `placeholders` populated as before
- decision log unchanged
- no-op guarantee: no conditions and no goals ⇒ byte-identical output

**Visual.** Grouping legibility at 3 and 8 steps; one-card and three-card steps; a routine with no transitions at all; completed, dimmed, paused, gap, orphaned and reapply states; future-day inertness.

---

## Sequencing and risk

| Phase | Risk | Note |
|---|---|---|
| 0 Baseline | — | Cheapest insurance in the plan |
| 1 Types | Low | Additive; no migration |
| 2 Logic | Low | Pure functions, no UI |
| 3 Shelf fields | Low | Isolated screen |
| 4 Screen | **Medium** | Largest diff; spacing tokens are the subtle failure mode |
| 5 Completion | Low–medium | New store; the trap is coupling it to the ramp |
| 6 Duplicates + cleanup | **Medium** | Only phase changing existing safety-adjacent behaviour |

Phases 1–3 can ship dark. Phase 4 is the visible cut. Phases 5 and 6 are independent of each other and can be reordered.

---

## Definition of done

- All 12 stories (US-34 … US-45) pass, negative criteria included
- Regression suite green, generation byte-identical on the fixture
- Dead code deleted, `RoutineSchedulerSheet` revived
- No new dependencies
- Persisted routines from before the change load and render correctly
- Open items in `PRD_Spec.md` §10 tracked: dermatologist sign-off on the timing table, Polish labels reviewed by a native speaker, `minRestHours` implemented or removed
