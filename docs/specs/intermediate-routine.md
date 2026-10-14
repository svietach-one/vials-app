# Vials — Intermediate Routine ("Balanced" routine style)
Date: 2026-10-14
Author: planner-agent
Jira: N/A (kebab-case task slug per agent-layer-protocol.md: `intermediate-routine`)
Status: DRAFT

## AI-SDLC Flags
```
backend_layer:  false
frontend_layer: true
infra_changes:  false
```

## 1. Problem Statement

Users currently cannot get a routine that contains the toner or eye cream they own. The routine engine
builds a deliberately minimal routine — cleanse, moisturise, SPF, plus at most one treatment — and files
every other leave-on product (toner, eye cream, essence, oil, ampoule) into an internal "reserve". The
saved Routines screen never shows that reserve (only the Draft Preview does, collapsed), so these products
silently disappear after the first save. Nothing tells the user that a toner or eye-cream step is missing
from her routine, and the engine has no concept of an enzyme exfoliant, so an enzyme powder is invisible to
it. A professional cosmetologist's routine (a consultation memo for a 35-year-old woman was analysed for
this task) adds toner and eye cream morning and evening and a gentle exfoliation two to three times a week.
The engine already agrees with the rest of that memo (double cleanse, separate makeup remover, vitamin C in
the morning, daily SPF, base cream AM+PM, one new product at a time). This spec adds only the structural,
non-personal part of that routine as a second routine style, makes it the default, keeps the minimal style
one tap away, and makes every gap and every left-out product visible instead of silent.

## 2. Goals

- G1. Two routine styles — **Essential** (today's minimal routine) and **Balanced** (the new default).
  The style is persisted and can be switched from the Draft Preview, which regenerates immediately.
- G2. On the reference shelf R9 (§4), Balanced yields Morning = foam cleanser, toner, eye cream, cream, SPF
  and Evening = micellar water, foam cleanser, toner, eye cream, cream; Essential yields today's routine.
- G3. Whenever Balanced calls for a step the shelf cannot fill (toner, eye cream), the Routines screen shows
  a gap card for that step and period. At most 5 gap cards appear in any single period view.
- G4. Enzyme exfoliants are recognised as their own active class and scheduled as one weekly morning step
  (at most 3 days a week), inheriting every existing exfoliant safety net.
- G5. 100% of non-hidden shelf products are accounted for on the Routines screen: each is either a saved
  routine step or a row in a new "Not in your routine" list that states why. Verified by a property test.
- G6. Essential output is identical to today's engine except for one relabelled reserve reason
  (measured in a throwaway spike: 0 plan differences over 600 seeded shelves after normalising that label).
- G7. Determinism, Phase 9 explainability and pair-rule safety hold at both styles.

## 3. Non-Goals (explicitly out of scope)

- **A third, "Full/Complete" style**, or any attempt to reproduce the whole memo. Its content is undefined and
  would need the personal particulars the product owner excluded. The style type is a string union, so a
  third style is additive later.
- **Personal particulars of the reference consultation**: niacinamide pinned to the evening (sebum control
  suits oily skin, not everyone), the 35-year-old profile, "10–20 minutes between serum and cream" timing,
  eye cream applied after SPF, any brand or product named in the memo, any age-specific advice.
- **Re-ordering layers.** `LAYERING_ORDER` is unchanged, so eye cream renders before the moisturiser.
- **More Balanced slots.** Essence, ampoule, oil, mask, spot treatment and non-enzyme peelings stay in
  reserve (now visible in the new list; "Add" forces them in via the existing override).
- **A gap card for a missing exfoliant.** Exfoliation depends on skin state (barrier repair, recovery after a
  procedure, tone and season limits), so it is placed when owned and never prompts a purchase (§10 Q2).
- **Per-gap dismissal or per-step opt-out.** The opt-out is choosing Essential.
- **A Profile-screen setting row**, Today-screen changes, calendar-view changes.
- **Migration or backward compatibility.** There is no release and there are no existing users.
- **New pair rules, pregnancy rules or skin-condition gating for enzymes**, and any change to how pair rules
  treat rinse-off products.
- **Listing user-hidden products** in the new list; hiding is the user's own decision.

## 4. User Stories

Reference shelves, all products `usageTime: both`, goal `maintenance`, no procedures, season spring:
**R9** = foam cleanser, micellar water, cream, SPF, toner, eye cream, essence, oil, ampoule.
**S3** = cleanser, cream, SPF. **E4** = S3 + an enzyme powder typed "cleanser" and tagged as an enzyme
exfoliant (or listing papain/bromelain early in its ingredients).

### Story 1: Choose a routine style
As a user, I want to pick Essential or Balanced so that the generated routine fits how much I want to do.

**Acceptance Criteria:**
- [ ] Given a fresh install, when the Draft Preview opens, then "Balanced" is selected in the Routine style
  control.
- [ ] Given the Draft Preview is open on Balanced, when the user taps "Essential", then the draft
  regenerates under Essential, the choice is persisted, and no saved step changes until the user confirms a
  save.
- [ ] Given Essential was chosen, when the app restarts and the Draft Preview opens, then Essential is
  still selected.
- [ ] Given the same shelf, profile and date, when a plan is generated twice at the same style, then the
  two plans are identical.
- [ ] Given the style changes, when the Routines screen re-renders, then its gap cards reflect the new style
  without opening the Draft Preview.

### Story 2: Balanced places the toner and eye cream I own
As a Balanced user, I want my toner and eye cream in my routine, morning and evening, so that nothing I own is skipped.

**Acceptance Criteria:**
- [ ] Given R9 at Balanced, when a draft is generated, then Morning = foam cleanser, toner, eye cream, cream,
  SPF; Evening = micellar water, foam cleanser, toner, eye cream, cream; reserve = essence, oil, ampoule;
  no gap cards.
- [ ] Given R9 at Essential, then Morning = foam cleanser, cream, SPF; Evening = micellar water, foam
  cleanser, cream; toner and eye cream are in reserve with the reason "Not part of your Essential routine —
  switch to Balanced to include it."
- [ ] Given a toner whose usage is "evening only", when generated at Balanced, then it appears in Evening only.
- [ ] Given two toners, when generated at Balanced, then one is scheduled per period and the other is
  offered as a swap ("Change") in the Draft Preview — never both in one period.
- [ ] Given a toner that carries a strong acid, then it is handled as a treatment exactly as today and does
  not count as the toner step.
- [ ] Given a shelf whose only "moisturiser" is an eye cream, then the moisturiser gap card still shows at
  both styles (an eye cream never fills the moisturiser slot).

### Story 3: I am told when a step is missing (not silent)
As a Balanced user, I want a visible prompt for a step my shelf cannot fill so that I know what to add.

**Acceptance Criteria:**
- [ ] Given a saved routine and shelf S3 at Balanced, when the user views Morning, then gap cards read
  "No Toner in your morning routine" and "No Eye Cream in your morning routine", and Evening shows the
  evening equivalents; at Essential none of these four appear.
- [ ] Given those gap cards, when the user adds a toner to the shelf, then both toner gap cards disappear
  and the toner shows in "Not in your routine" as ready to add.
- [ ] Given a toner that is evening-only and no morning toner, then only the morning toner gap card shows.
- [ ] Given Balanced and any shelf, then no single period view shows more than 5 gap cards.
- [ ] Given no saved routine, then the Generate card shows and no gap card does (existing behaviour).

### Story 4: Enzyme exfoliant as a weekly morning step
As a user with an enzyme exfoliant, I want it scheduled gently so that I exfoliate without overdoing it.

**Acceptance Criteria:**
- [ ] Given a product tagged as an enzyme exfoliant, or listing papain, bromelain or subtilisin within its
  first 12 ingredients, then it is recognised as "Enzyme Exfoliant" (badge, filter and wizard group).
- [ ] Given E4 at Balanced in spring, autumn or winter, then Morning keeps the plain cleanser every day and
  adds the powder as an Exfoliate step after it on exactly 3 weekdays; Evening has no exfoliant.
- [ ] Given E4 at Balanced with Fitzpatrick type 4–6, or in summer, then the powder is scheduled on 1 weekday.
- [ ] Given a shelf whose only cleanser is the enzyme powder, then the cleanser gap cards show for both
  periods (an enzyme powder is not the daily cleanse step).
- [ ] Given two enzyme products, then one is scheduled and the other is in reserve with "Another product
  already covers this role — kept in reserve."
- [ ] Given a primary or secondary goal of barrier repair, then the enzyme product is in reserve with
  "Repairing your barrier first — exfoliation is paused." and "Add" can still force it in.
- [ ] Given a clinical procedure whose rules freeze exfoliants, then the enzyme product is paused with its
  expiry date and never scheduled.
- [ ] Given Essential, then an enzyme product is in reserve with the Essential reason from Story 2.
- [ ] Given an enzyme product forced in with "Add", then it still lands in one period only, capped as above.
- [ ] Given any style, then no gap card ever asks for an exfoliant, and retinoids, AHA and BHA are still
  never scheduled in the morning.

### Story 5: Nothing on my shelf vanishes
As a user, I want to see every product that is on my shelf but not in my routine, with the reason, so that nothing disappears.

**Acceptance Criteria:**
- [ ] Given a saved routine and N non-hidden shelf products with no saved step, when the Routines screen is
  shown, then a collapsed "Not in your routine · N" header is visible above "Add product".
- [ ] Given the section is expanded, then each product shows its name and one reason: reserve reason text;
  "paused until <date>" or the freeze reason; "Ready to add" when a fresh draft would include it; "Backup —
  another product fills this step" for a same-slot loser.
- [ ] Given a reserve row, when the user taps "Add", then the Draft Preview opens with that product
  included and nothing is saved until the user confirms.
- [ ] Given a "Ready to add" row, when the user taps "Review", then the Draft Preview opens.
- [ ] Given a product hidden by the user, or whose only step is hidden, then it is not listed.
- [ ] Given zero qualifying products, then the section is not rendered.
- [ ] Given any shelf and any saved routines, then every non-hidden shelf product is a saved step or a row
  (property test over at least 300 seeded shelves at both styles).

### Story 6: Safety and explainability hold at both styles
As a user, I want the new style to be as safe as the old one so that adding steps never adds risk.

**Acceptance Criteria:**
- [ ] Given at least 300 seeded random shelves at each style (including enzyme-tagged products), then plans
  are deterministic, every shelf product lands in scheduled, frozen, reserve or same-slot alternative, no
  avoid-level pair is co-scheduled on a shared day, and no clinically frozen, pregnancy-frozen or expired
  product is scheduled.
- [ ] Given Essential, then the plan equals today's engine output except for the relabelled reserve reason.

## 5. UX / Behaviour

**Style control (Draft Preview).** At the top of the Draft Preview content: label "Routine style", a
two-segment control (Essential | Balanced) and one line describing the selected style. Tapping a segment
persists the choice and regenerates the draft; unsaved swaps made in the draft are discarded (same as
"Add anyway"). The gap cards on the Routines screen follow the persisted style immediately.

Copy below is PLACEHOLDER pending design approval (project convention):
- Essential — "Cleanse, moisturise and protect, plus one targeted treatment."
- Balanced — "Essential plus toner and eye cream, and a gentle enzyme exfoliant a few mornings a week."

**Gap cards (no UI change).** Existing `GapCard`, one per missing step and period, with the existing
period-aware text, attached to the group where the product would go (toner under "Tone", eye cream under
"Moisturize"; groups with no real step render as the trailing block, ordered by layering). How styles
interact with cards:

| Style | Steps that raise a card when unfilled | Max cards in one period view |
|---|---|---|
| Essential | Morning: cleanser, moisturiser, SPF. Evening: cleanser, moisturiser | 3 |
| Balanced | The same, plus toner and eye cream in both periods | 5 |

The enzyme exfoliant, makeup remover and every other type never raise a card.

**"Not in your routine" section.** In the Routines footer between the paused rows and "Add product".
Collapsed by default; header "Not in your routine · N" with a chevron. Rows: name, one reason line
(PLACEHOLDER: "Ready to add", "Backup — another product fills this step", plus existing reason texts), and
an action — "Add" (reserve), "Review" (ready), none (paused, backup). Its reserve and paused rows come from
the same plan buckets the Draft Preview shows, so the two never disagree.

**States.** No saved routine: Generate card, no gaps, no section. N = 0: no section. A storage write
failure leaves the style unpersisted until restart (existing `saveJson` behaviour). The engine is
synchronous, so there is no loading state. All text is English, at least 14px, design tokens only.

## 6. Data Requirements

- New data: `AppSettings.routineDepth: 'essential' | 'balanced'`, device-local, default `balanced`.
  New active class `enzyme_exfoliant` in `actives.json`, and five reason codes with text.
- Existing data consumed: products (type, `activeTags`, INCI text, `usageTime`, `isHidden`), saved routine
  steps (including hidden), profile goals and Fitzpatrick type, procedures, the generated plan buckets.
- Retention: local until the user clears app data. No migration: the settings hydrate merges defaults.

## 7. Dependencies

- Depends on: `docs/specs/routine-engine-v2.1/phase-04-skeleton-buildup.md` (the skeleton; this spec scopes its
  "nothing else enters" rule to Essential and amends it), `docs/specs/2026-07-11-routine-similar-product-priority.md`
  (slot alternatives), `docs/specs/day-split-alternation.md` (the "Add" override), and the
  `fix/precleanse-gap-card` work (`progress/fix-precleanse-gap-card.md`: required-slot gap cards, period-aware
  `GapCard`, `normalizeProductType`). That branch is IN_REVIEW with uncommitted changes in the files this task
  edits: **start this task only after it merges, from origin/dev.**
- Blocks: nothing. External services: none.

## 8. Security & Privacy

Authentication: no. Data sensitivity: the style preference and shelf contents stay on-device; nothing is
sent anywhere. Compliance: none. Enzyme guidance is a draft awaiting clinical review (§10 Q3).

## 9. Success Metrics

The app is local-only with no telemetry, so success is verified on fixtures:
- R9, S3 and E4 produce exactly the Story 2–4 results at both styles.
- 0 violations of determinism, accountability, pair-rule safety and the retinoid/AHA/BHA-never-AM lock over
  at least 300 seeded shelves per style; the accountability property of Story 5 holds on the same corpus.
- Essential equals today's engine except the relabelled reason: 0 differences over 600 seeded shelves.
- `npx tsc --noEmit` clean and `npm test` shows no new failures versus the pre-existing baseline.

## 10. Open Questions

- [x] Q1. A third "Complete" style — **NO** (product owner, 2026-10-14). Two styles ship: Essential and
  Balanced. Follows from Q2: without an exfoliant prompt there is no meaningful third tier to select.
- [x] Q2. A gap card for a missing enzyme exfoliant — **NO** (product owner, 2026-10-14). The planner
  default stands: exfoliation is skin-state dependent (barrier-repair goal, post-procedure freeze,
  phototype and season caps) and a prompt would need suppression rules nobody has written. An enzyme
  product the user DOES own is still scheduled; only the purchase prompt is withheld.
- [x] Q3. Clinical review of the draft values (enzyme matchers, 3 days a week, the first-12-ingredients
  window, barrier-repair deferral, AM preference) — **DEFERRED to after the MVP, before the global
  release** (product owner, 2026-10-14). The values ship as drafted for the MVP. → owner: clinical
  consultant, scheduled post-MVP
- [x] Q4a. Style names "Essential" / "Balanced" — **APPROVED** (product owner, 2026-10-14).
- [ ] Q4b. The remaining PLACEHOLDER copy in §5 (card and section wording) — still open. → owner: design

Resolved 2026-10-14 (product owner, relayed by the coordinating session): no release and no existing
users, so the default is Balanced for everyone and nothing is migrated; "filter versus slot selection" is a
technical call (decided in the tech design); steps the style calls for must never be omitted silently, and
shelf products that do not make the routine must stay visible.
