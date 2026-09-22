# Routine Step Grouping — Product Requirements

**Version:** 1.0
**Status:** DRAFT — awaiting implementation
**Date:** 2026-08-24
**Supersedes:** the Routine Hub sections of `docs/specs/engine 4.0/PRD_Spec.md` and `SCREENS.md` where they conflict. Everything else in that package stands.

---

## 0. Reading order and relationship to existing docs

This package describes **one change: the Routine screen gains a grouping level.** It does not change the routine engine, generation, conflict resolution, scheduling maths, or any safety rule.

Three prior sources matter, and they disagree with each other. Resolution order:

| Source | Standing |
|---|---|
| Shipped code (`src/`) | **Authoritative on behaviour.** Verified 2026-08-24. |
| `engine 4.0/engine4.1/ENGINE_4.0_RECONCILIATION_AND_PHASE11_HANDOFF.md` | Authoritative on goal coverage and pregnancy safety. Untouched by this package. |
| `engine 4.0/PRD_Spec.md`, `SCREENS.md`, `USER_STORIES.md` | **Stale in the Routine Hub sections.** See §0.1. |

### 0.1 Known staleness in the engine 4.0 package

Recorded so the next reader does not re-derive it:

- `SCREENS.md` §2 describes **Sub-View A: Today Screen** and **Sub-View B: Weekly Plan Screen** as the Routine Hub's two halves. In the code, `TodayScreen.tsx` and `WeeklyPlanView.tsx` exist but **are imported by nothing** — both are dead. The live screen is `RoutinesScreen.tsx`, which already merges both roles (day strip + list/calendar toggle + drag + generation).
- `SCREENS.md` §1 has `GoalSelector` writing to `profileStore.skinGoals`. The reconciliation doc explicitly forbids that field: *"Do not introduce `skinGoals[]`"*. The real model is `primaryGoal`/`secondaryGoal: SkinGoal`.
- `SCREENS.md` §5 sets `GamificationToggle` to **Default OFF**. This package changes it to ON — see §6.

The first two are pre-existing and are noted only so the reader does not treat that package as a description of the current app. The third is this package's own change and is specified in §6.

---

## 1. Problem

A routine step is currently one product. `RoutineStep` carries `productId`, and the screen renders a flat, layering-sorted list of product cards.

This misrepresents what a routine actually is. A step is a **process** — protect the skin, moisturise it — and a process can legitimately take more than one product:

- **Protect** — SPF cream in the morning, SPF stick reapplied at midday.
- **Moisturize** — face cream, plus eye cream, plus neck.

Because the model has no grouping level, the app treats some of these as a problem to be solved rather than a normal state. Two products sharing a `LAYERING_ORDER` index raise `DuplicateSlotWarningInline` and push the user into `DuplicateSlotResolutionSheet` to pick one — so an SPF cream and an SPF stick (both index 13), or a face cream and a neck cream (both index 11), are flagged as a conflict. The user is asked to resolve something that is not broken.

Note that this does **not** fire for a face cream and an eye cream: `eye_cream` is index 9 and `cream` is 11, so they are already separate slots today. They simply render as two unrelated rows with nothing tying them together. Both failures — false conflict on one side, no relationship on the other — come from the same missing grouping level.

Two further consequences:

1. **Layering guidance has nowhere to live.** "Apply a retinoid to dry skin", "seal hyaluronic acid straight away" — these describe the *gap between* processes. A flat product list has no gaps to hang them on.
2. **The list does not scan.** Eight undifferentiated cards read as eight equal obligations. Grouped under five process headers, the same eight cards read as five things to do — and, once completion exists, a finished process can recede as a unit (§6, `SCREENS.md` §3.3).

---

## 2. What changes, and what explicitly does not

### 2.1 Changes

Grouping is introduced **at the render layer**. `Routine.steps` stays a flat array; `RoutineStep` stays one product. A "step" as the user sees it is a **render-time group**: all `RoutineStep` records sharing a `StepAction`, which is derived through a static mapping from `ProductType`.

Grouping is by action, **not** by consecutive runs. A run-based walk would split a step whenever another action's layering index falls between two of its members — `eye_cream` is 9, `mask` is 10, `cream` is 11, so a user with a mask would see `Moisturize → Mask → Moisturize`. One group per action per period is the invariant, and bucketing by action gives it unconditionally.

This is a deliberate choice over making `StepAction` a first-class engine concept. Rationale: the engine (`src/utils/routineEngine/`, eight stages, deterministic, test-covered) already produces correctly ordered, correctly scheduled, safety-gated steps. Grouping them for display requires no engine change, no migration of persisted routines, and cannot regress generation. Promoting `StepAction` into the engine remains possible later as an isolated task.

New persisted fields, both on `Product`: `zones` and `timing` (§4).
New persisted store: completion records (§6).
New static tables: `ProductType → StepAction` (§3.2) and step transitions (§5).

### 2.2 Does not change

Named explicitly because a naive redesign breaks them, and because they carry safety weight:

| Preserved | Where it lives |
|---|---|
| Pregnancy/lactation freeze | `pregnancy.ts`, `eligibility.ts`, `RoutineContext.pregnancyRules` |
| Adaptation ramp (retinoid/AHA/BPO: 2 days/wk for first 4 applications, 4 for the next 4, uncapped after 8) | `actives.json` `adaptation.phases` |
| Seasonal and phototype frequency modifiers | `seasons.json`, `actives.json` `phototypeModifiers` |
| The 7 active pair rules and the 4 flag-disabled proposals | `actives.json` `pairRules`, `proposedPairRules.ts` |
| `frozen` / `reserve` / `placeholders` in a generated plan | `generate.ts`, `mandates.ts` |
| Decision log and explainability | `DecisionLogEntry` |
| Generation determinism (same input ⇒ byte-identical plan) | `generate.ts` |
| Layering sort | `LAYERING_ORDER`, `orderSteps` |
| `scheduledDays` semantics (0=Sun…6=Sat, `[]` = every day) | `routineSchedule.ts` |
| Store migrations | `migrations.ts` |

Any change to the above is out of scope and should be rejected in review.

---

## 3. Step vocabulary

### 3.1 The eight actions

`StepAction` is a fixed enum. Custom user-defined actions are explicitly deferred past MVP.

| Key | Label | Default position — first member's `LAYERING_ORDER` |
|---|---|---|
| `cleanse` | Cleanse | 0 |
| `exfoliate` | Exfoliate | 2 |
| `tone` | Tone | 3 |
| `treat` | Treat | 5 |
| `moisturize` | Moisturize | 9 |
| `mask` | Mask | 10 |
| `seal` | Seal | 12 |
| `protect` | Protect | 13 |

**The order is derived from the routine, not written down.** A group's position is the index of its **first member in the persisted `Routine.steps` array**. There is no hand-maintained order constant.

The array arrives from the engine already sorted by `orderSteps`, which sorts on `LAYERING_ORDER`, so for a freshly generated routine the sequence is exactly the table above. The table documents that default; it is not an input.

Deriving from the array rather than from `LAYERING_ORDER` directly is what keeps **drag working** (§7.3, `SCREENS.md` §7.1). Drag persists through `reorderSteps`, which rewrites the array — if group order were computed from the constants instead, every drag would be silently undone on the next render. Reordering a group moves all of its steps together, so the array stays partitioned by action and the invariant of one group per action survives the move.

This package restricts no action to a period. `protect` is nevertheless absent from Evening, because the engine never places an `spf` product there (§3.3). `exfoliate`, `mask` and `seal` are conventionally evening steps but are **not** constrained: if a product is scheduled in the morning, its step renders in the morning.

Naming notes, recorded so they are not "fixed" later by someone reading them as arbitrary:

- All eight are **imperative verbs, one word**. The uniform grammatical form is what lets headers stack into an even column, which is load-bearing for scannability.
- **`Exfoliate`, never `Peel`.** Tab 3 (Clinic) has a *Deep chemical peel* procedure with seasonal blocking and a 14-day spacing rule. A home acid toner and a clinic peel must not share a word, or users will read Clinic's warnings as applying to their toner.
- **`Treat`, not `Actives`.** `Actives` is an ingredient category and is already the name of a Catalog filter pill. Keeping the action a verb keeps the two concepts separate.
- **There is no separate `pre_cleanse` action.** A makeup remover and a cleanser are two products serving one process, and they group into a single `Cleanse` step — micellar water then foam, or foam alone on a day with no SPF. Their order inside the step is already carried by `LAYERING_ORDER` (0 then 1), which is exactly the "explicit product rule" case: products in a step are unordered unless a rule orders them, and here one does.

  The engine's `pre_cleanse` / `cleanser` split is a **plan-construction** concept, not a display one. `slotting.ts` keeps a makeup remover from satisfying the cleanser slot so the generator never concludes the user has a cleanser when they only own micellar water, and `pre_cleanse_requires_followup` fires from that. All of it runs at generation time and is unaffected by how the result is grouped on screen. `PreCleanseReminderCard` continues to render, now beneath the makeup-remover card **inside** the Cleanse step, which is where the reminder is actually useful.

  Promoting that slot name to a user-facing header would also break this package's own rule: `Pre-cleanse` names a **product format**, not a process. Headers carry processes.
- **`mask` lands after `moisturize`**, because `LAYERING_ORDER` puts it at 10 and the earliest moisturiser (`eye_cream`) at 9. This is correct for sleeping masks and arguably wrong for sheet masks. It is inherited from the engine's existing ordering, not invented here; changing it means changing `LAYERING_ORDER`, which is out of scope. Flagged in §10.

### 3.2 ProductType → StepAction

Static table. All 18 `ProductType` values map; there is no fallback branch at runtime.

| ProductType | StepAction |
|---|---|
| `makeup_remover` | `cleanse` |
| `cleanser` | `cleanse` |
| `peeling` | `exfoliate` |
| `toner` | `tone` |
| `essence` | `tone` |
| `ampoule` | `treat` |
| `serum` | `treat` |
| `gel` | `treat` |
| `spot_treatment` | `treat` |
| `other` | `treat` |
| `eye_cream` | `moisturize` |
| `mask` | `mask` |
| `lotion` | `moisturize` |
| `cream` | `moisturize` |
| `moisturizer` | `moisturize` |
| `oil` | `seal` |
| `balm` | `seal` |
| `spf` | `protect` |

Two mappings deserve their reasoning on the record:

- **`eye_cream` → `moisturize`, not its own action.** An eye cream is moisturising applied to a different area. Modelling the area as `zones` (§4.1) rather than as a separate process keeps the header count down and makes "face + eyes + neck" read as one job, which is what it is.
- **`other` → `treat`.** `other` is the escape hatch for products the catalog could not classify. Grouping them under Treat puts them in the middle of the routine where an unknown leave-on product most plausibly belongs, rather than at an extreme.

This table is also the source for **auto-assignment on manual add**: when the user picks a product from their shelf, the app pre-selects the step from its type, and the user may override.

### 3.3 Period filtering

**Grouping introduces no period restriction of its own.** A step renders in whichever period its products were placed in by the engine.

The single exception is `protect`, and only because the restriction already exists upstream: `periodsForProduct` in `slotting.ts` forces `spf` to AM regardless of parsed classes. Since no `spf` product can be placed in PM, no `protect` step can appear there — the filtering falls out rather than being applied.

This is deliberately narrower than an earlier draft of this spec, which also declared `exfoliate`, `mask` and `seal` to be PM-only. That would have been a **new** constraint absent from the engine, and it would silently hide products: a user with a morning exfoliant would have it placed legitimately by the engine and then dropped by the renderer, with no card and no explanation. Convention about when a step is *usually* done must not become a rule about when it *may* be shown.

---

## 4. New product fields

Both fields live on **`Product`** in the catalog store, not on `RoutineStep`.

### 4.1 `zones`

```ts
type Zone = 'face' | 'eyes' | 'neck' | 'lips' | 'hands';
zones?: Zone[];   // absent or empty ⇒ treated as ['face']
```

Multi-valued, not single. One cream applied to face, under-eyes and neck is **one card with three zone tags**, not three cards. Modelling it as a single value would force the same product to appear three times in one step, which defeats the compactness the grouping exists to create.

Edited on the product's detail screen (the shelf). Zone is intrinsic to how the user uses that product and does not vary between Morning and Evening, so it is stored once on the product rather than copied onto each `RoutineStep` that references it — two copies would drift the first time one is edited.

Rendered as a compact tag row on the card. A card with `zones` absent, empty, or exactly `['face']` renders **no tag** — the default carries no information and tagging it would add noise to every card in the app.

### 4.2 `timing`

```ts
type StepTiming = 'inline' | 'reapply';
timing?: StepTiming;             // absent ⇒ 'inline'
reapplyAfterHours?: number;      // only meaningful when timing === 'reapply'
```

- **`inline`** — applied in sequence, during the routine. Everything is this by default.
- **`reapply`** — applied later in the day, outside the routine flow. The SPF stick.

A `reapply` card:

1. is excluded from the transition calculation (§5) in both directions — it is not part of the sequence, so it neither creates nor receives a wait;
2. renders visually demoted within its step, with its interval as text ("reapply after ~2 h");
3. is still independently completable (§6), which is the point — the user marks it when they actually reapply, hours after finishing the routine.

Also stored on `Product`, edited on its detail screen.

### 4.3 Why these live on the product but days do not

`zones` and `timing` describe the product itself and are the same wherever it appears. `scheduledDays` is the opposite: the same product can be a step in both the Morning and the Evening routine with **different** days — a toner every morning but only Tuesday and Saturday at night. Moving days onto the product would silently delete that capability.

So the split is not stylistic. Days stay on `RoutineStep`, because they are a property of *this product in this routine*, and are edited from within the routine (§7.3). Zones and timing stay on `Product`, because they are a property of the product, and are edited on the shelf.

---

## 5. Transitions between steps

### 5.1 What a transition is

A transition is the gap between two adjacent rendered steps. It carries at most one short instruction, and most gaps carry none.

```ts
type StepTransition =
  | { kind: 'note'; text: 'dry_skin' | 'immediate' | 'until_dry' | 'before_sun' }
  | { kind: 'none' };
```

`kind: 'none'` renders nothing at all — no divider, no empty row. Most gaps in most routines are `none`, and this is what keeps the screen short.

**It is informational.** Nothing counts down, nothing is enforced, nothing blocks.

### 5.2 There are no numeric waits

An earlier draft of this spec carried a closed set of waits — 5, 10, 15 and 20 minutes — mapped onto acids, vitamin C and retinoids. **Those are removed.** The reasoning is on the record because the numbers are easy to reintroduce from a magazine article.

**The mechanism behind the long waits is disputed.** The familiar advice to wait 20 minutes after an acid before a retinoid rests on the claim that a lowered skin pH deactivates retinol. Paula's Choice, whose positioning depends on formulation chemistry, states plainly: *"There is no research anywhere that supports the claim that retinol is deactivated when combined with acidic ingredients"* — retinol is a solid dissolved in a carrier oil and has no pH of its own. They trace the rule to a misreading of the original research.

**Waiting for absorption is barely evidenced either.** The Euro Institute of Skincare, which does recommend a brief pause, concedes *"there aren't many (if any) studies that prove conclusively that waiting for absorption between product applications makes them more effective,"* and adds that application order matters more than timing.

**The market has no consensus.** Skin Bliss shows 20–30 seconds between steps; the Layered app publishes 10–20 minutes for the same actives. Two orders of magnitude apart. A number chosen from that range is a choice of which publication to believe, not a fact.

So the app states nothing it cannot defend. Where guidance survives, it survives on a mechanism unrelated to pH (§5.3), and it is expressed in words rather than minutes — because every one of the surviving rules is a **condition to observe**, not a duration to measure.

If a dermatologist review (§5.5) restores specific durations, the `wait` variant can be added back to the type. It is deliberately absent until then.

### 5.3 The rules

Rules have a **direction**. A rule fires either on the gap *after* the step containing the product, or on the gap *before* it.

| Active class | Direction | Transition | Mechanism |
|---|---|---|---|
| `retinoid` | before | `note dry_skin` | Application to damp skin increases irritation — nothing to do with pH |
| `benzoyl_peroxide` | after | `note until_dry` | Must dry fully; time varies with how much was applied |
| `hyaluronic_acid` | after | `note immediate` | A humectant left unsealed draws water from deeper skin |
| `spf_filters` | after (final gap) | `note before_sun` | Standard sun-protection guidance, not a layering rule |

Every key above is a literal class key in `actives.json`, verified against its `classes` block. Every other class — `aha`, `bha`, `pha`, `azelaic_acid`, `vitamin_c_pure`, `vitamin_c_derivative`, `niacinamide`, `copper_peptides`, `ceramides`, `panthenol`, `cica`, `peptide_signal`, `peptide_neuro`, `glycerin_class`, `physical_exfoliant`, `hydroquinone` — produces `none`.

Note that acids and vitamin C now carry **no** transition. They remain fully covered by `pairRules`, which separates them across periods or days when that is warranted — a real scheduling mechanism, unlike a timer the app cannot enforce.

Three entries need their reasoning recorded:

- **`spf_filters` covers chemical and mineral filters alike, and the ruleset does not distinguish them.** One class matches zinc oxide and titanium dioxide alongside avobenzone, octocrylene and the rest; there is no field separating them. A rule conditioned on "chemical SPF" would be unimplementable. Applying it to the whole class is defensible: "apply sunscreen about 15 minutes before going outside" is the generic advice — unnecessary for a mineral filter, but not wrong.
- **`spf_filters` fires on the gap after the *last* step.** The transition means "you are about to go outside", not "before your next product". It is the one case where a divider follows the final step of a routine.
- **`immediate` is a real rule, not the absence of one.** "Apply the next step right away" is guidance in its own right, which is why the type has notes rather than only presence-or-absence.

### 5.4 Resolution

For a gap between two **adjacent rendered steps** — that is, after filtering by period, weekday and paused state, so that steps hidden today are not considered — call them *N* and *N+1*:

1. Collect the `after` rules of every `inline` product in step *N*, and the `before` rules of every `inline` product in step *N+1*. `reapply` products contribute nothing.
2. If exactly one note applies, it is the transition.
3. If several apply, precedence is `dry_skin` > `until_dry` > `immediate`.
4. Otherwise `none`.

Precedence matters because the notes can contradict each other outright: a hyaluronic serum says "apply the next step right away", and a retinoid in the next step says "on dry skin". `dry_skin` wins — it is about avoiding irritation, where `immediate` is about hydration efficiency, and the costs are not symmetric. Leaving the tie unspecified would let different builds render different advice from the same routine.

### 5.5 Clinical standing

The four surviving rules are **editorial defaults for v1, not verified clinical guidance**, and they carry the same obligation as the procedure-spacing matrix in `engine 4.0/PRD_Spec.md` §5.3: **review and sign-off by a licensed dermatologist before launch.** In-app copy must read as guidance rather than medical instruction.

The review has two questions, not one:

1. Are these four correct as stated?
2. Should any numeric wait be reinstated — and if so, on what mechanism? The reviewer should be shown §5.2 so they are not simply asked to ratify the magazine numbers this package already rejected.

### 5.6 Adjacent known gap

`actives.json` declares `minRestHours: 72` on the retinoid, AHA and benzoyl peroxide adaptation phases. **No code reads it.** Nothing enforces or displays a 72-hour rest between applications.

Out of scope here — it is a between-*days* rule where this section covers between-*steps* — but it is the same category of promise, and a ruleset field that looks active while doing nothing is a trap for the next reader. It should either be implemented or removed. Tracked as a follow-up, not a blocker.

---

## 6. Completion

### 6.1 Current state

There is no completion in the app today. `RoutineStep` has no `completed` field and nothing records that a product was used on a date.

The one adjacent mechanism is `performDailyCheckIn` (`trackingActions.ts`), which increments `ProductApplicationStats.count` — but it returns immediately unless `routineCycleType === 'dynamic'`, and its only caller is `TodayScreen`, which is dead code. So in practice it never runs.

`AppSettings.gamificationEnabled` exists, is persisted, defaults to `false`, and **is read by no component**.

### 6.2 What this package specifies

Completion is **per product card**, not per step. Tapping a card toggles it.

Per-card rather than per-step because of `reapply`: the SPF stick is used hours after the rest of Protect, so a single control for the step could not represent the real state. Once completion is per card for that reason, making it per card everywhere is the consistent choice.

A record is `(productId, routineId, date)`. `period` is deliberately **not** part of the key — a `Routine` already carries `timeOfDay`, so storing the period alongside `routineId` would be a second copy of the same fact and a chance for the two to disagree.

The **day boundary is 04:00**, not midnight — matching the boundary already used by `performDailyCheckIn`, so an evening routine finished at 01:00 records against the correct day.

- Past days may be marked, by navigating the date strip backwards.
- Future days may not.

`gamificationEnabled` becomes the switch that controls whether cards are tappable at all, and its **default changes to `true`**. This supersedes `engine 4.0/SCREENS.md` §5, which specifies Default OFF. The toggle's description changes with it: it no longer governs "rewards and streaks" — there are none — but whether the user tracks what they have used.

### 6.3 Relationship to application stats

Completion records are a **new store** and must not be conflated with `ProductApplicationStats`, which feeds the engine's adaptation ramp. The ramp counts *scheduled* applications and drives safety-relevant frequency caps; completion records what the user says they *did*.

Feeding real completion into the ramp is a plausible future improvement and an obvious source of subtle safety bugs if done casually. **Out of scope.** The ramp keeps its existing input.

---

## 7. Screen behaviour

Full component detail is in `SCREENS.md`. Product-level rules only here.

### 7.1 One screen

`RoutinesScreen` remains the single Routine screen: header with a list/calendar toggle on the left and an edit toggle on the right, a Morning/Evening segmented control, a Mo–Su date strip, then the grouped step list.

`TodayScreen` and `WeeklyPlanView` are dead and are removed (`IMPLEMENTATION_PLAN.md` §5). No separate Weekly Plan screen is reintroduced: its two functions — reordering and day scheduling — are served by edit mode and by the per-card schedule control respectively.

### 7.2 Calendar view

The month calendar (`RoutineCalendarView`) is unchanged: rows are products, columns are days, two lanes per row for Morning and Evening. It answers "what is scheduled on which day", which is a per-product question, and it is a low-frequency view.

This does leave the two views on different mental models — the list is grouped by process, the calendar is a flat product matrix. Accepted for this release. Sectioning calendar rows by step is a cheap follow-up if the inconsistency proves to matter.

### 7.3 Per-card controls

Three actions, placed by frequency rather than by conceptual similarity:

| Action | Placement | Meaning |
|---|---|---|
| Schedule | icon on the card, edit mode | days of the week for this card in this period |
| Pause | icon on the card, edit mode | temporarily out of the routine; settings preserved; one tap to restore |
| Remove from routine | overflow sheet | permanent; re-adding requires reconfiguration |

Pause and Remove are genuinely different — a cream that has run out is paused, a cream the user has stopped using is removed — but as two adjacent icons they read as duplicates of each other, which is the state the current design is in. Separating them by placement rather than by iconography makes the difference legible.

Removal sits in the overflow sheet because it is the least frequent action and the only irreversible one; an irreversible action does not belong one mis-tap away from a reversible one. `RoutineStepActionSheet` already exists and already has an overflow entry point on `RoutineStepCard`.

"Pause" replaces the label "hide": the user's intent is "I am not using this right now", not "remove it from view".

### 7.4 Buttons below the list

**Add product** and **Generate routine** are always visible below the last step, in both normal and edit mode.

Add product opens the shelf picker; on selection the step is pre-assigned from §3.2 and the user may override. Placing the button outside any step is what requires that auto-assignment — otherwise the user would have to choose a step before choosing a product.

### 7.5 Empty states

Two, and they are not the same:

- **Gap** — the generator determined a step is needed and the shelf cannot fill it ("no SPF"). Produced by `mandates.ts` as a `placeholder`. Action: find one in the catalog.
- **Orphaned slot** — a product was in the routine and was deleted from the catalog; `productId` is `null`. Action: replace it, or pause it.

Plus the whole-routine empty state for a new user, which is where `GenerateCard` already lives.

---

## 8. Generation

Substantially unchanged. Recorded here because the conversation that produced this package initially assumed generation had to be designed, and it does not.

`generatePlan` (`src/utils/routineEngine/generate.ts`) is a pure, deterministic, eight-stage local pipeline. **No AI is involved**, despite `EXPO_PUBLIC_ANTHROPIC_API_KEY` appearing in `.env.example` — nothing reads it.

Already implemented and matching the intended behaviour:

- builds from the user's shelf and surfaces unfillable requirements as `placeholders`, without recommending specific SKUs;
- returns a plan the user confirms in `DraftPreviewScreen`, which is the only write path (`applyRoutinePlan`);
- lets the user choose commit scope (`both` / `am` / `pm`) at confirmation, so "which period does this generate" is already answered;
- schedules actives on an adaptation ramp rather than a fixed frequency, with seasonal and phototype caps layered on top.

Not recommending specific SKUs also keeps generation clear of the trust firewall in the business plan (§5.4): the generator arranges what the user already owns and is not a placement channel. Any future move to SKU recommendation is a separate decision with its own guarantees, not an increment of this feature.

The only generation-side work in this package is display: a `placeholder` must render as a **gap** card (§7.5) inside its step, rather than being dropped.

### 8.1 A generated routine uses only four of the eight actions

Worth stating plainly, because it will otherwise be reported as a bug against this package.

`SKELETON_SLOTS` covers `pre_cleanse`, `cleanser`, `moisturizer` and `spf`. Treatments enter by active-class ranking rather than by format. Everything else is excluded by design — `slotting.ts` says so directly: *"Types outside this map and outside the treatment ranking do not enter a generated routine at all (minimalism)."*

So **Generate routine** produces at most `Cleanse` (which may hold both a makeup remover and a cleanser), `Treat`, `Moisturize` and `Protect`. `Tone`, `Exfoliate`, `Mask` and `Seal` appear only when the user adds those products manually.

This is existing, intentional engine behaviour and is not changed here. Grouping simply makes it visible: a user who generates a routine and sees no Tone step is seeing minimalism, not a defect in the mapping.

---

## 9. Out of scope

- Custom user-defined step actions.
- Promoting `StepAction` into the routine engine.
- Feeding completion records into the adaptation ramp.
- Implementing or removing `minRestHours` (§5.6).
- SKU recommendation in generation.
- Sectioning the calendar view by step.
- Streaks, rewards, or any gamification beyond the completion toggle itself.

---

## 10. Open items before launch

1. **Dermatologist sign-off on §5.3.** Same gate as the procedure-spacing matrix.
2. **Polish labels — blocked on a localization layer that does not exist.** First market is Poland, but the app has no i18n: there is no localization library in `package.json` and user-facing strings are hardcoded constants in `src/constants/labels.ts`. Translating eight labels is therefore not an eight-word task, it is the first consumer of a localization project. Draft for when that exists: `Oczyszczanie · Eksfoliacja · Tonizowanie · Aktyw · Nawilżanie · Maska · Finisz · Ochrona`, to be checked by a native speaker — Polish beauty vocabulary has not settled the same way as English. **This package ships English labels** and does not introduce i18n.
3. **Decide `minRestHours`:** implement or delete.
4. **Review the position of `Mask`.** It falls after `Moisturize` because `LAYERING_ORDER` puts `mask` at 10 and `eye_cream` at 9. Right for sleeping masks, questionable for sheet masks. Fixing it means editing `LAYERING_ORDER`, which is an engine change and out of scope here — but the ordering is now visible as a header rather than buried in a flat list, so it will be noticed.
