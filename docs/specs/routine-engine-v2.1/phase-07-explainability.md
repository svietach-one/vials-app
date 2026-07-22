# Phase 7 — Explainability (DecisionLog → UX) and Override Flow

Depends on: Phase 4.

> **Reconciled 2026-07-17.** The DecisionLog already exists and is already
> serialized with the plan; the premise "the engine silently freezes products"
> is half false — it logs, but nothing surfaces the log. The enum is the real
> work, and it is harder than the original phase assumes. See
> `DISCREPANCY-REPORT.md` §4.4.

## Actual state

- `DecisionLogEntry { action, productId?, period?, ruleId?, reasonCode?, detail? }`
  exists (`planTypes.ts:75`), and `RoutinePlan.decisions` is already serialized
  with the plan — the original task 4 is **already done**.
- `reasonCode` is an open `string`.
- **22 reason codes already exist in the ruleset JSON** (`phototype_pih_risk`,
  `summer_photosensitizer_spf`, `meso_spf_mandatory`, `peel_rehab_no_exfoliants`,
  …), all lower_snake_case, plus code-level ones: `product_hidden`,
  `pao_expired`, `no_allowed_period`, `relocation_rejected`. The original
  phase's proposed enum lists **none** of them.
- `resolve.ts:246` **synthesizes** codes at runtime: `` `stacking_cap_${cls.key}` ``.
- **`reasonCode` and `ruleId` are conflated.** `resolve.ts:410` writes
  `reasonCode: primary.ruleId`, so `FrozenItem.reasonCode` today holds
  *pair-rule IDs* (`rule_retinol_aha`, …) and `stacking_cap_*` IDs — not reason
  codes. One field, two vocabularies.
- Nothing in the UI reads `decisions`.

## Problem

The engine is accountable but not legible: every decision is logged, and no
user can see any of it. Without an answer to "why is this product not in my
routine," trust dies after the first generation.

## Tasks

### 7.1 Close the `DecisionReasonCode` enum

The enum is `existing ∪ new`, not new-only. Four constraints the original
phase did not account for:

1. **The 22 JSON codes are authored in the rulesets**, so the TS enum cannot be
   their source of truth. Direction: enum enumerates them; an integrity test
   asserts the two sets agree in both directions.
2. **`stacking_cap_*` is synthesized.** Express it as a template-literal member:
   ```ts
   type StackingCapCode = `stacking_cap_${ActiveClass}`;
   export type DecisionReasonCode = StaticReasonCode | StackingCapCode;
   ```
   A plain string union cannot represent it, and hand-listing 18 variants
   desynchronizes the moment a class is added.
3. **Dictionary text.** `satisfies Record<DecisionReasonCode, string>` works for
   the static half; the template-literal half needs generated entries (map over
   the class keys) or a resolver function. Prefer generation — it keeps the
   "enum code without text is a compile error" guarantee the phase asks for.
4. **Split `reasonCode` from `ruleId` first.** `resolve.ts:410` borrows
   `ruleId` as the `reasonCode`, leaking pair-rule IDs into the reason
   vocabulary. Do **not** absorb pair-rule IDs into the enum — it would couple
   reasons to the rule registry and break on rename (Phase 1 already deletes
   `rule_vitc_niacinamide`). Instead: add an explicit `reasonCode` to each
   `pairRules` entry, and have line 410 emit that, keeping `ruleId` as
   provenance. This is a prerequisite, not a cleanup — the enum cannot close
   while the field carries two vocabularies.

New codes introduced in Phases 2–6, in this codebase's lower_snake_case:
`not_needed_for_goals`, `duplicate_function`, `conflicts_with_selected`,
`frozen_irritation`, `barrier_repair_excludes_irritants`,
`spf_required_photosensitizing`, `spf_required_goal`, `period_not_eligible`,
`frequency_capped`, `dynamic_unavailable_no_actives`.

`pregnancy_blocked` is **excluded** pending the Phase 3 §4.3 decision.

Location: `src/constants/decisionReasons.ts` (new) — code → human-readable
English text. Tighten `DecisionLogEntry.reasonCode` and `FrozenItem.reasonCode`
from `string` to `DecisionReasonCode`; expect fallout across `resolve.ts`,
`eligibility.ts`, `mandates.ts`, and their suites.

### 7.2 UI

On every reserve/frozen product card, show the reason line and, where
applicable, what to change for the product to enter the routine
(e.g. *"Will join your routine with the 'Anti-aging' goal"*).

Copy is English-only and ≥14 px per CLAUDE.md. The reason line is UI text
derived from the dictionary — screens read `decisionReasons`, never
reconstruct rules.

### 7.3 Override

The user can force an excluded product back in via an explicit "I understand
the risk, add anyway" step — same philosophy as block + acknowledgment in US-18.

- recorded on the plan as `userOverride: true`; survives regeneration while
  shelf composition and goals are unchanged;
- **cannot** bypass retinoid-in-AM period eligibility — a hard block.

Overrides are user state, not engine state: they must persist through the store
and enter the engine as input, keeping `generatePlan` pure and deterministic.
Invalidation ("shelf composition and goals unchanged") needs a comparable key —
derive a deterministic hash of `(sorted productIds, primaryGoal, secondaryGoal)`
and store it with the override.

> **[OPEN]** The original phase also lists `PREGNANCY_BLOCKED` as
> non-overridable. Deferred with Phase 3 §4.3.

### 7.4 Serialization

Already done — `RoutinePlan.decisions` ships with the plan. Verify `reserve`
(Phase 4) is serialized on the same path and survives a store round-trip.

## Files

- `src/constants/decisionReasons.ts` (new) — enum + dictionary
- `src/constants/rulesets/actives.json` — `reasonCode` on each `pairRules` entry
- `src/utils/routineEngine/resolve.ts` — emit `reasonCode` at :410, keep
  `ruleId` as provenance
- `src/utils/routineEngine/planTypes.ts` — tighten `reasonCode` types
- `src/utils/routineEngine/generate.ts` — `userOverride` input, override hash
- `src/store/routinesStore.ts` — override persistence
- `src/components/routine/`, `src/screens/` — reserve cards, override flow
- `src/utils/routineEngine/rulesetIntegrity.test.ts` — JSON ↔ enum agreement

## Acceptance

- [ ] Every shelf product not in the routine has exactly one `reasonCode` in
      the log
- [ ] Every `reasonCode` in every ruleset JSON has dictionary text, and every
      static enum member appears in some ruleset or engine path (no orphans in
      either direction)
- [ ] An enum code without dictionary text is a **compile** error
- [ ] `stacking_cap_<newClass>` typechecks without editing the enum by hand
- [ ] No pair-rule ID (`rule_*`) appears in any `reasonCode`; a product frozen
      by `rule_retinol_aha` reports a reason code and carries the rule ID as
      `ruleId`
- [ ] Renaming a `pairRules` entry's `id` does not change any `reasonCode`
- [ ] Override brings the product back and survives regeneration
- [ ] Override is impossible for retinoid-in-AM
- [ ] Changing the shelf invalidates the override
- [ ] `generatePlan` remains pure with overrides threaded as input
- [ ] `npx tsc --noEmit` clean
