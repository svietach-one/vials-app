Status: DESIGNED
Tech Design: docs/tech-design/catalog-redesign.md
Code: —

## Карточка задачи
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [ ] QA tests (qa-lead)
- [ ] Implementation (engineer)
- [ ] Architecture review (tech-lead)

## Log

2026-06-20 — planner-agent: spec and tech design created for catalog-redesign.
  Scope: tab rename, search+add header row, Card-based product list,
  ProductDetailScreen, ProductActionSheet bottom sheet, delete/edit via action menu.

2026-06-20 — planner-agent: tech design SUPERSEDED and replaced with Add Product Hub architecture.
  New scope: CatalogScreen (renamed from ProductsScreen), AddProductHubScreen (new stack
  screen with OBF global search + barcode button + manual CTA), BarcodeScannerScreen
  (placeholder stub — expo-camera not yet installed), ProductDetailScreen, ProductActionSheet.
  Wizard remains as AddProductModal (modal, not stack screens) — see Assumptions in design.
  All prior QA/engineer/review checkboxes reset to unchecked as the design baseline changed.
