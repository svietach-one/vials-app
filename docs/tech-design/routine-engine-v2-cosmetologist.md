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

---

# Phase 4 — Skeleton Build-Up + Cumulative Active Exposure (Core)

Spec: docs/specs/routine-engine-v2.1/phase-04-skeleton-buildup.md + report §7
Date: 2026-07-17

## 1. Architecture Overview

The admission machinery (ladder, day-splits, frequency caps, slot
alternatives) is battle-tested — the defect is WHO gets into the pool. So the
rewrite is a new **selection stage** in front of it, not a gut of resolve.ts:

```
gates → skeleton.ts (NEW — pipeline step 4.5 "selection")
          per-period selected-candidate id sets
          reserve[] (not_needed_for_goals | duplicate_function | cumulative_active_cap)
          info decisions (rinse-off carriers), placeholder needs (neutral moisturizer)
          treatment frequency caps (reclassified/exfoliant)
      → resolvePeriods (existing; pool now intersected with the selection,
          caps merged strictest-wins; ladder/relocation/alternatives unchanged)
      → applyMandates (+ skeleton placeholders merged)
```

`findCapViolations` is rewritten from per-class stacking to the cumulative
rule — it serves validate (user-saved routines) and stays as defense-in-depth
in admission. Per-class `stacking` blocks leave actives.json entirely.

## 2. API Contracts

### `skeleton.ts` (new) — `selectSkeleton(input): SkeletonSelection`
- In: eligible products, facts, context (goals + treatmentClassRanking).
- Out: `{ periodCandidates: { am: Set<id>, pm: Set<id> }, reserve: ReserveItem[],
  decisions: DecisionLogEntry[], placeholders: PlaceholderSlot[],
  treatmentCaps: Map<id, AdaptationLimit> }`.
- Selection per period: structural slots (cleanser|makeup_remover;
  moisturizer|cream|lotion; spf AM) admit ALL type-matching mild candidates —
  the existing same-slot cap picks the winner and keeps the swap-UX
  alternatives; treatment slot walks `treatmentClassRanking` per period
  (products grouped by `preferredPeriodFor`), 0-or-1 winner.
- Strong carrier := `facts.properties.irritancy >= 3 && !facts.rinseOff`.
  Strong carriers are treatment candidates regardless of format
  (reclassification); at most one selected per period.

### `resolve.ts`
- `ResolveInput` += optional `selection?: { periodCandidates; treatmentCaps }`
  — absent means raw admission (unit tests of the ladder machinery);
  generate ALWAYS passes it.
- `findCapViolations`: strong-carrier vs strong-carrier with overlapping days
  ⇒ violation `{ ruleId: 'cumulative_active_cap', severity: 'avoid',
  resolutions: ['separate_days','freeze_lower_priority'] }`. Day-split-first
  keeps the classic retinoid-5-nights/AHA-Tue-Sat pattern valid for
  user-saved routines (validate path) — the cap forbids same-day stacking,
  not day-separated coexistence.
- `scoreCandidate(product, facts, period, concerns, prioritize, ranking = [])`
  → `boost*100000 + goalRank*1000 + tolerability*200 + concernHits*10 +
  potency*2`. Bands are disjoint (goalRank ≤ ~12 ⇒ ≤12000; tolerability
  0|100|200 — reserved 0 until Phase 5; concernHits ≤ 90; potency ≤ 8).
  Relative order of concernHits vs potency is unchanged from V2, so
  goal-less inputs rank identically.

### `generate.ts` — `RoutinePlan.reserve: { productId, reasonCode }[]` (REQUIRED).

## 3. Implementation Tasks

- **P4-1** skeleton.ts + reason-code precedence (duplicate_function →
  cumulative_active_cap → not_needed_for_goals) — new file.
- **P4-2** resolve.ts: selection intersection in buildPools, cumulative
  findCapViolations, scoreCandidate rebanding + ranking param.
- **P4-3** actives.json stacking removal + rulesetIntegrity restatement
  ("no class declares stacking; strong ⇔ cumulative-cap subject").
- **P4-4** slotting.ts: SKELETON_SLOTS view; isTreatment tightened to the
  strong boundary (mild actives may render both periods per the directive).
- **P4-5** generate.ts orchestration + planTypes ('info' + 'reserve' actions,
  required reserve) + planApply draft-summary reserve line + fixture fallout.
- **P4-6** Tests: skeleton unit suite; resolve expectation updates justified
  per-case; directive acceptance cases; determinism.

## 4. Assumptions

- **"Optional second treatment" = the other period's treatment.** One
  treatment per period, assigned via preferred period; never two per period.
  Alternative: two treatments in one period. Reason: the acceptance itself
  forbids two strong actives in one PM, and per-period ranking walks satisfy
  every stated case (aging: retinol PM + vitC AM).
- **Cross-format same-class products both admit when the second fills a
  structural slot** (peptide serum + peptide cream). The directive's mild
  rule OVERRIDES the older phase-04 acceptance item "hyaluronic serum + cream
  → one admitted, one duplicate_function" — class-dedup applies ONLY to
  treatment-candidate selection. Phase file amended; deviation logged.
- **duplicateSlot.ts is NOT rekeyed to functionalRole.** Functional dedup is
  realized at selection (same-class treatment losers → duplicate_function
  before admission); the slot-alternative mechanism keeps serving the swap
  UX unchanged. Alternative: rekey the same-slot cap. Reason: rekeying
  breaks the swap flow's slot semantics for zero additional coverage.
- **Reclassified strong carriers cap at ≤ 4 days/week; exfoliating strong
  carriers at ≤ 2 days/week (48h rest via the existing Tue/Sat spread), both
  as strictest-wins merges with adaptation/seasonal/phototype caps.** Report
  §7 assumption 8.3's "never daily" made concrete; values are draft,
  consultant list. A non-reclassified serum-format retinoid keeps V2
  behavior (adaptation caps only).
- **retinoid + vitamin_c_pure needs no pair rule** (the original spec table
  had one; Phase 1 dropped it): both are strong carriers, so the cumulative
  cap structurally forbids same-day co-scheduling — stricter than the pair
  rule would have been.
- **conflicts_with_selected is reserved but unused in Phase 4**: ladder
  freezes keep landing in `frozen[]` with their ruleId (Phase 7 splits
  reasonCode/ruleId and revisits).
- **Tolerability term is wired at weight 200 but fed 0 until Phase 5**
  supplies the usage-anchored phaseIndex value.

## 5. Open Questions

None new. Consultant list grows by the two frequency-cap draft values
(4/wk reclassified, 2/wk exfoliant).

---

# Phase 5 — Adaptation: Usage Anchor + Phase Regression

Spec: docs/specs/routine-engine-v2.1/phase-05-adaptation.md
Date: 2026-07-17. Reverses a documented adaptation.ts decision (see §4).

## 1. Architecture Overview

Adaptation gains two pure inputs and one output. The engine stays write-free;
the anchor is persisted on the SAVE path, not during generation.

```
routinePlanActions.applyRoutinePlan (save)
  └─ records firstScheduledDate for newly-scheduled products → trackingStore
generatePlan (pure)
  └─ TrackingInput.firstScheduledDates ──► collectAdaptationLimits
       adaptation.ts:
         applicationCountFor  ← counts from firstScheduledDate (not addedAt);
                                 tracked stats used in BOTH modes (5.4);
                                 regression applied via lastAppliedDate (5.2)
         getAdaptationStatus  → phaseIndex (+ existing caps)
  └─ resolvePeriods → tolerabilityByProduct (phaseIndex/2 * 200) → scoreCandidate
```

Also fixes a Phase 3 integration gap: `buildEngineInputFromStores` never
threaded `primaryGoal`/`secondaryGoal`, so the live app has been generating
maintenance plans regardless of the user's goal. Corrected here (one-line).

## 2. API Contracts

### `ProductApplicationStats` (types)
- += `firstAppliedDate: string | null` — set by the product's first check-in.

### `TrackingInput` (generate.ts)
- += `firstScheduledDates: Record<string, string>` (productId → skincare date).

### `applicationCountFor(product, stats, cycleType, now, firstScheduledDates?)`
- Tracked stats consulted in **both** modes (5.4): a stats entry → its `count`,
  then regression by `lastAppliedDate`.
- No stats → virtual count from `firstScheduledDates[id]` (5.1), NOT `addedAt`;
  absent anchor → 0 → Phase 1. This is the reversal.

### `applyAdaptationRegression(count, phaseIndex, lastAppliedDate, now)` (new, pure)
- irritancy>=3 products only (caller gates on facts).
- break > 28d → phaseIndex 0; else break > 14d → max(0, phaseIndex-1); else unchanged.
- Returns the regressed phaseIndex; computed never persisted (5.2).

### `scoreCandidate(..., treatmentClassRanking, tolerability = 0)`
- New trailing param. `tolerability = phaseIndex/2` scaled by the *200 band
  already reserved in Phase 4. buildPools passes it per candidate;
  substitute/duplicateSlot pass the default 0 (documented).

### `trackingStore`
- Persist `firstScheduledDates: Record<string,string>` +
  `recordFirstScheduled(ids: string[], date)` (idempotent — never overwrites an
  existing anchor).

## 3. Implementation Tasks

- **P5-1** types + trackingStore persistence + recordFirstScheduled.
- **P5-2** adaptation.ts: virtualApplicationCount(firstScheduledDate),
  applicationCountFor rework (both-mode stats + anchor), applyAdaptationRegression,
  getAdaptationStatus returns regressed phaseIndex; **JSDoc reversal**.
- **P5-3** generate.ts TrackingInput.firstScheduledDates threaded to
  collectAdaptationLimits; resolve.ts tolerabilityByProduct → scoreCandidate.
- **P5-4** routinePlanActions: record first-scheduled on save; thread goals
  (Phase 3 gap fix).
- **P5-5** tests: adaptation unit (anchor, regression, tolerability), generate
  integration (never-applied→P1, break→reset, adapted-beats-new), purity.

## 4. Assumptions

- **Break is measured only from `lastAppliedDate` (tracked stats).** The spec's
  "without check-ins, via the last scheduled day in the plan" fallback is
  omitted: never-applied products already resolve to Phase 1 via the anchor, so
  there is no phase to regress from. Alternative: persist last-scheduled per
  product. Reason: no acceptance case needs it, and persisting per-day
  scheduling to drive regression is a large surface for zero tested benefit.
- **Regression uses the phaseIndex, not the count.** Decrementing a raw virtual
  count is ambiguous across the non-linear phase table; the phase ladder is the
  unit the spec names ("phase −1", "reset to Phase 1"). Alternative: back-solve
  a count. Reason: direct and unambiguous.
- **firstScheduledDate is recorded for products entering a period on save,**
  not for reserve/frozen. Reason: "first appearance in a generated plan" means
  actually scheduled; a reserved product was never put into a routine.
- **tolerability feeds admission scoring only** (buildPools). substitute and
  duplicateSlot keep tolerability 0 — they answer "best swap / dedup winner",
  where goal rank + potency already decide; adding adaptation state there is
  out of the acceptance and risks reordering existing swap behavior.

## 5. Open Questions

None. Consultant list unchanged.

---

# Phase 6 — Dynamic Cycling from Shelf Composition

Spec: docs/specs/routine-engine-v2.1/phase-06-dynamic-cycling.md
Date: 2026-07-18

## 1. Architecture Overview

The cycle machine is blind to the shelf: a retinoid-free shelf still shows a
retinoid night. Fix is a pure resolution layer over the existing index —
`cyclePhaseIndex` keeps advancing mod 4 (checkInCycle untouched); only the
rendered PHASE is substituted to recovery when its class is absent.

```
getDailyView / TodayScreen
  └─ availableCycleClasses(products, facts, freezeRules, dow)  (eligible + present)
  └─ resolveCyclePhase(state, available)  → CyclePhase (empty phase → recovery)
  └─ isDynamicCyclingAvailable(available) → false → dynamic_unavailable_no_actives
```

Two premises from the original phase are STALE (verified, like earlier phases):
- **6.2 scheduledDays discard.** Dynamic mode gates at RENDER (dailyView
  `cycledOut`); it never mutates stored `scheduledDays`, and `switchCycleType`
  only touches settings + cycleState. Manual days already survive a dynamic
  round-trip by construction — no "preserved copy" mechanism is built. Added a
  regression test proving it; enhanced the confirm-dialog copy to say so.
- **6.4 seasonMask purity.** Already pure (report §1 #6). Test-only pins.

## 2. API Contracts

### `cycleState.ts` (pure additions)
- `type CycleClass = 'exfoliant' | 'retinoid'` — the two cycle-gated classes.
- `resolveCyclePhase(state: CycleState, available: ReadonlySet<string>): CyclePhase`
  — `getCyclePhaseForTonight(state)`, then substitute to `recovery` when the
  phase's class is not in `available`. Recovery nights are unchanged.
- `isDynamicCyclingAvailable(available: ReadonlySet<string>): boolean` — true
  iff `available` contains `exfoliant` or `retinoid`.
- `DYNAMIC_UNAVAILABLE_REASON = 'dynamic_unavailable_no_actives'`.
- `getCyclePhaseForTonight` unchanged (checkInCycle idempotency tests depend on it).

### `dailyView.ts`
- `availableCycleClasses(products, facts, freezeRules, dayOfWeek): Set<string>`
  — cycle classes of products that are eligible (`facts.eligible`) AND not
  clinically frozen tonight. "On shelf" = eligible, per spec.
- `getDynamicCycleStatus(products, input): { phase: CyclePhase; available: boolean; reasonCode: string | null }`
  — the resolved tonight phase + availability, for the Today phase card.
- `getDailyView` internal `dynamicPhase` now uses `resolveCyclePhase` over the
  computed available set (was raw `getCyclePhaseForTonight`).

### UI
- TodayScreen: phase card reads `getDynamicCycleStatus`; when `!available`,
  render a "dynamic cycling paused — add an exfoliant or retinoid" notice
  instead of the phase label.
- ProfileScreen: confirm-dialog copy notes the manual weekly schedule is kept.

## 3. Implementation Tasks

- **P6-1** cycleState.ts: `resolveCyclePhase`, `isDynamicCyclingAvailable`,
  reason constant.
- **P6-2** dailyView.ts: `availableCycleClasses`, `getDynamicCycleStatus`,
  wire `dynamicPhase` to `resolveCyclePhase`.
- **P6-3** TodayScreen: unavailable notice + resolved phase; ProfileScreen copy.
- **P6-4** tests: cycleState resolution unit; dailyView integration
  (retinoid-free → recovery, PAO-frozen retinoid → recovery, restore on
  re-add, index never resets); determinism pins (fixed seasonMask +
  source-invariance); scheduledDays round-trip preservation.

## 4. Assumptions

- **`available` carries the render-time eligible set, not the raw catalog.** A
  hidden/PAO-expired/clinically-frozen retinoid does not keep retinoid night
  alive. Alternative: raw presence. Reason: the spec is explicit, and an
  unusable product driving the cycle would show an empty night anyway.
- **6.2 builds no storage machinery.** The premise is stale; adding a preserved
  copy would duplicate state that render-time gating already keeps intact, and
  risk divergence. A regression test guards the property instead.
- **`resolveCyclePhase` takes a `Set<string>`, not `ProductFacts`.** Keeps
  cycleState.ts free of eligibility/facts semantics (it owns the phase machine,
  not the shelf). The caller derives the set where facts + freeze context live.
- **Dynamic-unavailable is surfaced, not enforced.** The engine still resolves
  every night to recovery; the UI advises switching to fixed. Reason: never
  block the user; matches the OBF/AI "always a fallback" constraint.

## 5. Open Questions

None. Consultant list unchanged.

---

# Phase 7 — Explainability (DecisionLog → UX) + Override

Spec: docs/specs/routine-engine-v2.1/phase-07-explainability.md
Date: 2026-07-18. §4.4 ruling: enum stays decoupled from pair-rule IDs.

## 1. Architecture Overview

Two premises simplified since the spec was written:
- **`stacking_cap_*` synthesis is GONE** (Phase 4 removed per-class stacking).
  The enum is a plain closed string union — NO template-literal member.
- The only conflation left is `resolve.ts:443` `reasonCode: primary.ruleId` on
  a pair-rule freeze. Prerequisite fix: pair rules carry their own reasonCode.

```
actives.json pairRules += reasonCode
  └─ Violation carries {ruleId, reasonCode}
  └─ resolve emits reasonCode (the code), keeps ruleId (provenance)
decisionReasons.ts (new): DecisionReasonCode union + REASON_TEXT
  satisfies Record<DecisionReasonCode,string>   (orphan = compile error)
  rulesetIntegrity: every JSON/emitted code ∈ enum; no rule_* in reasonCode
EngineInput.userOverrides?: string[]  → selectSkeleton re-includes into eligible
  periods only (retinoid-in-AM structurally impossible via allowedPeriods)
routinesStore: { overrides, hash } ; buildEngineInput clears on hash mismatch
DraftPreviewSheet: reason text on frozen + reserve rows + "add anyway" override
```

## 2. API Contracts

### `decisionReasons.ts` (new)
- `type DecisionReasonCode = <closed union of every JSON + engine-emitted code>`
  (lower_snake_case; NO pair-rule `rule_*` ids; NO template-literal).
- `export const REASON_TEXT = { … } satisfies Record<DecisionReasonCode, string>`.
- `reasonText(code: string): string` — dictionary lookup, falls back to a
  generic line for an unknown code (defensive; never throws).

### `actives.json` pairRules
- each entry += `reasonCode` (a DecisionReasonCode, e.g. `retinoid_acid_conflict`).

### `resolve.ts`
- `Violation += reasonCode`. `findPairViolations` sets `reasonCode: rule.reasonCode`;
  `findCapViolations` sets `reasonCode: 'cumulative_active_cap'`.
- The frozen item + keep_with_note/day_split decisions emit
  `reasonCode: primary.reasonCode`, `ruleId: primary.ruleId`.

### types (planTypes.ts)
- `FrozenItem.reasonCode`, `ReserveItem.reasonCode`, `DecisionLogEntry.reasonCode`,
  `PlaceholderSlot.reasonCode` → `DecisionReasonCode`. Expect suite fallout.
- Drop the dead `'stacking_cap'` DecisionAction (nothing emits it since Phase 4).

### `generate.ts`
- `EngineInput.userOverrides?: string[]` threaded to `selectSkeleton`.

### `selectSkeleton` (skeleton.ts)
- A product in `userOverrides` that would be reserved is instead added to its
  eligible periods' candidates with an `action: 'admit'` + `detail: 'override'`
  decision; no reserve entry. Overrides only reach ELIGIBLE periods
  (`periodsForProduct`), so retinoid-in-AM stays impossible. The admission pass
  still applies pair/cap resolution — an override bypasses minimalism, not
  same-day safety (do-no-harm, principle #3).

### domain / store
- `routinesStore += overrides: string[], overrideHash: string`,
  `setOverrides(ids, hash)`, `clearOverrides()`.
- `overrideHash = hash(sorted productIds ++ primaryGoal ++ secondaryGoal)` —
  a pure helper in routinePlanActions.
- `buildEngineInputFromStores`: include overrides only when the stored hash
  equals the current-state hash; else drop them (invalidation on shelf/goal
  change). generatePlan stays pure — it just receives `userOverrides`.

## 3. Implementation Tasks

- **P7-1** pairRules reasonCode + Violation split + resolve emit.
- **P7-2** decisionReasons.ts enum + REASON_TEXT + reasonText.
- **P7-3** tighten types; drop dead 'stacking_cap'.
- **P7-4** integrity tests (JSON⊆enum, emitted-literal⊆enum, no rule_* in
  reasonCode, rename-invariance).
- **P7-5** override: EngineInput + selectSkeleton + hash + store + buildEngineInput.
- **P7-6** UI: DraftPreviewSheet reason text on frozen/reserve + override action;
  component test. Serialization check (reserve survives round-trip).

## 4. Assumptions

- **Override bypasses minimalism, not same-day safety.** A forced-in strong
  active still day-splits/relocates via the ladder rather than co-scheduling an
  avoid pair. Alternative: full "I accept the risk" co-schedule. Reason:
  do-no-harm (#3); the acceptance only needs "brought back + survives regen",
  which the eligible-period re-inclusion satisfies. Documented as the
  conservative reading.
- **retinoid-in-AM is enforced structurally, not by a special override check.**
  `periodsForProduct` returns pm-only for retinoid, so an override can never
  place it in AM. A test asserts it; no bespoke guard needed.
- **The enum contains only codes the engine or a ruleset can emit** (no
  speculative `conflicts_with_selected` / `frozen_irritation` / `period_not_eligible`
  / `frequency_capped` from the spec draft — nothing emits them). Keeps the
  "no orphan enum member" acceptance true.
- **`reasonText` never throws on an unknown code.** A future code missing from
  the dictionary yields a generic line, not a crash — the integrity test is the
  real guard; the runtime is defensive.
- **`pregnancy_blocked` excluded** (Phase 3 §4.3 still open).

## 5. Open Questions

None. §4.3 (pregnancy, non-overridable) remains deferred.

---

# Phase 8 — Migrations (schema v3): peptide re-attribution, confirmation flags

Spec: docs/specs/routine-engine-v2.1/phase-08-migrations.md
Date: 2026-07-18

## 1. Architecture Overview

Most of this phase already shipped. Verified against the code:
- **8.2 vitamin C prompt — ALREADY DONE.** ProductDetailScreen renders the
  `vitaminCAutoMigrated` infobox and re-tags to derivative + clears the flag on
  tap. Only a component test is added.
- **8.4 goal migration — ALREADY DONE** in migrateProfile (phase-03).
- The migration runner (services/storage.ts) + idempotent-same-reference
  contract already exist.

New work: peptide re-attribution, `phototypeNeedsConfirmation` flag + a
one-time confirm banner (parallel to Phase 3's GoalConfirmBanner), and the
single schema bump 2 → 3.

```
migrateProfile  += phototypeNeedsConfirmation (set once when the field is absent
                   and a phototype existed to derive fitzpatrick from)
migrateProductActiveKeys += peptide re-attribution (copper_peptides tag whose
                   INCI carries no copper marker → peptide_signal)
CURRENT_SCHEMA_VERSION 2 → 3
RoutinesScreen  += PhototypeConfirmBanner (Confirm clears flag / Adjust → Profile)
```

## 2. API Contracts

### types (index.ts)
- `UserProfile += phototypeNeedsConfirmation: boolean`.

### `migrateProfile` (migrations.ts)
- `phototypeNeedsConfirmation` absent (pre-v3) → set to `phototype !== null`
  (a migrating user with a grouped phototype gets the one-time confirm; a
  post-v3 profile keeps its stored value). Folded into the same
  same-reference guard as city/fitzpatrick/goals.

### `migrateProductActiveKeys` (migrations.ts)
- After key normalization: if `activeTags` includes `copper_peptides` AND
  `fullIngredientText` is non-empty AND `parseActiveIngredientsFromInci(text)`
  does NOT yield `copper_peptides` → replace `copper_peptides` with
  `peptide_signal` in `activeTags`. No INCI text → unchanged (user assertion).

### `CURRENT_SCHEMA_VERSION` → 3.

### UI
- `PhototypeConfirmBanner` (new, parallel to GoalConfirmBanner): "Confirm your
  skin tone" with Confirm (clears the flag) / Adjust (opens the profile editor).
  Rendered on RoutinesScreen while `profile.phototypeNeedsConfirmation`.

## 3. Implementation Tasks

- **P8-1** types + profileStore default + onboarding/editor set false.
- **P8-2** migrateProfile phototype flag; migrateProductActiveKeys peptide
  re-attribution; bump to 3.
- **P8-3** PhototypeConfirmBanner + RoutinesScreen wiring.
- **P8-4** tests: migration unit (peptide cases, phototype flag, idempotency +
  same-reference, version === 3), banner component test, vitamin C infobox
  component test (verifies the shipped 8.2 path).

## 4. Assumptions

- **phototypeNeedsConfirmation = (phototype !== null) on migration.** Any
  migrating profile with a grouped phototype had its fitzpatrick auto-derived
  and never confirmed on the 6-card UI, so it is asked once. Alternative: track
  a provenance bit. Reason: no such bit exists, the prompt is one-time and
  cheap, and a fresh post-v3 profile sets the flag false explicitly.
- **Peptide re-attribution only rewrites the `copper_peptides` TAG, and only
  when INCI evidence contradicts it.** No INCI text = keep (do-no-harm; the
  user asserted it). Unattributed/parsed peptides need no migration — the
  Phase 1 matchers already classify them at read time.
- **`vitamin_c` legacy tags in `activeTags` were already migrated in v2** — the
  peptide step composes with that, running after normalization in the same
  function so one product rewrite covers both.

## 5. Open Questions

None. §4.3 (pregnancy) remains out of scope.
