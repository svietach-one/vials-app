# Step 0 — Build the eval harness and capture a baseline

**Prerequisite:** read `00-README.md`. Read no other step file.
**Changes to app code: none.** This step only adds tooling and a baseline measurement.

---

## Why this is first

Every remaining step is a tuning decision (thresholds, weights, stopword lists). Without a fixed
test set and a baseline, those decisions are guesses, and the specific failure being fixed here is
already the result of shipping unmeasured matching logic. Nothing else starts until this runs.

---

## What to build

A standalone Node script that queries the **real Turso corpus read-only** (not a mocked
`CorpusQueryExecutor` — the whole point is measuring against 17k real rows).

```
scripts/search-eval/
  run.ts                 entry point
  fixtures/
    typed-queries.json   ~30 cases
    label-captures.json  ~30–50 cases
  baselines/
    <git-sha>.json       written by each run
  README.md              how to add a fixture
```

### Fixture format

```jsonc
// typed-queries.json
[
  { "id": "t001", "query": "the ordinary niacinamide", "expected": "prod_uid_abc",
    "tags": ["exact"] },
  { "id": "t002", "query": "cerav moisturis",          "expected": "prod_uid_def",
    "tags": ["typo", "truncation"] },
  { "id": "t003", "query": "crème pour peaux sensibles", "expected": "not_in_corpus",
    "tags": ["generic"] }
]
```

```jsonc
// label-captures.json
[
  { "id": "c001",
    "rawText": "AVÈNE\nCicalfate+\nCrème réparatrice protectrice\nPeaux sensibles irritées",
    "expected": "prod_uid_xyz",
    "tags": ["generic-heavy"],
    "photo": "fixtures/photos/c001.jpg" }
]
```

**`tags` is required, not decorative.** Later steps gate on per-slice results ("typo fixtures must
not regress"), which is impossible without machine-readable tags. Use at least this vocabulary:
`exact`, `typo`, `truncation`, `generic`, `generic-heavy`, `same-brand-variant`, `cyrillic`,
`short-query`. The harness must be able to report every metric filtered to one tag.

**Critical detail:** store the *OCR output string*, not only the photo. Running Tesseract inside the
harness makes it slow, device-dependent and non-deterministic — the harness must measure the
*matcher*, not the OCR engine. Keep the photos alongside for reference and for re-generating
`rawText` if the OCR pipeline itself ever changes.

Source the ~30–50 label captures from the device QA photos already collected on
`feature/ocr-capture-quality`. Every case must be labelled with the correct `products.uid`, or
explicitly `"not_in_corpus"`. Include at minimum:

- 8–10 cases tagged `generic` whose correct answer is `not_in_corpus` (proves the cutoff works)
- ≥6 cases tagged `typo` (later steps gate specifically on this slice)
- several `same-brand-variant` pairs (the hardest real case)
- several `generic-heavy` labels (crème / soin / dermatologique / peaux sensibles)
- a few `cyrillic` products if the corpus has them
- 2–3 `short-query` cases (1–3 characters typed)

## Config override — required, not optional

Step 2 sweeps `minMatchScore` across nine values by re-running this harness. The harness must
therefore be able to override `SEARCH_CONFIG` (see `00-README.md`) per run without editing source:

```
npm run search-eval -- --set minMatchScore=0.55 --set maxResults=6 --label sweep-0.55
```

`--label` names the output file, so a nine-point sweep at one git SHA produces nine result files
instead of overwriting one. Build this now even though `searchConfig.ts` does not exist yet —
have the harness read an optional overrides object and pass it through; step 1 creates the module
it will point at. Retrofitting this mid-sweep defeats the purpose of doing measurement first.

---

## Metrics to compute

```
precision@1        result[0].uid === expected
precision@5        expected within first 5
false_top_1        result[0] is wrong AND has a different brand    ← track this one by name,
                                                                     it is the reported symptom
recall@retrieval   expected present in the RETRIEVAL stage output, measured BEFORE any
                     score cutoff or result cap is applied
no_match_rate      % of queries returning [] (after cutoff)
                     - should RISE for not_in_corpus cases
                     - must NOT rise for cases with a real expected match
mean_results       average result count (noise proxy)
p50/p95_latency_ms per-query wall time of the corpus call
```

`recall@retrieval` is deliberately measured before the cutoff. Later steps introduce a score floor
and a 6-result cap, which would make a naive "expected in returned set" metric drop *by design* and
make it useless as a regression guard. Expose the pre-cutoff candidate list from the search path
(behind a debug/eval option) so this stays measurable at every step. Every later step that says
"recall must not regress" means **this** metric.

Report each metric **split by fixture set** (typed vs label) and **filterable by tag** — they fail
differently and a change that helps one slice can hurt another.

Undefined-metric rules, so the headline numbers stay comparable across runs:

- `not_in_corpus` cases are excluded from `precision@1`, `precision@5`, `false_top_1` and
  `recall@retrieval`. They are scored **only** on `no_match_rate`.
- `no_match_rate` must be reported as two separate numbers — one over `not_in_corpus` cases (should
  rise) and one over cases with a real expected match (must not rise). A single blended figure
  hides exactly the regression it needs to catch.

---

## Output

1. A printed table to stdout, with per-tag breakdown.
2. `baselines/<git-sha>[-<label>].json` with the full per-case results, so any later run can diff
   case-by-case and show exactly which queries changed verdict.
3. A `--compare <file>` flag that prints a per-case diff (fixed / broken / unchanged).

The per-case diff matters more than the aggregate: a step that lifts precision@1 by 4 points while
silently breaking 6 previously-correct cases is not a good step, and only the diff shows that.

---

## Acceptance criteria

- [ ] `npm run search-eval` runs against the real corpus and prints the table
- [ ] ≥30 typed fixtures and ≥30 label fixtures, each with `expected` and `tags`
- [ ] ≥8 fixtures labelled `not_in_corpus`; ≥6 tagged `typo`
- [ ] `--set k=v` config override and `--label` output naming both work
- [ ] `recall@retrieval` is computed pre-cutoff and stays computable once step 2 adds a floor
- [ ] Latency percentiles reported
- [ ] Baseline JSON committed for the current HEAD
- [ ] `--compare` produces a readable per-case diff

---

## Report back

Paste the baseline table, and flag anything surprising in it — for example if `recall@20` is
already low, the problem is not only ranking but retrieval, and step 2's plan needs revisiting
before it's implemented.
