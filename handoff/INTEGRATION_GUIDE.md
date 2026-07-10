# Vials Product DB — Integration Guide (for Claude Code)

**Audience:** a developer (with Claude Code) integrating an already-built product database into the Vials React Native / Expo app.
**Status of the DB:** built, seeded, and validated on a physical Android device. This is an *integration* task, not a design task — the schema, data, and sync are done. Do not redesign them.
**Your job:** wire the existing Turso corpus into the app through a small repository layer, replacing any direct Open Beauty Facts API calls.

---

## 0. TL;DR of what already exists

- A **Turso** (libSQL) cloud database `vials-corpus` in EU (aws-eu-west-1), already seeded with **24,100 ingredients** (CosIng dictionary) and **17,346 products** (OBF import, dogfood-only) plus **~9,000 conflict tags**.
- The app opens it as a **pull-only embedded replica** via `expo-sqlite`'s libSQL mode — reads are local and work offline; the device never writes to the corpus.
- Schema, data flow, and a proven client config are all documented here and in the companion files.

You are adding: a `SQLiteProvider` wired for libSQL, three repository modules, a trigram search helper, and a swap of the barcode/autocomplete paths onto these repositories.

---

## 1. Architecture in one picture

```
DEVICE
  vials_corpus.db   ← Turso embedded replica (PULL-ONLY, read-only token)
      products · product_tags · ingredients (+ FTS5)
      served locally, works fully offline after first sync
  shelf (existing)  ← user's own products, local, NEVER synced to corpus
      (Zustand + MMKV or local SQLite — unchanged by this task)

TURSO CLOUD (EU)
  vials-corpus (primary)  ← approved data only; written by seeding/moderation, never by the app
```

Two hard rules that the whole design depends on:
1. **The app never writes to the corpus.** Contributions (future) go through a separate endpoint, not the replica. The replica uses a **read-only** auth token.
2. **`source` is a firewall.** Rows with `source='obf_import'` are ODbL-licensed dogfood data to be **deleted before public release**. Never surface them as owned data; never let them leak into an exported/owned dataset. See §7.

---

## 2. Environment & dependencies

```bash
npx expo install expo-sqlite
```

`.env` (values via `turso db show vials-corpus --url` and `turso db tokens create vials-corpus --read-only`):
```
EXPO_PUBLIC_TURSO_URL=libsql://vials-corpus-<org>.turso.io
EXPO_PUBLIC_TURSO_TOKEN=<READ-ONLY token>
```

**Critical build config** — `app.json` must enable libSQL, or the native module ships as vanilla SQLite and every sync call throws `UnsatisfiedLinkError: libsql_sync()`:
```json
{ "expo": { "plugins": [ ["expo-sqlite", { "useLibSQL": true }] ] } }
```
After editing: `npx expo prebuild --clean && npx expo run:android`. **libSQL requires a dev build — it will not run in Expo Go.**

Validated environment (reference, not a requirement): JDK 17 (Zulu), Expo dev build, physical Android device. iOS `useLibSQL` builds are less mature — test separately before relying on them.

---

## 3. Schema (authoritative — matches the live DB)

Full DDL is in `corpus_schema.sql`. Summary of what the app reads:

**`products`** — one row per catalog product.
| column | type | notes |
|---|---|---|
| `id` | INTEGER PK | rowid; join key for `product_tags` and FTS |
| `uid` | TEXT UNIQUE | UUID; the **app-facing id** — store this on the shelf, not `id` |
| `barcode` | TEXT | EAN/UPC; unique when present, may be NULL |
| `brand` | TEXT | may be NULL |
| `name` | TEXT NOT NULL | |
| `search_norm` | TEXT (generated) | `lower(brand + ' ' + name)`; FTS source |
| `type` | TEXT | app product-type vocabulary; `'other'` fallback |
| `inci_raw` | TEXT | source-of-truth ingredient string |
| `image_url` | TEXT | |
| `source` | TEXT | `obf_import`\|`vials_seed`\|`community` — see §7 |
| `rating`, `rating_count` | REAL/INT | reserved; mostly empty |

**`ingredients`** — CosIng dictionary (autocomplete + the tag vocabulary).
`uid` (`cosing:<ref>`), `inci_name`, `inci_name_norm` (generated), `synonyms` (JSON array), `active_key` (nullable — the conflict-engine class), `functions` (JSON), `annexes` (JSON, e.g. `["III","V"]`), `cas_number`, `ec_number`.

**`product_tags`** — the conflict-engine bridge.
`(product_id, active_key)` composite PK. `active_key` values are exactly the app's canonical `ActiveIngredientKey` union (`retinoid`, `aha`, `bha`, `pha`, `vitamin_c_pure`, `vitamin_c_derivative`, `niacinamide`, `benzoyl_peroxide`, `azelaic_acid`, `copper_peptides`, `spf_filters`, `ceramides`, `hyaluronic_acid`, `panthenol`, `cica`). These map 1:1 onto `getProductActiveKeys()` output.

**FTS5:** `products_fts` (trigram tokenizer, over `search_norm`) for typo/OCR-tolerant search; `ingredients_fts` (prefix) for INCI autocomplete. Both are external-content tables kept in sync server-side — the app only queries them.

---

## 4. What to build (the integration surface)

Create `src/services/corpus/`. Four files, contracts below. Full reference implementations are in `INTEGRATION_CODE.md`.

### 4.1 `CorpusProvider.tsx`
Wrap the app root (inside the existing providers, around the navigator):
```tsx
<SQLiteProvider databaseName="vials_corpus.db"
  options={{ libSQLOptions: { url: URL, authToken: TOKEN } }}>
```
On mount, trigger one background sync (`syncLibSQL()` if present) — **non-blocking, errors swallowed** (offline is normal). Never block first paint on sync.

### 4.2 `ProductRepository.ts`
```ts
findByBarcode(barcode: string): Promise<CorpusProduct | null>   // indexed, O(1)
search(query: string): Promise<CorpusProduct[]>                 // trigram FTS, top 20
getByUid(uid: string): Promise<CorpusProduct | null>
getActiveKeys(uid: string): Promise<ActiveIngredientKey[]>      // from product_tags
```
`search()` MUST use the trigram helper (§4.4) — a raw quoted query will not tolerate OCR noise.

### 4.3 `IngredientRepository.ts`
```ts
autocomplete(prefix: string): Promise<IngredientHit[]>   // ingredients_fts, top 10, prefix
getActiveKey(inciName: string): Promise<ActiveIngredientKey | null>
```

### 4.4 `trigramSearch.ts`
The one non-obvious helper. FTS5 trigram does **substring** matching, not similarity — so a noisy phrase must be decomposed into trigrams and OR-ed:
```ts
export function toTrigramQuery(raw: string): string {
  const grams = new Set<string>();
  for (const tok of raw.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean))
    for (let i = 0; i + 3 <= tok.length; i++) grams.add(tok.slice(i, i + 3));
  return [...grams].map(g => `"${g}"`).join(' OR ');
}
```
Rank results by `bm25(products_fts)`. This is what makes "The 0rdinary" match "The Ordinary".

---

## 5. Where it plugs into existing screens

- **Barcode scan flow** → replace direct OBF calls with `ProductRepository.findByBarcode()`. On miss, fall to the existing manual-entry form (barcode pre-filled). (Future: live OBF API fallback — out of scope here, see §7.)
- **Catalog search** → `ProductRepository.search()` + trigram helper; show a "no match — check spelling" empty state on zero results.
- **Manual entry ingredient field** → `IngredientRepository.autocomplete()` with a 300 ms debounce; insert the canonical `inci_name`, not the typed synonym.
- **Adding a corpus product to the shelf** → snapshot the fields you need (`uid`, brand, name, type, inci_raw, image_url) plus `getActiveKeys(uid)` into `Product.activeTags`. Store the corpus `uid`, then treat the shelf copy as independent (the corpus row may change or be deleted at the §7 cutover).

**Conflict engine:** no changes needed. `product_tags.active_key` already equals the `ActiveIngredientKey` space `getProductActiveKeys()` produces, so tagged corpus products feed `ConflictEngine.detectConflicts()` directly.

---

## 6. Acceptance tests (definition of done)

Run on a physical device with a dev build:
1. Replica reports 17,346 products / 24,100 ingredients after first sync.
2. `findByBarcode` on a known corpus barcode returns the product < 20 ms.
3. `search('the 0rdinary')` returns The Ordinary products (trigram helper in use).
4. `autocomplete('nia')` returns Niacinamide.
5. `getActiveKeys(uid)` for a retinol serum returns `retinoid` (+ any others).
6. **Airplane mode:** kill app, reopen, repeat 2–5 — all pass offline.
7. No write is ever issued to the corpus (grep the repos: only SELECT).

---

## 7. The OBF cutover (must be respected, do not skip)

The 17,346 `obf_import` rows are **ODbL-licensed dogfood data**, present so the app has realistic content during internal testing. They are **not** owned data and must be removed before public release:

```sql
DELETE FROM products WHERE source = 'obf_import';   -- run on the Turso primary pre-release
```
`product_tags` rows cascade automatically. Track readiness with the coverage metric **"% of scans answered by non-`obf_import` rows"**; run the cutover when owned (`vials_seed` + `community`) coverage is high enough not to gut the experience. Until then: never label OBF rows as Vials-owned in the UI, and include the attribution "Product data from Open Beauty Facts (ODbL)" wherever `obf_import` rows are shown.

Build the app so this DELETE causes no crash — products simply become "not found → manual entry". Do not hardcode any assumption that the catalog is large.

---

## 8. Companion files

| file | purpose |
|---|---|
| `corpus_schema.sql` | authoritative DDL (already applied to the live DB) |
| `INTEGRATION_CODE.md` | full reference implementations of the four modules in §4 |
| `DATA_PIPELINE.md` | how the DB was seeded/tagged — only needed to refresh data, not to integrate |
| `seed_cosing.py`, `seed_obf.py`, `tag_products.py`, `active_key_map.json` | the pipelines (data refresh only) |

Start with this file and `INTEGRATION_CODE.md`. You do not need the pipeline files to integrate.
