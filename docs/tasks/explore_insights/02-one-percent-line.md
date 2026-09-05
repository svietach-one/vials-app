# 02 — `onePercentLine.ts`: detect the 1% boundary in an ordered INCI list

**Depends on:** 01 (needs `ingredientTokens`)
**Blocks:** 03
**Size:** S · one new pure module + tests
**User-visible change:** none. Task 03 renders it.

---

## Context

INCI lists are ordered by descending concentration **only down to 1%**; below that the order is arbitrary. So an active appearing after the 1% boundary is present at a token amount regardless of how prominently the marketing features it. That is the single most useful thing we can tell a user that they cannot read off the box.

There is no percentage data anywhere in this codebase and there will not be — brands do not publish it. The boundary is inferred positionally from **marker ingredients that are legally or practically capped below 1%**.

The audit (§8A) called this blocked because none of these markers exist in `actives.json`. That reasoning does not apply: this module never touches `actives.json`. It scans the ordered token array from task 01 directly with its own small regex table. `actives.json` is an active-*class* ruleset; this is a different taxonomy (preservatives, chelators, declared allergens) and belongs in its own file.

---

## New file: `src/utils/productProfile/onePercentLine.ts`

Pure module — no React, no react-native, no store, no I/O (`.claude/rules/architecture-review.md §2`), same as its siblings in that folder.

```ts
export interface OnePercentLineResult {
  /** 0-based index into the token array of the first ingredient at or below the line. */
  lineIndex: number;
  /** The token that established the boundary, verbatim as it appeared. */
  markerToken: string;
  /** 'high' — a concentration-capped preservative/chelator.
   *  'medium' — only a declared fragrance allergen was found. */
  confidence: 'high' | 'medium';
}

/** Returns null when no boundary can be inferred with confidence. Silence is the correct output when unsure. */
export function findOnePercentLine(tokens: string[]): OnePercentLineResult | null;
```

### Marker table

Two tiers, case-insensitive, matched against each trimmed token.

**High confidence** — capped by EU regulation or by formulation practice at well under 1%:

| Pattern | Why |
|---|---|
| `phenoxyethanol` | EU Annex V max 1.0% |
| `sodium benzoate` | EU Annex V max 0.5% |
| `potassium sorbate` | EU Annex V max 0.6% |
| `chlorphenesin` | EU Annex V max 0.3% |
| `benzoic acid` | Annex V, low cap |
| `dehydroacetic acid` | Annex V max 0.6% |
| `(di\|tetra)sodium edta` | chelator, typically ≤ 0.2% |
| `ethylhexylglycerin` | typically ≤ 1% |
| `hydroxyacetophenone` | typically ≤ 1% |
| `sodium hydroxide` / `triethanolamine` / `citric acid` | pH adjusters, trace |
| `carbomer` | rheology, 0.1–0.5% |
| `tocopherol` (but **not** `tocopheryl acetate`) | antioxidant, trace |
| `disodium phosphate` / `sodium phosphate` | buffer, trace |
| `t-butyl alcohol` / `denatonium benzoate` | denaturants, trace |

**Medium confidence** — EU-declarable fragrance allergens. They are only ever listed because they exceed a 0.001% / 0.01% declaration threshold, and in practice sit far below 1%: `limonene`, `linalool`, `citronellol`, `geraniol`, `coumarin`, `eugenol`, `citral`, `benzyl salicylate`, `benzyl benzoate`, `hexyl cinnamal`, `alpha-isomethyl ionone`, `butylphenyl methylpropional`, `hydroxycitronellal`, `amyl cinnamal`, `farnesol`, `isoeugenol`.

Deliberately **excluded** — commonly assumed to be sub-1% but frequently used above it, which would push the line too high and produce false "below 1%" claims: `xanthan gum`, `glycerin`, `1,2-hexanediol`, `caprylyl glycol`, `parfum`/`fragrance` (can exceed 1% in fragranced products), `benzyl alcohol` (a solvent above 1% as often as an allergen below it), `sodium chloride`, any `parfum` synonym. Put this list in a comment in the file with the reason, so the next person does not "helpfully" add them back.

### Algorithm

1. If `tokens.length < 6` → return `null`. Short lists (samples, minimalist formulas, truncated OCR) do not support the inference.
2. Find the earliest index matching any high-confidence marker. If none, find the earliest matching a medium marker.
3. Guard: if that index `< 3` → return `null`. A marker in the first three positions means either a very unusual formula or a mis-parsed list; either way we do not know where the line is.
4. Guard: if the index is the **last** token → return `null`. A boundary with nothing below it tells the user nothing.
5. Otherwise return the index, the verbatim token, and the tier that matched.

Every returned `lineIndex` therefore satisfies `3 <= lineIndex < tokens.length - 1`.

### Matching rules

- Word-boundary regexes (`\b`), case-insensitive.
- Match against the token **as-is**; do not strip brackets, asterisks or CI numbers (a known normalization gap tracked elsewhere — do not fix it here, and do not let this module quietly depend on it being fixed).
- `tocopherol` must not match `tocopheryl acetate`; write the pattern and a test for exactly this.
- First match wins by index, not by tier: if a medium marker sits at index 10 and a high marker at index 20, **the high marker wins** — tier is checked before position (step 2 runs the high table over the whole list first). This is deliberate: a capped preservative is stronger evidence than an allergen declaration.

---

## Acceptance criteria

- Realistic 40-token list with `phenoxyethanol` near the end → high confidence, correct index.
- List whose only marker is `limonene` → medium confidence.
- List with `limonene` at index 10 and `phenoxyethanol` at index 20 → returns index 20, `high`.
- 5-token list → `null`.
- `phenoxyethanol` at index 1 → `null`.
- Marker as the final token → `null`.
- No markers at all → `null`.
- `tocopheryl acetate` alone does not trigger a match; `tocopherol` does.
- Empty array and single-element array → `null`, no throw.
- Module imports nothing from React, react-native, any store, or `actives.json`.
- `npm test` green, `npx tsc --noEmit` clean.

## Tests

New co-located `src/utils/productProfile/onePercentLine.test.ts`, one case per criterion above. Use realistic full INCI strings (a CeraVe-style moisturiser, a fragranced cream, a short oil serum) rather than synthetic `['a','b','c']` arrays — this module's failure mode is real-label weirdness, and synthetic fixtures will not catch it.

## Out of scope

- Rendering anything. Task 03.
- Any percentage or concentration estimate. This module returns an index and nothing else. Do not add a `estimatedPercent` field, do not name anything `concentration`.
- Extending `actives.json`.
- Normalization fixes.
