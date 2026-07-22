# Phase 9 — Tests (Updated Quality Contract)

Depends on: all previous phases. All V2 suites remain green; add the following.

> **Reconciled 2026-07-17.** Corrected for the real baseline, the real test
> layering rules, and one false claim about an existing test. See
> `DISCREPANCY-REPORT.md` §1 (#11).

## Baseline (measured 2026-07-17, `engine-improvements`)

`npx jest src/utils/routineEngine` → **18 suites, 284 tests, all passing.**
This is the floor: V2.1 does not reduce it. Where a V2.1 change legitimately
alters an existing expectation (e.g. the Phase 1 irritancy recalibration moves
`bha` 2→3), the change must be justified in
`progress/routine-engine-v2-cosmetologist.md` — an unexplained deviation is an
automatic BLOCKER under `architecture-review.md` §6.

## Ownership and location (`.claude/rules/testing.md`)

The original phase did not assign layers. Per project rules:

| Suite | Layer | Location | Owner |
|---|---|---|---|
| 1–8 below | Business-logic unit | `src/utils/routineEngine/*.test.ts` | engineer |
| Reserve-card reasons, override flow, goal selector, 6-card confirm, vitamin C prompt, cycle mode switch | Component/integration | `tests/routine-engine/*.test.tsx` | qa-lead |

Per protocol, **qa-lead writes the component/integration suites before the
engineer writes code**. Fixture factories in `tests/routine-engine/fixtures.ts`
must be annotated with real prop types so prop drift fails `tsc`.

## Required suites

1. **Minimalism** — shelf of 10, goal `maintenance` → ≤ 4 steps per period,
   treatment slot empty.
2. **Goal-driven** — same shelf, goal `acne` → the PM treatment comes from
   `actives.json` `goals.acne`; no product outside the ranking enters as a
   treatment. (Structural slots are exempt — a cleanser is not in any goal map
   and must still be admitted.)
3. **Period safety (property test)** — no generated plan, for any input,
   contains a retinoid in AM. Randomized shelves, **fixed seed**, no
   `Math.random` (principle #4). Must exercise Path A relocation and the PM→AM
   retry (`resolve.ts:580`), not just direct admission.
4. **SPF mandate** — any plan containing a photosensitizing active always has
   an SPF step or placeholder in AM, at every phototype and every season.
5. **Deduplication** — N products of the same function → exactly 1 in the
   routine, including across differing `productType` (Phase 4.2).
6. **Adaptation regression** — never-applied → Phase 1; 30-day break → reset;
   16-day break → −1; adapted beats new.
7. **Explainability invariant** — `|shelf| = |routine| + |frozen| + |reserve|`,
   every non-routine product carrying exactly one `reasonCode`.
   (The original phase omitted `frozen`, which already exists and is a distinct
   bucket from `reserve` — the invariant fails as originally written.)
8. **Determinism** — 100 runs → byte-identical plans, with pinned `seasonMask`
   and injected `now`.

   The original phase called this "the existing property test". It is not:
   `entryPoints.test.ts:140` runs the input **twice**. Extend it to a real
   property test rather than assuming one is there.

## Merge criteria

- All suites above green; the 284-test baseline still green.
- `npx tsc --noEmit` — zero errors across `src/` **and** `tests/`.
- No `Math.random` and no unsorted object iteration anywhere in the engine.
  Enforce as a **test** in `rulesetIntegrity.test.ts` (which already guards
  ruleset invariants), not a CI grep — the project has no lint-rule infra for
  this, and a grep in CI is invisible to the engineer running `npm test`.
- Injected dates only — no real timers in logic that depends on "now"
  (`.claude/rules/testing.md`).
- Both gates from `.claude/rules/testing.md` pass before tech-lead handoff:
  ```bash
  npx tsc --noEmit
  npm test
  ```
