# Technical Design: Day-Split Cycling for Competing Strong Actives
Spec: docs/specs/day-split-alternation.md
Author: planner-agent
Date: 2026-09-22

## AI-SDLC Flags
```
backend_layer:  false
frontend_layer: true
infra_changes:  false
```

## 1. Architecture Overview

`skeleton.ts`'s `pickTreatment` already knows the period's winner and every loser. It gains detection only:
the single best-ranked loser whose `cycleClass` differs from the winner's is tagged `cycle_class_rival`
(new `ReserveItem` fields identify the winner + period) instead of the generic `cumulative_active_cap`. By
default it stays reserved — zero behavior change. When its productId is already in the existing phase-07
`userOverrides` list, skeleton admits it into `periodCandidates` (the existing generic override path) and
additionally records the pair in a new `cycleSplitPairs` list threaded to `resolve.ts`.

`resolve.ts`'s admission loop already resolves each candidate's frequency cap before checking violations
(`applyFrequencyCaps`, fed by the same merged adaptation/treatment-cap data used everywhere else). A new
branch, checked before the generic pair-rule/cap resolution ladder, fires when a violation's partner is the
candidate's registered `cycleSplitPairs` counterpart: it computes complementary days from each side's
already-resolved cap and retroactively rewrites the already-admitted partner's `scheduledDays` — the same
retroactive-partner-mutation shape `attemptDaySplit`'s existing single-daily-partner case already uses, just
driven by a new function instead of `pickSplitDays` (traced during planning: `pickSplitDays`/`attemptDaySplit`
do not produce a real split for two independently capped rivals — both land on the same preferred days and
the loser freezes).

```
skeleton.ts: pickTreatment -> winner; best cross-cycleClass loser = rival
  rival in userOverrides? no  -> reserve(cycle_class_rival, rivalOfProductId, period)   [default]
                          yes -> periodCandidates += rival; cycleSplitPairs += {winner, rival}
resolve.ts admission loop (pool now has both):
  candidate's violation partner == its cycleSplitPairs counterpart
    -> computeCycleSplitDays(winnerCap, rivalCap)   [new, cycleSplit.ts]
    -> admit candidate with rivalDays; rewrite partner.scheduledDays = winnerDays; log day_split x2
```

Draft Preview reads the tagged `ReserveItem` to render the prompt card; "Alternate automatically" calls the
same `addOverride` action phase-07's "Add anyway" already calls, then regenerates.

## 2. API Contracts

N/A — local-only Expo/RN app (AsyncStorage + Zustand), no backend/API layer in Phase 1 (`CLAUDE.md`).

## 3. Implementation Tasks

### engineer (scope=frontend)
- FE-1: New `DecisionReasonCode` `cycle_class_rival` + `reasonText` entry; new optional `ReserveItem`
  fields `rivalOfProductId?: string` and `period?: Period`. Files: `src/constants/decisionReasons.ts`,
  `src/utils/routineEngine/planTypes.ts`.
- FE-2: `skeleton.ts` — after `pickTreatment`, find the single best-ranked treatment-pool loser whose
  `cycleClass` differs from the winner's (only when the winner itself has a `cycleClass`; no-op otherwise).
  Default: `reserve` it with `cycle_class_rival` + the new fields. When its id is already in
  `input.userOverrides`: admit into `periodCandidates[period]` (existing path) and append
  `{winnerProductId, rivalProductId}` to a new `SkeletonSelection.cycleSplitPairs` array. Files:
  `src/utils/routineEngine/skeleton.ts`.
- FE-3: New pure `computeCycleSplitDays(winnerCap: number, rivalCap: number): { winnerDays: number[];
  rivalDays: number[] }` — size = `min(winnerCap, rivalCap)`; winner keeps the existing
  `SPLIT_DAY_PREFERENCE`-equivalent `[Tue, Sat]` (byte-identical to today's solo-capped split), rival gets a
  new, disjoint `[Mon, Thu]` preference, falling back to any remaining free day if size != 2. Files: new
  `src/utils/routineEngine/cycleSplit.ts`.
- FE-4: Thread `cycleSplitPairs` through `ResolveInput.selection` (`generate.ts` passes
  `skeleton.cycleSplitPairs` through unchanged). In `resolve.ts`'s admission loop, when a candidate's
  violation set includes its registered `cycleSplitPairs` partner, resolve via FE-3 (using each side's
  already-resolved `opts.adaptationLimits`/`opts.limits` cap) instead of the generic ladder for that specific
  violation; log a `day_split` decision for both sides (reuses the existing `DecisionAction`, so
  `buildDraftSummaryLines` narrates it without new code). Any other simultaneous violation against a
  different admitted product still flows through the normal ladder unchanged. Files:
  `src/utils/routineEngine/resolve.ts`, `src/utils/routineEngine/generate.ts`.
- FE-5: Draft Preview prompt card — new block rendered above the "In reserve" section when `plan.reserve`
  contains a `cycle_class_rival` item; names both products (via `rivalOfProductId` + the admitted winner
  step) with "Alternate automatically" / "Keep only [winner]" actions, styled consistently with
  `SeasonalNoticeBanner`/`GoalCoverageBanner`. Two new optional callback props on `DraftPreviewScreenProps`,
  mirroring the existing `onOverride` prop. Files: `src/components/routine/DraftPreviewScreen.tsx`.
- FE-6: `RoutinesScreen.tsx` — "Alternate automatically" calls the same
  `useTrackingStore.getState().addOverride(rivalProductId, currentOverrideHash())` phase-07's `handleOverride`
  already calls, then regenerates the draft. "Keep only [winner]" only updates local, ephemeral component
  state (a dismissed-pairs set) so the card does not reappear within the same session — no store write.
  Files: `src/screens/RoutinesScreen.tsx`.

### engineer (unit tests, scope=frontend)
- FE-7: `skeleton.test.ts` (+ new `cycleSplit.test.ts`) — rival detection incl. the single-best-rival rule
  (two exfoliants vs one retinoid) and same-`cycleClass`-loser non-interference (`duplicate_function`
  unchanged); default-reserve carries the new reason/fields; an overridden rival produces `cycleSplitPairs`
  instead of a reserve entry; `computeCycleSplitDays` covers matching caps, divergent caps, and the
  fallback-free-day path.
- FE-8: `resolve.test.ts` — a `cycleSplitPairs` entry admits both candidates with zero violations and
  correctly complementary, `min()`-sized `scheduledDays`; both sides log `day_split`; zero regression for
  every existing pair-rule/cap fixture. `conflictEngine.test.ts` — regression proving
  `rule_retinol_aha`/`rule_retinol_bha` (`resolutionScope: 'day'`) render no warning once real,
  non-overlapping `scheduledDays` exist (spec Story 5).

## 4. Assumptions

- Persistence reuses the existing `trackingStore` `overrides`/`addOverride`/`currentOverrideHash`
  mechanism verbatim — "Alternate automatically" is, mechanically, the same "force this product back in"
  action phase-07's "Add anyway" already performs on the rival's productId; only `skeleton.ts`'s reaction to
  an override on a `cycle_class_rival` item is new.
  Alternative: a new, dedicated persisted field/list for cycle-alternation approvals (pre-approved as
  acceptable during Step 0).
  Reason: the rival is structurally just "a reserved product forced back in" — reusing the existing field
  is strictly less new surface than a dedicated one, and its hash-based invalidation already solves
  "shelf/goal changed, ask again" for free.
- Complementary-day computation happens inside `resolve.ts`'s admission loop, not inside `skeleton.ts` at
  detection time.
  Alternative: have `skeleton.ts` precompute and pass down exact days.
  Reason: `skeleton.ts` has no visibility into per-product adaptation-phase caps today
  (`collectAdaptationLimits` runs later in `generate.ts`, feeding only `resolvePeriods`); reusing the cap
  values `resolve.ts` already resolves for every candidate avoids re-plumbing adaptation data into a stage
  that doesn't otherwise need it.
- Split size is always `min(winner's current cap, rival's current cap)`, re-derived fresh on every
  generation (Q1) — never the larger cap, never a fixed ratio independent of either cap.
  Alternative: give each side its own cap's worth of days (maximizes usage, uneven split); or always fix
  2-and-2 regardless of either cap.
  Reason: product decision (Q1) — simplest, safest-reading, clean alternation pattern; in practice always
  evaluates to 2/week for the one real pairing today, since the exfoliant side's flat treatment cap never
  exceeds 2.
- Only the single best-ranked cross-`cycleClass` loser is ever detected/offered per period (Q4); every
  other same-`cycleClass` product keeps today's plain `cumulative_active_cap` reserve treatment, not a
  second prompt.
  Alternative: surface every cross-class rival simultaneously.
  Reason: product decision (Q4) — keeps the UI and the detection logic to one prompt per generation.
- "Alternate automatically" unconditionally overwrites any pre-existing manual `scheduledDays` on both
  products (Q3); no new `EngineInput`/`SkeletonInput` visibility into the currently-saved `Routine[]` is
  added to detect or preserve a prior manual split.
  Alternative: skip the prompt when the shelf's saved routine already shows both on non-overlapping days.
  Reason: product decision (Q3) — avoids widening the engine's input surface for a narrow case.
- Declining ("Keep only [winner]") is a purely local, ephemeral UI dismissal, not a persisted decision —
  reopening Draft Preview in a later session re-offers the prompt.
  Alternative: persist a "declined" flag too, symmetric with the acceptance path.
  Reason: only the acceptance path needs durability (so an opted-in user isn't re-asked forever); nothing
  safety-relevant is lost by re-offering a still-available choice, and it avoids a second piece of new state.

## 5. Open Questions

No open questions. Q1-Q4 raised in Step 0 planning were resolved by product decision on 2026-09-22 (see
`progress/day-split-alternation.md`).
