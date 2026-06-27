Status: IN_REVIEW
Tech Design: docs/tech-design/expand-product-types.md
Code: src/types/index.ts, src/constants/labels.ts, src/screens/ManualProductFormScreen.tsx

## Task card
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [ ] QA tests (qa-lead)
- [x] Implementation (engineer)
- [ ] Architecture review (tech-lead)

## Log
2026-06-21: FE-1 to FE-5 implemented. ProductType union extended with 10 new types. PRODUCT_TYPE_LABELS extended. PRODUCT_TYPE_OPTIONS extended. InciField ocrScanned prop added; banner now gates on ocrScanned state, not value.length. ocrScanned set true in handleOcrResult, reset on field clear.
