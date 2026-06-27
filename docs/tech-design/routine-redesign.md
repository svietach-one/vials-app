# Technical Design: Routine Screen Redesign
Spec: docs/specs/routine-redesign.md
Author: planner
Date: 2026-06-27

## 1. Architecture Overview

The Routine screen is a tab-level screen (`RoutinesScreen.tsx`). Currently it has
two distinct "views" (today / weekly-edit) toggled via a header right button — a
pattern that fragments scheduling context from the step checklist.

The redesign consolidates all concerns into a single scroll:

```
RoutinesScreen (ScrollView / DraggableFlatList depending on mode)
├── [Header] title "Routine" (large in-content), date sub-label
├── PlannerBlock            ← NEW component: scheduling summary + edit entry
├── ClinicalRestrictionsBlock  (conditional, existing)
├── ConflictWarningInline   ← MOVED from WeeklyPlanView footer → always visible
├── SeasonalNoticeBanner    (conditional, existing)
├── RoutineSection AM       (existing, collapsible)
└── RoutineSection PM       (existing, collapsible)
```

Edit-order mode (drag-to-reorder) continues to live in `WeeklyPlanView` but is
now triggered from the PlannerBlock's "Edit order" button rather than a header
right tap, making the trigger visually discoverable.

No store/type changes are needed.

## 2. API Contracts

N/A — local state only, no API endpoints.

## 3. Implementation Tasks

### engineer (scope=frontend)

- **FE-1: Add `readOnly` + `accentColor` prop to `WeeklySchedulePicker`**
  Files: `src/components/routine/WeeklySchedulePicker.tsx`
  When `readOnly: true` the chips are not pressable (wrap in `View`, not `Pressable`).
  `accentColor?: string` defaults to `colors.controlFill`; planner block passes
  `palette.cabernet` so active day chips render in Cabernet when read-only.

- **FE-2: Create `PlannerBlock` component**
  Files: `src/components/routine/PlannerBlock.tsx`
  Props:
  ```ts
  interface PlannerBlockProps {
    activePeriod: 'morning' | 'evening';
    onPeriodChange: (p: 'morning' | 'evening') => void;
    scheduledDays: number[];   // days for the active routine
    stepCount: number;         // visible steps for today in active period
    onEditPress: () => void;
  }
  ```
  Layout (all inside `Card variant='raised' padding='none'`):
  - **Period row** — two equal-width chips (`Morning / Evening`), height 40,
    `borderRadius: radius.md`, separated by a 1-px hairline. Active chip:
    `backgroundColor: palette.cabernet`, label `palette.white`.
    Inactive chip: `backgroundColor: colors.surfaceSunken`, label `textSecondary`.
    Feather icons: `sun` / `moon` (size 14).
  - **Day row** — `WeeklySchedulePicker` with `readOnly` and
    `accentColor={palette.cabernet}`. Outer padding `space[4]`.
  - **Footer row** — `border-top 1px borderDivider`, `paddingHorizontal space[4]`,
    `paddingVertical space[3]`. Left: `"{stepCount} steps today"` (bodySmall,
    textSecondary). Right: `"Edit order"` Pressable (bodySmall, DMSans-Medium,
    `palette.cabernet`) + Feather `arrow-right` size 13.

- **FE-3: Refactor `RoutinesScreen`**
  Files: `src/screens/RoutinesScreen.tsx`
  Changes:
  a. Remove `view` state → rename to `mode: 'view' | 'edit'`.
  b. Update `navigation.setOptions`:
     - `view` mode: `headerTitle: 'Routine'`, `headerRight` → icon-only edit
       button (Feather `calendar`, size 20, `palette.black`) → `setMode('edit')`.
     - `edit` mode: `headerTitle: 'Edit Schedule'`, `headerRight` → "Done" text
       button (existing pattern).
  c. ScrollView content (view mode):
     - **Large title block**: `"Routine"` (`typography.h2`, `textPrimary`) +
       date sub-label — replaces the old `"Today"` title.
     - **PlannerBlock**: driven by `activePeriod` local state (default `morning`);
       `scheduledDays` derived from the active routine's first visible step
       (or the routine-level schedule when that field lands); `stepCount` from
       today's filtered steps for that period; `onEditPress → setMode('edit')`.
     - **ClinicalRestrictionsBlock** (no change).
     - **ConflictWarningInline** with `routines` + `products` from store — moved
       here from `WeeklyPlanView`'s footer so conflicts are always visible.
     - **SeasonalNoticeBanner** (no change, after conflicts).
     - **RoutineSection AM** and **RoutineSection PM** (no internal change).
  d. In `edit` mode, render `WeeklyPlanView` inside `SafeAreaView` (existing path),
     but remove the conflict warning from `WeeklyPlanView` ListFooterComponent
     now that it lives in the main view.

- **FE-4: Remove conflict banner from `WeeklyPlanView`**
  Files: `src/components/routine/WeeklyPlanView.tsx`
  Delete `ListFooterComponent` prop (the `ConflictWarningInline` render). No
  other changes to that file.

- **FE-5: (Unit tests)** — no new pure-logic utilities introduced; FE-1/2/3/4
  are UI-only. No unit tests required per frontend-testing scope rules.

## 4. Assumptions

- `scheduledDays` in PlannerBlock reads from the first non-hidden step of the
  active routine rather than a routine-level field.
  Alternative: add `scheduledDays` field to the `Routine` type.
  Reason: avoids a type migration and store change in Phase 1; the step-level
  schedule already carries the canonical data.

- The "Edit order" action re-uses the existing `WeeklyPlanView` full-screen swap
  rather than adding a new navigation stack screen.
  Alternative: push to a dedicated `RoutineEditScreen` via navigator.
  Reason: lower code surface; the current same-screen swap already works and the
  task is a UX polish, not a nav restructure.

- Checkbox accent stays `gamificationEnabled ? palette.cabernet : palette.black`
  (existing logic). PlannerBlock and day chips are the primary Cabernet touches.
  Alternative: always use Cabernet for checkboxes.
  Reason: avoids breaking the gamification opt-in contract; can be revisited.

## 5. Open Questions

No open questions — all decisions resolved above.
