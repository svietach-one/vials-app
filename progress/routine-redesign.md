Status: BLOCKED
Tech Design: docs/tech-design/routine-redesign.md
Code: —

## Task Card
- [x] Technical design (planner)
- [x] Implementation (engineer)
- [x] Architecture review (tech-lead)

## Log
2026-06-27 — Design created. Figma MCP rate-limited; design derived from
  user's written spec + full codebase audit. Four engineer tasks identified
  (FE-1 through FE-4). No QA tests required (UI-only, no new business-logic
  utilities). No store/type changes needed.

2026-06-27 — Implementation complete. Four deviations from tech design logged here:

  D-1 PlannerBlock uses two-layer View instead of `Card variant='raised'`.
  Reason: `Card` has `overflow:hidden` which clips iOS drop shadows. The
  outer-wrapper/inner-card pattern (shadow on outer View, overflow:hidden
  on inner View) is the standard RN fix. Visual result is identical to spec.

  D-2 Page title uses `typography.h1` (36px) instead of `typography.h2` (28px).
  Reason: user brief explicitly said "large page title"; h1 is more appropriate
  for a top-level screen title. h2 is used for section titles elsewhere.

  D-3 RoutineSection "done" badge changed from bottleGreen → cabernetTint/cabernet.
  Reason: user brief specified "Cabernet as primary accent color". Changing the
  completion badge to Cabernet makes the accent consistent across the whole screen.

  D-4 `initialPeriod` prop added to WeeklyPlanView (not listed in formal tasks).
  Reason: tech design narrative considered this ("or just let it default") and
  elected to include it for better UX — edit mode now opens on the same period
  the user was viewing in the planner block.

2026-07-02 — Tech-lead review (routine UX/interaction refactor, uncommitted changes).

BLOCKED — 1 new BLOCKER introduced by this diff.

BLOCKER: `BottomSheetView` used in step 2 of AddToRoutineSheet (lines 273, 289, 330,
337) but not imported from `@gorhom/bottom-sheet`. Produces 4 tsc TS2304 errors.
Fix: add `BottomSheetView` to the import on line 3-9 of AddToRoutineSheet.tsx.

Confirmed FIXED from prior review (Bugs 1–10):
  Bug 1 (WeeklySchedulePicker last-day deselect): guard at line 57.
  Bug 2 (dateLabel stale): dateLabel prop removed entirely per latest commit.
  Bug 3 (state not reset on close): useEffect at lines 101-112.
  Bug 5 (listHeader remount): useMemo at line 166.
  Bug 6 (cabernet in PlannerBlock): no cabernet references found.
  Bug 7 (cabernetTint in Button): no cabernet references found.
  Bug 8 (filterScroll margin coupling): marginHorizontal removed entirely.
  Bug 9 (hardcoded date default): dateLabel prop removed.

Still present (pre-existing):
  Bug 4 (CategoryKey vs CategoryFilter divergence): CategoryKey remains local-only;
    the local type is internally consistent and all values map to real ProductTypes —
    downgraded to WARNING, acceptable for Phase 1.
  Bug 10 (handleDragEnd OOB): guard at line 119 (`if (idx !== reorderedVisible.length) return`)
    is adequate for Phase 1 (no background sync).

Pre-existing test errors (ProductShelfCard.test.tsx — W1 from product-shelf-card task):
  3 TS errors existed before this diff; unrelated to the routines refactor.

New warnings (not blockers):
  W1: "Add product" footer button is visible and tappable in edit mode — pressing it
    silently discards the edit session. Minor UX gap, acceptable for now.
  W2: AddToRoutineSheet is ~280 lines for the main function body (JSX-heavy). Within
    React Native component norms but consider splitting step 1 and step 2 into
    sub-components in a follow-up.
  W3: handleSave silently no-ops if the morning/evening routine is missing from the
    store (possible if store hydration failed). No user-visible error shown.
    Low-risk in Phase 1 (defaults always seeded on first launch).

Architecture decision validated:
  Plain View (not BottomSheetView) for step-1 fixed header is the correct choice.
  BottomSheetFlatList needs to be a direct child of BottomSheetModal to hook into
  the gesture responder chain; any absolute-positioned sibling from BottomSheetView
  breaks the flex flow. The pattern used (View header + BottomSheetFlatList body) is
  the documented approach for fixed-header + scrollable-list layouts in @gorhom v5.

Security review: no concerns. All data is local-only (AsyncStorage). No external
  input surfaces beyond UI text fields. No dangerous interpolation patterns found.
