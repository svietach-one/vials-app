# Pregnancy freeze pin-survival fix
Date: 2026-07-30
Author: planner-agent
Jira: N/A (kebab-case task slugs only, per .claude/rules/agent-layer-protocol.md)
Status: DRAFT

## 1. Problem Statement

`buildStepsFromPlan` (`src/utils/routineEngine/planApply.ts`) is the pure function behind the Draft→Save
commit path — the one place a saved routine's steps get rewritten from a freshly generated plan. It
already implements one safety rule correctly: a `userPinned` step whose product is under an active
clinical (procedure rehab) freeze is dropped, not re-appended, on save — "safety beats preference." It
implements this by checking `FrozenItem.until` (the freeze's expiry date): if `until` is set, the pin is
overridden; if not, the pin survives.

That check is a proxy, not the real rule, and the proxy is now provably wrong. `until`'s presence tells
you whether a freeze happens to be day-windowed — not whether it is safety-critical. Every freeze source
that existed when this logic was written (procedure rehab) was both day-windowed AND safety-critical, so
the proxy held by coincidence. `pregnancy-safety-handling`'s pregnancy freeze breaks the coincidence: it is
safety-critical (spec `docs/specs/pregnancy-safety-handling.md` Story 1, tech design Assumption 2 — the
same structural non-overridability guarantee as a clinical freeze) but persistent, with no natural expiry,
so it never sets `until`. Net effect, confirmed by direct code reading: a user who pinned a retinoid step
before marking themselves pregnant keeps that pin surviving every subsequent Draft→Save regeneration even
while the pregnancy freeze is active on that same product — the one place in the whole feature where the
"non-overridable" guarantee does not actually hold. This was found and logged as a non-blocking follow-up
by tech-lead review of `pregnancy-safety-handling` (`progress/pregnancy-safety-handling.md`, Point C,
2026-07-29), non-blocking only because `PREGNANCY_SAFETY_ENABLED` is currently `false` (the gap is inert).
Clinical sign-off has now happened and the human intends to flip that flag; the tech-lead's review
explicitly recommended resolving this gap "before or alongside" that flip. The human chose to resolve it
first, as its own full-cycle task.

This task's own investigation (reading `planApply.ts`, every `FrozenItem` construction site in
`resolve.ts`/`generate.ts`, and every existing test) also confirms the tech-lead's in-passing note that
pair-rule/cumulative-active-cap freezes are *also* `until`-less. That is not a second instance of this bug:
`planApply.test.ts` already has a passing, intentional test — `'keeps a pinned step frozen by a pair rule
(no expiry) — pins beat preferences'` — proving pin-survival under a pair-rule freeze is deliberate,
existing, correct behavior (an ingredient-pairing caution is preference-tier; a user may knowingly keep a
pinned product despite it). So the fix cannot simply treat "any frozen item" as pin-overriding — it must
distinguish the two freeze tiers explicitly, correctly, for every current and future freeze source, not
just add a pregnancy-specific special case.

## 2. Goals

- A `userPinned` saved step whose product is covered by an active pregnancy freeze is dropped (not
  re-appended) by `buildStepsFromPlan` on the next Draft→Save commit — matching the existing clinical-freeze
  behavior exactly.
- The distinction between "overrides a pin" and "pin survives" is driven by an explicit, required signal on
  each `FrozenItem`, not inferred from `until`'s presence — so it stays correct for every existing and
  future freeze source without needing a fresh audit each time one is added.
- Zero behavior change for every currently non-safety freeze source (pair-rule / cumulative-active-cap
  conflicts, relocation-rejected items): pins continue to survive those, exactly as already tested today.
- Zero behavior change for the existing day-windowed clinical/procedure freeze path: pins continue to be
  dropped there, exactly as already tested today.

## 3. Non-Goals (explicitly out of scope)

- **Flipping `PREGNANCY_SAFETY_ENABLED` to `true` in production.** That remains a separate, deliberate
  action the human takes once this fix has shipped and passed review — this task closes the gap, it does
  not turn the feature on. Mirrors `pregnancy-safety-handling`'s own identical non-goal boundary.
- **Extending pin-override to `pao_expired` or `no_allowed_period`-sourced freezes.** Both are folded into
  `RoutinePlan.frozen` today (via `generate.ts`'s `gateFrozen` mapping) but are NOT part of the codebase's
  existing "clinically frozen / safety beats preference" bucket anywhere else: `dailyView.ts`'s Today-screen
  freeze union (`findFrozenByAnySource`) only ever covers `procedureRules` + `pregnancyRules`, never PAO
  expiry or no-allowed-period. Making `planApply.ts` more aggressive than `dailyView.ts`'s own established
  bucket would be a new, independently-decidable product behavior with no request or precedent behind it.
- **Surface B (`AddProcedureModal` / `ConflictEngine.checkPregnancyConflict`).** This task is scoped
  entirely to the routine-engine Draft→Save path; the clinic procedure advisory is unaffected by this gap
  and untouched here.
- **The 7 pre-existing QA-test-defect failures** in
  `tests/pregnancy-safety-handling/AddProcedureModal.pregnancy-enabled.test.tsx`. Already routed to qa-lead
  as its own follow-up by the tech-lead's `pregnancy-safety-handling` review; unrelated to this gap, not
  touched here.
- **The `applyEligibilityGates` line-count WARNING** from the same review (~61 lines, recommended light
  refactor). Non-blocking, unrelated to this fix, not touched here.
- **Any change to how `until`-less freeze rows render.** `DraftPreviewScreen.tsx` / `TodayScreen.tsx` /
  `RoutinesScreen.tsx` already fall back to `reasonText(reasonCode)` when `until` is absent (shipped in
  `pregnancy-safety-handling`). This task changes an internal pin-survival decision, not display copy.

## 4. User Stories

### Story 1: A pinned step under a persistent safety freeze does not survive a Draft→Save regeneration
As a user who pinned a retinoid step before marking myself pregnant, I want that pin to stop overriding the
pregnancy freeze once I generate and save a new draft, so the "non-overridable" guarantee actually holds.

**Acceptance Criteria:**
- [ ] Given `PREGNANCY_SAFETY_ENABLED === true`, `profile.pregnantOrBreastfeeding === true`, and a saved
      routine step with `userPinned: true` on a retinoid-class product that the newly generated plan drops,
      when the user commits the draft (Draft→Save, `applyRoutinePlan`), then the saved routine no longer
      contains that step.
- [ ] Given the same setup at the unit level, when `buildStepsFromPlan` runs with a `frozen` entry sourced
      from the pregnancy gate (`overridesPin: true`, no `until`), then the pinned step is dropped from the
      returned steps array.

### Story 2: Preference-tier freezes keep honoring an existing pin (no regression)
As a user who pinned a product despite an ingredient-pairing caution, I want my pin to keep surviving a
Draft→Save regeneration, unchanged from today.

**Acceptance Criteria:**
- [ ] Given a `userPinned` step whose product is frozen only by a pair-rule or cumulative-active-cap
      conflict (no `until`, `overridesPin: false`), when `buildStepsFromPlan` runs, then the pinned step is
      re-appended, exactly as before this fix.
- [ ] Given a `userPinned` step whose product is frozen by a day-windowed clinical/procedure freeze (`until`
      present, `overridesPin: true`), when `buildStepsFromPlan` runs, then the pinned step is dropped,
      exactly as before this fix.

### Story 3: The discriminant is explicit, not inferred
As an engineer adding a future freeze source, I want the type system to force me to declare whether it
overrides a pin, so this class of gap cannot silently reappear.

**Acceptance Criteria:**
- [ ] Given `FrozenItem.overridesPin` is a required (non-optional) field, when a new `FrozenItem` value is
      constructed anywhere in the codebase without providing it, then `npx tsc --noEmit` fails at that call
      site.
- [ ] Given a `FrozenItem` carries both `overridesPin: true` and an `until` date (the existing clinical-
      freeze shape), when `buildStepsFromPlan` runs, then the pin is still dropped — `until`'s coexistence
      is incidental, not load-bearing, for this decision.

## 5. UX / Behaviour

No new UI, no new screen, no new copy. This corrects an internal, silent decision inside an existing,
already-shipped behavior: `buildStepsFromPlan` already silently drops a pinned step under a clinical
freeze today (the user sees the step simply absent from the saved routine, exactly like any other
engine-dropped pin). The only observable change is *which* freeze sources trigger that same, pre-existing,
silent drop — pregnancy joins clinical procedure freezes; pair-rule/cap freezes continue not to. No error,
empty, or loading state is introduced — this is pure derivation over already-loaded plan/routine state.

## 6. Data Requirements

- **New data needed:** one new required boolean field, `overridesPin`, on the existing, internal
  `FrozenItem` type (`src/utils/routineEngine/planTypes.ts`). `FrozenItem` is a pipeline-internal shape
  (`RoutinePlan.frozen`) — never persisted to `AsyncStorage`, never serialized. This is a pure in-memory
  derivation change, not a schema migration, and touches no `src/types/index.ts` interface.
- **Existing data consumed:** `EligibilityRejection.gate` (already exists:
  `'hidden' | 'pao_expired' | 'clinical_freeze' | 'pregnancy_freeze' | 'no_allowed_period'`).
- **Data retention:** N/A.

## 7. Dependencies

- Depends on: `pregnancy-safety-handling` (shipped, uncommitted on `specific-screens` per its progress
  log — supplies the `pregnancy_freeze` eligibility gate and `context.pregnancyRules` this fix closes the
  gap for).
- Blocks (recommended sequencing, not a hard technical dependency): the human's planned production flip of
  `PREGNANCY_SAFETY_ENABLED`. The original tech-lead review recommended resolving this gap "before or
  alongside" that flip; the human has chosen to sequence this fix first.
- External services: none. Fully local, consistent with CLAUDE.md's local-only constraint.

## 8. Security & Privacy

- Authentication required: no (local-only app, no accounts) — unchanged.
- Data sensitivity: unchanged from `pregnancy-safety-handling` — this task adds no new data collection; it
  only corrects how already-collected, already-on-device `pregnantOrBreastfeeding` state is honored in one
  additional code path.
- Compliance considerations: none new.

## 9. Success Metrics

- `npx tsc --noEmit` clean, repo-wide.
- All new/updated tests green; zero regressions in the existing routine-engine suites
  (`src/utils/routineEngine/`, `tests/routine-engine/`, `tests/pregnancy-safety-handling/`).
- A red-before/green-after test exists proving the exact regression this task targets: a pinned retinoid
  step surviving a Draft→Save commit under an active (flag-mocked-on) pregnancy freeze, now dropped.

## 10. Open Questions

No open questions. The two scope boundaries a reader might expect to see raised here — whether
`pao_expired`/`no_allowed_period` should also override pins, and whether this task should flip
`PREGNANCY_SAFETY_ENABLED` — were investigated directly against the codebase and resolved as explicit
Non-Goals (§3), not left open: the first has no existing precedent anywhere else in the app (`dailyView.ts`
excludes both from its own freeze bucket) and the second is a separate, deliberate human action by design.
