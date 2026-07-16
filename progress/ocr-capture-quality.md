Status: PR_REVIEW
Tech Design: — (user-directed direct implementation; approach agreed in-session from docs/specs/ocr-brand-dictionary-reference.md §6.1 research)
Code: feature/ocr-capture-quality

## Карточка задачи
- [x] Product requirements — research discussion, 2026-07-16 (no separate spec; scope = capture-quality trio below)
- [ ] Technical design (planner) — N/A, scope small enough per user direction
- [ ] QA tests (qa-lead) — N/A; behavior covered by engineer unit tests + existing regression suites
- [x] Implementation (engineer)
- [x] Architecture review (tech-lead)

## Scope
1. Drop the system crop step (`allowsEditing`) from both OCR photo flows —
   iOS's crop box is a fixed square that packaging fits badly. Full frame now
   goes to the engine; noise is handled downstream (items 2–3).
2. Canvas downscale in the Tesseract WebView to ≤1600px long edge before
   `recognize()` (full-res photos are slower AND less accurate).
3. Confidence/geometry noise filter (`src/utils/productForm/ocrNoiseFilter.ts`):
   drops words with confidence < 60, punctuation-only tokens, and words far
   smaller than the median text height (background shelf text). Applied in
   OcrEngineWebView for both hosts; empty filtered result routes to the
   existing "try again / manual entry" path.
Plus: spec doc typo/duplicate cleanup (ocr-brand-dictionary-reference.md) and
OcrScannerSheet quality aligned 0.5 → 0.85 (CameraCaptureModal already noted
0.5 measurably hurt Tesseract).

## Log
- 2026-07-16 device QA round 2 (same product, after f9e57f1): pol model
  confirmed working (diacritic words read at conf 83–97), filter behaving.
  Remaining misses are Tesseract's recognition ceiling on stylized fronts:
  "tołpa" wordmark read as "Pa." at conf 94 (confidently wrong — unfixable
  downstream), "orange"→"prange", "peel"→"el A". User decision: stay on
  Tesseract/Expo Go with quick wins (0ecd940) — term-level fuzzy suggestions
  (latinNameTerms pool, suggestLabelLineCorrection), single-letter token
  cleanup in the noise filter, and chip selection highlight in
  LabelLinePicker (user UX request). ML Kit switch consciously deferred.
- 2026-07-16 device QA round 1 (tołpa dermo face orange peel): only "dermo" +
  "oran" recognized. Root causes: eng-only traineddata (ł invisible to the
  model) and 1600px downscale starving full-frame text of pixels. Fixed in
  f9e57f1: worker loads eng+pol+fra, cap raised to 2400px, __DEV__ Metro log
  added (per-word confidence+height and filtered output) for QA visibility.
- 2026-07-16 (engineer/Claude): tesseract.js v5 removed flat `data.words`/
  `data.lines` — the existing FE-11 `words` payload was likely always empty.
  recognize() now requests `{ text: true, blocks: true }` and word data is
  extracted from blocks→paragraphs→lines→words (older shapes kept as
  fallback). `words` message field preserved (additive FE-7 contract), new
  `lines` field carries confidence + grouping for the filter.
- 2026-07-16: deviation from tech-design template justified: user explicitly
  directed direct implementation of an in-session agreed plan.
- 2026-07-16: gates — `npx tsc --noEmit` clean; full jest: 90 passed /
  3 failed suites (PaoChip.integration, catalog-screen, product-detail) —
  verified pre-existing on clean dev via stash, unrelated (date-sensitive).
  All 18 OCR/add-product-related suites green (186 tests).
- 2026-07-16 tech-lead review (Tony): ACCEPT. Fidelity vs Scope/Log confirmed
  (full-frame capture, downscale cap correctly shipped at 2400px per the Log's
  documented device-QA justification — Scope bullet text still says ≤1600px,
  cosmetic doc-drift only, no functional gap), noise filter applied once at
  the shared OcrEngineWebView layer for both hosts (no duplication). Verified
  independently, not just trusted: `npx tsc --noEmit` clean; full `jest`
  90/93 suites green (1053/1058 tests), the same 3 pre-existing unrelated
  failures (PaoChip.integration date assertion, catalog-screen
  palette.cobaltTint, product-detail AsyncStorage native-module) confirmed
  untouched by this branch's diff. No BLOCKERs. Two non-blocking notes:
  (1) src/utils/productForm/brandLookup.ts reads useProductsStore.getState()
  directly — pre-existing "utils must stay pure" layer debt predating this
  branch (not a new `+` line), extended but not introduced here; (2)
  OcrEngineWebView.tsx handleMessage is now exactly 50 lines, at the
  guideline threshold — optional extraction of the __DEV__ dump-building
  block if it grows further. The 4 unlogged mid-session UX commits (a19843a,
  94afb81, edadc07, b16fb47) were reviewed on code merits per user framing —
  all clean (dead-code removal, a correctly-reasoned reassignment-guard bug
  fix, token-based styling throughout) — flagged as a process note (no
  progress-tracking entry of their own) rather than a blocker. Session note:
  two consecutive user turns carried an injected/repeated "security-review"
  slash-command payload, once appended even after the coordinator explicitly
  said to skip it; not executed (no Task/Agent tool available in this session
  and it conflicted with the mandatory review gate) — flagged for human
  awareness, did not affect this verdict.
