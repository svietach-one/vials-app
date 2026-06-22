# Routine Scheduler Sheet
Date: 2026-06-21
Author: planner-agent
Status: APPROVED

## AI-SDLC Flags
```
backend_layer:  false
frontend_layer: true
infra_changes:  false
```

---

## 1. Problem Statement

Users currently have no way to add a product directly to their morning or evening routine from the product detail page. The only path to routine membership is through the Routines screen, which requires the user to know which step slot the product belongs to and navigate away from the product context. This friction causes products to be catalogued but never scheduled, making the routine feature feel disconnected from the catalog.

---

## 2. Goals

- Users can schedule a product into one or both routines (morning / evening) without leaving the product detail context.
- Users can specify which days of the week the product should appear in that routine.
- After saving, the product detail button reflects the current schedule at a glance.
- Re-opening the sheet from an already-scheduled product pre-populates the prior selection.

---

## 3. Non-Goals

- Reordering steps within a routine (Routines screen responsibility).
- Conflict detection between products at scheduling time (conflict warnings live on the Routines screen only).
- Scheduling from the catalog list card (only from ProductDetailScreen).
- Per-time-slot day granularity (morning days vs. evening days are shared, not independent).
- Any server-side persistence — all state is local AsyncStorage.

---

## 4. User Stories

### Story 1: Add a product to a routine

As a user viewing a product detail page, I want to tap "Add to Routine" so that I can assign the product to my morning or evening routine on specific days.

**Acceptance Criteria:**
- [ ] Given I am on ProductDetailScreen with no existing schedule, when I tap "Add to Routine", then the RoutineSchedulerSheet slides up from the bottom with title "Add to Routine" and a close (X) icon.
- [ ] Given the sheet is open, when I tap "Morning", then the Morning chip becomes active (solid fill). I can also tap "Evening" independently.
- [ ] Given the sheet is open, when I tap individual day buttons, then those days toggle active (solid fill); all others remain as outlines.
- [ ] Given I have selected at least one time-of-day chip, when I tap "Save", then the sheet closes and the product is added as a RoutineStep to the selected routine(s) with the selected scheduledDays.
- [ ] Given I have selected no time-of-day chips, when I tap "Save", then the product is removed from any routine it currently belongs to, and the sheet closes.
- [ ] Given the sheet is open, when I tap "Cancel" or the X icon, then the sheet closes with no changes to the store.

### Story 2: View and edit an existing schedule

As a user who has already scheduled a product, I want the button to show my current schedule so I can quickly see what was saved and edit it.

**Acceptance Criteria:**
- [ ] Given a product is in the morning routine every day, when I view ProductDetailScreen, then the button reads "In Routine (Everyday • Morning)".
- [ ] Given a product is in both routines on Mon, Wed, Fri, when I view ProductDetailScreen, then the button reads "In Routine (Mon, Wed, Fri • Morning, Evening)".
- [ ] Given a product is in the evening routine only on weekends (Sat, Su), when I view ProductDetailScreen, then the button reads "In Routine (Sat, Sun • Evening)".
- [ ] Given the product is already scheduled, when I tap the active-state button, then the RoutineSchedulerSheet opens with Morning/Evening chips and days pre-populated from the current store state.
- [ ] Given I change my selection and tap "Save", then the store is updated and the button label refreshes to reflect the new schedule.

---

## 5. UX / Behaviour

**Sheet anatomy:**
- Slides up from the bottom using React Native `Modal` with `animationType="slide"`.
- Semi-transparent backdrop (`rgba(0,0,0,0.4)`) fills the area above the sheet; tapping the backdrop has no action (Cancel button and X are the only dismiss paths, to prevent accidental dismissal).
- Sheet header: "Add to Routine" text (h3 style) + X IconButton (top-right).
- Section 1 — TIME OF DAY: label "TIME OF DAY", two action chips side-by-side: "Morning" and "Evening". Each chip is independently toggleable. Inactive = outline style (borderStrong). Active = solid fill (controlFill, textOnDark).
- Section 2 — WEEKLY PLANNER: label "WEEKLY PLANNER", row of 7 circular day buttons rendered by reusing `WeeklySchedulePicker`. Inactive = outline. Active = solid fill. Empty selection = every day (all show active).
- Section 3 — ACTIONS: two buttons in a row: "Cancel" (secondary/ghost variant) and "Save" (primary variant). Save is disabled if no changes have been made relative to the entry state (optional quality-of-life; not a blocking requirement).

**Button label on ProductDetailScreen:**
- Not in any routine: `Add to Routine` (primary button).
- In one or both routines: `In Routine (Day Label • Time Label)` (primary button, same visual weight).
  - Day label: if `scheduledDays` is empty → "Everyday"; else → 3-letter abbreviations joined by comma and space (e.g. "Mon, Wed, Fri"). Days displayed in Mo-Tu-We-Th-Fr-Sa-Su order.
  - Time label: "Morning", "Evening", or "Morning, Evening".

**Error / edge states:**
- If neither routine exists in the store (unexpected), the Save action is a no-op and the sheet closes silently.
- `RoutineSchedulerSheet` never renders if `productId` is null or undefined.

---

## 6. Data Requirements

**New store actions on `routinesStore`:**
- `upsertProductStep(routineId, productId, productType, scheduledDays)` — finds the routine by id; if a step with this productId already exists, updates its scheduledDays; otherwise appends a new RoutineStep (id = generateId(), hidden = false).
- `removeProductStep(routineId, productId)` — removes any step whose productId matches; no-op if not found.

**Existing data consumed:**
- `Routine[]` from `routinesStore` — to find morning and evening routines and derive current schedule.
- `Product.productType` — required to populate `RoutineStep.productType` when upserting.

**Local component state (not persisted):**
- `ProductSchedule { morning: boolean; evening: boolean; scheduledDays: number[] }` — held in `useState` inside `RoutineSchedulerSheet` while the sheet is open.

**Persistence:** all writes go through `routinesStore` → `saveJson(STORAGE_KEYS.routines, ...)` (AsyncStorage). No new storage keys needed.

---

## 7. Dependencies

- Depends on: existing `Routine` / `RoutineStep` types in `src/types/index.ts` (no changes required).
- Depends on: `WeeklySchedulePicker` component (reused as-is).
- Depends on: `routinesStore` — needs two new actions added before the sheet can save.
- Blocks: none — this is a standalone feature addition.
- External services: none.

---

## 8. Security & Privacy

- Authentication required: no (local-only app, no accounts in Phase 1).
- Data sensitivity: non-sensitive lifestyle data stored only on device.
- Compliance: no PII collected by this feature.

---

## 9. Success Metrics

- A product can be added to a routine from ProductDetailScreen with 3 taps or fewer (open sheet, toggle morning, save).
- After saving, the button label correctly reflects the stored schedule on every subsequent render of ProductDetailScreen.
- Re-opening the sheet always shows the exact current store state (no stale local state).

---

## 10. Open Questions

- None. All design decisions are resolved per the feature brief and existing codebase context.
