# Vials — Intermediate Routine (toner, eye cream, enzyme exfoliant, nothing silent)
Date: 2026-10-14 (revised 2026-10-15)
Author: planner-agent
Jira: N/A (kebab-case task slug per agent-layer-protocol.md: `intermediate-routine`)
Status: APPROVED (product owner, 2026-10-15: "одобряю спеку")

## AI-SDLC Flags
```
backend_layer:  false
frontend_layer: true
infra_changes:  false
```

## Revision 2026-10-15 — one routine, no style

The product owner removed the routine-style concept. Her words (Russian originals; relayed to the planner by the
coordinating session; the planner cannot verify them itself, so she confirms them by reviewing this diff):

- "если честно непонятно зачем этот переключатель вообще, давай сделаем только один режим, который вот этот
  максимальный" — the switch has no purpose; ship ONE mode, the fuller one.
- "юзер сам уберет лишнее если ему не нужно" — the user removes anything extra herself.
- Answering "is a removed step resurrected?": "давай юзер уберет шаг в режиме редактирования; так он не сделает это
  случайно, но после перегенерации рутины мы снова ему его покажем" — removal only in edit mode; after the routine
  is regenerated the step is shown again.
- On the calendar view: "но это не очевидно — если мы даем редактировать в режиме календаря, давай как-то
  подсвечивать то что это возможно, например добавь подпись типа 'нажмите на средство и отредактируйте' и сам блок
  со средствами как-то подсветить что ли" — editing from the calendar must be discoverable: a caption and a highlight
  on the product column (Story 7).

Later the same day the owner answered the review questions; the coordinator relayed them as decisions without
verbatim text: gap-card dismissal option B (Q5), the left-out rule (Q6), the calendar gate (Q7) and owned-only
engine input (Q8), all in §10.

Removed from this spec: the style setting, engine input, Draft Preview control and reason code; goal G6 (the minimal
style equals today's engine) and the non-superset material (there is nothing to switch from, no release, no users);
decision Q4a (§10). Story numbers changed: old 2→1, 3→2, 4→3, 5→4, 6→8; the old Story 1 is gone; Stories 5, 6 and 7
are new.

## 1. Problem Statement

Users currently cannot get a routine that contains the toner or eye cream they own. The routine engine builds a
deliberately minimal routine — cleanse, moisturise, SPF, plus at most one treatment — and files every other leave-on
product (toner, eye cream, essence, oil, ampoule) into an internal "reserve". The saved Routines screen never shows
that reserve (only the Draft Preview does, collapsed), so these products silently disappear after the first save.
Nothing tells the user that a toner or eye-cream step is missing from her routine, and the engine has no concept of an
enzyme exfoliant, so an enzyme powder is invisible to it. A professional cosmetologist's routine (a consultation memo
for a 35-year-old woman was analysed for this task) adds toner and eye cream morning and evening and a gentle
exfoliation two to three times a week. The engine already agrees with the rest of that memo (double cleanse, separate
makeup remover, vitamin C in the morning, daily SPF, base cream AM+PM, one new product at a time). This spec makes the
engine always build that fuller routine — only its structural, non-personal part — and makes every gap and every
left-out product visible instead of silent. There is no style to choose: the user trims what she does not want
(Stories 5–7).

## 2. Goals

- G1. One routine. The engine always builds the fuller routine; no routine-style setting, control or copy exists.
- G2. On the reference shelf R9 (§4) the engine yields Morning = foam cleanser, toner, eye cream, cream, SPF and
  Evening = micellar water, foam cleanser, toner, eye cream, cream.
- G3. Whenever the routine calls for a step the shelf cannot fill (toner, eye cream), the Routines screen shows a gap
  card for that step and period, unless the user waved that optional card off with "Not for me" (hidden until the
  next save of that period, Story 6). At most 5 gap cards appear in any single period view.
- G4. Enzyme exfoliants are recognised as their own active class and scheduled as one morning step on at most 3 days
  a week, inheriting every existing exfoliant safety net.
- G5. 100% of owned shelf products that are not hidden on the shelf are accounted for on the Routines screen: each is
  either a saved, non-hidden routine step or a row in a new "Not in your routine" list that states why. Verified by a
  property test.
- G6. Trimming works and can be found (Stories 5 and 7): a step is removed only in edit mode, in the list and in the
  calendar; nothing re-adds it except a Draft Preview save or a manual add. Gap cards never depend on saved steps.
- G7. The engine, the live gap cards and the Draft Preview see the same input: owned products only.
- G8. Determinism, Phase 9 explainability and pair-rule safety hold.

## 3. Non-Goals (explicitly out of scope)

- **Any routine-style switch, setting or tier**, including a second or third routine (owner, 2026-10-15).
- **Personal particulars of the reference consultation**: niacinamide pinned to the evening (sebum control suits oily
  skin, not everyone), the 35-year-old profile, "10–20 minutes between serum and cream" timing, eye cream applied
  after SPF, any brand or product named in the memo, any age-specific advice.
- **Re-ordering layers.** `LAYERING_ORDER` is unchanged, so eye cream renders before the moisturiser.
- **More routine slots.** Essence, ampoule, oil, mask, spot treatment and non-enzyme peelings stay in reserve (visible
  in the new list; "Add" forces them in via the existing override).
- **A gap card for a missing exfoliant.** Exfoliation depends on skin state (barrier repair, recovery after a
  procedure, tone and season limits), so it is placed when owned and never prompts a purchase (§10 Q2).
- **Remembering that the user removed a step.** No dismissed-steps store, no tombstones: regeneration shows removed
  and hidden steps again (owner, 2026-10-15). The gap-card dismissal of Story 6 is a different thing: it hides a
  prompt, never records a step or a product, and expires at the next save.
- **Dismissing any other card.** Cleanser, moisturiser and SPF cards, the pre-cleanse follow-up card and mandate cards
  have no dismissal, nor is there a permanent "never remind me" or an undo surface (the card returns at the next save).
- **Changing removal outside the Routines screen**: the shelf card's and product detail's "Remove from routine", the
  duplicate-slot sheet, the delete-product cascade and the orphaned-step "Pause" keep today's behaviour.
- **A Profile-screen setting row**, Today-screen changes, a calendar-view redesign (only its remove/hide gate, a
  caption and a highlight on the product column change).
- **Migration or backward compatibility.** There is no release and there are no existing users.
- **New pair rules, pregnancy rules or skin-condition gating for enzymes**, and any change to how pair rules treat
  rinse-off products.
- **Listing products hidden on the shelf** (the shelf's "Hide product" toggle) in the new list.

## 4. User Stories

Reference shelves, all products `usageTime: both`, goal `maintenance`, no procedures, season spring:
**R9** = foam cleanser, micellar water, cream, SPF, toner, eye cream, essence, oil, ampoule.
**S3** = cleanser, cream, SPF. **E4** = S3 + an enzyme powder typed "cleanser" and tagged as an enzyme exfoliant (or
listing papain/bromelain early in its ingredients). "Shelf product" below means an owned product (not a wishlist
product) that is not hidden on the shelf.

### Story 1: My toner and eye cream are in my routine
As a user, I want my toner and eye cream in my routine, morning and evening, so that nothing I own is skipped.

**Acceptance Criteria:**
- [ ] Given R9, when a draft is generated, then Morning = foam cleanser, toner, eye cream, cream, SPF; Evening =
  micellar water, foam cleanser, toner, eye cream, cream; reserve = essence, oil, ampoule; no gap cards.
- [ ] Given a toner whose usage is "evening only", when generated, then it appears in Evening only.
- [ ] Given two toners, when generated, then one is scheduled per period and the other is offered as a swap
  ("Change") in the Draft Preview — never both in one period, and a swap never offers the scheduled product.
- [ ] Given a toner that carries a strong acid, then it is handled as a treatment exactly as today and does not count
  as the toner step.
- [ ] Given a shelf whose only "moisturiser" is an eye cream, then the moisturiser gap card still shows (an eye cream
  never fills the moisturiser slot).

### Story 2: I am told when a step is missing (not silent)
As a user, I want a visible prompt for a step my shelf cannot fill so that I know what to add.

**Acceptance Criteria:**
- [ ] Given a saved routine and shelf S3, when the user views Morning, then gap cards read "No Toner in your morning
  routine" and "No Eye Cream in your morning routine", and Evening shows "No Toner in your evening routine" and "No Eye
  Cream in your evening routine".
- [ ] Given those gap cards, when the user adds a toner to the shelf, then both toner gap cards disappear and the
  toner shows in "Not in your routine" as "Ready to add".
- [ ] Given a toner that is evening-only and no morning toner, then only the morning toner gap card shows.
- [ ] Given any shelf, then no single period view shows more than 5 gap cards.
- [ ] Given no saved routine, then the Generate card shows and no gap card does (existing behaviour).
- [ ] Given a wishlist toner and no owned toner, then the toner gap cards still show, and the wishlist toner is neither
  in the Draft Preview nor in "Not in your routine" (live cards, draft and list use one owned-only input).
- [ ] Given edit mode on, then a gap card is not a step: it has no Remove, Hide, Pause, Schedule or drag control and
  offers the same actions as with edit mode off.

### Story 3: Enzyme exfoliant as a morning step, a few days a week
As a user with an enzyme exfoliant, I want it scheduled gently so that I exfoliate without overdoing it.

**Acceptance Criteria:**
- [ ] Given a product tagged as an enzyme exfoliant, or listing papain, bromelain or subtilisin within its first 12
  ingredients, then it is recognised as "Enzyme Exfoliant" (badge, filter and wizard group).
- [ ] Given E4 in spring, autumn or winter, then Morning keeps the plain cleanser every day and adds the powder as an
  Exfoliate step after it on exactly 3 weekdays; Evening has no exfoliant.
- [ ] Given E4 with Fitzpatrick type 4–6, or in summer, then the powder is scheduled on 1 weekday.
- [ ] Given a shelf whose only cleanser is the enzyme powder, then the cleanser gap cards show for both periods (an
  enzyme powder is not the daily cleanse step).
- [ ] Given two enzyme products, then one is scheduled and the other is in reserve with "Another product already
  covers this role — kept in reserve."
- [ ] Given a primary or secondary goal of barrier repair, then the enzyme product is in reserve with "Repairing your
  barrier first — exfoliation is paused." and "Add" can still force it in.
- [ ] Given a clinical procedure whose rules freeze exfoliants, then the enzyme product is paused with its expiry date
  and never scheduled.
- [ ] Given an enzyme product forced in with "Add", then it still lands in one period only (morning), capped as above.
- [ ] Given any shelf, then no gap card ever asks for an exfoliant, and retinoids, AHA and BHA are still never
  scheduled in the morning.

### Story 4: Nothing on my shelf vanishes
As a user, I want to see every product that is on my shelf but not in my routine, with the reason, so that nothing
disappears.

**Acceptance Criteria:**
- [ ] Given a saved routine and N shelf products with no non-hidden saved step in either routine (any weekday), when
  the Routines screen is shown, then a collapsed "Not in your routine · N" header is visible above "Add product".
- [ ] Given the section is expanded, then each product shows its name and one reason: reserve reason text; "paused
  until <date>" or the freeze reason; "Ready to add" when a fresh draft would schedule it; "Backup — another product
  fills this step" for a same-slot loser.
- [ ] Given a reserve row, when the user taps "Add", then the Draft Preview opens with that product included and
  nothing is saved until the user confirms.
- [ ] Given a "Ready to add" row, when the user taps "Review", then the Draft Preview opens.
- [ ] Given a product whose only step was removed or hidden by the user, then it IS listed, as "Ready to add" when the
  fresh plan schedules it (§5, Q6).
- [ ] Given a product with a step in only one period or on only some weekdays, then it is not listed (the list is per
  product).
- [ ] Given a product hidden on the shelf, or a wishlist product, then it is not listed.
- [ ] Given zero qualifying products, then the section is not rendered.
- [ ] Given any shelf and any saved routines, then every shelf product is a non-hidden saved step or a row (property
  test over at least 300 seeded shelves, including shelves with removed, hidden and wishlist products).

### Story 5: I can trim my routine, on purpose
As a user, I want to remove a step I do not want, only deliberately, so that the routine is mine without a style switch.

**Acceptance Criteria:**
- [ ] Given the Routines list with edit mode off, when the user taps a product card, then no action sheet opens and no
  Remove, Hide or Pause control is shown.
- [ ] Given edit mode on (the pencil in the header), when the user taps a product card, then the action sheet offers
  "Remove from routine" and "Hide from routine"; Remove asks "this weekday only" or "all days" and a confirmation.
- [ ] Given the Calendar view with edit mode off, when the user taps a product row, then the sheet offers "View product
  details" and "Edit product" only; with edit mode on it also offers Remove and Hide, as in the list.
- [ ] Given the user removed or hid a step for a product still on the shelf, when she only opens the screen, switches
  period or day, adds another product, edits the shelf or the screen revalidates, then the step does not come back:
  the saved routines are unchanged.
- [ ] Given the same removal, when she opens the Draft Preview and saves, then in each committed period where the fresh
  plan schedules the product the step is present again with the plan's weekdays (a hidden step is un-hidden); where the
  plan does not schedule it, a removed step stays gone and a hidden step stays hidden. The draft summary names re-added
  steps ("N products added") before she saves.
- [ ] Given she removed the step of a toner she owns, then no toner gap card appears (the shelf can fill the step) and
  the toner is listed in "Not in your routine" as "Ready to add".
- [ ] Given any gap card, then removing, hiding or re-adding other steps does not create, change or clear it.
- [ ] Given she removed a toner step and also deleted the toner from the shelf, then the toner gap cards appear, each
  with "Not for me" (Story 6).

### Story 6: I can wave off an optional prompt
As a user who does not use a toner or an eye cream, I want to dismiss that card so that the screen stops asking until
I next save the routine.

**Acceptance Criteria:**
- [ ] Given a toner or eye-cream gap card (the generic "No Toner/Eye Cream in your … routine"), then it offers "Find in
  catalog" and "Not for me" (PLACEHOLDER copy), with edit mode on or off.
- [ ] Given the user taps "Not for me" on the morning toner card, then that card disappears at once, the evening toner
  card and both eye-cream cards are unaffected, and the choice survives an app restart.
- [ ] Given dismissed cards, when the user saves a draft for Morning & Evening, then every card whose gap still exists
  returns; a Morning-only save returns only morning cards and an Evening-only save only evening cards; "Reset all"
  returns all.
- [ ] Given dismissed cards, when the user adds, removes, hides, reorders or reschedules steps, edits the shelf, switches
  period or day, or restarts the app, then they stay hidden (only a save or "Reset all" brings them back).
- [ ] Given a cleanser, moisturiser or SPF card, the pre-cleanse follow-up card, or any mandate-driven card — including
  one that wins the dedupe for a toner or eye-cream (period, type) — then no "Not for me" is offered.
- [ ] Given a dismissed card, then the plan, the Draft Preview, the "Not in your routine" list, the saved steps and the
  accountability property are exactly as without the dismissal.
- [ ] Given the shelf gains a toner, then its card is gone whatever was dismissed.
- [ ] Given any history of dismissals, then at most four keys are stored (period × toner/eye cream) and none outlives
  the next save of its period.

### Story 7: I can tell the calendar's product rows are tappable
As a user in the Calendar view, I want to see that I can tap a product and what that lets me do, so that editing from
the calendar is discoverable without being accidental.

**Acceptance Criteria:**
- [ ] Given the Calendar view with scheduled products and edit mode off, then a caption above the grid reads
  (PLACEHOLDER) "Tap a product for details. To remove or hide steps, turn on editing with the pencil.", the product
  column is not highlighted, and a tap opens the sheet with details and "Edit product" only (Story 5).
- [ ] Given edit mode on, then the caption reads (PLACEHOLDER) "Tap a product to edit or remove it.", the product
  column is visibly highlighted (information tint with an information-colour edge, never pink) and a tap opens the
  sheet with Remove and Hide as well.
- [ ] Given the user toggles the pencil while the Calendar is open, then caption, highlight and sheet rows switch at
  once, without navigating.
- [ ] Given no scheduled products, then neither caption nor highlight is shown (the empty state is unchanged).
- [ ] Given a screen reader, then each product row is announced as a button named "<product>, open actions" with a hint
  stating what it opens in the current mode, and the caption is read as plain text.
- [ ] Given the caption and highlight, then all copy comes from one constants module, text is at least 14px, and
  colours and spacing come from design tokens.

### Story 8: Safety and explainability hold
As a user, I want the fuller routine to be as safe as the old one so that adding steps never adds risk.

**Acceptance Criteria:**
- [ ] Given at least 300 seeded random shelves (including enzyme-tagged, wishlist and hidden products and removed/hidden
  steps), then plans are deterministic, every shelf product lands in scheduled, frozen, reserve or same-slot
  alternative, no avoid-level pair is co-scheduled on a shared day, and no clinically frozen, pregnancy-frozen or
  expired product is scheduled.

## 5. UX / Behaviour

**One routine.** Generation and the Draft Preview always build the full routine from OWNED products only (a wishlist
product is invisible to the engine, so the live gap cards, the Draft Preview and the list cannot disagree). There is no
style control, setting or style copy anywhere. The Draft Preview is otherwise unchanged.

**Gap cards.** Existing `GapCard`, one per missing step and period, with the existing period-aware text, attached to
the group where the product would go (toner under "Tone", eye cream under "Moisturize"; groups with no real step render
as the trailing block, ordered by layering). A card shows when the shelf has no usable product for that step in that
period — owned, not hidden, not frozen or expired, allowed in that period, and not a strong-active carrier (those are
treatments). Morning can raise cleanser, toner, eye cream, moisturiser and SPF (at most 5); Evening cleanser, toner, eye
cream and moisturiser (at most 4). The enzyme exfoliant, makeup remover and every other type never raise a card. A card
is computed from the shelf and profile, never from the saved routine, so trimming does not change it.

**"Not for me" (Story 6).** Only the generic toner and eye-cream cards carry a second action, "Not for me"
(PLACEHOLDER; the actions may wrap under the text, Q4b), with edit mode on or off because a card is a prompt, not a
step. It hides that one card (a period × type) until the next save of that period: a Draft Preview save whose scope
includes the period, or "Reset all". Manual add/remove/hide/reorder, shelf edits, period or day switches and app
restarts do not bring it back. The hide is presentation-only, applied after the engine has deduplicated placeholders by
(period, type) with mandate > pre-cleanse follow-up > generic gap: a mandate or follow-up card that wins is never
dismissible, and the plan, the draft and the left-out list are unchanged. A dismissed card is the user's explicit
choice, not an omission by the app, so it does not break "never silent": a step is scheduled, or shown as a gap, or —
after her own tap on an optional card — hidden until the next save.

**Trimming.** The pencil in the Routines header toggles edit mode (existing). In the list, edit mode is already the
only way in: a card tap opens the action sheet (details, edit, Remove, Hide) and shows the Pause and Schedule icons
only while editing; otherwise a tap only completes the step (gamification on). The Calendar view opens the same sheet
from a product row; Remove and Hide appear there only while edit mode is on, otherwise the sheet shows "View product
details" and "Edit product" (both act on the product, not on the routine). What each action does, verified in
`routinesStore.ts` and `buildStepsFromPlan` (neither changes):

| Action | Saved routine afterwards | Draft Preview save, plan schedules the product | Plan does not schedule it |
|---|---|---|---|
| Remove, all days | the step is deleted from that routine | step created again (new id, plan's days) | stays gone |
| Remove, one weekday | that weekday is dropped; the last weekday deletes the step | step present with the plan's days | step dropped like any unplanned step |
| Hide / Pause | step kept with `hidden: true`, not shown | step un-hidden: same id and pin, plan's days | stays hidden, untouched |

Only a Draft Preview save, "Reset all", the delete-product cascade and manual add/remove/reorder write steps;
validation, opening the screen, editing the shelf and adding another product never re-add a step. Entry points to
a save: the Generate card, the "Optimize or Regenerate Routine" strip, and the list's "Review" and "Add". Unchanged
limits of the calendar entry, now easier to reach: its Remove/Hide act on the product's first visible step (morning
before evening) and the "this weekday only" confirmation names today's weekday.

**Calendar discoverability (Story 7).** The Calendar view (presentational, given `editMode` as a prop) shows one caption
line under the month label, above the grid, whenever it has scheduled products. Edit mode off: a neutral caption that
says rows open details and points at the pencil for removing or hiding; the product column keeps its normal look
(a strong highlight there would promise editing that the sheet does not offer). Edit mode on: the caption says a tap edits or
removes, and the product column (the left column holding the product rows) takes an information tint with an
information-colour edge. Highlight colours are the information tokens, not the plum tints, which read pink. Rows keep
the button role and their name "<product>, open actions" and add a hint per mode. All wording is PLACEHOLDER (Q4b).

**"Not in your routine" section.** In the Routines footer between the paused rows and "Add product". Collapsed by
default; header "Not in your routine · N" with a chevron. A shelf product is listed iff it has no non-hidden saved step
in either routine on any weekday (so removed and hidden steps count as "no step", Q6). Rows: name, one reason line
(PLACEHOLDER: "Ready to add", "Backup — another product fills this step", plus existing reason texts) and an action —
"Add" (reserve), "Review" (ready), none (paused, backup). Reserve and paused rows come from the same plan buckets the
Draft Preview shows, so the two never disagree. "Review" opens the whole Draft Preview; saving it regenerates the
routine for the chosen scope (Story 5). Known trade-off, accepted by the owner: the list cannot tell "removed on
purpose" from "never added".

**States.** No saved routine: Generate card, no gap cards, no section. N = 0: no section. The engine is synchronous,
so there is no loading state. All text is English, at least 14px, design tokens only.

## 6. Data Requirements

- New data: one persisted settings field, `dismissedGapCards`, at most four keys (`am:toner`, `pm:toner`,
  `am:eye_cream`, `pm:eye_cream`), cleared by the next save of the period; the settings hydrate merges its default, so
  nothing is migrated. A new active class `enzyme_exfoliant` in `actives.json`, and reason codes with text.
- Existing data consumed: products (type, `activeTags`, INCI text, `usageTime`, `isHidden`, `status`), saved routine
  steps (including `hidden` and `scheduledDays`), profile goals and Fitzpatrick type, procedures, the generated plan
  buckets.
- Retention: dismissal keys until the next save of their period (or "Reset all"); nothing else is new.

## 7. Dependencies

- Depends on: `docs/specs/routine-engine-v2.1/phase-04-skeleton-buildup.md` (the skeleton; this spec amends its
  "nothing else enters" rule), `docs/specs/2026-07-11-routine-similar-product-priority.md` (slot alternatives),
  `docs/specs/day-split-alternation.md` (the "Add" override), and `fix/precleanse-gap-card` (required-slot gap cards,
  period-aware `GapCard`, `normalizeProductType`) — merged as PR #60 and already in this branch.
- Blocks: nothing. External services: none.

## 8. Security & Privacy

Authentication: no. Data sensitivity: shelf contents and the four dismissal keys stay on-device; nothing is sent
anywhere. Compliance: none. Enzyme guidance is a draft awaiting clinical review before the global release (§10 Q3).

## 9. Success Metrics

The app is local-only with no telemetry, so success is verified on fixtures:
- R9, S3 and E4 produce exactly the Story 1–3 results.
- 0 violations of determinism, accountability, pair-rule safety and the retinoid/AHA/BHA-never-AM lock over at least
  300 seeded shelves; the accountability property of Story 4 holds on the same corpus.
- Story 5: after any removal or hide, revalidating without a save leaves the stored routines byte-identical; after a
  Draft Preview save the step is present again iff the fresh plan schedules the product.
- Story 6: a dismissal survives a restart; a save of a period (or "Reset all") clears exactly that period's keys; no
  other event does; the plan is identical with and without dismissals.
- Story 7: caption and highlight follow edit mode, and the empty calendar shows neither.
- `npx tsc --noEmit` clean and `npm test` shows no new failures versus the pre-existing baseline.

## 10. Open Questions

- [x] Q1. A third routine tier — moot: the style concept was removed (owner, 2026-10-15).
- [x] Q2. A gap card for a missing enzyme exfoliant — **NO** (product owner, 2026-10-14). Exfoliation is skin-state
  dependent (barrier-repair goal, post-procedure freeze, phototype and season caps) and a prompt would need
  suppression rules nobody has written. An enzyme product the user DOES own is still scheduled; only the purchase
  prompt is withheld.
- [x] Q3. Clinical review of the draft values (enzyme matchers, 3 days a week, the first-12-ingredients window,
  barrier-repair deferral, AM preference) — **DEFERRED to after the MVP, before the global release** (product owner,
  2026-10-14). The values ship as drafted, as named constants. → owner: clinical consultant, scheduled post-MVP
- [x] Q4a. Names for the two routine styles — approved 2026-10-14, now **MOOT**: the style concept was removed on
  2026-10-15. The retired names must not appear in code, UI copy or tests.
- [ ] Q4b. The remaining PLACEHOLDER copy (left-out section, "Not for me", calendar caption and row hints) — still
  open, non-blocking. → owner: design
- [x] Q5. Gap-card dismissal — **DECIDED: option B** (product owner, 2026-10-15, relayed). "Not for me" on the toner
  and eye-cream gap cards ONLY, hiding that card until the next save of the routine. Cleanser, moisturiser and SPF
  cards, the pre-cleanse follow-up and mandate cards have no dismissal. Design: Story 6 and §5; "next save" means a
  Draft Preview save covering the period, plus "Reset all" (tech design, assumption 7).
- [x] Q6. "Not in your routine" lists a product removed on purpose — **YES** (product owner, 2026-10-15, relayed):
  owned, not hidden on the shelf, no non-hidden saved step in either routine on any weekday; per product. Known
  trade-off, accepted: the list cannot tell "removed on purpose" from "never added", so a user who trims deliberately
  keeps seeing a collapsed count.
- [x] Q7. Remove and Hide only in edit mode in the Calendar view, as in the list — **YES** (product owner,
  2026-10-15, relayed). The shelf card, product detail and duplicate-slot sheet are left as they are.
- [x] Q8. The engine sees only owned products, wishlist products excluded in `buildEngineInputFromStores` — **YES**
  (product owner, 2026-10-15, relayed). Live gap cards and the Draft Preview share that one input.
- [ ] Derived details for her read-through (non-blocking; listed so she can veto) → owner: product owner:
  (a) "Not for me" is available with edit mode on or off; (b) manual edits do not reset a dismissal, only a save does;
  (c) calendar caption and highlight follow edit mode, with no highlight outside it; (d) the calendar entry's unchanged
  limits (first visible step, today's weekday in the confirmation).

## Revision 2026-10-16 — "Not in your routine" leaves the Routines screen (product owner)

The owner does not want the "Not in your routine · N" block on the Routines
screen; it stays on the generation page only (her words: "не хочу видеть блок
not in your routine на странице рутин, пусть остается только на странице
генерации рутин"). Supersedes the §5 / Story 4 placement above the "Add
product" button and the Story 5 AC that the section shows products removed on
purpose.

The generation page (Draft Preview) already lists what the plan sets aside — the
"Paused until …" rows and the collapsed "In reserve · N" block, each reserved
row with its own "Add anyway" — so the "must not be silent" rule is met there,
not on the saved screen. Trade-off accepted by the owner: a product the user
removed on purpose is no longer listed on the saved Routines screen; it is
surfaced only when they open the generation page. `buildLeftOutItems` and
`LeftOutSection` were first kept unused and then DELETED the same day, after the
owner confirmed that the generation page's "In reserve" block is what she meant.

