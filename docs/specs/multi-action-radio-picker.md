# Vials — Multi-Action Radio Picker
Date: 2026-10-13
Author: planner-agent
Jira: N/A (kebab-case task slug per agent-layer-protocol.md: `multi-action-radio-picker`)
Status: DRAFT

## AI-SDLC Flags
```
backend_layer:  false
frontend_layer: true
infra_changes:  false
```

## 1. Problem Statement

Several modals and sheets in Vials ask the user to resolve one pending decision by choosing among
3 or more named, mutually-exclusive outcomes, and render that choice as a stack of equal-weight
full-width `<Button>` components — one button per outcome, each labeled with the outcome itself
(e.g. "Remove from Mondays", "Save for Morning & Evening"). Because the labels must stay
self-explanatory and the app allows arbitrarily long product/day names, these labels routinely run
longer than a single-line button can hold. Three separate commits in this repository's recent
history (`ed81351` "Fix truncated Replace button in the duplicate-slot choice sheet", `8938d69`
"Fix truncated 'Keep only [winner]' button label...", `a79c63b` "Fix Change button overflowing
Draft Preview step cards") each patched one button's text or layout individually — the underlying
shape (N long-labeled buttons stacked as equally-weighted CTAs) is unchanged and will keep
producing the same class of bug on the next long name. These same buttons also collapse "which
outcome" and "commit it" into a single tap: every button is simultaneously the selector and the
trigger, so one mis-tap both picks and immediately executes a choice, with no separate
confirmation step.

## 2. Goals

- Replace every identified 3+-option mutually-exclusive button cluster (see §5 for the definitive,
  audited list) with a two-step control: an always-visible radio list of short labels, followed by
  exactly two buttons, **Confirm** and **Cancel**.
- Guarantee the two footer buttons can never reproduce the label-truncation bug class: their text
  is the fixed, short strings "Confirm" and "Cancel" regardless of which outcome is being chosen.
- Centralize the radio-list-plus-Confirm/Cancel UI in one reusable pair of components (tech design
  §1) so a future 3+-way choice reuses it instead of adding a fourth or fifth bespoke button stack.
- Preserve every converted component's existing external callback contract (prop names and
  signatures) so call sites outside the converted file need no changes.

## 3. Non-Goals (explicitly out of scope)

- **Binary (exactly 2-option) dialogs** stay exactly as they are today — e.g. `DeleteProductModal`
  (Cancel/Remove), `GoalConfirmBanner`/`PhototypeConfirmBanner` (Confirm/Adjust), `FilterSheet`
  (Clear all/Apply), `RoutineSchedulerSheet`'s Cancel/Save pair, `DraftPreviewScreen`'s
  cycle-split-rival prompt (Alternate automatically/Keep just this one — the literal site of the
  `8938d69` truncation fix cited above, but a 2-option dialog, so out of scope under this rule).
- **Heterogeneous action-sheet / overflow menus** that list several *unrelated* operations on one
  object — `ProductActionSheet`, `ProcedureActionSheet`, `RoutineStepActionSheet`,
  `AddProductOptionsList` — are unchanged. These are not N resolutions of one question (they mix
  navigation, archiving, hiding, deleting); their `ListRow` labels are short, fixed English phrases
  with no truncation history; and each row already commits immediately on tap, which remains the
  correct, expected "overflow menu" interaction. Forcing a Confirm step onto "View details" or
  "Edit" would be a regression, not a fix.
- **Variable-length, data-driven candidate/search lists**, where the "options" are data (product
  names, OCR match results) rather than a small fixed set of named actions — `ReplaceStepSheet`,
  `DuplicateSlotResolutionSheet`'s per-row remove list, `CaptureFlowScreen`'s match-results list —
  are unchanged. These already use single-tap-commit, `accessibilityRole="radio"` rows (established
  house pattern, also used by `Select`, `QuizSheet`, and onboarding's Fitzpatrick picker) and are
  intentionally lighter-weight; adding a forced second Confirm tap would be a regression.
- **Native OS dialogs** built on `Alert.alert` / `ActionSheetIOS` — `RemoveRoutineActionSheet`, and
  the "Take Photo / Choose from Gallery [/ Remove Photo] / Cancel" choosers duplicated inside
  `ManualProductFormScreen`, `CameraCaptureModal`, and `OcrScannerSheet` — stay native and are
  **not** converted, by explicit product decision (2026-10-13): keeping the native OS feel outweighs
  cross-surface consistency here, and none of the four has a truncation history (the OS lays out its
  own button text). This is a final decision, not deferred pending further input.
- No change to any store, persisted data shape, navigation structure, or the public callback
  signatures the three converted components already expose to their callers.
  *(Exception, 2026-10-14: `DraftPreviewScreen` gained an optional `onResetAll` prop and the "Reset all" option clears persisted routine steps through `resetAllRoutines()` after a final confirmation Alert — see progress/draft-preview-reset-and-card-layout.md.)*

## 4. User Stories

### Story 1: Resolving a duplicate routine slot (`DuplicateSlotChoiceSheet`)
As a user adding a product that duplicates an existing routine slot, I want to pick "Replace" or
"Keep both" from a short radio list and confirm explicitly, so I can read the full option before
committing and never trigger the wrong one with a single tap.

**Acceptance Criteria:**
- [ ] Given the sheet opens for an existing/incoming product pair, when it first renders, then
  exactly two radio options are visible ("Replace", "Keep both"), "Replace" is pre-selected, and
  exactly two buttons — Confirm, Cancel — render below the list.
- [ ] Given the user taps "Keep both" then taps Confirm, then `onKeepBoth` fires and `onReplace`
  does not fire.
- [ ] Given the user taps Confirm without changing the default selection, then `onReplace` fires.
- [ ] Given the user taps Cancel, then `onCancel` fires and neither `onReplace` nor `onKeepBoth`
  fires.
- [ ] Given the user taps a radio option, when no Confirm tap has happened yet, then only that
  option shows selected and no callback has fired.

### Story 2: Choosing removal scope for a routine step (`RemoveStepModal`)
As a user removing a product from one day of a routine, I want to pick "{day}s only" or "All days"
from a radio list and confirm explicitly, so a long weekday name never crowds out or hides the
other option.

**Acceptance Criteria:**
- [ ] Given the modal opens while viewing a Monday, when it renders, then the radio options read
  "Mondays only" and "All days", "Mondays only" is pre-selected, and Confirm/Cancel render below.
- [ ] Given the user selects "All days" then taps Confirm, then `onRemoveAll` fires and
  `onRemoveDay` does not fire.
- [ ] Given the user taps Cancel, then `onCancel` fires and no removal callback fires.

### Story 3: Choosing which periods to save a routine draft to (`DraftPreviewScreen`)

> **Amended 2026-10-14** (progress/draft-preview-reset-and-card-layout.md): the heading is now
> "Select an option", the three radios read "Save for Morning & Evening / Morning only / Evening
> only", and a fourth "Reset all" radio is shown when any routine has steps (Confirm turns into the
> destructive variant and calls `onResetAll` instead of `onCommit`). The acceptance criteria below
> describe the original three-option behaviour; label text and the option count are superseded.
> Choosing "Reset all" and pressing Confirm opens a final "Reset all routines?" Alert before
> `onResetAll` fires.

As a user finishing a generated routine draft, I want to pick "Morning & Evening", "Morning Only",
or "Evening Only" from a radio list and confirm explicitly, so the three long "Save for…" labels
stop being stacked as three separate full-width buttons.

**Acceptance Criteria:**
- [ ] Given the draft preview is open, when it renders, then three radio options are visible
  ("Morning & Evening", "Morning Only", "Evening Only"), "Morning & Evening" is pre-selected, and
  Confirm/Cancel render below the radio list.
- [ ] Given the user selects "Evening Only" then taps Confirm, then `onCommit('pm')` fires.
- [ ] Given the user taps Confirm without changing the default, then `onCommit('both')` fires.
- [ ] Given the user taps Cancel, then `onClose` fires and `onCommit` never fires (same behavior as
  today's "Cancel / Discard Draft").

## 5. UX / Behaviour

All three sites share one shape: a title/body (unchanged, owned by the call site) explaining the
decision, then an always-expanded, never-collapsing radio list (no option is hidden behind a
dropdown/trigger), then a two-button row, Cancel (`variant="secondary"`) and Confirm
(`variant="primary"`). Tapping a radio option only moves the selection — it never fires a callback.
Confirm is always enabled: every site always has exactly one option pre-selected (the option that
was previously the visually-primary button, or the narrowest/least-destructive option where none
was — tech design §4), so there is no "nothing selected" state to design an error/disabled path
for. There is no loading or empty state: all three option lists are small, fixed, and known
synchronously at render time.

**Full audited list of UI locations inspected for this task:**

| Location | Outcome |
|---|---|
| `src/components/routine/DuplicateSlotChoiceSheet.tsx` | **Convert** — 3 buttons (Replace/Keep both/Cancel) |
| `src/components/routine/RemoveStepModal.tsx` | **Convert** — 3 buttons (Remove day/Remove all/Cancel) |
| `src/components/routine/DraftPreviewScreen.tsx` (bottom commit footer — not the per-step "Change" affordance) | **Convert** — 4 buttons (both/am/pm/Cancel) |
| `src/components/routine/RemoveRoutineActionSheet.tsx` | Found, deferred — native `Alert`/`ActionSheetIOS`, see Open Questions |
| `src/screens/ManualProductFormScreen.tsx` (`handlePhotoPress`) | Found, deferred — native `Alert`, see Open Questions |
| `src/components/camera/CameraCaptureModal.tsx` (photo-source chooser) | Found, deferred — native `Alert`, see Open Questions |
| `src/components/product/OcrScannerSheet.tsx` (photo-source chooser) | Found, deferred — native `Alert`, see Open Questions |
| `src/components/product/ProductActionSheet.tsx`, `clinic/ProcedureActionSheet.tsx`, `routine/RoutineStepActionSheet.tsx`, `addProduct/AddProductOptionsList.tsx` | Excluded — heterogeneous `ListRow` menus, §3 |
| `src/components/routine/ReplaceStepSheet.tsx`, `routine/DuplicateSlotResolutionSheet.tsx`, `catalog/CaptureFlowScreen.tsx` match list | Excluded — data-driven candidate lists, §3 |
| `src/components/routine/DuplicateSlotWarningInline.tsx`, `routine/RoutineProductCard.tsx`, `ui/feedback/InlineAlert.tsx` | Inspected directly (named starting points) — not cluster sites; no change |
| `DeleteProductModal`, `WishlistEntryDetailScreen` footer, `GoalConfirmBanner`, `PhototypeConfirmBanner`, `ContributionConsentModal`, `GrowDatabasePromptModal`, `FilterSheet`, `RoutineSchedulerSheet`, `SkinProfileEditModal`, `AddToRoutineSheet`, `LabelLinePicker`, `ExploreCompositionResultScreen`, `BarcodeScannerScreen`, `EmptyState` (capped at 2 actions by its own prop contract) | Excluded — binary (exactly 2 options), §3 |

## 6. Data Requirements

- New data needed: none. No new persisted fields.
- Existing data consumed: `PlanCommitScope` (`'both' | 'am' | 'pm'`, `src/domain/routinePlanActions.ts`) — reused unchanged as the value type for Story 3's radio options.
- Data retention: N/A — purely transient UI selection state, local to each component.

## 7. Dependencies

- Depends on spec: none.
- Blocks: none.
- External services: none.

## 8. Security & Privacy

- Authentication required: no.
- Data sensitivity: none — no new data is read, written, or displayed. *(2026-10-14: the "Reset all" option deletes saved routine steps after a final confirmation Alert; nothing new is stored.)*
- Compliance considerations: none.

## 9. Success Metrics

- Zero new "truncated/overflowing button" bug reports against the three converted surfaces after
  ship.
- All three converted components import and render the new shared `RadioOptionGroup`/
  `RadioConfirmModal` pair (tech design §1) rather than a bespoke per-file `<Button>` stack —
  verifiable by import grep at tech-lead review.
- The existing test assertions that queried the old per-action button labels directly (e.g.
  `tests/routine-engine/draft-preview-sheet.test.tsx`,
  `tests/routine-similar-product-priority/duplicate-slot-choice-sheet.test.tsx`) are replaced with
  assertions against the new radio+Confirm/Cancel contract, with zero loss of the behavior they
  verified (which callback fires for which user choice).

## 10. Open Questions

No open questions. (Resolved 2026-10-13: the native `Alert.alert`/`ActionSheetIOS` choosers —
`RemoveRoutineActionSheet.tsx`, and the photo-source choosers in `ManualProductFormScreen.tsx`,
`CameraCaptureModal.tsx`, `OcrScannerSheet.tsx` — stay native; see §3 Non-Goals.)
