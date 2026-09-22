# Technical Design: Conflict Resolution Scope (Slot vs Day)
Spec: docs/specs/conflict-resolution-scope.md
Author: planner-agent
Date: 2026-09-21

## AI-SDLC Flags
```
backend_layer:  false
frontend_layer: true
infra_changes:  false
```

## 1. Architecture Overview

`ACTIVES_RULESET.pairRules` (`actives.json`) is read by two independent consumers today: `ConflictEngine`
(`conflictEngine.ts`, display warnings via `ConflictWarningInline`) and the routine auto-generation engine
(`routineEngine/resolve.ts`). The display path currently applies neither of `PairRule`'s two existing
scope-like signals — `scope: 'same_period'|'same_day'|'anywhere'` (read only by `resolve.ts`'s
`findPairViolations`, and only as an `anywhere`-vs-not binary; `same_period`/`same_day` are functionally
identical there today) and `resolutions` (whose `'separate_periods'` entry is the *scheduler's* real, already
period-aware relocation signal). This task adds a third, new field — `resolutionScope: 'slot' | 'day'` —
read **only** by the display path. The scheduler is not touched; its own `resolutions`-driven behavior is
unchanged.

```
PairRule.resolutionScope (new) -> ConflictEngine.detectConflicts() [display only]
PairRule.scope, PairRule.resolutions -> routineEngine/resolve.ts   [scheduler, unchanged by this task]
```

`RoutineStep` carries no period field — period belongs to the containing `Routine.timeOfDay`. Both call
sites already hold AM/PM steps as separate arrays before merging them for `detectConflicts`, so the engine
change is a signature change (accept per-step period), not a new data source.

## 2. API Contracts

N/A — local-only Expo/RN app (AsyncStorage + Zustand), no backend/API layer in Phase 1 (`CLAUDE.md`).

## 3. Implementation Tasks

### engineer (scope=frontend)
- FE-1: Add `type ResolutionScope = 'slot' | 'day'` and a required `resolutionScope: ResolutionScope` field
  to the `PairRule` interface — a new field name, not a rename/reuse of the existing `scope` field on the
  same interface (Assumption 1). Files: `src/constants/rulesets/rulesetTypes.ts`.
- FE-2: Set `resolutionScope: 'day'` explicitly on all 7 live entries in `pairRules` and all 4 entries in
  `PROPOSED_V12_PAIR_RULES` — the value that reproduces today's unconditional day-level warning for every
  pair (zero behavior change). Files: `src/constants/rulesets/actives.json`,
  `src/constants/rulesets/proposedPairRules.ts`.
- FE-3: `ConflictEngine.detectConflicts` accepts per-step period alongside each `RoutineStep` (e.g. paired
  with `Period` from `rulesetTypes.ts`) instead of a flat `RoutineStep[]`. Matching a rule now branches on
  `resolutionScope`: `'day'` → warn whenever both steps share a day, in any period (today's unchanged
  behavior); `'slot'` → warn only when both steps additionally share the same period. Files:
  `src/utils/conflictEngine.ts`.
- FE-4: Update both call sites to pass period-tagged steps instead of a pre-merged flat array, preserving
  the existing "conflicts are never tab-scoped" behavior (both periods are still always checked together —
  only whether a given pair fires changes). Files: `src/screens/RoutinesScreen.tsx`,
  `src/components/routine/ConflictWarningInline.tsx`.
- FE-5: When a `'slot'`-scoped rule fires with both steps in the same period, override the rendered
  suggestion with a generic, code-level template naming the *other* period ("...try moving one to your
  morning/evening routine"), parameterized by period only, not stored per-rule in the ruleset (Assumption
  4). `'day'`-scoped rules (every pair today) keep their existing per-rule `explanation`/`suggestion`
  unchanged. Files: `src/components/routine/ConflictWarningInline.tsx`.

### engineer (unit tests, scope=frontend)
- FE-6: `conflictEngine.test.ts` — regression lock: all 7 live pairs still warn identically regardless of
  AM/PM split (every pair defaults to `'day'`). New cases using a test-local fixture `PairRule` (not a live
  one — none are `'slot'` yet) proving same-period warns and split-period does not, for a `'slot'`-scoped
  rule.
- FE-7: Extend `rulesetIntegrity.test.ts` (or a co-located equivalent covering `proposedPairRules.ts`) to
  assert every `pairRules` entry, live and proposed, declares a `resolutionScope` — an entry missing it
  fails the suite, not a silent default.

## 4. Assumptions

- New field is named `resolutionScope` (not `scope`), to avoid colliding with the existing, differently-typed
  `PairRule.scope: 'same_period'|'same_day'|'anywhere'` field on the same interface. Also named
  `ResolutionScope` despite being one word away from the existing, unrelated `ResolutionStrategy` type (the
  `resolutions` ladder) — flagging the proximity here as a deliberate choice, not an oversight.
  Alternative: reuse or rename the existing `scope` field for this purpose instead.
  Reason: product decision made during planning — keep the source research's `slot`/`day` vocabulary as-is,
  not reconciled with existing ruleset terms.
- `resolutionScope` feeds only `ConflictEngine.detectConflicts` (display). `routineEngine/resolve.ts` is
  untouched; its own period-splittability signal (`resolutions`'s `'separate_periods'` entry) stays exactly
  as-is and unrelated to this field.
  Alternative: also wire `resolutionScope` into `resolve.ts` so one signal drives both engines.
  Reason: product decision made during planning — ship the lowest-blast-radius, zero-behavior-change option;
  unifying the two engines' period concepts is a candidate follow-up, not this task.
- `resolutionScope` is required (not optional), explicitly set to `'day'` on all 11 current entries, rather
  than an optional field defaulting to `'day'` when absent.
  Alternative: optional field, implicit fallback (`rule.resolutionScope ?? 'day'`) in the engine.
  Reason: mirrors the source research's own phrasing ("default existing entries to day... then flip the
  approved pairs"); lets FE-7's integrity check assert 100% coverage instead of trusting an implicit
  fallback, matching this task's purpose (an explicit per-pair classification, not a soft default).
- The slot/same-period actionable suggestion is one generic, code-level copy template parameterized by
  period, not a new per-rule string field in the ruleset.
  Alternative: add a `slotSuggestion` string field per pair rule in `actives.json`.
  Reason: the source research's own example copy is generic, not pair-specific; avoids growing the ruleset
  schema for a string that would never vary per pair.
- FE-5's new copy path is unreachable until a pair is actually flipped to `'slot'` post sign-off — accepted
  as shippable now, covered by FE-6's fixture-rule test rather than a live-rule test.
  Alternative: hold FE-5 back until at least one pair is signed off, so the path is exercised by real data
  immediately.
  Reason: precedented — `vials-conflict-matrix-expansion`'s `physical_exfoliant` properties shipped
  unreachable pending data and were tech-lead ACCEPTED on that basis; keeps the mechanical/copy scope fully
  unblocked now, matching the confirmed plan for this task.

## 5. Open Questions

Still blocked (Type A/D per `.claude/rules/tech-design-template.md`'s gap table): which pairs actually
reclassify `'day'` → `'slot'`, and the reactive-skin condition-interaction question — owner product/clinical
reviewer, same gate as `PRD_Spec.md` §6. Bounded decision list (source research's §4 table cross-checked
against each rule's live `resolutions` array, including two rows where they currently disagree) lives in
`progress/conflict-resolution-scope-handoff.json` under `still_blocked.bounded_decision_list`, to avoid
duplicating that table here. Not an open audit — every row needs "confirm" or "correct."

**Scope note for the reviewer:** unlike `vials-conflict-matrix-expansion`'s FE-4, this sign-off only affects
*display* behavior (whether a warning renders) — `resolve.ts`'s auto-scheduling is untouched by this task
(Assumption 2), so approving a `'slot'` flip here does not change what the app automatically does to a
user's routine, only what warning it shows.
