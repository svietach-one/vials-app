Status: IMPLEMENTED (QA tests and formal architecture review were never run — see log)
Tech Design: docs/tech-design/routine-management-ux.md
Code: src/screens/ProductDetailScreen.tsx, src/screens/ManualProductFormScreen.tsx, src/components/routine/RemoveRoutineActionSheet.tsx

## Task card
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [ ] QA tests (qa-lead)
- [x] Implementation (engineer)
- [ ] Architecture review (tech-lead)

## Log

2026-06-22: Spec and tech design authored by planner-agent. Status set to DESIGNED.
  Supersedes decouple-routine-from-form (task closed, scope absorbed here).
  Scope: remove Usage Time block from ManualProductFormScreen (FE-1);
  add Add / Edit / Remove routine footer to ProductDetailScreen (FE-2, FE-3);
  create RemoveRoutineActionSheet component (FE-4);
  verify CatalogScreen RoutineBadge reactivity (FE-5);
  style the footer (FE-6).
  No new store actions, no new AsyncStorage keys, no backend changes.

2026-07-02 — tech-designer audit against live code: confirmed implemented on
  `ProductDetailScreen` (Add/In-Routine/Remove footer, `RemoveRoutineActionSheet`
  multi-routine action sheet). Status corrected from DESIGNED to IMPLEMENTED —
  this file was never updated when the engineer task actually shipped. QA
  tests and a formal tech-lead architecture review were never recorded for
  this task; leaving those checklist items unchecked rather than backfilling
  them. One implementation delta from the design doc: `RemoveRoutineActionSheet`
  reads `routines` from the store directly instead of receiving it as a prop
  — see `docs/tech-design/routine-management-ux.md` §6.
