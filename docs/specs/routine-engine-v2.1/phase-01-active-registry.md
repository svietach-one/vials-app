# Phase 1 — Irritancy Recalibration, Peptide Subclasses, Conflict Matrix Consolidation

Depends on: nothing. Blocks: all other phases.

> **Reconciled 2026-07-17.** The original phase assumed no irritancy scale, a
> `PEPT` tag, and an un-updated matrix. None of that is true of the merged V2
> engine — see `DISCREPANCY-REPORT.md` §1 (#1, #2, #3). The intents survive;
> the work is recalibration and consolidation, not greenfield construction.

## Actual state

- `src/constants/rulesets/actives.json` defines **15 classes**, each with
  `properties.irritancy` (0–5), `photosensitizing`, `exfoliating`,
  `barrierRepair`, plus `stacking`, `allowedPeriods`, `preferredPeriod`,
  `concerns`, `adaptation`. It is already the single source of truth.
- Conflicts live in **two** places: `actives.json` `pairRules` (6 rules, rich —
  `scope`, `resolutions`, potency `exceptions`) and the legacy
  `src/constants/conflictRulesDb.ts` `INGREDIENT_CONFLICT_RULES` (4 rules, flat),
  which is what `ConflictEngine` actually reads.
- There is no `PEPT` tag. `copper_peptides` matchers are already narrow.
  Signal and neuro peptides match **nothing** — they are invisible to the
  engine, which is the real gap (it blocks goal matching in Phase 3).

## Problem

1. The irritancy **values** are miscalibrated against clinical intent, and
   retinoid irritancy is flat (3) when it should track potency — OTC retinol
   and tretinoin are not equally irritating.
2. Signal and neuro peptides are unclassified, so a Matrixyl serum cannot be
   selected as an `aging` treatment in Phase 3.
3. Two conflict matrices disagree. `conflictRulesDb.ts` says pure vitamin C +
   niacinamide is a `caution` conflict — a myth we intend to retire — and it,
   not `pairRules`, is what `ConflictEngine` consumes.

## Tasks

### 1.1 Recalibrate irritancy in `actives.json`

Apply the clinical scale. Document it as JSDoc on the `irritancy` field in
`src/constants/rulesets/rulesetTypes.ts` (the scale has no home today):

| Level | Meaning | Classes |
|---|---|---|
| 0 | Inert / restorative | ceramides, panthenol, hyaluronic_acid, glycerin_class, spf_filters |
| 1 | Mild actives | niacinamide, peptide_signal, peptide_neuro, vitamin_c_derivative, pha |
| 2 | Moderate | azelaic_acid, copper_peptides |
| 3 | Strong | aha, bha, vitamin_c_pure, retinoid @ potency low/medium |
| 4 | Very strong | benzoyl_peroxide, retinoid @ potency high/rx |
| 5 | Reserved for prescription (unused in v2.1) | — |

Changes from shipped values: `bha` 2→3, `vitamin_c_pure` 2→3,
`benzoyl_peroxide` 3→4, `azelaic_acid` 1→2, `copper_peptides` 1→2.

**Potency-aware retinoid.** The scale needs a per-potency irritancy the schema
cannot express today. Add an optional `irritancyByPotency` to the class
properties, resolved in `productFacts.ts` `aggregateProperties` (which already
knows each attributed class's `potency`); fall back to flat `irritancy` when
absent. Only `retinoid` declares it in v2.1:

```
retinoid.properties.irritancyByPotency: { low: 3, medium: 3, high: 4, rx: 4 }
```

### 1.2 `isStrongActive` — derived, not stored

`isStrongActive` is **not** a new stored field; it is `irritancy >= 3`, and it
governs which classes may declare a stacking cap. Add the derivation to
`rulesetTypes.ts` and enforce the invariant in the existing
`rulesetIntegrity.test.ts`:

> a class declares `stacking` **iff** `isStrongActive(class)`.

This is the structural form of the intent *"the cap limits irritants, not
bioactivity"* — peptides, niacinamide, and vitamin C derivatives declare no
`stacking` block, so they cannot consume an irritant cap. (There is no global
`maxActivesPerPeriod` in this codebase; the cap is per-class
`stacking.maxPerPeriod` + `sharedCapWith`.)

**PHA leaves the exfoliant shared cap — in this phase.** Enforcing the invariant
surfaced a violation the audit had assigned to Phase 4: `pha` ships a `stacking`
block while being irritancy 1. Under the directive PHA is mild, so it loses the
block. It must also leave `aha`/`bha`'s `sharedCapWith`, or the cap becomes
**admission-order dependent** — a PHA admitted first would block a later AHA via
AHA's group, while AHA-first would not block PHA (PHA has no block to check).
That asymmetry is a determinism defect, so the two edits cannot be separated.

Report §7.2 predicted this loosening but placed it in Phase 4; the invariant
forces it here. Net effect (accepted, per the directive's mild/strong split): an
AHA serum + a PHA toner may now share one PM. Exfoliant exposure remains capped
where it matters — `phototype_pih_exfoliant_cap` (types 4–6) and
`summer_uv_exfoliant_limit` both target `properties.exfoliating` and are
untouched.

**RESOLVED 2026-07-17 (report §4.1):** `vitamin_c_pure` moves to 3 and the cap
is intended. Add a `stacking: { maxPerPeriod: 1 }` block to `vitamin_c_pure` so
the invariant holds against the shipped mechanism.

This is deliberate short-lived churn: **Phase 4 replaces per-class `stacking`
wholesale** with the cumulative cap and restates the invariant as
*"subject to the cumulative cap iff `irritancy >= 3`"*. Phase 1 keeps the
shipped mechanism coherent rather than leaving a half-migrated cap. See report
§7 assumption 8.1.

### 1.3 Peptide subclasses — new classes in `actives.json`

Add `peptide_signal` and `peptide_neuro` as full classes. **Keep
`copper_peptides` under its existing key** — it is persisted in user data as an
`activeTags` value; renaming it to `peptide_copper` costs a migration and buys
nothing.

Matchers (regex, consistent with existing style):

```
peptide_signal: palmitoyl (tri|tetra|penta)peptide-\d+, myristoyl pentapeptide-17,
                hexapeptide-9, oligopeptide-1, matrixyl
peptide_neuro:  acetyl hexapeptide-8, argireline, pentapeptide-18, leuphasyl,
                dipeptide diaminobutyroyl benzylamide diacetate, syn-ake
```

Both: `irritancy 1`, `photosensitizing false`, `exfoliating false`,
`allowedPeriods ["am","pm"]`, no `stacking`. `concerns: ["wrinkles"]` on both
(this is what makes them reachable from Phase 3's `aging` goal).

**Fallback.** An INCI token containing `peptide` that matches no peptide class
attributes to `peptide_signal` — the conservative subclass (no conflicts, still
visible to goal matching). Implement as the lowest-priority matcher on
`peptide_signal`; it must not shadow `copper_peptides`, so it needs a negative
pattern for copper markers. Cover ordering explicitly in tests.

> **DEVIATION 2026-07-17 — `glycerin_class` deferred to Phase 3.** This section
> originally also added `glycerin_class` here. It was implemented, then removed
> during Phase 1 on evidence:
>
> - Glycerin, glycols and betaine appear in the large majority of formulations,
>   so the class attributed to nearly every product. It broke the parser's
>   standing contract that a formula with no *meaningful* actives yields no
>   classes (5 existing tests, e.g. ingredientParser's "returns an empty array
>   when INCI text contains no mapped ingredients").
> - Worse than the test churn: `concerns: ['dryness']` on a near-universal class
>   would give almost every product a goal-match hit, flattening the Phase 3
>   ranking it exists to serve — a random serum would score level with a
>   hyaluronic serum.
> - It has **no consumer in Phase 1**. Shared principle #1 (minimalism) says do
>   not ship it early, and the `dehydration` goal that needs it lands in Phase 3.
>
> Phase 3 adds it together with the `goals` block, and must decide the
> attribution rule then — most likely gating on INCI position (lists are
> concentration-ordered, so glycerin in the top few positions is a real
> humectant claim) or on productType, rather than bare presence. That is a data
> question for the clinical-consultant review the `goals` block already needs.

### 1.4 Consolidate the conflict matrix onto `pairRules`

One matrix. Delete `INGREDIENT_CONFLICT_RULES` from `conflictRulesDb.ts` and
repoint `ConflictEngine.detectConflicts` / `getConflictsForProduct` at
`ACTIVES_RULESET.pairRules`. `PROCEDURE_COLLISION_RULES` stays where it is —
it is a different domain and is not duplicated.

Severity vocabulary stays `avoid` / `caution` (`high→avoid`, `medium→caution`).
Pairs absent from the table are compatible.

Required end state of `pairRules`:

| Pair | Result | Severity | Status |
|---|---|---|---|
| retinoid + aha | conflict | avoid | exists |
| retinoid + bha | conflict | avoid | exists |
| retinoid + benzoyl_peroxide | conflict (mutual degradation) | avoid | exists |
| aha/bha + vitamin_c_pure | conflict (pH) | caution | exists |
| copper_peptides + aha/bha/pha | conflict | avoid | exists |
| vitamin_c_pure + copper_peptides | conflict | caution | **add** |
| vitamin_c_derivative + benzoyl_peroxide | conflict | caution | **add** |
| **vitamin_c_pure + niacinamide** | **compatible** | — | **remove `rule_vitc_niacinamide`** |

The vitamin C + niacinamide rule must be deleted from **both** tables, and the
`compatible` intent recorded so it is not "fixed" back. `pairRules` has no
syntax for a positive assertion — encode it as a test in
`rulesetIntegrity.test.ts` (*"vitamin_c_pure + niacinamide resolves to no
violation"*), not as a comment.

Implicitly compatible, asserted by the same integrity test so a future edit
cannot silently break them: retinoid + peptide_signal/peptide_neuro, retinoid +
niacinamide, azelaic_acid + anything, vitamin_c_derivative + anything except BPO.

Self-conflict exemption is unchanged (`ProductA.id !== ProductB.id`).

### 1.5 `rinseOff` on ProductFacts (cumulative rule — data half)

Amendment of 2026-07-17 (report §7). The cumulative active exposure rule is
**enforced in Phase 4**; Phase 1 provides only the data it runs on:

- `isStrongActive` (§1.2) is the mild/strong boundary. **Mild = `irritancy <= 2`**
  (no cumulative restriction, any number per period, any slot). **Strong =
  `irritancy >= 3`** (one leave-on carrier per period across all slots).
- `rinseOff: boolean` on `ProductFacts`, **derived from `productType`**, not
  persisted. Rinse-off products carrying strong classes will not consume the
  cumulative cap.

```ts
const RINSE_OFF_TYPES: ProductType[] = ['cleanser', 'makeup_remover'];
```

Only these two of the 18 `ProductType` members are unambiguously rinse-off.
`peeling` and `mask` are deliberately **leave-on**: peel gels rinse but peel
pads do not, and sleeping masks are leave-on — do-no-harm says an ambiguous
product consumes the cap rather than escaping it. Derived rather than persisted,
so a future per-product override is non-breaking. Report §7 assumption 8.4.

Reserve the reason code `cumulative_active_cap` (lower_snake_case; the directive
wrote `CUMULATIVE_ACTIVE_CAP`). Phase 4 emits it; Phase 7's enum closes over it.
**Phase 1 adds no emission and no enforcement** — `rinseOff` is unused until
Phase 4, which is intended.

## Files

- `src/constants/rulesets/actives.json` — irritancy recalibration,
  `irritancyByPotency` on retinoid, `stacking` on `vitamin_c_pure`,
  `peptide_signal` / `peptide_neuro` / `glycerin_class` classes, `pairRules`
  additions + `rule_vitc_niacinamide` removal
- `src/constants/rulesets/rulesetTypes.ts` — irritancy scale JSDoc,
  `irritancyByPotency` type, `isStrongActive` derivation
- `src/utils/routineEngine/productFacts.ts` — potency-aware irritancy
  resolution, `rinseOff` derivation
- `src/constants/conflictRulesDb.ts` — delete `INGREDIENT_CONFLICT_RULES`
- `src/utils/conflictEngine.ts` — read `pairRules`
- `src/utils/routineEngine/rulesetIntegrity.test.ts` — stacking invariant,
  compatibility assertions

## Acceptance

- [ ] Matrixyl product + pure vitamin C on the same day → no conflict, **and**
      the Matrixyl product attributes to `peptide_signal` (the pre-existing
      behavior passed this vacuously by matching no class at all — assert the
      attribution, not just the absence of a conflict)
- [ ] GHK-Cu product + pure vitamin C same day → `caution` conflict
- [ ] Niacinamide + pure vitamin C → no conflict, via `ConflictEngine` (the
      consolidated path) and not merely via `pairRules`
- [ ] An Argireline product attributes to `peptide_neuro`; an unknown
      `…peptide…` INCI token attributes to `peptide_signal`
- [ ] A peptide serum declares no `stacking` and cannot consume a cap
- [ ] `rulesetIntegrity` asserts `stacking` declared iff `irritancy >= 3`
      (so `vitamin_c_pure` now declares it; `azelaic_acid` at 2 must not)
- [ ] `rinseOff` is true for `cleanser` and `makeup_remover`, false for the
      other 16 product types — including `peeling` and `mask`
- [ ] `isStrongActive` is true at irritancy 3–5 and false at 0–2, and a
      `retinoid` at potency `low` (irritancy 3) is strong while a
      `vitamin_c_derivative` (1) is not
- [ ] A retinol (potency `low`) product reports irritancy 3; a tretinoin
      (potency `rx`) product reports irritancy 4
- [ ] `INGREDIENT_CONFLICT_RULES` no longer exists; `grep` finds no second matrix
- [ ] `npx tsc --noEmit` clean; the 284 existing engine tests still pass or
      their changed expectations are justified in the progress log
