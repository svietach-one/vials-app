Status: IN_PROGRESS
Tech Design: docs/tech-design/metabolism-feedback-loop.md
Code: —

## Карточка задачи
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [x] QA tests (qa-lead)
- [ ] Implementation (engineer)
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
