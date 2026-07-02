# Product Spec: Catalog Filtering & PAO Expiry Label
Date: 2026-06-27
Author: planner-agent
Status: APPROVED
TASK-SLUG: shelf-filtering

## AI-SDLC Flags
```
backend_layer:  false
frontend_layer: true
infra_changes:  false
```

---

## 1. Problem Statement

The current `CatalogScreen` exposes only a single text-search input. Users with growing
catalogs (10+ products) cannot narrow results by product category or functional ingredient
class without scrolling or knowing exact names. Additionally, products with a set PAO
(`paoMonths`) and `openedDate` already carry enough data to warn about imminent expiry, but
this information is invisible in the catalog list.

---

## 2. Goals

- Two-row filter header below the search input: category pills (row 1) and biomarker toggle
  badges (row 2).
- AND-logic combining: category × biomarker × search query all narrow the same result set.
- Inline expiry chip on product cards when PAO remaining ≤ 30 days, using the design system
  amber status color and a `Feather` alert-triangle icon.
- Empty-state message distinguishes "catalog is empty" from "no products match current filters".

---

## 3. Non-Goals

- No changes to the `Product` data model — `openedDate` and `paoMonths` already exist.
- No push notifications for expiry (local badge only, no scheduling).
- No changes to `ProductDetailScreen`, routines, or any store.
- No new `ActiveIngredientKey` values — biomarker mapping uses existing keys only (Phase 1).
- No server calls, no new dependencies.

---

## 4. User Stories

### US-20 · Catalog Filtering

**As a** user with a large product catalog
**I want to** filter by type and ingredient function
**So that** I can find a specific product quickly.

**Acceptance criteria:**
- `CatalogFilterHeader` renders category pills `[All] [Serums] [Moisturizers] [SPF]` and
  biomarker badges `[Soothing] [Actives] [Hydration]`.
- Selecting `Serums` + `Actives` shows only serum-type products whose `activeTags` include
  a key in the "Actives" set.
- Biomarker pills are multi-select (AND logic); category pills are single-select.
- Tapping the already-selected category reverts to `All`.
- Clearing all active filters returns the full unfiltered list.
- When no products match the active filter combination, a dedicated empty-state message
  appears: *"No products match the current filters."*
- No emoji anywhere in this component (ANTI-EMOJI POLICY).

### US-20b · PAO Expiry Label

**As a** user who tracks when products were opened
**I want to** see a warning when a product is about to expire
**So that** I can use or replace it before it degrades.

**Acceptance criteria:**
- A PAO chip renders on the product card in `CatalogScreen` when
  `daysRemaining ≤ 30` (including already-expired products).
- Chip text: `"Expires in Xd"` (1–30 days) · `"Expires today"` (0 days) ·
  `"Expired"` (< 0 days).
- Chip uses `<Feather name="alert-triangle" size={12} color="#D97706" />` and
  amber text `#D97706`.
- Products without `openedDate` or `paoMonths` show no chip.
- The chip does not appear in `RoutineStep` lists or anywhere outside `CatalogScreen`.

---

## 5. Out of Scope

- Biomarker detection for Hyaluronic Acid / Centella / Ceramide — those INCI keys are not
  yet stored on products. Hydration biomarker falls back to `productType` heuristic.
- PAO warnings on `ProductDetailScreen` (future iteration).
- Sorting by expiry date.
