# Technical Design: Multi-Action Radio Picker
Spec: docs/specs/multi-action-radio-picker.md
Author: planner-agent
Date: 2026-10-13

## AI-SDLC Flags
```
backend_layer:  false
frontend_layer: true
infra_changes:  false
```

## 1. Architecture Overview

Three existing sites (`DuplicateSlotChoiceSheet`, `RemoveStepModal`, `DraftPreviewScreen`'s
commit-scope footer) each render 3-4 sibling `<Button>` components where a single tap both
identifies and immediately commits one of N mutually-exclusive outcomes — the shape that keeps
truncating/overflowing on long labels (spec §1). This design splits "pick one of N" from "commit
it" into two new shared, presentational components:

- `RadioOptionGroup` (`ui/forms`) — the N options, rendered as always-visible radio rows. Pure
  controlled component: `{ options, value, onChange }`. No Modal, no footer, no business logic.
- `RadioConfirmModal` (`ui/core`) — `Modal` + backdrop + title/body slot + `RadioOptionGroup` +
  a fixed Confirm/Cancel footer. Owns the selected-value state (seeded from `defaultValue`,
  reset whenever `visible` turns true).

`DuplicateSlotChoiceSheet` and `RemoveStepModal` adopt `RadioConfirmModal` wholesale (both already
use a centered plain-`Modal` dialog, matching its chrome exactly). `DraftPreviewScreen` is already
presented as its own `BottomSheetModal` — its footer uses `RadioOptionGroup` directly plus a local
Confirm/Cancel `<Button>` pair, with no new Modal nesting (nesting a second gorhom sheet inside the
first is the exact stacking hazard `ReplaceStepSheet`'s own doc comment already warns about).

```
Caller (3 sites) --title/body (unchanged)--> RadioOptionGroup --selected--> local state
                                                     |
                                      Cancel <-------+-------> Confirm
                                        |                         |
                               caller's existing            caller's existing
                                onCancel/onClose          per-option callback(selected)
```

No store, API, data-model, or navigation changes. Every converted component keeps its existing
external prop contract — `AddToRoutineSheet.tsx` (the real render site of
`DuplicateSlotChoiceSheet`) and `RoutinesScreen.tsx` (render site of `RemoveStepModal`) need no
changes at all; only the JSX between "question shown" and "callback fired" changes inside the
three converted files themselves.

## 2. API Contracts

N/A — local-only Expo/RN app (AsyncStorage + Zustand), no backend/API layer (CLAUDE.md). The
nearest equivalent is the two new components' prop shapes:

- `RadioOptionGroup<T extends string>`: `{ options: { value: T; label: string; sublabel?: string }[]; value: T; onChange: (v: T) => void; testID?: string }`.
- `RadioConfirmModal<T extends string>`: `{ visible: boolean; title: string; body?: ReactNode; options: RadioOption<T>[]; defaultValue: T; onConfirm: (v: T) => void; onCancel: () => void; testID?: string }`.

## 3. Implementation Tasks

### engineer (scope=frontend)
- FE-1: New `RadioOptionGroup` — circular radio rows (unselected: `colors.borderStrong` 1.5px
  ring; selected: `palette.plum` ring + filled dot), `accessibilityRole="radio"` +
  `accessibilityState={{checked}}` per row (matching the existing house convention already used by
  `Select.tsx`, `ReplaceStepSheet`'s `OptionRow`, `QuizSheet`'s `QuizAnswerChip`), outer container
  gets `accessibilityRole="radiogroup"` (existing lone precedent: `PhototypeStep.tsx`). Label text
  `typography.body` (16px), sublabel `typography.bodySmall` (14px) — both above the 14px floor.
  Tokens only, no hardcoded colors. Files: `src/components/ui/forms/RadioOptionGroup.tsx`.
- FE-2: New `RadioConfirmModal`, built on plain RN `Modal` (`transparent`, `animationType="fade"`,
  backdrop `Pressable` + centered `sheet` View) — byte-identical chrome to
  `DuplicateSlotChoiceSheet`'s current `styles.backdrop`/`styles.sheet` (`radius.xl`, `shadow.lg`,
  `space[6]` padding). Renders `title` (`typography.h3`) + optional `body` + `RadioOptionGroup` +
  action row: Cancel (`variant="secondary"`, fixed label "Cancel") then Confirm
  (`variant="primary"`, fixed label "Confirm", `onPress={() => onConfirm(selected)}`). Files:
  `src/components/ui/core/RadioConfirmModal.tsx`.
- FE-3: Convert `DuplicateSlotChoiceSheet` to render `RadioConfirmModal` internally. Options:
  `{value:'replace', label:'Replace'}`, `{value:'keep_both', label:'Keep both'}`; `defaultValue:
  'replace'` (previously the `variant="primary"` button). Confirm dispatches to `onReplace`/
  `onKeepBoth`; Cancel calls `onCancel`. External props (`visible`, `slotLabel`, `existingProduct`,
  `incomingProduct`, `onReplace`, `onKeepBoth`, `onCancel`) unchanged. Files:
  `src/components/routine/DuplicateSlotChoiceSheet.tsx`.
- FE-4: Convert `RemoveStepModal` the same way. Options: `{value:'day', label:'${dayPlural} only'}`,
  `{value:'all', label:'All days'}`; `defaultValue: 'day'` (no button was previously primary here —
  defaults to the narrower, less-destructive scope per tech design Assumption 3). External props
  unchanged. Files: `src/components/routine/RemoveStepModal.tsx`.
- FE-5 (amended 2026-10-14, see progress/draft-preview-reset-and-card-layout.md: heading "Select an option", labels "Save for …", optional fourth "Reset all" radio + `onResetAll`): Convert `DraftPreviewScreen`'s bottom `styles.actions` block (the 4-button commit-scope
  footer — not the per-step "Change" affordance, which is untouched) to a short "Save for" label +
  `RadioOptionGroup<PlanCommitScope>` (`both`/`am`/`pm`, labels "Morning & Evening"/"Morning Only"/
  "Evening Only", `defaultValue: 'both'`) + a local Confirm/Cancel `<Button>` pair. Confirm calls
  `onCommit(selected)`; Cancel calls `onClose` (same as today's "Cancel / Discard Draft"). `onCommit`
  signature unchanged. Files: `src/components/routine/DraftPreviewScreen.tsx`.

### engineer (unit tests, scope=frontend)
- Each FE task above includes updating/adding tests for the code it changes. FE-1/FE-2 are pure
  presentational components with no business logic to unit-test per `testing.md`'s co-located-unit
  definition (no `src/utils` logic is introduced) — their behavioral coverage is qa-lead's
  component-test responsibility. FE-3/FE-4/FE-5 must not break `typecheck`; qa-lead owns rewriting
  the now-invalid assertions in `tests/routine-similar-product-priority/duplicate-slot-choice-sheet.test.tsx`
  and `tests/routine-engine/draft-preview-sheet.test.tsx` that currently query old per-action labels
  directly (e.g. `getByLabelText('Save for Morning & Evening')`).

## 4. Assumptions

- One shared `RadioOptionGroup` + `RadioConfirmModal` pair, not three independent per-file
  implementations.
  Alternative: build the radio list and Confirm/Cancel footer separately inside each of the three
  files.
  Reason: all three need identical radio-row visuals/accessibility and an identical Confirm/Cancel
  footer; a shared pair is one implementation to maintain and avoids a fourth reinvention of the
  radio-row pattern (`Select.tsx`, `ReplaceStepSheet`'s `OptionRow`, and `QuizSheet`'s
  `QuizAnswerChip` already each independently built very similar single-select rows).
- `RadioConfirmModal` wraps a plain RN `Modal`, not `@gorhom/bottom-sheet`; `DraftPreviewScreen`
  uses `RadioOptionGroup` directly, inline, with no new Modal.
  Alternative: base everything on the gorhom `BottomSheet`/`BottomSheetModal` already used by
  `RoutineSchedulerSheet`/`ReplaceStepSheet`, including wrapping `DraftPreviewScreen`'s choice
  behind a newly-opened sheet.
  Reason: the two Modal-wrapped targets already use the plain-Modal centered-dialog look —
  switching would be an unrequested visual change; and hiding `DraftPreviewScreen`'s always-visible
  scope choice behind a new sheet would add a tap to the single most common routine-save action,
  a bigger UX change than the truncation fix that was asked for.
- Default pre-selected radio = the option that was previously styled `variant="primary"` at that
  site (`DuplicateSlotChoiceSheet` → "Replace", `DraftPreviewScreen` → "Morning & Evening"); where
  no button was previously primary (`RemoveStepModal`), default to the narrower/less-destructive
  scope ("{day} only"). Confirm is therefore always enabled — no "nothing selected" state exists.
  Alternative: start with nothing selected and disable Confirm until the user actively picks.
  Reason: preserves each site's pre-existing "recommended path" signal, keeps a one-tap fast path
  for the common case, and avoids introducing a new disabled-Confirm state this task doesn't
  otherwise need.
- Confirm/Cancel are the literal, non-customizable strings "Confirm" and "Cancel" at every call
  site.
  Alternative: let each site override the labels (e.g. "Remove" instead of "Confirm").
  Reason: the spec fixes these two labels explicitly; keeping them invariant guarantees these two
  buttons can never reproduce the long-label truncation bug this task exists to eliminate.
- Design tokens come from the current `src/constants/tokens.ts` palette (`palette.plum`,
  `colors.borderStrong`, etc.), not the teal `#008080`/sand `#F5F2EB`/slate `#2F4F4F` values listed
  in `CLAUDE.md`'s Design Tokens table.
  Alternative: follow `CLAUDE.md`'s documented values literally.
  Reason: `tokens.ts` is the actual source of truth and has already shipped a plum-based palette
  app-wide (Button, Checkbox, the Clinic redesign); `CLAUDE.md`'s table is stale, and
  `architecture-review.md`'s own duplication check requires sourcing colors from `tokens.ts`.
- Existing tests that query the old per-action button labels directly are rewritten against the
  new contract by qa-lead, not preserved as hidden/duplicate affordances.
  Alternative: keep the old `accessibilityLabel`s alive alongside the new ones for backward test
  compatibility.
  Reason: the old labels described a combined "select-and-commit" action that no longer exists as
  one tap once selecting and confirming are separate steps; keeping them would be dead, misleading
  accessibility surface, not real compatibility.

## 5. Open Questions

No open questions. The native-`Alert`/`ActionSheetIOS` conversion question (spec §10) is explicitly
out of this task's scope, not an unresolved blocker for the design above.
