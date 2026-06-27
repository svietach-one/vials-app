Status: SUPERSEDED
Tech Design: docs/tech-design/decouple-routine-from-form.md
Code: —

## Task card
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [x] QA tests (qa-lead)
- [ ] Implementation (engineer)
- [ ] Architecture review (tech-lead)

## Log
2026-06-22: Spec and tech design authored by planner-agent. Status set to DESIGNED.
  Scope: remove RoutineTargetPicker sub-component, useRoutineLinking hook, routineTarget
  state, and ROUTINE_TARGET_OPTIONS from ManualProductFormScreen. Post-save navigation
  changes from navigate('Catalog') to replace('ProductDetail', { productId }).
  Delete src/hooks/useRoutineLinking.ts. Replace emoji in INCI banners with Feather icons.
  4 FE tasks for engineer; no new store changes; no new files.

2026-06-22: QA tests written by qa-lead. Status updated to IN_PROGRESS.
  Test file: tests/catalog/hide-product.test.tsx (17 tests across 4 Stories).
  All acceptance criteria from spec are covered via AddProductModal integration tests.
  Stories 1-3 drive onSave callback assertions; Story 4 asserts Feather icon presence
  and absence of emoji characters in INCI notice banners.

2026-06-22: SUPERSEDED by routine-management-ux. The cleanup scope (Usage Time
  removal) is absorbed into routine-management-ux FE-1. This task is closed.
  Do not implement this task independently.
