# Technical Design: Catalog Redesign — Add Product Hub
Spec: docs/specs/catalog-redesign.md
Author: planner-agent
Date: 2026-06-20

## 1. Architecture Overview

Pure frontend change. No store schema changes — `addProduct`, `updateProduct`,
`removeProduct` in `productsStore` already cover all mutations.

New navigation topology:

```
RootTabNavigator
  └─ CatalogStack (new NativeStack, wraps the Catalog tab)
       ├─ CatalogScreen          ← renamed from ProductsScreen.tsx
       ├─ AddProductHubScreen    ← NEW stack screen (replaces "open modal" from header btn)
       ├─ ProductDetailScreen    ← NEW stack screen
       └─ (BarcodeScannerScreen) ← placeholder stub, gated behind dependency install
```

`AddProductModal` (existing) is retained as a RN `Modal`  `presentationStyle="pageSheet"`
launched from `AddProductHubScreen`. It covers both OBF-search and the manual form;
refactoring it into stack wizard steps is deferred (see Assumptions).

`ProductActionSheet` is a new `Modal`-based bottom sheet (no third-party library).
It is mounted in `CatalogScreen` and in `ProductDetailScreen` as shared state.

Data flow for catalog entry:

  CatalogScreen → (+) btn → AddProductHubScreen
    ├─ search query  → OBF API (existing searchProducts) → result row tap → AddProductModal (form pre-filled)
    ├─ barcode btn   → BarcodeScannerScreen (placeholder)
    └─ manual btn    → AddProductModal (form mode, empty)

  CatalogScreen → card tap → ProductDetailScreen
  CatalogScreen → card ···  → ProductActionSheet → Edit → AddProductModal (pre-filled)
                                                 → Delete → DeleteProductModal (existing)

## 2. API Contracts

N/A — local-only. All mutations via existing Zustand store actions.

## 3. Implementation Tasks

### engineer (scope=frontend)

- FE-1: **Navigation refactor** — create `CatalogStackParamList`:
  `{ Catalog: undefined; AddProductHub: undefined; ProductDetail: { productId: string }; BarcodeScanner: undefined }`.
  Wrap the Catalog tab entry in a `CatalogStack` native stack navigator with
  `headerShown: false` on the tab and per-screen header options.
  Update `RootTabParamList` to use `{ Catalog: undefined }` pointing at the stack,
  not directly at a screen. Add screen registrations for all four routes.
  Files: `src/navigation/AppNavigator.tsx`

- FE-2: **Rename + refactor CatalogScreen** — rename `ProductsScreen.tsx` →
  `CatalogScreen.tsx`; update import in `AppNavigator.tsx`. Change Props type to
  `NativeStackScreenProps<CatalogStackParamList, 'Catalog'>`. Remove the
  `useEffect` `navigation.setOptions` header "+" button. Add a `navigation.navigate`
  call to `'AddProductHub'` from a new `IconButton` (variant=`filled`, size=`md`,
  round=`true`, Feather `plus` icon) placed in `searchWrap` row trailing slot.
  Keep local search filter logic unchanged. Replace flat `Pressable` rows with
  `Card` (variant=`surface`, padding=`sm`, interactive=`true`); inside: name +
  `Tag` (tone=`neutral`) for product type on top row; brand on second row.
  Replace edit/delete `actionBtn` pair with a single `IconButton` (variant=`ghost`,
  size=`sm`, Feather `more-vertical`) that sets `actionTarget` local state.
  Card `onPress` → `navigation.navigate('ProductDetail', { productId: item.id })`.
  Files: `src/screens/CatalogScreen.tsx` (renamed), `src/navigation/AppNavigator.tsx`

- FE-3: **AddProductHubScreen** (`src/screens/AddProductHubScreen.tsx`):
  Stack screen with a native header title "Add Product". Three sections:
  (a) Global search `Input` (Feather `search` icon) — debounce 600 ms, calls
  `searchProducts`; results render as `ListRow` rows with `onPress` that opens
  `AddProductModal` with the OBF result pre-filled (pass via local state
  `pendingObfProduct`). Zero-result state shows inline copy "Not found — add
  manually" with a `Button` (variant=`secondary`) that opens `AddProductModal`
  in form mode.
  (b) `IconButton` (variant=`secondary`, size=`lg`, Feather `aperture` icon,
  label="Scan Barcode") — navigates to `BarcodeScanner` route.
  (c) `Button` (variant=`ghost`, fullWidth) labelled "Add Manually" — opens
  `AddProductModal` in form mode (empty).
  `AddProductModal` is rendered as a child here with local `visible` / `editingProduct`
  state; `onSave` calls `addProduct` store action then `goBack()`.
  Files: `src/screens/AddProductHubScreen.tsx`

- FE-4: **BarcodeScannerScreen placeholder** (`src/screens/BarcodeScannerScreen.tsx`):
  Stub screen (no camera rendering) that shows `InlineAlert` (tone=`warning`)
  with copy "Barcode scanning requires expo-camera. Run: npx expo install expo-camera"
  and a `Button` "Go Back". No camera logic until `expo-camera` is installed.
  Files: `src/screens/BarcodeScannerScreen.tsx`

- FE-5: **ProductActionSheet** (`src/components/product/ProductActionSheet.tsx`):
  RN `Modal` (animationType=`slide`, transparent=`true`). Semi-transparent
  backdrop (`rgba(9,9,11,0.45)`). Inner sheet bottom-anchored, `borderTopLeftRadius`
  / `borderTopRightRadius` = `radius.xl`. Three `ListRow` rows:
  "Edit Product" (Feather `edit-2` leading) → `onEdit(product)` then `onClose()`;
  "Delete Product" (Feather `trash-2` leading, text `colors.statusSOS`) → `onDelete(product)`
  then `onClose()`; "Cancel" (no icon, `divider=false`) → `onClose()`.
  Props type: `{ product: Product | null; onEdit: (p: Product) => void; onDelete: (p: Product) => void; onClose: () => void }`.
  Files: `src/components/product/ProductActionSheet.tsx`

- FE-6: **ProductDetailScreen** (`src/screens/ProductDetailScreen.tsx`):
  `NativeStackScreenProps<CatalogStackParamList, 'ProductDetail'>`. Reads `productId`
  from route params; looks up from `useProductsStore`. If not found → `InlineAlert`
  tone=`sos` + `Button` "Go Back". ScrollView sections: (1) brand (`typography.bodySmall`,
  `textSecondary`) + name (`typography.h2`) + `Tag` for product type; (2) label
  "ACTIVE INGREDIENTS" + each active as `Tag` tone=`info` (empty state: `Tag`
  tone=`neutral` "None detected"); (3) label "FULL FORMULA" + formula text body or
  "Not available" in `textTertiary`; (4) notes section if non-null.
  `navigation.setOptions` mounts `IconButton` (variant=`ghost`, Feather `more-vertical`)
  in `headerRight` that sets `actionSheetVisible` local state.
  Renders `ProductActionSheet` + `DeleteProductModal`; "Edit" opens `AddProductModal`.
  Files: `src/screens/ProductDetailScreen.tsx`

- FE-7: **Dependency note** — `expo-camera` and `expo-image-picker` (needed for
  barcode scan and ingredient-text OCR in a future step) are absent from `package.json`.
  Before activating those features, run:
  `npx expo install expo-camera expo-image-picker`
  No code changes required in this task; the placeholder screens document this.
  Files: `package.json` (update when unblocked, out of scope for this task)

## 4. Assumptions

- Wizard stays as `AddProductModal` (RN `Modal pageSheet`), not refactored into
  separate stack screens.
  Alternative: decompose into `WizardStep1Screen`, `WizardStep2Screen`,
  `WizardStep3Screen` inside `CatalogStack`.
  Reason: the existing modal already handles search→form flow correctly; stack
  wizard gains deeper navigation but introduces back-stack complexity and requires
  rebuilding state-passing between screens. The spec's three-step breakdown can be
  implemented inside the existing modal's form phase with a local `step` counter
  (deferred; out of scope here). The instruction says "decide which is cleaner" —
  modal is cleaner given what is already built.

- `expo-camera` is not installed; `BarcodeScannerScreen` is a placeholder stub.
  Alternative: block the entire Hub feature until camera is installed.
  Reason: shipping the Hub with a graceful stub lets the rest of the UX be tested
  without a native rebuild.

- `AddProductModal.onSave` in `AddProductHubScreen` calls `addProduct` directly
  (not via `ProductsScreen.handleSave`), because the Hub is now the entry point for
  new products. The routine-linking `RoutineTarget` step is preserved inside the modal.
  Alternative: thread `onSave` back through a shared hook.
  Reason: co-locating save logic in the screen that owns the navigation context
  is simpler and avoids cross-screen callback threading.

## 5. Open Questions

No open questions. All decisions resolved above.
