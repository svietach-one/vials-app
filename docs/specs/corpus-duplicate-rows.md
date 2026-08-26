# Corpus Duplicate Product Rows
Date: 2026-08-23
Author: planner-agent
Jira: N/A (kebab-case task slug per agent-layer-protocol.md: `corpus-duplicate-rows`)
Status: DRAFT

## AI-SDLC Flags
```
backend_layer:  true
frontend_layer: false
infra_changes:  false
```
(No infra change is proposed by *this* document — it is investigation-only. Expect
`infra_changes: true` on whichever future spec implements a fix, since that will touch the
Turso `products` table directly.)

## 1. Problem Statement

The `products` corpus table (Turso `vials-corpus`, 21,084 rows) contains more than one row for
the same real-world product under different `uid`s. This surfaced as an incidental side effect
of the unrelated `ocr-improvement` search-precision task: its Step 2 log
(`progress/ocr-improvement.md`, "corpus-duplicate-row artifacts") found that 4 of 11 hand-
inspected "broken" search results were not search bugs at all — the harness's `expected` uid and
the actual top-1 result were two different corpus rows with byte-identical brand+name text
(score 1.0 both ways), all 4 CeraVe products. That finding was anecdotal: 4 cases, found while
debugging something else, never quantified, and never checked for root cause.

This spec quantifies it directly against the live corpus (query methodology and full numbers in
§6 Data Requirements). Grouping all 21,084 products by the existing generated `search_norm`
column (`lower(trim(brand || ' ' || name))`) finds **439 groups with more than one row — 1,093
rows total, 654 of them "excess" beyond one row per group**. Of those 439 groups, 326 (427
excess rows) are genuinely brand-identified duplicates (not a generic/unbranded text collision);
a deeper sample of that set shows a consistent shape: identical display text, two different and
individually valid barcodes, no shared `uid` — these are not literal double-inserts of one row
(the `barcode` partial-unique index has **zero** violations, confirmed directly against the live
table), they are two independently-imported corpus entries for what a user recognizes as one
product. The CeraVe brand alone accounts for **8** such groups today, of which the
`ocr-improvement` task's small fixture set only happened to sample 4.

Left alone, this is an invisible ceiling on every future search-quality fix: no amount of
query-side scoring tuning can make "the right answer" unambiguous when the corpus itself
contains two equally-correct, equally-scored rows for it.

## 2. Goals

- Replace the 4-case anecdote with a reproducible, query-based count of duplicate product rows
  in the live corpus: 439 duplicate groups / 654 excess rows via `search_norm`, broken down by
  source (`obf_import`-only: 414 groups; `vials_seed`-only: 24 groups; cross-source: 1 group) and
  by likely-genuine-duplicate vs. coincidental-generic-text-collision (326 "fully branded" vs. 91
  "fully unbranded" vs. 22 mixed groups — see §6).
- Identify the mechanism(s) that let one real-world product end up as 2+ corpus rows, grounded in
  what `handoff/seed_obf.py`, `docs/database/db-update-log-2026-07-25.md`, and the live data
  actually show — not speculation about "the pipeline probably ran twice."
- Establish, verified directly against `src/types/index.ts` and every screen that writes it (not
  assumed), exactly which user-shelf data references a corpus `uid`, so a future fix's blast
  radius on existing users is accurate.
- Produce a decision-ready, owned list of open questions (fix strategy, source-of-truth
  precedence, historical-vs-future scope) so the next planning pass can go straight to a tech
  design instead of re-discovering these questions.

## 3. Non-Goals (explicitly out of scope)

- **Implementing any fix** (deleting rows, merging with a redirect/alias table, import-time
  prevention, or some combination). This spec defines the problem, the quantified scope, and the
  constraints a fix must respect. A follow-up spec/tech design covers implementation, gated on
  §10's open questions being answered.
- **"Fixing" the 91 fully-unbranded, generic-name groups** (e.g. 17 different rows whose `name`
  is literally just "Shampoo"/"shampoo"/"SHAMPOO", `brand` is `NULL`, and every row has a
  different, valid barcode — see §6). These are distinct products with poor/missing brand
  labeling in the source data, not duplicate-import artifacts. Treating them as duplicates and
  collapsing them would destroy real product diversity. Any UI symptom of this (generic queries
  ranking oddly) belongs to the separate, already-in-progress `ocr-improvement` task's
  stopword/scoring work, not to this data-integrity problem.
- **Auditing or fixing unrelated data-quality issues found incidentally**, e.g. the 2
  `vials_seed` rows whose `name` is the literal placeholder string "Название не найдено" ("name
  not found" in Russian) while `name_lacin`/`url`/`barcode` correctly identify two different real
  products (see §6). Logged here for whoever owns `vials_seed` data quality; not a duplicate-rows
  fix.
- **Refreshing or re-running the `obf_import` or `vials_seed` ingest pipelines** against updated
  source data.
- **Any change to `ProductRepository.search()`, scoring, or the FTS index.** That is the
  `ocr-improvement` task's scope; this task is about the data, not the query layer.
- **Deciding if/when to run the pre-release "OBF cutover"** (`DELETE FROM products WHERE
  source = 'obf_import'`, `INTEGRATION_GUIDE.md §7`). Unrelated, already-documented, separate
  decision with its own trigger condition (owned data coverage).

## 4. User Stories

### Story 1: Trustworthy search results
As a user searching for a product, I want the corpus to represent one real product as one
result, so that I don't see two near-identical entries for the same item and have no way to know
which one is "right."

**Acceptance Criteria:**
- [ ] Given the 8 CeraVe duplicate groups quantified in §6 (today all `obf_import`-only, all
  score 1.0 on both candidates for their respective query), when a future fix ships, then
  re-running this spec's grouping query (§6) against `search_norm LIKE 'cerave%'` returns 0
  groups with `n > 1`.
- [ ] Given the 115 "fully-branded, near-identical-`inci_raw`" duplicate groups identified in §6
  (the subset with the strongest genuine-duplicate signal: same brand, same specific ≥3-word
  name, two rows, ingredient text within 10% length of each other), when a future fix ships,
  then re-running the same grouping query returns 0 such groups.

### Story 2: A trustworthy scope number for whoever designs the fix
As the engineer who will eventually design the fix, I want a verified, repeatable count of
duplicate groups broken down by source and by genuine-vs-coincidental, so I can scope the work
against real numbers instead of a 4-case anecdote.

**Acceptance Criteria:**
- [ ] Given the live corpus, when grouping `products` by `search_norm` with `count(*) > 1`, then
  the result is 439 groups / 1,093 rows / 654 excess rows (the exact query is in §6; this is
  re-verifiable, not a one-time claim).
- [ ] Given those 439 groups, when split by whether `brand IS NULL` for every row in the group,
  then 326 are "fully branded" (427 excess rows, genuine-duplicate candidates) and 91 are "fully
  unbranded" (194 excess rows, excluded per §3's non-goal).

### Story 3: No silent data loss for existing users
As an existing Vials user with products on my shelf, I want any future corpus cleanup to never
silently break my saved product data, so my shelf and routines keep working exactly as before.

**Acceptance Criteria:**
- [ ] Given a shelf `Product` record with a non-null `openBeautyFactsId` (confirmed in code: this
  is the *only* field that persists a corpus `uid` onto a shelf item, and it is set only when
  `source === 'obf_import'` — `ManualProductFormScreen.tsx:560`, `FirstProductScreen.tsx:75`),
  when a future fix deletes or merges the corpus row that `uid` pointed to, then the shelf
  record's display and function are unaffected — this is already the documented contract
  (`INTEGRATION_GUIDE.md §5`: "treat the shelf copy as independent"), and the eventual
  implementation must include a test proving it still holds.
- [ ] Given a `vials_seed`-sourced shelf item (which persists **no** corpus-uid reference at all
  today — confirmed by grep, `openBeautyFactsId` is hardcoded `null` for any non-`obf_import`
  source), when a `vials_seed` duplicate row is deleted or merged, then there is no shelf-side
  blast radius to verify today — but the eventual implementation must re-confirm this against the
  code at fix time, in case a future feature has since started persisting a `vials_seed` uid
  reference somewhere.

## 5. UX / Behaviour

No new UI is proposed by this spec. Current user-visible symptom: for products in the 326
"fully branded" duplicate groups, a search can surface two near-identical result cards (same
brand, same name, different/invisible barcode) with no way for the user to tell them apart or
know which is "canonical" — this is what the `ocr-improvement` task's harness recorded as a
"broken" search case even though the search logic itself was working correctly against a corpus
that has two equally valid answers. Whatever fix is eventually designed should describe its own
target UX (e.g., does a merge ever need a user-facing "we combined two listings" moment, or is it
invisible); out of scope to prescribe here.

## 6. Data Requirements

No new data is introduced. This section documents exactly what was read and how, so the numbers
above are reproducible rather than asserted.

**Source:** Turso `vials-corpus`, `products` table (`handoff/corpus_schema.sql`), queried
read-only over the same HTTP "pipeline" wire protocol as `src/services/turso/httpClient.ts`
(`POST {origin}/v2/pipeline`), using the existing read-only `EXPO_PUBLIC_TURSO_HTTP_URL` /
`EXPO_PUBLIC_TURSO_TOKEN` from `.env.local`. No app code was imported or modified; no row was
written.

**Snapshot date:** 2026-08-23. These are point-in-time counts and will drift as the corpus is
refreshed — re-run the queries below at fix time rather than trusting this document's numbers as
current.

**Totals:**
| metric | value |
|---|---|
| Total `products` rows | 21,084 (17,342 `obf_import` + 3,742 `vials_seed`) |
| Distinct `search_norm` values | 20,430 |
| Rows with non-NULL `barcode` sharing that barcode with another row | **0** (partial unique index `idx_products_barcode` holds with zero violations) |
| NULL-`barcode` rows | `vials_seed`: 452 / 3,742 (12.1%) · `obf_import`: 4 / 17,342 (0.02%) |

**Duplicate groups** (`GROUP BY search_norm HAVING count(*) > 1`):
| metric | value |
|---|---|
| Duplicate groups | 439 |
| Rows participating | 1,093 |
| "Excess" rows (Σ(n−1) per group) | 654 (= 21,084 − 20,430, consistent) |
| Group-size histogram | size 2: 344 groups · size 3: 49 · size 4: 26 · size 5–8: 15 · size 10–17 (long tail, all `brand IS NULL` generic collisions, e.g. "shampoo" ×17, "nivea" ×13, "dove" ×11): 5 |
| By source-combo | `obf_import`-only: 414 groups · `vials_seed`-only: 24 groups · cross-source (`obf_import`+`vials_seed`): **1 group** |
| Rows with NULL `barcode`, among all 1,093 duplicate-group rows | **2** (i.e. NULL barcode is not the mechanism — 1,091 of 1,093 duplicate-group rows carry their own distinct, valid barcode) |

**Genuine-duplicate vs. coincidental-collision split**, classified by whether `brand IS NULL` for
every row in the group:
| class | groups | excess rows | interpretation |
|---|---|---|---|
| Fully branded (`brand` set on every row) | 326 | 427 | credible "same product, two rows" candidates |
| Fully unbranded (`brand IS NULL` on every row) | 91 | 194 | distinct, poorly-labeled products coincidentally sharing generic text (see §3 non-goal) |
| Mixed | 22 | 33 | not deeply investigated; small enough to fold into the fix's review pass |

Within the 326 fully-branded groups, the strongest "best candidate" subset (size = 2, name has
≥3 words, i.e. a specific product name, not a bare noun) is **187 groups**. Sampling all 187
directly: **115 (61.5%) have `inci_raw` lengths within 10% of each other** (consistent with the
same or a near-identical listing), **72 (38.5%) have meaningfully different `inci_raw`**
(consistent with real regional/formulation SKU variants sharing one display name — e.g. a US vs.
EU ingredient-disclosure difference under the same product name). This split matters: a fix that
blindly deletes one row per pair would be safe for the 115 but would discard real, distinct
ingredient-list data for the 72 (see §10, Q2).

**Reference queries** (read-only, run against the live corpus):
```sql
-- overall duplicate groups
SELECT search_norm, count(*) n, count(DISTINCT source) n_sources,
       group_concat(DISTINCT source) sources
FROM products GROUP BY search_norm HAVING n > 1 ORDER BY n DESC;

-- structural barcode-uniqueness check
SELECT barcode, count(*) n FROM products
WHERE barcode IS NOT NULL GROUP BY barcode HAVING n > 1;   -- returns 0 rows
```

**Sample evidence** (full row dumps for CeraVe's 8 groups, the 1 cross-source group, and 15
"best candidate" pairs, including `inci_raw` excerpts) is preserved in this investigation's raw
output and can be regenerated on demand; not copied in full here to keep this document scannable.
Two illustrative examples:
- `search_norm = "cerave moisturizing cream"` (n=3, `obf_import`): barcodes `3606000537422`,
  `0301871373324`, `3606000537439` — three different, valid EAN-13 codes, same brand+name text.
- `search_norm = "the ordinary granactive retinoid 2% emulsion"` (the one cross-source group):
  the `obf_import` row keeps a real barcode (`0769915190045`); the `vials_seed` row's `barcode`
  is `NULL`. This directly matches `docs/database/db-update-log-2026-07-25.md`'s "6 barcode
  collisions with `obf_import` resolved in favor of `vials_seed` (4 applied, 2 held)" — this is
  very likely one of the 2 "held" (unresolved) collisions. The other "held" collision is not
  found by this text-matching method, most likely because its `vials_seed` and `obf_import` rows
  use differently-formatted name text (see §9 Assumptions in the tech design for why this method
  likely undercounts true cross-source duplicates).

## 7. Dependencies

- **Originating finding:** `progress/ocr-improvement.md`, Step 2 log entry ("corpus-duplicate-row
  artifacts", dated 2026-08-23). This spec exists because of that incidental discovery; read it
  for the original 4-case context.
- **Blocks:** the fix's own tech design (a future document) is blocked on §10's open questions.
- **Does not block:** the in-progress `ocr-improvement` task is unaffected and should not wait on
  this — its own step-2 log already treats these cases as "out of scope for this step; flagging
  as a corpus-data note," which this spec fulfills.
- **External services:** Turso (`vials-corpus`) — already in production use; this investigation
  used the existing read-only token, no new service or credential.

## 8. Security & Privacy

- Authentication required: No new auth surface. Investigation used the existing read-only Turso
  token already present in `.env.local` (per `.env.example`, scoped read-only).
- Data sensitivity: Product catalog data (brand, name, ingredients, barcode) — public commercial
  product information. No PII, no user data was read or touched.
- Compliance considerations: The ODbL "licensing firewall" must be preserved by any future fix —
  `INTEGRATION_GUIDE.md §7` requires `source='obf_import'` rows to stay distinguishable and
  deletable pre-release. A merge strategy that collapses an `obf_import` row into a `vials_seed`
  row must not cause the surviving row to be mislabeled as owned data.

## 9. Success Metrics

- Duplicate-group count for "fully branded" groups drops from 326 today to a documented,
  reviewed floor (the exact floor depends on §10 Q2's answer — some of the 72
  meaningfully-different-`inci_raw` pairs may be legitimately kept as distinct SKUs, not
  collapsed).
- The 115 "near-identical-`inci_raw`" duplicate groups (the unambiguous cases) drop to 0.
- 0 regressions in existing shelf `Product` records referencing a corpus `uid` via
  `openBeautyFactsId` (new test, written when the fix is implemented).
- The `ocr-improvement` task's search-eval harness (`scripts/search-eval/`), re-run after the
  fix, shows 0 remaining "broken" cases attributable to a corpus-duplicate-row artifact (the
  8 CeraVe groups and similar).

## 10. Open Questions

- [ ] **Q1 — Fix strategy.** Delete duplicate rows outright, merge with a redirect/alias table so
  a deleted `uid` still resolves for any existing `Product.openBeautyFactsId` reference, or leave
  historical duplicates alone and only prevent new ones at import time? → owner: **product owner**
  (this trades off corpus cleanliness against the uid-stability contract verified in Story 3; a
  business call, not a pure technical one, per the gap-type rules this task operates under).
- [ ] **Q2 — The 72 "meaningfully-different-`inci_raw`" pairs** (§6): collapse them like the
  clean 115 (accepting loss of the minor ingredient-list variation) or keep both as legitimate
  distinct SKUs and instead surface the ambiguity in-app? → owner: **product owner**.
- [ ] **Q3 — Cross-source precedence.** Should a `vials_seed` vs. `obf_import` collision always
  resolve in favor of `vials_seed` (the precedent set by
  `docs/database/db-update-log-2026-07-25.md`'s "4 applied, 2 held"), including the 2 "held"
  cases this spec found evidence of? → owner: **corpus/data-pipeline owner** (no single named
  owner is documented anywhere in `handoff/`; resolving this open question should also assign
  one).
- [ ] **Q4 — Import-time prevention.** Regardless of what happens to the existing 439 groups,
  should the `obf_import`/`vials_seed` loaders gain a real brand+name de-duplication pass (today
  `seed_obf.py` only de-duplicates on exact `barcode` match, and only within a single run) so the
  count doesn't silently grow on the next data refresh? → owner: **corpus/data-pipeline owner**.
- [ ] **Q5 — Placeholder-name data bug** (§3 non-goal, found incidentally): the 2 `vials_seed`
  rows with `name = "Название не найдено"`. Small, cheap, unrelated fix — worth doing regardless
  of Q1–Q4's outcome? → owner: **vials_seed data owner**.
