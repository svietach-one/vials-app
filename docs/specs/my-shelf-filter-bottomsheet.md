# FE-13: Refactor My Shelf Filters into Categorized Bottom Sheet
Date: 2026-07-06
Author: planner-agent
Jira: N/A (kebab-case task slug per agent-layer-protocol.md: `my-shelf-filter-bottomsheet`)
Status: APPROVED

## 1. Problem Statement
The "My Shelf" catalog screen (`CatalogScreen.tsx`) currently exposes filtering through a single horizontal `ScrollView` of chips (`CatalogFilterHeader.tsx`) that mixes two unrelated taxonomies in one row: `ProductType` (18 values — cleanser, serum, SPF, etc.) and a 3-value `BiomarkerTag` set. As the product-type list grows, the row scrolls further off-screen, chips for the two taxonomies are visually indistinguishable, and a user cannot tell at a glance whether any filter is currently active. There is no way to combine "what it is" and "what it does" filtering without horizontal scanning through an unbounded chip list.

## 2. Goals
- Replace the always-visible horizontal chip row with a single filter trigger icon next to the search field, reclaiming header vertical space.
- Split filtering into two clearly labeled, independently-scoped groups: Product Type (single-select) and Functional Benefit (multi-select).
- Let the user preview how many products match their in-progress selection before committing it to the visible list.
- Make active-filter state visible at a glance via a badge on the trigger icon, without opening the sheet.

## 3. Non-Goals (explicitly out of scope)
- Persisting filter selections across app restarts or navigation away from `CatalogScreen` — filter state remains session/screen-local, same as today.
- Saved filter presets or named filter combinations — single ad-hoc selection only.
- Search-query changes — the existing search input and its matching logic are untouched by this task.
- Sorting controls (e.g. by name, date added) — this task is filtering only.
- Any change to how conflict/ingredient detection works — this only changes how existing `Product` fields (`productType`, `activeTags`) are used to filter the visible list.

## 4. User Stories

### Story 1: Open filters from a compact trigger
As a user browsing My Shelf, I want a single filter icon next to the search bar instead of a permanent chip row, so that the header stays compact and I can tell at a glance whether any filter is active.

**Acceptance Criteria:**
- [ ] Given no filters are active, when the My Shelf header renders, then the filter trigger icon shows no badge.
- [ ] Given at least one product-type or functional-benefit filter is active, when the My Shelf header renders, then the filter trigger icon shows a badge indicator.
- [ ] Given I tap the filter trigger icon, when the tap registers, then a bottom sheet opens showing the current filter selection (not reset to defaults).

### Story 2: Select filters across two independent groups
As a user, I want to filter by product type and by functional benefit at the same time, so that I can find, for example, "serums that help with brightening" in one pass.

**Acceptance Criteria:**
- [ ] Given the filter sheet is open, when I view it, then Product Type options render as a single-select group (selecting one option deselects any previously selected option, including "All").
- [ ] Given the filter sheet is open, when I view it, then Functional Benefit options render as a multi-select group, independent of the Product Type selection.
- [ ] Given I select more than one Functional Benefit, when the live count and the applied list are computed, then only products matching **all** selected benefits are included (AND semantics) — this preserves the existing biomarker filter's combination rule (`applyFilters`'s Gate 3 in `CatalogScreen.tsx`), it is not changed to "any of."
- [ ] Given I select a product type and one or more benefits, when I view the sheet's footer, then the "Apply Filters" button shows the live count of products matching the current in-progress selection, updating immediately as I toggle options — before I tap Apply.
- [ ] Given I have made selections in the sheet, when I tap outside the sheet or swipe it down without tapping Apply, then the main shelf list is unchanged (no filters committed).

### Story 3: Apply and clear filters
As a user, I want to commit my filter choices or reset them in one tap, so that I don't have to deselect options one by one.

**Acceptance Criteria:**
- [ ] Given I have selected filters in the sheet, when I tap "Apply Filters (N products)", then the sheet closes and the main shelf list shows exactly the N products previously counted.
- [ ] Given filters are active (committed) when I reopen the sheet, when I tap "Clear All", then both groups reset to their defaults (Product Type → All, Functional Benefit → none) within the sheet without closing it, and the live count updates to the full catalog size.
- [ ] Given I tap "Clear All" then tap "Apply Filters", when the sheet closes, then the main shelf list shows the full, unfiltered catalog and the trigger icon badge disappears.

## 5. UX / Behaviour
**Entry point:** filter trigger icon (sliders icon) placed inline next to the existing search input in `CatalogScreen`'s header, replacing the horizontal chip row entirely.

**Sheet layout, top to bottom:**
1. Section heading "PRODUCT TYPE" + single-select chip group (all `ProductType` values plus "All").
2. Divider.
3. Section heading "BENEFITS" + multi-select chip group (Hydration, Exfoliation, Soothing, Anti-Acne, Barrier Repair, Brightening).
4. Fixed footer (does not scroll with content): "Clear All" (secondary/text style, left) and "Apply Filters (N products)" (primary, right).

**States:**
- Empty result state: if the in-progress selection yields 0 products, the Apply button still renders but shows "Apply Filters (0 products)" — not disabled, so the user can intentionally commit to an empty view; the main shelf's existing empty-state UI (whatever `CatalogScreen` already shows for an empty product list) is reused, not a new one.
- Reopening the sheet always shows the last **committed** state, never a fresh default, unless the user explicitly tapped Clear All previously.

## 6. Data Requirements
- New data needed: a `FunctionalBenefit` classification is not currently derivable label-for-label from stored data — it must be computed from the existing `Product.activeTags: ActiveIngredientKey[]` field via a new static mapping (no new fields on `Product`, no migration).
- Existing data consumed: `Product.productType`, `Product.activeTags` (`src/types/index.ts`).
- Data retention: none — filter selections are in-memory only, not written to `AsyncStorage`.

## 7. Dependencies
- Depends on spec: none (extends existing, unspecced `CatalogScreen` behavior).
- Blocks: nothing downstream.
- External services: none.

## 8. Security & Privacy
- Authentication required: no.
- Data sensitivity: none new — filters operate only on already-local product metadata.
- Compliance considerations: none.

## 9. Success Metrics
- Header vertical space occupied by filter controls drops from a permanent scrollable row to a single icon (qualitative layout check, verified in code review / screenshot diff).
- Zero reports of users being unable to find a product-type option that exists in `ProductType` (full enum coverage in the sheet, vs. today's chip row which is functionally complete but visually unscannable).

## 10. Open Questions
No open questions — the two ambiguous technical points (filter-state ownership location, functional-benefit-to-ingredient mapping) were resolved as engineering assumptions in the tech design and do not require product-owner input; neither affects API, database, or migrations.
