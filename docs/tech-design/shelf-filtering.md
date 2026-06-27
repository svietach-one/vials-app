# Technical Design: Catalog Filtering & PAO Expiry Label
Spec: docs/specs/shelf-filtering.md
Author: planner-agent
Date: 2026-06-27
TASK-SLUG: shelf-filtering

## 1. Architecture Overview

All logic is local to `CatalogScreen` and two new artefacts:

```
CatalogScreen
  ├── filterState: CatalogFilterState   (local useState)
  ├── CatalogFilterHeader               (controlled, no own state)
  │     ├── Row 1: category pills       (ScrollView horizontal)
  │     └── Row 2: biomarker badges     (View flex-row wrap)
  ├── applyFilters(products, filterState) → Product[]   (inline pure fn)
  └── renderItem
        └── PaoChip (inline sub-component)
                └── computePaoStatus() ← src/utils/paoHelpers.ts
```

Data flow: `filterState` drives `applyFilters` on every render (no debounce needed —
list is local/synchronous). `CatalogFilterHeader` is a pure controlled component; the
screen owns all state and passes `onFilterChange` down.

## 2. API Contracts

N/A — no network calls, no backend changes.

## 3. Implementation Tasks

### engineer (scope=frontend) — FE-1: Types

Add to `src/types/index.ts`:

```typescript
export type CategoryFilter = 'All' | 'Serums' | 'Moisturizers' | 'SPF';
export type BiomarkerTag = 'Soothing' | 'Actives' | 'Hydration';

export interface CatalogFilterState {
  searchQuery: string;
  selectedCategory: CategoryFilter;
  selectedBiomarkers: BiomarkerTag[];
}

export const CATALOG_FILTER_DEFAULT: CatalogFilterState = {
  searchQuery: '',
  selectedCategory: 'All',
  selectedBiomarkers: [],
};
```

Files: `src/types/index.ts`

---

### engineer (scope=frontend) — FE-2: PAO utility + unit tests

**`src/utils/paoHelpers.ts`**

```
export interface PaoStatus {
  daysRemaining: number   // negative means already expired
  isExpired: boolean      // daysRemaining < 0
  isExpiringSoon: boolean // 0 ≤ daysRemaining ≤ 30
}

computePaoStatus(openedDate: string, paoMonths: number, now?: Date): PaoStatus
  - Parse openedDate as UTC midnight (openedDate + 'T00:00:00.000Z')
  - Compute expiry: copy parsed date, call setUTCMonth(month + paoMonths)
  - Compute todayUTC: parse now.toISOString().split('T')[0] + 'T00:00:00.000Z'
  - daysRemaining = Math.ceil((expiry - todayUTC) / MS_PER_DAY)
  - Return { daysRemaining, isExpired: daysRemaining < 0,
             isExpiringSoon: daysRemaining >= 0 && daysRemaining <= 30 }

getProductPaoStatus(product: Product): PaoStatus | null
  - Guard: if !product.openedDate || !product.paoMonths: return null
  - Guard: if product.paoMonths <= 0: return null
  - return computePaoStatus(product.openedDate, product.paoMonths)
```

**`src/utils/paoHelpers.test.ts`** — test cases:
- product with paoMonths null → null
- opened 31 days ago, paoMonths=1 → isExpired true
- opened 25 days ago, paoMonths=1 → isExpiringSoon true, daysRemaining=5
- opened 60 days ago, paoMonths=3 → isExpiringSoon false, isExpired false
- opened today, paoMonths=1 → daysRemaining≈30, isExpiringSoon true

Files: `src/utils/paoHelpers.ts`, `src/utils/paoHelpers.test.ts`

---

### engineer (scope=frontend) — FE-3: CatalogFilterHeader component

**`src/components/catalog/CatalogFilterHeader.tsx`**

Props interface:
```typescript
interface CatalogFilterHeaderProps {
  filterState: CatalogFilterState;
  onFilterChange: (next: CatalogFilterState) => void;
}
```

Category constants (define at module level inside the file):
```typescript
const CATEGORIES: CategoryFilter[] = ['All', 'Serums', 'Moisturizers', 'SPF'];
const BIOMARKERS: BiomarkerTag[] = ['Soothing', 'Actives', 'Hydration'];
```

Category pill toggle logic:
```
onPressCategory(cat):
  next = (cat === filterState.selectedCategory && cat !== 'All') ? 'All' : cat
  onFilterChange({ ...filterState, selectedCategory: next })
```

Biomarker badge toggle logic:
```
onPressBiomarker(tag):
  current = filterState.selectedBiomarkers
  next = current.includes(tag)
    ? current.filter(t => t !== tag)
    : [...current, tag]
  onFilterChange({ ...filterState, selectedBiomarkers: next })
```

Visual states (pill + badge shared pattern):
```
selected → backgroundColor: colors.textPrimary, text: colors.textOnDark
unselected → backgroundColor: transparent, borderWidth:1,
             borderColor: colors.borderStrong, text: colors.textSecondary
```

Layout:
```
<View style={{ gap: space[2], paddingBottom: space[3] }}>
  <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: space[2], paddingHorizontal: space.gutterScreen }}>
    {CATEGORIES.map(cat => <CategoryPill .../>)}
  </ScrollView>
  <View style={{ flexDirection:'row', flexWrap:'wrap', gap: space[2],
                 paddingHorizontal: space.gutterScreen }}>
    {BIOMARKERS.map(tag => <BiomarkerBadge .../>)}
  </View>
</View>
```

Files: `src/components/catalog/CatalogFilterHeader.tsx`

---

### engineer (scope=frontend) — FE-4: CatalogScreen wiring

**`src/screens/CatalogScreen.tsx`** changes:

1. Replace `const [searchText, setSearchText] = useState('')` with:
   ```typescript
   const [filterState, setFilterState] = useState<CatalogFilterState>(CATALOG_FILTER_DEFAULT);
   ```

2. Replace inline filter logic with `applyFilters(products, filterState)` (pure function
   defined above `CatalogScreen`):

   ```
   applyFilters(products, { searchQuery, selectedCategory, selectedBiomarkers }):
     return products.filter(p => {
       // 1. Text search — OR across name / brand / activeTags labels
       if searchQuery.trim():
         q = searchQuery.trim().toLowerCase()
         match = p.name.toLowerCase().includes(q)
               || (p.brand ?? '').toLowerCase().includes(q)
               || (p.activeTags ?? []).some(k => ACTIVE_INGREDIENT_LABELS[k].toLowerCase().includes(q))
         if !match: return false

       // 2. Category — AND with text
       if selectedCategory !== 'All':
         if !CATEGORY_PRODUCT_TYPES[selectedCategory].includes(p.productType): return false

       // 3. Biomarkers — ALL selected must pass (AND logic)
       for biomarker of selectedBiomarkers:
         if biomarker === 'Actives':
           if !(p.activeTags ?? []).some(k => ACTIVES_KEYS.includes(k)): return false
         if biomarker === 'Soothing':
           if !(p.activeTags ?? []).some(k => SOOTHING_KEYS.includes(k)): return false
         if biomarker === 'Hydration':
           if !HYDRATION_TYPES.includes(p.productType): return false

       return true
     })
   ```

   Constants to define at module level above `applyFilters`:
   ```typescript
   const CATEGORY_PRODUCT_TYPES: Record<Exclude<CategoryFilter,'All'>, ProductType[]> = {
     Serums:       ['serum', 'essence', 'ampoule'],
     Moisturizers: ['moisturizer', 'cream', 'lotion', 'oil'],
     SPF:          ['spf'],
   };
   const ACTIVES_KEYS: ActiveIngredientKey[] =
     ['retinol', 'aha', 'bha', 'vitamin_c', 'benzoyl_peroxide'];
   const SOOTHING_KEYS: ActiveIngredientKey[] = ['niacinamide', 'copper_peptides'];
   const HYDRATION_TYPES: ProductType[] =
     ['moisturizer', 'cream', 'lotion', 'oil', 'essence', 'toner'];
   ```

3. In `ListHeaderComponent`: replace `<Input ...>` wrapper with:
   ```tsx
   <View style={styles.searchWrap}>
     <Input value={filterState.searchQuery}
            onChangeText={(t) => setFilterState(s => ({ ...s, searchQuery: t }))} ... />
     <CatalogFilterHeader filterState={filterState} onFilterChange={setFilterState} />
   </View>
   ```

4. Add inline `PaoChip` sub-component (below `RoutineBadge`):
   ```tsx
   function PaoChip({ product }: { product: Product }) {
     const pao = getProductPaoStatus(product);
     if (!pao || (!pao.isExpired && !pao.isExpiringSoon)) return null;
     const label = pao.isExpired
       ? 'Expired'
       : pao.daysRemaining === 0 ? 'Expires today' : `Expires in ${pao.daysRemaining}d`;
     return (
       <View style={paoStyles.row}>
         <Feather name="alert-triangle" size={12} color={PAO_AMBER} />
         <Text style={paoStyles.text}>{label}</Text>
       </View>
     );
   }
   const PAO_AMBER = '#D97706';
   ```
   Render `<PaoChip product={item} />` on the line below `brand` inside `renderItem`.

5. Update `CatalogEmptyState` to accept `hasActiveFilters: boolean`:
   - When true and `hasProducts`: render *"No products match the current filters."*

6. Pass `hasActiveFilters` from screen:
   ```typescript
   const hasActiveFilters =
     filterState.searchQuery.trim() !== '' ||
     filterState.selectedCategory !== 'All' ||
     filterState.selectedBiomarkers.length > 0;
   ```

Files: `src/screens/CatalogScreen.tsx`

---

### engineer (unit tests) — FE-5: applyFilters tests

Co-locate a unit test at `src/screens/CatalogScreen.test.ts` covering:
- text search match / no-match
- category filter includes / excludes correct types
- biomarker Actives filters correctly (product with activeTags vs without)
- AND logic: Serums + Actives excludes serum with no activeTags
- all filters off → returns full array

Files: `src/screens/CatalogScreen.test.ts`

## 4. Assumptions

- Biomarker `Hydration` uses `productType` heuristic (not HA activeTag).
  Alternative: add `hyaluronic_acid` to `ActiveIngredientKey`.
  Reason: existing products have no HA tag stored; the type heuristic covers
  the most common hydration products without requiring re-tagging.

- Biomarker `Soothing` maps to existing `niacinamide` + `copper_peptides` keys.
  Alternative: map to centella/ceramide, but those keys don't exist yet.
  Reason: Phase 1 scope; only existing keys are safe to query.

- Month overflow (e.g. Jan 31 + 1 = Mar 3) uses JS `setUTCMonth` default behavior.
  Alternative: snap to end-of-month.
  Reason: edge case; cosmetic PAO doesn't require day-precise accuracy.

- PAO amber uses literal `#D97706` (Tailwind amber-600), not `palette.amber (#A84C0E)`.
  Alternative: add a new `palette.amber600` token.
  Reason: single-use; adding a token is engineer's call, not a design blocker.

## 5. Open Questions

No open questions — all resolvable from existing types and design tokens.
