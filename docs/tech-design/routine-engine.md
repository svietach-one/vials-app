# Technical Design: Routine Engine & UX Improvements (V2)
Spec: docs/specs/2026-07-04-routine-engine.md
Research: docs/research/routine-engine.md (binding: pipeline §3, schemas §2, decision log §4)
Author: tech-designer
Date: 2026-07-04

## 1. Architecture Overview
Pure, deterministic 8-stage pipeline in `src/utils/routineEngine/` (no React,
no stores, injected `now`/state), fed by static versioned rulesets in
`src/constants/rulesets/`. Stores stay thin; cross-store orchestration lives
in `src/domain/`. Clinical freezes, cycling, and season masks are **render-time
projections** over saved routines — never scheduled mutations.

```
rulesets.json ─┐
shelf/profile/procedures ─→ facts → context(+phototype mods) → eligibility
                              → slotting → resolve(greedy+caps) → mandates
                              → ordering → RoutinePlan + DecisionLog
modes: generate (draft) | validate (diff) | substitute | dailyView (mask)
weather (services/weather, weekly, cached) → SeasonMask → context
```

## 2. API Contracts
No HTTP endpoints (local app). External call + module contracts:

### GET Open-Meteo weekly forecast (src/services/weather/)
- Request: lat, lon (from profile city); ≤1 call / 7 days; 5 s timeout
- Response used: daily mean temperature → weekly average (°C)
- Errors: any failure / offline / stale >14 d → `SeasonMask` falls back to
  `getCurrentSeason()`; never surfaces to UI

### Engine module contracts (src/utils/routineEngine/index.ts)
- `generatePlan(input: EngineInput): RoutinePlan` — EngineInput = { products,
  routines, procedures, profile, settings, trackingState, seasonMask, date }
- `validateRoutines(input): ValidationResult` — findings + proposed plan diff
- `findSubstitute(stepId, plan, input): SubstituteResult | null`
- `getDailyView(routines, input): DailyView` — visible/frozen/adaptation per date
- All pure; determinism enforced by fixture tests.

## 3. Implementation Tasks

### engineer (scope=frontend — this app is frontend-only)
- FE-1: Rulesets + types — files: src/constants/rulesets/*.json,
  src/constants/rulesets/rulesetTypes.ts, src/types/index.ts (phototype 1–6,
  customRehabDays, userPinned, cycle/tracking types)
- FE-2: ProductFacts + regex INCI parser (boundaries, negatives, potency,
  vitamin C split + migration) — files: src/utils/routineEngine/productFacts.ts,
  src/store/productsStore.ts (migration on hydrate)
- FE-3: Context + effective ruleset (procedure phases incl. custom_default,
  phototype modifiers, SeasonMask consumption) — files:
  src/utils/routineEngine/context.ts
- FE-4: Eligibility + slotting + greedy resolution + mandates + ordering —
  files: src/utils/routineEngine/{eligibility,slotting,resolve,mandates}.ts
- FE-5: generate/validate/substitute/dailyView entry points — files:
  src/utils/routineEngine/{generate,validate,substitute,dailyView}.ts
- FE-6: Cycle state machine + application counters + adaptation phases —
  files: src/utils/routineEngine/{cycleState,adaptation}.ts,
  src/domain/trackingActions.ts, new STORAGE_KEYS
- FE-7: Weather service + seasonMask + bundled cities dataset — files:
  src/services/weather/index.ts, src/utils/routineEngine/seasonMask.ts,
  src/constants/cities.json, src/store/profileStore.ts (city, phototype 1–6
  migration)
- FE-8: UX — empty-state generate card, bottom Optimize strip, Draft Preview
  (Diff Mode) with 4-way scope commit — files: src/screens/RoutinesScreen.tsx,
  src/components/routine/{GenerateCard,OptimizeStrip,DraftPreviewSheet}.tsx,
  src/domain/routinePlanActions.ts
- FE-9: UX — symptom presets in AddProcedureModal (mandatory recovery window
  validation + affectedZones picker), "Complete My Routine" button (dynamic
  mode, Today screen), adaptation step-card status line, frozen "Paused
  until" rows, vitamin C infobox, phototype onboarding cards (6), settings
  toggle — files: src/components/clinic/AddProcedureModal.tsx,
  src/screens/TodayScreen.tsx, src/components/routine/RoutineStepCard.tsx,
  src/screens/ProductDetailScreen.tsx,
  src/components/onboarding/PhototypeCard.tsx, src/screens/ProfileScreen.tsx
- FE-10 (V3): RehabWidget component (top-anchored on Routines screen,
  consumes buildRehabWidgetState + applyRehabFilter — ALREADY SHIPPED in
  src/utils/routineEngine/rehabFilter.ts with unit tests); absorb/retire
  ClinicalRestrictionsBlock's product-facing role (lifestyle restrictions
  stay); wire getTimelineConfig custom rehabDays to customRehabDays (it
  currently hardcodes 0) — files: src/components/routine/RehabWidget.tsx,
  src/screens/RoutinesScreen.tsx, src/utils/procedureLifespanHelpers.ts

### devops-lead
- N/A (no infra changes; Open-Meteo is keyless — no secrets)

### engineer (unit tests, all tasks)
- Each task includes unit tests per .claude/rules/testing.md; FE-2/FE-4 add
  false-positive INCI fixtures and determinism/safety property tests (spec §9).

## 4. Assumptions
- Rulesets ship as static JSON imported at build time.
  Alternative: remote-config fetch. Reason: offline-first, deterministic,
  reviewable in PRs; no runtime schema risk.
- Application counters increment for every product visible in the day's view
  on check-in (no per-product granularity).
  Alternative: per-product confirmation. Reason: V2 mandates a single global
  button; over-counting is bounded and errs toward slower escalation only if
  products are hidden, which the daily view already excludes.
- Legacy grouped phototype maps to the stricter member (1_2→1, 3_4→4, 5_6→6).
  Alternative: midpoint mapping. Reason: safety-first defaults; user can edit.
- `custom_default` freeze targets = exfoliating OR irritancy ≥3 + AM SPF
  require + barrier prioritize.
  Alternative: per-preset profiles. Reason: presets differ only in duration;
  one conservative profile keeps the matrix small.
- Dynamic-mode plans express cycling via the daily view (phase → tonight's
  actives), not via scheduledDays.
  Alternative: rewrite scheduledDays nightly. Reason: no store churn; pause
  semantics need render-time state anyway.

## 5. Open Questions
- ~~Generate-button copy~~ — RESOLVED 2026-07-04: `✨ Generate Routine`;
  check-in button "Complete My Routine" (FE-8/FE-9 copy is final).
- Cities dataset source/licensing (≤500 KB) — resolve in FE-7 kickoff.
