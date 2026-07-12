# Schema v2.1 — code change brief

Context for updating app code (`vials-spike/`) after the v2.1 migration (`data/migration_v2_1.sql`) and the `vials_seed` data load. The live Turso `vials-corpus` DB now differs from v2 (`docs/vials-db-schema-v2.md`) as follows.

## What changed in the DB

### 1. `products` — two new nullable columns

```sql
url        TEXT   -- product page URL (populated for vials_seed rows; NULL for obf_import)
name_lacin TEXT   -- latin transliteration of name (populated for ~594 vials_seed rows)
```

Unchanged: all existing columns, `search_norm` still generated from `brand + name` only (`name_lacin` is NOT part of `search_norm`).

### 2. `products_fts` — dropped and recreated with a second indexed column

```sql
CREATE VIRTUAL TABLE products_fts USING fts5(
  search_norm, name_lacin,
  content='products', content_rowid='id',
  tokenize='trigram'
);
```

Previously it indexed `search_norm` only. `name_lacin` is indexed raw (trigram tokenizer is case-insensitive by default, no pre-normalization needed).

### 3. New data

- `products`: +3,495 rows with `source = 'vials_seed'` (owned editorial data, not ODbL — the licensing firewall via `source` still applies). Total now 20,841. These rows may have `barcode = NULL` (junk/duplicate barcodes were nulled), names in Cyrillic, `type` values outside the OBF vocabulary (see below), and `image_url = NULL`.
- `product_tags`: +5,811 rows tagged from `inci_raw` (same `active_key` vocabulary as before).

## Required code changes

### A. Product type / interface

Add to the Product row type wherever it's defined:

```ts
url: string | null;
name_lacin: string | null;
```

### B. FTS search queries

Any query using `products_fts MATCH` now searches both columns by default — this is the desired behavior (a latin query like `cremobaza` matches via `name_lacin`, a Cyrillic query via `search_norm`). No change needed to basic MATCH.

But two things do need attention:

1. **`bm25(products_fts)`** now takes two columns. Default weighting (1.0, 1.0) is fine; optionally weight the primary name higher: `bm25(products_fts, 2.0, 1.0)`.
2. **Column-filtered queries**, if any use the `search_norm:` prefix syntax or column indexes, must account for the new column at index 1.

Example current query in `App.tsx` (lines ~67–69) works as-is but should be reviewed for ranking:

```sql
SELECT p.brand, p.name, bm25(products_fts) r
FROM products_fts f JOIN products p ON p.id = f.rowid
WHERE products_fts MATCH ? ORDER BY r LIMIT 5
```

Remember trigram FTS requires query-side tokenization into 3-grams (known open item) — queries shorter than 3 chars won't match.

### C. Display fallbacks

- Product names from `vials_seed` are mostly Cyrillic. Where the UI renders a name, prefer `name` but consider showing `name_lacin` as secondary text when present.
- `url` should be rendered as an outbound "product page" link when present. Do NOT show `url` for `obf_import` rows (always NULL there anyway).
- `image_url` is NULL for all `vials_seed` rows — ensure image components handle null (placeholder).
- `barcode` may be NULL for ~400 `vials_seed` rows — barcode-based lookups simply won't surface them; name search still does.

### D. `type` vocabulary expanded

`vials_seed` introduces type values not produced by the OBF classifier. If the app has a type→label/icon map, extend it (or fall back to 'other' rendering) for:

`shower_gel, lotion, cream, peeling, intimate, spf, complex, balm, hair_spray, spray, body_milk, eye_cream, emulsion, gel, bath, butter, powder` (plus existing: `cleanser, toner, mask, serum, shampoo, conditioner, oil, deodorant, exfoliant, eye_care, moisturizer, ...`).

Treat the map as open-ended: unknown type → 'other' fallback, never a crash.

### E. Replica refresh (operational, not code)

The migration dropped/recreated `products_fts`, so existing device replicas hold stale WAL frames. Dev devices need app data cleared for a fresh pull (known `403 WAL push blocked` symptom otherwise). If any onboarding/docs mention replica setup, note this.

## Non-changes (explicitly)

- `ingredients`, `ingredients_fts`, `product_tags` schemas: untouched.
- Conflict engine (`conflictEngine.ts`, `conflictRulesDb.ts`): no changes needed; new tags use the existing `active_key` vocabulary from `active_key_map.json`.
- Personal shelf local DB: untouched (references products by `uid`, which remains the stable key).
