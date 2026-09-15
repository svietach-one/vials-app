Status: IN_PROGRESS
Tech Design: docs/tech-design/explore-actives-order-info.md
Code: —

## Карточка задачи
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [x] QA tests (qa-lead)
- [ ] Implementation (engineer)
- [ ] Architecture review (tech-lead)

## Log

- 2026-09-14 (planner): Drafted spec + tech design. Scope: static info icon + tap-tooltip on
  `DetectedActivesCard` explaining the INCI-ordering convention and the 1% line — both already
  render on that card as of the prior `explore-insights-v2` batch (tasks 01–03, git
  `47ad52c`/`1235824`/`1fbd528`/`1694419`), which the original task brief had not accounted for.
  Corrected framing (confirmed by product): the tooltip explains data already on screen, not a
  substitute for missing data. No new ingredient-position plumbing; reuses
  `AttributionTooltip.tsx`'s visual shell via a new `src/components/ui/InfoTooltip.tsx`. Copy is
  `PLACEHOLDER`, pending design review (spec §10). Branch: `feature/explore-personalization`
  (from `origin/dev`), shared with the concurrent `explore-fit-signals` task — no file overlap
  (this task touches only `DetectedActivesCard.tsx` + the new `InfoTooltip.tsx`).

- 2026-09-15 (qa-lead): Wrote component/integration tests, test-first, ahead of FE-1/FE-2
  implementation. New: `tests/explore-composition/InfoTooltip.test.tsx` (standalone shell test for
  the not-yet-built `src/components/ui/InfoTooltip.tsx` — visibility, arbitrary title/body props,
  close-button + backdrop dismiss). Extended `tests/explore-composition/DetectedActivesCard.test.tsx`
  with an "info tooltip trigger" block (icon always renders incl. empty-state, opens tooltip with
  the current placeholder copy asserted via meaningful substrings only, closes via close control or
  backdrop) — all pre-existing assertions in that file left untouched. Added a small regression
  block to both `ExploreCompositionResultScreen.test.tsx` and `WishlistEntryDetailScreen.test.tsx`
  confirming the same tooltip is reachable unchanged on both screens (spec Story 1 AC5) — queried by
  accessibilityLabel there since those files' existing `IconButton` mock strips `testID`. Verified:
  `npx tsc --noEmit` shows only the expected `Cannot find module '@/components/ui/InfoTooltip'`
  error (component doesn't exist yet); `npx jest` on all four files shows only the new/extended
  tests failing (10 total: 6 in DetectedActivesCard.test.tsx + InfoTooltip.test.tsx's own suite
  failing to resolve, 2+2 regression), all pre-existing tests in the two screen files (75) and the
  pre-existing DetectedActivesCard assertions (18) still pass — no regressions introduced. No unit
  tests written (no new pure logic; `resolve.ts`/`onePercentLine.ts` untouched per tech design).
  Noted in passing (not this task's concern): `git status` shows unrelated in-flight changes to
  `SkinTypeCautionNotice.test.tsx`/`fixtures.ts`/new `GoalFitCard.test.tsx` — from the concurrent
  `explore-fit-signals` task sharing this branch, left untouched.
