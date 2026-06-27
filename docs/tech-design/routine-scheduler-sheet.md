# Technical Design: Routine Scheduler Sheet
Spec: docs/specs/routine-scheduler-sheet.md
Author: planner-agent
Date: 2026-06-21

## 1. Architecture Overview

All data is local (Zustand + AsyncStorage). No HTTP layer involved.

On ProductDetailScreen, a derived selector reads `routinesStore` to compute the
current `ProductSchedule` for the active product. The "Add to Routine" button
opens `RoutineSchedulerSheet` as a React Native `Modal`. The sheet holds pending
state in local `useState`. On Save, it calls two store actions
(`upsertProductStep` / `removeProductStep`) then closes. The button label on
ProductDetailScreen re-derives from the store automatically via the same selector.

```
ProductDetailScreen
  ├── derives currentSchedule from routinesStore (selector)
  ├── renders "Add to Routine" / "In Routine (...)" button
  └── renders RoutineSchedulerSheet (Modal, slide animation)
        ├── local useState: ProductSchedule (morning, evening, scheduledDays)
        ├── Section 1: two TimeOfDay chips (Morning / Evening)
        ├── Section 2: WeeklySchedulePicker (reused, no changes)
        └── Section 3: Cancel + Save buttons
              └── Save → upsertProductStep / removeProductStep → store → AsyncStorage
```

## 2. API Contracts

N/A — no HTTP endpoints. Store action signatures:

```
upsertProductStep(routineId: string, productId: string, productType: ProductType, scheduledDays: number[]): void
removeProductStep(routineId: string, productId: string): void
```

Both persist immediately via `saveJson(STORAGE_KEYS.routines, routines)`.

## 3. Implementation Tasks

### engineer (scope=frontend)

- FE-1: Add `upsertProductStep` and `removeProductStep` actions to `routinesStore`.
  Files: `src/store/routinesStore.ts`

- FE-2: Create `RoutineSchedulerSheet` component with Modal, three sections
  (time-of-day chips, WeeklySchedulePicker, Cancel/Save actions), local
  `ProductSchedule` state, and entry-state pre-population logic.
  Files: `src/components/routine/RoutineSchedulerSheet.tsx`

- FE-3: Update `ProductDetailScreen` — add selector that derives current
  `ProductSchedule` from `routinesStore`, render the dynamic button (initial /
  active label), wire sheet open/close state.
  Files: `src/screens/ProductDetailScreen.tsx`

- FE-4: Add a pure utility function `formatRoutineLabel(schedule, routines)` that
  produces the "In Routine (Day • Time)" string. Covers "Everyday" vs. specific
  days and single/both time labels.
  Files: `src/utils/routineLabel.ts`

### engineer (unit tests)
- Each task above includes unit tests. FE-4 (`routineLabel.ts`) is the primary
  candidate for pure-logic unit tests per `frontend-testing` standards.

## 4. Assumptions

- `scheduledDays` is shared between AM and PM steps for the same product.
  Alternative: store separate scheduledDays per routine step independently.
  Reason: the UI exposes a single Weekly Planner for both time slots; keeping
  them in sync from the sheet is simpler and matches how users think about
  "I use this product on these days".

- The existing `WeeklySchedulePicker` is reused without modification.
  Alternative: inline a custom day-button row with pill radius inside the sheet.
  Reason: the picker already implements all toggle logic correctly; visual
  adaptation (if needed) can be done via the `style` prop or a thin wrapper.

- `Modal` with `animationType="slide"` is used for the bottom sheet.
  Alternative: a third-party library such as `@gorhom/bottom-sheet`.
  Reason: no external library is currently used for modals in the project;
  React Native's built-in Modal avoids a new dependency for a straightforward
  sheet with no snap-point physics required.

- Tapping the semi-transparent backdrop does NOT dismiss the sheet.
  Alternative: tap-outside-to-dismiss.
  Reason: accidental dismissal would lose unsaved selections; Cancel and X are
  always visible and are the intentional exit paths.

## 5. Open Questions

- None. All decisions resolved.
