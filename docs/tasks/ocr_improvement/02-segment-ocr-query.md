# Step 1 — Segment the OCR query before searching

**Prerequisite:** read `00-README.md`, and step 0 must be done (baseline exists).
Read no other step file.
**Schema changes: none. Risk: low.**

---

## The defect

`src/screens/catalog/CaptureFlowScreen.tsx:82`

```ts
runSearch(result.rawText);   // ← the entire multi-line front-label OCR blob
```

`splitLabelText()` (`src/utils/productForm/ocrNormalizer.ts:9-30`) already separates the first
surviving OCR line (brand) from the rest (name). It is called on `goToManualEntry` and on the
INCI-capture branch — i.e. only on the paths that *exit without a match* — and never before the
search that actually needs it.

Consequence: a typed query decomposes into a small, specific trigram set, while a label capture
decomposes into dozens of trigrams of generic cosmetic vocabulary. The shared matcher cannot tell
those two inputs apart and treats both as "OR everything together".

---

## What to change

### 1. Introduce a structured query type

```ts
// src/services/corpus/types.ts  (or wherever corpus types live)
export type ProductQuery = {
  brand?: string;              // may be absent — typed search has no separate brand
  name: string;                // always present; for typed search, the whole typed string
  origin: 'typed' | 'ocr';     // step 2 branches the retrieval strategy on this — set it now
  raw?: string;                // original input, for telemetry/debugging — never queried on
};
```

`raw` exists so the eval harness and logs can show what the user actually gave us. It must never
reach the SQL layer.

### 2. Build the query at each call site, not inside the repository

- `CaptureFlowScreen.tsx:82` — call `splitLabelText(result.rawText)` and pass
  `{ brand, name, origin: 'ocr', raw: result.rawText }`.
- `AddProductHubScreen.tsx:65` and `FirstProductScreen.tsx:52` — pass
  `{ name: typedText, origin: 'typed', raw: typedText }` with no `brand`.

Setting `origin` correctly here is what lets step 2 give typed input prefix-anchored retrieval and
OCR input fuzzy retrieval. Do not skip the field just because nothing reads it yet in this step.

Keeping segmentation at the call site is deliberate: the OCR path knows it has a label with a
brand line; the typed path knows it does not. Pushing that decision into the repository would mean
guessing again.

### 3. Accept `ProductQuery` in the repository

`ProductRepository.search()` takes `ProductQuery` instead of `string`. In this step it still does
what it does today — build a trigram query and run FTS — but from `[brand, name]` joined rather
than from the raw blob. Scoring and thresholds are **step 2**; do not add them here. Keeping this
step to one concern is what makes the harness diff interpretable.

Keep a thin `search(text: string)` overload only if a caller outside the three above exists; if not,
migrate all callers and delete the string signature.

### 4. Create the config module

Create `src/services/corpus/searchConfig.ts` exactly as specified in `00-README.md`, and put this
step's change behind `SEARCH_CONFIG.segmentOcrQuery`. Later steps extend the same module. The eval
harness from step 0 already expects to override values in it.

### 5. Guard against a degenerate split

`splitLabelText` can return an empty `name` (single-line label). If `name` is empty, fall back to
using `brand` as `name` and drop `brand`. Never send an empty query to the corpus.

---

## Acceptance criteria

- [ ] No call path passes raw multi-line OCR text into the corpus query. Verify by grepping for
      `rawText` reaching `ProductRepository`.
- [ ] `searchConfig.ts` exists and this change is behind `segmentOcrQuery`
- [ ] Typed-search behaviour is byte-identical to baseline (same fixtures, same results) — this
      step must only affect the label path.
- [ ] Existing tests pass; add a unit test that a multi-line `rawText` produces a two-field
      `ProductQuery`, and one that an empty-`name` split falls back correctly.
- [ ] Harness re-run: `precision@1` on label fixtures **does not regress**, and
      `recall@retrieval` on label fixtures does not drop by more than 2 points.

**Do not expect a large precision gain from this step, and do not chase one.** All scoring is
deferred to step 2, so the query still reaches the corpus as an OR-of-trigrams over the same
content — only cleaner and shorter. The value here is structural: it gives step 2 a brand field and
a name field to score separately, which is what actually fixes ranking. A flat `precision@1` is a
passing result.

If `recall@retrieval` drops significantly, the split is throwing away a useful line — inspect the
per-case diff before compensating anywhere else.

---

## Report back

The before/after table split by fixture set, plus the list of label cases whose verdict changed in
either direction.
