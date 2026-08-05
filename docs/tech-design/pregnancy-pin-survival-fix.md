# Technical Design: Pregnancy freeze pin-survival fix
Spec: docs/specs/pregnancy-pin-survival-fix.md
Author: tech-designer
Date: 2026-07-30

## 1. Architecture Overview

`buildStepsFromPlan` (`planApply.ts`) infers "does this freeze override a saved pin" from
`FrozenItem.until`'s mere presence — correct only by coincidence, since every freeze source that existed
until now was day-windowed exactly when it was also safety-critical. The pregnancy freeze (persistent, no
expiry) breaks that coincidence. Investigation confirmed pair-rule/cumulative-cap freezes are *also*
`until`-less, but their pin-survival is intentional, already-tested behavior ("pins beat preferences") —
so the fix cannot drop the `until` check in favor of blanket "any frozen item overrides"; it must replace
the implicit, shape-based proxy with an explicit, source-based signal. `FrozenItem` gains a required
`overridesPin: boolean`, set at each of the two places `FrozenItem`s are constructed today
(`generate.ts`'s gate-rejection mapping; `resolve.ts`'s pair-rule/cap/relocation outcomes), classified by
a new shared `isSafetyFreezeGate` helper that also de-duplicates an identical check `validate.ts` already
has inline. `planApply.ts` reads `overridesPin` instead of `until`.

```
eligibility.ts EligibilityRejection.gate ──┬─ clinical_freeze / pregnancy_freeze ─┐
                                            └─ pao_expired / no_allowed_period    │
                                                                                  ▼
                                                                    isSafetyFreezeGate(gate)
                                                                        │              │
generate.ts gateFrozen: FrozenItem.overridesPin = isSafetyFreezeGate(r.gate)   validate.ts finding severity
resolve.ts (pair-rule / cap / relocation): FrozenItem.overridesPin = false (explicit, unchanged behavior)
                                                                                  │
                                                                                  ▼
                                            planApply.ts: clinicallyFrozen = frozen.filter(f => f.overridesPin)
```

## 2. API Contracts

N/A — fully local, no network/backend surface (per CLAUDE.md local-only constraint).

## 3. Implementation Tasks

### engineer (scope=frontend/utils — this app has no backend layer)

- FE-1: `src/utils/routineEngine/planTypes.ts` — add required `overridesPin: boolean` to `FrozenItem`.
  Replace the `until` doc comment's implication that `until` signals pin-override with the corrected model:
  `overridesPin` is the sole authority; `until` only says a freeze happens to be day-windowed, an unrelated
  fact (that conflation is exactly what caused this gap).
- FE-2: `src/utils/routineEngine/eligibility.ts` — add and export
  `isSafetyFreezeGate(gate: EligibilityGate): boolean`, returning `true` for `'clinical_freeze'` and
  `'pregnancy_freeze'`, `false` for `'hidden' | 'pao_expired' | 'no_allowed_period'`. Pure; no change to
  `applyEligibilityGates` itself.
- FE-3: `src/utils/routineEngine/generate.ts` — in the `gateFrozen` mapping (~line 203), add
  `overridesPin: isSafetyFreezeGate(r.gate)`, importing FE-2's helper.
- FE-4: `src/utils/routineEngine/resolve.ts` — add `overridesPin: false` at the two existing `FrozenItem`
  construction sites: `walkResolutionLadder`'s pair-rule/cap `frozen` outcome (~line 460) and
  `retryRelocatedInAm`'s `relocation_rejected` fallback (~line 664). Behavior-preserving — makes the
  already-tested "pins beat preferences" outcome explicit instead of implicit-via-`until`-absence.
- FE-5: `src/utils/routineEngine/planApply.ts` — in `buildStepsFromPlan`, change `clinicallyFrozen` from
  `frozen.filter((f) => f.until)` to `frozen.filter((f) => f.overridesPin)`. Update the adjacent inline
  comment and the module-level doc comment (both currently say "clinical freezes carry an expiry date;
  only they override a pin") to describe the corrected, source-based model.
- FE-6: `src/utils/routineEngine/validate.ts` — replace line ~181's inline
  `rejection.gate === 'clinical_freeze' || rejection.gate === 'pregnancy_freeze'` with
  `isSafetyFreezeGate(rejection.gate)` (FE-2's helper, imported from `eligibility.ts`, already imported in
  this file for `applyEligibilityGates`). Behavior-preserving — identical boolean expression, now shared
  instead of independently duplicated a second time.

### engineer (unit tests, both scopes)

- `src/utils/routineEngine/planApply.test.ts` — add `overridesPin` to the two existing hand-built
  `FrozenItem` literals (`true` for the existing clinical-freeze case, `false` for the existing pair-rule
  case; both keep their current expected outcome). Add three new cases: (a) the regression itself — a
  `pregnancy_blocked`-shaped entry (`overridesPin: true`, no `until`, no `ruleId`) drops the pin; (b) an
  entry with both `until` and `overridesPin: true` still drops the pin (locks in no regression on the
  existing clinical path); (c) an entry with `overridesPin: false` that *does* carry an `until` still
  preserves the pin (proves `overridesPin`, not `until`, is now the sole authority — directly encodes
  spec §4 Story 3 AC2).
- `src/utils/routineEngine/eligibility.test.ts` — new `describe('isSafetyFreezeGate')` block: `true` for
  `'clinical_freeze'`/`'pregnancy_freeze'`, `false` for `'hidden'`/`'pao_expired'`/`'no_allowed_period'`.
- `src/utils/routineEngine/entryPoints.test.ts` — update the one pre-existing exact-literal assertion,
  `'turns clinical-freeze gate rejections into frozen rows with expiry'` (~line 101-103), to include
  `overridesPin: true`. Verified by direct search to be the *only* pre-existing test in the repo using a
  plain (non-`objectContaining`) `.toEqual` against a `FrozenItem` — every other `.frozen` assertion in
  `resolve.test.ts`, `clinical-freeze.test.ts`, `custom-procedure.test.ts`, and
  `tests/pregnancy-safety-handling/` already uses `objectContaining`/`arrayContaining`/length/id-only checks
  and needs no change.

qa-lead derives its own integration test scope from spec §4's Given/When/Then directly (per
tech-design-template.md) — not enumerated here. Story 1's AC1 is written to be directly executable against
the real `generatePlan` → `applyRoutinePlan` path, mirroring the existing end-to-end style already used in
`tests/routine-engine/draft-preview.test.ts`'s "pinned, pair-frozen product" test and
`tests/pregnancy-safety-handling/pregnancy-freeze-enabled.test.ts`'s flag-mocking convention.

## 4. Assumptions

- `overridesPin` is a new, purpose-built, required field — not derived from `until`, from `ruleId`'s
  presence/absence, or from an existing severity/reasonCode table.
  Alternative: (a) drop the `until` check and treat `frozen` membership alone as pin-overriding; (b) derive
  it from `ruleId`'s absence (today, every gate-sourced `FrozenItem` lacks one and every resolve.ts-sourced
  one has one); (c) derive it from `validate.ts`'s existing severity mapping.
  Reason: (a) is disproven by the existing, passing `planApply.test.ts` pair-rule test — pins must keep
  surviving pair-rule freezes. (b) holds for every source that exists today (verified directly:
  `EligibilityRejection` has no `ruleId` field at all; every `resolve.ts` outcome, including
  `cumulative_active_cap`, always sets one) but is an accidental correlation, not a declared contract — a
  future freeze source could easily violate it, silently reintroducing an equivalent shape-inference bug.
  (c) conflates a UI-tone value with a pin-override decision that currently happen to coincide; a future
  change to severity display could then silently change pin behavior as a side effect. Only a dedicated,
  required field is both correct today and resistant to silently breaking again for a future 5th source —
  directly answering the review's instruction that the fix "needs to be correct for every freeze source
  that can lack `until`," not just the two known today.
- `overridesPin` is required, not optional-with-a-default.
  Alternative: optional field defaulting to `false`/pin-survives when absent; only the two safety-tier
  gate-sourced construction sites would set it.
  Reason: the full blast radius was verified directly (every `FrozenItem`-typed construction in the repo
  grepped, not assumed) — exactly 2 production call sites beyond `planApply.ts` itself
  (`generate.ts`, `resolve.ts`'s 2 sub-sites) and 2 pre-existing test literals. Required costs two extra
  one-line additions in `resolve.ts` and forces `tsc --noEmit` to catch a forgotten declaration at any
  future construction site instead of silently defaulting — a materially stronger guarantee for a
  safety-relevant discriminant, at a proven-negligible cost given how small the blast radius actually is.
- `isSafetyFreezeGate` is centralized in `eligibility.ts` and reused by both `generate.ts` (new) and
  `validate.ts` (refactored from its pre-existing inline check).
  Alternative: leave `validate.ts` untouched; write a third, independent copy of the same boolean
  expression in `generate.ts`.
  Reason: `validate.ts`'s inline check is the direct precedent for exactly this classification;
  reimplementing it a third time (a structurally-different-but-equivalent version already exists implicitly
  in which context fields feed `dailyView.ts`'s `findFrozenByAnySource`) is precisely the kind of drift risk
  this fix exists to close. The refactor is behavior-preserving (identical boolean expression).
- `pao_expired` and `no_allowed_period` keep `overridesPin: false` (pins survive them, unchanged).
  Alternative: treat all four non-hidden eligibility gates as pin-overriding, on the theory that all are
  "hard" structural exclusions.
  Reason: `dailyView.ts`'s Today-screen freeze rendering — the one other place in the codebase implementing
  this exact "safety beats preference" concept — only ever unions `procedureRules` + `pregnancyRules`, never
  PAO expiry or no-allowed-period. Matching that existing, established bucket keeps the two "is this freeze
  safety-tier" answers (Today screen vs. Draft→Save) consistent with each other; widening it here would be
  an independently-decidable behavior change with no request behind it (spec §3 non-goal).

## 5. Open Questions

No open engineering questions. The fix's shape, the verification that pair-rule freezes are genuinely
`until`-less (confirmed: `resolve.ts`'s `walkResolutionLadder` never sets `until` on any outcome it
produces), and the precise test blast radius were all resolved by direct code reading during this design
pass, not left as assumptions to verify at implementation time.
