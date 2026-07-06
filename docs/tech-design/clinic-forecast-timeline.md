# Technical Design: Clinic Forecast Timeline
Spec: docs/specs/clinic-forecast-timeline.md
Author: planner-agent
Date: 2026-07-06

## 1. Architecture Overview

`ForecastTimeline` (code name for the PRD's "`12_MonthForecastTimeline`")
replaces the inline `MonthTimelineBar` placeholder as `ClinicScreen`'s
`FlatList.ListHeaderComponent`. `ClinicScreen` keeps sole ownership of
`useProceduresStore`; it filters out archived logs, passes the rest down as
props, and owns a new `FlatList` ref for the tap-to-scroll interaction. All
date/layout math lives in one pure util that wraps the existing
`procedureLifespanHelpers.ts` functions — no phase logic is reimplemented.

```
ClinicScreen (owns store + FlatList ref)
  ├─ visibleProcedures = procedures.filter(p => p.status !== 'archived')
  ├─ <ForecastTimeline procedures={visibleProcedures} onSelectProcedure={...} />
  │     (ListHeaderComponent, replaces MonthTimelineBar)
  │       └─ buildForecastTimeline(procedures, now)  [pure util]
  │             └─ reuses getTimelineConfig / computeStatus / getProcedureDisplayName
  └─ <FlatList data={sorted} ...>  (ProcedureLifespanCard — unchanged)
        onSelectProcedure(id) → flatListRef.current.scrollToItem({ item, animated: true })
```

## 2. API Contracts

N/A — fully offline component, no HTTP endpoints, no backend layer. Local
data contracts (props/util signature) for reference:

```ts
// src/utils/forecastTimelineHelpers.ts
export interface ForecastMonthColumn { key: string; label: string; year: number; isCurrent: boolean; }
export interface ForecastTrack {
  procedureId: string; displayName: string; status: ComputedStatus; row: number;
  startOffset: number; fadeOffset: number; endOffset: number; // month-units from window start, clamped to [0, 12]
}
export interface ForecastTimelineData { months: ForecastMonthColumn[]; tracks: ForecastTrack[]; rowCount: number; }
export function buildForecastTimeline(procedures: UserProcedureLog[], now: Date): ForecastTimelineData

// src/components/clinic/ForecastTimeline.tsx
export interface ForecastTimelineProps {
  procedures: UserProcedureLog[];        // pre-filtered to non-archived by ClinicScreen
  onSelectProcedure: (procedureId: string) => void;
  now?: Date;                             // defaults to new Date(); override for deterministic tests
}
```

## 3. Implementation Tasks

### engineer (scope=frontend)

- FE-1: Create `src/utils/forecastTimelineHelpers.ts`. Build the 12
  `ForecastMonthColumn`s (6 months before `now`'s month + current + 5 after,
  per Assumption 1). For each procedure, resolve
  `getTimelineConfig`/`computeStatus` and convert `datePerformed`,
  `datePerformed + fadeTriggerMonth`, `datePerformed + totalEffectMonths`
  into month-unit offsets from the window start; clamp to `[0, 12]`; drop
  any procedure whose span falls fully outside the window. Assign `row` per
  procedure via greedy interval partitioning (sort by `startOffset`, place
  in the first row whose last track already ended, else open a new row —
  Assumption 4). No React or store imports.
  Files: `src/utils/forecastTimelineHelpers.ts`

- FE-2: Create `src/components/clinic/ForecastTimeline.tsx`. Call
  `buildForecastTimeline(procedures, now ?? new Date())`. Render a
  horizontal `ScrollView` containing: a 12-column month header (current
  column bold, via `typography`/`colors` tokens), then one
  absolutely-positioned track per `ForecastTrack`, split at `fadeOffset`
  into a `palette.cobalt`-filled segment and a `palette.amber`-filled
  segment (Assumption 2 — exactly 2 segments, no rehab segment). Wrap each
  track in one `Pressable` (`accessibilityRole="button"`,
  `accessibilityLabel` including `displayName`) calling
  `onSelectProcedure(procedureId)`. Ribbon height derives from `rowCount`.
  Tokens only — no hardcoded hex (Assumption 6).
  Files: `src/components/clinic/ForecastTimeline.tsx`

- FE-3: Wire into `ClinicScreen.tsx`. Delete the `MonthTimelineBar` function
  and its `timelineStyles`. Add
  `const flatListRef = useRef<FlatList<UserProcedureLog>>(null)`. Compute
  `const visibleProcedures = procedures.filter(p => p.status !== 'archived')`.
  Render `<ForecastTimeline procedures={visibleProcedures} onSelectProcedure={handleSelectProcedure} />`
  as `ListHeaderComponent`, gated on `visibleProcedures.length > 0`
  (replacing the current `procedures.length > 0` gate — Assumption 5).
  `handleSelectProcedure(id)` finds the matching item in `sorted` and calls
  `flatListRef.current?.scrollToItem({ item, animated: true, viewPosition: 0.2 })`;
  no `getItemLayout` needed at expected procedure-log volumes.
  Files: `src/screens/ClinicScreen.tsx`

### engineer (unit tests, scope=frontend)

- FE-4: Unit tests for `buildForecastTimeline`: 12-column boundary
  construction incl. the current-month flag across a year rollover (`now` in
  November/December), start/fade/end offset math against known
  `CLINICAL_RULES_DB` entries (botox, fillers), edge-clipping for spans
  starting before/ending after the window, custom-procedure derivation,
  archived-exclusion, and row assignment for overlapping vs. sequential
  fixtures.
  Files: `src/utils/forecastTimelineHelpers.test.ts`

## 4. Assumptions

- Window = 6 calendar months before `now`'s month + current month + 5 after
  (current occupies column 7 of 12).
  Alternative: an exact ±~182-day rolling window with no month-snapping.
  Reason: Matches "current month visually marked" (whole-month granularity)
  and the prior `MonthTimelineBar`'s month-bucket convention.

- Each track renders exactly 2 segments (Cobalt then Amber, split at
  `fadeTriggerMonth`); no 3rd Cabernet rehab segment.
  Alternative: add a leading Cabernet segment for `rehabDays`, per PRD
  §2.2's rehab-color rule.
  Reason: The product owner's decision names only 2 segments; rehab already
  has dedicated surfaces (`RehabWidget`, the "Rehab" badge) — a 3rd segment
  here would duplicate and exceed that decision.

- Tracks are clipped silently at the window edges (no overflow glyph).
  Alternative: render a chevron/arrow at the clipped edge.
  Reason: Keeps v1 layout math simple; the full, unclipped duration remains
  visible on the card below, so no data is lost.

- Overlap handling uses greedy interval-partitioning row assignment with an
  uncapped row count.
  Alternative: cap at N rows with a "+N more" overflow badge.
  Reason: Concurrent procedures are rare (1–3 typical); an uncapped, simple
  algorithm avoids inventing an unrequested overflow UI.

- All-archived data hides the ribbon entirely (mirrors today's
  zero-procedure gating, re-keyed on the non-archived subset).
  Alternative: always render the empty 12-column grid even with zero tracks.
  Reason: An all-columns, all-empty grid conveys no information and adds
  visual noise above an all-archived card list.

- No new tokens: reuse `palette.cobalt`/`colors.statusInfo*` and
  `palette.amber`/`colors.statusWarning*` as-is.
  Alternative: add a dedicated forecast-specific color alias.
  Reason: These are already the canonical PRD §2.2 colors for
  "informational" and "caution/fading"; a parallel alias would violate the
  one-color-one-meaning rule and duplicate tokens.

## 5. Open Questions

No open questions.
