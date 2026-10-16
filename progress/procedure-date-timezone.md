Status: PR_REVIEW
Tech Design: —
Code: fix/procedure-date-timezone

## Карточка задачи
- [x] Product requirements (planner) — n/a, bugfix from user report
- [x] Technical design (planner) — n/a
- [x] QA tests (qa-lead) — tests written red-first by engineer
- [x] Implementation (engineer)
- [x] Architecture review (tech-lead) — ACCEPT 2026-10-16

## Log
- 2026-10-16 Procedure-date "in the future" check compared UTC midnight with now; switched to string compare against `todayLocalIso()` (dateInput.ts).
- 2026-10-16 getSkincareDateString / getElapsedDays moved from UTC to local calendar (timeHelpers.ts). Persisted dates written before this fix were UTC-based: one-off ±1 day shift around the update, self-heals in 1-2 days, no migration.
- 2026-10-16 DEVIATION from docs/tech-design/shelf-filtering.md: computePaoStatus "today" is now the LOCAL calendar day (was `now.toISOString()` date). Design line updated.
- 2026-10-16 Tech-lead review follow-ups: clinic date-only strings now parsed as local midnight (`parseLocalDate`) in procedureLifespanHelpers, forecastTimelineHelpers, ProcedureLifespanCard; TZ-fragile test fixtures fixed (rehab-collapse, paused-rows, paoHelpers).
- Known: fixtures written as `...T12:00:00Z` in src/utils/routineEngine/rehabFilter.test.ts, tests/routine-engine/clinical-freeze|custom-procedure still fail only in UTC+12/+13 zones (Pacific/Auckland); dev is also red in those zones. Not addressed.
- Open (not in scope): RoutinesScreen.tsx:183 getSkincareDateString(selectedDate) keys today by yesterday between 00:00-03:59.
