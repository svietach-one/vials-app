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
