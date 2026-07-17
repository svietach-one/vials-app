# Phase 3 — Goal Model (Pipeline Step 0)

Depends on: Phase 1.

> **Reconciled 2026-07-17.** The premise holds — there is no goal taxonomy.
> But a partial goal→class mapping already exists in inverted form, the profile
> field is `concerns`, not `skinIssues`, and the pregnancy "flag" the phase
> leans on does not exist at all. See `DISCREPANCY-REPORT.md` §3, §4.3.

## Actual state

- `UserProfile.concerns: SkinConcern[]` exists — 9 values: `acne`, `dryness`,
  `wrinkles`, `sensitivity`, `redness`, `eczema`, `hyperpigmentation`, `pores`,
  `dark_spots`. There is **no** `skinIssues` field.
- **Goal matching already drives admission**, inverted: each class declares
  `concerns` (e.g. `retinoid: ["wrinkles","acne","pores"]`), and
  `scoreCandidate` (`resolve.ts:121`) scores
  `boost*1000 + concernHits*100 + potency*10`.
- What is missing is the **goal taxonomy** and, critically, **priority order**:
  the class→concerns index cannot express that `retinoid` outranks `niacinamide`
  for `acne`. `concernHits` counts matches; it does not rank treatments.
- `EngineInput.profile` is `Pick<UserProfile, 'fitzpatrick' | 'concerns'>`.
- Nothing pregnancy-related exists anywhere.

## Problem

`concerns` is a symptom list, not a goal. The engine can tell that a product
*touches* a concern but not that it is *the right treatment* for the user's
primary goal — so it cannot select 0-or-1 treatment in Phase 4, and has no
defined behavior when the user has no problems at all.

## Tasks

### 3.1 Type and storage

In `src/types/index.ts` + `src/store/profileStore.ts`:

```ts
export type SkinGoal =
  | 'acne'
  | 'pigmentation'
  | 'aging'
  | 'dehydration'
  | 'barrier_repair'
  | 'oil_control'
  | 'maintenance';   // default: no problems, maintenance care
```

Added to `UserProfile` (flat fields, consistent with the existing shape — the
original phase's nested `ProfileGoals` interface would be the only nested
config object on the profile):

```ts
primaryGoal: SkinGoal;             // default 'maintenance'
secondaryGoal: SkinGoal | null;
goalNeedsConfirmation: boolean;
```

Onboarding / profile editor: pick at most 2 goals.

**Migration** (schema v3, folded into Phase 8's single bump — do not bump twice):
derive from `concerns`, first match wins in this order, then set
`goalNeedsConfirmation: true` for a one-time in-app confirmation.

| concern | → goal |
|---|---|
| `acne`, `pores` | `acne` |
| `hyperpigmentation`, `dark_spots` | `pigmentation` |
| `wrinkles` | `aging` |
| `dryness` | `dehydration` |
| `sensitivity`, `redness`, `eczema` | `barrier_repair` |
| (empty) | `maintenance` |

`concerns` is **retained**, not replaced — it still feeds `concernHits`
scoring, and the engine keeps working for users who never confirm a goal.

### 3.2 `goals` block in `actives.json`

Which classes solve each goal, **priority = array order**. This lives in
`actives.json` next to `classes` and `pairRules`, not in a new TS constants
file — the class keys must stay validatable against `classes` by
`rulesetIntegrity.test.ts`, and a parallel TS map would fork the taxonomy
(report §2).

```
goals: {
  acne:           ["retinoid","bha","benzoyl_peroxide","azelaic_acid","niacinamide"],
  pigmentation:   ["vitamin_c_pure","vitamin_c_derivative","azelaic_acid","retinoid","aha","niacinamide"],
  aging:          ["retinoid","peptide_signal","copper_peptides","vitamin_c_pure","vitamin_c_derivative","peptide_neuro"],
  dehydration:    ["hyaluronic_acid","glycerin_class","ceramides"],
  barrier_repair: ["ceramides","cica","panthenol","niacinamide"],
  oil_control:    ["niacinamide","bha","azelaic_acid"],
  maintenance:    []
}
```

Class keys are the **real** ones (`copper_peptides`, `ceramides`, `cica`,
`hyaluronic_acid`); `peptide_signal`, `peptide_neuro`, `glycerin_class` arrive
in Phase 1.

> **Clinical review flag (unchanged):** draft values based on common
> dermatological practice. Per PRD §6 they need the clinical consultant's
> sign-off. Structure now, values later — no refactor either way.

**`glycerin_class` lands here, not Phase 1** (Phase 1 deviation 1, approved
2026-07-17): attributing it by bare INCI presence tagged nearly every product
and would flatten this phase's goal ranking. Phase 3 must pick a real
attribution rule — and per the user's ruling, solve it **jointly with
trace-amount attribution for strong actives** (e.g. an "acid cream" with
glycolic at the tail of its INCI list currently attributes full-strength AHA).
Both are the same heuristic — INCI position ≈ concentration, since lists are
concentration-ordered above 1% — and the same clinical question.

**Consultant review list for this phase** (one review, three items):
1. `goals` block values (class rankings per goal);
2. `glycerin_class` attribution rule (position/productType gate);
3. trace-amount threshold for strong-active attribution (position gate or
   marker-word heuristic), and whether it downgrades potency or drops the
   class entirely.

### 3.3 Modifiers

Applied to the ranking before selection:

- **`barrier_repair` as any goal** → exclude classes with `irritancy >= 3`
  from treatment candidates; reason `barrier_repair_excludes_irritants`.
  Uses the Phase 1 potency-aware irritancy, so a retinol (3) is excluded while
  a `vitamin_c_derivative` (1) survives.
- **Fitzpatrick 4–6 + goal `pigmentation`** → promote `azelaic_acid` and
  `niacinamide` above `aha` (PIH risk). Composes with the existing
  `phototype_pih_*` modifiers rather than replacing them.
- **Goal `pigmentation`** → SPF mandate trigger (`spf_required_goal`),
  completing Phase 2.1's third trigger.

> **[OPEN — see DISCREPANCY-REPORT §4.3] Pregnancy/lactation is deferred.**
> The original phase treats `PREGNANCY_BLOCKED` as reading an existing profile
> flag. Nothing pregnancy-related exists: it needs a new profile field,
> onboarding + editor UI, a migration, a hard-block engine path, and a product
> decision about asking at all. That is its own feature, not a bullet here.
> Excluded from this phase's scope and acceptance pending your call. The
> `pregnancyBlocked` per-class property is **not** added in Phase 1 until then.

### 3.4 Step 0 — resolve goals before facts

In `generate.ts`, resolve `{ goals, modifiers, treatmentClassRanking }` before
`buildShelfFacts` and thread it through `RoutineContext` (which already carries
cross-step derived state). Extend `EngineInput.profile` to
`Pick<UserProfile, 'fitzpatrick' | 'concerns' | 'primaryGoal' | 'secondaryGoal'>`.

`treatmentClassRanking` is a deterministic ordered `ActiveClass[]` — the
`goals` block filtered and reordered by 3.3. Phase 4 consumes it; nothing else
changes shape in this phase.

## Files

- `src/types/index.ts` — `SkinGoal`, `UserProfile` fields
- `src/store/profileStore.ts` — fields + defaults
- `src/utils/routineEngine/migrations.ts` — `concerns` → goal derivation
- `src/constants/rulesets/actives.json` — `goals` block
- `src/constants/rulesets/rulesetTypes.ts` — `goals` types
- `src/utils/routineEngine/context.ts` — Step 0 resolution
- `src/utils/routineEngine/generate.ts` — `EngineInput.profile` widening
- `src/screens/` — SkinProfileSetup / profile editor goal selector

## Acceptance

- [ ] Profile without goals → `primaryGoal: 'maintenance'`
- [ ] Legacy profile with `concerns: ['wrinkles']` → `aging` +
      `goalNeedsConfirmation: true`; prompt shown exactly once
- [ ] Legacy profile with `concerns: []` → `maintenance`
- [ ] `barrier_repair` + retinol on shelf → retinol not in
      `treatmentClassRanking`; `barrier_repair_excludes_irritants` logged
- [ ] Fitzpatrick 5 + `pigmentation` → `azelaic_acid` ranks above `aha`
- [ ] Goal `pigmentation`, no SPF on shelf → AM SPF placeholder with
      `spf_required_goal`
- [ ] Determinism: identical profile + shelf → identical `treatmentClassRanking`
- [ ] `rulesetIntegrity` asserts every key in `goals` exists in `classes`
- [ ] `npx tsc --noEmit` clean
