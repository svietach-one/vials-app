# Technical Design: Routine Screen Redesign
Spec: docs/specs/routine-redesign.md (never formalized — see note below)
Author: planner
Date: 2026-06-27
Updated: 2026-07-02 (tech-designer — rewritten to match delivered code; see Revision History)

> **Note on spec:** No `docs/specs/routine-redesign.md` was ever written. The
> original 2026-06-27 design was derived directly from the user's written
> brief plus a codebase audit (Figma MCP was rate-limited at the time). The
> screen was then iterated on directly against running code through several
> unreviewed follow-up commits, diverging from what is written below. This
> document has been rewritten to describe the **as-built** `RoutinesScreen`
> as of `feature-routine-redesign` HEAD (`ad7fe61`), not the original plan.

## 1. Architecture Overview

`RoutinesScreen` (`src/screens/RoutinesScreen.tsx`) is a single-scroll tab
screen with no separate "weekly edit" screen swap. Day navigation, period
switching, viewing, and reordering all live in one `DraggableFlatList`:

```
RoutinesScreen
├── AppHeader "Routines"
│   └── rightAction: [+ Add product] [Edit/Done toggle]  (IconButton x2)
└── DraggableFlatList (data = steps for activePeriod + selectedDow)
    ├── ListHeaderComponent → PlannerBlock
    │     ├── Row 1: date label (left) + Morning/Evening icon toggle (right)
    │     └── Row 2: 7-day chip row (Mo…Su), single selectable day
    ├── renderItem → RoutineStepCard (per step)
    │     ├── view mode:  tap card → navigate to ProductDetail
    │     └── edit mode:  drag handle (left) + trash icon (right), no navigation
    ├── ListFooterComponent → "Add product" button (view mode only)
    └── ListEmptyComponent → "No products scheduled for today."

Sheets/modals mounted at screen level:
├── AddToRoutineSheet   (BottomSheetModal, 2-step: pick product → set schedule)
└── RemoveStepModal     (RN Modal, single-step confirm)
```

Edit mode is a boolean (`isEditMode`) toggled by the header icon (`edit-2` /
`check`), not a separate route or the header-right calendar icon originally
planned. There is no `WeeklyPlanView` swap-screen in the live flow anymore —
see §4 "Orphaned components."

Conflict detection still runs via `ConflictEngine.detectConflicts`, but the
result is surfaced **inline per card** (`RoutineStepCard`'s `conflictingProductName`
prop renders an amber "Conflicts with X" row under the affected card) rather
than as a single dedicated `ConflictWarningInline` banner. There is no
`ClinicalRestrictionsBlock` or `SeasonalNoticeBanner` rendered on this screen.

Checkbox-based step completion and the gamification accent (Cabernet vs.
black checkbox fill) described in the original plan and in `SCREENS.md` do
not exist in the current `RoutineStepCard` — steps are display/reorder rows
only, no per-day completion state is tracked.

No store/type changes were needed for the screen itself; `upsertProductStep`,
`removeProductStep`, `removeStepFromDay`, and `reorderSteps` (all pre-existing
or added under `routine-scheduler-sheet`) cover every mutation this screen
performs.

## 2. API Contracts

N/A — local state only, no API endpoints. Store actions used (all on
`routinesStore`, unchanged signatures):

```
reorderSteps(routineId: string, steps: RoutineStep[]): void
removeStepFromDay(routineId: string, stepId: string, dow: number): void
removeProductStep(routineId: string, productId: string): void
upsertProductStep(routineId, productId, productType, scheduledDays): void
```

## 3. Delivered Components (as-built)

- **`PlannerBlock`** (`src/components/routine/PlannerBlock.tsx`) — replaced
  the originally planned "period chips + read-only WeeklySchedulePicker +
  Edit-order footer link" design entirely. Actual props:
  `activePeriod`, `onPeriodChange`, `selectedDow`, `onDaySelect`. Renders a
  date label (`"Today, Wednesday, 2 Jul"` style, via internal `buildDateLabel`)
  and a 7-chip Mo–Su day selector where exactly one day is active at a time
  (this is a day-navigation calendar, not a multi-day schedule picker).
  Selecting a day filters the visible steps for that day of week; it does not
  edit `scheduledDays` on any step.

- **`AddToRoutineSheet`** (`src/components/routine/AddToRoutineSheet.tsx`,
  611 lines) — a `@gorhom/bottom-sheet` `BottomSheetModal` (migrated off React
  Native's built-in `Modal` in commit `ad7fe61`), two internal steps:
  1. **Pick** — search input + category `FilterChip` row (`CategoryKey`:
     All/Serums/Moisturizers/Cleansers/SPF/Soothing/Treatments, mapped to
     `ProductType[]` via a local `CATEGORY_TYPES` table) + `BottomSheetFlatList`
     of `ProductPickerCard`s, filtered to non-hidden products.
  2. **Schedule** — Morning/Evening `TimeChip` toggles + `WeeklySchedulePicker`
     (writable) + Back/"Add to routine" actions. Pre-populates from the
     product's existing schedule via `deriveProductSchedule` if it already has
     one; otherwise defaults `activePeriod` on.
  Backdrop press dismisses only on step 1 (`pressBehavior: step === 'pick' ?
  'close' : 'none'`) to avoid discarding an in-progress schedule edit.

- **`RemoveStepModal`** (`src/components/routine/RemoveStepModal.tsx`) — RN
  `Modal`-based confirm sheet offering "Remove from {Weekdays}" (single day,
  via `removeStepFromDay`) vs. "Remove from all days" (via `removeProductStep`)
  vs. "Cancel". Triggered only from edit-mode trash icon taps on
  `RoutineStepCard`; distinct from `RemoveRoutineActionSheet` (see §5) which
  is `ProductDetailScreen`'s removal path.

- **`RoutineStepCard`** — no checkbox in either mode. View mode: `Touchable
  Opacity` navigates to `ProductDetail`. Edit mode: plain `View` root (to avoid
  RNGH/RNDFL gesture-arena conflicts, see D-note below) with a `Pressable`
  dot-grid drag handle (`onLongPress={drag}`) and a trash `TouchableOpacity`.

## 4. Orphaned components (not wired into any screen)

These files still exist under `src/components/routine/` but are not imported
by `RoutinesScreen` or any other screen as of this branch HEAD. They were
part of the original 2026-06-27 plan and were superseded by the components in
§3 without being deleted:

- `WeeklyPlanView.tsx` — the old full-screen "edit mode" swap view.
- `ClinicalRestrictionsBlock.tsx`
- `SeasonalNoticeBanner.tsx`
- `ConflictWarningInline.tsx`
- `TabButton.tsx`

`src/hooks/useRoutineLinking.ts` is similarly dead (superseded by
`upsertProductStep`/`removeProductStep`; see `decouple-routine-from-form.md`)
but was never deleted. None of these are exercised by any current screen or
test; treat them as removal candidates in a follow-up cleanup task, not as
part of this design.

## 5. Related but out-of-scope-here surfaces

`RoutineSchedulerSheet` (a *different*, RN-`Modal`-based sheet, not migrated
to `BottomSheetModal`) remains the routine-assignment entry point on
`ProductDetailScreen`, `CatalogScreen`, and `ManualProductFormScreen` — see
`routine-scheduler-sheet.md` and `routine-management-ux.md`. `RoutinesScreen`
itself only uses `AddToRoutineSheet`, a separate component with a different
UX (product search + pick, vs. single-product schedule-only).

## 6. Revision History / Known Deviations

2026-06-27 — Original design created (4 engineer tasks, FE-1..FE-4, described
a `Card`-based `PlannerBlock` with period chips + read-only day picker + an
"Edit order" footer link, and a `WeeklyPlanView` screen swap for reordering).

2026-06-27 — Initial implementation shipped with 4 logged deviations
(two-layer View instead of `Card`, h1 instead of h2 title, Cabernet "done"
badge, added `initialPeriod` prop to `WeeklyPlanView`) — see commits
`ae5890f`, `2f462be`, `01d6853`, `510a071`, `cc9290c`.

2026-07-02 — Tech-lead review of further uncommitted UX iteration (day-nav
calendar, `AddToRoutineSheet`, `RemoveStepModal`) found one BLOCKER: `Bottom
SheetView` used but not imported in `AddToRoutineSheet` (4 `tsc` errors).
Fixed in commit `ad7fe61` ("migrate AddToRoutine to BottomSheetModal, add
RemoveStepModal, fix scroll layout") — confirmed resolved; `BottomSheetView`
is imported correctly as of this doc's rewrite. All 10 previously-logged bugs
from that review are either fixed or downgraded to accepted WARNINGs (see
`progress/routine-redesign.md`).

2026-07-02 — This document rewritten end-to-end (§1–§5) to match the code
actually on `feature-routine-redesign` HEAD, since the original architecture
(period-chip `PlannerBlock`, `WeeklyPlanView` swap, banner-style conflict
warning, checkbox completion) was fully superseded by an undocumented second
iteration. No new spec was written for that second iteration before it
shipped — that is the gap this rewrite closes.

## 7. Open Questions

- Should the five orphaned components in §4 be deleted outright, or is there
  a planned reuse (e.g. reintroducing `ClinicalRestrictionsBlock` /
  `SeasonalNoticeBanner` onto `RoutinesScreen`)? Undecided — flagging for
  product owner input before a cleanup task is scoped.
- `US-08.1` (safe product deletion with routine cascade) documents an
  `EmptySlotPlaceholder` component that does not exist in the codebase;
  deleted products currently leave orphaned `RoutineStep` records that are
  silently filtered out of the visible list rather than surfaced as an empty
  slot. Needs a product decision — see `USER_STORIES.md` update.
