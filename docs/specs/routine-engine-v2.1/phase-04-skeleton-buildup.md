# Phase 4 — Skeleton Build-Up Instead of Greedy Admission (Core Change)

Depends on: Phases 1, 2, 3.

> **Reconciled 2026-07-17.** The premise is **accurate** — this is the one
> phase whose problem statement survives the audit intact. Two corrections
> only: task 4.3's "remove recency" is already done, and same-slot competition
> machinery already exists and must be built on, not replaced. See
> `DISCREPANCY-REPORT.md` §1 (#10).

## Actual state

- `resolve.ts` `runPeriodPass` is genuinely greedy: candidates are sorted by
  `scoreCandidate` and every one that clears pair rules, stacking caps, and
  frequency caps is admitted. Two hyaluronic serums both pass. The routine
  bloats because it can.
- **Same-slot competition is already partially solved.** The
  `routine-similar-product-priority` feature added `SlotAlternative` and a
  same-slot cap: once a layering slot is occupied, a later same-slot candidate
  is recorded as an alternative rather than admitted twice
  (`resolve.ts` after the ladder; `duplicateSlot.ts`). It is keyed on
  `slotIndex`, not on function — two hyaluronic serums of *different*
  `productType` (serum + cream) still both enter.
- Score already has no recency term (report §1 #10).

## Problem

Admission asks "does this product violate anything?" when it should ask "does
this product serve the goal?". Absence of a violation is not a reason to
include. The routine must be *built* from a skeleton, not *filtered* down from
the shelf.

## Tasks

### 4.1 Replace greedy admission with skeleton build-up

```
Skeleton (order = build order):
  AM: [cleanser] → [treatment?] → [moisturizer] → [SPF*]
  PM: [pre_cleanse?] → [cleanser] → [treatment?] → [moisturizer]

  * SPF per Phase 2 rules.
  cleanser/moisturizer: no product → cleanser slot is dropped; the moisturizer
    slot renders a placeholder recommendation when the routine contains
    actives. A missing product is NOT an error.
  pre_cleanse (PM-only, added by 2026-07-19 ruling): micellar water and
    cleansing oils/balms (productType `makeup_remover`). A surfactant-based
    makeup/SPF remover is NOT a standalone cleanse — it fills its own slot
    ordered before `cleanser`, never satisfies the cleanse slot, and defaults
    to PM. If a pre_cleanse product is scheduled with no gentle cleanser on the
    shelf, the PM cleanse slot renders a placeholder with reason
    `pre_cleanse_requires_followup`. The AM skeleton has no pre_cleanse slot.
```

Fill algorithm:

1. **Structural slots** (cleanser, moisturizer, SPF) — one product each.
   Tie-break among candidates: goal match → tolerability (Phase 5) → stable
   tiebreak (`addedAt` desc, then `id`) — reuse `compareCandidates`.
2. **Treatment slot** — **0 or 1** per period, chosen by
   `treatmentClassRanking` from Step 0. Goal `maintenance` → slot stays empty
   even with 5 serums on the shelf.
3. **Optional second treatment** for `secondaryGoal` — only if it does not
   conflict with the first, total strong-active count stays within caps, and
   its class differs functionally from the first.
4. **Nothing else enters.** Every excluded product gets a DecisionLog entry:
   `not_needed_for_goals` / `duplicate_function` / `conflicts_with_selected` /
   `frozen_irritation` (lower_snake_case, per the codebase's existing 22 codes).

Structural slots map onto existing `LAYERING_ORDER` positions
(`slotting.ts`): cleanser = 1, treatment = the serum/gel band (6), moisturizer
= 11, spf = 13. Do **not** introduce a parallel slot taxonomy — extend
`slotting.ts` with a `SKELETON_SLOTS` view over `LAYERING_ORDER`.

### 4.2 Cumulative active exposure (directive of 2026-07-17, report §7)

An active class is a property of a **product**, not of a **slot**. This governs
4.2a–4.2c below and **supersedes per-class `stacking`**: delete the `stacking`
blocks from `actives.json`, replace `findCapViolations` with the cumulative
check, and restate the Phase 1 invariant as *"subject to the cumulative cap iff
`irritancy >= 3`"* in `rulesetIntegrity.test.ts` (report §7 assumption 8.1).

**a. Cumulative period cap.** At most **one leave-on product carrying any strong
class (`irritancy >= 3`)** per period, counted across *all* slots — treatment,
toner, moisturizer alike. Losers → reserve with `cumulative_active_cap`.

Mild classes (`irritancy <= 2`) carry **no** cumulative restriction: any number,
any slot. Class-dedup (4.3) applies **only** to treatment-candidate selection —
a peptide cream in the moisturizer slot alongside a peptide serum treatment is
valid and desirable, and must not be deduped.

**b. Format reclassification.** Any leave-on product carrying a strong class is
a **treatment candidate regardless of format** — an acid toner and an acid cream
are treatments. It inherits treatment frequency caps and can **never** inherit a
structural slot's daily frequency. The vacated structural slot then takes a
neutral alternative from the shelf, or renders a placeholder recommendation
("add a neutral moisturizer") if none exists.

"Treatment frequency caps" resolves per-class, not as a new table: exfoliants
take the exfoliant cap (≤ 2 days/week, 48 h rest), retinoids keep their existing
`actives.json` `adaptation` phase caps. The enforced invariant is the narrow one
— a reclassified product never runs daily (report §7 assumption 8.3).

**c. Rinse-off exemption.** `facts.rinseOff` products (Phase 1 §1.5 —
`cleanser`, `makeup_remover`) carrying strong classes do **not** consume the
cap. Emit an info-level DecisionLog note instead ("your cleanser also contains
BHA"). `DecisionAction` has no info level today — add one rather than
overloading `keep_with_note`, which carries conflict semantics.

> **Note — AHA + PHA becomes legal.** PHA is mild (irritancy 1), so it leaves
> `aha.sharedCapWith` behind and an AHA serum + PHA toner in one PM is now
> permitted where the shipped shared cap blocks it. Required by the mild/strong
> split; flagged in report §7 assumption 8.2.

### 4.3 Functional deduplication

One product per **functional role**. Role = skeleton slot **or** active class.
A second hyaluronic serum → `duplicate_function`, excluded, marked "in reserve"
on the shelf.

Scope limit from 4.2: class-based dedup applies **only** when selecting
treatment candidates. Slot-based dedup (one product per structural slot) still
applies everywhere.

Build this on the existing same-slot cap rather than beside it: generalize its
key from `slotIndex` to a resolved `functionalRole`, keep `SlotAlternative`
emission (the one-tap swap UX depends on it), and keep the `other` productType
exemption. The `duplicateSlot.test.ts` suite (7 KB) must keep passing or its
changed expectations must be justified in the progress log.

### 4.4 Candidate scoring

`Goal Match → Tolerability (Phase 5) → Potency → stable tiebreak (addedAt, id)`.

Concretely, extend `scoreCandidate`: the current
`boost*1000 + concernHits*100 + potency*10` becomes
`boost*10000 + goalRank*1000 + tolerability*100 + potency*10`, where `goalRank`
derives from `treatmentClassRanking` position. **Recency needs no removal** —
it was never a score term; `addedAt` already lives only in the tiebreak, which
is the phase's stated end state (report §1 #10).

Scoring decides *which* strong carrier wins the single cumulative slot (4.2a),
so it must run over the reclassified candidate set from 4.2b — an acid cream
competes with an acid serum on score, not on format.

Keep `concernHits` as a lower-weighted term for users who never confirm a goal
(Phase 3 keeps `concerns` populated) — otherwise those users lose all
differentiation.

### 4.5 Resolution Ladder is retained

Paths A/B/C stay, with the Phase 2 guard, applying only to products the
skeleton already selected — never as a mechanism for stuffing the shelf in.

## Files

- `src/utils/routineEngine/resolve.ts` — `runPeriodPass` rewritten around the
  skeleton; `scoreCandidate` extended; `findCapViolations` → cumulative check
- `src/utils/routineEngine/slotting.ts` — `SKELETON_SLOTS` view; strong-class
  leave-on reclassified as treatment (`isTreatment` already keys off
  `irritancy >= 1` — tighten to the cumulative rule's boundary)
- `src/utils/routineEngine/duplicateSlot.ts` — `slotIndex` → `functionalRole`
- `src/constants/rulesets/actives.json` — remove per-class `stacking` blocks
- `src/utils/routineEngine/rulesetIntegrity.test.ts` — restate the invariant
- `src/utils/routineEngine/planTypes.ts` — info-level `DecisionAction`
- `src/utils/routineEngine/generate.ts` — `RoutinePlan` gains
  `reserve: { productId, reasonCode }[]`

**Naming:** the original phase called this `reserveShelf`. Use `reserve` — it
sits on `RoutinePlan` alongside `frozen` and `placeholders`, and `frozen` is
not called `frozenShelf`. Make it **required** (`[]` when empty), unlike the
optional `slotAlternatives`, since Phase 9's explainability invariant depends
on it always being present.

## Acceptance

- [ ] Shelf of 10 (2 hyaluronic serums, retinol, vitamin C, cleanser,
      moisturizer, SPF, 3 misc), goal `maintenance` → AM ≤ 3 steps (cleanser,
      moisturizer, SPF), PM ≤ 2 (cleanser, moisturizer); retinol and vitamin C
      in `reserve` with `not_needed_for_goals`
- [ ] Same shelf, goal `aging` → PM treatment is retinol; vitamin C is either
      AM treatment or reserve — never both strong actives in one PM
- [ ] Two hyaluronic serums of the *same* productType, goal `dehydration` →
      one admitted as the treatment, one `duplicate_function`
- [ ] Two hyaluronic products of *different* productType (serum + cream), goal
      `dehydration` → **both admitted** (serum = treatment, cream = the
      moisturizer structural slot). **Corrected 2026-07-17** (design Assumption
      2): the cumulative-exposure directive makes mild-class dedup apply ONLY
      to treatment-candidate selection, so a mild same-class product filling a
      *structural* slot is not a duplicate. This supersedes the original
      "one admitted, one duplicate_function" item, which predated the directive.
- [ ] Goal `maintenance` + 5 serums → treatment slot empty

### Cumulative active exposure (4.2 — directive test cases)

- [ ] Peptide serum + peptide cream, goal `aging` → **both** in the same PM
      (treatment + moisturizer); no cap interaction, no dedup exclusion
- [ ] AHA serum + AHA toner + AHA cream (cream = the only moisturizer) →
      exactly **one** acid carrier scheduled per PM at exfoliant frequency; the
      other two in reserve with `cumulative_active_cap`; moisturizer slot shows
      the neutral-moisturizer placeholder; **no acid product ever runs daily**
- [ ] BHA cleanser + BHA serum → both allowed in the same PM; the cleanser
      emits an info-level note and consumes nothing; the serum consumes the cap
- [ ] Niacinamide serum + niacinamide toner + niacinamide cream (all mild) →
      all three admitted; no cap, no reserve
- [ ] Retinoid cream as the only moisturizer → reclassified as treatment, keeps
      its adaptation phase cap, never daily; moisturizer placeholder rendered
- [ ] `actives.json` declares no `stacking` blocks; `rulesetIntegrity` asserts
      the cumulative-cap invariant instead
- [ ] Every shelf product is in exactly one of: a period, `frozen`, `reserve`
- [ ] Determinism property test passes on the new algorithm
- [ ] `npx tsc --noEmit` clean
