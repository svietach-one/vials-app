# Routine Step Grouping — User Stories & Acceptance Criteria

**Version:** 1.0
**Companion to:** `PRD_Spec.md`, `SCREENS.md` (this package)

Story IDs continue from the `engine 4.0` package, which ends at US-33. This package uses **US-34 … US-45**.

Every story below is testable. Negative cases are marked and are as binding as the positive ones — most of them describe a regression that a naive implementation of this package would introduce.

---

### US-34 · Products grouped into process steps

**As a** user looking at my routine
**I want** my products grouped under the process they serve
**So that** I read my routine as five things to do rather than eight separate items.

**Acceptance criteria:**

- Every rendered product card sits under exactly one `StepGroupHeader`.
- The header shows an ordinal and the action label: `3. Moisturize`.
- Grouping is derived from `ProductType` via the mapping in `PRD_Spec.md` §3.2. All 18 `ProductType` values map; no runtime fallback branch is reachable.
- **Exactly one group per action per period.** Grouping is by action, not by consecutive runs.
- A group's position is the index of its **first member in the persisted `Routine.steps` array**. No hand-written order constant exists, and the position is not computed from `LAYERING_ORDER`.
- For a freshly generated routine the resulting order is `Cleanse · Exfoliate · Tone · Treat · Moisturize · Mask · Seal · Protect`, because the engine's `orderSteps` already sorted the array by `LAYERING_ORDER`.
- **Negative — drag must survive.** Group order must be readable from the persisted array, so a reorder written by `reorderSteps` is still in effect on the next render. A position derived from `LAYERING_ORDER` would silently undo every drag (US-42).
- Cards within a step retain their relative `LAYERING_ORDER` position, except `reapply` cards, which sort last (US-38).
- Grouping reads the **reclassified** product type — `reclassifyMakeupRemover` runs at read time, and grouping must use the same value the ordering does, or the two disagree.
- **Negative:** `Routine.steps` remains a flat array and `RoutineStep` still holds exactly one `productId`. No persisted-data migration is required by this story, and none is written.
- **Negative — the mask case.** A routine containing an eye cream (9), a mask (10) and a face cream (11) renders **one** Moisturize step with two cards, followed by Mask. It must not render `Moisturize → Mask → Moisturize`.
- A makeup remover and a cleanser render as **one** `Cleanse` step with two cards, ordered by `LAYERING_ORDER` (0 then 1). Two actual cleansers likewise render as one step with two cards.
- `PreCleanseReminderCard` renders beneath the makeup-remover card, inside that step.
- **Negative:** the engine's `pre_cleanse` slot must not become a user-facing header. It is a plan-construction concept; `pre_cleanse_requires_followup` runs at generation time and is unaffected by grouping.

---

### US-35 · A step holds several products without being an error

**As a** user who applies face cream, eye cream and neck cream
**I want** them to sit together under Moisturize without the app asking me to pick one
**So that** the app stops treating a normal routine as a problem.

**Acceptance criteria:**

- Multiple cards render under one header, visually separated from the next step by the vertical rhythm in `SCREENS.md` §3.
- `DuplicateSlotWarningInline` is **suppressed** when two same-slot products differ by `zones` — a face cream and a neck cream, both typed `cream`.
- It is **suppressed** when they differ by `timing` — an SPF cream and an SPF stick, both `spf`.
- It is **shown** when two `inline` products share the same slot, the same zone and the same timing.
- **Negative:** neither `DuplicateSlotResolutionSheet` nor `DuplicateSlotChoiceSheet` may open for the suppressed cases, on render or on manual add.
- **Note:** a face cream (index 11) and an eye cream (index 9) never triggered this warning — different slots. Grouping puts them under one header for the first time; there is no suppression to apply.
- **Negative:** suppression must not extend to the density rows — two products carrying the same active class still produce `density-insight` or `density-warning` per existing behaviour, whatever their zones.

---

### US-36 · Zones distinguish products within a step

**As a** user with one cream I use on face, under-eyes and neck
**I want** one card that says so
**So that** my Moisturize step does not show the same product three times.

**Acceptance criteria:**

- `zones` is a multi-select on the product's detail screen (shelf), persisted on **`Product`** in the catalog store, and optional — absent means `['face']`.
- **Negative:** `zones` must not be copied onto `RoutineStep`. One product, one stored value, read wherever it appears — two copies drift the first time one is edited.
- Tags render on the card's **meta line**, below the product name — not right-aligned, where they would compete with the status badges (`SCREENS.md` §4.2).
- A product with `zones` absent, empty, or exactly `['face']` renders **no tag**, and the meta line is omitted entirely when it would be empty.
- Zone applies to the product across every routine it appears in.
- **Negative:** selecting three zones must produce one card with three tags, never three cards.

---

### US-37 · Layering notes appear between steps, not on them

**As a** user whose routine includes a retinoid
**I want** to be told it goes on dry skin
**So that** I apply it in the way that irritates least.

**Acceptance criteria:**

- A transition renders in the gap between two steps, as a centred label with hairline rules — never as a badge on a step header.
- Only the four note kinds exist, rendered per the copy in `SCREENS.md` §5.1.
- `kind: 'none'` renders nothing — no row, no reserved space, no spacing change.
- The transition is non-interactive: no timer, no countdown, no start control.
- **Negative — no numeric waits.** `StepTransition` has no `wait` variant. Nothing in the UI may render a duration between steps. The durations an earlier draft specified (5/10/15/20 min) rested on a disputed pH mechanism and were removed; see `PRD_Spec.md` §5.2 before reintroducing any of them.
- **Negative:** a routine where no product carries a layering rule renders **zero** transition dividers.
- **Negative:** nothing renders after the last step, except the `spf_filters` case (US-39).

---

### US-38 · Reapplication is tracked separately

**As a** user who reapplies SPF at midday
**I want** the stick to sit in Protect but be marked separately
**So that** finishing my morning routine does not claim I reapplied.

**Acceptance criteria:**

- `timing: 'reapply'` is set on the product's detail screen and stored on `Product`, with an optional `reapplyAfterHours`.
- A reapply card sorts last within its step, regardless of `LAYERING_ORDER`.
- It renders at reduced contrast when uncompleted, with the annotation `reapply after ~2 h`.
- It is independently completable and takes normal completed styling when tapped.
- **Negative:** a reapply product contributes **no** transition rule in either direction — it neither creates a wait after its step nor imposes a precondition before it.
- **Negative:** a step containing an uncompleted reapply card does **not** dim its header, even when every inline card in it is completed (US-41).

---

### US-39 · Layering rules resolve deterministically

**As a** developer
**I want** one defined transition for any given gap
**So that** the same routine renders the same advice in every build.

**Acceptance criteria:**

- Resolution follows `PRD_Spec.md` §5.4 exactly: collect `after` rules from step *N* and `before` rules from step *N+1*, `inline` products only.
- Exactly one note applies ⇒ it is the transition.
- Several apply ⇒ precedence `dry_skin` > `until_dry` > `immediate`.
- `spf_filters` produces `note before_sun` on the gap **after the final step** of an AM routine, rendered as "~15 min before sun exposure".
- Exactly four classes carry a rule: `retinoid` (before, `dry_skin`), `benzoyl_peroxide` (after, `until_dry`), `hyaluronic_acid` (after, `immediate`), `spf_filters` (after, `before_sun`). Every key is verified against `actives.json` `classes` by a test.
- **Negative:** the `spf_filters` rule fires for mineral filters too. The class matches zinc oxide and titanium dioxide alongside the chemical filters and carries no field separating them, so no implementation may condition on "chemical" — there is nothing to read.
- **Negative:** every other class — including `aha`, `bha`, `pha`, `azelaic_acid`, `vitamin_c_pure` and `vitamin_c_derivative` — resolves to `none`. Acids and vitamin C deliberately carry **no** transition; they are handled by `pairRules`, which separates them across periods or days.
- **Test case:** a step holding a hyaluronic serum followed by a step holding a retinoid resolves to `on dry skin`, not `apply next right away`.

---

### US-40 · Marking products as used

**As a** user working through my routine
**I want** to tap each product as I use it
**So that** I can see what is left.

**Acceptance criteria:**

- Tapping a card toggles completion when `gamificationEnabled` is on.
- The completed card renders per `SCREENS.md` §4.6: **no fill tint**, Cabernet "Completed" badge at full contrast, thumbnail and text reduced in contrast, inner shadow replacing the drop shadow.
- The card's status badges (active, allergen, adaptation-week) **hide** while completed and return when it is un-completed — the right cluster holds one occupant at a time (`SCREENS.md` §4.2).
- The whole card is one control: `accessibilityRole="button"`, `accessibilityState={{ checked }}`, label covering brand, name, zones and completion state.
- A record is `(productId, routineId, date)` in a new store. `period` is not stored — `Routine.timeOfDay` already carries it.
- The day boundary is **04:00**, matching `performDailyCheckIn`. An evening routine completed at 01:00 records against the previous calendar day.
- Past days are completable via the date strip.
- **Negative:** future days are not completable. A tap does nothing — no error, no toast.
- **Negative:** completion records must not be written into `ProductApplicationStats`, and must not affect the adaptation ramp's frequency caps.
- **Negative:** when `gamificationEnabled` is off, cards are inert and the completed state is unreachable.

---

### US-41 · Finished steps recede

**As a** user mid-routine
**I want** completed steps to fade
**So that** my eye lands on what is next.

**Acceptance criteria:**

- When every card in a step is completed, the header renders dimmed.
- **Negative:** the header is never struck through.
- A step containing an uncompleted `reapply` card is not dimmed (US-38).
- Dimming clears when any card in the step is un-completed.

---

### US-42 · Editing a routine

**As a** user reorganising my routine
**I want** to reorder, pause, schedule and remove
**So that** the routine matches what I actually do.

**Acceptance criteria:**

- The pencil enters edit mode; the checkmark exits. Period control and date strip stay live.
- Dragging a step moves **all its cards together**, preserving their internal order, by rewriting the persisted array through `reorderSteps`.
- The new order is still in effect after a re-render, a tab switch and an app restart.
- Drag is scoped within one period. No Morning↔Evening drag.
- **Known:** a regeneration re-sorts the array through `orderSteps` and therefore discards a manual reorder for planned products. This is existing behaviour and is not changed here.
- Each card shows exactly two icons: **⏸ Pause** and **📅 Schedule**, occupying the right cluster in place of the status badges.
- Tapping the card body in edit mode opens `RoutineStepActionSheet` — this is how removal is reached, and why no third icon is needed.
- Pause sets `hidden: true`; the card moves to `PausedSteps` with settings preserved and restores in one tap.
- Schedule opens the weekday picker for that card in that period.
- **Remove from routine** appears only in the overflow sheet, with a text label and confirmation.
- **Negative:** removal never removes the product from the catalog. `catalogStore` is untouched.
- **Negative:** no trash icon appears on the card in edit mode.
- **Negative:** cards are not completable while in edit mode.

---

### US-43 · Scheduling stays per product per period

**As a** user who tones every morning but only twice a week at night
**I want** separate schedules for the same product in each routine
**So that** my plan reflects reality.

**Acceptance criteria:**

- `scheduledDays` remains on `RoutineStep`, so the same product can hold different days in the Morning and Evening routines.
- Existing semantics hold: 0=Sun…6=Sat, `[]` = every day; deselecting one chip from every-day expands to the other six; selecting all seven collapses to `[]`.
- The picker is reached from the card's Schedule icon in edit mode.
- A step renders only when at least one of its cards is scheduled for the selected day.
- Ordinals number the **rendered** steps, always 1, 2, 3, … with no gaps (`SCREENS.md` §3.1).
- **Negative:** `zones` and `timing` are **not** editable from this picker — they live on the product's detail screen.
- **Negative:** moving `scheduledDays` onto the product record is a defect, not a simplification: it destroys per-period scheduling.

---

### US-44 · Two different empty states

**As a** user with an incomplete routine
**I want** to know whether I never had a product or lost one
**So that** I know what to do about it.

**Acceptance criteria:**

- A generator `placeholder` renders as a **gap card**: Cobalt, copy naming the missing thing (*"No SPF in your shelf"*), single action `Find in catalog`.
- A `productId: null` step renders as an **orphaned slot**: neutral, *"Product removed"*, with `Add from catalog` and `Pause`.
- An empty routine renders `GenerateCard`.
- **Negative:** the two states must not share a component or copy string. They differ in cause, action and register.

---

### US-45 · Generation is unchanged

**As a** user generating a routine
**I want** the existing behaviour preserved
**So that** the redesign does not weaken the safety logic.

**Acceptance criteria:**

- `generatePlan` remains pure and deterministic: identical input produces a byte-identical plan.
- `DraftPreviewScreen` remains the only path to `applyRoutinePlan`, and the user still chooses commit scope (`both` / `am` / `pm`).
- `placeholders` render as gap cards inside their step (US-44) rather than being dropped.
- `Add product` and `Generate routine` are visible below the list in both modes.
- On manual add, the step is pre-assigned from `ProductType` and the user may override.
- A generated routine yields at most `Cleanse`, `Treat`, `Moisturize` and `Protect`. `Tone`, `Exfoliate`, `Mask` and `Seal` appear only via manual add — this is existing `SKELETON_SLOTS` minimalism, not a mapping defect.
- **Negative:** `pre_cleanse_requires_followup` still fires as before. Grouping the remover and the cleanser under one header must not suppress it.
- **Negative — regression suite.** The following must be unchanged by this package, and each needs a test that fails if it is not:
  - pregnancy/lactation freeze (`reasonCode: 'pregnancy_blocked'`)
  - adaptation ramp: 2 days/week for the first 4 applications of retinoid / AHA / BPO, 4 for applications 5–8, uncapped after 8
  - seasonal cap: strong exfoliants at 1 day/week in summer
  - phototype cap: exfoliants at 1 day/week for Fitzpatrick 4–6
  - all 7 active pair rules, and the 4 proposals staying disabled behind `PROPOSED_V12_PAIR_RULES_ENABLED`
  - `frozen`, `reserve` and `placeholders` populated as before
  - decision log entries unchanged
  - the no-op guarantee: a user with no conditions and no goals selected gets byte-identical engine output
- **Negative:** no new npm or Expo dependency is introduced.
- **Negative:** generation must not recommend specific SKUs. It arranges the user's own shelf and names gaps generically.

---

## Cross-cutting test matrix

Cases that span stories and are easy to miss:

| Scenario | Expected |
|---|---|
| Routine with no layering-rule products | Zero transition dividers |
| Cleanse → retinoid in Treat | `on dry skin` between Cleanse and Treat |
| Retinoid in Treat, moisturiser after | **No** divider after Treat — the retinoid rule fires before it, not after |
| Acid toner in Tone, serum after | **No** divider — acids carry no transition |
| Pure vitamin C in Treat, moisturiser after | **No** divider |
| Hyaluronic serum, then a retinoid step | `on dry skin` — precedence beats `apply next right away` |
| Hyaluronic serum, then a moisturiser | `apply next right away` |
| BPO in Treat, moisturiser after | `until fully dry` |
| AM ending in any SPF, chemical or mineral | `~15 min before sun exposure` after the final step |
| Protect = SPF cream + SPF stick | One step, two cards, no duplicate warning, stick last and at reduced contrast |
| Moisturize = face + eye + neck | One step, three cards, zone tags, no duplicate warning |
| One cream tagged face + eyes + neck | **One** card, tags on the meta line, no meta line duplication |
| Completed card that also has an allergen badge | Only "Completed" in the right cluster; badge returns on un-complete |
| Product with a very long name | One line, tail-truncated; card height unchanged |
| Card with no zones and no reapply | Two-line text column, no meta line |
| Two face serums, both inline, same slot | Duplicate warning **shown** |
| All cards done except an uncompleted reapply | Header **not** dimmed |
| Evening routine completed at 01:00 | Recorded against the previous calendar day |
| Future day selected | Cards inert, no error |
| Step whose only product is unscheduled today | Step absent; remaining steps renumber 1, 2, 3 |
| Product deleted from catalog | Orphaned slot, not a gap card |
| `gamificationEnabled` off | No tap targets, no completed state |
| Evening period | No `protect` step — no `spf` product can be placed in PM |
| Morning period, morning exfoliant | `Exfoliate` step **renders** — no period restriction on it |
| Eye cream + mask + face cream | One `Moisturize` (2 cards), then `Mask` |
| Makeup remover + cleanser | One `Cleanse` step, two cards, remover first, reminder card beneath it |
| Two gel cleansers | One `Cleanse` step, two cards |
| Micellar water only, no cleanser | One `Cleanse` step, one card, `PreCleanseReminderCard` present |
| Freshly generated routine | Only skeleton actions present; no `Tone` step despite owning a toner |
