Status: PR_REVIEW
Tech Design: docs/tech-design/multi-action-radio-picker.md (FE-5 amended)
Code: src/components/routine/DraftPreviewScreen.tsx, src/components/routine/ReplaceStepSheet.tsx, src/domain/routinePlanActions.ts, src/screens/RoutinesScreen.tsx

## Карточка задачи
- [x] Product requirements (product owner request in chat)
- [x] Technical design (amendment to multi-action-radio-picker FE-5)
- [x] QA tests
- [x] Implementation
- [x] Architecture review (tech-lead)

## Log

2026-10-14 - intentional deviations from docs/specs/multi-action-radio-picker.md Story 3 and tech design FE-5, requested by the product owner:
- Footer heading "Save for" -> "Select an option"; radios relabelled "Save for Morning & Evening / Morning only / Evening only".
- New fourth radio "Reset all" (only when some routine has steps and onResetAll is passed). Confirm becomes the destructive variant and calls onResetAll; the draft closes and RoutinesScreen falls through to the Generate card empty state.
- resetAllRoutines() (src/domain/routinePlanActions.ts) sets steps: [] on every routine that has steps, including pinned and hidden steps. Shelf products, procedures, trackingStore (first-scheduled anchors, "Add anyway" overrides) and completion records survive. There is no undo; it takes three deliberate steps: select the radio, press Confirm, then confirm the "Reset all routines?" Alert (added after the tech-lead review, W1).
- Draft Preview StepCard and ReplaceStepSheet candidate cards restyled to mirror RoutineProductCard (edge-to-edge photo, brand row with the status trailing, name below); the struck-through previous name line was removed; sheet cards use a border instead of a shadow and carry Current / Recommended / Reserve badges instead of the reason line.
- Known gaps from the tech-lead review, left as follow-ups: "keep current" candidate now reads Reserve (W3), RoutinesScreen.handleResetAll has no screen-level test (W6).

2026-10-14 - tech-lead review of HEAD a4143cd: BLOCKED on traceability only (B1: deviation from multi-action-radio-picker spec/tech design had no log). Fixed in aaa8f67 and 93c47e6 (log, doc amendments, Alert on Reset all, brand-less alignment, hitSlop, Android keyboard behavior).
2026-10-14 - tech-lead re-review of HEAD 93c47e6: ACCEPT. B1 resolved (log verified claim-by-claim against the code). tsc 0 errors; targeted 14 suites / 142 tests pass; full jest 9 failed suites / 61 failed tests = baseline, A/B vs origin/dev shows no new failures. Open follow-ups: W3 (keep-current candidate reads Reserve), W6 (no RoutinesScreen-level test for handleResetAll), W7 (function length), nits N-1..N-10 (hitSlop target size, test spy restore, stale comments, metabolism follow-ups not logged in progress/metabolism-feedback-loop.md).
