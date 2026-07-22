# Phase 6 — Dynamic Cycling Adapted to Shelf Composition

Depends on: Phase 4.

> **Reconciled 2026-07-17.** The cycling premise is **accurate**; the
> `seasonMask` premise is **false** — the engine core is already pure and
> already receives the mask as a resolved input. See `DISCREPANCY-REPORT.md`
> §1 (#6). Task 4 shrinks from an architectural fix to a test pin.

## Actual state

- `CYCLE_PHASES` is hardcoded `['exfoliation','retinoid','recovery','recovery']`
  (`cycleState.ts:15`), and `getCyclePhaseForTonight` returns the phase with no
  knowledge of the shelf. Without a retinoid, retinoid night is empty.
- `checkInCycle` already advances `cyclePhaseIndex` modulo 4 and already
  implements pause-on-miss and per-skincare-day idempotency.
- **`seasonMask` is already outside the engine.** `generatePlan` takes it as an
  `EngineInput` field; `seasonMask.ts` is pure and documents that "the fetch
  lives in `src/services/weather/`". `source: 'weather' | 'calendar'` is a
  *provenance field on the mask*, resolved outside the pipeline. The engine
  never fetches and never branches on `source`.

## Problem

The cycle is blind to the shelf: an exfoliant-free or retinoid-free shelf
produces empty nights, and "Complete My Routine" advances a phase that had no
content. The interaction with the manual Weekly Plan is undefined — enabling
dynamic mode silently discards manual `scheduledDays`.

## Tasks

### 6.1 Resolve cycle phases from the shelf

Before rendering the day, resolve the phase against shelf composition:

- exfoliant phase, no exfoliant on shelf → **recovery**;
- retinoid phase, no retinoid on shelf → **recovery**;
- both absent → dynamic mode unavailable; UI suggests staying on fixed
  (`dynamic_unavailable_no_actives`).

`cyclePhaseIndex` **keeps incrementing modulo 4** — only the *content* of the
day is substituted, so returning a product to the shelf seamlessly restores the
full cycle. This composes with the existing `checkInCycle` unchanged.

Resolution is a pure function of `(cycleState, shelfFacts)` and belongs in
`cycleState.ts` as a new `resolveCyclePhase(state, facts): CyclePhase`.
`getCyclePhaseForTonight` stays as the raw accessor — do not overload it, since
`checkInCycle`'s idempotency tests depend on its current semantics.

"On shelf" means **eligible**, not merely present: a PAO-expired or clinically
frozen retinoid must not keep retinoid night alive. Resolve against the post-
gate product set (`applyEligibilityGates`), not the raw catalog.

### 6.2 Mode precedence

`routineCycleType: 'dynamic'` fully overrides manual `scheduledDays` for PM
active steps (as in V2), **but** enabling dynamic no longer erases manual
settings — preserve and restore them on switch back to fixed. Add a mode switch
in routine settings with a one-time confirm dialog describing this.

Storage: manual `scheduledDays` must survive a dynamic round-trip, so they need
a preserved copy rather than in-place overwrite in `routinesStore`.

### 6.3 Pause-on-miss

Unchanged from V2 — already implemented (`cycleState.ts:41-58`). No work.

### 6.4 seasonMask — pin it in the determinism test

No production change. The architecture the original task asks for already
exists (report §1 #6).

What remains: pin `seasonMask` as a fixed input in the determinism property
test, and assert the engine's output is invariant to `mask.source` — same
`season`, different `source` → byte-identical plan. That locks the property the
original task was reaching for.

## Files

- `src/utils/routineEngine/cycleState.ts` — `resolveCyclePhase`
- `src/store/routinesStore.ts` — preserve/restore manual `scheduledDays`
- `src/screens/` + `src/components/routine/` — mode switch + confirm dialog
- `src/utils/routineEngine/cycleState.test.ts`, determinism test — pins

## Acceptance

- [ ] Shelf without a retinoid, dynamic ON → effective cycle is
      exfoliation → recovery → recovery → recovery; no empty nights
- [ ] Shelf with no actives → dynamic unavailable, `dynamic_unavailable_no_actives`
      surfaced in UI
- [ ] Retinoid present but PAO-expired → retinoid night resolves to recovery
- [ ] Removing then re-adding a retinoid → full cycle restored, `cyclePhaseIndex`
      never reset
- [ ] dynamic → fixed → manual `scheduledDays` restored exactly as they were
- [ ] Determinism test passes with a pinned `seasonMask`
- [ ] Same `season`, `source: 'weather'` vs `'calendar'` → identical plan
- [ ] `checkInCycle` idempotency + pause-on-miss suites unchanged and green
- [ ] `npx tsc --noEmit` clean
