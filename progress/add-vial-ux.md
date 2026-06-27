Status: IN_PROGRESS
Tech Design: docs/tech-design/add-vial-ux.md
Code: —

## Карточка задачи
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [x] QA tests (qa-lead)
- [ ] Implementation (engineer)
- [ ] Architecture review (tech-lead)

## Log

2026-06-21 — planner-agent: spec and tech design created for add-vial-ux.
  Scope: refactor AddProductModal.tsx to a 2-step state machine ('hub' | 'form').
  STEP_1 (Addition Hub) adds Scan Barcode and Create Product Manually button-card rows
  below the existing OBF search input. STEP_2 (Manual Form) is unchanged except the
  back-button target switches from 'search' to 'hub'. One new optional prop
  onScanBarcode added to AddProductModalProps for backwards-compatible barcode nav.
  One caller update required: AddProductHubScreen wires onScanBarcode to navigation.
  No new files, no store changes, no dependency additions.
- [2026-06-21] qa-lead: wrote integration tests at tests/components/product/AddProductModal.test.tsx
  20 tests across 5 stories covering hub mode entry points, Scan Barcode card,
  Create Product Manually transition, back link logic, Add to Catalog gate,
  edit mode and OBF pre-fill skip. Tests target post-refactor interface
  (Mode = 'hub' | 'form') and will fail on current code until FE-1 through FE-5 land.
