# Task 03 — Routine Screen Restructure (List View)

**Depends on:** Task 02 (cards already carry thumbnails).
**Scope:** the Today/list view of the Routine tab. The list/calendar toggle in
the sub-header stays; the calendar view itself is task 05.

## Locked decisions

- **Header actions:** two plain icon buttons, right-aligned, no dropdown:
  Feather `refresh-cw` (regenerate routine — keeps its current confirmation
  flow) immediately left of `+` (add product to routine, rightmost). Adding a
  product must remain a single tap from this screen.
- **AM + PM on one screen** as two accordion sections, "Morning" and "Evening",
  both present in one scroll. Remove any AM/PM segmented switching from this
  view if present.
- **Initial accordion state by time of day** (via `timeHelpers`):
  before **15:00** → Morning expanded / Evening collapsed; from 15:00 →
  Morning collapsed / Evening expanded. This decides the state **only on
  screen mount**. Manual toggles always win for the rest of the session —
  never auto-collapse a section the user opened. (Session-scoped state is
  fine; no persistence needed.)
- **Reorder = long-press** lifts the card into drag (the default
  `react-native-draggable-flatlist` gesture). No tap-to-arm mode, no separate
  "edit mode" toggle for reordering. Drop persists order to `routinesStore`.
- **Three-dots → bottom sheet** with exactly four actions:
  1. View product details
  2. Edit product (opens `ManualProductFormScreen` in edit mode)
  3. Remove from routine (removes the step, NOT the product from the shelf)
  4. Hide from routine (sets `step.hidden = true`)
  Reuse the codebase's existing bottom-sheet/action-sheet pattern if one
  exists; otherwise build a minimal DS-consistent `ActionSheet` in
  `src/components/ui/` (monochrome, tokens only) — Expo Go compatible,
  no new native deps.
- Card content on this screen stays compact per task 02's split (zap glyph,
  no full tag list). Conflict line (Amber) behavior unchanged.

## Steps

1. **Investigate first, write findings into PROGRESS.md before coding:**
   - Current structure of the routine screen: how AM/PM are rendered today,
     whether `react-native-draggable-flatlist` is installed and used, and how
     the list/calendar toggle is wired.
   - Nesting constraint: two `DraggableFlatList`s inside one `ScrollView` is a
     known friction point (gesture conflicts, nested VirtualizedList warnings).
     Decide between: (a) one outer ScrollView + per-section DraggableFlatList
     with `scrollEnabled` coordination and `simultaneousHandlers`, or
     (b) a single list with section headers where only same-section reorders
     are allowed. Document the choice and why.
2. **Header:** implement the two icon buttons; remove/relocate whatever
   currently hosts "regenerate" if it lives elsewhere.
3. **Accordions:** Morning/Evening collapsible sections with chevron rotation,
   step count in the collapsed header (e.g. "Morning · 4 steps"), initial
   state per time rule, empty-section state ("No steps for this morning" +
   inline add affordance).
4. **Drag-and-drop:** long-press lift with subtle scale/elevation feedback;
   reorder within a section persists `order` to `routinesStore` on drop.
   Cross-section dragging (AM→PM) is OUT of scope — moving between periods
   stays an edit-form concern.
5. **Bottom sheet:** wire the four actions. "Remove from routine" gets a
   lightweight confirm (Alert is fine). "Hide" is instant and reversible via
   the existing hidden-steps mechanism (verify it exists; if not, just set the
   flag and note the gap in PROGRESS.md).
6. **Tests:** accordion initial-state logic (pure function around the 15:00
   rule — extract it so it's unit-testable), reorder persistence
   (store-level), action-sheet action dispatch.

## Acceptance

- One scroll shows both periods; time rule only affects mount state.
- Long-press reorder works in both sections without gesture fights against
  the outer scroll (manual QA checkbox in PROGRESS.md for a real device).
- All four sheet actions work; removing from routine does not delete the
  product from the catalog.
- `npx tsc --noEmit` clean; tests green.
