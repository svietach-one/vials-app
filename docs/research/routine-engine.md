# Research: Rule-Based Routine Engine ("Invisible Assistant")

Task slug: `routine-engine`
Author: system-architect research pass
Date: 2026-07-03 · **V2 update 2026-07-04** (product-owner system spec)
Status: RESEARCH — input for planner (spec + tech design not yet written)

Feature: deterministic, non-AI engine that generates/validates AM/PM (and cycled)
routines from the user's Shelf, applying (1) active-ingredient conflicts,
(2) clinical procedure restrictions from the Clinic tab, (3) season rules.

---

## 0. What already exists (build on, don't duplicate)

| Asset | State | Reuse |
|---|---|---|
| `src/utils/conflictEngine.ts` | Pairwise ingredient rules, procedure collisions, seasonal + phototype checks for *procedures* | Keep as-is; the new engine consumes the same rule DB but adds resolution (it currently only *detects*) |
| `src/constants/conflictRulesDb.ts` | 4 ingredient pair rules, 2 procedure collisions, flat INCI substring map | Superseded by the richer dictionary (§2); keep IDs stable for migration |
| `src/utils/ingredientParser.ts` | `includes()` substring matching, no word boundaries, no negations, no potency | Replace with regex matchers + keep `activeTags` (wizard-confirmed) as the authoritative source |
| `RoutineStep.scheduledDays` (0–6) | Weekly day scheduling already persisted + rendered (WeeklyPlanView) | This is the natural substrate for skin-cycling (§1.4) |
| `UserProcedureLog` + `CLINICAL_RULES_DB` | rehabDays / totalEffectMonths per procedure | Rehab window = freeze window input |
| `paoHelpers`, `timeHelpers`, `routineStatus` | PAO expiry, skincare-day @04:00, season | Eligibility gates + context |

---

## 1. Edge cases & bottlenecks of a non-AI rule system

### 1.1 N-way conflicts (3+ overlapping products)
Pairwise rules form a **conflict graph** whose optimal resolution is a
max-weight independent set — NP-hard in general, trivial at shelf scale
(< ~30 products), but a naive "remove one side of each pair" is
order-dependent and can over-remove (A×B, B×C, A✓C: removing A *and* C is
wrong; removing only B keeps both).

**Decision: deterministic greedy admission.** Score every candidate product
(goal match vs `UserProfile.concerns` → potency → recency → stable tiebreak on
`addedAt`, then `id`). Admit products into a period one by one in score order;
a product is admitted only if it conflicts with nothing already admitted.
On conflict, walk a fixed **resolution ladder** (§3 step 5) instead of
dropping immediately. Properties: O(n²), fully deterministic, every decision
has a single explainable cause ("lost to X because …").

### 1.2 Product ≠ ingredient (the unit-of-action mismatch)
Rules are keyed on ingredient classes; freeze/swap/move operates on
**products**. A serum with retinol + niacinamide that loses to an AHA toner
takes its niacinamide with it. The engine must aggregate to a per-product
`ProductFacts` record (all classes + max potency + merged properties) and
resolve at product level. Corollaries:
- **Self-conflict**: one formula containing retinol *and* AHA must never flag
  against itself (manufacturer-balanced). Pair rules apply only *across* products.
- **Stacking/overdose**: two retinol serums in one night is not a pair
  "conflict" in the current DB but is a real hazard → needs an explicit
  `maxPerRoutine` stacking rule per class (not derivable from pair rules).

### 1.3 Resolution can cascade
"Move niacinamide to PM" may create a new PM conflict. Iterating "until
stable" risks oscillation (A pushes B to PM, B pushes A to AM…).
**Decision: single-pass, ordered pipeline** — periods are resolved AM first,
then PM, then day-splitting; a product may be relocated **at most once**; if
its target period also rejects it, it freezes. No fixpoint loops.

### 1.4 Skin cycling: two modes behind one setting (V2)
True skin cycling is a 4-night loop (exfoliation / retinoid / recovery /
recovery) — 7 % 4 ≠ 0, so cycle nights drift across weekdays; a pure
calendar model can't survive skipped nights.

**DECIDED (V2):** routine setting `Routine Cycle Type = fixed | dynamic`,
default `fixed`.

- **Fixed Calendar Days (default).** Actives map statically to weekdays via
  the existing `scheduledDays` (e.g. AHA → Tue, retinoid → Mon/Thu).
  Deterministic, zero migration, renders in the existing WeeklyPlanView.
  Summary views stay ordinary AM/PM lists — no "Recovery night" labels.
- **Dynamic 4-Day Skin Cycling (opt-in, lazy tracking).** Driven by
  *behavior*, not the calendar. Opting in activates one global
  **"Complete My Routine"** check-in button on the daily home screen — no
  per-product checkboxes. State machine persisted in the routines store:
  `{ cyclePhaseIndex: 0..3, lastAppliedDate: string | null }` over the fixed
  sequence `exfoliation → retinoid → recovery → recovery`. A check-in on a
  new skincare day advances the phase; **a missed night pauses the cycle** —
  the uncompleted phase shifts forward to the next check-in, so actives are
  never applied out of order after a gap. The failure mode always degrades
  toward *more recovery*: the safe direction.

Edge semantics the spec must pin down:
- Check-in is **idempotent per skincare day** (04:00 boundary via
  `getSkincareDateString`); a second tap the same day is a no-op.
- No retroactive backfill in Phase 1 — forgetting to tap stalls the cycle
  even if the user did apply products. Accepted trade-off: the drift is
  barrier-safe (extra recovery, never extra acid).
- Dynamic mode cannot be expressed in `scheduledDays`; the daily mask (§3)
  computes tonight's phase from `(state, date)` at render time.
  Determinism holds: same state + date ⇒ same view; tests inject both.
- Check-in events also increment the per-product application counters that
  drive the adaptation pipeline (§2.6).
- Switching dynamic → fixed discards cycle state after confirmation;
  fixed → dynamic starts at phase 0 (exfoliation) on the next check-in.

### 1.5 Clinical freeze is a *time-varying view*, not an edit
A peel logged today freezes acids for 14 days; on day 15 they must silently
return. If generation *rewrites* the routine, un-freezing needs a scheduled
mutation (fragile offline). **Decision: freezes are a render-time mask.**
The stored routine keeps all steps; the engine computes a per-date
`DailyView` (visible steps + frozen steps with `unfreezeDate` + reason).
Logging/deleting a procedure changes the mask instantly with no data loss and
no regeneration. Regeneration is only ever a user-initiated draft.

**V3 refinement (2026-07-04, architectural audit): shield widget + long-term
decoupling.**
- *Rule A — short-term (days):* while any procedure has remaining rehab days
  covering the face, masking is never silent — a persistent
  **RehabWidget** anchors at the top of the Daily Routine screen
  (`🩹 REHABILITATION: [Name] (Day X of Y)…`) and explains the lock. Widget
  state (`RehabWidgetState`: procedureName, currentDay, totalDays,
  barrierStatus disrupted/sensitive, affectedZones) is a pure render-time
  derivation — it self-destructs on day Y+1 with zero mutations. Shipped:
  `src/utils/routineEngine/rehabFilter.ts` (`buildRehabWidgetState` +
  `applyRehabFilter`), first engine module, 15 unit tests green.
- *Rule B — long-term (months):* procedures past their rehab window but with
  an active effect (Botox 6 mo, fillers 12 mo) never spawn daily-screen
  widgets/notifications; they render exclusively in the Clinic timeline
  (`computeStatus` in `procedureLifespanHelpers` already returns `'rehab'`
  only inside the window — Rule B was structurally satisfied; the audit
  confirmed it and pinned it as a spec AC).
- *Zone scoping:* `UserProcedureLog.affectedZones?: ('face'|'neck'|'decollete')[]`
  (absent → face). Phase 1 routines are implicitly face routines (products
  and steps carry no zone), so a neck-only peel leaves routines untouched;
  per-zone routines are a documented future extension, not silent scope.

Sub-cases:
- **Overlapping procedures** → union of restrictions, per-restriction `max(endDate)`.
- **Custom procedures** (`procedureKey: 'custom'`): never guess restrictions.
  **DECIDED (V2):** specifying the recovery window is **mandatory** — either
  downtime/rehab days or the planned next-procedure date
  (`estimatedReturnDate`, existing), or both. To kill input friction the
  AddProcedureModal replaces a bare number field with single-tap
  **symptom presets**:
  `Light Care` (hydration, massage, mask) → **0** rehab days ·
  `Redness / Peeling` (mild barrier disruption) → **3** days ·
  `Trauma / Laser` (micro-needling, deep peel, injections) → **7** days ·
  `Custom` → manual days or a specific next-procedure date.
  New field `UserProcedureLog.customRehabDays?: number` stores the resolved
  days; a value > 0 activates the generic conservative `custom_default`
  freeze profile (§2.2) for that window. 0 days (Light Care) or a date-only
  entry drives the timeline but applies no product freezes.
- **Botox massage ban** targets *application style*, not chemistry → products
  need a `massageRequired`-type property (facial-massage balms, gua-sha oils).

### 1.6 Regex/INCI pitfalls (the false-positive minefield)
- Substrings without boundaries: current `includes()` would let a future
  `"pha"` token match *sul**pha**te*, `"aha"` match *cham**omilla*… all
  matchers must be `\b`-anchored regexes.
- **Derivative ≠ parent**: sodium ascorbyl phosphate is currently mapped to
  `vitamin_c` and inherits the *low-pH pure LAA* conflict — wrong; derivatives
  are pH-neutral. Matchers need per-synonym **conflict-class overrides**
  (`vitamin_c_pure` vs `vitamin_c_derivative`).
- **Potency tiers**: retinyl palmitate ≪ retinol ≪ tretinoin. A `caution`
  pair involving a low-potency form should downgrade or vanish
  (rule `exceptions` clause).
- Negations: "retinol-free", "sans rétinol" → `negativePatterns` checked first.
- Marketing text vs INCI list: only parse `fullIngredientText`; and
  wizard-confirmed `activeTags` always **wins over** the parse (per the
  existing comment on `Product.activeTags`). Parse is a fallback + a
  "we found something you didn't tag" hint.
- Willow bark / salicylate vs salicylic acid; "lactic" vs "sodium lactate" —
  every matcher needs a false-positive test fixture in
  `src/utils/routineEngine/productFacts.test.ts`.

### 1.7 Seasonal rules
- **SPF mandate with no SPF on the shelf**: the engine cannot conjure a
  product. Degrade to a single quiet placeholder step ("SPF — add one to
  your shelf") — never a modal, never a red banner (UX constraint).
- **Season transitions are weather-driven, not calendar-driven (V2).**
  Privacy-first: no GPS permission request — the user picks a city via a
  text-autocomplete field in the profile, backed by a **bundled offline
  city → coordinates/climate-zone dataset** (`src/constants/cities.json`).
  A low-overhead weather check runs at most **once a week**
  (`src/services/weather/`): weekly average temperature **< +15 °C** →
  autumn/winter mask; **> +20 °C** → spring/summer mask. The 15–20 °C gap is
  a deliberate **hysteresis band**: inside it the current mask is retained,
  which prevents week-to-week mask flapping in shoulder seasons.
- **Transitions are never silent**: crossing a threshold opens the
  **Diff View** transition screen (before → after) instead of a hard-coded
  calendar flip; the existing `SeasonalNoticeBanner` + `dismissedBanners`
  pattern covers the post-transition reminder.
- **Mandatory fallback chain** (same never-block principle as OBF): no city
  set / offline / API error / cached weather older than 14 days → fall back
  to calendar season via the existing `getCurrentSeason()` (timezone check
  unchanged, Northern Hemisphere priority). The engine consumes one
  `SeasonMask` input and never knows which source produced it.

### 1.8 Trust & determinism (the real bottleneck)
- CPU is a non-issue (n < 30, all O(n²)); the true bottlenecks are **rule
  data quality** and **explainability**. Every engine decision must carry a
  `reasonCode` + rule id; the minimalist UI hides them, but a "why?"
  affordance (long-press / detail row) must be able to answer "where did my
  retinol go?". Invisible ≠ unaccountable.
- Full determinism: no `Math.random`, no unkeyed object iteration for
  ordering, all tiebreaks on stable fields. Same shelf + same date + same
  procedures ⇒ byte-identical plan (this is also the test strategy).
- **User pinning**: if the user manually re-adds a product the engine froze,
  respect it (mark `userPinned`) — engine never removes pinned steps except
  during a clinical freeze with severity `avoid` (safety beats preference).
- **Ruleset versioning**: stamp generated plans with a dictionary `version`;
  a rules update prompts revalidation, never a silent rewrite.

### 1.9 Other gates the generator must respect
Hidden products (`isHidden`), PAO-expired products (`openedDate + paoMonths`),
`usageTime` ('evening'-only product can never be relocated to AM as a
resolution move), photosensitizing classes are PM-only + trigger the AM SPF
mandate, `eye_cream`/`other` need defined slots in the layering order.

---

## 2. JSON dictionary schema

Three files under `src/constants/rulesets/` (typed via `zod` or hand-written
guards, imported statically — no runtime fetch in Phase 1):
`actives.json`, `procedures.json`, `seasons.json`. One shared `version`.

Core idea: **rules target properties, not enumerated classes** wherever
possible (`photosensitizing`, `exfoliating`, `irritancy`, `barrierRepair`,
`massageRequired`), so a newly added active inherits clinical/seasonal
behavior for free; only true pair chemistry enumerates class keys.

### 2.1 `actives.json` — classes, synonyms, regex roots

```jsonc
{
  "version": "2026-07-03",
  "classes": {
    "retinoid": {
      "displayName": "Retinoids",
      "matchers": [
        { "pattern": "\\bretin(ol|al|aldehyde)\\b",            "potency": "high" },
        { "pattern": "\\bretinyl\\s+(palmitate|acetate)\\b",   "potency": "low"  },
        { "pattern": "hydroxypinacolone\\s+retinoate",         "potency": "medium" },
        { "pattern": "\\b(tretinoin|adapalene|tazarotene)\\b", "potency": "rx"   }
      ],
      "negativePatterns": ["retinol[\\s-]*free"],
      "properties": {
        "photosensitizing": true,
        "exfoliating": false,
        "irritancy": 3,
        "barrierRepair": false
      },
      "allowedPeriods": ["pm"],
      "stacking": { "maxPerPeriod": 1 },
      "cycleClass": "retinoid"          // groups classes that share cycle nights
    },
    "aha": {
      "displayName": "AHA acids",
      "matchers": [
        { "pattern": "\\b(glycolic|lactic|mandelic|tartaric|malic)\\s+acid\\b", "potency": "high" }
      ],
      "negativePatterns": ["\\bsodium\\s+lactate\\b"],
      "properties": { "photosensitizing": true, "exfoliating": true, "irritancy": 3, "barrierRepair": false },
      "allowedPeriods": ["pm"],
      "stacking": { "maxPerPeriod": 1, "sharedCapWith": ["bha", "pha"] },
      "cycleClass": "exfoliant"
    },
    "vitamin_c_pure": {
      "displayName": "Vitamin C (L-ascorbic)",
      "matchers": [{ "pattern": "\\b(l-)?ascorbic\\s+acid\\b", "potency": "high" }],
      "properties": { "photosensitizing": false, "exfoliating": false, "irritancy": 2, "lowPh": true },
      "allowedPeriods": ["am", "pm"]
    },
    "vitamin_c_derivative": {
      "displayName": "Vitamin C derivatives",
      "matchers": [
        { "pattern": "\\b(sodium|magnesium)\\s+ascorbyl\\s+phosphate\\b", "potency": "medium" },
        { "pattern": "\\b(ethyl\\s+ascorbic|ascorbyl\\s+(glucoside|tetraisopalmitate))", "potency": "medium" }
      ],
      "properties": { "irritancy": 1, "lowPh": false },
      "allowedPeriods": ["am", "pm"]
    }
    // niacinamide, bha, pha, benzoyl_peroxide, azelaic, copper_peptides,
    // spf_filters, ceramides/barrier, hyaluronic, panthenol, cica ...
  },
  "pairRules": [
    {
      "id": "rule_retinoid_aha",                  // keep legacy ids where they exist
      "a": "retinoid", "b": "aha",
      "scope": "same_period",                     // same_period | same_day | anywhere
      "severity": "avoid",
      "resolutions": ["separate_days", "freeze_lower_priority"],  // ordered ladder
      "exceptions": [{ "whenPotencyAtMost": { "a": "low" }, "downgradeTo": "caution" }],
      "explanation": "…", "suggestion": "…"
    },
    {
      "id": "rule_vitc_niacinamide",
      "a": "vitamin_c_pure", "b": "niacinamide",  // note: derivative class NOT listed
      "scope": "same_period",
      "severity": "caution",
      "resolutions": ["separate_periods", "keep_with_note"],
      "explanation": "…", "suggestion": "…"
    }
  ]
}
```

Notes:
- `matchers[].pattern` are case-insensitive, `\b`-anchored regex sources
  compiled once at startup; `negativePatterns` strip matches before
  positive matching runs.
- `potency` participates in scoring and in pair-rule `exceptions`.
- Splitting `vitamin_c` into `_pure`/`_derivative` fixes the current
  false-conflict. **DECIDED:** auto-migrate the legacy `vitamin_c` activeTag
  to `vitamin_c_pure` (safe/conservative default — keeps the low-pH conflict
  active) and show a subtle infobox on the product detail card
  ("Treated as pure vitamin C — tap to change if this is a derivative")
  linking into the tag wizard. No blocking prompt, no modal.

### 2.2 `procedures.json` — freeze windows as phased product rules

```jsonc
{
  "version": "2026-07-03",
  "procedures": {
    "chemical_peel_deep": {
      "rehabDays": 14,                             // stays consistent with CLINICAL_RULES_DB
      "productRules": [
        {
          "phase": { "fromDay": 0, "toDay": 14 },
          "action": "freeze",
          "targets": { "properties": { "exfoliating": true } },
          "reasonCode": "peel_rehab_no_exfoliants"
        },
        {
          "phase": { "fromDay": 0, "toDay": 14 },
          "action": "freeze",
          "targets": { "classes": ["retinoid", "vitamin_c_pure", "benzoyl_peroxide"] },
          "reasonCode": "peel_rehab_no_aggressive_actives"
        },
        {
          "phase": { "fromDay": 0, "toDay": 30 },
          "action": "require",
          "targets": { "productTypes": ["spf"] }, "period": "am",
          "reasonCode": "peel_spf_mandatory"
        },
        {
          "phase": { "fromDay": 0, "toDay": 14 },
          "action": "prioritize",
          "targets": { "properties": { "barrierRepair": true } },
          "reasonCode": "peel_sos_recovery"
        }
      ]
    },
    "botox": {
      "rehabDays": 7,
      "productRules": [
        {
          "phase": { "fromDay": 0, "toDay": 7 },
          "action": "freeze",
          "targets": { "properties": { "massageRequired": true } },
          "reasonCode": "botox_no_massage"
        }
      ]
    }
    // fillers, smas_lifting, mesotherapy, mechanical_facial …
    "custom_default": {
      // Applied to procedureKey 'custom' when the user provided customRehabDays.
      // rehabDays comes from the log entry, not from this file.
      "productRules": [
        {
          "phase": { "fromDay": 0, "toDay": "rehabEnd" },
          "action": "freeze",
          "targets": { "anyOf": [
            { "properties": { "exfoliating": true } },
            { "properties": { "irritancy": ">=3" } }
          ]},
          "reasonCode": "custom_rehab_conservative"
        },
        {
          "phase": { "fromDay": 0, "toDay": "rehabEnd" },
          "action": "require",
          "targets": { "productTypes": ["spf"] }, "period": "am",
          "reasonCode": "custom_rehab_spf"
        },
        {
          "phase": { "fromDay": 0, "toDay": "rehabEnd" },
          "action": "prioritize",
          "targets": { "properties": { "barrierRepair": true } },
          "reasonCode": "custom_rehab_recovery"
        }
      ]
    }
  }
}
```

`"toDay": "rehabEnd"` is a sentinel resolved at context-build time from the
log's `customRehabDays` (custom) or the procedure's `rehabDays` (predefined).

Action vocabulary (closed set): `freeze` (hide from daily view, dimmed row,
auto-expires), `require` (mandated slot; placeholder if shelf lacks it),
`prioritize` (score boost + "SOS" ordering), `limit` (frequency cap, e.g.
exfoliate ≤1×/week during late rehab). Phases are day offsets from
`datePerformed` (skincare-day @04:00 via `getSkincareDateString`).

### 2.3 `seasons.json`

```jsonc
{
  "version": "2026-07-03",
  "rules": [
    {
      "id": "summer_spf_mandate",
      "seasons": ["summer"],
      "if": { "planContainsProperty": "photosensitizing" },
      "then": { "action": "require", "targets": { "productTypes": ["spf"] }, "period": "am" },
      "severity": "avoid",
      "reasonCode": "summer_photosensitizer_spf"
    },
    {
      "id": "summer_demote_strong_exfoliants",
      "seasons": ["summer"],
      "then": { "action": "limit", "targets": { "properties": { "exfoliating": true } },
                "maxDaysPerWeek": 1 },
      "severity": "caution",
      "reasonCode": "summer_uv_exfoliant_limit"
    },
    {
      "id": "winter_barrier_priority",
      "seasons": ["winter"],
      "then": { "action": "prioritize", "targets": { "properties": { "barrierRepair": true } },
                "period": "pm" },
      "reasonCode": "winter_barrier_repair"
    }
  ]
}
```

### 2.4 `phototypeModifiers` — Fitzpatrick scale as a rule-severity modifier (V2)

**Data model change:** `UserProfile.phototype` moves from the grouped union
(`'type_1_2' | 'type_3_4' | 'type_5_6'`) to the full Fitzpatrick scale
`1 | 2 | 3 | 4 | 5 | 6`, gathered in onboarding via consumer-friendly visual
cards (skin-tone description + sun-reaction behavior; extend the existing
`PhototypeCard`). Migration maps each group to its *stricter* member:
`type_1_2 → 1` (stricter SPF), `type_3_4 → 4` (stricter PIH),
`type_5_6 → 6`. Editable afterwards in the profile.

Phototype never adds or removes rules; it **modifies severity, caps, and
mandates** of the effective ruleset built at context time. Lives at the
`actives.json` top level as a closed effect vocabulary:

```jsonc
{
  "phototypeModifiers": [
    {
      "types": [4, 5, 6],                          // high-melanin: PIH control
      "effects": [
        { "effect": "escalatePairSeverity",
          "when": { "bothProductsProperties": { "irritancy": ">=2" } },
          "from": "caution", "to": "avoid",
          "reasonCode": "phototype_pih_risk" },
        { "effect": "tightenLimit",
          "targets": { "properties": { "exfoliating": true } },
          "maxDaysPerWeek": 1,
          "reasonCode": "phototype_pih_exfoliant_cap" }
      ]
    },
    {
      "types": [1, 2],                             // low-melanin: UV defense
      "effects": [
        { "effect": "addMandate",
          "if": { "planContainsProperty": "photosensitizing" },
          "then": { "action": "require", "targets": { "productTypes": ["spf"] },
                    "period": "am" },
          "nonSkippable": true,
          "reasonCode": "phototype_uv_sensitivity_spf" }
      ]
    }
    // type 3: no modifiers — baseline ruleset applies
  ]
}
```

Semantics per V2:
- **Types 4–6** — elevated PIH risk: any `caution`-level pair where *both*
  products are meaningfully irritant (concurrent strong actives, e.g.
  retinoid + strong AHA) escalates to `avoid`, forcing day-splitting or a
  freeze instead of coexistence; exfoliant frequency caps tighten.
- **Types 1–2** — minimal natural UV defense: if any photosensitizing active
  is live in the plan, the AM SPF requirement becomes **non-skippable**
  (the placeholder step cannot be dismissed and validate mode treats a
  missing SPF as `avoid`, not `caution`).
- **Type 3 / `phototype: null`** — baseline rules, no modifiers.
- **Self-conflict exception (explicit V2 rule):** if both conflicting
  actives are pre-formulated in a single product, all separation rules —
  including phototype escalations — are bypassed. Modifiers apply **only
  when layering distinct products** (Product A over Product B). This is the
  §1.2 product-level aggregation rule, restated here because the escalation
  must never leak into single-bottle formulas.

Modifiers apply once, deterministically, when the effective ruleset is built
(pipeline step 2) — downstream stages never re-check phototype.

### 2.5 Derived per-product record (computed, cached — not stored JSON)

```ts
interface ProductFacts {
  productId: string;
  classes: { key: ActiveClassKey; potency: Potency; source: 'tag' | 'parse' }[];
  properties: AggregatedProperties;   // OR-merge of class properties, max(irritancy)
  allowedPeriods: ('am' | 'pm')[];    // intersection of class constraints ∩ product.usageTime
  eligible: boolean;                  // !isHidden && !paoExpired
}
```

Cache key: `hash(activeTags, fullIngredientText, rulesetVersion)`.

### 2.6 `adaptation` — micro-dosing escalation for irritating actives (V2)

When a product whose facts include an adapting class (any class declaring an
`adaptation` block — retinoids, strong acids, benzoyl peroxide) lands on the
shelf, the engine runs a per-product escalation schedule keyed to `addedAt`
and the **actual application count**:

```jsonc
// actives.json, per class
"adaptation": {
  "phases": [
    { "throughApplication": 4, "maxDaysPerWeek": 2, "minRestHours": 72 },
    { "throughApplication": 8, "maxDaysPerWeek": 4 },
    { "afterApplication": 8 }        // standard engine rules take over
  ]
}
```

- **Counting source.** In dynamic-cycling mode, each "Complete My Routine"
  check-in increments the counter of every product visible in that day's
  view (`ProductApplicationStats { productId, count, lastAppliedDate }`,
  new storage key). **Fallback when tracking is off (fixed mode):** a
  deterministic *virtual* count derived from `addedAt` assuming the capped
  schedule was followed — phase 1 ≈ weeks 1–2, phase 2 ≈ weeks 3–4, phase 3
  from week 5. Same phase interface either way; the engine never branches
  on the tracking source downstream.
- **Enforcement.** Adaptation caps join the stacking caps inside the
  admission loop (pipeline step 5) as `limit` actions: phase 1 schedules the
  product ≤ 2 days/week with a ≥ 72 h gap between scheduled days; phase 2
  every other night; phase 3 removes the cap.
- **UI callout (the one deliberate visibility exception):** the routine step
  card shows `⏳ Adaptation Phase (Week X of 4) — frequency managed by the
  engine to prevent purging/peeling`, where the week is derived from the
  current phase. This is status, not a warning — no banner, no modal.
- Edge cases: counter never decrements (deleting/re-adding the same product
  restarts adaptation — correct, skin re-adapts after breaks); a product
  already owned for 5+ weeks before this feature ships starts in phase 3
  via the virtual count (no retroactive throttling).

### 2.7 Climate & tracking config (V2)

```jsonc
// seasons.json additions
"climate": {
  "thresholds": { "coldBelowC": 15, "warmAboveC": 20 },   // hysteresis band 15–20
  "checkIntervalDays": 7,
  "staleAfterDays": 14                                     // then calendar fallback
}
```

New/changed persisted state (all through `src/services/storage.ts` keys):

```ts
// settingsStore
routineCycleType: 'fixed' | 'dynamic';           // default 'fixed'
// profileStore
phototype: 1 | 2 | 3 | 4 | 5 | 6 | null;         // migrated from grouped union
city: { name: string; lat: number; lon: number } | null;
// routinesStore (or a small new trackingStore)
cycleState: { cyclePhaseIndex: 0 | 1 | 2 | 3; lastAppliedDate: string | null };
applicationStats: ProductApplicationStats[];
seasonMaskCache: { mask: SeasonMask; fetchedAt: string; source: 'weather' | 'calendar' };
```

Weather client lives in `src/services/weather/` (fetch stays in the services
layer). Recommended provider: **Open-Meteo** — free, keyless (no
`EXPO_PUBLIC_*` secret to manage), returns weekly temperature aggregates
directly. City autocomplete reads the bundled `src/constants/cities.json`
offline dataset; no network needed to pick a city.

---

## 3. Pipeline architecture

```
Clinic log / product change / season tick / "Generate" tap
        │
        ▼
┌─ 1 FACTS ────────────┐  products → ProductFacts (tags ∪ regex parse, negatives, potency)
├─ 2 CONTEXT ──────────┤  date → season, procedures → active phases, profile
├─ 3 ELIGIBILITY ──────┤  hard gates: hidden, PAO-expired, clinical freeze, usageTime
├─ 4 SLOTTING ─────────┤  layering template per period, candidates per slot
├─ 5 RESOLUTION ───────┤  greedy admission + resolution ladder + stacking caps
├─ 6 MANDATES ─────────┤  seasonal/clinical require + prioritize + limits, placeholders
├─ 7 ORDERING ─────────┤  layering index sort (…SPF last AM, occlusives last PM)
└─ 8 PLAN + DECISIONS ─┘  RoutinePlan draft + DecisionLog[]
        │
        ├── generate mode → draft preview → user Save (writes routinesStore) / Discard
        ├── validate mode → decisions only → quiet "Optimize" affordance
        └── daily mask   → per-date view over the SAVED routine (freezes, cycling, season)
```

**Step 1 — Facts.** `buildProductFacts(product, ruleset)` (pure,
`src/utils/routineEngine/productFacts.ts`). `activeTags` authoritative;
INCI regex parse fills gaps; negatives applied first.

**Step 2 — Context.** `buildRoutineContext(date, procedures, profile)`:
for each non-archived procedure compute `dayOffset = date − datePerformed`
and collect every `productRule` whose phase contains it (custom procedures
with `customRehabDays` use the `custom_default` profile). Overlapping
procedures merge; equal targets keep `max(toDay)`. This step also builds the
**effective ruleset**: `phototypeModifiers` for `profile.phototype` are
applied here — pair-rule severities escalated, limits/stacking tightened,
extra mandates added — so steps 3–7 consume one already-modified ruleset and
never branch on phototype themselves. Context additionally carries the
resolved `SeasonMask` (weather-driven with calendar fallback, §1.7), the
cycle state machine + per-product application stats (dynamic mode, §1.4),
and each adapting product's current adaptation phase (§2.6).

**Step 3 — Eligibility.** Hard gates only, each rejection recorded as
`{ productId, gate, reasonCode, until? }`. Frozen items are *not* discarded —
they flow to the UI as dimmed "Paused until Jul 17" rows.

**Step 4 — Slotting.** Static layering table (per period) keyed by
`ProductType`: cleanser → toner → essence → ampoule → serum/gel →
spot_treatment → eye_cream → lotion/cream/moisturizer → oil/balm →
spf (AM only). `other` slots after serums. Multiple products per slot are
allowed; they compete in step 5.

**Step 5 — Resolution (the core).** Deterministic greedy admission per §1.1:
score → admit → on pair-conflict walk the rule's `resolutions` ladder:
1. `separate_periods` — relocate loser to its other allowed period (once, max).
2. `separate_days` — split via `scheduledDays` (weekday-aligned cycling §1.4),
   respecting seasonal `limit` caps.
3. `freeze_lower_priority` — loser becomes a frozen row with the rule's
   explanation as its "why".
4. `keep_with_note` — `caution`-only: both stay, ordering hint applied
   (e.g. vit-C first, 10-min gap note lives in the step detail, not a banner).
Stacking caps (`maxPerPeriod`, `sharedCapWith`), seasonal/clinical `limit`
actions, and **adaptation-phase caps** (§2.6 — maxDaysPerWeek + minRestHours
per adapting product) all run in the same admission loop, so a day-split
resolution can never violate a frequency cap.

**Step 6 — Mandates.** `require` unmet by the shelf ⇒ one placeholder step
per period max. `prioritize` boosts admission score and pins "SOS" items
near the top of their slot.

**Step 7 — Ordering.** Sort by layering index; ties by admission score, then
`addedAt`. Output is stable.

**Step 8 — Plan.**

```ts
interface RoutinePlan {
  rulesetVersion: string;
  generatedFor: string;               // skincare date
  periods: { morning: PlannedStep[]; evening: PlannedStep[] };
  frozen: FrozenItem[];               // productId, reasonCode, until
  placeholders: PlaceholderSlot[];    // e.g. missing SPF
  decisions: DecisionLog[];           // every admit/relocate/split/freeze with rule id
}
```

**Modes over the same pipeline:**
- **Generate** — input = whole eligible shelf; output = a full AM+PM draft.
  Two entry points (V2):
  **A — empty state:** central card with primary action `✨ Generate Routine`
  (final copy, product owner 2026-07-04 — no "AI Engine" wording) and
  secondary `Add Products Manually`.
  **B — populated state:** the header pencil icon stays strictly manual
  (reorder/delete); a contextual action strip at the very bottom of the
  routine view reads `✨ Optimize or Regenerate Routine`.
  Tapping generation **never mutates live data**: it opens the
  **Draft Preview (Diff Mode)** — a "Before → After" layout with at most
  2–3 quiet summary lines ("Acids and retinol split across nights",
  "1 product paused until Jul 17") — and a commit scope choice:
  `Save for Both (AM & PM)` / `Save for AM Only` / `Save for PM Only` /
  `Cancel / Discard Draft`.
  The engine always resolves both periods together (cross-period moves like
  "vitamin C to AM" require it); the scope only controls which routine(s)
  the save writes. Partial apply (e.g. PM only) keeps the untouched routine
  as-is and re-runs *validate* over the combined result, so a scope-induced
  conflict lights the bottom action strip — never a modal.
  Save writes through a `src/domain/routinePlanActions.ts` action
  (cross-store: routines + nothing else mutated).
- **Validate** — input = user's saved routine; engine runs steps 1–7 without
  mutating and diffs against the saved state. Any `avoid`-level finding
  activates the same bottom `✨ Optimize or Regenerate Routine` strip
  (entry point B doubles as the finding indicator); tapping opens the Diff
  Mode preview with the proposed swaps. No red banners, no modals (UX
  constraint: conflict warnings only in routines — holds). The Diff View is
  also the surface for weather-driven season transitions (§1.7).
- **Substitute** — `findSubstitute(stepId, plan, facts, context)`: candidates =
  eligible shelf products of the same slot `ProductType`, conflict-free
  against the *rest of the admitted set*, ranked by the same score. Returns
  best + reason; deterministic.
- **Daily mask** — `getDailyView(routine, date, context)`: cheap render-time
  projection used by RoutinesScreen/TodayScreen selectors. A procedure logged
  in Clinic changes the mask on next render — no regeneration, no stored
  mutation, auto-unfreeze on expiry (§1.5).

**Module layout (layer rules respected — utils stay pure, no store/React):**

```
src/constants/rulesets/{actives,procedures,seasons}.json + rulesetTypes.ts
src/constants/cities.json            // bundled offline city→coords dataset
src/utils/routineEngine/
  productFacts.ts   eligibility.ts   slotting.ts
  resolve.ts        mandates.ts      dailyView.ts
  generate.ts       validate.ts      substitute.ts
  cycleState.ts     adaptation.ts    seasonMask.ts
  (+ co-located *.test.ts, deterministic fixtures, injected `now`/state)
src/services/weather/                // Open-Meteo client (fetch stays here)
src/domain/routinePlanActions.ts     // orchestration, store writes
src/domain/trackingActions.ts        // check-in: cycle advance + counters
src/hooks/useDailyRoutineView.ts     // memoized selector for screens
```

**Event triggers → cheapest sufficient reaction:**

| Event | Reaction |
|---|---|
| Procedure logged / edited / removed (incl. custom presets) | Recompute context → daily mask updates; if a saved step is now `avoid`-frozen, show the quiet notice line |
| Product added / hidden / deleted / PAO-expired | Facts cache entry invalidated → validate mode may light the bottom Optimize strip; adapting actives start their §2.6 schedule |
| "Complete My Routine" check-in (dynamic mode) | Advance cycle phase (idempotent per skincare day) + increment application counters; adaptation phase may advance |
| App open on a new skincare day | Recompute daily mask (freeze expiry, cycle pause, adaptation virtual count) |
| Weekly weather check succeeds (city set) | Recompute `SeasonMask`; on threshold crossing open the Diff View transition screen |
| Weather unavailable / stale > 14 days | Silent fallback to calendar season — never blocks, never notifies |
| Generate / Optimize tap | Full pipeline in generate mode → Draft Preview (Diff Mode) |

---

## 4. Decision log (V1 resolved 2026-07-03 · V2 spec 2026-07-04)

All open questions are resolved by the product-owner V2 spec. Where V2
supersedes a V1 decision, V2 wins.

1. **Custom procedures** — recovery window input is mandatory: rehab days
   and/or next-procedure date. UX = single-tap **symptom presets**
   (Light Care 0 d · Redness/Peeling 3 d · Trauma/Laser 7 d · Custom).
   `customRehabDays` > 0 → `custom_default` freeze profile (§1.5, §2.2).
2. **Cycling** — settings toggle `Routine Cycle Type`: **Fixed Calendar
   Days** (default, static weekday mapping, plain lists, no night labels)
   vs **Dynamic 4-Day Skin Cycling** with the global "Complete My Routine"
   check-in and pause-on-miss semantics (§1.4). *Supersedes V1
   "weekday-aligned only, cycling deferred to Phase 2".*
3. **Adaptation pipeline** *(new in V2)* — application-count-based
   escalation for irritating actives (≤4 apps: 2×/week + 72 h rest;
   5–8: every other night; 9+: standard rules), virtual count fallback when
   tracking is off, `⏳ Adaptation Phase (Week X of 4)` step-card callout
   (§2.6).
4. **Vitamin C migration** — auto-migrate legacy `vitamin_c` →
   `vitamin_c_pure` (safe default), subtle infobox on the product detail
   card to reclassify as derivative (§2.1). No prompts.
5. **Generate scope & entry points** — empty-state card (Generate / Add
   Manually) + bottom `✨ Optimize or Regenerate` strip; pencil stays
   manual-only. Draft Preview is a Before → After **Diff Mode**; commit
   scope: Both / AM only / PM only / Discard. Never mutates live data
   directly; `userPinned` steps carry over (§3).
6. **Phototype** — full Fitzpatrick `1–6` field on `UserProfile` via visual
   onboarding cards; types 4–6 escalate caution→avoid for layered strong
   actives (PIH control); types 1–2 get a non-skippable AM SPF mandate when
   photosensitizers are present; explicit single-bottle self-conflict
   exception (§2.4). *Supersedes the grouped `type_x_y` union.*
7. **Seasons** — weather-driven masks: city autocomplete (no GPS), weekly
   temperature check, thresholds +15 °C / +20 °C with a hysteresis band,
   Diff View on transition, hard fallback to calendar season (§1.7).
   *Supersedes V1 "calendar seasons, Northern-priority only" — the calendar
   path survives as the mandatory fallback.*

---

## 5. Flags for product review (spec tensions to resolve before build)

1. **English-only UI (CLAUDE.md constraint). RESOLVED 2026-07-04:** the
   check-in button ships as **"Complete My Routine"** (product-owner final
   copy; the V2 spec's Russian "Нанесла уход" was a source-language note).
   Gender-neutral, English-only — constraint satisfied.
2. **"Generate via AI Engine" naming. RESOLVED 2026-07-04:** final UI copy is
   **`✨ Generate Routine`** — no "AI Engine" wording anywhere in the app,
   consistent with the no-AI/LLM principle. ("Smart Engine" remains available
   as an out-of-app marketing term.)
3. **First non-OBF network dependency.** The weather check is the second
   network touchpoint in an offline-first app. Non-negotiables carried into
   the spec: keyless provider (Open-Meteo), ≤1 request/week, cached result,
   silent calendar fallback, zero behavior change when offline forever.
4. **Gamification boundary.** The check-in button is *functional tracking*
   (cycle state + adaptation counters), not gamification (no streaks, no
   rewards), and appears only in opt-in dynamic mode — consistent with
   "gamification opt-in, default OFF". The spec must state this explicitly
   so the tech-lead review doesn't flag it as scope creep.
5. **Migrations shipped together:** grouped phototype → 1–6 (stricter-member
   mapping), `vitamin_c` tag → `vitamin_c_pure`, new storage keys
   (cycle state, application stats, season-mask cache, city).
