# Technical Design: Hide Product (BottomShield)
Spec: docs/specs/hide-vial-bottomshield.md
Author: planner-agent
Date: 2026-06-22

## 1. Architecture Overview

This is a purely frontend change. No new stores, no new screens.

Data flow: user taps ActionSheet toggle -> `updateProduct(id, { isHidden })` ->
`useProductsStore` patches in-memory state + persists to AsyncStorage ->
`CatalogScreen` re-renders card with dimmed content layer ->
`RoutinesScreen` derived step arrays exclude the hidden product's steps.

Modules touched:
- `src/types/index.ts` — add optional `isHidden` field to `Product`
- `src/components/product/ProductActionSheet.tsx` — add toggle row
- `src/screens/CatalogScreen.tsx` — split card into opacity layers; show `eye-off` badge
- `src/screens/RoutinesScreen.tsx` — extend `amSteps`/`pmSteps` filter

No new files are required.

```
[ProductActionSheet] --onHide--> [useProductsStore.updateProduct]
                                        |
                          patches Product.isHidden -> AsyncStorage
                                        |
              [CatalogScreen]  <--- re-render: dim content, keep IconButton opaque
              [RoutinesScreen] <--- re-derive: filter steps by product.isHidden
```

## 2. API Contracts

N/A — local-only, no HTTP endpoints.

## 3. Implementation Tasks

### engineer (scope=frontend)

- FE-1: Extend `Product` interface — add `isHidden?: boolean` to `src/types/index.ts`.

- FE-2: Add hide/show toggle row to `ProductActionSheet` — files:
  `src/components/product/ProductActionSheet.tsx`.
  - Accept `onToggleHidden: (p: Product) => void` prop alongside existing `onEdit`/`onDelete`.
  - Accept `product` (already present) to read `product.isHidden` for label/icon branching.
  - Insert a row between "Edit" and "Delete": icon `eye-off`/`eye`, label "Hide Product"/"Show Product".
  - Row calls `onToggleHidden(product)` then closes the sheet.

- FE-3: Wire `ProductActionSheet.onToggleHidden` in `CatalogScreen` — files:
  `src/screens/CatalogScreen.tsx`.
  - Handler: `updateProduct(p.id, { isHidden: !p.isHidden })`.
  - Pass handler to `<ProductActionSheet onToggleHidden={...} />`.

- FE-4: Render hidden card state in `CatalogScreen.renderItem` — files:
  `src/screens/CatalogScreen.tsx`.
  - Wrap existing `cardContent` View with `opacity: item.isHidden ? 0.4 : 1`.
  - Add `eye-off` Feather icon (size 12, color `colors.textTertiary`) to `nameRow` when `item.isHidden`.
  - `IconButton` (three-dot) must remain in a sibling `View` outside the dimmed layer, always `opacity: 1`.

- FE-5: Filter hidden products from routine steps in `RoutinesScreen` — files:
  `src/screens/RoutinesScreen.tsx`.
  - Extend the `amSteps` and `pmSteps` filter predicates:
    add `&& !(step.productId && products.find(p => p.id === step.productId)?.isHidden)`.

### engineer (unit tests)

- FE-1 through FE-5 ship without dedicated unit tests per `frontend-testing` rules (no
  pure business-logic utility functions are introduced). QA integration tests cover the
  toggle flow end-to-end.

## 4. Assumptions

- `isHidden` defaults to `false` when absent on legacy records.
  Alternative: add a migration that sets `isHidden: false` on all existing products.
  Reason: the store already handles undefined gracefully via `updateProduct` merging only
  changed fields; adding a migration for a boolean default adds unnecessary complexity.

- The hide toggle row is always rendered in `ProductActionSheet` (not conditionally).
  Alternative: render only when a product is in an active routine step.
  Reason: simpler component — avoids prop-drilling routine state into the action sheet.

- Catalog list order is unchanged after hiding.
  Alternative: push hidden products to the bottom of the list.
  Reason: out of scope per spec non-goals; sorting belongs to a future filter/sort feature.

## 5. Open Questions

No open questions.
