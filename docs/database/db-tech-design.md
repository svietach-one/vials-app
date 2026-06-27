# Technical Design: Vials Cosmetics Product Database

**Spec:** docs/database/db-product-spec.md  
**Author:** Principal Architect  
**Date:** 2026-06-21  

---

## 1. Architecture Overview

The database layer has two tiers that mirror each other in schema:

```
┌──────────────────────────────────────────────────────────┐
│                     Mobile Client                        │
│                                                          │
│  ┌────────────────────┐    ┌──────────────────────────┐  │
│  │  ProductRepository  │    │   InciRepository         │  │
│  │  (service facade)  │    │   (autocomplete)         │  │
│  └────────┬───────────┘    └────────────┬─────────────┘  │
│           │                             │                 │
│  ┌────────▼─────────────────────────────▼─────────────┐  │
│  │            expo-sqlite (local SQLite)               │  │
│  │   tables: products · inci_entries · sync_log        │  │
│  └────────────────────────┬────────────────────────────┘  │
│                           │ SyncService (background)      │
└───────────────────────────┼──────────────────────────────┘
                            │ HTTPS / REST
┌───────────────────────────▼──────────────────────────────┐
│                  Remote Registry (Supabase)               │
│                                                          │
│   PostgreSQL tables: products · inci_entries             │
│   Supabase Edge Function: /sync · /contribute            │
│   Storage bucket: product-images (CDN)                   │
└──────────────────────────────────────────────────────────┘
```

Data flows: search and barcode lookups always hit SQLite first. Only on a local miss does the app reach the remote registry. The SyncService runs a delta pull on app foreground to keep SQLite fresh. User contributions flow outward via the `/contribute` edge function into the remote `pending_review` queue.

---

## 2. Technology Stack

### Local Storage — `expo-sqlite` (v14, bundled with Expo SDK 52)

**Choice rationale:** Ships zero-dependency with Expo. Supports WAL mode for concurrent reads. Proven in production on iOS 16+ and Android 10+. No extra native module linking required — critical for Expo Go compatibility during development.

**Alternative considered:** WatermelonDB (reactive queries, better for very large datasets). Rejected because it requires custom native build step and the dataset size (≤ 100 k rows) does not justify the overhead.

### Remote Registry — Supabase (PostgreSQL + Edge Functions)

**Choice rationale:** Provides a managed Postgres instance with a REST API that mirrors our schema exactly. Row-level security lets us gate `pending_review` records without custom auth middleware. Edge Functions (Deno) handle sync diffing and submission validation server-side.

**Alternative considered:** Firebase Firestore (NoSQL). Rejected because our schema is strongly relational (products ↔ INCI entries) and Firestore's eventual-consistency model complicates ordering in delta sync.

### Search — SQLite FTS5 (Full-Text Search extension)

Built into SQLite. Creates an inverted index over `name`, `brand`, and `inci_name` columns. Supports prefix queries (`"niacin*"`), phrase queries, and relevance ranking via `bm25()`. No additional dependency.

**Fuzzy matching layer:** A lightweight trigram similarity function implemented in JS normalises the query before it hits FTS5. For typos (e.g., "snicaramide"), we split the query into trigrams, compute Jaccard similarity against the FTS5 vocabulary, and promote the top-3 corrections before re-running the search. This stays in JS — no Postgres extension needed on mobile.

---

## 3. Local SQLite Schema

```sql
-- WAL mode for non-blocking reads during sync writes
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
  id                     TEXT PRIMARY KEY,
  barcode                TEXT,
  name                   TEXT NOT NULL,
  brand                  TEXT,
  product_type           TEXT NOT NULL,
  full_ingredients_text  TEXT,
  active_ingredient_keys TEXT NOT NULL DEFAULT '[]',  -- JSON array
  skin_types_suitability TEXT NOT NULL DEFAULT '[]',  -- JSON array
  image_url              TEXT,
  rating                 REAL,
  rating_count           INTEGER NOT NULL DEFAULT 0,
  source                 TEXT NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'approved',
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL,
  sync_version           INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode
  ON products (barcode) WHERE barcode IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_sync_version
  ON products (sync_version);

-- FTS5 virtual table — tokenises name and brand for fuzzy search
CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
  id UNINDEXED,
  name,
  brand,
  content='products',
  content_rowid='rowid'
);

CREATE TABLE IF NOT EXISTS inci_entries (
  id         TEXT PRIMARY KEY,
  inci_name  TEXT NOT NULL UNIQUE,
  synonyms   TEXT NOT NULL DEFAULT '[]',   -- JSON array
  active_key TEXT,
  concerns   TEXT NOT NULL DEFAULT '[]'    -- JSON array
);

CREATE VIRTUAL TABLE IF NOT EXISTS inci_fts USING fts5(
  id UNINDEXED,
  inci_name,
  synonyms,
  content='inci_entries',
  content_rowid='rowid'
);

CREATE TABLE IF NOT EXISTS sync_log (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  synced_at        TEXT NOT NULL,
  last_sync_version INTEGER NOT NULL,
  records_pulled   INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL  -- 'success' | 'partial' | 'error'
);
```

---

## 4. Remote Schema (PostgreSQL via Supabase)

The remote schema mirrors SQLite with Postgres-native types:

```sql
CREATE TABLE products (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode                text UNIQUE,
  name                   text NOT NULL,
  brand                  text,
  product_type           text NOT NULL,
  full_ingredients_text  text,
  active_ingredient_keys text[]  NOT NULL DEFAULT '{}',
  skin_types_suitability text[]  NOT NULL DEFAULT '{}',
  image_url              text,
  rating                 numeric(3,1),
  rating_count           int     NOT NULL DEFAULT 0,
  source                 text    NOT NULL,
  status                 text    NOT NULL DEFAULT 'pending_review',
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  sync_version           bigint  NOT NULL DEFAULT 0
);

-- Auto-increment sync_version on every update
CREATE FUNCTION increment_sync_version() RETURNS trigger AS $$
BEGIN NEW.sync_version := nextval('sync_version_seq'); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_version
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION increment_sync_version();

-- RLS: public reads only approved records
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "approved_visible" ON products
  FOR SELECT USING (status = 'approved');
```

---

## 5. Data Sync Strategy

### 5.1 Delta Pull (Remote → Local)

The SyncService runs once per app foreground event, gated to at most once per 6 hours.

```
1. Read last_sync_version from sync_log (0 on first run).
2. GET /functions/v1/sync?since={last_sync_version}&limit=500
3. Remote returns: { records: CosmeticsProduct[], max_version: number }
4. Upsert each record into local products table (INSERT OR REPLACE).
5. Rebuild FTS5 index for changed rows only.
6. Write new sync_log entry with max_version and status = 'success'.
7. If response has 500 records, repeat from step 2 with updated version (pagination).
```

**Conflict resolution:** Remote record always wins on delta pull. User's locally added products have `source = 'user_local'` and are never overwritten by sync — the upsert only targets records where `source != 'user_local'`.

### 5.2 Barcode Cache Miss (On-Demand Pull)

```
1. User scans barcode → SQLite lookup returns null.
2. GET /functions/v1/products?barcode={barcode}
3. On 200: insert record into local SQLite (source = 'vials_seed' | 'community').
4. Return product to UI — appears instantaneous to the user.
5. On 404: open ManualProductFormScreen with barcode pre-filled.
6. On network error: open ManualProductFormScreen with offline notice.
```

### 5.3 Community Contribution (Local → Remote)

```
1. User completes manual entry → product saved locally (source = 'user_local').
2. Post-save prompt: "Share with Vials community?"
3. On accept: POST /functions/v1/contribute with full product payload.
4. Edge Function validates schema (Zod), deduplicates on barcode, sets status = 'pending_review'.
5. Returns 202 Accepted. Local record unchanged.
6. On error: silently swallow — do NOT surface to user, contribution is optional.
```

---

## 6. Text Search & Fuzzy Matching

### 6.1 Exact Barcode Lookup
```ts
// O(1) — indexed
db.getFirstAsync('SELECT * FROM products WHERE barcode = ?', [barcode])
```

### 6.2 Full-Text Search on Name / Brand
```ts
// FTS5 prefix match: "cerav*" matches "CeraVe", "Ceravit", etc.
db.getAllAsync(
  `SELECT p.* FROM products_fts fts
   JOIN products p ON p.rowid = fts.rowid
   WHERE products_fts MATCH ?
   ORDER BY bm25(products_fts) LIMIT 20`,
  [normaliseQuery(query) + '*']
)
```

### 6.3 Trigram Normalisation for Typos
```ts
// src/utils/trigramSearch.ts
function normaliseQuery(raw: string): string {
  const q = raw.toLowerCase().trim();
  if (q.length < 4) return q;          // Short queries: pass through as-is
  const trigrams = buildTrigrams(q);   // Split into char-3-grams
  const correction = findClosestVocab(trigrams, ftsVocabCache); // Jaccard ≥ 0.4
  return correction ?? q;
}
```

The `ftsVocabCache` is a Set of brand/name tokens loaded from SQLite at startup (≈ 2 MB in memory for 100 k rows). It refreshes after each sync.

### 6.4 INCI Autocomplete
```ts
db.getAllAsync(
  `SELECT inci_name, active_key FROM inci_fts
   WHERE inci_fts MATCH ? LIMIT 10`,
  [query.toLowerCase() + '*']
)
```

---

## 7. Implementation Tasks

See `progress/database-implementation.md` for full task breakdown.

---

## 8. Assumptions

- All local SQLite operations use the `expo-sqlite` async API (`useSQLiteContext` hook + `SQLiteProvider` wrapper). No synchronous SQLite calls — they block the JS thread.
  Alternative: raw `openDatabaseSync`. Rejected — blocks React Native bridge.

- Supabase free tier (500 MB Postgres, 2 GB storage) is sufficient for Phase 1 (< 100 k products, < 5 GB images via CDN).
  Alternative: self-hosted Postgres on Render. Deferred to Phase 2 if costs become a concern.

- The INCI dictionary is distributed as a static JSON seed file bundled with the app (`assets/inci_seed.json`, ≈ 3 MB compressed). Loaded into SQLite on first launch.
  Alternative: download on first launch. Rejected — introduces network dependency at onboarding.

- `sync_version` uses a global Postgres sequence, not per-record `updated_at` timestamps. This avoids clock-skew bugs between mobile devices and the server.
  Alternative: `updated_at` comparison. Rejected — unreliable across time zones.

---

## 9. Open Questions

- **Moderation workflow:** Who reviews `pending_review` submissions? A Supabase dashboard manual review is the Phase 1 plan. Phase 2 should introduce an automated quality score (ingredient list parsability, barcode format validity) to auto-approve high-confidence submissions.
- **Image hosting:** Supabase Storage is proposed. Need to confirm CDN latency for target markets before launch.
