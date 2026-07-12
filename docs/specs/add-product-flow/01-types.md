# Task 01: Types

Depends on: nothing. Do this first.

## Goal

Add the type definitions this whole feature depends on to
`src/types/index.ts`. Do not scatter these across other files — keep them
centralized here so every other task file can import from one place.

## Add these types

```ts
type CaptureMode = 'label' | 'barcode' | 'inci';

type ActiveIngredientKey = 'RETI' | 'ACID' | 'VIT_C' | 'PEPT';
// (skip this if ActiveIngredientKey already exists elsewhere in the
// codebase from prior conflict-engine work — reuse it, don't duplicate)

interface AddProductDraft {
  // Section 1 — brand, name, category
  brand: string;
  brandSource: 'ocr' | 'autocomplete' | 'typed' | null;
  name: string;
  nameSource: 'ocr' | 'typed' | null;
  productType: ProductType | null;
  productTypeSource: 'auto-detected' | 'manual' | null;

  // Section 2 — barcode
  barcode: string | null; // null = skipped, never blocks progress

  // Section 3 — ingredients
  inciRaw: string | null; // full raw text, present only if OCR/paste used
  activeIngredientKeys: ActiveIngredientKey[]; // deduped
  ingredientsSource: 'ocr' | 'checklist' | 'mixed';

  // Section 4 — usage details. LOCAL ONLY. Never leaves the device.
  isOpened: boolean;
  openedDate: string | null; // ISO 8601, set only if isOpened
  paoMonths: number | null;

  // Meta
  sectionStatus: {
    brand: 'empty' | 'in-progress' | 'complete';
    barcode: 'empty' | 'skipped' | 'complete';
    ingredients: 'empty' | 'in-progress' | 'complete';
    usage: 'empty' | 'complete';
  };
  expandedSection: 1 | 2 | 3 | 4 | null;
}

type CaptureResult =
  | { mode: 'label'; rawText: string }
  | { mode: 'barcode'; code: string }
  | { mode: 'inci'; rawText: string };

// Structurally distinct from Product — deliberately NOT an Omit<Product, ...>
// alias. See task 09 for why: this is the enforcement point that keeps
// local-only fields (openedDate, paoMonths) from ever leaking into a
// server payload, even if Product gains new personal fields later.
interface SuggestPayload {
  brand: string;
  name: string;
  productType: ProductType;
  barcode: string | null;
  inciRaw: string | null;
  status: 'pending';
}
```

## Notes

- `ProductType` should already exist in `src/types/index.ts` per
  `IMPLEMENTATION_PLAN.md` Phase 0 scope — reuse it, don't redefine.
- If `Product` doesn't yet have a `barcode` field, add `barcode: string |
  null` to it now — Section 2 of this flow needs somewhere to persist a
  scanned barcode on the saved product, not just on the draft.
- Do not add `openedDate` or `paoMonths` to `SuggestPayload` under any
  circumstances — this is checked again explicitly in task 09.

## Done when

- `AddProductDraft`, `CaptureMode`, `CaptureResult`, `SuggestPayload`,
  `ActiveIngredientKey` (if not already present) compile cleanly.
- `npx tsc --noEmit` passes with no new errors introduced by this file.
