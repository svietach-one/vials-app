# Clinic Forecast Timeline
Date: 2026-07-06
Author: planner-agent
Status: DRAFT

## AI-SDLC Flags
```
backend_layer:   false
frontend_layer:  true
infra_changes:   false
```

---

## 1. Problem Statement

The Clinic screen's 12-month timeline is currently an inline placeholder —
`MonthTimelineBar` in `src/screens/ClinicScreen.tsx` (lines 33–127): a
horizontal row of dots for the past 12 months, filled black on any month a
procedure was performed. It carries no duration, no lifecycle phase, and
nothing about the future — a Botox log (fades ~4 months) and a Filler log
(fades ~10 months) render as identical dots. Users cannot tell how long a
treatment's effect is expected to last, whether two treatments overlap, or
when a fade-out check-in is coming, without opening each
`ProcedureLifespanCard` individually and doing the month math themselves. The
placeholder is also inert — tapping a dot does nothing, so it cannot help a
user locate the card it represents in the list below.

## 2. Goals

- Replace `MonthTimelineBar` with a dedicated `ForecastTimeline` component
  (`src/components/clinic/ForecastTimeline.tsx`, per `docs/IMPLEMENTATION_PLAN.md`
  P5-1) — closes the last in-progress item of MVP Phase 5.
- Show a 12-month window centered on today (6 past months + the current
  month + 5 future months), with the current month visually distinguished.
- Render each non-archived procedure's full effect lifecycle as one
  continuous track: a Cobalt segment from `datePerformed` to the fade-trigger
  point, then an Amber segment from there to full completion — reusing
  `getTimelineConfig`/`computeStatus` from `procedureLifespanHelpers.ts`
  exactly, with zero duplicated date math.
- Let the user tap a procedure's track to scroll the existing Clinic
  `FlatList` to that procedure's `ProcedureLifespanCard`.
- Keep all month-window and date-to-position math in one pure,
  unit-testable utility with an injected `now: Date`, per
  `.claude/rules/testing.md`.

## 3. Non-Goals

- Ingredient- or procedure-conflict warnings on the ribbon — conflict
  warnings stay exclusive to routines per `CLAUDE.md`.
- A third, Cabernet-colored rehab sub-segment on the track — the acute rehab
  window already has dedicated surfaces (`RehabWidget` on Routines, the
  "Rehab" status badge on `ProcedureLifespanCard`); this component draws
  exactly the two segments named in Goal 3.
- Any overflow/"continues" indicator for a track clipped at the window's edges.
- A precise, day-level "today" marker inside the track area — only the
  current month's column header is marked.
- Any change to `ProcedureLifespanCard`, `AddProcedureModal`, or
  `FadingInteractivePrompt` behavior — this feature only adds a way to
  scroll to the card, not a way to change it.
- Pagination, zoom, or an arbitrary date-range picker — the window is always
  exactly 12 fixed calendar months.
- New `AsyncStorage` keys, store fields, or schema changes — the ribbon is a
  render-time projection over the existing `UserProcedureLog[]`, exactly
  like the card's own status/progress derivation.
- New design tokens — Cobalt and Amber already exist in
  `src/constants/tokens.ts`.

## 4. User Stories

### Story 1: Centered 12-month window with the current month marked
As a Clinic screen user, I want to see 6 months of history and 6 months of
forecast around today, with the current month clearly marked, so I can judge
how my treatment history lines up with what's ahead.

**Acceptance Criteria:**
- [ ] Given any date the app is opened on, when the ribbon renders, then it
      shows exactly 12 month columns: the 6 calendar months before the
      current month, the current month, and the 5 calendar months after it.
- [ ] Given the current month's column, when the ribbon renders, then that
      column is visually distinguished from the other 11 (e.g. bold/highlighted label).
- [ ] Given the app is opened in a later month than a previous session, when
      the ribbon rebuilds, then the window shifts accordingly and the
      newly-current month is the one marked.

### Story 2: Full-lifecycle track per procedure, reusing existing phase math
As a user with a logged procedure, I want its entire effect lifespan drawn as
one track split into an active portion and a fading portion, so I can see at
a glance when each treatment is expected to wear off.

**Acceptance Criteria:**
- [ ] Given a non-archived procedure whose track intersects the visible
      window, when the ribbon renders, then the track spans from
      `datePerformed` through `datePerformed + totalEffectMonths` (per
      `getTimelineConfig`, 30.44-days-per-month convention), positioned
      proportionally across the 12-month grid.
- [ ] Given that track, when it renders, then the segment from
      `datePerformed` to `datePerformed + fadeTriggerMonth` is Cobalt and the
      segment from `fadeTriggerMonth` to `totalEffectMonths` is Amber.
- [ ] Given a custom procedure (`procedureKey: 'custom'`), when its track
      renders, then it uses the same `getTimelineConfig` span derivation
      (`datePerformed` → `estimatedReturnDate`) already used by
      `ProcedureLifespanCard` — no separate math is implemented.
- [ ] Given a procedure whose track extends beyond either edge of the
      12-month window, when it renders, then the bar is clipped at that edge
      with no "continues" indicator.

### Story 3: Tap a track to jump to its card
As a user, I want to tap a procedure's track and land on its card in the list
below, so I don't have to scroll manually to find it.

**Acceptance Criteria:**
- [ ] Given the ribbon shows at least one track, when the user taps a
      procedure's track, then the Clinic screen's `FlatList` scrolls
      (animated) to that procedure's `ProcedureLifespanCard`.
- [ ] Given a tap on a track, when it registers, then no navigation away from
      the Clinic screen occurs — the scroll stays within the same screen.
- [ ] Given a screen reader is active, when focus lands on a track, then it
      exposes `accessibilityRole="button"` and an `accessibilityLabel` that
      includes the procedure's display name (from `getProcedureDisplayName`).

### Story 4: Archived procedures excluded
As a user, I want the ribbon to stay focused on procedures that are still
relevant, so fully-resolved (archived) procedures don't clutter the forecast.

**Acceptance Criteria:**
- [ ] Given a procedure with `status: 'archived'`, when the ribbon builds its
      tracks, then no track renders for it.
- [ ] Given every logged procedure is archived, when the Clinic screen
      renders, then the ribbon is omitted entirely (same as today's
      zero-procedure behavior), while the `FlatList` still shows the
      archived cards below.
- [ ] Given a mix of archived and non-archived procedures, when the ribbon
      renders, then only the non-archived ones produce tracks.

### Story 5: Overlapping procedures stack without visual collision
As a user with more than one treatment active at the same time, I want
overlapping tracks to stay individually readable, so I can distinguish
concurrent treatments.

**Acceptance Criteria:**
- [ ] Given two procedures whose visible spans overlap in time, when the
      ribbon renders, then their tracks appear on two different rows.
- [ ] Given two procedures whose visible spans do not overlap in time, when
      the ribbon renders, then their tracks may share the same row.
- [ ] Given three or more mutually-overlapping procedures, when the ribbon
      renders, then each gets its own row and none are hidden or truncated
      to save space.

### Story 6: Design-system and copy constraints
As the product owner, I want this component to follow the app's existing
design system, so the Clinic screen stays visually consistent.

**Acceptance Criteria:**
- [ ] Given any text on the ribbon (month labels, accessibility labels), when
      inspected, then it is in English and rendered at 14px or larger.
- [ ] Given any color on the ribbon, when inspected, then it is sourced from
      `src/constants/tokens.ts` — no hardcoded hex values and no pink hue.
- [ ] Given the ribbon renders, when compared against the routines screens,
      then it shows no ingredient-conflict warning content.

## 5. UX / Behaviour

The ribbon replaces `MonthTimelineBar` as the same `FlatList`'s
`ListHeaderComponent` on the Clinic screen, directly above the
`ProcedureLifespanCard` list. It sits inside a horizontal `ScrollView` (kept
for narrow-device safety even though the window is a fixed 12 columns, not an
infinite scroll). Layout, top to bottom: a 12-column month-label header row
(current column bold), then one track row per lane returned by the layout
util — a procedure whose lifespan overlaps another's occupies its own lane;
non-overlapping procedures can share a lane. Each track is a single tappable
region spanning its full Cobalt+Amber bar. If there are zero non-archived
procedures (no logs yet, or every log is archived), the ribbon does not
render at all and the screen falls through to its existing empty/card states
unchanged.

**Loading/empty/error states:** there is no network or async load for this
component (procedures come from the already-hydrated `proceduresStore`); the
only "empty" state is "no non-archived procedures" (Story 4), which omits the
ribbon rather than showing an empty grid.

## 6. Data Requirements

- Existing data consumed: `UserProcedureLog[]` (`id`, `procedureKey`,
  `customName`, `datePerformed`, `status`, `customRehabDays`,
  `estimatedReturnDate` — all already defined in `src/types/index.ts`) via
  `useProceduresStore`.
- New data required: none.
- Data retention: N/A — nothing new is persisted; the ribbon is a
  render-time projection recomputed on every render, exactly like
  `ProcedureLifespanCard`'s own status/progress derivation.

## 7. Dependencies

- Depends on `src/utils/procedureLifespanHelpers.ts` (`getTimelineConfig`,
  `computeStatus`, `getProcedureDisplayName`) — must be reused, not
  reimplemented.
- Depends on existing tokens in `src/constants/tokens.ts`
  (`palette.cobalt`/`colors.statusInfo*`, `palette.amber`/`colors.statusWarning*`).
- Blocks: closing `docs/IMPLEMENTATION_PLAN.md` Phase 5 (this is its last
  in-progress item).
- External services: none — fully offline per `CLAUDE.md`.

## 8. Security & Privacy

- Authentication required: no.
- Data sensitivity: procedure logs are already local, on-device-only data;
  this feature surfaces no new PII and sends nothing over the network.
- Compliance considerations: none beyond the existing local-only storage
  model (see PRD §6 clinical/legal review items — unaffected by this
  UI-only feature).

## 9. Success Metrics

- All Given/When/Then acceptance criteria above pass as qa-lead integration
  tests before this task's tech-lead review.
- `npx tsc --noEmit` stays clean after the new util and component are added.
- `buildForecastTimeline` unit tests exercise window-boundary construction,
  edge-clipping, custom-procedure derivation, and row assignment — not just
  the happy path — per `.claude/rules/testing.md`.
- (No user-analytics metrics apply — the app ships with no analytics or
  trackers, per PRD §1.)

## 10. Open Questions

No open questions. All design decisions are resolved in
`docs/tech-design/clinic-forecast-timeline.md`.
