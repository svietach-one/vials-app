# Pregnancy / breastfeeding safety handling
Date: 2026-07-29
Author: planner-agent
Jira: N/A (kebab-case task slugs only, per .claude/rules/agent-layer-protocol.md)
Status: DRAFT

## 1. Problem Statement

`UserProfile.pregnantOrBreastfeeding` has existed since schema v6 (shipped as part of
`onboarding-5-step-redesign`, commits `1248202`/`45ff0af`) but nothing reads it. Two systems already
reserved space for the gap: `src/constants/decisionReasons.ts` states verbatim "`pregnancy_blocked` is
intentionally absent — deferred with Phase 3 §4.3," and Phase 7's override-flow design groups a
`PREGNANCY_BLOCKED` freeze with the one other non-overridable exclusion in the engine (retinoid-in-AM).
Today, a user who tells the app they are pregnant or breastfeeding gets zero benefit from that
disclosure: their routine can still recommend retinoids, and a procedure booking shows no warning. This
is a real, intentionally-deferred safety gap, not a new feature.

## 2. Goals

- When `pregnantOrBreastfeeding === true` and `PREGNANCY_SAFETY_ENABLED === true`, retinoid-class
  products are excluded from generated routines and from the Today screen's active steps, non-overridably.
- When the same conditions hold, `AddProcedureModal` surfaces a pregnancy-specific advisory for
  procedures with a draft-severity mapping (`botox`, `fillers`, `smas_lifting`, `mesotherapy`,
  `chemical_peel_deep` = `avoid`; `mechanical_facial` = `caution`).
- Detection/persistence of the profile flag (already shipped) is unconditional; every *acting* behavior
  (freeze, advisory) stays behind `PREGNANCY_SAFETY_ENABLED`, default `false`, until clinical sign-off.
- Close the `pregnancy_blocked` reason-code gap Phase 7 left open, without reopening or duplicating
  Phase 7's override machinery.

## 3. Non-Goals (explicitly out of scope)

- **Flipping `PREGNANCY_SAFETY_ENABLED` to `true`.** This task ships the mechanism, flagged off. Turning
  it on requires clinical sign-off on the draft severity/class lists — a product/clinical decision this
  task cannot make (see §10).
- **AHA/BHA and benzoyl peroxide freezing.** Guidance is concentration-dependent and mixed; this task
  does not default-freeze either. A potency-gated freeze is not currently expressible (`RuleTargets` has
  no potency condition — only `PairRule.exceptions.whenPotencyAtMost` does, and that machinery is
  pair-rule-specific). Flagged as a follow-up, not built here.
- **hydroquinone.** Not a class in `actives.json` at all; the engine cannot see it. Out of scope — a
  separate ticket, not silently implied as covered.
- **Real Save-blocking in `AddProcedureModal`.** The modal's three existing clinical checks
  (`checkSeasonalConflict`, `checkPhototypeConflict`, `checkProcedureCollision`) are advisory-only today
  — `handleSave` does not branch on their severity, and there is no "I understand the risk" acknowledgment
  anywhere in the component, despite `USER_STORIES.md` US-18 describing one. This task ships
  `checkPregnancyConflict` the same way the other three ship: an `InlineAlert`, not a new blocking gate.
  Building real block+acknowledge for all four checks together is a separate, larger task.
- **A dedicated Today-screen pregnancy banner.** Frozen products already surface via the Phase 7
  reserve-card reason line; this task does not add a second UI surface for the same information.
- **Hormone-therapy personalization.** Unrelated flag, unrelated task
  (`docs/specs/routine_engine_3.0/TASK_hormone_therapy_personalization.md`), explicitly not touched here.

## 4. User Stories

### Story 1: Pregnancy freeze in the generated routine
As a user who has marked `pregnantOrBreastfeeding: true`, I want retinoid-class products excluded from
my generated routine so that I don't get recommended an ingredient commonly cautioned in pregnancy.

**Acceptance Criteria:**
- [ ] Given `PREGNANCY_SAFETY_ENABLED === true` and `profile.pregnantOrBreastfeeding === true`, when a
      routine is generated, then no retinoid-class product is admitted to any period.
- [ ] Given the same conditions, when the user views the reserve/frozen list, then the excluded product
      carries `reasonCode: 'pregnancy_blocked'` and the Phase 7 reason text.
- [ ] Given the same conditions, when the user attempts to force the frozen product back in via the
      existing override flow, then the override is rejected the same way a retinoid-in-AM placement is
      rejected — no new override-bypass path exists.
- [ ] Given `PREGNANCY_SAFETY_ENABLED === false` (default), when a routine is generated for a pregnant
      user, then behavior is unchanged from today (no freeze applied).
- [ ] Given `profile.pregnantOrBreastfeeding === false`, when a routine is generated, then the pregnancy
      freeze source contributes nothing (empty rule set), regardless of the flag.

### Story 2: Today screen reflects the freeze on an already-saved routine
As a user with a saved routine and `pregnantOrBreastfeeding: true`, I want the Today screen to also
exclude the frozen retinoid so the freeze isn't only visible in newly-generated drafts.

**Acceptance Criteria:**
- [ ] Given a previously-saved routine containing a retinoid step, when `pregnantOrBreastfeeding` becomes
      true and the flag is on, then the Today screen's active-steps view (`dailyView.ts`) excludes that
      step the same way an active procedure freeze does today.

### Story 3: Clinic procedure advisory
As a user with `pregnantOrBreastfeeding: true` booking a procedure, I want to see a caution specific to
pregnancy/breastfeeding so I can discuss it with my practitioner.

**Acceptance Criteria:**
- [ ] Given `PREGNANCY_SAFETY_ENABLED === true` and `pregnantOrBreastfeeding === true`, when the user
      selects `botox`, `fillers`, `smas_lifting`, `mesotherapy`, or `chemical_peel_deep` in
      `AddProcedureModal`, then an `avoid`-tone `InlineAlert` renders with pregnancy-specific copy.
- [ ] Given the same conditions with `mechanical_facial` selected, then a `caution`-tone `InlineAlert`
      renders instead.
- [ ] Given the pregnancy advisory fires alongside an existing seasonal/phototype/collision advisory, when
      the modal renders, then all applicable alerts show together — the pregnancy result does not replace
      an existing one.
- [ ] Given a custom procedure is selected, then no clinical checks run at all (matches existing behavior
      for the other three checks — `isCustom` guard).
- [ ] Given `PREGNANCY_SAFETY_ENABLED === false`, when any procedure is selected, then no pregnancy
      advisory renders regardless of the profile flag.

## 5. UX / Behaviour

Both surfaces reuse existing, shipped UI patterns — no new components:

- **Routine engine (Surface A):** identical UX to an existing clinical procedure freeze. The product
  disappears from the generated periods and appears in the reserve list with a reason line, exactly as
  `peel_rehab_no_aggressive_actives` does today. No new screen state.
- **Clinic modal (Surface B):** identical UX to the existing `seasonalResult`/`phototypeResult` alerts —
  an `InlineAlert` block, `tone="sos"` for `avoid`, `tone="warning"` for `caution`, rendered in the same
  stack, same position, same icon convention as the three existing checks.
- **Copy** (all tiers): never a categorical medical claim. Draft strings:
  - Routine reason text: "Commonly avoided during pregnancy or breastfeeding — paused. Check with your
    doctor."
  - Procedure advisory explanation: procedure-specific, e.g. "Injectable neurotoxin, routinely deferred
    during pregnancy or breastfeeding." Suggestion: "Discuss timing with your doctor or practitioner."
- **Error / empty states:** none introduced — this is pure derivation from already-loaded profile state;
  no network calls, no loading state.

## 6. Data Requirements

- **New data needed:** none. `UserProfile.pregnantOrBreastfeeding: boolean` already exists (schema v6,
  wired from `AdditionalInfoStep.tsx`).
- **Existing data consumed:** `profile.pregnantOrBreastfeeding`, `ACTIVES_RULESET.classes` (for the
  `retinoid` class), `CosmeticProcedureKey` union.
- **New ruleset data:** `src/constants/rulesets/pregnancy.ts` — draft-flagged severity/class maps, see
  tech design. Not user data; static, checked-in, clinician-reviewable.
- **Data retention:** N/A — no new persisted fields.

## 7. Dependencies

- Depends on: `onboarding-5-step-redesign` (shipped — supplies `pregnantOrBreastfeeding`), Phase 7
  explainability + override (`docs/specs/routine-engine-v2.1/phase-07-explainability.md`, shipped —
  supplies the reserve-card reason-line surface and the non-overridable-exclusion precedent).
- Blocks: nothing currently in flight depends on this.
- External services: none. Fully local/offline, consistent with CLAUDE.md's local-only constraint.

## 8. Security & Privacy

- Authentication required: no (local-only app, no accounts).
- Data sensitivity: health-adjacent (pregnancy/breastfeeding status). Already collected and stored
  on-device only, unchanged by this task — this task only adds *reads* of the existing field.
- Compliance considerations: none new. All user-facing copy avoids definitive medical claims and routes
  to a professional, per the project's existing clinical-disclaimer convention (PRD_Spec.md §6).

## 9. Success Metrics

- Not a user-facing opt-in feature with usage metrics while `PREGNANCY_SAFETY_ENABLED` stays `false`.
  Readiness metric for this task: `npx tsc --noEmit` clean, all new unit/integration tests passing, zero
  regressions in the existing 40+ routine-engine/clinic test suites.
- Post-launch (once flagged on, out of this task's scope): tracked separately by product once sign-off
  lands.

## 10. Open Questions

- [ ] Clinical sign-off on the draft ingredient class list (§3.3 equivalent — retinoid freeze; AHA/BHA/
      benzoyl peroxide explicitly left un-frozen) and the draft procedure severity map (§4.2 equivalent)
      → owner: product + clinical reviewer (named reviewer TBD by product owner). **Hard blocker** for
      flipping `PREGNANCY_SAFETY_ENABLED` to `true`; not a blocker for building the flagged-off mechanism.
  - [ ] Whether `AddProcedureModal` should eventually gain real Save-blocking (US-18) for all four checks
      together → owner: product owner. Out of scope for this task; noted so it isn't lost.
