# Routine Engine V2.1 — "From Censor to Cosmetologist"

Task slug: routine-engine-v2-cosmetologist
Status: Phase 1 IN PROGRESS (2026-07-17). Package reconciled against the merged
V2 engine; §4.1 resolved and superseded by the cumulative active exposure rule
(report §7); §4.2/§4.3/§4.4 remain open but block only Phases 2, 3, and 7.
Base document: TECHNICAL SPECIFICATION Routine Engine V2/V3 ("Invisible Assistant")

---

## Why this package exists

The V2 spec implements **constraints** (stacking caps, frequency caps, conflict
checks) but does not implement **construction of an optimal routine around the
user's goal**. Greedy admission stuffs the routine with products until it hits
the limits. The required behavior is the opposite: a **minimally sufficient
routine, where a product is included only if it serves the user's goal** — the
way a professional cosmetologist would build it.

## Reconciliation notice (2026-07-17)

This package was originally written against the V2 **design document**, not the
merged V2 **implementation**. An audit against the real codebase found that 4
of 9 phases rested on problems that no longer exist, and that two proposed new
files would have forked data already in `actives.json`.

Every phase file has been rewritten. **Read `DISCREPANCY-REPORT.md` first** —
it lists every premise changed and why, and carries the 4 open questions.
Behavioral intents were not changed; where an intent genuinely conflicts with
shipped code it is flagged `[OPEN]` in place rather than resolved.

Headline corrections:

- The irritancy scale, `PERIOD_ELIGIBILITY`, the Path A period guard, the
  photosensitizing-SPF mechanism, the phototype migration, the vitamin C
  migration, and a pure `seasonMask` **already exist**.
- There is no `PEPT` tag, no `maxActivesPerPeriod`, no `skinIssues` field, no
  `assets/inci_seed.json`, no `InciRepository`, and nothing pregnancy-related.
- `activeRegistry.ts` and `conflictMatrix.ts` are **not** created; their
  content is folded into `src/constants/rulesets/actives.json`, which is
  already the single source of truth.
- Severity stays `avoid`/`caution`; reason codes stay lower_snake_case; class
  keys keep their persisted names (`copper_peptides`, not `peptide_copper`).

## Open questions

1. ~~**§4.1** — pure vitamin C stacking cap.~~ **RESOLVED 2026-07-17:** moves to
   irritancy 3, cap intended; superseded by the cumulative rule (§7).
2. **§4.2** *(blocks Phase 2)* — `pm_preferred` for AHA/BHA *loosens* a shipped
   safety rule (they are PM-only today). Recommend dropping.
3. **§4.3** *(blocks Phase 3)* — Pregnancy/lactation is a new subsystem, not a
   flag. Recommend splitting into its own feature.
4. **§4.4** *(blocks Phase 7)* — The closed `DecisionReasonCode` enum must
   absorb 22 existing JSON codes and a runtime-synthesized `stacking_cap_*`
   family, and `reasonCode` currently doubles as `ruleId` (pair-rule IDs leak
   into it). Confirm approach.

## Cumulative active exposure rule

A user directive of 2026-07-17 amends Phases 1 and 4: an active class is a
property of a **product**, not a **slot**. Mild classes (`irritancy <= 2`) carry
no cumulative restriction; strong classes (`irritancy >= 3`) are capped at one
leave-on product per period across *all* slots, are reclassified as treatment
candidates in any format, and are exempt when rinse-off. Full text and four
documented assumptions in `DISCREPANCY-REPORT.md` §7.

## Package contents

| File | Phase | Depends on | Reconciliation |
|---|---|---|---|
| `DISCREPANCY-REPORT.md` | Read first | — | audit + open questions |
| `00-shared-principles.md` | Read before every phase | — | unchanged |
| `phase-01-active-registry.md` | Irritancy recalibration, peptide subclasses, matrix consolidation | — | premises rewritten |
| `phase-02-period-eligibility-spf.md` | Lock period eligibility + widen SPF mandate | 1 | **greatly reduced** — guard exists |
| `phase-03-goal-model.md` | Goal Model (Step 0) | 1 | retargeted to `concerns`; pregnancy deferred |
| `phase-04-skeleton-buildup.md` | Skeleton build-up instead of greedy admission (core) | 1, 2, 3 | **premise accurate** |
| `phase-05-adaptation.md` | Micro-dosing: usage anchor + phase regression | 1 | premise accurate; reverses a documented decision |
| `phase-06-dynamic-cycling.md` | Dynamic cycling from shelf composition | 4 | cycling real; seasonMask task reduced to a test pin |
| `phase-07-explainability.md` | DecisionLog → UX + override flow | 4 | enum is harder than drafted |
| `phase-08-migrations.md` | Confirmation prompts, peptide re-attribution, goals | 1, 3 | **mostly already shipped** |
| `phase-09-tests.md` | Updated quality contract | all | layered per `.claude/rules/testing.md` |

Phase 8 now depends on 1 **and 3** (it executes the goal migration).

## Baseline

`npx jest src/utils/routineEngine` → 18 suites, 284 tests, green
(2026-07-17, `engine-improvements`). V2.1 does not reduce this.

## How to run this with Claude Code

One phase = one session. Into each session prompt, paste:

1. `00-shared-principles.md` (always),
2. `DISCREPANCY-REPORT.md` (always — it is what keeps a session from
   "re-fixing" a problem that does not exist),
3. the phase file for the current phase (entire file),
4. for phases 4–7: the output of `npx tsc --noEmit` after the previous phase.

Phase order is mandatory: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. Phases 1–2 are
data/reference, 3–4 are the engine core, 5–7 are modes and UX, 8–9 are
migrations and tests.

Per `.claude/rules/agent-layer-protocol.md`, each phase runs
planner → qa-lead → engineer → tech-lead, coordinated through
`progress/routine-engine-v2-cosmetologist.md` and
`progress/routine-engine-v2-cosmetologist-handoff.json`.

## Open item before starting

`goals` (Phase 3, formerly `GOAL_TREATMENT_MAP`) is a draft based on common
dermatological practice. Per PRD §6 it should be reviewed by the same clinical
consultant who signs off the procedure-spacing table. It is data, not code —
the structure can be implemented now; values can change later without
refactoring.
