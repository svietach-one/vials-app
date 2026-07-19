# Phase 2 — Period Eligibility (Lock It) + Widened SPF Mandate

Depends on: Phase 1.

> **Reconciled 2026-07-17.** Both original premises are false — the Path A
> period guard already exists, and the `planContainsProperty: photosensitizing`
> SPF mechanism already works. See `DISCREPANCY-REPORT.md` §1 (#4, #5) and §5.
> This phase shrinks from "build eligibility + rewrite the mandate" to "lock
> the existing guard with a property test + widen one mandate trigger".

## Actual state

- **`PERIOD_ELIGIBILITY` already exists**, as `allowedPeriods` +
  `preferredPeriod` in `actives.json`, and matches the originally proposed
  table 1:1 (report §5) — including `vitamin_c_pure` being AM-preferred via
  slotting priority, exactly as the original phase described the mechanism.
- **Path A is already guarded.** `resolve.ts:420` gates relocation on
  `periodsForProduct(product.productType, facts).includes(other)`, and
  `facts.allowedPeriods` is the intersection of every attributed class's
  `allowedPeriods` with `product.usageTime` (`productFacts.ts:139`). With
  `retinoid.allowedPeriods = ["pm"]`, a retinoid cannot reach AM.
- **The SPF mandate already keys off photosensitizing actives** — but only
  under phototype 1–2 (`actives.json` `phototypeModifiers`) or summer
  (`seasons.json` `summer_spf_mandate`).

## Problem

A phototype-4 user with a retinoid, in winter, gets **no SPF mandate** — the
trigger is gated behind phototype and season rather than firing on the presence
of a photosensitizing active alone. That is the single real gap.

The retinoid-never-in-AM invariant holds today but is **unprotected**: nothing
in the suite would catch a regression if a future change to `allowedPeriods`
aggregation or the relocation guard broke it.

## Tasks

### 2.1 Widen the SPF mandate trigger

Add one unconditional mandate — SPF in AM whenever the plan contains a
photosensitizing active, independent of phototype and season. The existing
phototype-1–2 and summer rules become redundant *supersets*; keep them (they
carry distinct `reasonCode`s and `nonSkippable` semantics), and let
`applyMandates` merge — `PlaceholderSlot` merging already keeps the strictest
severity.

The rule belongs in `actives.json` as a top-level `mandates` block (it is not a
phototype modifier and not seasonal). This is a **new ruleset section**; extend
`rulesetTypes.ts` and `collectRequireMandates` in `mandates.ts` to read it,
alongside the three sources it already folds.

```
mandates: [{
  id: "spf_photosensitizing",
  if: { planContainsProperty: "photosensitizing" },
  then: { action: "require", targets: { productTypes: ["spf"] }, period: "am" },
  severity: "avoid",
  nonSkippable: false,
  reasonCode: "spf_required_photosensitizing"
}]
```

Reason codes are lower_snake_case to match the 22 codes already in the rulesets
(`summer_photosensitizer_spf`, `phototype_uv_sensitivity_spf`) — **not** the
SCREAMING_CASE of the original draft, which matched nothing in this codebase.

The goal-driven trigger (`pigmentation` → SPF, `spf_required_goal`) lands in
**Phase 3**, where goals exist. The phototype trigger keeps its existing
`phototype_uv_sensitivity_spf` code.

If no SPF product is on the shelf the mandate renders as a `PlaceholderSlot` —
already the implemented behavior — and never blocks generation of the rest of
the routine.

### 2.2 Lock period eligibility with a property test

No production change. Add a seeded property test (Phase 9 suite 3) over
randomized shelves asserting **no generated plan ever places a retinoid, AHA,
or BHA in AM** — the PM-only class families under the 2.3 ruling — through any
cascade: direct admission, Path A relocation, or PM→AM retry (`resolve.ts:580`).

### 2.3 `pm_preferred` — RESOLVED: not implemented (user ruling, 2026-07-17)

The original phase proposed `aha`/`bha` = `pm_preferred`, permitting AM
placement when the AM routine contains SPF. **Dropped.** AHA/BHA stay hard
`["pm"]`; PHA stays `["am","pm"]` as the morning-safe exfoliant path. This
phase carries **no eligibility-table change at all**.

Rationale (binding on future design work):

1. An SPF step in the *plan* is not verifiable sun protection on *skin* — a
   planned step cannot gate a safety exception (do-no-harm).
2. The unconditional invariant "no acid in AM, ever" is property-testable
   without conditional states; `pm_preferred` would trade it for
   plan-dependent eligibility that `allowedPeriods` cannot express.

Consequence for 2.2: the property test asserts the acid invariant alongside
the retinoid one — same test, two PM-only class families.

## Files

- `src/constants/rulesets/actives.json` — new `mandates` block
- `src/constants/rulesets/rulesetTypes.ts` — `mandates` types
- `src/utils/routineEngine/mandates.ts` — fold the new source into
  `collectRequireMandates`
- `src/utils/routineEngine/entryPoints.test.ts` (or a new
  `periodSafety.test.ts`) — the property test

## Acceptance

- [ ] Phototype-4 user, winter, retinol on shelf, no SPF product → AM contains
      an SPF placeholder with `spf_required_photosensitizing` (this is the gap:
      it fails today)
- [ ] Phototype-2 user with a retinoid → still fires, still `nonSkippable`,
      still cites `phototype_uv_sensitivity_spf` (no regression from the widening)
- [ ] Summer + photosensitizer → placeholders merge; strictest severity kept;
      no duplicate AM SPF slot
- [ ] User with no actives and phototype 5 → **no** SPF placeholder
      (recommendation yes, mandate no)
- [ ] Retinoid (PM) conflicting with AHA → resolution is day separation, never
      relocation to AM
- [ ] Property test: over N seeded randomized shelves, zero plans contain a
      retinoid, AHA, or BHA in AM
- [ ] `allowedPeriods` for aha/bha/retinoid unchanged from shipped values
      (the 2.3 ruling: no eligibility-table change in this phase)
- [ ] `npx tsc --noEmit` clean
