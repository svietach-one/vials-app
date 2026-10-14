Status: PR_REVIEW
Tech Design: docs/tech-design/multi-action-radio-picker.md (FE-5 amended)
Code: src/components/routine/DraftPreviewScreen.tsx, src/components/routine/ReplaceStepSheet.tsx, src/domain/routinePlanActions.ts, src/screens/RoutinesScreen.tsx

## Карточка задачи
- [x] Product requirements (product owner request in chat)
- [x] Technical design (amendment to multi-action-radio-picker FE-5)
- [x] QA tests
- [x] Implementation
- [ ] Architecture review (tech-lead: BLOCKED on traceability only, fixed here; re-review pending)

## Log

2026-10-14 - intentional deviations from docs/specs/multi-action-radio-picker.md Story 3 and tech design FE-5, requested by the product owner:
- Footer heading "Save for" -> "Select an option"; radios relabelled "Save for Morning & Evening / Morning only / Evening only".
- New fourth radio "Reset all" (only when some routine has steps and onResetAll is passed). Confirm becomes the destructive variant and calls onResetAll; the draft closes and RoutinesScreen falls through to the Generate card empty state.
- resetAllRoutines() (src/domain/routinePlanActions.ts) sets steps: [] on every routine that has steps, including pinned and hidden steps. Shelf products, procedures, trackingStore (first-scheduled anchors, "Add anyway" overrides) and completion records survive. There is no undo; it is two deliberate steps (select the radio, press Confirm).
- Draft Preview StepCard and ReplaceStepSheet candidate cards restyled to mirror RoutineProductCard (edge-to-edge photo, brand row with the status trailing, name below); the struck-through previous name line was removed; sheet cards use a border instead of a shadow and carry Current / Recommended / Reserve badges instead of the reason line.
- Known gaps from the tech-lead review, left as follow-ups: no Alert confirmation on Reset all (W1), "keep current" candidate now reads Reserve (W3), RoutinesScreen.handleResetAll has no screen-level test (W6).
