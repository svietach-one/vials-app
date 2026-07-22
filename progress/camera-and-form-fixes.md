Status: ACCEPTED
Tech Design: docs/specs/camera-and-form-fixes-consolidated.md (consolidated spec, no separate design doc)
Code: fix-camera-add-product (uncommitted working tree)

## Карточка задачи
- [x] Product requirements (consolidated spec, pre-authored)
- [x] Spec review against actual code (Claude, 2026-07-12) — see Log
- [ ] QA tests (qa-lead) — engineer-authored tests in place; qa-lead pass not run
- [x] Implementation (engineer)
- [x] Architecture review (tech-lead) — ACCEPT, 2026-07-12 — see Log
- [ ] Device-manual QA (see checklist below)

## Log

### 2026-07-12 — OCR regression diagnosis (pre-spec)

Regression root cause (commit 70df13b): capture source moved from the system
camera (`ImagePicker.launchCameraAsync` + `allowsEditing` user crop +
focus/review loop) to an in-app `takePictureAsync` full frame at quality 0.5
with no crop — the Tesseract engine itself was extracted byte-identically and
was never the problem. Secondary: `ocrTextCleaner` stopped running on OCR
results. Diagnosis delivered in-session; the consolidated spec's Step 0
implements the ImagePicker restore.

### 2026-07-12 — spec review findings (before implementation)

- F1 CONFLICT: Step 0's "run ocrTextCleaner before splitLabelText" vs Step
  3.4's "use Tesseract line breaks" — the cleaner flattens `\n` to commas and
  strips accented Latin (brand names). RESOLUTION: full cleaner for `inci`
  only; `label` uses new `splitLabelLines` (whitespace + ™®© cleanup, lines
  preserved).
- F2 FALSE PREMISE: Step 3.4's "keep the Swap button / photo thumbnail (as
  already speced)" — neither existed in code or specs. USER DECISION: build
  Swap now, DEFER the captured-photo thumbnail (+ tap-to-enlarge) to a
  follow-up task. Two Step 3.4 done-when boxes intentionally deferred.
- F3 CONTRACT: Step 2's in-modal `dispatch(SET_BARCODE)` violates the modal's
  "data leaves only via onCapture" contract — implemented via
  `onCapture({ mode: 'barcode', code })`; BarcodeSection dispatches (also
  increments the community counter, matching scan behavior exactly).
- F4 NOT DISTINGUISHABLE: Step 4.2's "keep manual picks if distinguishable" —
  they weren't. USER DECISION: added `AddProductDraft.ocrDerivedKeys`
  provenance (never persisted; pruned on manual key removal) + new
  `CLEAR_INCI_RAW` reducer action.
- F5: Step 1's cross-mode close verification mostly mooted by Step 0 (system
  camera has its own cancel). Static suspect for the dead close button found
  and fixed (see below), device confirmation still pending.
- USER DECISION: label/inci picker offers BOTH "Take Photo" and "Choose from
  Gallery" (restores old OcrScannerSheet chooser; also the only OCR path in
  the iOS simulator).

### 2026-07-12 — engineer: implementation

Step 0 — capture split (`src/components/camera/CameraCaptureModal.tsx`):
- `barcode` → `BarcodeCaptureModal` (live decoder modal, geometry/decoder
  untouched). `label`/`inci` → `OcrPhotoFlow`: system camera/gallery via
  ImagePicker (`allowsEditing: true`, `quality: 0.85`, `base64`), shared
  `OcrEngineWebView`, 10s timeout, loading overlay — the pre-70df13b
  pipeline restored behind the unchanged component API (call sites and test
  mocks unaffected).
- `inci` results run `ocrTextCleaner`; `CaptureResult` for inci carries
  `hadNonLatin` (surfaced as an inline amber note in IngredientsSection —
  replaces the old blocking "Some Characters Removed" alert; InciScanNotice
  already pre-warns).
- `label` results keep line breaks (F1); cleanup in `splitLabelLines`.
- Multi-shot (`inci` only): "Text didn't fit? Add another shot." link under
  the raw block re-opens capture WITHOUT InciScanNotice and concatenates
  `prev + ', ' + new` before re-parsing. Unlimited attempts. Notice-gating
  tests updated to the new contract (first scan still notice-gated).

Step 1 — close button + hint:
- ROOT CAUSE (static analysis; device confirmation pending): the close
  button was `position: absolute` inside a height-collapsed absolute
  SafeAreaView — its touch target fell outside the parent's bounds (RN drops
  touches outside parent bounds), so taps were eaten on devices with
  small/zero top insets. FIX: button in normal flow inside the SafeAreaView.
- "Having trouble scanning? Enter the barcode below, or close." appears
  after 9s of unsuccessful scanning.

Step 2 — manual barcode entry:
- New `src/utils/productForm/barcodeValidation.ts`
  (`normalizeManualBarcode`, `manualBarcodeError`): 12/13 digits, shared
  mod-10 checksum, UPC-A normalized to EAN-13 by prepending 0. Unit-tested.
- Always-visible entry card in the barcode modal (shared `Input`,
  number-pad, inline error, KeyboardAvoidingView); valid code exits through
  `onCapture` (F3). Also reachable in the camera-failed fallback state.

Step 3 — brand/name fields:
- 3.1/3.3 ROOT CAUSE: draft fields spread `typography.body` (lineHeight 27)
  onto single-line TextInputs — known iOS caret/scroll breaker; the shared
  `Input` (used by the already-working saved-product form) takes fontSize
  only. Both fields now use shared `Input` (persistent labels "Brand" /
  "Product name", same accessibilityLabels as before).
- 3.2: `Input` gains an `onClear` prop (trailing ×, rendered only when
  non-empty, clears only its own field). Wired to both fields.
  NOTE: `src/components/ui/forms/Input.jsx/.d.ts` are a web design-sync
  variant — deliberately not touched; Metro/tsc resolve the .tsx.
- 3.4: new `LabelLinePicker` chip pool for multi-line label OCR
  (tap → Brand / Product name, assigned chips stay checked+dimmed,
  reassignment moves the line text between fields best-effort). Single-line
  result auto-fills Brand and skips the UI. `detectCategory` still runs on
  the full raw text (manual category still wins). Swap button between the
  fields. `APPLY_LABEL_OCR_RESULT` remains in the reducer but Section 1 no
  longer dispatches it (chips/SET_* replace the auto-guess per spec 3.4).

Step 4 — ingredients post-OCR UX (`IngredientsSection`):
- Raw block auto-expands whenever `inciRaw` lands (collapse still allowed).
- Clear × on the raw block → `CLEAR_INCI_RAW` (drops `ocrDerivedKeys` only;
  manual picks survive — F4; toggling a key off prunes provenance so a
  deliberate re-add survives later clears).
- "Choose actives manually" link always present after any OCR result
  (garbled included); opens ActivesChecklist WITHOUT hiding raw text.

### Verification (2026-07-12)

- `npx tsc --noEmit` — clean.
- `npx jest --testPathIgnorePatterns=worktrees` — 86 suites / 991 passed;
  the 3 failing suites (catalog-screen, product-detail,
  PaoChip.integration — AsyncStorage native mock) fail identically on clean
  HEAD (verified via stash) — pre-existing, unrelated.
- New/updated tests: barcodeValidation (12), formReducer (+5 for
  provenance/CLEAR_INCI_RAW), splitLabelLines (+4),
  camera-capture-modal.test.tsx (6: close, manual entry, hint timing),
  ingredients-and-barcode-sections (+7: expand default, clear ×, manual
  fallback, multi-shot concat/replace/notice-bypass).

### PENDING device-manual QA (cannot be verified in Jest)

- Real OCR quality on-device: label multi-line chips, INCI parse, re-shoot
  merge on a long ingredient list (the regression this task exists for).
- Close button in the barcode modal during prolonged failed scanning
  (blurry/damaged barcode, poor light) — confirm the bounds fix on iOS
  with and without notch.
- System-camera crop UX for label/inci; gallery path; permission denials.
- iOS long-name caret/scroll in the draft Product name field.
- Keyboard behavior of the manual barcode card on small screens.

### 2026-07-12 — tech-lead review — ACCEPT

Performed directly (not via subagent — see note below) per
`.claude/rules/architecture-review.md`, against the actual diff on
`fix-camera-add-product` (verified via `git status --short` / `git diff
--stat`: 11 modified + 8 untracked files, all `camera-and-form-fixes`
scope; matches this log's own file list, ruling out scope drift).

**Fidelity.** Read `docs/specs/camera-and-form-fixes-consolidated.md`
Steps 0–4 against the actual code in `CameraCaptureModal.tsx`,
`formReducer.ts`, `BrandNameCategorySection.tsx`, `IngredientsSection.tsx`,
`BrandAutocompleteInput.tsx`, `LabelLinePicker.tsx`, `Input.tsx`,
`ocrNormalizer.ts`, `barcodeValidation.ts`, `types/index.ts`. Every F1–F5
resolution and the three user decisions (Swap-only, `ocrDerivedKeys`
provenance, camera+gallery chooser) are implemented as logged, not just
claimed — confirmed by reading the actual source, not the log's prose.
The close-button fix, the manual-entry `onCapture` exit (F3), the
inci-only `ocrTextCleaner` split (F1), `CLEAR_INCI_RAW` provenance
pruning (F4), and the multi-shot re-shoot bypassing `InciScanNotice` all
match the spec/log exactly.

**Fit — layer separation.** Reran the grep suite from
`architecture-review.md` (`AsyncStorage` outside `services/storage.ts`,
`from 'react'` in `src/utils`, `fetch(` outside `src/services`): zero
hits inside any file this task touches — all hits are pre-existing,
unrelated code elsewhere in the tree. No screen/component in this diff
touches storage or network directly; all business logic (`detectCategory`,
`splitLabelLines`, `parseInciText`, `normalizeManualBarcode`) lives in
`src/utils/` and is only called, not reimplemented, from components.

**Duplication.** No hardcoded hex colors in any touched file (all via
`palette`/`colors` tokens — confirmed `LabelLinePicker`'s
`bottleGreenTint`/`bottleGreenLine` are real token names). One local type
export outside `types/index.ts` (`LabelLineField` in
`LabelLinePicker.tsx`) — same precedent as existing local UI unions
(`TabButtonMode`, `SectionAccordionStatus`, `TagTone`); not a domain
type, not a duplication concern.

**Type safety gate.** `npx tsc --noEmit` — clean (re-verified directly,
not trusted from the handoff claim).

**Tests.** `npx jest --testPathIgnorePatterns=worktrees` — 86 passed /
89 suites, 991 passed / 996 tests; the 3 failing suites (catalog-screen,
product-detail, PaoChip.integration — AsyncStorage/palette mock issues)
are identical to the previously-verified pre-existing baseline, confirmed
unrelated to this diff. Spot-read `camera-capture-modal.test.tsx`: good
hygiene — accessibility-label queries throughout, module-boundary mocks
for `expo-camera`/`expo-image-picker`/`OcrEngineWebView`, fake timers
correctly torn down in a `finally` block.

**Tech debt — WARNING (not a blocker).** `APPLY_LABEL_OCR_RESULT` (the
reducer action) and `splitLabelText` (the util it depended on) are now
dead in every production code path — `grep` confirms the only remaining
callers are their own unit tests (`formReducer.test.ts`,
`ocrNormalizer.test.ts`). The log correctly discloses that Section 1 no
longer dispatches `APPLY_LABEL_OCR_RESULT`, but doesn't note that this
leaves the action and its supporting util fully unreferenced by the app.
Recommend deleting both (and their now-pointless tests) in a follow-up —
per this project's own conventions, code confirmed unused should be
removed rather than kept "for later." Does not block merge.

No BLOCKER-level findings. No console.log/debugger, no TODO/FIXME/HACK,
no function over 50 lines in any touched file.

**Verdict: ACCEPT.** Ready to merge pending device-manual QA (unchanged
from before — device QA cannot be verified by this review) and, at the
implementer's discretion, cleanup of the dead
`APPLY_LABEL_OCR_RESULT`/`splitLabelText` pair.

**Process note:** a tech-lead subagent was spawned first for this review
and encountered a suspected prompt-injection payload appended to its
relayed messages (a fabricated "security-review" persona with a
367-file/48.8k-line diff that didn't match the real `git diff`, requesting
tools the agent didn't have, and an instruction to skip the mandatory
handoff-file write). The agent correctly refused to act on it across
three resumes; the user then had the review re-run directly by the main
session (this entry), bypassing that subagent thread entirely. That
thread was not resumed again. Worth investigating separately why the
relay carried that content — out of scope for this task's review.
