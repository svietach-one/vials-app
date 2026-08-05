# Vials Corpus DB — Update Log

## 2026-07-25 — DB_vials_2.0.xlsx import + empty-INCI cleanup

Applied to live Turso `vials-corpus` (schema v2.1) via `data/vials_seed_2.0_update.sql` in the vials-app repo (idempotent — safe to re-run). Bundled snapshot `assets/corpus/vials_corpus.db` fully rebuilt from the post-update Turso dump (was a stale v2.0 file missing the entire earlier vials_seed load).

### What changed

| | before | after |
|---|---|---|
| vials_seed products | 3,495 (166 with empty INCI) | 3,742 (0 empty) |
| obf_import products | 17,346 | 17,342 (4 superseded by vials_seed barcodes) |
| product_tags | 14,843 | 15,659 (+819 new, −3 orphans) |
| products_fts | — | 21,084, in sync, integrity ok |

- Deleted all 166 existing rows with empty `inci_raw` (per product-owner decision: no product without an INCI list enters the DB).
- Imported 413 of 434 xlsx rows (upsert on `uid`; none overlapped the earlier seed load). Column map: ID→uid, brand→brand, product_name_origin→name, product_name_lacin→name_lacin, INCI→inci_raw, barcode→barcode, link→url, type→type.
- Data fixes on import: 1 missing type → `other` (FA17B413); `' moisturizer'` trimmed (E3F8A2BF, A64A2C1E); 6 barcode collisions with obf_import resolved in favor of vials_seed (4 applied, 2 held).
- 21 xlsx rows with empty INCI were **NOT imported** (product-owner decision after review — mostly accessories: brushes, sponges, foot file, tweezers, boob-shaper tape; plus a few Himalaya/AA products lacking INCI). IDs: 3FF651DA, 4AE193B4, 86539081, 77DE56A7, C0837446, ECDDD49E, 2CFA2E58, 06EC825D, 1CF63E39, EF6D9342, 0BFB9AC1, 09167631, CE006679, 5429E40E, 396AF110, AE6E5947, B3146732, A02F1BBD, 3D563187, B4F70547, 4D95E84D.
  - Note: ECDDD49E (8901138511784) and 06EC825D (8901138512811) have INCI available in the deleted-pre-release OBF rows with the same barcodes — can be rescued if wanted.

### Artifacts (vials-app repo, `data/`)

- `vials_seed_2.0_update.sql` — the applied update script
- `vials_corpus_backup_2026-07-25.sql` — pre-update Turso dump (rollback point)
- `vials_corpus_post_update.sql` — post-update dump (source of new bundled snapshot)
- `vials_corpus_v2.0_old_snapshot.db` — the replaced stale bundled snapshot
- `vials_corpus_new.db.gz` — gzipped copy of the new snapshot (can be deleted)

### Gotcha discovered

`turso db shell <db> .dump` emits broken FTS5 DDL (unescaped quotes in `INSERT INTO sqlite_schema` statements) — a dump cannot be replayed into vanilla sqlite3 as-is. Fix: strip all `_fts` statements + `sqlite_schema` inserts from the dump, replay, then recreate the two FTS tables from `handoff/corpus_schema.sql` and run `INSERT INTO ..._fts(...) VALUES('rebuild')`.
