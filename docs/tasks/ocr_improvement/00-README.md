# Vials — Product Search Precision Fix

**Read this file first, then read exactly ONE step file (`01`…`06`) and do only that step.**
Do not load the other step files. Each step is self-contained on purpose so context stays small.

---

## What's wrong (one paragraph)

`ProductRepository.search()` is an unscored, unfiltered, character-level substring search with a
fixed `LIMIT 20`. `bm25()` is computed but discarded, so results are never checked for quality and
the "not listed / add manually" fallback only fires on a literally empty result set. The OCR path
sends the whole raw front-label blob into that same function without splitting brand from name. The
FTS index is `tokenize='trigram'` over one flattened `brand || ' ' || name` column, so IDF is
computed over 3-letter fragments shared by thousands of products, and there is no way to express
"right brand, wrong name" vs "coincidental letter overlap". Net effect: a depilatory wax, a hand
cream and a soap can all rank together for one query.

**Both entry points are affected, and they fail differently.** The OCR path fails by sending too
much text. The typed search bar on `AddProductHubScreen` fails by sending too little: a 3-character
live query is one trigram, which matches thousands of rows almost equally, so the ordering among
them is effectively arbitrary and `LIMIT 20` returns an arbitrary slice — the "it looks random"
symptom. Below 3 characters the `LIKE` branch sorts *alphabetically*, with no relevance signal at
all. Step 2 addresses both; step 1 is OCR-only.

---

## Step order (do NOT reorder)

| Step | File | Changes schema? | Gate |
|---|---|---|---|
| 0 | `01-eval-harness.md` | no | **must be done first** — nothing else is verifiable without it |
| 1 | `02-segment-ocr-query.md` | no | after 0 |
| 2 | `03-scoring-and-cutoff.md` | no | after 1 |
| 3 | `04-brand-first-filtering.md` | no | after 2, **conditional** — skip if step 2 already fixed `false_top_1` |
| 4 | `05-stopwords.md` | no | after 2 (independent of step 3) |
| 5 | `06-word-level-fts.md` | **YES** | after 2 and 4 (+3 if it was done), explicit human go-ahead required |

Step 3 is genuinely optional. Skipping it is a valid outcome and does not block step 5 — but see
the decision log below before skipping it on the strength of a single metric.

---

## Decision log

Fresh sessions have no memory of earlier ones. Any step that is skipped, deferred, or changed must
be recorded **here**, in this file, or it is silently lost. Append, don't overwrite.

### Step 3 (brand-first filtering) — skipped

**Stated basis:** `false_top_1` measured 0.0% at baseline and stayed 0.0% through steps 2 and 4 at
every threshold ≥0.55. Every hand-traced regression was same-brand variant confusion, a corpus
duplicate row, or a legitimate wrong-answer→no-answer conversion. None was cross-brand. Brand
filtering only helps when wrong-brand candidates win top-1, so it would add a query branch and a
new tunable for no measured benefit.

**Open caveat — verify before treating this as settled.** The 86 fixtures were built by taking
real corpus rows and adding synthesized OCR-style noise, because no device photos were available.
That construction method makes each query a near-substring of its own target, so the target is very
hard to beat — which can drive `false_top_1` to zero as an **artifact of the fixture set** rather
than as a finding about the system. Before relying on this number, check: across the fixtures, how
many have a *different-brand* competitor scoring anywhere near the target? If almost none do, the
metric never had an opportunity to be non-zero and the skip is unsupported (not wrong — unsupported).

**Caveat checked (2026-08-23), result: not an artifact.** One-off script (not shipped) ran
`retrieveCandidates` + `scoreCandidate` for real against the live corpus for all 70 real-match
fixtures, using the harness's own `false_top_1` definition (`normalizeForMatch(brand)` string
inequality — see `scripts/search-eval/run.ts`'s `runCase`). Result: 9/70 (12.9%) have a
different-brand candidate whose score clears `minMatchScore`, i.e. real display-stage contention,
not just recall-stage noise — the metric had a genuine opportunity to be non-zero. Only 2/70 (2.9%)
tie or beat the target's own score, and both are brand-*family* variants rather than unrelated
brands (`Akileine` vs `Sports Akileine`; `Avène` vs `Eau thermale Avène`) — a different, narrower
failure shape than the wax/cream/soap example this task opened with. Conclusion: the skip is
**supported, not an artifact**, with the caveat that "different brand" here is exact-string, so
brand-family confusion is a known, separate, low-frequency residual (2.9%) — not evidence for
reviving step 3 (hard brand filtering would not resolve a brand-family collision anyway, since
`Sports Akileine` and `Akileine` don't collapse to the same normalized brand string either).

**Superseded by step 5.** Brand-first filtering was a workaround for the flattened
`brand || ' ' || name` index: with brand and name in one bag of trigrams, hard-filtering was the
only way to make brand matter. Step 5 gives brand its own indexed field with a real bm25 weight,
which achieves the same goal as a soft, tunable signal — no hard exclusion, no second threshold, no
dead-end fallback path. If step 5 lands, do **not** revive step 3 without new evidence; re-tune the
step 5 field weights instead.

Steps 1 and 2 together are expected to remove most of the visible noise. Do not start step 5
speculatively — it rebuilds the corpus index and is only justified if the harness still shows
weak precision after 1–4.

---

## Repo map (verified during investigation)

```
src/services/corpus/
  ProductRepository.ts        search() lives at :75-95   ← the unscored query
  trigramSearch.ts            toTrigrams(), toTrigramQuery(), trigramJaccard (exported)
src/screens/catalog/
  CaptureFlowScreen.tsx       :82  runSearch(result.rawText)  ← raw blob goes in here
  AddProductHubScreen.tsx     :65  typed search, 200ms debounce
  FirstProductScreen.tsx      :52  typed search
src/utils/productForm/
  ocrNormalizer.ts            :9-30  splitLabelText()  ← exists, wired to the wrong branch
  ocrNoiseFilter.ts           confidence + height-ratio filtering (works, leave alone)
  brandCorrection.ts          :134-156 suggestBrandCorrection(), BRAND_SUGGESTION_THRESHOLD = 0.6,
                              isCommonTerm(), LATIN_COMMON_TERMS, script-aware pools
  brandDictionary.ts          brand vocabulary for OCR repair
handoff/corpus_schema.sql     :40-41 search_norm, :56-60 products_fts (tokenize='trigram')
```

Corpus: Turso/libSQL pull-only replica, ~17,346 products / 24,100 ingredients (`obf_import`).
Branch: `feature/vials-onboarding-quizzes`.

---

## Reuse, don't reinvent

These already exist, are tested, and must be reused rather than rewritten:

- `splitLabelText()` — first surviving OCR line = brand, rest = name. Coarse but correct for a
  front-label photo. Currently only called on no-match exit paths.
- `trigramJaccard()` — exported from `trigramSearch.ts` specifically so brand matching and corpus
  search can share it.
- `BRAND_SUGGESTION_THRESHOLD = 0.6` — already tuned against real OCR output. Reuse the value.
- `isCommonTerm()` / `LATIN_COMMON_TERMS` — the seed vocabulary for the stopword list in step 4.
- Script-aware pools in `brandCorrection.ts` — Latin vs Cyrillic never cross-match. Preserve this.

---

## Guardrails — do not touch

- **Barcode lookup path.** It's exact-match and fast. Out of scope entirely.
- **INCI / ingredient search** (`inci_fts`, ingredient autocomplete). Different index, different
  callers. Out of scope.
- **`ocrNoiseFilter.ts`.** Confidence floor and height-ratio heuristics are tuned and working.
- **The "did you mean [Brand]?" chip UI** in the manual entry form. Step 3 reuses its *matcher*,
  it does not change its behaviour.
- **The sync / seed layer**, except in step 5 where it is explicitly in scope.
- **The existing "Product not found → Add manually" screens.** They are well built. The whole point
  of step 2 is to finally let them trigger; do not redesign them.

---

## Shared conventions

**Config module.** Every behavioural change and every tunable constant goes here, so a bad tuning
value is a config revert rather than a code revert, and so the eval harness can override values
without editing source:

```ts
// src/services/corpus/searchConfig.ts   ← created in STEP 1, extended by later steps
export const SEARCH_CONFIG = {
  segmentOcrQuery: true,      // step 1
  scoringV2: true,            // step 2
  minMatchScore: 0.5,         // step 2 — tuned by sweep, do not guess
  recallLimit: 100,           // step 2 — FTS recall stage
  maxResults: 6,              // step 2 — what the UI shows
  brandFilterThreshold: 0.75, // step 3
  stopwordsEnabled: true,     // step 4
  wordIndexEnabled: false     // step 5
};
```

Never hardcode any of these values at a call site — always read them from `SEARCH_CONFIG`, so the
harness sweep in step 2 actually changes behaviour.

**Normalization.** One shared function, used by every step that compares strings in JS:

```ts
export const normalizeForMatch = (s: string) =>
  s.normalize('NFD')
   .replace(/\p{Diacritic}/gu, '')     // Avène → avene  (corpus is French-heavy)
   .toLowerCase()
   .replace(/[^\p{L}\p{N}\s]/gu, ' ')
   .replace(/\s+/g, ' ')
   .trim();
```
Diacritic stripping is not optional — a large share of the corpus is French.

**bm25 gotcha.** SQLite FTS5 `bm25()` returns **negative** values and more negative = better match.
It is also **not comparable across different queries**. Use it only to order the recall stage.
Never threshold on a raw bm25 value.

---

## Definition of done for every step

1. The change is behind a `SEARCH_CONFIG` flag (step 1 creates the module; every later step adds
   its own flag rather than shipping unflagged).
2. `npm test` (or the project's test command) passes.
3. The eval harness from step 0 has been re-run and the before/after table is pasted into the
   step's report.
4. A short report is written back containing: what changed, the metric table, anything that got
   *worse*, and whether the next step still looks necessary.

Do not proceed to the next step without (3) and (4). The entire failure mode being fixed here is
"looked plausible, was never measured."
