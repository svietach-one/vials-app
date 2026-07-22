-- Vials corpus DB (vials_corpus) — schema v2.1
-- Load into Turso: turso db shell vials-corpus < corpus_schema.sql
-- v2.1 adds products.url / products.name_lacin and reindexes products_fts
-- on both columns — see docs/tech-design/vials-db-schema-v2.1-changes.md

PRAGMA foreign_keys = ON;

-- ── INGREDIENTS (CosIng-seeded dictionary) ──────────────────────────
CREATE TABLE IF NOT EXISTS ingredients (
  id             INTEGER PRIMARY KEY,
  uid            TEXT NOT NULL UNIQUE,
  inci_name      TEXT NOT NULL,
  inci_name_norm TEXT GENERATED ALWAYS AS (lower(trim(inci_name))) STORED,
  synonyms       TEXT NOT NULL DEFAULT '[]',
  active_key     TEXT,
  functions      TEXT NOT NULL DEFAULT '[]',
  annexes        TEXT NOT NULL DEFAULT '[]',
  description    TEXT,                          -- CosIng Chem/IUPAC description (ingredient info screen)
  cas_number     TEXT,
  ec_number      TEXT,
  source         TEXT NOT NULL DEFAULT 'cosing',
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredients_norm   ON ingredients (inci_name_norm);
CREATE INDEX IF NOT EXISTS        idx_ingredients_active ON ingredients (active_key) WHERE active_key IS NOT NULL;

CREATE VIRTUAL TABLE IF NOT EXISTS ingredients_fts USING fts5(
  inci_name, synonyms,
  content='ingredients', content_rowid='id',
  prefix='2 3'
);

-- ── PRODUCTS (OBF + editorial + approved community) ─────────────────
CREATE TABLE IF NOT EXISTS products (
  id           INTEGER PRIMARY KEY,
  uid          TEXT NOT NULL UNIQUE,
  barcode      TEXT,
  brand        TEXT,
  name         TEXT NOT NULL,
  search_norm  TEXT GENERATED ALWAYS AS
               (lower(trim(coalesce(brand,'') || ' ' || name))) STORED,
  type         TEXT NOT NULL DEFAULT 'other',
  inci_raw     TEXT,
  image_url    TEXT,
  source       TEXT NOT NULL,
  rating       REAL,
  rating_count INTEGER NOT NULL DEFAULT 0,
  url          TEXT,                             -- product page URL (vials_seed only; NULL for obf_import) — v2.1
  name_lacin   TEXT,                              -- latin transliteration of name (vials_seed only) — v2.1
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode ON products (barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS        idx_products_source  ON products (source);

-- v2.1: reindexed on both search_norm and name_lacin (was search_norm only).
CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
  search_norm, name_lacin,
  content='products', content_rowid='id',
  tokenize='trigram'
);

-- ── PRODUCT_TAGS (conflict-engine biomarkers) ───────────────────────
CREATE TABLE IF NOT EXISTS product_tags (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  active_key TEXT NOT NULL,
  PRIMARY KEY (product_id, active_key)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_product_tags_key ON product_tags (active_key);
