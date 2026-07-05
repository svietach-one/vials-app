# Routine Engine & UX Improvements (V2) — "Invisible Assistant"
Date: 2026-07-04
Author: planner-agent
Jira: — (task slug: `routine-engine`; Jira keys prohibited by agent protocol)
Status: DRAFT
Research: docs/research/routine-engine.md (V2, 2026-07-04 — decision log §4 is binding)

## 1. Problem Statement
Users own a shelf of skincare products but cannot safely combine them: layering
conflicts (retinoid + AHA), post-procedure restrictions, seasonal factors, and
active-adaptation schedules require expert knowledge they don't have. Today the
app only *detects* pairwise conflicts and shows warnings; nothing builds or
repairs a routine. Users currently cannot ask the app "what should my morning
and evening routines actually be, given what I own, my skin, my procedures,
and the season" — and the answer must come from a deterministic rule engine,
because this app contains no AI/LLM by design.

## 2. Goals
- One-tap generation of a complete, conflict-free AM/PM routine draft from the
  user's existing shelf, resolved by a deterministic rule engine (same inputs
  ⇒ byte-identical output, enforced by tests).
- Clinical procedure logs (including custom procedures with mandatory recovery
  windows) automatically freeze aggressive actives for the rehab window and
  un-freeze them without any user action.
- Optional dynamic 4-day skin cycling driven by a single daily check-in
  button, with pause-on-miss barrier protection.
- Automatic micro-dosing (adaptation) schedule for irritating actives:
  ≤4 applications → max 2 days/week; 5–8 → max 4 days/week; 9+ → unrestricted.
- Phototype-aware severity: Fitzpatrick 4–6 escalate irritant-layering
  cautions to avoid; 1–2 get a non-skippable AM SPF mandate with
  photosensitizers.
- Weather-driven seasonal masks with a strict offline/calendar fallback —
  the app must behave identically to today when permanently offline.

## 3. Non-Goals (explicitly out of scope)
- No AI/LLM calls of any kind — the Anthropic routine-suggestion service in
  `src/services/anthropic/` is NOT used by this feature.
- No per-product check-off, streaks, badges, or any gamification mechanics —
  the single check-in button is functional tracking only and exists only in
  opt-in dynamic mode.
- No push notifications or reminders (cycle pause is passive).
- No GPS/native location permission — city is a manual profile field.
- No new predefined procedure types; no changes to the fading-counter logic.
- No pregnancy-safety mode (future ruleset property, not in this release).
- No cloud sync, no analytics/telemetry (local-only constraint holds).
- No purchase recommendations — substitutions come only from the user's shelf.

## 4. User Stories

### Story 1: Generate a routine
As a shelf owner, I want to tap one button and get a safe AM/PM routine built
from my products so that I don't need expert layering knowledge.

**Acceptance Criteria:**
- [ ] Given a shelf with ≥1 eligible product and no routines, when the user
      opens Routines, then a central card shows primary `✨ Generate Routine`
      and secondary `Add Products Manually`.
- [ ] Given populated routines, when the user scrolls to the bottom of the
      routine view, then a contextual strip `✨ Optimize or Regenerate Routine`
      is shown, and the header pencil icon performs only manual reorder/delete.
- [ ] Given the user taps generate, when the draft opens, then live routine
      data is unmodified (verified: store state unchanged until save).
- [ ] Given the same shelf, profile, procedures, and date, when generation
      runs twice, then the two drafts are deep-equal (determinism test).
- [ ] Given products with retinoid and AHA tags, when a draft is generated,
      then the two products never share the same period on the same day.

### Story 2: Draft preview with scope selection
As a user, I want to review a Before → After diff and choose where to apply it
so that the engine never overwrites my routines without consent.

**Acceptance Criteria:**
- [ ] Given a generated draft, when the preview opens, then it renders a
      Before → After layout with ≤3 summary lines and four actions:
      `Save for Both (AM & PM)` / `Save for AM Only` / `Save for PM Only` /
      `Cancel / Discard Draft`.
- [ ] Given the user picks `Save for PM Only`, when the save completes, then
      the AM routine is byte-identical to its pre-draft state and validate
      mode re-runs over the combined result.
- [ ] Given a partial save creates a cross-period conflict, when the user
      returns to Routines, then the bottom Optimize strip is active and no
      modal or red banner is shown.
- [ ] Given `Cancel / Discard Draft`, when tapped, then no store write occurs.

### Story 3: Custom procedure with symptom presets
As a user logging a custom procedure, I want single-tap recovery presets so
that I don't have to guess rehab durations.

**Acceptance Criteria:**
- [ ] Given the custom-procedure form, when it renders, then it offers exactly
      four presets: `Light Care` (0 days), `Redness / Peeling` (3 days),
      `Trauma / Laser` (7 days), `Custom` (manual days or next-procedure date).
- [ ] Given neither rehab days nor a next-procedure date is provided, when the
      user taps save, then the save is blocked with an inline validation
      message (not an alert).
- [ ] Given a preset with rehab days > 0 is saved, when the daily view is
      computed within the window, then products matching the `custom_default`
      freeze profile (exfoliating OR irritancy ≥ 3) render as dimmed
      "Paused until <date>" rows.
- [ ] Given `Light Care` (0 days) or a date-only entry, when saved, then no
      product freezes are applied and the timeline still works.

### Story 4: Clinical freeze auto-expires
As a user in rehab, I want frozen actives to return automatically so that I
never manage the calendar myself.

**Acceptance Criteria:**
- [ ] Given a deep-peel log dated D, when the daily view is computed on
      D+14 (rehab end) vs D+15, then exfoliants are frozen on D+14 and
      visible on D+15 with no store mutation between the two renders.
- [ ] Given two overlapping procedures freezing the same target, when both
      windows apply, then the freeze lasts until the later end date.
- [ ] Given a Botox log within 7 days, when the daily view is computed, then
      products with `massageRequired: true` are frozen with reason
      `botox_no_massage`.
- [ ] Given a frozen row, when the user opens its detail, then the freeze
      reason and unfreeze date are displayed.

### Story 5: Dynamic skin cycling with lazy tracking
As a user who cycles actives, I want a single "Complete My Routine" button that
keeps my 4-night cycle in order even when I skip nights.

**Acceptance Criteria:**
- [ ] Given `Routine Cycle Type = Fixed Calendar Days` (default), when
      Routines renders, then no check-in button exists anywhere and steps map
      statically to weekdays via `scheduledDays`.
- [ ] Given dynamic mode is enabled, when the daily home screen renders, then
      exactly one global "Complete My Routine" button is shown (no per-product
      checkboxes).
- [ ] Given phase = retinoid and no check-in yesterday, when the user opens
      the app today, then tonight's plan still shows the retinoid phase
      (cycle paused, phase shifted forward — never skipped).
- [ ] Given a check-in already logged for the current skincare day (04:00
      boundary), when the button is tapped again, then state is unchanged
      (idempotent).
- [ ] Given a check-in, when it commits, then the cycle phase advances by one
      (mod 4) and the application counter of every product visible in that
      day's view increments by exactly 1.

### Story 6: Adaptation micro-dosing
As a user adding a strong active, I want the engine to ramp up frequency
gradually so that I avoid purging and peeling.

**Acceptance Criteria:**
- [ ] Given a product whose facts include an adapting class with ≤4 recorded
      applications, when a plan is generated, then the product is scheduled at
      most 2 days/week with ≥72 h between scheduled days.
- [ ] Given 5–8 applications, when a plan is generated, then the product is
      scheduled at most 4 days/week (every other night).
- [ ] Given ≥9 applications, when a plan is generated, then only standard
      conflict rules limit the product.
- [ ] Given tracking is off (fixed mode), when the adaptation phase is
      needed, then a virtual count derived from `addedAt` is used
      (weeks 1–2 → phase 1, weeks 3–4 → phase 2, week 5+ → phase 3), and a
      product owned ≥5 weeks before this feature ships starts in phase 3.
- [ ] Given a product in phase 1 or 2, when its routine step card renders,
      then it shows `⏳ Adaptation Phase (Week X of 4)` with the frequency
      note — as a status line, not a warning banner.

### Story 7: Phototype-aware severity
As a user with a darker or lighter phototype, I want conflict strictness tuned
to my PIH and UV risk so that generic rules don't under-protect me.

**Acceptance Criteria:**
- [ ] Given onboarding, when the phototype step renders, then six visual cards
      (tone description + sun-reaction behavior, no racial labels) map to
      Fitzpatrick values 1–6 stored on `UserProfile.phototype`.
- [ ] Given phototype 4, 5, or 6 and two distinct products both with
      irritancy ≥ 2 in a caution-level pair, when the plan resolves, then the
      pair is treated as `avoid` (day-split or freeze; never co-layered).
- [ ] Given one product pre-formulated with both conflicting actives, when
      the plan resolves, then no separation rule and no phototype escalation
      applies to that product.
- [ ] Given phototype 1 or 2 and a photosensitizing active in the plan, when
      the AM period resolves without an SPF product, then a non-dismissible
      SPF placeholder step is present and validate mode reports severity
      `avoid`.
- [ ] Given a legacy grouped profile, when the app migrates, then
      `type_1_2 → 1`, `type_3_4 → 4`, `type_5_6 → 6`, editable afterwards in
      the profile.

### Story 8: Weather-driven seasonal masks
As a user, I want seasonal routine shifts based on my city's actual weather so
that masks don't flip on arbitrary calendar dates.

**Acceptance Criteria:**
- [ ] Given the profile, when the user types in the city field, then
      autocomplete suggestions come from the bundled offline dataset and
      selecting one requires no network and no GPS permission.
- [ ] Given a city is set, when ≥7 days have passed since the last weather
      fetch and the app opens online, then exactly one weather request runs
      and the result is cached with its timestamp.
- [ ] Given weekly average temperature < +15 °C, when the mask is computed,
      then the autumn/winter mask applies; given > +20 °C, the spring/summer
      mask; given 15–20 °C, the previous mask is retained (hysteresis).
- [ ] Given a mask threshold crossing, when it is detected, then the Diff
      View transition screen opens (before → after) — never a silent switch.
- [ ] Given no city / offline / fetch error / cache older than 14 days, when
      the mask is computed, then the calendar season from
      `getCurrentSeason()` is used silently and no feature is blocked.

### Story 9: Vitamin C reclassification
As a user with legacy vitamin C tags, I want a safe default with an easy
correction so that derivative products stop triggering false conflicts.

**Acceptance Criteria:**
- [ ] Given a product with the legacy `vitamin_c` tag, when stores hydrate
      after the update, then the tag reads `vitamin_c_pure` (conservative:
      low-pH conflicts stay active).
- [ ] Given a migrated product, when its detail card renders, then a subtle
      infobox states it is treated as pure vitamin C and links to the tag
      wizard to reclassify as derivative — no modal, no blocking prompt.
- [ ] Given the user reclassifies to derivative, when routines validate, then
      the pure-C low-pH pair rules no longer match that product.

### Story 10: Rehab shield widget & long-term decoupling (V3)
As a user in a rehab window, I want one clear widget explaining what the
engine locked — and no daily-screen noise from long-term procedures — so that
masking is transparent without notification fatigue.

**Acceptance Criteria:**
- [ ] Given any procedure with remaining rehab days > 0 covering the face,
      when the Daily Routine screen renders, then a persistent info widget is
      anchored at the very top:
      `🩹 REHABILITATION: [Name] (Day X of Y). The engine has temporarily
      locked aggressive actives to protect your skin barrier.` — and
      photosensitizing/exfoliating steps are masked from the visible list.
- [ ] Given the rehab window ends on day Y, when the screen renders on day
      Y + 1, then the widget is gone and the masked actives are restored,
      with no store mutation between the two renders.
- [ ] Given a procedure whose rehab days are exhausted but whose long-term
      effect is still active (e.g. Botox month 2 of 6), when the Daily
      Routine screen renders, then no widget, banner, or notification
      appears — the procedure is visible only on the Clinic timeline
      (ClinicalHistoryDashboard context).
- [ ] Given a rehab procedure logged with `affectedZones: ['neck']`, when the
      face routine renders, then it is unaffected (no widget mask applied);
      absent `affectedZones` is treated as `['face']`.
- [ ] Given overlapping rehab windows, when the widget state is computed,
      then the window ending last drives the widget (deterministic).

## 5. UX / Behaviour
- **Routines tab, empty state:** central generate card (Story 1). Loading
  state: generation is synchronous local computation; show the draft screen
  directly (target < 200 ms for a 30-product shelf — perf test).
- **Routines tab, populated:** ordinary AM/PM lists — no cycling labels, no
  inline warnings. Frozen products appear as dimmed collapsed "Paused until
  <date>" rows. Adaptation-phase products carry the ⏳ status line on their
  step card. Bottom strip `✨ Optimize or Regenerate Routine` doubles as the
  validation-finding indicator (active state when an `avoid` finding exists).
- **Draft Preview (Diff Mode):** Before → After columns/sections, ≤3 quiet
  summary lines, four commit actions (Story 2). Reject = zero writes.
- **Daily home screen (dynamic mode only):** one "Complete My Routine" button;
  after check-in it renders in a done state until the next skincare day.
- **Custom procedure modal:** four preset tiles; inline validation error under
  the form when no recovery window is given.
- **Season transition:** Diff View screen on threshold crossing; dismissing it
  keeps the new mask (the screen informs, it does not ask permission);
  `SeasonalNoticeBanner` + `dismissedBanners` used for the post-transition
  reminder.
- **Error states:** weather fetch failure → silent calendar fallback (no UI);
  generation with an empty/ineligible shelf → generate card explains
  "Add products first" and routes to Add Products; missing SPF for a mandate
  → placeholder step (non-dismissible only for phototypes 1–2 with
  photosensitizers).
- **UI copy:** English only (Phase 1). Check-in button label:
  **"Complete My Routine"**; generate action label: **`✨ Generate Routine`**
  (both final — product owner, 2026-07-04; no "AI Engine" wording in-app).

## 6. Data Requirements
- New data:
  - `UserProcedureLog.customRehabDays?: number` (0/3/7/custom) and
    `UserProcedureLog.affectedZones?: TreatmentZone[]`
    (`'face' | 'neck' | 'decollete'`; absent → `['face']`). **SHIPPED** in
    `src/types/index.ts` alongside `RehabWidgetState` (derived render-time
    state, never persisted) — see `src/utils/routineEngine/rehabFilter.ts`.
  - `UserProfile.phototype: 1|2|3|4|5|6|null` (migrated from grouped union);
    `UserProfile.city: { name, lat, lon } | null`.
  - Settings: `routineCycleType: 'fixed' | 'dynamic'` (default `'fixed'`).
  - Tracking: `cycleState { cyclePhaseIndex, lastAppliedDate }`,
    `applicationStats: ProductApplicationStats[]`,
    `seasonMaskCache { mask, fetchedAt, source }` — all via
    `src/services/storage.ts` with new `STORAGE_KEYS`.
  - `RoutineStep.userPinned?: boolean`.
  - Static rulesets `src/constants/rulesets/{actives,procedures,seasons}.json`
    (versioned) + bundled `src/constants/cities.json`.
- Existing data consumed: `Product` (activeTags, fullIngredientText,
  usageTime, isHidden, openedDate/paoMonths, addedAt), `Routine`/`RoutineStep`
  (scheduledDays), `UserProcedureLog` + `CLINICAL_RULES_DB`, `UserProfile`
  (skinType, concerns), `AppSettings.dismissedBanners`.
- Data retention: all local (AsyncStorage), retained until user deletes the
  underlying entity; application counters never decrement; weather cache
  overwritten weekly, considered stale after 14 days.

## 7. Dependencies
- Depends on: docs/research/routine-engine.md (architecture + decision log).
- Blocks: any future AI-assisted routine features (they would layer on the
  same plan/diff UX).
- External services: **Open-Meteo** weather API (keyless, free) — weekly,
  cached, with mandatory calendar fallback; bundled city dataset (offline).
  No other third-party services. Open Beauty Facts is unaffected.

## 8. Security & Privacy
- Authentication required: no (local-only app).
- Data sensitivity: skin profile, procedures, and city are personal health-
  adjacent PII — stored locally only, never transmitted. The weather request
  sends only city coordinates (no identifiers) over HTTPS.
- Compliance: no GPS permission requested; no analytics; GDPR surface limited
  to on-device data (existing local-data warning covers it).

## 9. Success Metrics
No telemetry exists (local-only), so metrics are local and test-enforced:
- Determinism: generation property test — identical inputs produce deep-equal
  plans across 100 randomized shelf fixtures. 0 failures.
- Safety: rule-matrix test suite — for every `avoid` pair rule and every
  freeze rule, no generated plan ever co-schedules the pair or schedules a
  frozen product. 0 violations.
- Performance: generate ≤ 200 ms and daily-view mask ≤ 16 ms for a
  30-product shelf on a mid-range device (Jest perf harness, CI-checked
  thresholds relaxed 4×).
- Regression gate: `npx tsc --noEmit` clean; all suites green (baseline of
  14 failing suites must not grow; engine suites 100% green).

## 10. Open Questions
- [x] Final UI copy for the generate action → RESOLVED 2026-07-04 by product
      owner (svietach): `✨ Generate Routine`; check-in button
      "Complete My Routine". No "AI Engine" wording in-app.
- [ ] Source/licensing of the bundled city dataset (size budget ≤ ~500 KB,
      offline, redistributable) → owner: engineer, resolve during tech-design
      review before implementation starts.
