Status: IN_PROGRESS
Tech Design: docs/tech-design/explore-actives-order-info.md
Code: src/components/ui/InfoTooltip.tsx (new), src/components/catalog/DetectedActivesCard.tsx (modified)

## Карточка задачи
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [x] QA tests (qa-lead)
- [x] Implementation (engineer)
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

- 2026-09-15 (engineer): Implemented FE-1/FE-2 per tech design; FE-3 confirmed no-op as designed.
  New `src/components/ui/InfoTooltip.tsx` — visual shell copied verbatim from
  `AttributionTooltip.tsx` (backdrop `Pressable` + slide-up card + header + close `IconButton`,
  same tokens), dropping the `matches`/`getAliasMicroCopy` per-match logic for a single static
  `body` `Text`; testIDs `info-tooltip` / `info-tooltip-backdrop` / `info-tooltip-close` match the
  qa-lead's test contract exactly. Modified `src/components/catalog/DetectedActivesCard.tsx`:
  added local `useState` boolean, an always-rendered `IconButton` (`testID=
  detected-actives-info-icon`, `label="What ingredient order means"`, `Icon name="info"
  color={colors.statusInfo}`) placed after the title `Text` inside a new `cardTitleRow` wrapper
  (added to satisfy header layout — title + icon side by side — no existing style renamed or
  removed), and a sibling `<InfoTooltip>` rendered at the end of the component. Copy constants
  (`ACTIVES_ORDER_INFO_TITLE`/`ACTIVES_ORDER_INFO_BODY`) inlined as local constants in
  `DetectedActivesCard.tsx` per tech design §4's assumption (not `labels.ts`), body text is spec
  §5's placeholder copy verbatim, still marked `PLACEHOLDER — pending design review` in a code
  comment. No changes to `resolve.ts`/`ingredientParser.ts`/`onePercentLine.ts`, no per-row detail
  sheet, no existing `DetectedActivesCard` copy strings reworded.
  Verification: `npx tsc --noEmit` shows zero errors in any file this task touches or in the four
  qa-lead test files (`InfoTooltip.test.tsx`, `DetectedActivesCard.test.tsx`,
  `ExploreCompositionResultScreen.test.tsx`, `WishlistEntryDetailScreen.test.tsx`); the only
  remaining `tsc` errors are pre-existing, from the concurrent `explore-fit-signals` engineer
  session's in-flight/untracked files (`GoalFitCard.tsx`, `goalFit.ts`, `conditionCaution.ts`,
  `SkinTypeCautionNotice.test.tsx`). `npx jest` on the four target files: `InfoTooltip.test.tsx`
  11/11 pass; `DetectedActivesCard.test.tsx` 24/24 pass (18 pre-existing + 6 new tooltip-trigger
  tests, none of the pre-existing assertions touched); both screen files' own
  "explore-actives-order-info regression" blocks (2 tests each, 4 total) pass. The full run of the
  two screen files shows 13 additional failures — all under `Story 1: Goal-fit card`, `Story 2:
  condition-aware caution`, and `Result-screen order` describe blocks, which belong to the
  concurrent `explore-fit-signals` task's still-in-progress code (`GoalFitCard.tsx`/`goalFit.ts`/
  `conditionCaution.ts` are untracked/incomplete on this shared branch) — out of this task's scope,
  confirmed by `git status --short` and by the failing describe-block names matching that other
  task's spec, not this one's. No qa-lead test files edited. No co-located unit test added for
  `InfoTooltip.tsx` — per `.claude/rules/testing.md`, co-located `src/**/*.test.ts` unit tests are
  for pure business logic in `src/utils/`, not components; `InfoTooltip` has no business logic
  (pure presentational shell) and is already fully covered by the qa-lead's
  `tests/explore-composition/InfoTooltip.test.tsx`, so an additional co-located test would be
  redundant duplication of the same assertions.
