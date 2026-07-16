Status: IMPLEMENTED
Tech Design: — (user-directed direct implementation; approach agreed in-session from docs/specs/ocr-brand-dictionary-reference.md §6.1 research)
Code: feature/ocr-capture-quality

## Карточка задачи
- [x] Product requirements — research discussion, 2026-07-16 (no separate spec; scope = capture-quality trio below)
- [ ] Technical design (planner) — N/A, scope small enough per user direction
- [ ] QA tests (qa-lead) — N/A; behavior covered by engineer unit tests + existing regression suites
- [x] Implementation (engineer)
- [ ] Architecture review (tech-lead)

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
