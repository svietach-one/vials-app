# Technical Design: Decouple Routine Assignment from Manual Product Form
Spec: docs/specs/decouple-routine-from-form.md
Author: planner-agent
Date: 2026-06-22

## 1. Architecture Overview

This task is a scoped cleanup of one screen file. No new modules are created.
`ManualProductFormScreen.tsx` is modified in-place: the `RoutineTargetPicker`
sub-component, `useRoutineLinking` hook call, `routineTarget` state, and
`ROUTINE_TARGET_OPTIONS` constant are all removed. The `addProduct` post-save
navigation changes from `navigation.navigate('Catalog')` to
`navigation.replace('ProductDetail', { productId: product.id })`.
`useRoutineLinking.ts` is deleted — it will have no remaining callers.

```
Before:
  ManualProductFormScreen
    ├── RoutineTargetPicker (inline sub-component)
    ├── useRoutineLinking  (hook — adds product to routine on save)
    └── handleSave → addProduct → navigate('Catalog')

After:
  ManualProductFormScreen
    └── handleSave → addProduct → replace('ProductDetail', { productId })

ProductDetailScreen (unchanged)
    └── RoutineSchedulerSheet (already wired — routine assignment lives here)
```

The INCI banner notices are also cleaned up: emoji characters (`⚠️`) are
replaced with `<Feather name="alert-triangle">` + text rows using two new
`formStyles` keys (`inciNoticeRow`, `inciNoticeOcrTitleRow`).

---

## 2. API Contracts

N/A — no new or changed API endpoints, store actions, or navigation routes.

**Interface delta:**
- `RoutineTarget` import removed from `ManualProductFormScreen.tsx` (type
  definition in `src/types/index.ts` is unchanged).
- `ManualProductFormScreen` component signature is unchanged — same props,
  same `CatalogStackParamList` route params.

---

## 3. Implementation Tasks

### engineer (scope=frontend)

- FE-1: Remove `RoutineTargetPicker` sub-component and related constants.
  - Delete the `RoutineTargetPicker` function component and its
    `RoutineTargetPickerProps` interface from the file.
  - Delete the `ROUTINE_TARGET_OPTIONS` constant array.
  - Remove `RoutineTarget` from the import in `src/types`.
  - Remove `chipFlex`, `routineRow` from `chipStyles` (only used by the picker).
  - Files: `src/screens/ManualProductFormScreen.tsx`

- FE-2: Remove `useRoutineLinking` hook from the screen and delete the hook file.
  - Remove the `import { useRoutineLinking }` line.
  - Remove `const { addProductToRoutine } = useRoutineLinking()` call.
  - Remove `routineTarget` state declaration and its `setRoutineTarget` setter.
  - Remove the `addProductToRoutine(product, routineTarget)` call from `handleSave`.
  - Delete the file `src/hooks/useRoutineLinking.ts`.
  - Files: `src/screens/ManualProductFormScreen.tsx`, `src/hooks/useRoutineLinking.ts`

- FE-3: Update post-save navigation for add mode.
  - In `handleSave`, after `addProduct(product)` is called, replace
    `navigation.navigate('Catalog')` with
    `navigation.replace('ProductDetail', { productId: product.id })`.
  - Edit mode path (`isEditMode === true`) continues to call `navigation.goBack()` — no change.
  - Files: `src/screens/ManualProductFormScreen.tsx`

- FE-4: Replace emoji with Feather icon in INCI notice banners.
  - In the standard INCI notice (`inciNotice` style block): wrap the existing
    `<Text>` in a `<View style={formStyles.inciNoticeRow}>` that leads with
    `<Feather name="alert-triangle" size={12} color={colors.statusWarning} />`.
  - In the OCR "Scanner Demo Mode" notice: replace the single `<Text>` with a
    `<View style={formStyles.inciNoticeOcrTitleRow}>` row containing the icon
    and `<Text style={formStyles.inciNoticeOcrTitle}>Scanner Demo Mode</Text>`.
  - Add two new `formStyles` keys: `inciNoticeRow` and `inciNoticeOcrTitleRow`
    (both: `flexDirection: 'row', alignItems: flex-start/center, gap: space[2]`).
  - Files: `src/screens/ManualProductFormScreen.tsx`

### engineer (unit tests)

- UT-1: No new business-logic utilities are introduced or changed in this task.
  The `useRoutineLinking` hook is deleted; its unit tests (if any exist under
  `src/hooks/`) should be deleted alongside the source file. QA-lead owns
  component-level integration tests for the updated save navigation flow.

---

## 4. Assumptions

- The post-save navigation uses `navigation.replace` (not `navigate`) so the
  form screen is popped off the stack, preventing the user from pressing back
  into a blank form after saving.
  Alternative: use `navigation.navigate('ProductDetail', ...)`.
  Reason: `replace` matches the UX intent — the form is finished; it should not
  appear in the back stack. Consistent with the existing OBF pre-fill path.

- `ROUTINE_TARGET_OPTIONS` and `RoutineTargetPicker` are removed entirely with
  no hint text left in the form (e.g. "You can add this to a routine from the
  product page").
  Alternative: leave a brief informational note so users know where to go.
  Reason: `ProductDetailScreen` already renders the "Add to Routine" button
  immediately after save. An extra hint is redundant and adds visual noise.

- `useRoutineLinking.ts` is deleted outright — not deprecated with a comment.
  Alternative: keep the file with a `@deprecated` JSDoc pointing to `routinesStore`.
  Reason: the hook is wholly superseded by `upsertProductStep` /
  `removeProductStep` on the store; a deprecated file creates confusion.

---

## 5. Open Questions

No open questions — all decisions resolved in assumptions above.
