# Decouple Routine Assignment from Manual Product Form
Date: 2026-06-22
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

The manual product form (`ManualProductFormScreen`) currently bundles routine assignment into the save step. Users must choose a routine target (Skip / AM / PM / AM & PM) inline inside the form before saving. This creates two problems:

1. The inline `RoutineTargetPicker` assumes users know which routine they want at the moment of product creation, before they have had a chance to think about scheduling. Many users default to "Skip" and never return to assign the product, leaving their routines incomplete.
2. The `useRoutineLinking` hook tightly couples product-save logic with routine-store mutations, making both harder to test and reason about in isolation. After save, the user is navigated to the catalog root, losing the product context they just created.

The `RoutineSchedulerSheet` (shipped in `routine-scheduler-sheet`) now provides a purpose-built, discoverable place to assign and manage schedules from `ProductDetailScreen`. The form no longer needs a redundant, lower-quality version of the same affordance.

---

## 2. Goals

- Saving a new product navigates the user directly to that product's detail page so they can immediately review it and optionally schedule it via `RoutineSchedulerSheet`.
- The manual product form contains no routine-assignment UI — it is scoped to product data only.
- The `useRoutineLinking` hook and `RoutineTargetPicker` sub-component are fully removed; no dead code remains.
- Editing an existing product (`isEditMode = true`) continues to navigate back after save without regression.
- INCI notice banners replace emoji characters with proper Feather icon + text rows for consistency with the design system.

---

## 3. Non-Goals

- No changes to `RoutineSchedulerSheet`, `routinesStore`, or routine logic.
- No changes to the product save / update logic in `productsStore`.
- No changes to `ProductDetailScreen` — it already has `RoutineSchedulerSheet` wired.
- No changes to any navigation stack or route definitions.
- No changes to OBF pre-fill, OCR scan, active ingredient detection, or any other form field.
- No changes to the `RoutineTarget` type in `src/types/index.ts` — it is used elsewhere.

---

## 4. User Stories

### Story 1: Save new product and land on Product Detail

As a user who just created a product manually, I want to be taken to the product's detail page after saving so that I can immediately review it and add it to my routine with a single tap.

**Acceptance Criteria:**
- Given I am on `ManualProductFormScreen` in add mode (no `editingProductId`), when I fill in the product name and tap "Add to Catalog", then the screen navigates to `ProductDetailScreen` for the newly created product.
- Given I land on `ProductDetailScreen` after save, when I see the footer button, then it reads "Add to Routine" (the product is not yet in any routine).
- Given I tap "Add to Routine" on `ProductDetailScreen`, then the `RoutineSchedulerSheet` opens and I can assign the product to a routine without leaving the product context.

### Story 2: Routine assignment picker is no longer present in the form

As a user filling in the manual product form, I want the form to be focused on product information only so that I am not asked to make routine decisions before I have finished entering the product.

**Acceptance Criteria:**
- Given I open `ManualProductFormScreen` in add mode, when the form renders, then there is no "Add to Routine" section, no Skip/AM/PM/AM&PM chip row, and no routine-related UI of any kind.
- Given I open `ManualProductFormScreen` in edit mode, when the form renders, then there is no "Add to Routine" section (was already hidden in edit mode, now removed entirely).
- Given `ManualProductFormScreen` is rendered, when the component tree is inspected, then `useRoutineLinking`, `RoutineTargetPicker`, `RoutineTarget` import, and `ROUTINE_TARGET_OPTIONS` are all absent.

### Story 3: Edit mode save still navigates back correctly

As a user editing an existing product, I want tapping "Save Changes" to navigate back to the product detail page so I can see my updated information.

**Acceptance Criteria:**
- Given I am on `ManualProductFormScreen` with a valid `editingProductId`, when I tap "Save Changes", then `updateProduct` is called and the screen navigates back (`navigation.goBack()`).
- Given I navigate back from edit mode, when `ProductDetailScreen` re-renders, then it shows the updated product name, type, and ingredients.

### Story 4: INCI notice banners use Feather icons instead of emoji

As a user reading the ingredient scanning notice, I want the warning to use a proper icon consistent with the rest of the app so that the interface feels polished and accessible.

**Acceptance Criteria:**
- Given the INCI field is visible with no prior OCR scan, when the notice banner renders, then it shows a `Feather name="alert-triangle"` icon beside the warning text — no emoji character.
- Given the INCI field shows the "Scanner Demo Mode" OCR notice, when it renders, then it shows a `Feather name="alert-triangle"` icon beside the "Scanner Demo Mode" label — no emoji character.

---

## 5. UX / Behaviour

**Add mode save flow (after change):**
1. User fills in product name (required) and optional fields.
2. User taps "Add to Catalog".
3. `addProduct(product)` is called on the store.
4. `navigation.replace('ProductDetail', { productId: product.id })` navigates to the new product's detail page.
5. `ProductDetailScreen` renders with the "Add to Routine" footer button. The user can tap it to open `RoutineSchedulerSheet` and set a schedule in one more step.

**Edit mode save flow (unchanged):**
1. User edits fields and taps "Save Changes".
2. `updateProduct(product.id, product)` is called.
3. `navigation.goBack()` returns to `ProductDetailScreen`.

**Removed form section:**
The "Add to Routine" segmented control row (Skip / AM / PM / AM & PM) is completely removed from the form. No replacement placeholder or hint is added. The footer button on `ProductDetailScreen` is sufficient discovery.

**INCI notice banners:**
Both the standard INCI notice and the OCR "Scanner Demo Mode" notice replace emoji characters with a `<View>` row containing `<Feather name="alert-triangle" size={12} color={colors.statusWarning} />` followed by the text. New style keys `inciNoticeRow`, `inciNoticeOcrTitleRow` are added to `formStyles`.

**Error states:**
- If `addProduct` fails (not currently possible in local-only store), the existing form validation (empty name check) is the only guard. No new error states introduced.
- Edit mode: `goBack()` is a no-op if there is nothing to go back to (handled by React Navigation implicitly).

---

## 6. Data Requirements

- No new data fields.
- No new store actions.
- No new AsyncStorage keys.
- `useRoutineLinking` hook (`src/hooks/useRoutineLinking.ts`) is deleted entirely — no callers will remain.
- `RoutineTarget` type import is removed from `ManualProductFormScreen.tsx` — the type itself stays in `src/types/index.ts` as it is used by other components.

---

## 7. Dependencies

- Depends on: `RoutineSchedulerSheet` being wired into `ProductDetailScreen` (completed in `routine-scheduler-sheet` task).
- Depends on: `navigation.replace` being available in the `CatalogStackParamList` (confirmed — `ProductDetail` is an existing route in the stack).
- Blocks: nothing — this is a cleanup/improvement with no downstream dependencies.
- External services: none.

---

## 8. Security & Privacy

- Authentication required: no.
- Data sensitivity: none — routine data stays local; this change has no data-handling implications.
- Compliance: no PII affected.

---

## 9. Success Metrics

- After adding a product, the user lands on `ProductDetailScreen` and can assign it to a routine in one additional tap (total: fill name, tap "Add to Catalog", tap "Add to Routine", pick routine — 4 taps max).
- Zero TypeScript compilation errors after the removal of `useRoutineLinking` and `RoutineTargetPicker`.
- No `routineTarget` state, `ROUTINE_TARGET_OPTIONS` constant, or `addProductToRoutine` call appears anywhere in `ManualProductFormScreen.tsx`.

---

## 10. Open Questions

- None. All decisions are resolved: the `RoutineSchedulerSheet` on `ProductDetailScreen` is the canonical routine-assignment surface. The form is scoped to product data only.
