# Step 3 — Wire brand-first filtering into the corpus search

**Prerequisite:** read `00-README.md`, and steps 0–2 must be done.
Read no other step file.
**Schema changes: none. Risk: medium (new query shape).**

> **Gate:** only do this step if the step 2 report says `false_top_1` is still meaningfully above
> zero. If step 2 already fixed it, this adds query complexity for nothing — say so and stop.
>
> **Before accepting a `false_top_1` of zero as the reason to skip:** confirm the number is not an
> artifact of how the fixtures were built. If the fixtures are corpus rows with synthesized noise,
> each query is a near-substring of its own target and the target is nearly unbeatable — so the
> metric can read zero regardless of how the system behaves on real input. Check how many fixtures
> even contain a plausible different-brand competitor. If few do, the metric proves nothing, and
> the honest report is "not measurable with the current fixture set", not "not needed".
>
> **Prefer step 5 over this step where possible.** This step is a workaround for the flattened
> single-column index. Step 5 gives brand a real indexed field and a bm25 weight, which serves the
> same purpose as a soft signal without a hard exclusion or a second threshold. If step 5 is on the
> table, do that instead and re-tune its field weights.

---

## The defect

A genuinely good brand fuzzy-matcher already exists: `suggestBrandCorrection()` in
`src/utils/productForm/brandCorrection.ts:134-156` — Jaccard over trigram sets, a tuned
`BRAND_SUGGESTION_THRESHOLD = 0.6`, script-aware pools so Latin never cross-matches Cyrillic, and a
`MIN_ENTRY_TRIGRAMS` floor so short dictionary entries can't degenerate into false positives.

It is scoped entirely to the "did you mean [Brand]?" chip in the manual-entry form. The corpus
search never calls it. `ProductRepository.search()` has no brand-scoped query path at all — every
search runs against the full products table regardless of how confidently a brand was extracted.

The shared primitive (`trigramJaccard`) is already exported from `trigramSearch.ts` precisely so
both concerns could use it.

---

## What to change

### 1. Brand vocabulary cache

```ts
// src/services/corpus/brandVocab.ts
// SELECT DISTINCT brand FROM products WHERE brand IS NOT NULL AND brand <> ''
```

- Load lazily on first search, hold in memory for the session.
- Invalidate on corpus sync completion (hook the existing sync-finished path).
- Expect low thousands of entries against 17k products — a plain in-memory array is fine, no index
  needed. Do not add a caching library for this.

### 2. Resolve the query brand

```ts
const resolved = resolveBrand(query.brand);   // undefined when nothing clears the bar
```

- Reuse `trigramJaccard` and the **same** script-aware pooling as `brandCorrection.ts`. If that
  logic can be extracted and shared without disturbing the chip UI, extract it; if extraction is
  risky, duplicate the pooling rule and leave a comment pointing at the original. Do not silently
  drop the script rule — Latin/Cyrillic cross-matching is a real corpus hazard here.
- Two thresholds, not one:
  - `>= 0.75` (`SEARCH_CONFIG.brandFilterThreshold`) → confident, **hard filter** the query
  - `0.6 – 0.75` → not confident enough to filter; pass through to step 2's scorer as a
    weighted signal only (this is already what it does)
  - `< 0.6` → ignore the brand entirely

The gap between 0.6 and 0.75 is intentional. 0.6 is tuned for "suggest a correction to a human who
will look at it", which is a much cheaper mistake than "silently exclude 99% of the corpus".

### 3. Constrain the query, with a mandatory fallback

When a brand resolves confidently:

```
SELECT ... FROM products WHERE brand = ? AND <fts match on name>
LIMIT SEARCH_CONFIG.recallLimit
```

then score with step 2's `scoreCandidate`, **keeping the same 0.35/0.65 blend but pinning
`brandScore = 1.0`** for every candidate in this branch.

Do **not** switch to a name-only score here. `minMatchScore` was tuned in step 2 against blended
scores; a name-only score for the same candidate is systematically higher, so reusing the same
floor would make the cutoff *looser* in the branch that is supposed to be the confident one —
exactly backwards. Pinning the brand component to 1.0 keeps both branches on one scale and one
threshold.

**If the brand-filtered search returns nothing above `minMatchScore`, fall through to the
unfiltered search before giving up.** A confidently-wrong brand extraction must never dead-end the
user. This fallback is not optional and must have a test.

---

## Acceptance criteria

- [ ] Brand vocab cache loads once per session and invalidates on sync
- [ ] Script-aware pooling is preserved (test: a Cyrillic query never resolves to a Latin brand)
- [ ] Confident brand → filtered query; mid-confidence → unfiltered with brand as a score signal
- [ ] Filtered branch pins `brandScore = 1.0` and keeps the step 2 blend — no second threshold
- [ ] Filtered-search-empty → falls through to unfiltered (explicit test)
- [ ] The chip UI in manual entry behaves exactly as before (regression test)
- [ ] Harness: `false_top_1` drops further; `recall@retrieval` does not regress. A recall drop here
      means the hard filter is firing on wrong brands — raise `brandFilterThreshold`, re-measure.

---

## Report back

Before/after metrics, how often the hard filter fired, how often the fallback rescued a query
(log both), and the per-case diff. If the fallback fires often, the brand threshold is too low.
