# Routine Management UX
Date: 2026-06-22
Author: planner-agent
Status: IMPLEMENTED (verified against code 2026-07-02 — see note below)
Supersedes: docs/specs/decouple-routine-from-form.md

> **Implementation note (2026-07-02):** Delivered and confirmed on
> `ProductDetailScreen`. One label wording deviation from this spec: the
> button reads `"In Routine (Everyday • Morning)"` (matching the
> `formatRoutineLabel` convention from `routine-scheduler-sheet.md`), not
> `"Edit Routine (...)"` as originally written in Stories 2–3 below. The
> sheet title passed in does say `"Edit Routine Settings"` when reopening an
> existing schedule. Everything else in this spec — footer layout, remove
> flow, multi-routine action sheet — matches the shipped code.

## 1. Problem Statement

Users currently have no way to manage a product's routine membership from the
product detail screen. The only entry point is the RoutineSchedulerSheet that
auto-appears immediately after a product is created via the add flow.
Editing an existing product's routine assignment requires navigating to the
Routines screen and making changes there — the product detail provides no
shortcut. Additionally, the ManualProductFormScreen contains a "Usage Time"
segmented control whose role overlaps with and conflicts with the proper
routine scheduler, creating user confusion about which control actually
affects the routine.

## 2. Goals

- Users can add a product to one or more routines directly from ProductDetailScreen.
- Users can edit an existing routine assignment (time-of-day, scheduled days)
  directly from ProductDetailScreen.
- Users can remove a product from one or more routines directly from
  ProductDetailScreen, with explicit choice when the product belongs to
  multiple routines.
- The "Usage Time" segmented control is removed from ManualProductFormScreen
  and from the edit form path, eliminating the confusing duplicate control.
- Catalog row badges (sun/moon icons) and the Today/Routine Hub screen update
  immediately after any routine change — no manual refresh.

## 3. Non-Goals

- The edit product form (ManualProductFormScreen in edit mode) does NOT receive
  its own routine management button. Routine management lives only on
  ProductDetailScreen.
- Product.usageTime field on the data model is NOT removed in this task.
  Its removal is a follow-on data migration task.
- Bulk routine management (assign many products at once) is out of scope.
- Any AI-powered routine suggestion is out of scope.
- Swipe-to-remove gesture on catalog rows is out of scope.

## 4. User Stories

### Story 1: Remove "Usage Time" block from product form
As a user adding or editing a product, I want the form to focus on product
metadata only, so that I am not confused by a redundant time-of-day control.

**Acceptance Criteria:**
- [ ] Given I open ManualProductFormScreen in add mode, when I view the form,
      then the "Usage Time" segmented control and its label are absent.
- [ ] Given I open ManualProductFormScreen in edit mode, when I view the form,
      then the "Usage Time" segmented control and its label are absent.
- [ ] Given I save a new product, when the product is stored, then
      usageTime defaults to 'both' (backward-compat sentinel) without the
      user having been asked.

### Story 2: Add to Routine button on ProductDetailScreen
As a user viewing a product that is not in any routine, I want a prominent
"Add to Routine" button, so that I can schedule it without leaving the detail view.

**Acceptance Criteria:**
- [ ] Given a product is in no routine, when I view ProductDetailScreen, then
      a button labelled "Add to Routine" is visible in the footer area.
- [ ] Given I tap "Add to Routine", when the RoutineSchedulerSheet opens,
      then it pre-populates with morning=false, evening=false and no scheduled days.
- [ ] Given I save the scheduler sheet, when the sheet closes, then the
      button label updates immediately to "Edit Routine (...)".

### Story 3: Edit Routine button on ProductDetailScreen
As a user viewing a product that is already in one or more routines, I want
to see my current schedule and be able to edit it, so that I can adjust it
in context.

**Acceptance Criteria:**
- [ ] Given a product is in the morning routine, when I view ProductDetailScreen,
      then a button labelled "Edit Routine (Everyday • Morning)" (or the
      appropriate day/time string) is visible in the footer.
- [ ] Given I tap "Edit Routine (...)", when the RoutineSchedulerSheet opens,
      then morning/evening toggles and scheduledDays reflect the current state.
- [ ] Given I save the scheduler with no routines selected, when the sheet
      closes, then the button reverts to "Add to Routine".

### Story 4: Remove from Routine on ProductDetailScreen
As a user who wants to fully remove a product from its routine(s), I want a
"Remove from Routine" action that is quick but safe.

**Acceptance Criteria:**
- [ ] Given a product is in exactly one routine, when I tap "Remove from Routine"
      (shown beneath the Edit Routine button), then a confirmation alert appears
      before the removal is executed.
- [ ] Given a product is in morning AND evening routines, when I tap "Remove
      from Routine", then an action sheet appears letting me choose: "Morning",
      "Evening", or "All Routines".
- [ ] Given I confirm removal, when the action completes, then the footer
      switches to the "Add to Routine" state immediately.
- [ ] Given I dismiss the confirmation without confirming, when I return to
      the detail screen, then the routine assignment is unchanged.

## 5. UX / Behaviour

**Footer layout on ProductDetailScreen:**
- Not in any routine: single "Add to Routine" button (primary variant, full width).
- In one or more routines:
  - Row 1: "Edit Routine (Everyday • Morning)" button (secondary variant, full width).
    The label is generated by the existing `formatRoutineLabel` utility.
  - Row 2: "Remove from Routine" ghost/destructive text link below the edit button.

**RoutineSchedulerSheet reuse:**
The existing RoutineSchedulerSheet component is used unchanged for both "Add"
and "Edit" entry points. It already pre-populates from store state on open.

**Remove action sheet (multi-routine case):**
Uses React Native's built-in `ActionSheetIOS` on iOS and `Alert.alert` with
choice buttons on Android, wrapped in a platform helper. Three options are
shown: "Morning Routine", "Evening Routine", "All Routines". A fourth
"Cancel" option is always present.

**Single-routine confirm:**
Uses `Alert.alert` with a destructive confirm button. Message: "Remove
[Product Name] from your [Morning/Evening] routine?"

## 6. Data Requirements

- No new fields on Product or Routine types.
- usageTime on Product is preserved but hardcoded to 'both' on save from
  the form (caller ignores the UI control which is removed).
- Store actions used: `upsertProductStep`, `removeProductStep` (both already
  exist on routinesStore).

## 7. Dependencies

- Depends on: `routine-scheduler-sheet` (shipped — RoutineSchedulerSheet
  component is already in production).
- Supersedes: `decouple-routine-from-form` (closes that task — its cleanup
  scope is absorbed here).
- Blocks: nothing downstream.

## 8. Security & Privacy

- Authentication required: no (local-only storage, Phase 1).
- Data sensitivity: none — all data is local to the device.
- Compliance: no PII involved.

## 9. Success Metrics

- Zero navigation steps from ProductDetailScreen to assigning a routine
  (previously required going to RoutinesScreen).
- The "Usage Time" control is absent from all form renders (verifiable via
  automated UI test asserting the section heading does not exist).

## 10. Open Questions

- None. All decisions confirmed by the product owner (2026-06-22).
