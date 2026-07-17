# Phase 5 — Adaptation (Micro-Dosing): Usage Anchor + Phase Regression

Depends on: Phase 1.

> **Reconciled 2026-07-17.** The premise is **accurate**. One important
> addition: this phase deliberately **reverses a decision documented in a code
> comment**, which under `architecture-review.md` §6 is an automatic BLOCKER
> unless logged. See `DISCREPANCY-REPORT.md` §6.

## Actual state

- `virtualApplicationCount(product.addedAt, now)` (`adaptation.ts:37`) derives
  the phase counter from shelf-add date — exactly as the premise states.
- `applicationCountFor` (`adaptation.ts:47`) uses tracked stats **only in
  dynamic mode**; fixed mode always falls back to the virtual count, even when
  stats exist.
- `ProductApplicationStats` = `{ productId, count, lastAppliedDate }`. There is
  no `firstAppliedDate`. `lastAppliedDate` — which break detection needs —
  already exists.
- `AdaptationStatus.phaseIndex` is `0 | 1 | 2` (0 = "Phase 1"). Prose below
  says Phase 1/2/3; code means 0/1/2.
- Break behavior is undefined: after 3 weeks without a retinoid the virtual
  counter has kept climbing and the engine continues at Phase 3.

### The documented decision this phase reverses

`adaptation.ts:31-35` currently states, as deliberate design:

> *"A product owned long before tracking shipped lands directly in phase 3 (no
> retroactive throttling)."*

The usage-anchor intent requires the opposite: never-applied → Phase 1. This is
an intentional reversal, not a bug fix. The implementer **must** update that
JSDoc and record the reversal in
`progress/routine-engine-v2-cosmetologist.md`, or the tech-lead review blocks.

## Problem

Shelf-add date ≠ first-application date — users backfill their bathroom shelf,
and a product added two months ago and never opened is treated as fully
adapted. Post-break behavior is undefined, so the engine hands a user who
stopped retinoid for a month their full Phase 3 frequency on night one.

## Tasks

### 5.1 Usage anchor

Add `firstAppliedDate: string | null` to `ProductApplicationStats`, populated
by the product's first check-in.

The virtual fallback counts from **`firstScheduledDate`** — the product's first
appearance in a generated plan — not from `addedAt`. This requires persisting
first-scheduled dates, which nothing does today: `generatePlan` is pure and
**never writes** (`generate.ts:39`). Do not break that. The write belongs to
the plan-save path in `src/domain/routinePlanActions.ts`, and the resulting map
is threaded back in through `TrackingInput`:

```ts
export interface TrackingInput {
  cycleType: RoutineCycleType;
  applicationStats: ProductApplicationStats[];
  firstScheduledDates: Record<string, string>;  // productId → skincare date
}
```

A product never scheduled and never applied has no anchor → **Phase 1**.

### 5.2 Phase regression after a break

For products with `irritancy >= 3` (Phase 1's potency-aware value):

- break > 14 days since last application → phase −1 (floor: Phase 1);
- break > 28 days → reset to Phase 1.

Break measured via `lastAppliedDate`; without check-ins, via the last scheduled
day marked in the plan. Regression is computed, never persisted — it must stay
derivable from `(stats, now)` so the engine remains pure and the determinism
test holds with an injected `now`.

### 5.3 Tolerability score

`tolerability = phaseIndex / 2` → 0 / 0.5 / 1.0.

(The original phase said `phase / 3` → 0.33/0.66/1.0, written for 1-based
phases. `phaseIndex` is 0-based `0|1|2`, so `/2` gives the intended
"adapted product outranks a new one of the same class" ordering with the same
shape. Feeds Phase 4.3's `tolerability*100` term.)

### 5.4 Fixed-mode stats

`applicationCountFor` must consult tracked stats in **both** modes — a fixed-mode
user who checks in has real data, and ignoring it is what makes the usage
anchor invisible to them. Virtual count remains the fallback when no stats
exist for the product.

### 5.5 Phase limits unchanged

P1 (1–4 applications) — max 2 days/week, 72 h rest; P2 (5–8) — max 4 days/week;
P3 (9+) — standard engine limits. These already live in
`actives.json` `adaptation.phases`; no ruleset change.

## Files

- `src/types/index.ts` — `ProductApplicationStats.firstAppliedDate`
- `src/utils/routineEngine/adaptation.ts` — anchor, regression, tolerability;
  **JSDoc reversal note**
- `src/utils/routineEngine/generate.ts` — `TrackingInput.firstScheduledDates`
- `src/domain/routinePlanActions.ts` — record first-scheduled dates on save
- `src/store/routinesStore.ts` (or trackingStore) — persistence
- `progress/routine-engine-v2-cosmetologist.md` — log the reversal

## Acceptance

- [ ] Product added 2 months ago, never applied, never scheduled → Phase 1
      (`phaseIndex: 0`), not Phase 3 — this reverses the shipped documented
      behavior
- [ ] Retinoid: 10 applications, then a 30-day break → Phase 1
- [ ] Retinoid: 10 applications, then a 16-day break → phase −1, not reset
- [ ] Adapted retinoid (`phaseIndex: 2`) vs new retinoid of the same potency →
      the adapted one is selected
- [ ] Fixed-mode user with check-ins → stats drive the count, not `addedAt`
- [ ] `generatePlan` still performs no writes; determinism test still passes
      with injected `now`
- [ ] `adaptation.ts` JSDoc no longer claims "no retroactive throttling"
- [ ] `npx tsc --noEmit` clean
