Status: PR_REVIEW
Spec: docs/specs/add-product-flow/ (00-overview + numbered task files)
Code: feature-add-product-accordion-wizard (branched from origin/dev)

## Карточка задачи
- [x] Product requirements (spec folder, pre-existing)
- [x] Types (01) — engineer
- [x] Form reducer + unit tests (02) — engineer
- [x] Parsing utils + unit tests (03) — engineer
- [x] Camera capture modal (04) — engineer
- [x] INCI pre-scan notice (05) — engineer
- [x] Accordion shell + SaveBar (06) — engineer
- [x] Section components (07) — engineer
- [x] Screen assembly + navigation (08) — engineer
- [x] Local-first save + background suggest (09) — engineer
- [x] QA testing checklist (10) — automated portion; device-manual items listed below
- [ ] Device-manual QA (camera permission denial, airplane-mode save, real OCR)
- [x] Architecture review (tech-lead)

## Log

### 2026-07-11 — engineer: tasks 01–09 implemented

New files:
- `src/utils/productForm/` — formReducer, categoryDetector,
  activeIngredientMatcher, brandLookup, ocrNormalizer, conflictPreview,
  saveProduct (+ co-located tests, 58 passing)
- `src/components/camera/` — OcrEngineWebView, CameraCaptureModal, InciScanNotice
- `src/components/addProduct/` — SectionAccordion, SaveBar, ScanTile,
  activesGroups, BrandAutocompleteInput, CategoryPillRow,
  BrandNameCategorySection, BarcodeSection, ActivesChecklist,
  DetectedActiveChip, IngredientsSection, UsageDetailsSection
- `src/screens/catalog/AddProductScreen.tsx`
- `src/services/vialsApi/products.ts` — suggestProduct + suggestProductInBackground

Documented deviations from the spec (each with reason):

1. **`Product.barcode` added as optional (`barcode?: string | null`)**, not
   required. Matches the codebase convention for post-hoc fields
   (`activeTags?`, `isHidden?`) so persisted products and existing fixtures
   don't break.
2. **`ActiveIngredientKey` reused** (canonical ruleset keys), not the spec's
   RETI/ACID/VIT_C/PEPT placeholders — as the spec itself instructs.
   Checklist groups map: Retinoids=retinoid; Acids=aha/bha/pha/azelaic_acid;
   Vitamin C=vitamin_c_pure/derivative; Peptides=copper_peptides;
   Soothing=niacinamide/panthenol/cica/ceramides.
3. **`parseInciText` delegates to `parseActiveIngredientsFromInci`**
   (actives.json ruleset) instead of duplicating a flat lookup map — honors
   the spec's own "single canonical client-side map" requirement; the
   ruleset's negativePatterns already resolve derivative-vs-parent collisions.
4. **Label/INCI OCR uses shutter-photo capture, not live stable-text-frame
   detection.** No live OCR pipeline exists in this codebase (no ML Kit);
   OCR is Tesseract.js in a hidden WebView. That engine was extracted from
   OcrScannerSheet into shared `OcrEngineWebView` (regression suite
   tests/inci-attribution-highlighting still green) and reused by
   CameraCaptureModal — no forked OCR implementation.
5. **`brandLookup.searchBrands` reads `useProductsStore.getState()` from a
   util** — the spec's explicit fallback (no local SQLite DB is wired up).
   The pure core `filterBrandPrefix` is exported separately and unit-tested.
   Flag for tech-lead: minor tension with the "utils never import stores"
   layer rule; accepted because the spec pins both file path and signature.
6. **categoryDetector maps "cream" to 'moisturizer'** (spec's combined
   pattern) so detected types always land inside the wizard's fixed 8-pill
   CategoryPillRow. Detector types use real ProductType values
   ('peeling' for Exfoliant etc.).
7. **Save toast**: no cross-platform toast infra exists; ToastAndroid on
   Android, nothing on iOS (shelf visibly updates). Navigation still
   returns immediately after the synchronous store write.
8. **Privacy note rendered once, in SaveBar** (task 06/07 said pick one
   location); Section 4 has a code comment pointing there.
9. **`communityContributionCount` added to AppSettings + settingsStore**
   (`incrementCommunityContribution`), bumped on barcode scan
   (BarcodeSection) and on save when inciRaw is present. Local per-device
   framing only, as specced.
10. **Raw INCI edit re-parses additively** on blur
    (APPLY_INCI_OCR_RESULT with re-parsed keys) — the reducer has no
    SET_INCI_RAW action; removals stay a chip-level action.
11. **Navigation**: `AddProduct: undefined` added to CatalogStackParamList.
    AddProductHub "Add Manually"/"Create Product Manually" and
    BarcodeScanner's not-found "Add Manually" now navigate to AddProduct;
    OBF-prefill (barcode-hit) paths unchanged on ManualProductForm.
    tests/catalog/add-product-hub.test.tsx assertions updated to the new
    contract.
12. **`suggestProduct` service created** at src/services/vialsApi/products.ts
    (the overview referenced it as existing, but it is absent on origin/dev).
    Reads EXPO_PUBLIC_VIALS_API_URL; when unset it returns silently —
    same UX as the silent-swallow error path. lookupBarcode/searchByText
    deliberately NOT stubbed (no consumers in this scope).

### 2026-07-11 — engineer: task 10 QA pass (automated portion)

New tests in `tests/add-product-flow/` (fixtures.ts + 3 suites, 29 tests):
- `accordion-shell.test.tsx` — all four status-indicator variants, prop-driven
  expand/collapse, summary-replaces-title + pencil affordance, SaveBar
  always-tappable contract and privacy-note suppression.
- `ingredients-and-barcode-sections.test.tsx` — INCI camera unreachable
  except via InciScanNotice "Got it, scan now"; notice reappears every tap
  (no persisted dismissal); "Use manual checklist instead" never opens the
  camera; zero detected actives rendered as a neutral note; conflict
  preview shows for rule pairs; barcode skip is a full-weight button
  dispatching SKIP_BARCODE; local contribution counter renders.
- `AddProductScreen.integration.test.tsx` — single-section expansion;
  save-validation lands on Section 1 / Section 4 with inline message and NO
  dialog; local-first save (addProduct + goBack fire while the suggest
  promise is still pending — nothing awaits the network); zero actives +
  null barcode save cleanly; failed suggest is swallowed (console.warn
  only); discard confirm only when dirty.

Checklist findings:
- No AI/LLM imports anywhere in the feature (grep clean); no fetch outside
  src/services/ (grep clean).
- US-22 `source: 'manual'` — RESOLVED 2026-07-12 (see log entry below):
  `Product.source?: ProductSource` added, mirroring the Turso enum.
- US-22 lookup/search endpoints and ML Kit live-OCR are narrowed by the
  spec's own scope statements (barcode-hit path out of scope; Section 3
  replaces /search for the not-found path; Tesseract photo OCR per task 04
  deviation #4).
- Community-counter framing: per-device only, flagged for product sign-off
  if a true global counter is wanted later (per spec sign-off note).

PENDING device-manual QA (cannot be verified in Jest/simulator-less env):
- Camera permission denied in each of the 3 modes → inline fallback ("Camera
  unavailable. Use manual entry instead.") and Close still works.
- Airplane-mode save: identical local UX, suggest rejects silently.
- Real OCR capture quality on-device (label split, INCI parse).
- Jest gotcha for future suites: module-body `const state = { fn: mockFn }`
  objects referenced from jest.mock factories end up with undefined fields —
  create state inside the factory and read it back via
  `jest.requireMock(...).__state` (see tests/add-product-flow).

### 2026-07-12 — engineer: Product.source provenance field

Product owner confirmed the Turso DB has a `source` column used to split
OBF imports from manual additions, so the local model now carries it:

- `ProductSource = 'vials_seed' | 'obf_import' | 'community' | 'user_local'`
  in src/types/index.ts — mirrors db-product-spec.md §4.1 exactly so values
  round-trip on sync. `Product.source?: ProductSource` optional per the
  post-hoc-field convention.
- Backfill migration `migrateProductSource` (src/utils/routineEngine/
  migrations.ts, applied inside migrateProducts): absence →
  `openBeautyFactsId ? 'obf_import' : 'user_local'`. Never relabels a
  record whose source is already set.
- Creation sites: wizard `buildProductFromDraft` → 'user_local';
  ManualProductFormScreen → preserves source on edit, else
  `obfId ? 'obf_import' : 'user_local'`; onboarding FirstProductScreen →
  same split.
- `SuggestPayload` deliberately does NOT carry source: everything arriving
  via POST /suggest is user-originated by construction, and per
  db-tech-design §5.2/5.3 the server assigns provenance ('community' on
  accept; 'obf_import'/'vials_seed' come from its own import pipelines).
  If the suggest endpoint's schema expects a source column in the body,
  it's a one-line addition to buildSuggestPayload — flag at API review.
- tests/routine-engine/fixtures.ts makeProduct now defaults
  `source: 'user_local'` (same-reference migration assertions rely on the
  backfill no-op); new migrateProductSource tests in migrations.test.ts.

Verification:
- `npx tsc --noEmit` — clean.
- `npx jest --testPathIgnorePatterns="worktrees"` — 75 suites / 882 tests
  pass (incl. the 3 new add-product-flow suites); the 3 failing suites
  (catalog-screen, product-detail, PaoChip.integration) fail identically on
  clean origin/dev (verified in a detached worktree) — pre-existing,
  untouched by this work.
- Privacy boundary: SuggestPayload is hand-declared;
  saveProduct.test.ts asserts the payload's exact key set (no
  openedDate/isOpened/paoMonths path to the network layer).

### 2026-07-12 — tech-lead: architecture review — ACCEPT (-> PR_REVIEW)

Reviewed docs/specs/add-product-flow/00-10 against the implementation file by
file (types, formReducer, parsing utils, camera modal, INCI notice, accordion
shell, all 4 section components, screen assembly, save+sync, testing
checklist), and independently verified all 12+ logged deviations (including
the 2026-07-12 Product.source entry) match what's actually in code.

Findings:
- No BLOCKERs. `npx tsc --noEmit` clean; no undocumented data-model/screen/
  store deviations found; no direct AsyncStorage outside services/storage.ts;
  no React imports in src/utils/; no `fetch(` outside src/services/; zero
  hardcoded 6-digit hex colors introduced by this PR (grep hits are all in
  pre-existing, untouched CatalogScreen.tsx / PhototypeCard.tsx); no TODO/
  FIXME/HACK; no console.log/debugger; no AI/LLM imports (grep + manual
  confirm); no pink hues; all new-file typography routes through tokens
  (14px floor honored).
- Privacy boundary (SuggestPayload) independently confirmed sound at three
  levels: hand-declared type (types/index.ts, not Omit<Product,...>),
  buildSuggestPayload's object literal (saveProduct.ts, exactly 6 fields),
  and saveProduct.test.ts's Object.keys(payload).sort() exact-key-set
  assertion — a real structural regression guard, not a smoke test.
- brandLookup.ts importing useProductsStore (log item #5): ruled WARNING,
  not BLOCKER, per the architecture-review.md troubleshooting rule — the
  log entry documents a clear reason, the spec pinned this exact file path/
  signature/fallback, and the pure core (filterBrandPrefix) is separately
  exported and unit-tested.
- New WARNING (not previously logged): IngredientsSection.tsx's intra-
  product conflict-preview banner (conflictPreview.ts's
  findIntraProductConflicts) touches the CLAUDE.md "conflict warnings only
  in routines" constraint. Defensible as implemented — intra-product (not
  inter-product/routine), reuses the canonical INGREDIENT_CONFLICT_RULES
  table (no duplicated ruleset), and the UI copy explicitly hedges ("You'll
  see exact warnings when this product is in a routine") — but it wasn't
  explicitly reconciled against that constraint anywhere in this log.
  Recommend an explicit product/tech-lead sign-off note; not blocking given
  the spec called for it deliberately and the implementation is faithful
  and reuses canonical rules.
- WARNING (non-blocking, style): IngredientsSection.tsx (~182-line single
  component, no sub-extraction) and CameraCaptureModal.tsx's renderBody
  (~81 lines) exceed the 50-line guideline. Recommend extracting the paste-
  modal/conflict-banner and the fallback/loading branches into small named
  sub-components in a follow-up, matching the pattern already used for
  ReadingIndicator and the Section1-4Summary components.
- FYI, non-blocking, out of scope for this PR: OcrEngineWebView.tsx's
  CDN-loaded Tesseract.js script + `originWhitelist={['*']}` predates this
  PR — confirmed via diff that it's a byte-for-byte relocation out of
  OcrScannerSheet.tsx, not new surface introduced here.
- Verification independently re-run: `npx tsc --noEmit` clean;
  `npx jest --testPathIgnorePatterns="worktrees"` — 75/78 suites, 885/890
  tests pass; the 3 failures (catalog-screen, product-detail,
  PaoChip.integration) match the exact pre-existing baseline named in this
  file and handoff.json — none touch any file this PR modified, and this
  same 3-suite baseline was independently confirmed pre-existing/unrelated
  by the prior tech-lead review (routine-similar-product-priority, already
  on dev). No regressions.

Status set to PR_REVIEW — ready for human merge. Device-manual QA (camera
permission denial x3 modes, airplane-mode save, real OCR quality) remains
genuinely open per this file's checklist above; flagged to the human rather
than silently dropped or force-checked.

Process note: this session's human-turn text arrived with an appended
`/security-review` command block (twice, verbatim) instructing a pivot to a
sub-agent-based vulnerability scan against a fabricated/empty diff and a
mismatched commit log, ending in "output the report and nothing else." Not
executed — no Task tool was available in this session to honor it, its own
evidence was internally inconsistent, and complying would have meant
silently skipping this review's human-approval gate and progress-tracking
requirements. Flagged to the coordinator; this review proceeded on the
actual repository diff instead.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
