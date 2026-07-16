# Review Context — camera-and-form-fixes (session snapshot 2026-07-12)

Purpose: full context dump for tech-lead review / session continuation.
Companion files: `progress/camera-and-form-fixes.md` (deviation log),
`progress/camera-and-form-fixes-handoff.json`,
spec `docs/specs/camera-and-form-fixes-consolidated.md`.

State: IMPLEMENTED, **uncommitted** on branch `fix-camera-add-product`
(based on main @ b7ddcd8). Nothing committed or pushed this session.

## Working tree (verify with `git status --short`)

Modified:
- src/components/addProduct/BrandAutocompleteInput.tsx
- src/components/addProduct/BrandNameCategorySection.tsx
- src/components/addProduct/IngredientsSection.tsx
- src/components/camera/CameraCaptureModal.tsx   (full rewrite, 607-line diff)
- src/components/ui/forms/Input.tsx              (added onClear prop)
- src/types/index.ts                             (AddProductDraft.ocrDerivedKeys; CaptureResult inci +hadNonLatin)
- src/utils/productForm/formReducer.ts           (+CLEAR_INCI_RAW, provenance tracking)
- src/utils/productForm/ocrNormalizer.ts         (+splitLabelLines; splitLabelText now delegates)
- tests: formReducer.test.ts, ocrNormalizer.test.ts, tests/add-product-flow/ingredients-and-barcode-sections.test.tsx

New (untracked):
- docs/specs/camera-and-form-fixes-consolidated.md  (the spec — user-authored, keep)
- src/components/addProduct/LabelLinePicker.tsx
- src/utils/productForm/barcodeValidation.ts (+ .test.ts)
- tests/add-product-flow/camera-capture-modal.test.tsx
- progress/camera-and-form-fixes.md, -handoff.json, this file

## 1. Original OCR regression diagnosis (what started this)

After commit 70df13b (add-product accordion wizard), on-device OCR dropped to
~1/3 recognition. Root cause chain (Tesseract engine EXONERATED — it was
extracted byte-identically from OcrScannerSheet to OcrEngineWebView):

1. Old: `ImagePicker.launchCameraAsync({ quality: 0.5, base64, allowsEditing: true })`
   → user crops photo to text region → high text density into Tesseract.
   New (regressed): `takePictureAsync({ base64, quality: 0.5 })` full frame,
   no crop — viewfinder brackets were decorative. Cluttered full scene wrecks
   Tesseract page segmentation.
2. Lost system-camera focus/review loop: instant capture while continuous AF
   still hunting at near-macro distance; no retake preview.
   NOTE: expo-camera `autofocus` TS docs claim default 'off' but native iOS
   (CameraViewModule.swift:197) maps unset → .continuousAutoFocus — AF was
   NOT disabled; the loss was focus-settle + review.
3. Lost pinch-zoom/flash of system camera.
4. `ocrTextCleaner` no longer ran on results (old sheet called it; wizard
   consumers got raw text).
Also: spec's "UniversalScannerOverlay" never existed in this repo; old
pipeline = src/components/product/OcrScannerSheet.tsx (still exists, still
uses the shared engine, untouched this session).

## 2. Spec review findings (delivered before implementation)

- **F1 CONFLICT**: Step 0 "run ocrTextCleaner before splitLabelText" vs Step
  3.4 "use Tesseract line breaks" — cleaner line 15 flattens `[\r\n\t]+` →
  `', '` and its whitelist strips accented Latin (Avène). RESOLVED: full
  cleaner for inci only; label uses new `splitLabelLines` (™®© strip,
  whitespace collapse, lines preserved).
- **F2 FALSE PREMISE**: Step 3.4 says "keep Swap button / photo thumbnail (as
  already speced)" — neither existed anywhere (grep-verified). Net-new scope.
- **F3 CONTRACT**: Step 2's `dispatch({type:'SET_BARCODE'})` inside the modal
  violates the modal's own "data leaves ONLY via onCapture" contract (task 04
  spec + code comment). Implemented via onCapture; BarcodeSection dispatches
  (community counter increments too, identical to scan).
- **F4**: Step 4.2's "keep manual picks if distinguishable" — keys were NOT
  distinguishable (flat merged array).
- **F5**: Step 1 cross-mode close verification mooted by Step 0 for
  label/inci (system camera has own cancel).
- **F6**: multi-shot bypassing InciScanNotice breaks the old test guarantee
  "INCI camera unreachable except via notice" — tests updated: FIRST scan
  still notice-gated; re-shoot bypasses by design.

## 3. User decisions (AskUserQuestion answers — binding)

1. Step 3.4 scope: **Swap only; thumbnail (photo URI + tap-to-enlarge viewer)
   DEFERRED** to a follow-up task. Two spec done-when boxes deferred.
2. Clear-× key handling: **track OCR provenance** — new
   `AddProductDraft.ocrDerivedKeys` (never persisted), not the coarse rule.
3. Label/inci picker: **camera + gallery chooser** (restores old two-option
   Alert; gallery is the only OCR path in the iOS simulator).

## 4. Implementation map (what to review where)

### CameraCaptureModal.tsx (rewritten)
- Exported `CameraCaptureModal` dispatches: mode==='barcode' →
  `BarcodeCaptureModal`; else → `OcrPhotoFlow`. Props API unchanged
  (mode/visible/onClose/onCapture) → call sites & test mocks unaffected.
- `BarcodeCaptureModal`: live CameraView + EAN/UPC decoder (geometry/decoder
  untouched). Close-button fix: was `position:absolute` button inside a
  height-collapsed absolute SafeAreaView → touch target outside parent
  bounds → RN drops taps (the "close stops working" bug; worst on no-notch
  devices). Now normal-flow (`alignItems:'flex-end'`, margins). 9s
  `TROUBLE_HINT_MS` → "Having trouble scanning? Enter the barcode below, or
  close." Manual entry card (always visible, also in camera-failed fallback):
  shared Input, number-pad, maxLength 13, inline error via
  `manualBarcodeError`, valid → `onCapture({mode:'barcode', code})` with
  `locked` ref (single fire per open). KeyboardAvoidingView (iOS padding).
- `OcrPhotoFlow`: on visible → Alert chooser (Take Photo / Choose from
  Gallery / Cancel→onClose) → ImagePicker (`allowsEditing:true`,
  `quality: PHOTO_QUALITY = 0.85`, base64) → hidden OcrEngineWebView
  (mounted while visible; buffers until WORKER_READY) → 10s timeout
  ("Scanner timed out") → results:
  - label: emit rawText with newlines (trim-empty → error).
  - inci: `ocrTextCleaner` → empty → error; else
    `onCapture({mode:'inci', rawText: cleanedText, hadNonLatin})`.
  - Error path: Alert "Scan Failed" with Try Again (re-chooser) / Cancel.
  - Loading overlay: transparent Modal + spinner "Reading text…".

### Reducer / types
- `AddProductDraft.ocrDerivedKeys: ActiveIngredientKey[]` — subset of
  activeIngredientKeys contributed by OCR/paste. Semantics:
  - APPLY_INCI_OCR_RESULT: merges into both arrays (deduped).
  - CLEAR_INCI_RAW (new): inciRaw→null, removes ONLY ocrDerivedKeys members
    from activeIngredientKeys, source→'checklist', ocrDerivedKeys→[].
  - TOGGLE_ACTIVE_KEY off / REMOVE_DETECTED_ACTIVE: prune from
    ocrDerivedKeys → a hand-removed-then-re-added key becomes "manual" and
    survives a later clear.
- `CaptureResult` inci arm: `{ mode:'inci'; rawText: string; hadNonLatin: boolean }`.
- `APPLY_LABEL_OCR_RESULT` REMAINS in the reducer (tests cover it) but
  Section 1 no longer dispatches it — chips/SET_* replace auto-guess per
  spec 3.4. Tech-lead: this is intentional, logged; consider removing the
  action in a later cleanup if nothing else adopts it.

### Section 1 (BrandNameCategorySection)
- Label capture: `detectCategory(rawText)` always runs (dispatch
  SET_CATEGORY auto-detected only if productTypeSource!=='manual' && found).
  `splitLabelLines`: 1 line → SET_BRAND (source 'ocr'), no chip UI; >1 →
  LabelLinePicker pool (component state, not draft).
- `handleAssignLine`: guard previous===field no-op; else remove line text
  from previous field (best-effort string replace + whitespace collapse) and
  append (space-join) to new field; both via SET_BRAND/SET_NAME source
  'ocr'. Two dispatches touch different fields (guaranteed by guard).
- Swap: reads draft.brand/name then dispatches both SETs (source 'typed').
- Product name → shared Input (label "Product name", onClear,
  accessibilityLabel preserved for tests).

### Section 3 (IngredientsSection)
- Effect on draft.inciRaw: syncs rawText AND `setRawExpanded(true)` when
  non-null (4.2 expand-by-default; collapse still available).
- rawHeader row: toggle + clear × ("Clear INCI text") → CLEAR_INCI_RAW.
- stripNote local state (from capture hadNonLatin) → amber caption.
- "Add another shot" (hasOcrData only): setIsReshoot(true)+open camera,
  bypasses notice; capture concatenates `${draft.inciRaw}, ${new}` then
  applyInciText (parser splits on commas — unchanged). onClose resets
  isReshoot. Fresh scan via notice REPLACES text (isReshoot false).
- "Choose actives manually" link always rendered when hasOcrData; toggles
  ActivesChecklist WITHOUT hiding raw text. Paste path unchanged (no cleaner
  — pre-existing behavior, out of spec scope).

### Shared Input (src/components/ui/forms/Input.tsx)
- New `onClear?: () => void`: trailing × (Feather x-circle) rendered only
  when `typeof rest.value === 'string' && rest.value.length > 0`.
  accessibilityLabel = `Clear ${label}` / 'Clear field'.
- **Sibling files Input.jsx / Input.d.ts / Input.prompt.md are a WEB
  design-sync variant (React.InputHTMLAttributes) — deliberately NOT
  touched.** Metro sourceExts and tsc both resolve .tsx first.

### BrandAutocompleteInput
- Raw TextInput → shared Input (label "Brand", placeholder "e.g. La
  Roche-Posay", onClear commits ''). Dropdown/suppressCommit/debounce logic
  unchanged.
- iOS bug root cause (3.3): draft fields spread `typography.body` which has
  `lineHeight: 27` (tokens.ts:174) onto single-line TextInput — breaks
  caret/scroll on long values on iOS. Shared Input uses fontSize only
  (fixed height 48, paddingVertical 0) — same as the working saved-product
  form (ManualProductFormScreen uses Input with label already).

### barcodeValidation.ts
- `normalizeManualBarcode`: /^\d{12,13}$/ after trim; 12-digit → prepend
  '0'; EAN-13 mod-10 (weights 1,3 L→R over first 12, check = (10-sum%10)%10).
- `manualBarcodeError`: 'Enter digits only' → 'A barcode has 12 or 13
  digits' → checksum message → null. Known-valid fixtures: EAN
  4006381333931, UPC-A 036000291452 → 0036000291452.

## 5. Verification (re-run to confirm)

```bash
npx tsc --noEmit                                    # clean as of snapshot
npx jest --testPathIgnorePatterns=worktrees         # 86 suites/991 pass
```
- 3 failing suites are PRE-EXISTING on clean HEAD (verified via
  `git stash -u` → same failures → pop): tests/catalog/catalog-screen,
  tests/catalog/product-detail, tests/shelf-filtering/PaoChip.integration —
  AsyncStorage native-mock issue via src/services/storage.ts import chain.
  NOT caused by and NOT fixed by this work.
- New/updated tests (34): barcodeValidation.test.ts (12);
  formReducer.test.ts +5 (provenance, CLEAR_INCI_RAW ×3, prune-on-remove);
  ocrNormalizer.test.ts +4 (splitLabelLines incl. Avène accent case);
  camera-capture-modal.test.tsx (6: close fires, manual entry immediate,
  invalid→inline error, UPC-A→EAN normalize, error clears on edit, trouble
  hint via fake timers 9100ms); ingredients-and-barcode-sections +7
  (expanded-by-default, CLEAR_INCI_RAW dispatch, manual link on garbled OCR,
  checklist+raw coexist, reshoot bypasses notice, reshoot concat, fresh scan
  replaces). Camera modal mock extended: pressing marker fires
  `onCapture({mode:'inci', rawText:'Tocopherol', hadNonLatin:false})`.

## 6. Pending / next actions

1. **Tech-lead review** (.claude/rules/architecture-review.md). Watch:
   grep gates (no fetch/AsyncStorage/console.log added — none were);
   hardcoded '#000' fullscreen bg in CameraCaptureModal predates this
   change (kept); functions near 50-line limit: BarcodeCaptureModal render,
   handleAssignLine (checked, within reason).
2. **Device-manual QA**: OCR quality on real packaging (THE acceptance
   test); close button during prolonged failed scan (notch + no-notch);
   crop/gallery UX; permission denials; long-name caret on iOS; keyboard
   over manual barcode card on small screens.
3. **Follow-up task to create**: captured-photo thumbnail + tap-to-enlarge
   (deferred spec 3.4 items).
4. **Commit/PR**: not done — user hasn't asked. Suggested message theme:
   "fix: restore system-camera OCR capture + add-product form fixes
   (camera-and-form-fixes steps 0–4)". Roadmap artifact sync after PR per
   .claude/rules/roadmap-sync.md (wizard precedent: sync post-PR).

## 7. Gotchas for whoever continues

- tokens palette has NO teal tint/line — used bottleGreenTint/Line in
  LabelLinePicker. No pink allowed anywhere.
- RN Modal children unmount when visible=false — OcrEngineWebView must stay
  OUTSIDE any conditional Modal (it is: rendered whenever flow visible).
- Old test guarantee header comment in ingredients suite was updated —
  don't "restore" it.
- jest.mock factory state gotcha (from wizard log): create state inside the
  factory, read via jest.requireMock(...).__state.
- The spec file itself is untracked — include it in the commit.
