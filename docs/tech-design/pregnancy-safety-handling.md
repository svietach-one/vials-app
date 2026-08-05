# Technical Design: Pregnancy / breastfeeding safety handling
Spec: docs/specs/pregnancy-safety-handling.md
Author: tech-designer
Date: 2026-07-29

## 1. Architecture Overview

Two independent surfaces, no shared code path (per spec §1, mirroring the existing procedure-vs-clinic
split):

- **Surface A (routine engine).** `pregnancy.ts` (new, mirrors `seasons.json`'s `SeasonRule` shape — a
  boolean condition, not a phase window, so it is the closer analog, not `procedures.json`) declares
  freeze targets. `buildRoutineContext` (context.ts) resolves them into a new `RoutineContext.pregnancyRules:
  ActiveProcedureRule[]`-shaped array when `profile.pregnantOrBreastfeeding && PREGNANCY_SAFETY_ENABLED`,
  else `[]`. `eligibility.ts`'s `applyEligibilityGates` and `dailyView.ts` (both call sites, lines ~146 and
  ~230 today) each gain one more freeze-source check, run the identical way the existing `procedureRules`
  freeze check runs. Non-overridability is structural, not a new flag: `applyEligibilityGates` runs before
  `selectSkeleton`, so a rejected product never enters the `reserve`/`userOverrides` pool at all — the same
  reason retinoid-in-AM (a period restriction, different mechanism, `slotting.ts`) is effectively
  non-overridable today. No new "non-overridable" concept is introduced.
- **Surface B (clinic).** `ConflictEngine.checkPregnancyConflict()` (conflictEngine.ts), mirrors
  `checkSeasonalConflict`'s exact signature/shape. `AddProcedureModal` calls it alongside the three
  existing `check*` calls, renders a fourth `InlineAlert` in the same stack.

```
profile.pregnantOrBreastfeeding ──┬─→ [Surface A] pregnancy.ts → context.ts → eligibility.ts ┐
        (existing, schema v6)     │                                        → dailyView.ts    ├─→ reserve/Today
                                   │                                                          ┘
                                   └─→ [Surface B] ConflictEngine.checkPregnancyConflict() → AddProcedureModal InlineAlert
```

Both gated end-to-end by `PREGNANCY_SAFETY_ENABLED` (new, `src/constants/featureFlags.ts`, default
`false`).

## 2. API Contracts

N/A — fully local, no network/backend surface (per CLAUDE.md local-only constraint).

## 3. Implementation Tasks

### engineer (scope=frontend/utils — this app has no backend layer)

- FE-1: Add `PREGNANCY_SAFETY_ENABLED = false` to `src/constants/featureFlags.ts`, documented in the
  same style as `PROPOSED_V12_PAIR_RULES_ENABLED` (why off, what flips it on, what ships regardless).
- FE-2: Create `src/constants/rulesets/pregnancy.ts`. Export `PREGNANCY_RULESET: { rules: PregnancyRule[]
  }` where `PregnancyRule = { id: string; then: { action: 'freeze'; targets: RuleTargets }; reasonCode:
  'pregnancy_blocked' }`. One rule: `targets: { classes: ['retinoid'] }`. Comment block states this is
  draft data pending clinical sign-off, lists AHA/BHA/benzoyl_peroxide as explicitly reviewed-and-excluded
  (not silently omitted), and notes hydroquinone as an out-of-taxonomy gap (separate ticket). Gate the
  export through `PREGNANCY_SAFETY_ENABLED` the same way `proposedPairRules.ts` gates its export (a
  function returning `[]` when the flag is off), so nothing downstream needs its own flag check.
- FE-3: Add `PregnancyRule` type to `src/constants/rulesets/rulesetTypes.ts`, beside `SeasonRule`.
- FE-4: `context.ts` — extend `RoutineContextInput.profile` Pick to include
  `pregnantOrBreastfeeding`, add `RoutineContext.pregnancyRules: RuleTargets[]` (or reuse
  `ActiveProcedureRule`'s shape minus the day-window fields — engineer's call, keep it minimal), populated
  in `buildRoutineContext` from `PREGNANCY_RULESET` when `input.profile.pregnantOrBreastfeeding` is true,
  else `[]`. Pure, deterministic, no new inputs beyond the existing profile.
- FE-5: `eligibility.ts` — add one more freeze check in `applyEligibilityGates`, after the existing
  `clinical_freeze` check, using a new `EligibilityGate` member `'pregnancy_freeze'` (keeps pregnancy
  freezes distinguishable from procedure freezes for audit/analytics) and `matchesRuleTargets` exactly as
  the existing check does.
- FE-6: `dailyView.ts` — extend both call sites currently filtering `context.procedureRules` for
  `action === 'freeze'` (lines ~146, ~230) to also union in `context.pregnancyRules`. Factor the shared
  "is this product frozen by any source" check into one helper used by both eligibility.ts and dailyView.ts
  rather than duplicating the union logic three times.
- FE-7: `src/constants/decisionReasons.ts` — add `'pregnancy_blocked'` to `RulesetReasonCode` (it's
  ruleset-authored, in `pregnancy.ts`, same category as `peel_rehab_no_aggressive_actives`). Add the
  dictionary entry: `pregnancy_blocked: 'Commonly avoided during pregnancy or breastfeeding — paused.
  Check with your doctor.'`. Delete the now-stale "intentionally absent" doc comment at the top of the
  file.
- FE-8: `src/constants/conflictRulesDb.ts` (or co-located in `conflictEngine.ts` — match whichever existing
  convention `PROCEDURE_COLLISION_RULES` follows) — add `PREGNANCY_PROCEDURE_SEVERITY:
  Partial<Record<CosmeticProcedureKey, ConflictSeverity>>` = `{ botox: 'avoid', fillers: 'avoid',
  smas_lifting: 'avoid', mesotherapy: 'avoid', chemical_peel_deep: 'avoid', mechanical_facial: 'caution' }`,
  commented as draft-pending-clinical-review.
- FE-9: `conflictEngine.ts` — add `ConflictEngine.checkPregnancyConflict(procedure: CosmeticProcedureKey,
  isPregnantOrBreastfeeding: boolean): ClinicalConflictResult | null`, gated on
  `PREGNANCY_SAFETY_ENABLED` internally (return `null` immediately when the flag is off, matching how
  `proposedPairRules.ts` self-gates rather than pushing the check to every call site), mirroring
  `checkSeasonalConflict`'s structure exactly. Per-procedure `explanation`/`suggestion` text, always ending
  in a "discuss with your doctor/practitioner" suggestion.
- FE-10: `AddProcedureModal.tsx` — add a fourth `useMemo`-derived `pregnancyResult` beside
  `collisionResult`/`seasonalResult`/`phototypeResult` (same `isCustom` guard), reading
  `profile?.pregnantOrBreastfeeding ?? false`. Render a fourth `InlineAlert` in the same stack position,
  same tone-mapping convention (`avoid` → `tone="sos"`, `caution` → `tone="warning"`) as the existing
  three.

### engineer (unit tests, both scopes)

- Each task above includes unit tests for the code produced: `pregnancy.ts` flag-gating,
  `buildRoutineContext`'s `pregnancyRules` derivation, the eligibility gate, the `dailyView.ts` union, the
  decisionReasons dictionary/enum consistency (existing `rulesetIntegrity.test.ts` should catch orphans
  automatically — verify it does, don't skip it), and `checkPregnancyConflict`'s per-procedure severity
  table.

## 4. Assumptions

- Pregnancy rules are modeled as a boolean-condition ruleset (mirroring `seasons.json`'s `SeasonRule`),
  not folded into `EffectiveRuleset` and not modeled as a phase-windowed `procedures.json` rule.
  Alternative: fold into `buildEffectiveRuleset`'s phototype-modifier pipeline.
  Reason: `effectiveRuleset` today only ever carries phototype-derived data (confirmed by reading
  `context.ts` — season and procedure rules are separate `RoutineContext` fields, never merged into it);
  reusing that pipeline for an unrelated third source would overload its meaning. Procedure rules are
  phase/day-windowed, which pregnancy is not (it's a persistent condition, not a 14-day recovery window)
  — `seasons.json`'s unconditional-while-true `SeasonRule` shape is the structural match.
- Non-overridability is achieved via eligibility-gate ordering, not a new explicit flag.
  Alternative: add a `nonOverridable: boolean` field to the freeze/reservation data model and check it in
  the override-acceptance path.
  Reason: confirmed by reading `eligibility.ts` and `resolve.ts`'s consumers — a product rejected by
  `applyEligibilityGates` never reaches the pool that `reserve`/override logic operates over, so it is
  already structurally unforceable with zero new state. Adding an explicit flag would be a second,
  redundant mechanism for the same guarantee.
- `AddProcedureModal` pregnancy check is advisory-only (`InlineAlert`), not a new Save-blocking gate.
  Alternative: build real block + "I understand the risk, log anyway" acknowledgment for pregnancy
  specifically, ahead of the other three checks.
  Reason: confirmed by reading `AddProcedureModal.tsx` — `handleSave` does not branch on any existing
  check's severity today, despite `USER_STORIES.md` US-18 describing that behavior; US-18 itself is
  marked pending sign-off. Building blocking UX for one check while the other three stay advisory would
  be an inconsistent, confusing UI. Confirmed with the orchestrating session (2026-07-29): stay
  advisory-only; real blocking is a separate follow-up covering all four checks together.
- Today-screen surfacing reuses the existing Phase 7 reserve-card reason line; no new banner.
  Alternative: a dedicated dismissible-for-today "N products paused for pregnancy safety" banner.
  Reason: the reserve-card reason line is already the single source of truth for every other freeze
  reason in the app; a parallel banner would duplicate that information. Confirmed with the orchestrating
  session (2026-07-29).
- `PregnancyRule` reason codes live in `RulesetReasonCode`, not `EngineReasonCode`.
  Alternative: `EngineReasonCode`, since the freeze condition (`pregnantOrBreastfeeding`) is a profile
  field, not ruleset-authored data.
  Reason: `RulesetReasonCode`/`EngineReasonCode` split (per `decisionReasons.ts`'s own doc comment) is
  about where the code is *declared* (JSON/TS ruleset file vs. inline engine logic), not what triggers it
  — `pregnancy_blocked` is declared in `pregnancy.ts`, same category as every `procedures.json`/
  `seasons.json` reason code.

## 5. Open Questions

No open engineering questions — all three "VERIFY before implementing" placeholders in the source draft
(`docs/specs/routine_engine_3.0/TASK_pregnancy_routine_conflicts.md` §7) were resolved by direct code
reading (see progress log). The one remaining question — clinical sign-off on the draft severity/class
data — is a Type A business gap (per `.claude/rules/tech-design-template.md`'s gap-type table): not
resolvable as an engineering assumption, tracked in the spec's §10 Open Questions instead, and does not
block writing the flagged-off code.
