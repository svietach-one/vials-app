# Technical Design: Product Shelf Card
Spec: docs/specs/product-shelf-card.md
Author: planner-agent
Date: 2026-06-29

## 1. Architecture Overview

`ProductShelfCard` is a pure presentational component. It receives all derived state
as props from the parent screen (e.g., CatalogScreen), which reads from `useRoutineStore`
to compute `isInRoutine`, `scheduleLabel`, and `usageTime`. No Zustand subscription
occurs inside the card itself — this keeps the card stateless and trivially testable.

The overflow action sheet is handled by extending `ProductActionSheet` with two
optional callback props (`onAddToRoutine`, `onRemoveFromRoutine`) that replace the
existing `onToggleHidden` slot on the shelf context. The original `onToggleHidden`
remains available for the existing catalog usage. No new modal component is created.

```
CatalogScreen
  └─ reads useRoutineStore, useProductStore
  └─ derives [isInRoutine, scheduleLabel, usageTime] per product
  └─ renders ProductShelfCard (props only, no store access)
       └─ ProductActionSheet (extended — optional routine action props)
```

## 2. API Contracts

No new API endpoints. This is a frontend-only component feature.

### ProductShelfCard props interface

```ts
export interface ProductShelfCardProps {
  product: Product;
  /** True when productId appears in any RoutineStep across all routines. */
  isInRoutine: boolean;
  /** Output of formatScheduleDays(scheduledDays). Only used when isInRoutine=true. */
  scheduleLabel: string;
  /** Derived from product.usageTime. Only shown when isInRoutine=true. */
  usageTime: 'morning' | 'evening' | 'both';
  onCardPress: () => void;
  onEdit: (p: Product) => void;
  onAddToRoutine: (p: Product) => void;
  onRemoveFromRoutine: (p: Product) => void;
  onDelete: (p: Product) => void;
  disabled?: boolean;
}
```

### ProductActionSheet extended props (additive, backward-compatible)

```ts
// Added to existing ProductActionSheetProps — no existing fields removed
onAddToRoutine?: (p: Product) => void;
onRemoveFromRoutine?: (p: Product) => void;
```

When `onAddToRoutine` or `onRemoveFromRoutine` is provided, the second row of the
sheet renders "Add to routine" / "Remove from routine" instead of "Hide / Show".
When both are absent the sheet behaves exactly as before (Hide/Show row).

## 3. Implementation Tasks

### engineer (scope=frontend)

- FE-1: Create `src/components/product/ProductShelfCard.tsx`.
  Copy `TYPE_COLORS` map and badge `StyleSheet` entries verbatim from
  `RoutineStepCard`. Implement the three-row layout and two middle-row states.
  Files: `src/components/product/ProductShelfCard.tsx`

- FE-2: Extend `ProductActionSheet` with optional `onAddToRoutine` /
  `onRemoveFromRoutine` props. Render the routine row only when either callback
  is provided; otherwise retain the existing Hide/Show row. Guard with
  `if (product)` before invoking either callback.
  Files: `src/components/product/ProductActionSheet.tsx`

- FE-3: Wire up `ProductShelfCard` in the catalog list screen. For each product,
  derive `isInRoutine`, `scheduleLabel` (via `formatScheduleDays`), and
  `usageTime` from `useRoutineStore().routines` before passing as props.
  Files: `src/screens/CatalogScreen.tsx` (or equivalent shelf screen)

### engineer (unit tests, scope=frontend)

- FE-4: Write utility tests for the parent-side derivation logic (not the component
  itself) — specifically the inline `isInRoutine` derivation and `scheduleLabel`
  computation, co-located with their source utilities.
  Files: `src/utils/routineLabel.test.ts` (extend existing if present)

## 4. Assumptions

- Props are pre-computed by the parent, not derived inside the card.
  Alternative: card subscribes to `useRoutineStore` and computes `isInRoutine` internally.
  Reason: Keeps the card stateless and eliminates hidden store coupling; parent
  screens already iterate routines for other purposes, so the derivation cost is zero.

- `ProductActionSheet` is extended rather than duplicated.
  Alternative: create a separate `ProductShelfActionSheet`.
  Reason: The sheets are 90% identical in markup and styles; optional props cost
  nothing and avoid maintaining two near-identical modal components.

- The "Hidden from routine" state is shown for both `isHidden: true` AND
  `isInRoutine: false` (i.e., not assigned to any step).
  Alternative: separate visual states for each condition.
  Reason: From the user's shelf perspective the outcome is the same — the product
  has no routine presence. A single state label is less confusing.

- `usageTime` is taken directly from `product.usageTime` (the field already exists
  on `Product`); no new field or derivation is needed.
  Alternative: derive from the matching `RoutineStep`'s routine `timeOfDay`.
  Reason: `product.usageTime` is the user's declared intent and is always present;
  routine-step-based derivation would require passing step references through props.

## 5. Open Questions

No open questions. All decisions resolved above.
