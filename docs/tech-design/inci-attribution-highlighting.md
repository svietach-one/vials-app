# Technical Design: FE-11: Dynamic INCI Attribution and Proof-Highlighting Layer
Spec: docs/specs/inci-attribution-highlighting.md
Author: tech-designer
Date: 2026-07-06

## AI-SDLC Flags
```
backend_layer:  false
frontend_layer: true
infra_changes:  false
```

## 1. Architecture Overview

Stories 1 and 3 (matched-token tooltip, alias micro-copy, alias badge indicator) need **no new persisted data** — `fullIngredientText` is already stored, so the matched substring can be recomputed on demand at render time:

```
ingredientParser.ts
  parseActiveIngredientDetails(text)          // existing: {key, potency}[]
    -> parseActiveIngredientDetails(text)      // extended: {key, potency, matches: MatchedToken[]}[]
          MatchedToken = { rawText: string; matcherPattern: string }

aliasOverrides.json (new, alongside actives.json)
  keyed by matcherPattern -> { microCopy: string }

ConflictWarning / detected-active badge (existing, routine + product-detail screens)
  onPress -> AttributionTooltip (new component)
        reads: class displayName, MatchedToken[], aliasOverrides lookup
        renders: literal match + override-or-fallback copy
  badge itself -> alias indicator icon if any MatchedToken has an override
```

Story 2 (image overlay / "View on label") is **BLOCKED** pending the spec's open question on persisting scanned label images (Type A business/privacy-posture gap — see `docs/specs/inci-attribution-highlighting.md` Section 10). No implementation tasks are scheduled for it in this design; only the OCR-side data-capture change (below) is unblocked because it's additive and doesn't itself decide the storage question.

```
OcrScannerSheet.tsx (existing)
  WebView tesseract.js worker.recognize(dataUrl)
    -> result.data.words   // already computed by tesseract.js, currently discarded
    postMessage { type: 'OCR_RESULT', text, words: OcrWord[] }   // extended payload
```

## 2. API Contracts

No HTTP endpoints (fully on-device, consistent with `docs/tech-design/ocr-scanner.md`).

**`parseActiveIngredientDetails` (extended return shape):**
```ts
interface MatchedToken {
  rawText: string;        // the literal substring the regex matched, e.g. "Betaine Salicylate"
  matcherPattern: string; // the source pattern string, used as the aliasOverrides lookup key
}
interface ParsedActiveDetail {
  key: ActiveIngredientKey;
  potency?: string;
  matches: MatchedToken[]; // NEW — one entry per matcher that fired for this class
}
```

**`aliasOverrides.json` shape:**
```ts
{ [matcherPattern: string]: { microCopy: string } }
```

**`AttributionTooltip` props:**
```ts
interface AttributionTooltipProps {
  visible: boolean;
  onClose: () => void;
  displayName: string;      // canonical class label, e.g. "BHA (Salicylic Acid)"
  matches: MatchedToken[];
}
```

**OcrScannerSheet WebView → RN message (extended, additive field only):**
```js
{ type: 'OCR_RESULT', text: string, words: { text: string; x0: number; y0: number; x1: number; y1: number }[] }
```
`words` is captured and passed to `onResult` but not yet persisted anywhere (Story 2 is blocked) — it is dropped by the caller until the open question resolves.

## 3. Implementation Tasks

### engineer (scope=frontend) — Stories 1 & 3, unblocked
- FE-1: Extend `parseActiveIngredientDetails` in `src/utils/ingredientParser.ts` to capture the matched substring per firing matcher (switch matcher testing from `.test()` to `.exec()`/`.match()` and record `{ rawText, matcherPattern }`); keep `parseActiveIngredientsFromInci` and `getProductActiveKeys` call sites unchanged (they only consume `.key`). Files: `src/utils/ingredientParser.ts`.
- FE-2: Create `src/constants/rulesets/aliasOverrides.json` — seed with the `bha` class's `betaine salicylate` and `salix alba|willow bark` matchers (the two confirmed regional-alias cases from the incident) plus any other existing matcher in `actives.json` whose matched string diverges from its class `displayName`. Files: `src/constants/rulesets/aliasOverrides.json`.
- FE-3: Create `src/components/routine/AttributionTooltip.tsx` — popover/sheet anchored to the pressed badge; renders one row per `MatchedToken` (literal text in quotes + override-or-fallback micro-copy); falls back silently to the class `displayName`-derived description when no override exists. Uses design tokens only, no hardcoded colors. Files: `src/components/routine/AttributionTooltip.tsx`.
- FE-4: Wire the existing detected-active badge components (per `docs/tech-design/routine-redesign.md` conflict-warning rendering, and the equivalent product-detail ingredient summary) to accept an `onPress` that opens `AttributionTooltip` with the relevant `MatchedToken[]`. Files: wherever badges currently render — locate via `grep -rn "detected" src/components/routine/ src/components/product/`.
- FE-5: Add the alias indicator icon + `accessibilityLabel` (e.g. "Detected via regional ingredient name") to the badge component when any of its `MatchedToken`s has an `aliasOverrides` entry. Files: same badge component as FE-4.

### engineer (unit tests, scope=frontend)
- FE-6: Extend `src/utils/ingredientParser.test.ts` — covers: single matcher fires (one `MatchedToken`), multiple matchers of the same class fire on different substrings (multiple `MatchedToken`s, both retained — not just strongest potency), negative-pattern-stripped text produces no match/no token, matcher pattern used verbatim as the `matcherPattern` lookup key. Files: `src/utils/ingredientParser.test.ts`.

### engineer (scope=frontend) — OCR data capture only, unblocked; NOT wired to persistence
- FE-7: Extend the WebView HTML string and `onMessage` handler in `src/components/product/OcrScannerSheet.tsx` to additionally read `result.data.words` and include it in the `OCR_RESULT` postMessage payload; extend the `onResult` callback signature to optionally receive `words`, but do not persist them anywhere yet — the caller (`AddProductModal`) ignores the new field until the Section 1 open question resolves. Files: `src/components/product/OcrScannerSheet.tsx`.

### BLOCKED — no tasks scheduled
- Story 2 ("View on label" image overlay), and the underlying label-image + bounding-box persistence it requires, are **not** broken into tasks in this design. Per `.claude/rules/tech-design-template.md`'s Type A gap handling, a business/privacy-posture decision (whether to override the existing "images are never stored" constraint from `docs/specs/ocr-scanner.md`) must be resolved by the product owner first. Re-run this design once `docs/specs/inci-attribution-highlighting.md` Section 10's first open question is answered.

## 4. Assumptions

- Matched-token attribution is recomputed on demand from `fullIngredientText` at render time rather than persisted at scan/add time.
  Alternative: store `MatchedToken[]` on the `Product` record when it's created or its ingredients are edited.
  Reason: `fullIngredientText` is already durable and parsing is cheap/synchronous (single-pass regex over a short string); recomputing avoids a data-model migration and a second source of truth that could drift from the text if `actives.json` matchers are later updated.

- Alias overrides are keyed by exact `matcherPattern` string (the same regex source string compiled in `ingredientParser.ts`), not by a separate synthetic ID.
  Alternative: add an explicit `id` field to each matcher in `actives.json` and key overrides by that.
  Reason: avoids a schema change to the existing, already-shipped `actives.json` matcher objects; the pattern string is already unique per matcher within a class.

- The OCR word-capture change (FE-7) ships in this task even though its consumer (Story 2) is blocked.
  Alternative: hold FE-7 until Story 2 unblocks, so no OCR code changes ship without a consumer.
  Reason: FE-7 is a pure additive change to an existing message contract (new field, no behavior change for existing consumers) and de-risks Story 2's eventual implementation without committing to the storage decision now.

## 5. Open Questions

No new open questions beyond the two already logged in `docs/specs/inci-attribution-highlighting.md` Section 10, which gate Story 2 exclusively. Stories 1, 3, and FE-7 have no open questions and are ready for `qa-lead`.
