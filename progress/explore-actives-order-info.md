Status: DESIGNED
Tech Design: docs/tech-design/explore-actives-order-info.md
Code: —

## Карточка задачи
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [ ] QA tests (qa-lead)
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
