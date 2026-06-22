# Technical Design: Add Product UX — 2-Step State Machine
Spec: docs/specs/add-vial-ux.md
Author: planner-agent
Date: 2026-06-21

## 1. Architecture Overview

This is a self-contained refactor of a single file: `src/components/product/AddProductModal.tsx`. No new files are created. No store changes. No navigation changes. The modal's internal `Mode` type is renamed and its first render phase is replaced with a richer hub view. An optional `onScanBarcode` callback is added to `AddProductModalProps` so that a parent screen (currently `AddProductHubScreen`) can wire up navigation to `BarcodeScannerScreen` if desired.

```
AddProductHubScreen  (caller — unchanged)
    |
    └── <AddProductModal
            visible={modalVisible}
            prefillOBFProduct={prefillOBF}
            onClose={closeModal}
            onSave={handleSave}
            onScanBarcode={() => navigation.navigate('BarcodeScanner')}  ← NEW (optional)
        />

Inside AddProductModal:
    mode: 'hub' | 'form'   (renamed from 'search' | 'form')
    STEP_1 (mode === 'hub')  → renderHubPhase()   (replaces renderSearchPhase)
    STEP_2 (mode === 'form') → renderFormPhase()  (unchanged logic, back link now targets 'hub')
```

All OBF search state, debounce effects, form field state, handlers, sub-components, and StyleSheet blocks remain untouched. Only the structural pieces listed in Section 3 are modified.

---

## 2. API Contracts

N/A — no new or changed API endpoints. The OBF search call signature and internal search state are unchanged.

**Interface delta only:**
```typescript
// AddProductModalProps — one new optional field added
export interface AddProductModalProps {
  visible: boolean;
  editingProduct?: Product | null;
  prefillOBFProduct?: OBFProduct | null;
  onClose: () => void;
  onSave: (product: Product, routineTarget: RoutineTarget) => void;
  onScanBarcode?: () => void;   // NEW — optional, backwards-compatible
}

// Mode type — rename only
type Mode = 'hub' | 'form';    // was: 'search' | 'form'
```

---

## 3. Implementation Tasks

### engineer (scope=frontend)

- FE-1: Rename `Mode` type and update all references.
  - Change `type Mode = 'search' | 'form'` to `type Mode = 'hub' | 'form'`.
  - In `useState<Mode>('search')` init: change initial value to `'hub'`.
  - In the `useEffect` reset block (the `else` branch for new product): change `setMode('search')` to `setMode('hub')`.
  - In `selectOBFProduct`: the existing `setMode('form')` call is unchanged.
  - In the root render: change `mode === 'search'` to `mode === 'hub'`.
  - In the header title expression: change the `mode === 'form'` ternary so `'hub'` maps to `'Find Product'` (same string as today's `'search'` branch).
  - Files: `src/components/product/AddProductModal.tsx`

- FE-2: Add `onScanBarcode` to `AddProductModalProps` and destructure it in the component.
  - Add `onScanBarcode?: () => void` to the interface JSDoc and field list.
  - Destructure `onScanBarcode` in `AddProductModal` function signature.
  - Files: `src/components/product/AddProductModal.tsx`

- FE-3: Replace `renderSearchPhase()` with `renderHubPhase()`.
  - Rename the function to `renderHubPhase`.
  - Keep the entire existing search input + results block unchanged (all `searchStyles.*` references stay).
  - Remove the existing `manualWrap` / `manualLink` block (the "Product not found? Add manually →" row) from inside the `ScrollView` — it is replaced by the button-card rows below.
  - After the `ScrollView` closing tag (the results scroll), add a non-scrolling `View` with two tappable button-card rows:
    - Row 1 — Scan Barcode: `Feather name="aperture"` icon, title "Scan Barcode", subtitle "Look up by barcode", right `Feather name="chevron-right"`. `onPress`: call `onScanBarcode?.()` then `onClose()`.
    - Row 2 — Create Product Manually: `Feather name="edit-3"` icon, title "Create Product Manually", subtitle "Enter details yourself", right `Feather name="chevron-right"`. `onPress`: `setMode('form')`.
  - Both rows use `accessibilityRole="button"` with descriptive `accessibilityLabel` values.
  - Files: `src/components/product/AddProductModal.tsx`

- FE-4: Update `renderFormPhase()` back-button target.
  - The existing condition `!editingProduct && !prefillOBFProduct` stays identical.
  - Change the `onPress` handler from `setMode('search')` to `setMode('hub')`.
  - The back link label "Back to search" remains unchanged.
  - Files: `src/components/product/AddProductModal.tsx`

- FE-5: Add hub-specific styles to `searchStyles`.
  - Add style entries for the two button-card rows. Model the visual pattern after `AddProductHubScreen`'s `actionRow` / `actionIconWrap` / `actionContent` / `actionTitle` / `actionSubtitle` styles, adapting token values as needed. All new entries are additive — no existing `searchStyles` entries change.
  - Suggested new keys: `hubActions`, `actionCard`, `actionCardPressed`, `actionIconBox`, `actionCardTitle`, `actionCardSubtitle`.
  - Files: `src/components/product/AddProductModal.tsx`

- FE-6: Wire `onScanBarcode` in `AddProductHubScreen` (the primary caller).
  - Locate the `<AddProductModal ... />` JSX in `src/screens/AddProductHubScreen.tsx`.
  - Add the `onScanBarcode` prop: `onScanBarcode={() => navigation.navigate('BarcodeScanner')}`.
  - No other changes to that file.
  - Files: `src/screens/AddProductHubScreen.tsx`

### engineer (unit tests)

- UT-1: The refactor touches no pure business-logic utilities (`conflictEngine`, `ingredientParser`, `timeHelpers`), so no new unit tests are required under the `frontend-testing` scope. QA-lead owns integration/component tests for the modal's state transitions.

---

## 4. Assumptions

- The `manualWrap` / `manualLink` block is removed from `renderHubPhase` without replacement in the search results area.
  Alternative: keep it as a third text-link fallback below the two button-card rows.
  Reason: the two button-card rows make the manual-entry affordance visually prominent; a redundant text link would create duplicate affordances and visual noise.

- The modal calls `onClose()` before invoking `onScanBarcode?.()` when the Scan Barcode card is tapped.
  Alternative: let the parent call `onClose()` from within the `onScanBarcode` callback.
  Reason: the modal owns its own dismissal; calling `onClose()` first ensures the sheet is gone before the camera screen appears, avoiding z-index stacking issues on iOS.

- Search text state (`searchText`, `debouncedQuery`, `searchResults`) is NOT reset when the user taps "Back to search" from STEP_2.
  Alternative: clear search text on back-navigation.
  Reason: preserving search context is lower friction — if a user typed a query, went to form, and came back, they likely want to refine the same search, not start over.

- No footer is rendered in STEP_1 (hub mode). The "Add to Catalog" button only appears in STEP_2.
  Alternative: render a disabled "Add to Catalog" button in STEP_1 to hint at the end goal.
  Reason: a disabled button with no selection context is uninformative; omitting it reduces visual noise and avoids a confusing tap target.

---

## 5. Open Questions

No open questions — all decisions resolved in the assumptions above. The two engineer-level choices (order of `onClose`/`onScanBarcode` calls; search text preservation on back) are addressed in Assumptions and do not require product sign-off.
