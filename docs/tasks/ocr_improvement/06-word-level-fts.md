# Step 5 — Word-level FTS index (structural fix)

**Prerequisite:** read `00-README.md`. Steps 0, 1, 2 and 4 must be done and measured. Step 3
(brand-first filtering) is conditional and may legitimately have been skipped — that does not
block this step. Read no other step file.
**Schema changes: YES. Risk: medium–high.**

> **Gate — do not start without explicit human go-ahead.** This rebuilds the corpus index, touches
> `handoff/corpus_schema.sql`, the seed/sync scripts, and needs a migration for existing installs.
> It is only justified if the harness still shows weak precision after the earlier steps. Those
> steps work *around* character-level ranking; this one replaces it.

---

## The defect

`handoff/corpus_schema.sql:40-41, 56-60`

Two structural problems in one index:

1. **`tokenize='trigram'`** — SQLite indexes overlapping 3-character substrings, not words. So
   `bm25()` is real, but the "terms" it computes IDF over are fragments like `cre`, `eau`, `der`,
   shared by thousands of documents regardless of brand or category. There is no term-frequency
   signal over actual words like *cicalfate* or *niacinamide*.

2. **One flattened column** — `search_norm = lower(trim(brand || ' ' || name))`. Brand and product
   name are one bag of trigrams. The ranking cannot express "brand matched exactly, name didn't"
   versus "name matched, wrong brand entirely" — which is precisely the reported failure mode.

**This step supersedes step 3.** Brand-first filtering exists only because the flattened column
leaves hard exclusion as the sole way to make brand count. Separate `brand_norm` / `name_norm`
fields with bm25 weights give brand a graded, tunable influence instead — strictly better than a
hard filter, because a wrong brand degrades a candidate rather than deleting it, and there is no
fallback path to get wrong. If step 3 was skipped, that is expected; do not revive it here. If
step 3 was already implemented, consider removing the hard filter once the field weights are tuned,
and measure both ways.

---

## What to change

### 1. Schema

Add normalized per-field columns and a second FTS table alongside the existing one. **Do not drop
the trigram table** — it is the typo-tolerance fallback.

```sql
ALTER TABLE products ADD COLUMN brand_norm TEXT;
ALTER TABLE products ADD COLUMN name_norm  TEXT;

CREATE VIRTUAL TABLE products_fts_words USING fts5(
  uid UNINDEXED,
  brand_norm,
  name_norm,
  content='products',
  content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);
```

`remove_diacritics 2` is required, not optional — the corpus is French-heavy and *Avène* must match
*avene*. Use mode `2`, not `1`; mode 1 has known gaps on some codepoints.

**External-content table caveat.** `content='products'` means this table is *not* populated by
writes to `products` — it must be built explicitly and kept in sync:

```sql
INSERT INTO products_fts_words(products_fts_words) VALUES('rebuild');
```

Run the rebuild after the seed/import populates `brand_norm` / `name_norm`, and add the same
triggers the existing `products_fts` uses on insert/update/delete (check how that one is kept in
sync in `corpus_schema.sql` and mirror it exactly — an index that silently drifts from the table is
worse than no index).

Population must use the *same* normalization as the JS `normalizeForMatch` from `00-README.md`.
Any divergence between how rows are indexed and how queries are normalized produces silent misses
that are very hard to diagnose later. If the two can't be made identical, write the normalizer once
in the seed script and mirror it in a single JS function with a test asserting they agree on a
fixture list.

### 2. Query strategy — word first, trigram as fallback

```
1. products_fts_words MATCH  with prefix on the last token ("niacin*")
   ORDER BY bm25(products_fts_words, 0.0, 2.0, 1.0)
   → score with the step 2 scorer, apply the cutoff
2. if nothing clears the cutoff → products_fts (trigram) as today, same scorer, same cutoff
```

**Watch the `bm25()` weight arity.** FTS5 maps weights positionally across **all** declared
columns, including `UNINDEXED` ones. The table above declares three columns (`uid`, `brand_norm`,
`name_norm`), so the correct call is `bm25(tbl, 0.0, 2.0, 1.0)` — `uid` 0.0, brand 2.0, name 1.0.
Writing `bm25(tbl, 2.0, 1.0)` would weight `uid`, leave brand at 1.0, and default name to 1.0, i.e.
no field weighting at all. Verify the existing `products_fts` call at `corpus_schema.sql:56-60` and
in `ProductRepository.ts` for the same mistake while you are here — its declared columns should be
counted the same way.

Word-level handles the common case with real IDF; trigram remains for OCR garble and typos. Now
`bm25()`'s field weights finally do what they were always written to do, because the fields are
actually separate.

Keep the step 2 scorer as the arbiter in both branches. The point of this step is better
*retrieval and ranking input*, not a second competing notion of "good enough".

### 3. Migration and rollout

- Corpus schema version bump; existing installs must rebuild the local replica.
- Seed/sync scripts populate `brand_norm` / `name_norm` on import.
- Ship behind `SEARCH_CONFIG` so the word-index path can be switched off without a release if
  something is wrong in production.
- Plan for the download/rebuild cost on existing devices — check what the current sync layer does
  on a schema version change before assuming it's handled.

---

## Acceptance criteria

- [ ] `products_fts_words` populated for all ~17.3k rows; row counts match `products`; rebuild and
      sync triggers in place
- [ ] `bm25()` weight arity matches the declared column count (see above)
- [ ] Indexed normalization and query normalization proven identical by test
- [ ] Word-first / trigram-fallback order implemented, both scored by the step 2 scorer
- [ ] Migration path verified on an existing install, not only a fresh one
- [ ] `SEARCH_CONFIG.wordIndexEnabled` can disable the word path at runtime
- [ ] Harness: `precision@1` improves on both fixture sets over the previous step's numbers;
      the `typo`-tagged slice does **not** regress (a regression there means the trigram fallback
      isn't being reached); `recall@retrieval` improves or holds
- [ ] Latency percentiles reported for both branches

---

## Report back

Before/after against the step 4 numbers, the migration plan actually used, and measured query
latency for both branches — a word index that is more accurate but noticeably slower on device is a
trade the team should see explicitly rather than discover in the field.

---

## Finally

Once this lands, `docs/database/db-tech-design.md` no longer describes the shipped search at all —
it still describes the pre-Turso Supabase design. Write the current retrieval pipeline up as a new
doc (recall stage, scorer, thresholds, brand resolution, fallback order, and the tuned constants
with the harness numbers that justified them). The absence of that doc is a root cause here in its
own right: nobody could tell that the implementation had drifted, because nothing described what it
was supposed to be.
