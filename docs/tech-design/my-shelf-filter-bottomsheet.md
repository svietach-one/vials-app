# Technical Design: FE-13: Refactor My Shelf Filters into Categorized Bottom Sheet
Spec: docs/specs/my-shelf-filter-bottomsheet.md
Author: tech-designer
Date: 2026-07-06

## AI-SDLC Flags
```
backend_layer:  false
frontend_layer: true
infra_changes:  false
```

## 1. Architecture Overview

`CatalogScreen.tsx` keeps owning `filterState: CatalogFilterState` as local `useState` (no store change). `CatalogFilterHeader.tsx` is retired; a new compact trigger replaces it, and a new bottom sheet owns a **draft copy** of the filter state, only committing back on Apply:

```
CatalogScreen (filterState: CatalogFilterState, sheetOpen: boolean)
  ├─ CatalogFilterTrigger (badge = activeFilterCount) -> setSheetOpen(true)
  ├─ FlatList (ListHeaderComponent no longer renders chip row)
  └─ FilterSheet (draftState, live count via applyFilters(products, draftState))
       onApply(draftState) -> CatalogScreen.setFilterState
       onClose            -> setSheetOpen(false), draftState discarded
```

`FilterSheet` follows the existing `@gorhom/bottom-sheet` pattern already used in `AddToRoutineSheet.tsx` / `DraftPreviewSheet.tsx` (ref + `visible` prop + `present()`/`dismiss()`), not the plain-`Modal`-based `BottomSheet.tsx`, since it needs the gesture-driven snap/scroll behavior for two chip groups plus a fixed footer.

## 2. API Contracts

No HTTP endpoints (local UI state only).

**`CatalogFilterState` (changed shape, `src/types/index.ts`):**
```ts
export type FunctionalBenefit =
  | 'hydration' | 'exfoliation' | 'soothing' | 'anti_acne' | 'barrier_repair' | 'brightening';

export interface CatalogFilterState {
  searchQuery: string;
  selectedCategory: CategoryFilter;      // unchanged
  selectedBenefits: FunctionalBenefit[]; // replaces selectedBiomarkers: BiomarkerTag[]
}
```

**`FUNCTIONAL_BENEFIT_INGREDIENTS` map (new, `src/constants/labels.ts`):**
```ts
export const FUNCTIONAL_BENEFIT_INGREDIENTS: Record<FunctionalBenefit, ActiveIngredientKey[]> = {
  hydration:      ['hyaluronic_acid', 'panthenol', 'ceramides'],
  exfoliation:    ['aha', 'bha', 'pha', 'retinoid', 'retinol'],
  soothing:       ['cica', 'panthenol', 'azelaic_acid', 'niacinamide'],
  anti_acne:      ['benzoyl_peroxide', 'azelaic_acid', 'bha'],
  barrier_repair: ['ceramides', 'cica', 'copper_peptides', 'panthenol'],
  brightening:    ['vitamin_c_pure', 'vitamin_c_derivative', 'vitamin_c', 'niacinamide', 'azelaic_acid'],
};
```
`spf_filters`/`spf_chemical` are intentionally absent from every bucket — SPF is protection, not a treatment benefit, and was already excluded from the old `ACTIVES_KEYS`/`SOOTHING_KEYS` biomarker lists in `CatalogScreen.tsx`; it stays reachable only via the SPF `ProductType`. Every other `ActiveIngredientKey` appears in at least one bucket (several intentionally appear in more than one — see Assumptions) so this ships with no coverage regression versus today's 3-tag `ACTIVES_KEYS`/`SOOTHING_KEYS`/`HYDRATION_TYPES`.

**`FilterSheet` props (new, `src/components/catalog/FilterSheet.tsx`):**
```ts
interface FilterSheetProps {
  visible: boolean;
  initialState: CatalogFilterState;
  products: Product[];
  onApply: (next: CatalogFilterState) => void;
  onClose: () => void;
}
```

**`CatalogFilterTrigger` props (new, `src/components/catalog/CatalogFilterTrigger.tsx`):**
```ts
interface CatalogFilterTriggerProps {
  activeFilterCount: number;
  onPress: () => void;
}
```

## 3. Implementation Tasks

### engineer (scope=frontend)
- FE-13-1: Update `CatalogFilterState` in `src/types/index.ts` — remove `BiomarkerTag`/`selectedBiomarkers`, add `FunctionalBenefit` and `selectedBenefits: FunctionalBenefit[]`. Update `CATALOG_FILTER_DEFAULT` accordingly. Files: `src/types/index.ts`.
- FE-13-2: Add `FUNCTIONAL_BENEFIT_LABELS: Record<FunctionalBenefit, string>` and `FUNCTIONAL_BENEFIT_INGREDIENTS: Record<FunctionalBenefit, ActiveIngredientKey[]>` next to the existing `ACTIVE_INGREDIENT_LABELS`. Files: `src/constants/labels.ts`.
- FE-13-3: Update `applyFilters` (`src/screens/CatalogScreen.tsx`, lines 66-100, exported module-level function) — replace Gate 3's `Actives`/`Soothing`/`Hydration` special-cased `if` blocks with a single loop over `selectedBenefits` that checks `(p.activeTags ?? []).some((k) => FUNCTIONAL_BENEFIT_INGREDIENTS[benefit].includes(k))`, `return false` if any selected benefit has no match — **preserve the existing AND semantics** (all selected benefits must independently match; do not change to OR). Remove the now-unused `ACTIVES_KEYS`, `SOOTHING_KEYS`, `HYDRATION_TYPES` module constants. Update the destructured param from `selectedBiomarkers` to `selectedBenefits`. Also update `hasActiveFilters` (line 115-118) from `filterState.selectedBiomarkers.length > 0` to `filterState.selectedBenefits.length > 0`. Files: `src/screens/CatalogScreen.tsx`.
- FE-13-4: Create `src/components/catalog/CatalogFilterTrigger.tsx` — Feather `sliders` icon (not `sliders-horizontal`, which does not exist in this icon set) + optional badge dot when `activeFilterCount > 0`, using `space`/`radius`/`colors.statusInfo` tokens, min hit target `space.hitMin`. Files: `src/components/catalog/CatalogFilterTrigger.tsx`.
- FE-13-5: Create `src/components/catalog/FilterSheet.tsx` — `BottomSheetModal` ref/present/dismiss pattern copied from `AddToRoutineSheet.tsx`, `SNAP_POINTS = ['75%']`. Internal `draftState` initialized from `initialState` on each `visible` transition to `true`. Renders Product Type (single-select, all `ProductType` values via `PRODUCT_TYPE_LABELS` plus "All") and Functional Benefit (multi-select, via `FUNCTIONAL_BENEFIT_LABELS`) groups using the existing `FilterChip` component, separated by a divider with `label`-styled section headings. Fixed footer outside the scrollable area: "Clear All" (resets `draftState` to `CATALOG_FILTER_DEFAULT`, does not close) and "Apply Filters (N products)" where `N = applyFilters(products, draftState).length`, recomputed on every `draftState` change; Apply calls `onApply(draftState)` then `onClose()`. Files: `src/components/catalog/FilterSheet.tsx`.
- FE-13-6: Update `src/screens/CatalogScreen.tsx` — remove the `CatalogFilterHeader` import (line 15) and its usage inside `styles.searchWrap`'s `ListHeaderComponent` (line 205), replacing it with `<CatalogFilterTrigger>` rendered inline next to the existing `Input` search field (same `styles.searchWrap` row); add `sheetOpen` state; `activeFilterCount = (filterState.selectedCategory !== 'All' ? 1 : 0) + filterState.selectedBenefits.length`; mount `<FilterSheet>` as a screen-root sibling of the `FlatList` (same nesting level as `DeleteProductModal`/`RoutineSchedulerSheet`), wired to `filterState`/`setFilterState`. `PaoChip` (lines 247+) and `RoutineBadge` are unrelated to this task and stay untouched. Files: `src/screens/CatalogScreen.tsx`.
- FE-13-7: Delete `src/components/catalog/CatalogFilterHeader.tsx` (fully superseded by FE-13-4/FE-13-5).

### engineer (unit tests, scope=frontend)
- FE-13-8: Extend the existing `applyFilters` unit test (co-located per project convention next to `CatalogScreen.tsx`, or `tests/shelf-filtering/CatalogScreen.integration.test.tsx`'s existing `applyFilters`-level assertions — check which already exist before adding, per the `shelf-filtering` task's prior coverage) — covers: no filters returns all products, `selectedCategory` narrows to exact `ProductType` match, single `selectedBenefits` entry matches on `activeTags` intersection with `FUNCTIONAL_BENEFIT_INGREDIENTS`, multiple `selectedBenefits` entries use **AND** semantics (product must match every selected benefit, not just one — mirrors the removed Gate 3 behavior), category and benefit filters combine with AND, product with `activeTags: undefined` never matches any benefit filter, a `retinoid`/`retinol`-tagged product matches `exfoliation`, a `copper_peptides`-tagged product matches `barrier_repair`, a `niacinamide`-tagged product matches both `soothing` and `brightening`. Files: `src/screens/CatalogScreen.tsx`'s co-located test, or the relevant file under `tests/shelf-filtering/`.

## 4. Assumptions

- Filter state stays local `useState` in `CatalogScreen`, not a new Zustand store or `ShelfContext`.
  Alternative: introduce a dedicated `useCatalogFilterStore`.
  Reason: no other screen reads catalog filter state today, it isn't persisted, and the existing pattern (local state, `productsStore.ts` untouched) already works — a store would add indirection with no consumer.

- `BiomarkerTag` (3 values: `Soothing`, `Actives`, `Hydration`) is replaced outright by `FunctionalBenefit` (6 values) mapped to `ActiveIngredientKey[]` via a new constant, rather than kept alongside it.
  Alternative: keep `BiomarkerTag` and add `FunctionalBenefit` as a second, separate filter dimension.
  Reason: the two taxonomies overlap in intent (both are "what it does" filters); replacing avoids shipping two parallel, confusing "benefit-ish" filters. `BiomarkerTag`'s existing ingredient coverage (`ACTIVES_KEYS`, `SOOTHING_KEYS` in `CatalogScreen.tsx`) is fully preserved in the new map — see below — so this is a re-taxonomization, not a loss of filtering capability.

- `hydration` becomes ingredient-based (`hyaluronic_acid`, `panthenol`, `ceramides`) instead of the current `HYDRATION_TYPES` product-type heuristic (`moisturizer`, `cream`, `lotion`, `oil`, `essence`, `toner`).
  Alternative: keep matching on `productType` for `hydration` only, mixing mechanisms across the six benefit buckets.
  Reason: every other bucket is ingredient-based; a product-type heuristic for just one bucket would silently exclude, e.g., a hydration-focused serum, and having one uniform matching mechanism (`activeTags` intersection) across all six benefits is simpler to reason about and test than a mixed mechanism. This is a deliberate behavior change from the currently-shipped `shelf-filtering` task, not an oversight.

- `retinoid`/`retinol` are placed under `exfoliation`; `copper_peptides` is placed under `barrier_repair`; `niacinamide` is placed under both `soothing` and `brightening`.
  Alternative: leave any of these four keys unmapped (as the 6-benefit list given in the request has no dedicated "anti-aging" or "barrier" analog to the old catch-all `Actives`/`Soothing` tags).
  Reason: leaving them unmapped would silently drop retinoid, retinol, copper-peptide, and niacinamide products from every functional-benefit filter — a regression versus today's `ACTIVES_KEYS`/`SOOTHING_KEYS` coverage. Retinoids accelerate cell turnover (commonly grouped with exfoliation in consumer skincare copy), copper peptides are marketed specifically for barrier/regeneration support, and niacinamide is dual-purpose (calming + brightening) in both clinical literature and existing product marketing copy — so placing it in two buckets reflects real usage rather than an arbitrary choice.

## 5. Open Questions

No open questions — both technical decisions above are Type B/C gaps with no API/DB/migration impact, resolved as assumptions. Ready for `qa-lead`.
