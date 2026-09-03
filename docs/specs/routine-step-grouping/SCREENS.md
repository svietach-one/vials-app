# Routine Step Grouping — Screen & Component Specification

**Version:** 1.0
**Companion to:** `PRD_Spec.md` (this package)
**Scope:** the Routine screen only. Catalog, Clinic, Profile and onboarding are untouched except where noted in §8.

---

## 1. Design system compliance

Existing rules from `engine 4.0/SCREENS.md` carry over unchanged: black primary buttons (`#09090B`), black outline secondaries, and the Apothecary accent system reserved for badges, status tags, boundaries and chart metrics.

One entry in the colour map needs rewording. It currently reads:

> 🍷 **Cabernet:** … and the completed-checkbox fill state.

There is no checkbox in this design. It becomes:

> 🍷 **Cabernet:** active routine indicators, hard restrictions and blocks (acute rehab states, seasonal procedure blocking), and the **completed-card badge**.

The semantic split is unchanged — Amber cautions, Cabernet restricts or marks done, Green reassures, Cobalt informs.

New surfaces introduced by this package and their colours:

| Surface | Colour | Why |
|---|---|---|
| Completed badge on a card | Cabernet | Same "done" meaning the checkbox carried |
| Transition divider | Muted neutral, no accent | Advisory, not a caution. An accent here would compete with real conflict warnings |
| Gap card ("no SPF") | Cobalt | Informational — the app is telling the user something, not warning them |
| Zone tag | Muted neutral | Structural metadata, not a status |
| Reapply annotation | Muted neutral | Structural metadata |

The transition divider deliberately gets **no accent colour**. Amber already means "ingredient conflict" on this screen, and a routine with two layering notes and one real conflict must not present three things that look equally alarming.

---

## 2. Screen anatomy

`RoutinesScreen` — one screen, no sub-views.

```
┌─────────────────────────────────────────┐
│  [calendar]        Routine       [edit] │   header
├─────────────────────────────────────────┤
│    ☀ Morning    │    🌙 Evening         │   period control
│  Mo  Tu  We  Th  Fr  Sa  Su             │   date strip
│  20  21  22  23  24  25  26             │
├─────────────────────────────────────────┤
│  banners (conditional)                  │
├─────────────────────────────────────────┤
│  1. Cleanse                             │   step header
│  ┌───────────────────────────────────┐  │
│  │ ▣  Brand name                     │  │   product card
│  │    Name                           │  │
│  └───────────────────────────────────┘  │
│                                         │
│  2. Treat                               │
│  ┌───────────────────────────────────┐  │
│  │ ▣  Brand name                     │  │
│  │    Name                           │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ─────────  on dry skin  ─────────      │   transition
│                                         │
│  3. Moisturize                          │
│  ┌───────────────────────────────────┐  │
│  │ ▣  Brand name          [Eyes]     │  │
│  │    Name                           │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │ ▣  Brand name          [Neck]     │  │
│  │    Name                           │  │
│  └───────────────────────────────────┘  │
├─────────────────────────────────────────┤
│   + Add product   ·   Generate routine  │
└─────────────────────────────────────────┘
```

### 2.1 Header

- **Left — view toggle.** Calendar icon in list view, list icon in calendar view. Swaps `RoutineViewMode` between `'list'` and `'calendar'`. The icon shows the destination, not the current state.
- **Centre — title** "Routine".
- **Right — edit toggle.** Pencil in normal mode, checkmark-in-box in edit mode.

Edit mode is a mode of the same screen, not a navigation push. The period control and date strip stay live in edit mode; the user edits the day they are looking at.

### 2.2 Period control and date strip

`PillToggle` for Morning / Evening (Cabernet fill on the active side) and the Mo–Su strip with the selected day in a Cabernet circle. Both already exist in `PlannerBlock`.

Selecting a day filters the list to steps scheduled on that weekday via `isScheduledOnDay`. Past days are selectable and completable; future days are selectable and **not** completable (§4.4).

### 2.3 Banners

Unchanged, in existing order, above the step list: rehab notices, seasonal notice, SPF adequacy, goal coverage, pregnancy advisory, duplicate-slot warnings (§6.4), density insights.

---

## 3. `StepGroupHeader`

A new component. One per rendered step.

**Content:** ordinal number, then the action label. `3. Moisturize`.

**Separation from cards.** The header is not a card. It sits on the screen background with no container, no border, no shadow — the cards below it carry all of those. This contrast *is* the grouping signal, and it is the reason no divider line or container is needed around the group.

Vertical rhythm carries the grouping just as much as the header does. Use the existing semantic tokens from `src/constants/tokens.ts` — no new spacing values:

| Gap | Token | Value |
|---|---|---|
| Header → its first card | `space.gapInline` | 8 |
| Card → card inside a step | `space.gapStack` | 12 |
| Last card of a step → next header | `space.gapSection` | 32 |

The step gap is roughly 2.7× the within-step gap. That ratio is the grouping signal: a reader who never reads a word should still see the groups. If the three values are set close together, grouping fails regardless of typography, so these are requirements rather than styling preferences.

When a transition divider (§5) falls between two steps, it replaces the 32 with `space.gapCard` (16) above and below it, so the divider sits centred in a gap of comparable total height rather than adding to it.

### 3.1 Numbering

Ordinals are assigned over **rendered** steps only, after filtering by weekday, period and paused state. They always run 1, 2, 3, … with no gaps.

A user who sees `1, 3, 4` will believe something is missing or broken. The stable-identifier argument does not apply — the number is a reading aid for today's list, not an identity.

### 3.2 One header per action

There is exactly one header per action per period. A step is every card of that action, not a consecutive run of them, so `Moisturize` holds the eye cream and the face cream even though `mask` sits between them in `LAYERING_ORDER`. See `PRD_Spec.md` §2.1.

A makeup remover and a cleanser share the `Cleanse` header — one process, one or two products, ordered inside the step by `LAYERING_ORDER`. `PreCleanseReminderCard` renders beneath the makeup-remover card within that step. The engine's separate `pre_cleanse` slot is a plan-construction concept and does not surface as a header (`PRD_Spec.md` §3.1).

### 3.3 States

| State | Rendering |
|---|---|
| Default | Full-contrast label and number |
| All cards completed | **Dimmed** — reduced contrast, no strikethrough |
| Contains a conflict | Conflict row mounts directly beneath the header, above the cards |
| Edit mode | Drag affordance appears; label unchanged |

Dimming rather than striking through: strikethrough reads as "deleted" or "invalid" rather than "done", and it damages legibility of a header that carries the step's number and name. Dimming also does useful work — finished steps recede and the eye lands on the first unfinished one, which is the whole daily interaction.

A `reapply` card does not count toward "all completed" for dimming purposes until it is itself completed. A Protect step whose cream is done but whose stick is not stays at full contrast, which is correct: there is still something to do.

---

## 4. `RoutineProductCard`

Replaces `RoutineStepCard`. Same data source; new anatomy, new states.

### 4.1 Anatomy

Three regions, left to right. Every state in §4.5–4.10 is a change to one of them — no state introduces a fourth region.

```
┌────────────────────────────────────────────────┐
│  ┌──────┐   Brand name                         │
│  │ img  │   Product name              ⟨ C ⟩    │
│  └──────┘   Eyes · reapply after ~2 h          │
└────────────────────────────────────────────────┘
   A            B                          C
```

**A — thumbnail.** Fixed square, product image or a neutral placeholder.

**B — text column.** Three lines, the third conditional:

1. brand, secondary
2. product name, primary
3. **meta line** — zone tags, then the reapply annotation. Rendered only when at least one is present.

**C — right cluster.** Holds exactly one occupant at a time; §4.2 fixes which.

### 4.2 The right cluster holds one thing

Five different elements want the right edge — the completed badge, the existing status badges, zone tags, and two edit-mode icons. Letting them coexist is what makes a compact card fall apart, so the slot has a strict priority and everything else moves or hides:

| Condition | Occupant |
|---|---|
| Edit mode | ⏸ Pause and 📅 Schedule icons |
| Completed | "Completed" badge, alone |
| Otherwise | existing status badges — active, allergen, adaptation-week |

Two consequences worth stating outright, because they change earlier drafts of this document:

**Zone tags move out of the right cluster into the meta line (B3).** An earlier draft had them right-aligned, which put them in direct competition with the badges that carry safety weight. Zone is not a status — it says *what this product is for*, which belongs with the product's identity, not with its state.

**A completed card hides its status badges.** They are not actionable once the product has been used today, and "Completed" has to be unambiguous. The badges return when the card is un-completed, and they remain visible on the Catalog card throughout, so nothing is lost.

### 4.3 Geometry

All values from `src/constants/tokens.ts`. Nothing hardcoded.

| Element | Token |
|---|---|
| Card background | `color.surfaceCard` |
| Card radius | `radius.lg` (16) |
| Card shadow, resting | `shadow.sm` |
| Card padding | `space[3]` (12) |
| Thumbnail | 48 × 48 (`space[12]`), `radius.md` (12) |
| Thumbnail → text gap | `space[3]` (12) |
| Text → right cluster gap | `space[2]` (8), minimum |
| Brand | `typography.caption`, `color.textSecondary` |
| Product name | `typography.body`, `color.textPrimary` |
| Meta line | `typography.caption`, `color.textTertiary` |
| Border | none |

**No border.** The card is defined by fill and shadow only — `shadow.sm` against `color.bgSubtle` is what separates it from the page, and adding a border on top makes the list read as a table.

Brand and product name are each **one line, tail-truncated**. Skincare names are long and a wrapping name would break the card rhythm that the grouping depends on.

### 4.4 Interaction

- **Normal mode:** tapping the card toggles completion (§4.6), when `gamificationEnabled` is on and the selected date is not in the future.
- **Edit mode:** tapping the card opens `RoutineStepActionSheet` — where "Remove from routine" lives. Completion is disabled in edit mode, so the tap is free, and this is why the right cluster needs only two icons rather than a third for overflow.
- **Drag** is initiated from the step header, not the card. Groups move as a unit (§7.1), so a per-card handle would imply the cards move independently.
- Every tap target is at least `space.hitMin` (44).

**Accessibility.** The card is a single control: `accessibilityRole="button"`, `accessibilityState={{ checked }}` reflecting completion, and a label combining brand, product name, zones and completion state — the zone tags and the completed badge are visual, and a screen reader user must get both. The two edit-mode icons are separate controls with their own labels.

### 4.5 Default state

Full contrast, `shadow.sm`.

### 4.6 Completed state

Triggered by tapping the card when `gamificationEnabled` is on.

- **No fill tint.** The card does not turn pink or Cabernet.
- **Badge** "Completed" in Cabernet, at full contrast — the one element that must stay legible.
- **Thumbnail and text drop in contrast** — text to `color.textSecondary`, thumbnail to reduced opacity.
- **Status badges hide** (§4.2).
- **Inner shadow** replaces the resting drop shadow, so the card reads as pressed in.

The inner shadow is what makes this state feel physical rather than merely faded — a faded card alone reads as "disabled" or "unavailable", which is close to the opposite of "done". Pressed-in plus a full-contrast badge reads as "handled".

Tapping again clears it.

#### Implementing the inner shadow

**React Native has no inner shadow.** The `shadow` tokens are RN shadow props — `shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius` on iOS, `elevation` on Android — and every one draws *outside* the view. A negative offset does not invert it. An implementer who tries to express this state through the shadow tokens will not get there.

Do it with `react-native-svg`, already a dependency (`15.12.1`) — no new package, so the constraint in `IMPLEMENTATION_PLAN.md` holds:

- drop the resting drop shadow (`shadow.none`) — the card must not have both;
- overlay an absolutely-positioned `<Svg>` filling the card, `pointerEvents="none"`;
- inside it, a `<Rect>` with `rx` equal to `radius.lg`, filled by a vertical `<LinearGradient>`: black at roughly 10% opacity at the top edge, fading to transparent by about a quarter of the card's height;
- add a hairline border at roughly 6% black to close the illusion at the edges.

The gradient rectangle must carry the same `rx` as the card, or the overlay squares off the corners.

`expo-linear-gradient` is **not** in the project and must not be added for this.

When `gamificationEnabled` is off, cards are not tappable and this state never occurs.

### 4.7 Zone tags

Rendered on the meta line (B3) when `zones` is present, non-empty, and not exactly `['face']`. Neutral, `typography.caption`, separated by `·`: `Eyes · Neck`.

The `face`-only default renders nothing. Tagging every card "Face" would put a tag on nearly every card in the app while carrying no information.

### 4.8 Reapply state

A card with `timing: 'reapply'`:

- sits **last** within its step regardless of layering order;
- renders at reduced contrast in its default (uncompleted) state, distinguishing it from inline cards without hiding it;
- carries `reapply after ~2 h` on the meta line, from `reapplyAfterHours`, after any zone tags;
- is independently tappable, and when completed takes the normal completed styling at full badge contrast.

### 4.9 Future-day state

When the selected date is in the future, cards render at default contrast but are **not tappable**. No error, no toast — a tap does nothing.

### 4.10 Paused state

A paused card (`hidden: true`) does not render in the main list. It appears in the `PausedSteps` section below the step list, as today, with a one-tap restore.

---


## 5. `StepTransition`

A new component. Rendered in the gap **between** two steps, and after the final step only for the `spf_filters` case (`PRD_Spec.md` §5.3).

```
   ────────────  on dry skin  ────────────
```

Centred label, hairline rules extending to either side, muted neutral, small type. Not a pill, not a badge, not attached to either step.

The form is the message. A badge belongs to an object; a divider belongs to the space between objects. Rendering this as a pill on the step header — the earlier draft — made it read as a property of the step, which is a different and wrong claim, and left no place for the note that follows the last step.

### 5.1 Copy by kind

| `kind` | Rendering |
|---|---|
| `note: dry_skin` | `on dry skin` |
| `note: immediate` | `apply next right away` |
| `note: until_dry` | `until fully dry` |
| `note: before_sun` | `~15 min before sun exposure` — fires for any `spf_filters` product; the ruleset does not distinguish chemical from mineral |
| `none` | **nothing rendered** — no row, no spacing change |

There is no numeric `wait` kind. `PRD_Spec.md` §5.2 has the evidence; the short version is that the durations an earlier draft carried rested on a disputed pH mechanism, and the app does not state numbers it cannot defend.

`before_sun` is the one surviving figure, and its `~` marks it as advisory. It is also not a layering instruction — it is about going outside, which is why it renders only after the final step.

### 5.2 Non-interactive

The divider is not tappable in v1 and has no timer, no start button, no progress. If explanation proves necessary later ("why am I waiting?"), the natural extension is a tap revealing the responsible product — but it is not in this release, and adding a control here would imply enforcement the feature does not have.

---

## 6. Step-level states

### 6.1 Gap card

Rendered inside a step when the generator produced a `placeholder` for it — the step is needed and the shelf cannot fill it.

Cobalt-accented, dashed or otherwise clearly distinct from a product card. Copy names the missing thing: *"No SPF in your shelf"*. Single action: `Find in catalog`.

### 6.2 Orphaned slot

Rendered when `productId` is `null` — the product existed and was deleted from the catalog.

Neutral, not Cobalt. Copy: *"Product removed"*. Two actions: `Add from catalog` (outline button) and `Pause` (text link) — the same vocabulary as the card control in §7.2, not the old "hide".

These two states must not be merged. A gap says "you never had one"; an orphan says "you had one and it is gone". The user's next action differs, and so does the emotional register — one is a suggestion, the other is a repair.

### 6.3 Empty routine

No steps at all: `GenerateCard` as today — *"Build your routine"* with `Generate Routine` (primary) and `Add Products Manually` (secondary).

### 6.4 Conflict row

`ConflictWarningInline` mounts **directly beneath the header of the step containing the conflicting product**, above that step's cards.

Beneath the header rather than at the bottom of the period column, because with grouping the user can now see which process the conflict belongs to, and proximity is what makes that useful.

All four existing row kinds are preserved unchanged: `conflict` (Amber), `condition-advisory` (Amber), `density-insight` (Cobalt), `density-warning` (Amber). None blocks saving.

### 6.5 Duplicate slot — behaviour change

Today, two products in one layering slot raise `DuplicateSlotWarningInline` and route the user to `DuplicateSlotResolutionSheet` to choose between them. Under this design, several products in one step is the normal case, and that flow must not fire for it.

The warning is suppressed when the products are distinguishable by intent:

| Case | Warning |
|---|---|
| Different `zones` — face cream and neck cream, both typed `cream` (index 11) | **suppressed** |
| Different `timing` — SPF cream and SPF stick, both `spf` (index 13) | **suppressed** |
| Same zone, same timing, both `inline` — two face serums (index 6) | **shown** |

The third row is the case the machinery was built for — two products doing the same job on the same skin at the same moment — and it stays.

The examples are deliberately same-index pairs, because that is the only situation in which the warning fires at all. A face cream (11) and an eye cream (9) occupy different slots and never triggered it; grouping puts them under one header for the first time, but there is no warning there to suppress.

Same-class duplication (two retinoids) is separately out of scope for `conflictEngine` v1 and is handled by density rows, not here.

---

## 7. Edit mode

Entered by the pencil, exited by the checkmark. Cards are not completable in edit mode.

### 7.1 Step level

- **Drag** to reorder. Existing `NestableDraggableFlatList` and `reorderSteps`, now operating on groups rather than individual cards. Dragging a step moves all its cards together, rewriting the persisted `Routine.steps` array — which is also the array group order is read from, so the reorder survives the next render (`PRD_Spec.md` §3.1). Scoped within one period; no Morning↔Evening drag.
- **Add step** available from the bottom-of-list controls.

### 7.2 Card level

Two icons on each card:

| Icon | Action |
|---|---|
| ⏸ Pause | Sets `hidden: true`. Card moves to `PausedSteps`. Settings preserved. |
| 📅 Schedule | Opens the weekday picker for this card in this period. |

These two occupy the card's right cluster in edit mode, replacing the status badges (§4.2).

**Remove from routine is not an icon.** It lives in the overflow sheet (`RoutineStepActionSheet`) with a text label and a confirmation, reached by **tapping the card body** — which is inert in edit mode, since completion is disabled there. That is what keeps the right cluster to two icons instead of three; three 44pt targets do not fit beside a truncated product name.

Icon slots go to the frequent, reversible actions. Removal is the least frequent and the only irreversible one, and it should not sit one mis-tap from Pause — which is precisely the ambiguity the current two-icon design creates, since both visually amount to "make this go away".

### 7.3 Schedule picker

The existing `WeeklySchedulePicker` in a sheet: Mo–Su chips, empty selection meaning every day, deselecting one chip from every-day mode expanding to the other six, selecting all seven collapsing back to `[]`.

`RoutineSchedulerSheet` already implements this and is currently dead code. It should be revived rather than rebuilt.

### 7.4 Overflow sheet

`RoutineStepActionSheet`, reached from the card's overflow control in normal mode and by tapping the card body in edit mode:

- Open in shelf — navigates to product detail, where `zones` and `timing` are edited
- Replace product
- Remove from routine — destructive styling, confirmation

---

## 8. Bottom controls

Below the last step, above the tab bar, in **both** modes:

```
   + Add product          Generate routine
```

- **Add product** — outline secondary. Opens `AddToRoutineSheet`'s picker. On selection, the step is pre-assigned from `PRD_Spec.md` §3.2 and shown as an editable field.
- **Generate routine** — outline secondary in normal mode. Opens `DraftPreviewScreen`. Never writes directly; the preview's own commit controls do, with scope selection.

Both stay visible when the routine is populated. `OptimizeStrip`'s current role — highlighting when an avoid-level validation finding exists — folds into the Generate button's state rather than occupying a separate strip.

---

## 9. Changes outside the Routine screen

Minimal, listed for completeness:

- **Product detail (shelf)** gains `zones` (multi-select) and `timing` (inline / reapply, with hours when reapply). Both persist on `Product`; nothing is written through to `RoutineStep`.
- **Profile → `GamificationToggle`** default flips to ON and its description changes from rewards-and-streaks to tracking what has been used.
- **Colour map** entry reworded (§1).

`HiddenStepsManager` is specified in `engine 4.0/SCREENS.md` as living in the Clinic tab footer, which is the wrong home for a routine concern. Paused cards now surface in `PausedSteps` on the Routine screen itself. The Clinic footer entry is removed.
