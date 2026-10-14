# Metabolism Feedback Loop (Clinic)
Date: 2026-10-14
Author: planner-agent
Jira: N/A (task slug `metabolism-feedback-loop`)
Status: APPROVED 2026-10-14 (Option A; all §10 proposals accepted)

## AI-SDLC Flags
```
backend_layer:  false
frontend_layer: true
infra_changes:  false
```

## 1. Problem Statement

Users cannot teach Vials how long a procedure's effect really lasts for them. PRD §5 ("The Metabolism
Feedback Loop") and US-17 promise that the Clinic timeline adapts to the user's own metabolism, but
nothing in the app delivers it: `UserProfile.individualDurationMonths` is never written and never read
(re-verified: only the `{}` default in `profileStore.ts` and test fixtures reference it), `realDuration`
is stamped only by the "Mostly faded" button inside the fading prompt (hidden behind
`CLINIC_FADING_PROMPT_ENABLED = false`), and "Move to history" archives with no question. A user who
metabolises Botox in 4 months keeps seeing a 6-month forecast on every new log.

## 2. Goals

- Record how long an effect lasted, when the user archives a pre-defined procedure, in one optional step.
- Maintain a per-procedure-type cumulative moving average (US-17) with a sample count; new logs of that
  type start from it instead of the clinical default.
- Show the calibrated value vs the clinical default, and let the user reset it, from Procedure Details.
- Archiving stays possible with no answer (Skip); a skipped or invalid answer never changes the baseline.

## 3. Non-Goals

- Flipping `CLINIC_FADING_PROMPT_ENABLED` (stays OFF; needs your explicit decision).
- The "Edit Estimated Lifespan" slider from US-17: **it does not exist in the codebase** (grep: zero hits).
  This task does not build it. The "override never recalibrates" rule is honoured structurally (see §6).
- Calibrating `custom` procedures (no category to average over), or `rehabDays` (only the effect window).
- Editing `realDuration` on an already-archived entry, un-archiving, or recomputing from history.
- Cloud sync, notifications, AI use.

## 4. User Stories

### Story 1: Report the real duration when moving to history
As a user, I want to say how long the effect lasted when I archive a procedure, so future forecasts fit me.

- [ ] Given a non-custom active procedure, when I tap "Move to history", then a sheet asks
  "How long did the effect last?" before archiving (Option A, §5).
- [ ] Given the sheet, when I choose Skip and Confirm, then the procedure is archived, `realDuration` is
  unset and the baseline is unchanged.
- [ ] Given I enter a valid number of months and Confirm, then the procedure is archived with
  `realDuration` set and the baseline for that key is updated by the formula in Story 2.
- [ ] Given I enter 0, a negative, non-numeric, below 0.5 or above 60, then Confirm is disabled and an
  inline error names the allowed range; nothing is archived or written.
- [ ] Given a custom procedure, when I tap "Move to history", then it archives immediately (no sheet).
- [ ] Given I tap Cancel or the backdrop, then nothing changes.

### Story 2: Cumulative moving average
- [ ] Given default 4 months and three reports of 3, then the baseline is 3.5, then 3.33, then 3.25
  (US-17 worked example) and `samples` is 1, 2, 3.
- [ ] Given a key with no entry, the first report is averaged against the clinical default (weight 1).
- [ ] Given a report of "as expected" on a log whose lifespan was 6, then a sample of 6 is recorded.

### Story 3: New logs use the baseline
- [ ] Given Botox calibrated at 5 months, when I log a new Botox, then its timeline uses a 5-month effect
  window with the fade point scaled by the same ratio as the default (4/6) and the same 7-day rehab.
- [ ] Given I log Botox before any calibration, then it behaves exactly as today.
- [ ] Given a calibration changes later, then already-logged procedures keep the lifespan they were
  created with (snapshot) — their bars do not jump.

### Story 4: See and reset calibration
- [ ] Given Procedure Details of a non-custom procedure, then a "Your timeline" card shows clinical
  default, your estimate and report count (or the no-data state).
- [ ] Given a calibrated key, when I tap "Reset to default" and confirm, then that key's entry is
  removed and new logs use the clinical default; archived `realDuration` values and existing logs stay.

## 5. UX / Behaviour — UI proposal

Components used (all existing): `RadioOptionGroup`, `RadioConfirmModal` chrome (centered Modal, same
backdrop/sheet styles), `Input` (with `suffix`), `Button`, `Card`/plum icon-circle style from
`ProcedureLifespanCard`, `Tag`, `InlineAlert` (info tone), `Toast`, `ListRow`. Tokens only (`palette.plum*`,
`colors.*`, `typography.*`); body ≥ 14px; no pink hues. **No new pattern is introduced.** Not found in
the repo: a numeric stepper component (grep `stepper`: none) — so months are entered with `Input`
(`keyboardType="decimal-pad"`, suffix "months"), the same control the fading prompt already uses.

Two things worth knowing before choosing:
1. Qualitative answers ("Under / As expected / Longer") cannot feed an average without inventing a
   number, so only **As expected** (= this log's lifespan) and **a specific number** produce samples.
2. `RadioConfirmModal` has no slot for an inline field. Option A needs either a small extension (an
   optional `renderOptionExtra`) or a thin composite `ProcedureDurationFeedbackModal` reusing its chrome.
   The design picks the composite (no change to the shared component).

### Option A — Radio sheet on "Move to history" (recommended)

```
 Clinic ▸ … ▸ Move to history
 ┌─────────────────────────────────────────┐
 │ How long did the effect last?           │  typography.h3
 │ Botox / Dysport · done 12 Mar 2026      │  textSecondary
 │ Typically ~6 months; your estimate: 6.  │
 │                                         │
 │ ( ) About as expected (6 months)        │
 │ ( ) A different length                  │
 │      ┌───────────────┐                  │  shown only when selected
 │      │ 4.5      months│                  │  Input + suffix
 │      └───────────────┘                  │
 │      Enter 0.5 – 60 months     (error)  │
 │ (•) Skip – just move to history         │  default selection
 │                                         │
 │ [ Cancel ]            [ Confirm ]       │
 └─────────────────────────────────────────┘
 After Confirm → Toast: "Estimate updated"
                        "Botox / Dysport: 6 → 5.0 months"
```
Pros: asks at the moment the user knows the answer; one decision point; Skip is one tap; reuses the
radio+Confirm/Cancel pattern. Cons: one extra step on every archive (mitigated by Skip default);
iOS cannot present this Modal while the action-sheet Modal is dismissing (handled in tech design).

### Option B — Month field on ProcedureDetailScreen, no prompt on archive

```
 Details
 Botox / Dysport
 DATE PERFORMED  [12/03/2026]
 HOW LONG DID IT LAST?   (shown for non-custom)
 [ 4.5            months ]   helper: "Optional – improves your next forecast"
 NOTE            [ ...... ]
 [            Save            ]
```
Pros: zero friction on archive; no extra Modal. Cons: user must remember to open Details; "Save" on an
active log has unclear semantics (is it archived? is the sample final?); editing later needs
replace-in-average maths; low response rate expected. Product direction (feedback at Move to history)
points to A.

**Recommendation: A for capture, plus a read-only "Your timeline" card with Reset on Details (below).**

### Surfacing the learning (both options) — Procedure Details, above DATE PERFORMED

```
 YOUR TIMELINE
 ┌────────────────────────────────────────┐
 │ (⚡)  Botox / Dysport      [2 reports]  │  plum icon circle + Tag
 │ Clinical default            6 months   │
 │ Your estimate               5.0 months │  plum, DMSans-Medium
 │ New logs start from your estimate.     │
 │ [ Reset to default ]                   │  ghost Button
 └────────────────────────────────────────┘
```
Reset → native `Alert.alert("Reset estimate?", "New Botox logs will use the 6-month clinical default.
Past logs are not changed.", [Cancel, Reset])` (binary choice; native per the multi-action-radio-picker
ruling).

### States

| State | Behaviour |
|---|---|
| Empty (no calibration) | Card: "Using the clinical default (6 months)." `InlineAlert` info: "Tell Vials how long an effect lasted when you move a procedure to history and it will adapt." No Reset button. |
| Loading | Profile not hydrated (`profile === null`): card not rendered (screen already tolerates null). |
| Error (input) | Disabled Confirm + inline `Input` error "Enter 0.5–60 months"; no write. |
| Error (storage) | `saveJson` swallows write failures by design; no UI. Documented limitation. |
| Skipped | Archive only, no toast beyond the list updating; baseline untouched. |
| First sample (n=1) | Toast "Estimate updated" / "{Name}: 6 → 5.0 months"; card Tag "1 report". |
| nth sample | Same toast; Tag "{n} reports". |
| Reset | Card returns to Empty state; Toast "Estimate reset". |
| Custom procedure | No sheet on archive; no card on Details. |
| Archived entry | Card still shown (read-only); History card keeps "Lasted ~X months (your record)". |

Copy is English-only, sentence case.

## 6. Data Requirements

- `UserProfile.individualDurationMonths`: `Partial<Record<CosmeticProcedureKey, CalibrationEntry>>`,
  `CalibrationEntry = { months: number; samples: number }` (type change; the field was never written).
  Schema v7 → v8; migration coerces any legacy bare number to `{ months: n, samples: 0 }`.
- `UserProcedureLog.expectedMonths?: number` — snapshot of the effect window at creation (absent =
  clinical default, so existing logs need no migration). A future manual lifespan edit would write this
  field, never the profile — that is how "overrides never recalibrate" holds.
- **Formula (spec defect found).** US-17's literal formula with `sampleCount = 0` gives
  `(4·0 + 3)/1 = 3`, contradicting its own text ("equivalent to (default + realDuration)/2") and its
  worked example (3.5 → 3.33 → 3.25). The example is only reproducible if the default counts as one
  prior sample. This design stores `samples` = real user reports (starts 0) and computes
  `new = (months·(samples+1) + real) / (samples+2)`; `samples += 1`. US-17 text gets corrected on approval.
- Retention: local only (AsyncStorage via `src/services/storage.ts`).

## 7. Dependencies

- Builds on US-17 (docs/USER_STORIES.md), PRD §5, `clinic-forecast-timeline`, `multi-action-radio-picker`.
- Blocks: nothing. External services: none.

## 8. Security & Privacy

- Auth: no. Data: health-adjacent but local-only, never leaves the device (no network, no contribution flow).
- Copy must not read as medical advice: the estimate is described as "your estimate" for planning only.

## 9. Success Metrics

- 100% of archive actions on non-custom procedures remain completable in ≤ 2 taps via Skip.
- Calibration maths matches the US-17 example to 2 decimals in unit tests.
- Zero regressions: tsc clean; suite-failure list identical to the origin/dev baseline.

## 10. Open Questions

None. Resolved 2026-10-14 by the product owner: Option A; corrected formula (default = one prior sample)
plus US-17 text fix; bounds 0.5-60 months with Skip as default selection; prompt also shown for
procedures archived during rehab; "Mostly faded" routed through the same domain action (flag stays OFF).
