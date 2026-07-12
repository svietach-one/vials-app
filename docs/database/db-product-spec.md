# Product Specification: Vials Cosmetics Product Database

**Version:** 1.0  
**Status:** DRAFT  
**Author:** Principal Architect  
**Date:** 2026-06-21  

---

> **Sync note (2026-07-07):** This draft predates the delivered database. The
> actual corpus (`handoff/corpus_schema.sql`, `handoff/INTEGRATION_GUIDE.md`)
> diverges from this spec in three load-bearing ways — see the inline notes
> in §4.1 and §5:
> 1. It's a **pull-only Turso/libSQL embedded replica** read locally via
>    `expo-sqlite` — not a client/server pair calling a "remote registry"
>    (§3, AC-1.2). The app never writes to it; there is no live per-request
>    remote query, only a background full-replica sync.
> 2. The record key is `id INTEGER PK` (internal rowid) + `uid TEXT UNIQUE`
>    (the app-facing id) — not a single UUID PK.
> 3. §5's claim that OBF-imported records "are owned by Vials and diverge
>    independently of OBF" is **incorrect** for what shipped: `obf_import`
>    rows stay ODbL-licensed dogfood data and must be deleted before public
>    release (`INTEGRATION_GUIDE.md` §7). Only `vials_seed`/`community` rows
>    are genuinely Vials-owned. Today the corpus is 100% `obf_import`
>    (24,100 ingredients / 17,346 products / ~9,000 tags, dogfood-only) — "our
>    own DB" is architecturally true (no third-party API in the request
>    path) but not yet true of the *data* until the cutover runs.
>
> US-2 (ingredient autocomplete) and US-3 (community contribution) are
> reference-implemented (`IngredientRepository.autocomplete`) or schema-only
> (`'community'` source value) respectively, but neither is wired into a
> screen yet — see the US-22 implementation note in `docs/USER_STORIES.md`.

---

## 1. Problem Statement

Vials relies on Open Beauty Facts (OBF) as the sole product data source. This introduces three critical failure modes:

1. **Coverage gaps** — OBF is sparse for niche, professional, and Asian cosmetics brands. Many user products return zero results, forcing fully manual entry with no ingredient assistance.
2. **Data quality variance** — OBF ingredient lists are user-contributed and inconsistently formatted. The conflict engine receives garbage input and produces false positives or misses real risks.
3. **Offline fragility** — A dead network during product addition blocks the entire scan-to-add flow. There is no local fallback corpus.

Our own Cosmetics Product Database eliminates all three problems by giving Vials authoritative, schema-controlled, offline-capable product data.

---

## 2. Business Goals

| # | Goal | Success Metric |
|---|------|----------------|
| G-1 | Reduce "no results found" rate on barcode scan | < 10 % of scans return no match after 6-month ramp |
| G-2 | Improve ingredient parse accuracy | Conflict engine precision ≥ 95 % on seeded products |
| G-3 | Enable fully offline product lookup | Product detail loads with zero network on a device that has synced at least once |
| G-4 | Accept community contributions without requiring moderation overhead | Automated schema validation gates bad submissions before they land |

---

## 3. User Stories

### US-1 — Barcode Scan Match
> As a user scanning a product barcode, I want the app to instantly return the product name, brand, type, and ingredient list — even if I'm offline — so I can add it to my catalog in one tap.

**Acceptance Criteria:**
- AC-1.1: If a local SQLite record exists for the barcode, the product detail screen loads without a network request.
- AC-1.2: If no local record exists, the app queries the remote registry. On match, the record is cached locally before displaying.

  > **As delivered:** there is no per-request remote query. The whole corpus
  > is pulled as a replica in the background (`syncCorpus`); a barcode miss
  > against the local replica is final for that lookup — it degrades
  > straight to AC-1.3, same as a genuine miss. A later sync may bring the
  > record in for the *next* scan.
- AC-1.3: If neither local nor remote has a match, the manual-entry form is pre-populated with any barcode metadata the scan returned (brand name from GS1 prefix if decodable).

  > **As delivered:** the app's `Product` type has no `barcode` field, so the
  > manual-entry form is not pre-filled with barcode metadata on a miss —
  > only with a prior corpus/search prefill, or blank for pure manual entry.

### US-2 — Manual Entry with Ingredient Autocomplete
> As a user adding a product manually, I want the ingredient field to autocomplete INCI names as I type so that my ingredient list is correctly normalised for the conflict engine.

**Acceptance Criteria:**
- AC-2.1: Typing ≥ 3 characters in the ingredient field triggers a local INCI dictionary lookup (no network call).
- AC-2.2: Suggestions appear within 100 ms on a mid-range device.
- AC-2.3: Selecting a suggestion inserts the canonical INCI name, not a synonym.

### US-3 — Community Product Contribution
> As a user whose product wasn't found in the database, I want to submit the product data I entered manually so that other users benefit from my contribution.

**Acceptance Criteria:**
- AC-3.1: After successful manual save, a "Contribute to Vials DB" prompt appears once.
- AC-3.2: The submission is validated client-side against the full product schema before upload.
- AC-3.3: Submissions enter a `pending_review` status and are invisible to other users until approved.
- AC-3.4: The contributing user's local record is not affected by moderation outcome.

### US-4 — Product Data Freshness
> As a returning user, I want my local product database to silently refresh in the background so my ingredient lists stay current without manual action.

**Acceptance Criteria:**
- AC-4.1: On app foreground with network, a sync job checks for records updated since the last sync timestamp.
- AC-4.2: Sync never blocks the UI — it runs on a background worker.
- AC-4.3: If sync fails, the app continues working on the last known local state.

---

## 4. Product Schema Requirements

### 4.1 Core Product Record

> **As delivered:** `id` is an internal `INTEGER PK` (rowid, used for joins to
> `product_tags`/FTS); `uid TEXT UNIQUE` is the actual app-facing id described
> below — store `uid` on the shelf, never the internal `id`. See
> `handoff/corpus_schema.sql`.

```
CosmeticsProduct {
  id                   UUID (PK)            — stable globally unique identifier
  barcode              string | null        — EAN-13, UPC-A, or QR payload; null for manual-only entries
  name                 string               — full commercial product name
  brand                string | null        — brand / manufacturer name
  product_type         ProductType          — enum matching src/types/index.ts ProductType union
  full_ingredients_text string | null       — raw INCI string as printed on packaging
  active_ingredient_keys ActiveIngredientKey[] — normalised keys (subset of full list, conflict-engine ready)
  skin_types_suitability SkinType[]         — empty = suitable for all
  image_url            string | null        — CDN URL of product photo
  rating               number | null        — 1–5 community average; null until ≥ 5 ratings
  rating_count         number               — default 0
  source               'vials_seed' | 'obf_import' | 'community' | 'user_local'
  status               'approved' | 'pending_review' | 'rejected'
  created_at           ISO 8601 timestamp
  updated_at           ISO 8601 timestamp
  sync_version         number               — monotonically increasing; used for delta sync
}
```

### 4.2 INCI Dictionary Record

```
InciEntry {
  id           UUID (PK)
  inci_name    string     — canonical INCI name (e.g. "Niacinamide")
  synonyms     string[]   — trade names, abbreviations, common misspellings
  active_key   ActiveIngredientKey | null  — maps to conflict engine if relevant
  concerns     string[]   — free-text hazard notes (Phase 2)
}
```

### 4.3 Field Constraints

| Field | Constraint | Rationale |
|-------|-----------|-----------|
| `name` | max 200 chars, non-empty | Prevent truncation in UI |
| `brand` | max 100 chars | UI card limits |
| `full_ingredients_text` | max 10 000 chars | Typical packaging ≤ 5 000 chars; headroom for OCR noise |
| `barcode` | unique index, nullable | Multiple products may share a `null` barcode |
| `rating` | 1.0 – 5.0, 1 decimal | Consistent with common review platforms |
| `product_type` | strict enum | Must match `ProductType` in `src/types/index.ts` exactly |

### 4.4 What Is Explicitly Out of Scope (Phase 1)

- Price data
- Retailer / availability links
- Full toxicology / EWG-style hazard scores (blocked on INCI dictionary completeness)
- Video content

---

## 5. Data Sources & Seeding Strategy

| Source | Role | Estimated Coverage |
|--------|------|--------------------|
| Open Beauty Facts export | One-time bulk import at launch; normalise to our schema | ~60 k records post-filter |
| Manual editorial seed | High-demand products (top 500 skincare SKUs globally) hand-curated | 500 records at launch |
| Community submissions | Ongoing gap-filling; gated by moderation | Grows with user base |

OBF import is treated as bootstrap data only. Once imported, records are owned by Vials and diverge independently of OBF.

> **Correction (2026-07-07):** This is not how the shipped licensing model
> works, and must not be treated as accurate. `source='obf_import'` rows
> remain ODbL-licensed Open Beauty Facts data — they are dogfood content for
> internal testing, not data Vials owns, and **must be deleted before public
> release** (`DELETE FROM products WHERE source = 'obf_import'`, cascading to
> `product_tags`). Only `vials_seed` (editorial) and `community` (moderated
> contributions) rows are Vials-owned. The app must never label an
> `obf_import` row as Vials-owned in the UI, and must show the attribution
> "Product data from Open Beauty Facts (ODbL)" wherever one is displayed.
> Track cutover readiness via "% of scans answered by non-`obf_import` rows."
> See `handoff/INTEGRATION_GUIDE.md` §7.

---

## 6. Out of Scope for This Spec

- Authentication and user accounts (handled by existing profile store)
- Routine logic and conflict detection (handled by `conflictEngine.ts`)
- Payment / monetisation of database access
