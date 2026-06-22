# Hide Product (BottomShield)
Date: 2026-06-22
Author: planner-agent
Status: DRAFT

## 1. Problem Statement

Users occasionally want to stop applying a product temporarily — because they have run out,
are in a clinical rehab window, or are on a product rotation — without permanently removing it
from their catalog. Currently the only removal action is hard-delete, which loses all metadata
(ingredients, PAO date, notes). There is no reversible "pause" mechanism.

## 2. Goals

- Users can soft-hide any product from the ProductActionSheet without deleting it.
- Hidden products are visually distinguished in the catalog so users know they are paused, not gone.
- Hidden products are automatically excluded from all routine step lists.
- Users can un-hide a product from the same ActionSheet at any time.

## 3. Non-Goals

- Hiding does NOT remove the product from the data store or affect routine step records.
- Hidden products are NOT moved to a separate "archived" section or tab — they stay in the main catalog list.
- The hide/show action does NOT cascade to routine scheduling (days, order) — those are preserved.
- This feature does NOT introduce any push notifications or reminders about hidden products.
- Conflict warnings for hidden products are NOT suppressed; that is a separate feature decision.

## 4. User Stories

### Story 1: Hide an active product
As a user, I want to hide a product so that it disappears from my routine steps without losing its catalog entry.

**Acceptance Criteria:**
- [ ] Given a visible product, when I tap the three-dot menu and select "Hide Product", then the ProductActionSheet closes and the product card renders at opacity 0.4 with an `eye-off` icon next to the product name.
- [ ] Given I hide a product, when the Routines screen renders AM or PM steps, then no step referencing that product appears in the step list.
- [ ] Given I hide a product, when I re-open the ProductActionSheet for that card, then the toggle row shows "Show Product" with an `eye` icon instead of "Hide Product".

### Story 2: Restore a hidden product
As a user, I want to unhide a previously hidden product so that it re-enters my routine steps.

**Acceptance Criteria:**
- [ ] Given a hidden product, when I tap the three-dot menu and select "Show Product", then the card returns to full opacity and the `eye-off` icon is removed.
- [ ] Given I unhide a product, when the Routines screen renders, then any routine step referencing that product becomes visible again in the step list (subject to the step's own `hidden` flag and `scheduledDays`).

### Story 3: Three-dot button remains interactive on hidden cards
As a user, I want to still be able to access the context menu on a dimmed card so that I can restore it.

**Acceptance Criteria:**
- [ ] Given a hidden product card, the `IconButton` (three-dot) renders at full opacity 1.0 and is pressable.
- [ ] Given a hidden product card, tapping outside the `IconButton` area navigates to ProductDetail (same as a visible card).

## 5. UX / Behaviour

**Catalog card — hidden state:**
- The card content layer (name, brand, tag) renders at `opacity: 0.4`.
- A small `eye-off` Feather icon (size 12, color `colors.textTertiary`) appears immediately to the left of the product name within the `nameRow`.
- The `IconButton` (three-dot) sits in a separate sibling `View` with its own `opacity: 1.0`, not inheriting from the dimmed content layer.
- No separate "hidden" section; the card stays in place in the flat list.

**ProductActionSheet — toggle row:**
- Positioned between the existing "Edit Product" row and the "Delete Product" row.
- When product is visible: icon `eye-off`, label "Hide Product", text color `colors.textPrimary`.
- When product is hidden: icon `eye`, label "Show Product", text color `colors.textPrimary`.
- Tapping the row calls `updateProduct(id, { isHidden: !product.isHidden })` then `onClose()`.

**Routines screen filtering:**
- `amSteps` and `pmSteps` derivations gain an additional filter: exclude steps where `products.find(p => p.id === step.productId)?.isHidden === true`.
- A hidden product whose routine step was already filtered via `step.hidden` is not double-counted in any UI badge.

**Error / edge states:**
- If `isHidden` is undefined on a legacy product record, treat it as `false` (product is visible). No migration needed.
- Hiding then deleting a product: delete wins — the product is removed. No orphan handling required.

## 6. Data Requirements

- New field on `Product` interface: `isHidden?: boolean` (optional, backward-compatible).
- No new storage keys; the field is persisted inside the existing `STORAGE_KEYS.products` AsyncStorage entry via `updateProduct`.
- No migration script required; absence of the field is treated as `false`.

## 7. Dependencies

- Depends on: existing `ProductActionSheet`, `useProductsStore.updateProduct`, Feather icon set.
- Blocks: nothing downstream.
- External services: none.

## 8. Security & Privacy

- Authentication required: no (local-only app, Phase 1).
- Data sensitivity: user product list is local device storage only.
- Compliance: no PII or health data involved in this field.

## 9. Success Metrics

- A user can hide and restore a product in under 3 taps.
- Zero regression: existing Edit and Delete flows continue to work after the new row is inserted.
- Routine step counts are accurate: hidden product steps do not appear in AM/PM counts.

## 10. Open Questions

- None. All scoping decisions are resolved above.
