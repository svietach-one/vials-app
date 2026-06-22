# Vials App — Cosmetics Product Database: Complete Setup Guide

**Version:** 1.0  
**Date:** 2026-06-21  
**Status:** REFERENCE — read before writing any database code  

Related docs:
- `docs/database/db-product-spec.md` — business requirements and user stories  
- `docs/database/db-tech-design.md` — local SQLite + Supabase technical design  
- `progress/database-implementation.md` — developer task tracker  

---

## How Vivino Does It (and What We Learn From It)

Vivino is the closest architectural analogue. Understanding its patterns shapes every decision below.

Vivino maintains a central wine registry (~10 M labels). A user photographs a wine label → the image is sent to Vivino's backend → Google Vision API extracts text → a matching pipeline runs fuzzy text search against the registry → a wine ID is returned → the client receives ratings, region, and notes.

Key architectural lessons from Vivino:

1. **The central registry is the product.** The app is just a thin client. All intelligence — matching, ingredient data, community ratings — lives in the database.
2. **Barcode lookup is fast and cheap; image recognition is slow and expensive.** They are separate code paths, not one unified flow.
3. **Fuzzy text search is a first-class requirement, not an afterthought.** A label photo rarely produces perfect OCR output. The matching pipeline must tolerate noise.
4. **A local cache on the device eliminates the vast majority of network calls.** Once a user's catalog is established, lookups are instant.

For Vials, our flow maps as:

```
Camera / Barcode Scan
        │
        ├─── Barcode path: EAN/UPC → exact DB lookup (< 50 ms)
        │
        └─── Image/OCR path: photo → OCR service → text normalisation
                                → fuzzy search → ranked candidates
                                → user confirms match → product ID locked
```

---

## Step 1 — Architecture Analysis: Database Options

### Option A: PostgreSQL + pgvector (Recommended)

**What it is:** Standard relational database with a vector extension (`pgvector`) that stores ML embeddings alongside structured data. This is exactly what Supabase runs under the hood — you get both in one managed service.

**How it handles our two lookup modes:**

| Lookup mode | Mechanism | Expected latency |
|-------------|-----------|-----------------|
| Barcode (exact) | `WHERE barcode = $1` on indexed `text` column | < 5 ms |
| Text from OCR (fuzzy) | `pg_trgm` trigram similarity or `pgvector` cosine distance on name embeddings | 20–80 ms |

**Why this wins for Vials:**
- Supabase wraps it with a REST API, RLS, Edge Functions, and a dashboard — zero infrastructure work in Phase 1.
- The existing `docs/database/db-tech-design.md` is already designed around this stack.
- `pgvector` lets us add semantic product search ("moisturiser with retinol, no fragrance") in Phase 2 without migrating databases.
- Row-level security handles the public/pending_review split without custom middleware.
- Strong consistency — no eventual-consistency surprises when a user contributes a new product.

**Weaknesses:** Single-region Supabase free tier has cold starts on Edge Functions (~300 ms). Acceptable for Phase 1.

---

### Option B: MongoDB Atlas + Atlas Search

**What it is:** Document database (JSON-native schema) with a managed Elasticsearch-compatible full-text search layer (Atlas Search) baked in.

**How it handles our two lookup modes:**

| Lookup mode | Mechanism | Expected latency |
|-------------|-----------|-----------------|
| Barcode (exact) | Index on `barcode` field | < 10 ms |
| Text from OCR (fuzzy) | Atlas Search `fuzzy` operator (Levenshtein distance) | 30–100 ms |

**Where MongoDB shines:**
- Cosmetic products have wildly inconsistent attribute sets. A foundation has shade codes; a serum has concentration percentages. MongoDB's flexible document model handles this without nullable columns.
- Schema evolution is easier — adding a new attribute (e.g., `certifications: ['vegan', 'cruelty-free']`) requires no migration.

**Where it hurts us:**
- No native SQL joins — querying "all products containing niacinamide" requires either embedding ingredient arrays inside the product document (fast read, expensive updates) or using `$lookup` (slow on large collections).
- Atlas Search is a separate cluster tier — costs money immediately.
- React Native SDKs for Realm (MongoDB's local DB) are heavier than `expo-sqlite`.
- Our ingredient conflict engine is inherently relational (many-to-many rules). Modeling this in MongoDB is awkward.

**Verdict:** Good choice if product attributes are extremely heterogeneous. For Vials, ingredient relationships tip the balance toward relational.

---

### Option C: PostgreSQL (main) + Elasticsearch (search layer)

**What it is:** Two separate systems. PostgreSQL stores the authoritative data. Elasticsearch (or OpenSearch) maintains a search index synced from Postgres via a CDC pipeline (Debezium or pg_logical replication).

**Where this wins:** Elasticsearch's fuzzy matching and `knn` vector search are best-in-class. This is what large-scale platforms (Sephora, INCI Decoder) use.

**Why we defer this:** It requires running two production systems, a sync pipeline, and managing index drift when Postgres writes don't reach Elasticsearch. The operational overhead is unjustified until the product registry exceeds ~1 M records or search query volume exceeds ~500 req/s. Neither is a Phase 1 concern.

**Flag for Phase 3** if PostgreSQL full-text search becomes a bottleneck.

---

### Decision Matrix

| Criterion | PostgreSQL + pgvector | MongoDB Atlas | PG + Elasticsearch |
|-----------|----------------------|---------------|-------------------|
| Barcode lookup speed | ★★★★★ | ★★★★☆ | ★★★★★ |
| OCR fuzzy search quality | ★★★★☆ | ★★★★☆ | ★★★★★ |
| Ingredient relationship modeling | ★★★★★ | ★★★☆☆ | ★★★★★ |
| Expo / React Native local cache fit | ★★★★★ (expo-sqlite) | ★★★☆☆ (Realm heavy) | ★★★★★ |
| Phase 1 operational simplicity | ★★★★★ (Supabase) | ★★★★☆ (Atlas) | ★★☆☆☆ |
| Cost at zero revenue | Free tier sufficient | Free tier sufficient | Two paid services |
| Vector/semantic search (Phase 2) | ★★★★★ (pgvector) | ★★★★☆ (Atlas) | ★★★★★ |

**Recommendation: PostgreSQL via Supabase for Phase 1 and Phase 2. Revisit Elasticsearch addition at Phase 3.**

---

## Step 2 — Database Schema Design

### Entity Relationship Overview

```
brands ──────────< products >──────────── product_ingredients >── ingredients
                      │
                      ├──── barcodes (1:many — one product, many regional barcodes)
                      ├──── product_images
                      └──── product_ratings
```

### Full Schema (PostgreSQL / Supabase)

```sql
-- ─── Extensions ──────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";     -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";      -- trigram fuzzy search
CREATE EXTENSION IF NOT EXISTS "vector";        -- pgvector for Phase 2

-- ─── Brands ──────────────────────────────────────────────────────────────────

CREATE TABLE brands (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  slug         text NOT NULL UNIQUE,          -- url-safe: "la-roche-posay"
  country      text,                          -- ISO 3166-1 alpha-2
  website      text,
  logo_url     text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_brands_name_trgm ON brands USING gin (name gin_trgm_ops);

-- ─── Products ─────────────────────────────────────────────────────────────────

CREATE TABLE products (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id               uuid REFERENCES brands (id),
  name                   text NOT NULL,
  name_normalized        text GENERATED ALWAYS AS (lower(trim(name))) STORED,
  product_type           text NOT NULL,       -- matches ProductType enum in src/types
  description            text,
  full_ingredients_text  text,                -- raw INCI string from packaging
  active_ingredient_keys text[] NOT NULL DEFAULT '{}',  -- conflict-engine keys
  skin_types_suitability text[] NOT NULL DEFAULT '{}',
  image_url              text,
  rating                 numeric(3,1),
  rating_count           int NOT NULL DEFAULT 0,
  source                 text NOT NULL DEFAULT 'community',
                           -- 'vials_seed' | 'obf_import' | 'community' | 'user_local'
  status                 text NOT NULL DEFAULT 'pending_review',
                           -- 'approved' | 'pending_review' | 'rejected'
  -- Phase 2: semantic search embedding (1536-dim OpenAI or 768-dim local)
  embedding              vector(1536),
  sync_version           bigint NOT NULL DEFAULT 0,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- Trigram index on name for fuzzy text search from OCR output
CREATE INDEX idx_products_name_trgm ON products USING gin (name_normalized gin_trgm_ops);
-- Array index for ingredient key filtering
CREATE INDEX idx_products_active_keys ON products USING gin (active_ingredient_keys);
-- Sync delta pulls
CREATE INDEX idx_products_sync_version ON products (sync_version);

-- RLS: only approved products are public
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_approved" ON products FOR SELECT USING (status = 'approved');
CREATE POLICY "contributor_own" ON products FOR INSERT WITH CHECK (true);

-- Auto-bump sync_version on update
CREATE SEQUENCE sync_version_seq START 1;
CREATE OR REPLACE FUNCTION bump_sync_version()
  RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.sync_version := nextval('sync_version_seq');
  NEW.updated_at   := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_products_sync
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION bump_sync_version();

-- ─── Barcodes ─────────────────────────────────────────────────────────────────

CREATE TABLE barcodes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  barcode     text NOT NULL,
  format      text NOT NULL DEFAULT 'EAN13',  -- 'EAN13' | 'UPCA' | 'QR' | 'DATAMATRIX'
  region      text,                            -- ISO 3166-1: 'US', 'EU', 'KR' etc.
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Critical: barcode lookup must be O(1)
CREATE UNIQUE INDEX idx_barcodes_barcode ON barcodes (barcode);
CREATE INDEX        idx_barcodes_product ON barcodes (product_id);

-- ─── Ingredients ──────────────────────────────────────────────────────────────

CREATE TABLE ingredients (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inci_name   text NOT NULL UNIQUE,           -- canonical INCI (e.g. "Niacinamide")
  cas_number  text,                           -- Chemical Abstracts Service ID
  synonyms    text[] NOT NULL DEFAULT '{}',   -- trade names, misspellings
  active_key  text,                           -- maps to ActiveIngredientKey enum
  ewg_score   int,                            -- 1–10 hazard score (Phase 2)
  function    text[],                         -- ['humectant', 'antioxidant']
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ingredients_inci_trgm ON ingredients USING gin (inci_name gin_trgm_ops);
CREATE INDEX idx_ingredients_synonyms  ON ingredients USING gin (synonyms);
CREATE INDEX idx_ingredients_active    ON ingredients (active_key)
  WHERE active_key IS NOT NULL;

-- ─── Product ↔ Ingredient junction ────────────────────────────────────────────

CREATE TABLE product_ingredients (
  product_id     uuid NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  ingredient_id  uuid NOT NULL REFERENCES ingredients (id),
  position       int,   -- INCI list order (1 = highest concentration)
  PRIMARY KEY (product_id, ingredient_id)
);

CREATE INDEX idx_pi_ingredient ON product_ingredients (ingredient_id);

-- ─── Product Images ──────────────────────────────────────────────────────────

CREATE TABLE product_images (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  url         text NOT NULL,
  type        text NOT NULL DEFAULT 'front', -- 'front' | 'back' | 'ingredients' | 'user'
  width       int,
  height      int,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── Community Contributions ─────────────────────────────────────────────────

CREATE TABLE contributions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   uuid REFERENCES products (id),  -- null if brand-new product
  contributor  text,                            -- hashed device fingerprint, not PII
  payload      jsonb NOT NULL,                 -- full submitted product JSON
  status       text NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  reviewer     text,
  reviewed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
```

### Schema Notes

- **`full_ingredients_text`** and **`product_ingredients`** rows coexist intentionally. The raw text is the source of truth for display; the junction rows are derived (parsed) and power the conflict engine.
- **`barcodes` is 1:many** to `products` because the same product SKU often has different barcodes per market (EU EAN vs US UPC).
- **`name_normalized`** is a generated computed column — you never write to it; PostgreSQL maintains it automatically. Trigram index lives on this column, not `name`, so case variations never cause misses.
- **`embedding vector(1536)`** is a Phase 2 column, added via `ALTER TABLE` when semantic search is implemented. It does not affect Phase 1 query plans.

---

## Step 3 — OCR Integration & Matching Workflow

### Two Separate Code Paths

Always treat these as distinct features. Mixing them into one "smart" handler creates maintenance debt.

```
Path A — BARCODE SCAN
─────────────────────
Phone camera (live preview)
    │
    ▼
expo-barcode-scanner (on-device, < 100ms, no network)
    │  decoded: "3600523011926" (EAN-13)
    ▼
Local SQLite: SELECT * FROM barcodes WHERE barcode = ?
    │  hit: return product instantly
    │  miss:
    ▼
Supabase REST: GET /rest/v1/barcodes?barcode=eq.{value}&select=product_id,...
    │  hit: cache locally, return product
    │  miss: open ManualProductFormScreen
    ▼
ProductDetail Screen


Path B — IMAGE / LABEL SCAN
────────────────────────────
Phone camera (captures still frame)
    │
    ▼
Option 1 (preferred): Google ML Kit Text Recognition (on-device, offline)
    │  — Expo module: @react-native-ml-kit/text-recognition
    │  — Returns: raw text blocks with bounding boxes
    │  — Latency: 200–400 ms on mid-range device
    │  — Cost: free
    │
Option 2 (fallback / higher accuracy): Google Cloud Vision API
    │  — REST call with base64-encoded JPEG
    │  — Returns: structured text with confidence scores
    │  — Latency: 800–1500 ms (network round-trip)
    │  — Cost: $1.50 / 1000 images
    │
    ▼
Text Normalisation (src/utils/ocrNormaliser.ts)
    │  - Strip noise characters: \n → space, strip © ® ™
    │  - Detect "product name" block (largest font region from ML Kit bounding boxes)
    │  - Detect "brand" block (typically above product name)
    │  - Detect "ingredients" block (INCI keyword heuristic: "Ingredients:", "INCI:")
    │
    ▼
Fuzzy Match Query (Supabase Edge Function: /functions/v1/match-product)
    │  Input: { brand_text, name_text, ingredient_snippet }
    │
    │  Step 1 — Brand filter (narrow candidate set):
    │    SELECT id FROM brands
    │    WHERE name % $brand_text           -- pg_trgm similarity > 0.3
    │    ORDER BY similarity(name, $brand_text) DESC LIMIT 5
    │
    │  Step 2 — Product match within brand:
    │    SELECT p.*, similarity(p.name_normalized, $name_text) AS score
    │    FROM products p
    │    WHERE p.brand_id = ANY($brand_ids)
    │      AND p.name_normalized % $name_text
    │    ORDER BY score DESC LIMIT 5
    │
    │  Step 3 — Ingredient cross-check (tiebreaker):
    │    If top-2 scores are within 0.1, compare ingredient snippet
    │    against full_ingredients_text using pg_trgm similarity
    │
    │  Returns: ranked candidate list (max 5)
    │
    ▼
Disambiguation UI (if > 1 candidate returned)
    │  - Show product thumbnails + names
    │  - User taps correct match
    │  - On confirm: barcode (if any) is linked to this product_id
    │
    ▼
ProductDetail Screen
```

### Mobile-Side Tool Recommendations

| Task | Recommended Library | Why |
|------|--------------------|----|
| Barcode scanning | `expo-barcode-scanner` (already in Expo SDK) | Zero native setup, handles EAN-13 / UPC-A / QR |
| On-device OCR | `@react-native-ml-kit/text-recognition` | Offline, fast, no API cost |
| Camera preview | `expo-camera` (already in project) | Unified camera access for both flows |
| Image compression before upload | `expo-image-manipulator` | Reduce payload before Cloud Vision fallback |

### Backend OCR Recommendation

**Do not proxy the camera frame through your own backend** unless you have a business reason (e.g., logging for training data). Send the image directly from the client to Google ML Kit (on-device) or Google Cloud Vision (if you need higher accuracy or structured layout detection). Your backend only receives the extracted text, not the raw image.

Exception: ingredient list parsing. For the complex "parse INCI list from raw OCR text" step, an Edge Function running `ingredientParser.ts` logic on the server ensures consistent normalisation and avoids shipping a large INCI dictionary to every client.

---

## Step 4 — Step-by-Step Development Roadmap

Work through these sprints in order. Each sprint produces a working, testable deliverable — not just scaffolding.

---

### Sprint 0 — Environment Setup (Day 1)
**Goal:** Every collaborator can run the app locally and connect to a shared Supabase dev project.

```
[ ] Create Supabase project (free tier)
[ ] Add to .env.local:
      EXPO_PUBLIC_SUPABASE_URL=...
      EXPO_PUBLIC_SUPABASE_ANON_KEY=...
      EXPO_PUBLIC_SUPABASE_SERVICE_KEY=...   (server-side only, never ship to client)
[ ] Install packages:
      npx expo install expo-sqlite @supabase/supabase-js
      npx expo install expo-barcode-scanner expo-camera expo-image-manipulator
      npm install @react-native-ml-kit/text-recognition
[ ] Confirm expo-sqlite opens a WAL-mode database on both iOS simulator and Android emulator
[ ] Add SUPABASE_* keys to Expo EAS secrets for CI
```

---

### Sprint 1 — Remote Schema & Seed Data (Days 2–4)
**Goal:** The Supabase database has the full schema and ≥ 500 seeded products you can query via REST.

```
[ ] Write supabase/migrations/20260621_001_initial.sql (full DDL from Step 2 above)
[ ] Run: supabase db push
[ ] Verify RLS: anon key can SELECT approved products, cannot INSERT to products directly
[ ] Write supabase/seed/brands.json + products.json (50 test products minimum)
[ ] Write supabase/seed/seed.ts — imports JSON, calls Supabase client
[ ] Run seed: npx tsx supabase/seed/seed.ts
[ ] Verify via Supabase dashboard: 50 rows in products, barcodes, product_ingredients
[ ] Write and run migration 002: pg_trgm extension + trigram indexes
[ ] Test fuzzy query manually in Supabase SQL editor:
      SELECT name, similarity(name_normalized, 'cerave hydrating cleanser')
      FROM products
      WHERE name_normalized % 'cerave hydrating cleanser'
      ORDER BY 2 DESC LIMIT 5;
```

---

### Sprint 2 — Local SQLite Layer (Days 5–7)
**Goal:** The app stores and retrieves products offline. No UI yet — tested via unit tests and Expo DevTools console.

```
[ ] DB-1: Write src/services/database/migrations/001_initial.ts (SQLite DDL)
[ ] DB-1: Write src/services/database/migrationRunner.ts
[ ] DB-2: Write src/services/database/DatabaseProvider.tsx (SQLiteProvider wrapper)
[ ] DB-3: Write src/services/database/ProductRepository.ts
          — findByBarcode(), search(), upsertMany(), save(), getById()
[ ] DB-4: Write src/services/database/InciRepository.ts
          — autocomplete(), findByKey(), bulkInsert()
[ ] Bundle assets/inci_seed.json (INCI dictionary, ~3 MB compressed)
[ ] DB-2: On first launch, seed inci_entries from JSON into SQLite
[ ] Wire DatabaseProvider into App.tsx (wrap NavigationContainer)
[ ] Manual smoke test: open app → check Expo logs for "SQLite ready" + inci row count
[ ] Unit tests for ProductRepository (mock expo-sqlite with in-memory SQLite)
```

---

### Sprint 3 — Barcode Scan Flow (Days 8–10)
**Goal:** User scans a barcode → sees product detail screen. Works offline if product was previously cached.

```
[ ] Add BarcodeScanner screen (or modal) using expo-barcode-scanner
[ ] On scan: ProductRepository.findByBarcode() → hit/miss branch
[ ] On miss: SyncService.fetchByBarcode() → Supabase REST call
[ ] On remote hit: upsert locally → navigate to ProductDetailScreen
[ ] On complete miss: navigate to ManualProductFormScreen (barcode pre-filled)
[ ] ProductDetailScreen: display name, brand, type, ingredient list, rating
[ ] Unit test: ProductRepository.findByBarcode() hit path (mock SQLite)
[ ] Integration test: full scan-to-detail flow with a seeded barcode
[ ] QA: scan 10 real product barcodes; verify hit rate
```

---

### Sprint 4 — OCR / Image Scan Flow (Days 11–15)
**Goal:** User photographs a product label → fuzzy match runs → product confirmed or user disambiguates.

```
[ ] Install @react-native-ml-kit/text-recognition
[ ] Write src/utils/ocrNormaliser.ts:
      — extractBrand(), extractProductName(), extractIngredientBlock()
[ ] Write supabase/functions/match-product/index.ts (Edge Function):
      — Receives { brand_text, name_text, ingredient_snippet }
      — Runs pg_trgm brand filter → product match → ingredient tiebreak
      — Returns ranked candidates[]
[ ] Deploy Edge Function: supabase functions deploy match-product
[ ] Write src/services/MatchingService.ts:
      — captureAndRecognise() — camera → ML Kit → ocrNormaliser → matchProduct()
      — matchProduct() — calls Edge Function, returns CandidateProduct[]
[ ] Build DisambiguationSheet component (bottom sheet with candidate list)
[ ] Wire into camera flow: single-tap photo → OCR → candidates → confirm → ProductDetail
[ ] Write src/utils/trigramSearch.ts (DB-5 from task tracker)
[ ] QA: photograph 20 different product labels; measure match rate
[ ] Fallback: if ML Kit confidence < 0.6, offer "Try Cloud Vision" button
          (calls Google Cloud Vision API via supabase Edge Function to protect API key)
```

---

### Sprint 5 — Sync Engine (Days 16–18)
**Goal:** Local SQLite stays fresh with delta pulls. User never sees stale data without knowing it.

```
[ ] Write supabase/functions/sync/index.ts:
      — GET ?since={sync_version}&limit=500
      — Returns { records: Product[], max_version: number }
[ ] Deploy: supabase functions deploy sync
[ ] DB-6: Write src/services/database/SyncService.ts
          — syncIfDue(): gated to once per 6 hours
          — pullDelta(): paginated pull, upserts via ProductRepository
          — fetchByBarcode(): on-demand single pull
[ ] Wire AppState listener in App.tsx:
      AppState.addEventListener('change', state => {
        if (state === 'active') SyncService.syncIfDue();
      })
[ ] Verify: seed a new product in Supabase → foreground app → product appears locally
[ ] Verify: airplane mode → scan a previously synced barcode → detail loads
[ ] Verify: user_local products are never overwritten by sync
```

---

### Sprint 6 — Community Contribution (Days 19–20)
**Goal:** A user can submit a manually entered product to the global registry.

```
[ ] Write supabase/functions/contribute/index.ts:
      — Validates payload with Zod (mirrors products schema)
      — Deduplicates on barcode (returns existing product_id if found)
      — Inserts into products (status = 'pending_review')
      — Inserts into contributions log
      — Returns 202 Accepted
[ ] Deploy: supabase functions deploy contribute
[ ] DB-7: Write src/services/database/ContributionService.ts
[ ] DB-8: Wire into ManualProductFormScreen post-save prompt
[ ] Verify: submit a manual product → row appears in Supabase contributions table
[ ] Verify: prompt never appears twice for the same product (AsyncStorage flag)
[ ] Build a minimal Supabase dashboard view for moderation (RLS admin policy)
```

---

### Sprint 7 — Polish & Phase 2 Preparation (Days 21–25)
**Goal:** Performance targets met, Phase 2 features scaffolded but not activated.

```
Performance
[ ] Measure barcode lookup on 100k-row SQLite: must be < 20 ms
[ ] Measure FTS5 search on 100k-row SQLite: must be < 100 ms
[ ] Profile sync pull of 500 records: must complete < 3 s on LTE

Phase 2 scaffolding (stub, not wired)
[ ] Add embedding column to local SQLite products table (BLOB, nullable)
[ ] Add vector(1536) column to Supabase products (ALTER TABLE — no data yet)
[ ] Document: "To activate semantic search, run the embedding backfill job in scripts/embed_products.ts"

Cleanup
[ ] Remove all console.log statements
[ ] Run npx tsc --noEmit — zero errors
[ ] Confirm all four UI states (loading, error, empty, data) on ProductDetailScreen
[ ] Tech-lead architecture review against docs/database/db-tech-design.md
```

---

## Quick Reference: Key File Paths

```
supabase/
  migrations/
    20260621_001_initial.sql    — remote PG schema
    20260621_002_search.sql     — pg_trgm indexes
  functions/
    sync/index.ts               — delta pull endpoint
    match-product/index.ts      — OCR fuzzy match
    contribute/index.ts         — community submission
  seed/
    brands.json
    products.json
    seed.ts

src/
  services/database/
    DatabaseProvider.tsx        — SQLiteProvider wrapper
    migrationRunner.ts          — applies local migrations
    migrations/001_initial.ts   — local SQLite DDL
    ProductRepository.ts        — CRUD + FTS search
    InciRepository.ts           — INCI autocomplete
    SyncService.ts              — delta pull + on-demand fetch
    ContributionService.ts      — community submit
  utils/
    ocrNormaliser.ts            — raw OCR → brand/name/ingredients
    trigramSearch.ts            — fuzzy normalisation
  screens/
    ManualProductFormScreen.tsx — manual entry + contribute prompt
    ProductDetailScreen.tsx     — product display

assets/
  inci_seed.json               — bundled INCI dictionary (~3 MB)
```

---

## Environment Variables Reference

```bash
# .env.local (never commit)
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...          # safe for client bundle
SUPABASE_SERVICE_KEY=eyJ...                   # server-side scripts only
EXPO_PUBLIC_GOOGLE_VISION_API_KEY=AIza...     # only if Cloud Vision fallback enabled
```

---

## Decision Log

| Decision | Rationale | Revisit When |
|----------|-----------|--------------|
| PostgreSQL over MongoDB | Ingredient relationships are inherently relational; Supabase free tier eliminates ops overhead | > 1 M product records |
| expo-sqlite over WatermelonDB | Zero native setup; WAL mode sufficient for dataset size | > 500 k local rows or reactive query requirement |
| ML Kit over Cloud Vision (primary) | Offline capability; no per-image API cost | Accuracy < 70 % on real-world labels |
| pg_trgm over pgvector (Phase 1 search) | No ML pipeline required; adequate for name/brand matching | Semantic queries needed ("moisturiser with retinol") |
| Supabase Edge Functions over custom Node server | No infrastructure; co-located with DB; Deno cold start acceptable at Phase 1 scale | > 1000 req/min sustained |
