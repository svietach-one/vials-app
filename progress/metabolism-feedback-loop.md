Status: IN_PROGRESS
Tech Design: docs/tech-design/metabolism-feedback-loop.md
Code:
- src/types/index.ts (CalibrationEntry, individualDurationMonths shape, UserProcedureLog.expectedMonths)
- src/utils/metabolismCalibration.ts (+ .test.ts)
- src/utils/procedureLifespanHelpers.ts (+ .test.ts)
- src/utils/routineEngine/migrations.ts (+ .test.ts) - schema v8
- src/domain/procedureActions.ts
- src/components/clinic/ProcedureDurationFeedbackModal.tsx, CalibrationCard.tsx, ProcedureLifespanCard.tsx
- src/screens/ClinicScreen.tsx, ProcedureDetailScreen.tsx
- docs/USER_STORIES.md, docs/SCREENS.md
- tests touched: tests/routine-engine/rehab-widget-ui.test.tsx, tests/vials-onboarding-quizzes/profileStore.sensitive-migration.test.ts, tests/metabolism-feedback-loop/ProcedureDetailScreen.calibration.test.tsx

## Карточка задачи
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [x] QA tests (qa-lead)
- [x] Implementation (engineer)
- [ ] Architecture review (tech-lead)

## Log

2026-10-14 — planner: branch feature/metabolism-feedback-loop from origin/dev (aa2b862). Re-verified:
`individualDurationMonths` is only the `{}` default + fixtures (never written/read); no `sampleCount`;
`realDuration` stamped only in ProcedureLifespanCard "Mostly faded" (flag CLINIC_FADING_PROMPT_ENABLED=false);
"Move to history" = `updateProcedure(id,{status:'archived'})` in ClinicScreen; the US-17 "Edit Estimated
Lifespan" slider does not exist. Found US-17 formula defect (sampleCount=0 gives 3.0, example needs 3.5);
design uses default-as-one-prior-sample. Baseline on origin/dev: tsc clean; jest 12 failed / 227 passed
suites, 79 failed / 2701 passed tests (stale mocks, not ours). STOPPED for human approval — no code written.

2026-10-14 — human approved Option A and all proposed defaults (formula, bounds 0.5-60, Skip default, rehab prompt, FE-9). Handing off to qa-lead.

2026-10-14 — qa-lead: wrote 5 integration/component suites + fixtures under tests/metabolism-feedback-loop/
(procedureActions.test.ts, ProcedureDurationFeedbackModal.test.tsx, CalibrationCard.test.tsx,
ClinicScreen.archive.test.tsx, ProcedureDetailScreen.calibration.test.tsx). They fail until the engineer
ships CalibrationEntry/expectedMonths, src/domain/procedureActions.ts and the two clinic components (tsc errors
in tests/ are the expected "missing contract" ones). Binding contracts not fixed by the tech design were defined
in fixtures.ts: modal props { proc|null, onConfirm(number|null), onCancel }, CalibrationCard props
{ procedureKey, entry?, onReset }, and the TID testID set. Spec stories 1-4 covered; unit tests (src/utils) left to engineer.

2026-10-14 - engineer: FE-1..FE-10 implemented; human approved the plan and the legacy-number migration (`samples: 1`).
Gates: `npx tsc --noEmit` clean; all 5 QA suites + new unit tests green; full jest (ignoring worktrees) = 12 failed /
233 passed suites, 79 failed tests - the same 12 pre-existing suites as the origin/dev baseline, nothing new.
CLINIC_FADING_PROMPT_ENABLED untouched (OFF).
Deviations / decisions (all intentional):
- tests/metabolism-feedback-loop/ProcedureDetailScreen.calibration.test.tsx: QA test called the Alert 'Reset' callback
  outside act(), so the store-driven re-render (React 19, concurrent root) is never flushed before the sync assertion; no
  implementation can satisfy that. Wrapped that single call in `act()`. Contract unchanged.
- Schema v8 bump invalidated two version asserts: migrations.test.ts `toBe(7)` -> 8 (planned in FE-4) and
  tests/vials-onboarding-quizzes/profileStore.sensitive-migration.test.ts `toBe(7)` -> `toBeGreaterThanOrEqual(7)`.
- FE-9: `onReportDuration` is a REQUIRED prop on ProcedureLifespanCard, so tests/routine-engine/rehab-widget-ui.test.tsx
  passes `jest.fn()`. The flag-OFF prompt now calls it (no direct realDuration stamp) and uses parseReportedMonthsText
  (decimal-pad, 0.5-60) instead of parseInt.
- Added `parseReportedMonthsText` to metabolismCalibration.ts (not in the design's list) so the modal/prompt parse logic stays
  in a pure, unit-tested util instead of the component.
- ProcedureDurationFeedbackModal does NOT wrap RadioConfirmModal: that chrome has no slot for the month Input, no Confirm
  disabled state and no testIDs, all required by the QA contract. It reuses RadioOptionGroup + the same backdrop/sheet styles.
- migrateProfile was already > 50 lines (pre-existing); the v8 coercion is a separate exported `migrateIndividualDurations`.
- ClinicScreen opens the feedback modal synchronously from ProcedureActionSheet.onClose (required by the QA test, which
  asserts the modal right after the sheet callbacks). RISK for tech-lead/device QA: on iOS, presenting one RN Modal while
  the sheet Modal is dismissing can fail to show; if seen, defer via the sheet's Modal onDismiss (iOS) in a follow-up.

2026-10-14 - engineer: tech-lead F-1 (MAJOR) fixed with human approval. ProcedureLifespanCard time labels printed raw floats
once calibration made lifespans fractional (e.g. "Month 1 of 3.3333333333333335"). Added pure `formatMonthsCompact`
(one decimal, integers unchanged) to src/utils/metabolismCalibration.ts (+ unit tests) and applied it to the active
("of N"), completed ("Full N-month cycle") and history ("Lasted ~N months") labels. Regression suite:
tests/metabolism-feedback-loop/ProcedureLifespanCard.labels.test.tsx (fake system time; 5 -> "3.3", default stays "4").
Doc drift: docs/specs/metabolism-feedback-loop.md section 6 legacy migration now says `samples: 1` (matches the code and
the approval). No other tech-lead findings addressed in this pass.
