Status: REVIEWED
Tech Design: docs/tech-design/routine-redesign.md
Code: —

## Task Card
- [x] Technical design (planner)
- [ ] Implementation (engineer)
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
