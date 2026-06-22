# Add Product UX — 2-Step State Machine Refactor
Date: 2026-06-21
Author: planner-agent
Status: APPROVED

## AI-SDLC Flags
```
backend_layer:  false
frontend_layer: true
infra_changes:  false
```

---

## 1. Problem Statement

The current `AddProductModal` uses a binary `Mode` type (`'search' | 'form'`) where the search phase contains an inline "Add manually" text link tucked at the bottom of the results scroll. There is no barcode scanning entry point inside the modal. Users who want to scan a barcode must navigate away to `AddProductHubScreen` (a separate stack screen) — but the modal is also opened from `AddProductHubScreen` itself, creating a flow mismatch. The "Add manually" affordance is visually low-priority (small link text, discoverable only after scrolling), and the two action paths (barcode scan, manual entry) have unequal visual weight. The modal needs a clearly structured first step that presents all three addition methods — search, scan, and manual — with equal visual prominence before committing the user to the form.

---

## 2. Goals

- The modal's entry view (`STEP_1: ADDITION_HUB`) shows the OBF search input with inline results AND two visually prominent button-card rows for Scan Barcode and Create Product Manually.
- Selecting a search result or tapping "Create Product Manually" transitions the modal to the form step (`STEP_2: MANUAL_FORM`).
- Tapping "Scan Barcode" calls an optional `onScanBarcode` prop so the parent can navigate to `BarcodeScannerScreen`; the modal closes gracefully.
- A "Back to search" link in the form step returns the user to STEP_1 whenever the modal was opened for a fresh add (not edit, not OBF pre-fill).
- The "Add to Catalog" button is absent or disabled in STEP_1 and becomes active in STEP_2 once `name.trim()` is non-empty.
- All existing edit mode, OBF pre-fill, OCR scan, debounce, and save logic remains unchanged.

---

## 3. Non-Goals

- No changes to `AddProductHubScreen`, `BarcodeScannerScreen`, `CatalogScreen`, or any navigation file.
- No new OCR library or `OcrScannerSheet` component — the existing `handleMockOcrScan` / `InciField` pattern is preserved as-is.
- No changes to `handleSave`, `onSave`, `RoutineTarget`, store interactions, or any data model.
- No changes to the existing four `StyleSheet` blocks (`styles`, `searchStyles`, `formStyles`, `chipStyles`) — only additive style entries are permitted.
- No changes to the sub-components `InciField`, `IngredientChips`, or `RoutineTargetPicker`.
- No server calls, no new dependencies, no new files outside `AddProductModal.tsx`.

---

## 4. User Stories

### Story 1: Discover addition methods from the modal entry step
As a user opening the Add Product modal for a new product, I want to see search, barcode scan, and manual entry as equally visible options so that I can choose my preferred method without scrolling.

**Acceptance Criteria:**
- Given the modal opens with `editingProduct` null and `prefillOBFProduct` null, when STEP_1 renders, then a search input is visible at the top AND two button-card rows ("Scan Barcode" and "Create Product Manually") are visible below the search results area.
- Given the modal is in STEP_1, when no product has been selected, then the "Add to Catalog" button is not rendered or is rendered in a disabled state.
- Given the modal is in STEP_1, when the user types fewer than 3 characters, then the hint text "Type at least 3 characters to search Open Beauty Facts" is shown and the two button-card rows remain visible below it.
- Given the modal is in STEP_1, when the user types 3 or more characters and results load, then search results appear above the two button-card rows.

### Story 2: Navigate to barcode scanner from within the modal
As a user who wants to scan a barcode, I want to tap a clearly visible "Scan Barcode" button inside the modal so that I can reach the camera scanner without leaving the add flow.

**Acceptance Criteria:**
- Given the modal is in STEP_1, when the user taps the "Scan Barcode" button-card, then `onScanBarcode` is called (if provided) and `onClose` is called so the modal closes and the parent can navigate to `BarcodeScannerScreen`.
- Given `onScanBarcode` is not provided (prop omitted), when the user taps "Scan Barcode", then only `onClose` is called — no crash, no navigation error.
- Given `AddProductModalProps`, then `onScanBarcode` is typed as `(() => void) | undefined` (optional prop) and its absence does not break any existing caller that does not pass it.

### Story 3: Transition to manual form and return to hub
As a user who wants to create a product manually, I want to tap "Create Product Manually" to open the form and be able to return to the search step if I change my mind.

**Acceptance Criteria:**
- Given the modal is in STEP_1, when the user taps "Create Product Manually", then the modal transitions to STEP_2 (`mode === 'form'`) and the full manual form is rendered.
- Given the modal is in STEP_2 and `editingProduct` is null and `prefillOBFProduct` is null, when the form renders, then a "Back to search" link is visible at the top of the form scroll view.
- Given the user taps "Back to search", when `mode` returns to `'hub'`, then the search input, search results, and the two button-card rows are visible again and the search text is preserved.
- Given the modal is in STEP_2 and `editingProduct` is non-null, when the form renders, then the "Back to search" link is NOT rendered.
- Given the modal is in STEP_2 and `prefillOBFProduct` is non-null, when the form renders, then the "Back to search" link is NOT rendered.

### Story 4: Enable the save button only when a product name is entered
As a user in the manual form step, I want the "Add to Catalog" button to be disabled until I type a product name so that I cannot accidentally save an empty product.

**Acceptance Criteria:**
- Given the modal is in STEP_2 and `name.trim()` is empty, when the form footer renders, then the "Add to Catalog" `Button` has `disabled={true}`.
- Given the modal is in STEP_2 and `name.trim()` is non-empty, when the form footer renders, then the "Add to Catalog" `Button` has `disabled={false}`.
- Given the modal is in STEP_1, when no mode === 'hub', then no "Add to Catalog" button appears in the footer area.

### Story 5: Edit mode and OBF pre-fill skip STEP_1 unchanged
As a user editing an existing product or being directed from an OBF search result, I want the modal to go directly to the form without showing the hub step, preserving the existing flow.

**Acceptance Criteria:**
- Given `editingProduct` is non-null when the modal opens, when the modal renders, then `mode` is set to `'form'` directly and STEP_1 is never rendered.
- Given `prefillOBFProduct` is non-null when the modal opens, when the modal renders, then `mode` is set to `'form'` directly and STEP_1 is never rendered.
- Given the modal opens in edit mode and is dismissed and then re-opened for a fresh add, when the `useEffect` reset block runs, then `mode` is reset to `'hub'`.

---

## 5. UX / Behaviour

**STEP_1 (Addition Hub) layout — top to bottom:**
1. Modal header: "Find Product" (same title as today's search mode).
2. Search input with leading search icon (same as today's `renderSearchPhase` input).
3. Search results list OR state text (loading, hint, no results, failed) — same logic as today.
4. Visual separator or spacing gap.
5. Button-card row: icon (`aperture` or `camera`) + "Scan Barcode" label + subtitle "Look up by barcode" + right chevron. Tapping calls `onScanBarcode?.()` then `onClose()`.
6. Button-card row: icon (`edit-3` or `plus`) + "Create Product Manually" label + subtitle "Enter details yourself" + right chevron. Tapping calls `setMode('form')`.
7. No footer button visible.

**STEP_2 (Manual Form) layout — top to bottom:**
1. Modal header: "Add Product" (or "Edit Product" in edit mode) — same as today.
2. "Back to search" pressable row with left arrow, shown only when `!editingProduct && !prefillOBFProduct`. Tapping sets `mode` to `'hub'`.
3. Full form fields: Product Name, Brand, Product Type chips, INCI field with OCR button, Active Ingredients chips, Usage Time segmented control, Routine Target picker (new add only).
4. Footer with "Add to Catalog" / "Save Changes" Button.

**Error states:**
- If OBF search fails in STEP_1: the error hint text appears in the results area; the two button-card rows remain visible below it, offering a clear manual fallback.
- If the user taps "Add to Catalog" in STEP_2 without a product name (edge case — button is disabled, but if somehow triggered): the existing `setNameError` / scroll-to-top logic fires unchanged.

**Back-navigation after scan:**
- The modal closes when the user taps "Scan Barcode". The parent (`AddProductHubScreen` or any future caller) receives the `onScanBarcode` callback and is responsible for calling `navigation.navigate('BarcodeScanner')`. The modal does not perform navigation itself.

---

## 6. Data Requirements

- No new data fields, no new store interactions, no new AsyncStorage or MMKV keys.
- The `AddProductModalProps` interface gains one optional field: `onScanBarcode?: () => void`.
- The internal `Mode` type changes from `'search' | 'form'` to `'hub' | 'form'`. This is a purely local, module-scoped type with no serialization.

---

## 7. Dependencies

- Depends on: existing `AddProductModal.tsx` (802 lines) — this task refactors it in-place.
- Depends on: `BarcodeScannerScreen` existing at `src/screens/BarcodeScannerScreen.tsx` — confirmed present.
- Depends on: existing design tokens (`colors`, `space`, `typography`, `radius`) — all used as-is.
- Depends on: `Button`, `Input`, `Feather` icons — all already imported in the file.
- Blocks: nothing — this is a leaf UI refactor.
- External services: none new.

---

## 8. Security & Privacy

- Authentication required: no.
- Data sensitivity: none — this change is purely structural UI; no data model changes.
- The `onScanBarcode` prop is a void callback with no payload; it carries no user data.

---

## 9. Success Metrics

- Zero TypeScript compilation errors (`npx tsc --noEmit`) after the change.
- All existing callers of `AddProductModal` that do not pass `onScanBarcode` continue to compile and function without modification.
- Tapping "Scan Barcode" in STEP_1 calls `onScanBarcode` (when provided) and closes the modal — verified manually on simulator.
- Tapping "Create Product Manually" transitions to STEP_2 and the form is fully functional.
- "Back to search" in STEP_2 (fresh add) returns to STEP_1 with search text intact.
- Edit mode and OBF pre-fill still open directly to the form with no regression.

---

## 10. Open Questions

- [ ] Should "Scan Barcode" in the modal also call `onClose()` before invoking `onScanBarcode`, or should the parent dismiss the modal itself? Current design: the modal calls `onClose()` then `onScanBarcode?.()`. If the parent needs the modal dismissed first to avoid z-index conflicts, this is the safest order. Owner: engineer — resolve during implementation.
- [ ] Should the search text be cleared when the user taps "Back to search" from STEP_2, or preserved? Current design: preserved (no `setSearchText('')` in the back handler). If the product name field was populated manually and the user goes back, their search context is still there. Owner: engineer — can decide during implementation; no product sign-off needed.
