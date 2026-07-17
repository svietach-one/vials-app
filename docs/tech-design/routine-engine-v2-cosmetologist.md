# Technical Design: Routine Engine V2.1 — Phase 1

Spec: docs/specs/routine-engine-v2.1/phase-01-active-registry.md
Reconciliation: docs/specs/routine-engine-v2.1/DISCREPANCY-REPORT.md
Author: planner (inline)
Date: 2026-07-17

Scope: **Phase 1 only** (of 9). One phase per session; phases 2–9 get their own
design sections appended to this file as they start.

## 1. Architecture Overview

Phase 1 is a **data + derivation** change. No new modules, no new layers, no UI.
`src/constants/rulesets/actives.json` is already the single source of truth for
active classes; Phase 1 corrects its values, adds three classes, and folds the
last duplicate conflict table into it.

```
actives.json (data)                     ← recalibrated irritancy, +3 classes,
  │                                       +irritancyByPotency, +2 pairRules,
  │                                       −rule_vitc_niacinamide
  ├─→ rulesetTypes.ts (schema + loaders) ← irritancy scale JSDoc (0–5, was "0–3"),
  │     └─ isStrongActive()                irritancyByPotency type, isStrongActive
  ├─→ productFacts.ts (pipeline step 1)  ← potency-aware irritancy, rinseOff
  └─→ conflictEngine.ts (app-facing)     ← reads pairRules; conflictRulesDb's
                                            INGREDIENT_CONFLICT_RULES deleted
```

The one-way dependency (`json → types → engine → app`) is unchanged. `utils/`
stays pure — no React, no stores, no fetch.

**Deliberately not in Phase 1:** the cumulative cap is *enforced* in Phase 4.
Phase 1 ships `rinseOff` and `isStrongActive` as data only; `rinseOff` has no
consumer until Phase 4, which is intended rather than dead code.

## 2. API Contracts

No HTTP endpoints — the engine is 100% local. The changed contracts are types:

### `ActiveProperties` (rulesetTypes.ts)
- Changed: `irritancy?: number` — JSDoc corrected from "0–3 irritation tier" to
  the real 0–5 scale (currently misdocumented; `5` is reserved/unused in v2.1).
- Added: `irritancyByPotency?: Partial<Record<Potency, number>>` — per-potency
  override; `retinoid` is the only declarer in v2.1.

### `isStrongActive(props: ActiveProperties, potency?: Potency): boolean`
- Returns `resolveIrritancy(props, potency) >= 3`.
- Sole definition of the mild/strong boundary; no exemption list.

### `ProductFacts` (productFacts.ts)
- Added: `rinseOff: boolean` — derived from `productType`, never persisted.
- Changed: `properties.irritancy` now resolves per attributed class's potency
  via `irritancyByPotency`, falling back to flat `irritancy`. Aggregation stays
  `Math.max` across classes (unchanged semantics, new inputs).

### `ConflictEngine.detectConflicts` / `getConflictsForProduct`
- Signatures unchanged. Source swaps `INGREDIENT_CONFLICT_RULES` → `pairRules`.
- `pairRules.a`/`b` may be arrays; matching must handle both (the legacy table
  was scalar-only).
- Returned `ConflictRule` shape is preserved for existing UI callers.

## 3. Implementation Tasks

### engineer (scope=frontend — this project has no backend)

- **P1-1** Irritancy recalibration + `irritancyByPotency` — files:
  `src/constants/rulesets/actives.json`, `src/constants/rulesets/rulesetTypes.ts`
  (bha 2→3, vitamin_c_pure 2→3, benzoyl_peroxide 3→4, azelaic_acid 1→2,
  copper_peptides 1→2; retinoid `{low:3, medium:3, high:4, rx:4}`).
- **P1-2** `isStrongActive` + `resolveIrritancy` + stacking invariant — files:
  `src/constants/rulesets/rulesetTypes.ts`,
  `src/utils/routineEngine/rulesetIntegrity.test.ts`. Adds
  `stacking: { maxPerPeriod: 1 }` to `vitamin_c_pure` (report §7.1).
- **P1-3** Three new classes + matchers + peptide fallback — files:
  `src/constants/rulesets/actives.json`, `src/types/index.ts`
  (`ActiveIngredientKey` += `peptide_signal`, `peptide_neuro`, `glycerin_class`),
  `src/constants/labels.ts` (`ACTIVE_INGREDIENT_LABELS` is an exhaustive
  `Record` — tsc blocks without it; also `FUNCTIONAL_BENEFIT_INGREDIENTS`),
  `src/utils/activeBadges.ts` (`CATEGORY_KEYS`).
- **P1-4** Potency-aware irritancy + `rinseOff` in facts — files:
  `src/utils/routineEngine/productFacts.ts`.
- **P1-5** Matrix consolidation — files: `src/constants/conflictRulesDb.ts`
  (delete `INGREDIENT_CONFLICT_RULES`; `PROCEDURE_COLLISION_RULES` stays),
  `src/utils/conflictEngine.ts` (read `pairRules`, handle array `a`/`b`),
  `src/constants/rulesets/actives.json` (add `rule_vitc_pure_copper_peptides`,
  `rule_vitc_derivative_bpo`; remove `rule_vitc_niacinamide`).
- **P1-6** Unit tests for all of the above, co-located per
  `.claude/rules/testing.md` — files:
  `src/utils/routineEngine/rulesetIntegrity.test.ts`,
  `src/utils/routineEngine/productFacts.test.ts`,
  `src/utils/conflictEngine.test.ts`.

### qa-lead
- N/A for Phase 1 — no component or UI surface. Component/integration suites
  resume at Phase 3 (goal selector) and Phase 7 (reserve cards, override).

### devops-lead
- N/A — `infra_changes: false`.

## 4. Assumptions

- **Class keys keep their persisted names** (`copper_peptides`, not the spec's
  `peptide_copper`).
  *Alternative:* rename to match the spec prose.
  *Reason:* they are persisted `activeTags` values; renaming costs a migration
  and buys nothing. (Report §3.)

- **`vitamin_c_pure` gains `stacking` in Phase 1, which Phase 4 then deletes.**
  *Alternative:* defer the invariant to Phase 4 and skip the edit.
  *Reason:* the Phase 1 review checklist requires `isStrongActive ⇔ irritancy>=3`
  to hold at Phase 1; leaving the shipped mechanism half-migrated is worse than
  short-lived churn. (Report §7.1.)

- **`rinseOff` is true only for `cleanser` and `makeup_remover`.**
  *Alternative:* include `peeling` and `mask`.
  *Reason:* do-no-harm — peel gels rinse but peel pads do not, and sleeping
  masks are leave-on, so an ambiguous product consumes the cap rather than
  escaping it. Derived not persisted, so an override stays non-breaking.
  (Report §7.4.)

- **The unknown-peptide fallback is a lowest-priority matcher on
  `peptide_signal` with a copper negative-pattern.**
  *Alternative:* a resolution step in `productFacts` outside the matcher system.
  *Reason:* keeps all attribution in one declarative place; the negative pattern
  is what stops it shadowing `copper_peptides`.

- **`vitamin_c_pure + niacinamide` compatibility is asserted by test, not by a
  JSON field.**
  *Alternative:* add a `compatible: true` rule type to `pairRules`.
  *Reason:* `pairRules` has no positive-assertion syntax, and inventing one for
  a single case expands the schema for no engine benefit. The rule is *absence*
  + a locking test.

## 5. Open Questions

None blocking Phase 1. §4.1 was resolved 2026-07-17 (vitamin C → irritancy 3,
cap intended, superseded by the cumulative rule).

Open but scoped to later phases: **§4.2** (`pm_preferred` loosens a shipped
PM-only rule — Phase 2), **§4.3** (pregnancy is a subsystem, not a flag —
Phase 3), **§4.4** (`reasonCode`/`ruleId` conflation blocks the closed enum —
Phase 7). Report §7.2 (AHA + PHA becomes legal) lands in Phase 4 and is
recorded as an accepted assumption, not a question.

---

# Phase 2 — Widened SPF Mandate + Period-Safety Property Test

Spec: docs/specs/routine-engine-v2.1/phase-02-period-eligibility-spf.md
Date: 2026-07-17 (post §4.2 ruling: pm_preferred dropped, no eligibility-table change)

## 1. Architecture Overview

Two small changes, one data + one test:

```
actives.json                       ← new top-level `mandates` block (1 entry:
  │                                  spf_photosensitizing, unconditional)
  ├─→ rulesetTypes.ts              ← RulesetMandate type; ActivesRuleset.mandates?
  └─→ mandates.ts                  ← collectRequireMandates folds the 4th source
      collectRequireMandates()       (clinical + seasonal + phototype + base)

tests/routine-engine/period-safety.test.ts  ← new §9-suite-3 property test
```

`applyMandates` itself is untouched — the new source flows through the same
`RequireMandate` shape, the same `planContainsProperty` gate, and the same
per-period placeholder merge (strictest severity wins, already shipped).

## 2. API Contracts

### `RulesetMandate` (rulesetTypes.ts, new)
- `{ id, if?: { planContainsProperty? }, then: { action, targets?, period? },
  severity?, nonSkippable?, reasonCode }` — deliberately the SeasonRule shape
  minus `seasons`, so a future rule can migrate between the two blocks by
  adding/removing one field.
- `ActivesRuleset.mandates?: RulesetMandate[]` (optional: absent = []).

### `collectRequireMandates` (mandates.ts)
- Signature unchanged. Adds a fourth folded source read directly from
  `ACTIVES_RULESET.mandates` — consistent with the seasonal source, which
  already reads `SEASONS_RULESET` directly rather than via context.

## 3. Implementation Tasks

- **P2-1** `mandates` block + types — files: `src/constants/rulesets/actives.json`,
  `src/constants/rulesets/rulesetTypes.ts`.
- **P2-2** Fold base mandates — files: `src/utils/routineEngine/mandates.ts`.
- **P2-3** Unit tests: fold + merge + no-actives negative — files:
  `src/utils/routineEngine/mandates.test.ts`,
  `src/utils/routineEngine/rulesetIntegrity.test.ts` (structural checks for the
  new block).
- **P2-4** Period-safety property test — files:
  `tests/routine-engine/period-safety.test.ts` (new).

## 4. Assumptions

- **The property test lives in `tests/routine-engine/`, not
  `src/utils/routineEngine/`.** The phase file suggested entryPoints.test.ts or
  a co-located periodSafety.test.ts.
  Alternative: co-locate in src/utils and duplicate a shelf generator.
  Reason: the seeded PRNG + randomShelf machinery already lives in
  tests/routine-engine/fixtures.ts and powers the other §9 property suites;
  duplicating it violates the fixture-sharing rule in testing.md.
- **`severity: 'avoid'` on spf_photosensitizing, `nonSkippable: false`.**
  Alternative: caution.
  Reason: the phase spec declares it; matches summer_spf_mandate's own
  declaration, so the merge never has to reconcile the two.
- **actives.json `version` stays 2026-07-17.** Same release train as Phase 1,
  same day; two bumps would imply two revalidation prompts for one change set.

## 5. Open Questions

None. §4.2 resolved (dropped); the goal-driven SPF trigger is Phase 3 by design.

---

# Phase 3 — Goal Model (Pipeline Step 0)

Spec: docs/specs/routine-engine-v2.1/phase-03-goal-model.md
Date: 2026-07-17. §4.3 (pregnancy) remains open — that bullet is excluded.

## 1. Architecture Overview

Step 0 resolves goals BEFORE facts and threads the result through
`RoutineContext`; nothing downstream changes its scoring yet (Phase 4
consumes `treatmentClassRanking` — this phase only produces it, so existing
plans are byte-identical for a maintenance profile).

```
profile.{primaryGoal,secondaryGoal}      actives.json
        │                                 ├─ goals block (ranked classes/goal)
        ▼                                 ├─ glycerin_class (re-added, gated)
resolveGoalContext()  ── Step 0 ──►       └─ mandates + spf_required_goal
  { goals, treatmentClassRanking,
    decisions }                          ingredientParser
        │                                 └─ INCI position per class →
        ▼                                    attribution gate / trace downgrade
RoutineContext.{goals, treatmentClassRanking}
        │
        ├─► collectRequireMandates — goalIn condition on base mandates
        └─► generatePlan — goal decisions prepended to plan.decisions
```

Migration note: goal derivation lands in `migrateProfile` (runs idempotently
on every hydrate) — correctness now; the schema bump 2→3 stays with Phase 8.

## 2. API Contracts

### Types (src/types/index.ts)
- `SkinGoal = 'acne' | 'pigmentation' | 'aging' | 'dehydration' | 'barrier_repair' | 'oil_control' | 'maintenance'`
- `UserProfile` += `primaryGoal: SkinGoal; secondaryGoal: SkinGoal | null; goalNeedsConfirmation: boolean` (flat fields).

### `resolveGoalContext(profile, fitzpatrick)` (context.ts, new)
- Returns `{ goals: { primary, secondary }, treatmentClassRanking: ActiveIngredientKey[], decisions: DecisionLogEntry[] }`.
- Ranking = goals[primary] ++ goals[secondary] (dedup, order-preserving), then modifiers:
  barrier_repair as ANY goal → drop classes with flat `irritancy >= 3`
  (logged `barrier_repair_excludes_irritants`, new action `goal_exclude`);
  Fitzpatrick 4–6 + pigmentation goal → move azelaic_acid + niacinamide ahead of aha.
- `RoutineContext` += `goals`, `treatmentClassRanking`; `RoutineContextInput.profile`
  widens with OPTIONAL `primaryGoal?/secondaryGoal?` (absent ⇒ maintenance) so
  every existing caller keeps compiling.

### `EngineInput.profile` (generate.ts)
- `Pick<UserProfile,'fitzpatrick'|'concerns'> & Partial<Pick<UserProfile,'primaryGoal'|'secondaryGoal'>>`.

### Ruleset schema (rulesetTypes.ts)
- `ActivesRuleset` += `goals: Record<SkinGoal, ActiveIngredientKey[]>`.
- `ActiveClass` += `attribution?: { requireWithinPosition?: number; downgradeToLowAfterPosition?: number }`.
- `RulesetMandate.if` += `goalIn?: SkinGoal[]` (matches primary OR secondary).

### Parser (ingredientParser.ts)
- `ParsedActiveDetail` += `position?: number` — 1-based comma-token index of the
  earliest matcher hit. Attribution gates applied IN the parser so every
  consumer (facts, conflict engine, badges via getProductActiveKeys) agrees:
  `requireWithinPosition` unmet ⇒ class not attributed;
  `downgradeToLowAfterPosition` exceeded ⇒ evidenced potency forced 'low'.
- Gates act on parse-sourced attribution only — wizard tags are user-asserted.

## 3. Implementation Tasks

- **P3-1** Types + profile defaults + goal derivation in `migrateProfile` —
  files: types/index.ts, store/profileStore.ts, routineEngine/migrations.ts.
- **P3-2** `goals` block + `spf_goal_pigmentation` mandate + glycerin_class
  (gated) + trace-downgrade declarations — files: rulesets/actives.json,
  rulesetTypes.ts, constants/labels.ts (GOAL_LABELS + glycerin re-entries),
  utils/activeBadges.ts, types (ActiveIngredientKey += glycerin_class).
- **P3-3** Position-aware parser + gates — files: utils/ingredientParser.ts.
- **P3-4** Step 0 + context threading + goalIn mandate condition + decisions
  into the plan — files: routineEngine/context.ts, mandates.ts, generate.ts,
  planTypes.ts (`goal_exclude` action).
- **P3-5 (qa-lead, before UI code)** component tests — files:
  tests/routine-engine/goal-selector.test.tsx, goal-confirm-banner.test.tsx.
- **P3-6** UI: GoalSelector (max 2; first = primary) in SkinProfileSetupScreen
  + SkinProfileEditModal; one-time confirmation banner on RoutinesScreen —
  files: components/profile/GoalSelector.tsx, the two hosts, RoutinesScreen.
- **P3-7** Unit + integrity tests — files: context.test.ts, mandates.test.ts,
  ingredientParser.test.ts, productFacts.test.ts, rulesetIntegrity.test.ts,
  migrations.test.ts.

## 4. Assumptions

- **`goalNeedsConfirmation` is set only when derived from non-empty concerns.**
  Alternative: always set on migration. Reason: an empty-concerns profile gets
  the default, not a guess — there is nothing to confirm; the AC only asserts
  the prompt for the concerns-derived case.
- **`spf_required_goal` severity is `caution`, and `goalIn` matches primary or
  secondary.** Alternative: `avoid` / primary-only. Reason: the photosensitizer
  mandate guards a chemical vulnerability (avoid); the goal mandate guards
  treatment efficacy — advisory. Either goal slot expresses the user's intent.
- **Attribution gates live in the parser, not productFacts.** Alternative:
  gate in buildProductFacts only. Reason: getProductActiveKeys feeds the
  conflict engine and badges directly; gating in one place keeps every
  consumer consistent (same argument as Phase 1's matchPairRule).
- **Draft gate values — consultant review item (with the goals values):**
  glycerin_class `requireWithinPosition: 5`; aha/bha/vitamin_c_pure
  `downgradeToLowAfterPosition: 8`. Freeform INCI with no commas yields one
  token ⇒ position 1 ⇒ no gating (conservative: attributes fully).
- **Trace strong actives downgrade to 'low', never drop.** Alternative: drop
  the class. Reason: do-no-harm — a trace acid stays visible to safety checks
  (pair rules, eligibility) at reduced severity via the existing potency
  exceptions; dropping would hide it from them entirely.
- **`goal_exclude` DecisionAction added now.** Alternative: reuse 'limit'.
  Reason: Phase 7 closes the enum; overloading 'limit' would conflate a
  frequency cap with a ranking exclusion in the log.

## 5. Open Questions

§4.3 (pregnancy) — open, excluded from this phase's scope and acceptance.
Consultant review list (blocks VALUES, not structure): goals rankings,
glycerin position gate, trace threshold + downgrade-vs-drop.
