Status: COMPLETE
Tech Design: docs/tech-design/shelf-filtering.md
Code: src/utils/paoHelpers.ts, src/components/catalog/CatalogFilterHeader.tsx, src/screens/CatalogScreen.tsx

## Карточка задачи
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [x] QA tests (qa-lead)
- [x] Implementation (engineer)
- [x] Architecture review (tech-lead)

## Log

2026-06-27 — planner-agent: spec and tech design created for shelf-filtering.
  Scope: CatalogFilterHeader (category pills + biomarker badges), AND-filter logic
  in CatalogScreen, PAO expiry chip on product cards using #D97706 amber + Feather
  alert-triangle. No new data model changes — openedDate + paoMonths already on Product.
  Biomarker 'Hydration' uses productType heuristic; 'Soothing' maps to niacinamide/
  copper_peptides; 'Actives' maps to retinol/aha/bha/vitamin_c/benzoyl_peroxide.
  New files: src/utils/paoHelpers.ts, src/components/catalog/CatalogFilterHeader.tsx.
  Modified: src/screens/CatalogScreen.tsx, src/types/index.ts.

2026-06-27 — engineer: implementation complete. tsc --noEmit zero errors; 19/19 tests green.

  Deviations from design spec (logged):

  1. ProductType extended: the feature-shelf-filtering worktree branched from a commit
     before extended product types (ampoule, lotion, cream, eye_cream, mask, balm,
     spot_treatment, other, makeup_remover, peeling) were merged. These types are
     present in main. Added them to types/index.ts and constants/labels.ts so
     CATEGORY_PRODUCT_TYPES compiles without type errors.

  2. Input component `style` prop does not exist — the spec says style={styles.searchInput}
     but Input's props interface omits `style` (uses containerStyle). Changed to
     containerStyle={styles.searchInput}.

  3. PAO expired test case uses openedDate='2026-05-26' (32 days before now=2026-06-27)
     to produce daysRemaining=-1 and isExpired=true. The spec said "31 days before"
     which yields expiry=June 27=today → daysRemaining=0 (not expired). Arithmetic
     corrected to match the spec's stated outcome.

  4. Test runner is Jest (jest-expo preset), not Vitest. Tests use Jest globals.
     CatalogScreen.test.ts adds jest.mock for @react-native-async-storage/async-storage
     to break the native-module chain triggered by productsStore.ts import.

  5. CatalogScreen.tsx retains legacy AddProductModal + editingProduct/editModalVisible
     state from this branch's older version. The design spec did not list these as
     items to remove, so they are preserved.

2026-06-27 — qa-lead: 34 integration tests written in tests/shelf-filtering/.
  3 suites: CatalogScreen.integration.test.tsx (16 tests), CatalogFilterHeader.integration
  .test.tsx (12 tests), PaoChip.integration.test.tsx (6 tests). All 34 pass.
  Covers: default render, category pill select/deselect, biomarker badge add/remove,
  AND-logic combination, both empty-state variants, search narrowing, PAO chip at
  5d/0d/-1d, PAO chip suppression at 31d and on null fields.
  Mock pattern follows tests/catalog/hide-product.test.tsx (AsyncStorage + routinesStore
  both mocked); does not follow the broken catalog-screen.test.tsx pattern.

2026-06-27 — tech-lead: architecture review complete. Status: ACCEPTED.
  Verified: all five FE tasks (types, paoHelpers, CatalogFilterHeader, CatalogScreen
  wiring, applyFilters tests) faithfully implemented. tsc --noEmit = zero errors.
  No console.log / debugger / TODO markers. applyFilters = 38 lines (< 50 limit).
  Filter constants at module level; CatalogFilterHeader has no store imports or own
  state; paoHelpers has no React imports. All five logged deviations ruled WARNING
  (none blocking): ProductType alignment with main, containerStyle prop name, PAO
  expired-test arithmetic correction, Jest vs Vitest runner, and AddProductModal
  removal (code is cleaner than the log note suggests — legacy modal is absent,
  navigation-based edit is in place).
