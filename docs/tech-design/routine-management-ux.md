# Technical Design: Routine Management UX
Spec: docs/specs/routine-management-ux.md
Author: planner-agent
Date: 2026-06-22

## 1. Architecture Overview

All changes are confined to the frontend layer. No new stores, no new
AsyncStorage keys, no API calls.

Data flow:
  ProductDetailScreen
    ↓ reads routinesStore.routines + productsStore.products (reactive selectors)
    ↓ derives schedule via deriveProductSchedule() (existing util)
    ↓ renders footer buttons based on schedule.morning || schedule.evening
    ↓ opens RoutineSchedulerSheet (existing component, unchanged)
         → calls upsertProductStep / removeProductStep on save
         → routinesStore emits new state → CatalogScreen RoutineBadge re-renders

ManualProductFormScreen:
  Remove USAGE_OPTIONS constant, usageTime state, and the "Usage Time"
  SegmentedControl render block. Hardcode usageTime: 'both' in handleSave.

New component: RemoveRoutineActionSheet — thin wrapper around ActionSheetIOS /
Alert.alert for platform-consistent multi-routine removal prompts.

```
ManualProductFormScreen  (remove Usage Time block)
ProductDetailScreen      (add footer: Add / Edit / Remove buttons)
  └─ RoutineSchedulerSheet  (existing, no changes)
  └─ RemoveRoutineActionSheet  (new, wraps RN Alert/ActionSheetIOS)
```

## 2. API Contracts

N/A — no network API. Store actions used:

- `useRoutinesStore.upsertProductStep(routineId, productId, productType, scheduledDays)`
- `useRoutinesStore.removeProductStep(routineId, productId)`
- `useRoutinesStore.routines` (reactive selector)

Utility reads:
- `deriveProductSchedule(routines, productId)` → ProductSchedule
- `formatRoutineLabel(schedule)` → string | null

## 3. Implementation Tasks

### Phase 1 — Cleanup: Remove "Usage Time" from ManualProductFormScreen

**FE-1: Remove Usage Time block from ManualProductFormScreen**
Files: `src/screens/ManualProductFormScreen.tsx`
- Delete the `USAGE_OPTIONS` constant array.
- Delete `const [usageTime, setUsageTime]` state declaration.
- In the `useEffect` pre-fill block, delete the `setUsageTime(editingProduct.usageTime)` and
  `setUsageTime('both')` lines (prefillOBFProduct branch).
- In `handleSave`, replace the `usageTime` variable reference with the
  literal string `'both'`.
- Remove the entire `<View style={formStyles.fieldGroup}>` block that contains
  the `<Text>Usage Time</Text>` label and `<SegmentedControl ... />`.
- Remove `formStyles.routineRow` if it is not referenced elsewhere.

Edge cases:
  - Do NOT remove the `SegmentedControl` import if it is used elsewhere in
    the file. Check first; it appears only in the Usage Time block, so it
    can be removed.
  - Do NOT touch `RoutineSchedulerSheet` render at the bottom of the file;
    it still renders after a new product is saved.

### Phase 2 — ProductDetailScreen: Routine management footer

**FE-2: Subscribe to routinesStore in ProductDetailScreen**
Files: `src/screens/ProductDetailScreen.tsx`
- Add import: `useRoutinesStore` from `@/store/routinesStore`.
- Add import: `deriveProductSchedule`, `formatRoutineLabel` from
  `@/utils/routineLabel`.
- Add reactive selector: `const routines = useRoutinesStore((s) => s.routines)`.
- Derive `const schedule = deriveProductSchedule(routines, productId)` inside
  the render body (below the `product` null-guard).
- Derive `const routineLabel = formatRoutineLabel(schedule)` — null means
  "not in any routine".

**FE-3: Add routine footer buttons to ProductDetailScreen**
Files: `src/screens/ProductDetailScreen.tsx`
- Add local state: `const [schedulerVisible, setSchedulerVisible] = useState(false)`.
- Add local state: `const [removeSheetVisible, setRemoveSheetVisible] = useState(false)`.
- Below the closing `</ScrollView>` tag and before `<ProductActionSheet>`,
  insert a footer `<View>` (same pattern as ManualProductFormScreen footer):
    - If `routineLabel === null`: render a single full-width primary `<Button>`
      labelled "Add to Routine" that sets `schedulerVisible` to true.
    - If `routineLabel !== null`: render two items stacked:
        1. Full-width secondary `<Button>` with the routineLabel text, onPress
           sets `schedulerVisible` to true.
        2. A `<Pressable>` text link ("Remove from Routine") styled in
           `colors.statusSOS`, onPress sets `removeSheetVisible` to true.
- Import `RoutineSchedulerSheet` and mount it:
  ```
  visible={schedulerVisible}
  productId={product.id}
  productType={product.productType}
  onClose={() => setSchedulerVisible(false)}
  ```
- Import `RemoveRoutineActionSheet` (created in FE-4) and mount it:
  ```
  visible={removeSheetVisible}
  product={product}
  routines={routines}
  onClose={() => setRemoveSheetVisible(false)}
  ```

Edge cases:
  - `product` is null guard already exits early, so `schedule` derivation is
    always after the guard — safe.
  - `formatRoutineLabel` truncates long day lists gracefully; no additional
    truncation needed.

**FE-4: Create RemoveRoutineActionSheet component**
Files: `src/components/routine/RemoveRoutineActionSheet.tsx` (new file)

Props interface:
```
interface RemoveRoutineActionSheetProps {
  visible: boolean;
  product: Product;
  routines: Routine[];
  onClose: () => void;
}
```

Logic inside the component (pure render logic, no store subscription):
- Derive which routines contain the product:
    `const inMorning = routines.some(r => r.timeOfDay === 'morning' && r.steps.some(s => s.productId === product.id))`
    `const inEvening = routines.some(r => r.timeOfDay === 'evening' && r.steps.some(s => s.productId === product.id))`
- Subscribe to store action: `const removeProductStep = useRoutinesStore((s) => s.removeProductStep)`.
- On `visible` becoming true:
    - If `inMorning && inEvening` (both): fire `ActionSheetIOS.showActionSheetWithOptions`
      on iOS or an `Alert.alert` on Android with options:
        "Remove from Morning", "Remove from Evening", "Remove from All Routines", "Cancel"
    - If only one routine: fire `Alert.alert` with a destructive confirm:
      "Remove [product.name] from your [Morning/Evening] routine?" with OK/Cancel.
- On each confirm action, resolve the matching routine ids from the `routines`
  prop and call `removeProductStep` for each.
- Always call `onClose` after the action completes or is cancelled.

Platform note: use `Platform.OS === 'ios'` to branch between ActionSheetIOS
and Alert. No third-party library needed.

### Phase 3 — Reactivity verification

**FE-5: Verify CatalogScreen RoutineBadge re-renders**
Files: `src/screens/CatalogScreen.tsx` (read-only verification, no edits expected)
- CatalogScreen already subscribes to `useRoutinesStore((s) => s.routines)` and
  passes it to `getProductRoutineStatus`. Because `removeProductStep` and
  `upsertProductStep` both call `set({ routines })` on the Zustand store,
  CatalogScreen will reactively re-render with no additional wiring.
- If during implementation the badge is confirmed to update correctly, this
  task is a no-op. If it does not update, add a selector optimization
  (shallow equality) to the routines selector in CatalogScreen.

### Phase 4 — UX polish & style

**FE-6: Style the routine footer on ProductDetailScreen**
Files: `src/screens/ProductDetailScreen.tsx`
- Add a `footer` style entry matching the ManualProductFormScreen footer pattern:
  `paddingHorizontal: space.gutterScreen`, `paddingVertical: space[4]`,
  `borderTopWidth: 1`, `borderTopColor: colors.borderDivider`,
  `backgroundColor: colors.bgBase`, `gap: space[3]`.
- Style the "Remove from Routine" Pressable link:
  `typography.bodySmall`, `fontFamily: 'DMSans-Medium'`, `color: colors.statusSOS`,
  `textAlign: 'center'`, `paddingVertical: space[2]`.
- Apply `accessibilityRole="button"` on the remove Pressable.

## 4. Assumptions

- usageTime field on Product is kept as 'both' sentinel and not removed.
  Alternative: remove the field entirely from the type and all save paths.
  Reason: field removal requires a data migration for existing stored products;
  that is a separate task to avoid scope creep here.

- RemoveRoutineActionSheet is a new component, not inline Alert calls in
  ProductDetailScreen.
  Alternative: call Alert.alert directly inside ProductDetailScreen.
  Reason: keeping imperative Alert calls in a dedicated component makes
  ProductDetailScreen easier to read and the action logic independently testable.

- RoutineSchedulerSheet is used unchanged for both the "Add" and "Edit" entry points.
  Alternative: create separate "AddToRoutine" and "EditRoutine" sheet variants.
  Reason: the existing sheet already pre-populates from store state on open,
  making a single component sufficient for both cases.

## 5. Open Questions

No open questions. All scope decisions confirmed by product owner (2026-06-22).
