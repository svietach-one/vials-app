# Task Tracker: Cosmetics Product Database

**Status:** DESIGNED  
**Tech Design:** docs/database/db-tech-design.md  
**Spec:** docs/database/db-product-spec.md  
**Code:** —  

---

## Task Checklist

- [x] Product requirements (planner)
- [x] Technical design (planner)
- [ ] QA tests (qa-lead)
- [ ] Implementation (engineer)
- [ ] Architecture review (tech-lead)

---

## Implementation Tasks

### DB-1 — SQLite Schema & Migrations
**Files:** `src/services/database/migrations/`  
**Scope:** engineer (backend/native)

- Create `src/services/database/migrations/001_initial.ts` — executes the full SQLite DDL from the tech design (products, inci_entries, sync_log, FTS5 virtual tables, WAL pragma).
- Create `src/services/database/migrationRunner.ts` — tracks applied migrations via a `_schema_version` table; runs pending migrations sequentially on DB open.
- Unit test: migrationRunner applies 001 on blank DB, is idempotent on second call.

---

### DB-2 — DatabaseProvider & SQLiteContext
**Files:** `src/services/database/DatabaseProvider.tsx`, `src/services/database/useDatabaseContext.ts`  
**Scope:** engineer (frontend)

- Wrap the app root with `<SQLiteProvider databaseName="vials.db" onInit={runMigrations}>` from `expo-sqlite`.
- Export `useDatabaseContext()` hook that returns the typed `SQLiteDatabase` handle.
- On first launch, load `assets/inci_seed.json` and bulk-insert into `inci_entries` (skip if `sync_log` already has a record with `last_sync_version > 0`).
- Wire `DatabaseProvider` into `App.tsx` around the navigation root.

---

### DB-3 — ProductRepository Service
**Files:** `src/services/database/ProductRepository.ts`  
**Scope:** engineer (backend/native)

- `findByBarcode(barcode: string): Promise<CosmeticsProduct | null>` — exact indexed lookup.
- `search(query: string): Promise<CosmeticsProduct[]>` — calls `normaliseQuery()` then FTS5, returns top 20 ranked results.
- `upsertMany(products: CosmeticsProduct[]): Promise<void>` — batch INSERT OR REPLACE used by SyncService.
- `save(product: CosmeticsProduct): Promise<void>` — saves a user-local product (source = 'user_local').
- `getById(id: string): Promise<CosmeticsProduct | null>` — primary key lookup.
- All methods must use the async `expo-sqlite` API (no synchronous calls).

---

### DB-4 — InciRepository Service
**Files:** `src/services/database/InciRepository.ts`  
**Scope:** engineer (backend/native)

- `autocomplete(query: string): Promise<InciEntry[]>` — FTS5 prefix search on `inci_name` and `synonyms`, returns top 10.
- `findByKey(activeKey: ActiveIngredientKey): Promise<InciEntry[]>` — returns all INCI entries that map to a given conflict-engine key.
- `bulkInsert(entries: InciEntry[]): Promise<void>` — used by seed loader at first launch.

---

### DB-5 — Trigram Normalisation Utility
**Files:** `src/utils/trigramSearch.ts`  
**Scope:** engineer (frontend/utils)

- `buildTrigrams(str: string): Set<string>` — splits a string into all 3-character substrings.
- `jaccardSimilarity(a: Set<string>, b: Set<string>): number` — intersection / union.
- `normaliseQuery(raw: string, vocab: Set<string>): string` — returns corrected token or original if no correction ≥ 0.4 Jaccard.
- `buildVocabCache(db: SQLiteDatabase): Promise<Set<string>>` — loads distinct name/brand tokens from SQLite at startup.
- Unit tests for all four functions covering empty strings, pure ASCII typos, and multi-word queries.

---

### DB-6 — SyncService
**Files:** `src/services/database/SyncService.ts`  
**Scope:** engineer (backend/native)

- `syncIfDue(): Promise<SyncResult>` — checks `sync_log` for last sync timestamp; skips if < 6 hours ago.
- `pullDelta(sinceVersion: number): Promise<number>` — pages through remote `/sync` endpoint in batches of 500, upserts via ProductRepository, returns new `max_version`.
- `fetchByBarcode(barcode: string): Promise<CosmeticsProduct | null>` — on-demand single-record pull on cache miss.
- Writes a `sync_log` entry (status = 'success' | 'error') after each run.
- Must never throw — all errors caught and returned as `SyncResult.error` string.
- Wire `syncIfDue()` call into `AppState` change listener (foreground event) in `App.tsx`.

---

### DB-7 — ContributionService
**Files:** `src/services/database/ContributionService.ts`  
**Scope:** engineer (backend/native)

- `submit(product: CosmeticsProduct): Promise<void>` — validates schema client-side with Zod, POSTs to Supabase Edge Function `/contribute`, swallows all errors silently.
- `hasContributed(productId: string): Promise<boolean>` — checks AsyncStorage flag so the prompt never appears twice for the same product.

---

### DB-8 — Wire into ManualProductFormScreen
**Files:** `src/screens/ManualProductFormScreen.tsx`  
**Scope:** engineer (frontend)

- Replace any direct OBF API calls with `ProductRepository.findByBarcode()` and `SyncService.fetchByBarcode()` for the barcode pre-fill path.
- Add ingredient field autocomplete using `InciRepository.autocomplete()` with 300 ms debounce.
- On successful save, trigger `ContributionService.submit()` (non-blocking, fire-and-forget) and show the contribution prompt if `!hasContributed(product.id)`.

---

### DB-9 — Wire into Catalog Search Screen
**Files:** `src/screens/CatalogScreen.tsx` (or equivalent search screen)  
**Scope:** engineer (frontend)

- Replace current search logic with `ProductRepository.search()`.
- Display "No results — try a different spelling" empty state when FTS5 returns 0 results.
- Tap on a remote-sourced result triggers `SyncService.fetchByBarcode()` to cache locally before navigating to detail.

---

### DB-10 — Supabase Remote Schema & Edge Functions
**Files:** `supabase/migrations/20260621_products.sql`, `supabase/functions/sync/`, `supabase/functions/contribute/`  
**Scope:** engineer (backend/devops)

- Write Supabase migration with the PostgreSQL DDL from the tech design (products table, RLS policy, sync_version trigger).
- Implement `sync` Edge Function: accepts `since` query param, returns delta batch with pagination cursor.
- Implement `contribute` Edge Function: validates payload with Zod, deduplicates on barcode, inserts into `pending_review`.
- Deploy to Supabase project; add `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`.

---

## Log

### 2026-06-21
- Spec and tech design authored. Task breakdown created. Awaiting qa-lead test writing before implementation begins.
