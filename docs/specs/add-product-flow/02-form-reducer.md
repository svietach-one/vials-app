# Task 02: Form Reducer

Depends on: `01-types.md`

## Goal

Create `src/utils/productForm/formReducer.ts` — a single `useReducer`
store for the entire `AddProductDraft`. This is screen-local, transient
state, not a Zustand store — it only gets committed to `productsStore` on
Save (task 09). Consistent with the existing project rule that
`ConflictEngine` and form drafts are never inside a persisted store.

## Actions to implement

```ts
type FormAction =
  | { type: 'SET_BRAND'; value: string; source: AddProductDraft['brandSource'] }
  | { type: 'SET_NAME'; value: string; source: AddProductDraft['nameSource'] }
  | { type: 'SET_CATEGORY'; value: ProductType; source: 'auto-detected' | 'manual' }
  | { type: 'APPLY_LABEL_OCR_RESULT'; brand: string; name: string; detectedType: ProductType | null }
  | { type: 'SET_BARCODE'; value: string }
  | { type: 'SKIP_BARCODE' }
  | { type: 'APPLY_INCI_OCR_RESULT'; rawText: string; matchedKeys: ActiveIngredientKey[] }
  | { type: 'TOGGLE_ACTIVE_KEY'; key: ActiveIngredientKey }
  | { type: 'REMOVE_DETECTED_ACTIVE'; key: ActiveIngredientKey }
  | { type: 'SET_OPENED'; isOpened: boolean; date?: string }
  | { type: 'SET_PAO'; months: number }
  | { type: 'TOGGLE_SECTION'; section: 1 | 2 | 3 | 4 };

function formReducer(state: AddProductDraft, action: FormAction): AddProductDraft
```

## Behavior rules

- Every action that touches Section 1, 2, or 3 data must recompute the
  relevant entry in `sectionStatus` as part of the same reducer branch —
  don't compute status separately elsewhere. UI components should never
  need their own "is this done" logic; they read `state.sectionStatus`.
- `SET_CATEGORY` with `source: 'manual'` always overrides whatever
  `productTypeSource` was previously set to (including `'auto-detected'`)
  — manual selection always wins over OCR guesses.
- `APPLY_LABEL_OCR_RESULT` sets `brand`/`name` with source `'ocr'`, and
  sets `productType`/`productTypeSource: 'auto-detected'` **only if**
  `detectedType` is non-null and the user hasn't already manually picked a
  category this session (don't clobber a manual pick with a later OCR
  scan of the same label).
- `SKIP_BARCODE` sets `barcode: null` and `sectionStatus.barcode:
  'skipped'`, and should also auto-collapse the current section (set
  `expandedSection` to the next logical section, `3`).
- `TOGGLE_ACTIVE_KEY` adds/removes a key from `activeIngredientKeys`
  (dedupe — it's a checklist toggle, not a list push) and sets
  `ingredientsSource: 'checklist'` unless OCR data is also present, in
  which case set it to `'mixed'`.
- `REMOVE_DETECTED_ACTIVE` removes a key that OCR added; if the resulting
  `activeIngredientKeys` is empty and `inciRaw` is still set, that's a
  valid state (user OCR'd the label but decided none of the detected tags
  were right) — don't clear `inciRaw`.
- `TOGGLE_SECTION` collapses whichever section was previously expanded and
  expands the tapped one — only one section open at a time. Toggling the
  currently-expanded section again collapses it (`expandedSection: null`).

## Also export

```ts
function canSave(state: AddProductDraft): boolean
```
Returns true only when Section 1 (`brand`, `name`, `productType` all set)
and Section 4 (`paoMonths` set) are complete. Section 2 is always
skippable. Section 3 is optional — empty `activeIngredientKeys` is valid.

```ts
function initialDraft(): AddProductDraft
```
Returns a fresh empty draft with `expandedSection: 1` (Section 1 starts
expanded) and all `sectionStatus` values `'empty'`.

## Done when

- Unit tests exist for every action branch, including edge cases called
  out above (manual category not clobbered by later OCR, empty actives
  after a REMOVE, skip auto-collapsing correctly).
- `canSave` and `initialDraft` are tested in isolation with no React
  Native imports required — pure function tests.
