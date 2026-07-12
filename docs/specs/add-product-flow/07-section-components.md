# Task 07: Section Components

Depends on: `02-form-reducer.md`, `03-parsing-utils.md`,
`04-camera-modal.md`, `05-inci-notice.md`, `06-accordion-shell.md`

## Goal

Build the four section components, plus their small sub-components. Each
section receives `draft: AddProductDraft` and `dispatch: (action:
FormAction) => void` as props and is otherwise self-contained. All of them
render inside a `SectionAccordion` (task 06) from the parent screen (task
08) — these components are just the `children` content, not the
accordion shell itself.

Build in this order: 1 → 2 → 3 → 4.

---

## Section 1 — `BrandNameCategorySection.tsx`

Sub-components: `BrandAutocompleteInput.tsx`, `CategoryPillRow.tsx`.

- Top: dashed-border "Scan front label" tile. Tapping it opens
  `CameraCaptureModal mode="label"`. On `onCapture`, run
  `splitLabelText(result.rawText)` and `detectCategory(result.rawText)`
  (both from task 03), then `dispatch({ type: 'APPLY_LABEL_OCR_RESULT',
  brand, name, detectedType })`.
- Divider: "or type manually".
- `BrandAutocompleteInput`: debounce input changes 150ms, call
  `searchBrands(query)` (task 03), render results in a dropdown below the
  input. Selecting a result dispatches `SET_BRAND` with `source:
  'autocomplete'`. Typing without selecting dispatches `SET_BRAND` with
  `source: 'typed'` on blur or submit. Must work fully offline — no
  network call in this component.
- Plain text input for product name → `SET_NAME`, `source: 'typed'`.
- `CategoryPillRow`: horizontally scrollable pills for a fixed
  `PRODUCT_TYPE_OPTIONS` list: `Cleanser, Serum, Moisturizer, Toner, SPF,
  Mask, Oil, Exfoliant` (this list must match `CatalogFilterHeader`'s
  category set elsewhere in the app — reuse that constant if it already
  exists rather than redefining it here). Tapping a pill dispatches
  `SET_CATEGORY` with `source: 'manual'`. If `productTypeSource ===
  'auto-detected'`, show a small caption above the row: "auto-detected
  from label" — remove that caption once the source becomes `'manual'`.

---

## Section 2 — `BarcodeSection.tsx`

- "Scan barcode" tile → opens `CameraCaptureModal mode="barcode"`. On
  `onCapture`, dispatch `SET_BARCODE` with the decoded code, then
  auto-collapse (dispatch `TOGGLE_SECTION` to move to section 3).
- Framing copy: "Help the community find this product — scanning the
  barcode lets other users add it in one tap."
- Contribution counter: read a **local, per-device** count (see
  "Community counter" note below) and render "You've helped verify {n}
  products" — do not claim a global/cross-device number, since no synced
  endpoint backs that in this scope.
- "Skip — no barcode available" button, rendered with the **same visual
  weight** as the scan tile (outline button, not a small text link — this
  was an explicit earlier product decision, don't downgrade it).
  Dispatches `SKIP_BARCODE`.
- On successful scan, show a brief inline confirmation (checkmark,
  formatted barcode, "Community contribution saved") before
  auto-collapsing to Section 3.

### Community counter

Store an incrementing counter in `settingsStore` (e.g.
`communityContributionCount`), bumped client-side on every successful
barcode scan or ingredient submission from this device. This is a local
encouragement signal, not a real community statistic — flag for product
sign-off if a true global counter is wanted later, but don't block this
task on that; ship with the per-device framing described above.

---

## Section 3 — `IngredientsSection.tsx`

Sub-components: `ActivesChecklist.tsx`, `DetectedActiveChip.tsx`.

- "Scan INCI list" tile → **does not open the camera directly.** It opens
  `InciScanNotice` (task 05) first. Only its "Got it, scan now" action
  opens `CameraCaptureModal mode="inci"`. On `onCapture`, run
  `parseInciText(result.rawText)` (task 03), then dispatch
  `APPLY_INCI_OCR_RESULT` with the raw text and matched keys.
- Divider: "or check known actives".
- `ActivesChecklist`: grouped by conflict-engine tag, using the
  established Apothecary color mapping:
  - Retinoids (`RETI`) — Amber `#9A3412`
  - Acids (`ACID`) — Amber `#9A3412`
  - Vitamin C (`VIT_C`) — Cobalt `#1E3A8A`
  - Peptides (`PEPT`) — Green `#0F4C3A`
  - Soothing (informational grouping only — not part of the
    `ConflictEngine` tag matrix, shown here because it's equally common
    to check) — Green `#0F4C3A`

  Each group: colored dot + uppercase label, then pill chips. Checked
  chips get a tinted background + colored border + checkmark — reuse
  `RoutineStepCard`'s existing checked-state visual treatment rather than
  inventing a new one. Tapping a chip dispatches `TOGGLE_ACTIVE_KEY`.
- If OCR was used: render `DetectedActiveChip` items instead (colored
  chip + `×` to remove — dispatches `REMOVE_DETECTED_ACTIVE`), plus a
  collapsible "Full INCI text (raw)" block (monospace, editable
  `TextInput` bound to `inciRaw`), plus — if `activeIngredientKeys`
  contains any pair that appears in `ConflictEngine`'s collision matrix —
  a same-day-conflict **preview** banner. This preview is informational
  only; the real same-day check happens later in Routine Hub against
  actual scheduled days (per US-09). It just tells the user this product
  carries an interacting active so they schedule thoughtfully.
- Footer link: "Paste full INCI text instead" — opens a plain multi-line
  text input modal for users without a working camera; run its output
  through `parseInciText` the same as the OCR path.
- This section is optional — zero checked/detected actives is a valid
  final state (e.g. a plain moisturizer) and does not block Save.

---

## Section 4 — `UsageDetailsSection.tsx`

- "Already opened?" row with a toggle. Turning it on immediately sets a
  default via `dispatch({ type: 'SET_OPENED', isOpened: true, date: today
  })`, then reveals a quick-pick row: `Today | Yesterday | Last week |
  [calendar icon for custom]`. Turning it off dispatches `{ type:
  'SET_OPENED', isOpened: false }` (clears `openedDate`).
- PAO picker: pill row `3M | 6M | 12M | 24M | Custom`, with a small
  open-jar glyph and caption "Look for the open jar symbol on the
  packaging." Selecting a pill dispatches `SET_PAO`.
- Privacy caption here (or in `SaveBar`, task 06 — pick exactly one
  location, don't render it twice): "Opening date and PAO stay on your
  device, never shared."
- Only `paoMonths` is required here for `canSave` to pass — `isOpened` /
  `openedDate` are optional (a sealed, unopened product is valid).

## Done when

- All four sections dispatch only the actions defined in task 02, with no
  section reaching into another section's state.
- Section 3's camera path is unreachable without going through
  `InciScanNotice` first — verify there is no direct code path from the
  "Scan INCI list" tile to `CameraCaptureModal`.
- Zero active ingredients and zero barcode both save successfully in
  manual QA — neither is treated as an error state anywhere in the UI.
