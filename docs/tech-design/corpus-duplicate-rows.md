# Technical Design: Corpus Duplicate Product Rows
Spec: docs/specs/corpus-duplicate-rows.md
Author: tech-designer
Date: 2026-08-23

## 1. Architecture Overview

Two independent, offline ingest pipelines write into one shared Turso table (`products`), and
neither de-duplicates against the other or, beyond exact-`barcode` match, against itself:

```
OBF JSONL dump ──seed_obf.py──► products_seed.sql ──turso db shell──► products (source=obf_import)
                 dedup key: barcode only, in-memory, single-run scope, INSERT-only (no upsert)

vials_seed .xlsx ──(loader not in this repo; per db-update-log-2026-07-25.md: "upsert on uid")──►
                    products (source=vials_seed)
                    barcode collisions vs. obf_import resolved ad hoc at load time (4 of 6
                    resolved by deleting the obf_import row; 2 "held" — vials_seed row kept with
                    barcode nulled, obf_import row left in place → a live cross-source duplicate)

products (Turso, single shared table, 21,084 rows)
   │ read-only replica / HTTP pipeline (src/services/turso/httpClient.ts)
   ▼
ProductRepository.search() / getByUid() / findByBarcode()   ← unaware of duplication; returns
   │                                                            whatever rows exist, ranked
   ▼
Screens (AddProductHubScreen, CaptureFlowScreen, FirstProductScreen, ManualProductFormScreen)
   │ on "add to shelf": Product.openBeautyFactsId := p.uid  (ONLY when p.source === 'obf_import';
   ▼                                                          null for vials_seed/community)
User's local shelf (AsyncStorage) — independent of the corpus after add (INTEGRATION_GUIDE.md §5)
```

No new module is proposed in this pass — this diagram documents where a future fix would need to
insert de-duplication (either pipeline-side, at import time, or corpus-side, as a one-time
cleanup pass), which is exactly what §5's open questions are blocked on choosing between.

## 2. API Contracts

N/A. This is an investigation/spec pass with no approved implementation (see spec §3 Non-Goals).
The corpus is a shared, pull-only Turso replica read by `ProductRepository`, not a service with
request/response contracts of its own; any de-duplication logic, once a strategy is chosen in
§5, would run as a data migration/pipeline script (`turso db shell` SQL or a Node script), not a
new endpoint. If the eventual fix strategy is a redirect/alias table (spec §10 Q1), that would
add one new table (`product_uid_redirects: old_uid TEXT PRIMARY KEY, canonical_uid TEXT`) — noted
here as the only concrete schema shape considered, not committed to.

## 3. Implementation Tasks

**Intentionally empty for this pass.** Per `.claude/rules/tech-design-template.md`'s gap-type
rules, §5 Q1–Q3 below are Type A/D (business-relevant or contradictory) gaps that must not be
resolved by assumption — they require a human decision before any `engineer` task can be scoped
atomically. Assigning implementation tasks now would mean guessing the fix strategy. The task
list below is what unblocks once §5 is answered — recorded here so the next pass doesn't have to
rediscover the shape of the work:

- Once Q1 is answered: `engineer (scope=backend)` — write the chosen cleanup as an idempotent,
  re-runnable script (mirroring `data/vials_seed_2.0_update.sql`'s "safe to re-run" property, not
  `seed_obf.py`'s insert-only pattern), operating on a snapshot dump first, applied to the Turso
  primary only after review. Files: new script under `handoff/` or `data/` (repo convention
  unclear — both exist; resolving that is part of this task, not a blocker).
- Once Q1 is answered and if it involves deletion/merge: `engineer (scope=backend)` — add the
  regression test named in spec Story 3 (existing `Product.openBeautyFactsId` reference survives
  a corpus row's deletion/merge with no crash, matching `INTEGRATION_GUIDE.md §5`'s existing
  contract).
- Once Q4 is answered "yes": `engineer (scope=backend)` — add a brand+name (`search_norm` or a
  `normalizeForMatch`-normalized key) de-duplication pass to `seed_obf.py` and/or the
  (undocumented, not in this repo) `vials_seed` loader, so re-running either against refreshed
  source data doesn't silently grow the 439-group count.
- No `frontend_layer` or `devops-lead` tasks are implied by anything found in this investigation.

## 4. Assumptions

- Used the existing generated `search_norm` column (`lower(trim(brand || ' ' || name))`) as the
  duplicate-detection grouping key, not a custom diacritic-stripped/punctuation-collapsed key.
  Alternative: apply `normalizeForMatch` (NFD diacritic strip + punctuation collapse, as used by
  the `ocr-improvement` task's scoring layer) before grouping.
  Reason: `search_norm` is a stored, indexed, DB-native column — a conservative starting proxy
  that *undercounts* near-miss duplicates (e.g. "Avène" vs. "Avene" would not collapse) rather
  than overcounts. This is the safer bias for a first quantification pass, and it means the 439/
  654 numbers in the spec are a **lower bound** on true duplication, not an upper bound. A
  follow-up pass with `normalizeForMatch` would likely find more groups; not done here to avoid
  importing the in-flight `ocr-improvement` task's modules per this task's own scope guardrail.
- Classified "genuine duplicate candidates" with a transparent SQL heuristic (`brand IS NOT NULL`
  on every row + group size 2 + name word-count ≥3), not a fuzzy-similarity score.
  Alternative: reuse `trigramJaccard()` / `scoreCandidate` from `src/services/corpus/` to compute
  a real per-pair similarity score.
  Reason: this task is explicitly barred from touching `src/services/corpus/*` (spec context);
  a plain SQL heuristic keeps every classified row auditable by hand (shown in spec §6) rather
  than hidden behind another task's in-flight scoring code, and its own false-positive/negative
  shape (misses branded-but-2-word-name dupes; would wrongly include a coincidental 3-word
  generic phrase under one brand) is fully disclosed rather than assumed away.
- Treated the historical `docs/database/db-update-log-2026-07-25.md` "2 held" barcode collisions
  as the explanation for why true cross-source duplication is likely undercounted by
  `search_norm` grouping (only 1 of 439 groups is cross-source).
  Alternative: assume cross-source duplication is genuinely rare (1 case) and not undercounted.
  Reason: one of the two "held" cases was independently found by this investigation's own
  grouping query (`the ordinary granactive retinoid 2% emulsion`, `vials_seed` row's `barcode`
  nulled exactly as the update log describes for "held" collisions) — direct evidence the
  mechanism exists; the second "held" case not appearing in the text-match grouping is more
  consistent with a name-formatting mismatch (e.g. Cyrillic vs. Latin, as `vials_seed` names
  often are) than with the mechanism being absent.

## 5. Open Questions

Mirrors spec §10 (owners assigned there); technical framing for whoever designs the fix:

- **Q1 (spec Q1):** Delete / redirect-table merge / import-time-prevention-only. Determines
  whether §3's schema note (a `product_uid_redirects` table) is built at all.
- **Q2 (spec Q2):** Whether the 72 meaningfully-different-`inci_raw` "duplicate" pairs are
  collapsed or kept as distinct SKUs — determines whether the cleanup script needs a
  content-similarity gate (not just a text-match gate) before merging.
- **Q3 (spec Q3):** Cross-source (`vials_seed` vs. `obf_import`) precedence rule, including
  whether to finish resolving the 2nd "held" collision from the 2026-07-25 update.
- **Q4 (spec Q4):** Whether import-time de-duplication is built, and its priority relative to the
  historical cleanup — these can ship independently (prevention now, historical cleanup later,
  or vice versa) but someone needs to sequence them.

No open question here is a pure Type-B technical call with one reasonable answer — all four
route to a human per the gap-type rules, which is why §3 (Implementation Tasks) is deliberately
thin. This is the expected shape for an investigation-stage tech design per this task's brief,
not an oversight against the template's usual "resolve open questions before implementation"
gate.
