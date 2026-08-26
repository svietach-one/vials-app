# Step 2 — Real scoring and a match cutoff

**Prerequisite:** read `00-README.md`, and steps 0 and 1 must be done.
Read no other step file.
**Schema changes: none. Risk: low–medium (needs tuning). This is the highest-value step.**

---

## The defect

`src/services/corpus/ProductRepository.ts:75-95`

`search()` computes `ORDER BY bm25(products_fts, 2.0, 1.0)` and then throws the score away — the
`SELECT` never returns it, nothing compares it to a floor, and up to 20 rows come back for any
nonzero match. The `LIKE` fallback for sub-trigram queries (`:89-94`) has no scoring at all and is
ordered alphabetically.

Every call site treats `results.length > 0` as "show the candidate list". There is no code path
anywhere that says *the best match still isn't good enough*. Against a 17k-row corpus, an
OR-of-trigrams query essentially never returns zero rows, so the well-built
"not listed / add manually" screen is unreachable in practice.

---

## Architecture: retrieve wide, re-rank narrow

Do **not** try to tune a bm25 floor. `bm25()` is negative (more negative = better) and is not
comparable across queries of different lengths, so any constant floor will be wrong for half the
inputs. Instead split the concerns:

```
FTS5 trigram query   →  recall stage    LIMIT SEARCH_CONFIG.recallLimit, ordered by bm25
JS re-scoring        →  precision stage normalized 0..1 score   (decide what's good enough)
cutoff + cap         →  return [] or ≤ SEARCH_CONFIG.maxResults results
```

Read both limits from `SEARCH_CONFIG` (created in step 1) — never hardcode them, or the step-0
harness cannot sweep them. Also expose the pre-cutoff candidate list behind an eval/debug option:
the harness measures `recall@retrieval` on it, and without that hook every later step loses its
regression guard.

The re-rank stage is cheap (100 rows of short strings), fully testable in isolation, and produces a
score you can explain to a human — all of which the current design lacks.

---

## The scorer

New module `src/services/corpus/scoreCandidate.ts`.

### Use asymmetric containment, not symmetric Jaccard

This is the single most important detail in this step. Query `"the ordinary niacinamide"` against
document `"The Ordinary Niacinamide 10% + Zinc 1% Serum"` is a *perfect* match from the user's
point of view, but symmetric Jaccard scores it poorly because the document has many tokens the
query lacks. Documents are routinely longer than queries; penalising that is wrong.

Score **coverage of the query by the document**:

```
score = |matched query tokens| / |query tokens|
```

`trigramJaccard` (already exported from `trigramSearch.ts`) stays useful — but for comparing two
*single tokens*, not whole strings.

### Module contract — implement exactly this shape

Later steps modify this module, so the boundaries matter more than the internals:

```ts
// coverage of one query field against one document field, 0..1
export function scoreField(queryText: string, docText: string): number;

// combines the fields into the final candidate score, 0..1
export function scoreCandidate(query: ProductQuery, candidate: Product): number;
```

`scoreField` tokenizes both sides with `normalizeForMatch` (see `00-README.md`), then returns
coverage of the query tokens by the document tokens. `scoreCandidate` only blends field scores; it
contains no token logic of its own. Keep that separation — step 4 changes `scoreField` and nothing
else, and it can only do that safely if the blend lives one level up.

### Token matching rule

A query token counts as matched against a document if any document token satisfies, in order:

1. exact equality after `normalizeForMatch` (see `00-README.md`), or
2. document token starts with the query token and the query token is ≥4 chars (prefix — handles
   "moisturis" → "moisturiser"), or
3. `trigramJaccard(queryToken, docToken) >= 0.6` and both tokens are ≥5 chars (OCR typos)

Rule 3 is deliberately restricted to longer tokens: on short tokens trigram similarity degenerates
into noise, which is a large part of how the current implementation ends up matching a wax to a
cream.

### Combining brand and name

```ts
export function scoreCandidate(query, candidate) {
  const nameScore  = scoreField(query.name, candidate.name);
  if (!query.brand) return nameScore;
  const brandScore = scoreField(query.brand, candidate.brand);
  return 0.35 * brandScore + 0.65 * nameScore;
}
```

Brand is weighted meaningfully but not dominantly — OCR gets the brand line wrong often enough that
a brand-dominated score would be unstable. Hard brand filtering is **step 3**, not this step.

Note the asymmetry this creates: a query with a brand is scored on a blend, one without is scored
on name alone. Both are compared against the same floor, which is fine because the floor is tuned
below against the real fixture mix. Any later step that changes which branch a query takes must
keep the score on the same scale — see step 3.

### Short-query guard

If the normalized query is shorter than 4 characters in total, switch to a stricter mode:

- a query token matches only if a document token **starts with** it (the ≥4-char restriction in
  rule 2 does not apply in this mode — that is the whole point of it)
- fuzzy rule 3 is skipped entirely
- require `score >= 0.8` rather than `minMatchScore`

Without this, two-character queries match nearly the whole corpus.

---

## The cutoff

```ts
const scored = candidates
  .map(c => ({ ...c, score: scoreCandidate(query, c) }))
  .filter(c => c.score >= SEARCH_CONFIG.minMatchScore)
  .sort((a, b) => b.score - a.score)
  .slice(0, SEARCH_CONFIG.maxResults);
```

(`SEARCH_CONFIG.minMatchScore` and `SEARCH_CONFIG.maxResults` — read them, don't inline them.)

- Below the floor → return `[]`. The existing "Product not found → Add manually" flow then fires
  on its own. **Do not add a new empty-state UI**; it already exists and is well built.
- `maxResults: 6` replaces the fixed 20. With a real floor in place the cap is mostly cosmetic, but
  a long list reads as "unsure" even when the right answer is in it.
- Return `score` on each result object. The harness needs it, telemetry wants it, and it makes
  every future tuning argument checkable instead of subjective.

### Tuning `minMatchScore`

Do not pick this by feel. Sweep it with the harness:

```
for t in 0.30 0.35 0.40 0.45 0.50 0.55 0.60 0.65 0.70:
    npm run search-eval -- --set minMatchScore=$t --label sweep-$t
```

Plot `precision@1` and `false_top_1` against `no_match_rate` on the cases that *do* have a correct
answer. Pick the knee: the highest threshold at which real matches are still found. Start the
search around 0.5 and commit whatever the sweep actually says, including the sweep table.

Be explicit about the trade: raising the floor converts wrong-answer-shown into no-answer-shown.
For this product that is the right direction — a user who is told "not found, add manually" is
mildly inconvenienced, a user who accepts a wrong match gets a wrong ingredient list, which is the
failure this whole app exists to prevent. Say so in the report so the threshold choice is a
recorded decision rather than a magic number.

---

## Typed search needs a different RECALL stage, not just a different score

This is the part that makes the search bar on `AddProductHubScreen` feel random rather than wrong,
and it is not fixed by re-ranking alone.

**Why it looks random today.** A user types incrementally, so the live query is short. `"cer"`
decomposes into exactly one trigram. The OR-query matches many thousands of rows, and `bm25()` over
a single 3-character fragment is nearly constant across all of them — so the ordering among them is
effectively arbitrary, and `LIMIT 20` slices an arbitrary 20 out of thousands. Below 3 characters
the `LIKE` branch (`:89-94`) takes over and sorts **alphabetically**, with no relevance signal at
all. Neither branch is sorted by anything a person would recognise as relevance.

Re-ranking cannot repair this on its own: the scorer only ever sees what the recall stage returned,
and here the recall stage returns an arbitrary slice.

**The principle.** A human typing and a camera reading a label produce *different error
distributions*. Typing preserves prefixes and errs at the end (truncation, adjacent-key typos). OCR
errs in the middle and at character level (`rn`→`m`, `è`→`e`, dropped glyphs). Applying OCR-grade
fuzzy matching to typed input is a category error and is precisely what produces the noise.

So branch the recall stage on `ProductQuery` origin (add an `origin: 'typed' | 'ocr'` field to the
type from step 1):

- **`ocr`** → trigram FTS recall, as today. Correct for garbled input.
- **`typed`** → **word-boundary prefix recall** against the normalized brand and name. Before step 5
  adds normalized columns, a `LIKE` scan over ~17k rows is a few milliseconds on device — measure
  it, don't assume it's too slow.

### Ranking tiers for typed queries

Sort by tier first, then by the step 2 score within the tier. This is what makes a search bar feel
like search:

```
1. exact match on normalized "brand name" or on name alone
2. brand starts with the query
3. name starts with the query
4. any word inside the name starts with the query
5. fuzzy / trigram — only when the query is ≥4 chars AND tiers 1–4 returned
   fewer than maxResults
```

Tier 5 is a *supplement*, not the default. Today it is the default, which is the whole problem.

### Stability between keystrokes

Typeahead results must not reshuffle violently as the user types. After tier and score, break ties
deterministically — `rating_count DESC, name ASC` — so adding one character refines the list
instead of scrambling it. Non-deterministic ordering reads as "random" even when the set is
correct, and is likely part of what is being reported here.

### Minimum query length

Do not query below 2 characters; show the field's placeholder/hint instead of a result list. Keep
the existing 200 ms debounce. A 1-character query cannot be meaningfully ranked against 17k rows
and should not try.

## Also fix the LIKE fallback

The `:89-94` branch currently orders alphabetically with no scoring. It is replaced by the tiered
typed-path recall above. Whatever remains of it must go through the same scorer and the same cutoff
— it must never return unranked rows.

---

## Acceptance criteria

- [ ] `scoreCandidate.ts` exports `scoreField` and `scoreCandidate` per the contract above
- [ ] Unit tests: exact match, longer-document match (the "The Ordinary" case), OCR typo,
      wrong-brand-similar-letters, 2-character query, and a case proving rule 3 does not fire on
      short tokens
- [ ] `search()` returns `[]` when nothing clears the floor, and results carry a `score`
- [ ] Pre-cutoff candidate list is exposed for the harness (`recall@retrieval` stays measurable)
- [ ] No raw bm25 value is compared against a constant anywhere
- [ ] `recallLimit` / `maxResults` / `minMatchScore` all read from `SEARCH_CONFIG`
- [ ] LIKE fallback is scored and capped like the main path
- [ ] Typed and OCR queries use different recall stages, branched on `query.origin`
- [ ] Typed results are tier-sorted, with a deterministic tiebreak (no reshuffling between
      keystrokes — add a test that typing one more character only narrows the list)
- [ ] Queries under 2 characters return no list at all
- [ ] Threshold sweep table included in the report
- [ ] Harness: `false_top_1` drops substantially; `no_match_rate` on `not_in_corpus` fixtures rises;
      `no_match_rate` on fixtures with a real expected match stays near baseline;
      `recall@retrieval` unchanged (this step must not touch retrieval at all)

The last two criteria catch an over-aggressive floor. If `no_match_rate` rises on real matches,
the threshold is too high — lower it rather than compensating elsewhere. If `recall@retrieval`
moved, something in the recall stage was changed that shouldn't have been.

---

## Report back

Sweep table, chosen threshold with justification, before/after metrics split by fixture set, and
the per-case diff. Then state whether step 3 (brand-first filtering) still looks necessary — if
`false_top_1` is already near zero it may not be worth the added query complexity.
