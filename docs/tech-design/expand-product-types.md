# Technical Design: Expand Product Types + Restore OCR Banner Gate

Spec: docs/specs/expand-product-types.md
Author: planner
Date: 2026-06-21

## 1. Architecture Overview

All changes are confined to three files. No new screens, no navigation changes, no store changes.

```
src/types/index.ts           ← ProductType union (source of truth)
src/constants/labels.ts      ← PRODUCT_TYPE_LABELS display map
src/screens/ManualProductFormScreen.tsx
  ├── PRODUCT_TYPE_OPTIONS   ← chip data array (mirrors union)
  ├── InciField              ← add ocrScanned prop; switch banner on it
  └── ManualProductFormScreen
      └── ocrScanned state   ← set true in handleOcrResult only
```

## 2. API Contracts

N/A — local UI change only, no endpoints.

## 3. Implementation Tasks

### engineer (scope=frontend)

- FE-1: Extend `ProductType` union in `src/types/index.ts` — add 10 new members after `'spf'`: `'makeup_remover' | 'peeling' | 'ampoule' | 'lotion' | 'cream' | 'eye_cream' | 'mask' | 'balm' | 'spot_treatment' | 'other'`.

- FE-2: Extend `PRODUCT_TYPE_LABELS` in `src/constants/labels.ts` — add display strings for each new key. Labels: Makeup Remover, Peeling, Ampoule, Lotion, Cream, Eye Cream, Mask, Balm, Spot Treatment, Other.

- FE-3: Extend `PRODUCT_TYPE_OPTIONS` in `ManualProductFormScreen.tsx` — append 10 new `{ value, label }` entries matching FE-1/FE-2 order.

- FE-4: Add `ocrScanned: boolean` prop to `InciField` interface. Switch banner condition from `value.length > 0` to `ocrScanned`. Update OCR banner body text to exactly: "Please review the scanned text carefully for any punctuation or typo mistakes."

- FE-5: In `ManualProductFormScreen`, add `const [ocrScanned, setOcrScanned] = useState(false)`. In `handleOcrResult`, call `setOcrScanned(true)`. Pass `ocrScanned` into `<InciField>`. In the `onChange` handler passed to `InciField`, when text is cleared (`t === ''`), call `setOcrScanned(false)`.

## 4. Assumptions

- `PRODUCT_TYPE_LABELS` uses `Record<string, string>` (not keyed to `ProductType`), so no type change needed there.
  Alternative: tighten to `Record<ProductType, string>`.
  Reason: existing declaration is already `Record<string, string>`; tightening would require updating every call site and is out of scope.

- Clearing the field (`onChange` with `''`) resets `ocrScanned` to false, satisfying AC-8.
  Alternative: add a dedicated "clear" button.
  Reason: the TextInput already clears via `clearButtonMode="while-editing"`; resetting on empty string is the least-friction path.

## 5. Open Questions

No open questions.
