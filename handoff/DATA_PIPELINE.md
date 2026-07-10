# Vials Corpus — Data Pipeline Reference

**You do NOT need this to integrate the app.** This documents how the corpus was
seeded and tagged, so it can be refreshed or rebuilt later. Read `INTEGRATION_GUIDE.md`
for the integration task.

---

## Sources

| source | role | licence | in shipped DB? |
|---|---|---|---|
| **CosIng** (EU Commission ingredient inventory) | ingredient dictionary + `active_key` vocabulary | open EU data, no copyleft | yes (`ingredients`) |
| **Open Beauty Facts** dump | product corpus (dogfood only) | **ODbL (share-alike)** | yes now, **deleted pre-release** |
| Editorial `vials_seed` | owned actives-skincare coverage | owned | to be built |
| Community contributions | owned long-tail | owned | via future endpoint |

CosIng note: the copy used was an archived 2016 export. **Update (2026-07-07):** the EU
no longer publishes a bulk CosIng CSV at a fetchable URL — `ec.europa.eu/growth/tools-databases/cosing/`
was rebuilt as an interactive Angular SPA with no discovered export endpoint, and the
dataset's data.europa.eu catalog entry now 404s. The freshest real snapshot found (via
Wayback Machine CDX search — later captures of the old direct-download path just 302/307
redirect) is from **2019-01-16**, now used in `handoff/out/` (26,078 ingredients, up from
~24,100). Refreshed via `COSING_Ingredients-Fragrance.Inventory_2019-01-16.csv`, kept
locally in `handoff/` (gitignored, not committed — regenerate/refetch as needed).

Schema drift found in the 2019 export vs. the 2016 one: the EC number column was renamed
`EINECS/ELINCS No` → `EC No`. `seed_cosing.py` now checks both (falls back to `EC No`);
without that fix `ec_number` silently came out NULL for all 26,078 rows. The
`active_key` assignment script itself (the per-class regex classifier) was never checked
into `handoff/` — only its `active_key_map.json` output was — so a new
`assign_active_keys.py` re-applies that same map (+ the documented Annex VI → `spf_filters`
rule) rather than reconstructing the classifier from scratch; 252/26,078 ingredients got a
class this way, consistent with the original run's class distribution.

**Before launch, get a genuinely current export** — if the EU restores a bulk-download
path, or the CosIng tool exposes one, re-run `seed_cosing.py` against it; a decade+ of new
ingredients and annex amendments matter for EU regulatory accuracy and 2019 is not
"current." The pipeline auto-detects the header row, so a newer CSV still drops in without
code changes (aside from re-checking column names, as this refresh found necessary).

OBF reality check: the full OBF cosmetics DB is only ~66k records worldwide; after EU +
has-ingredients filtering, ~17k usable. It is **thin exactly in actives-heavy skincare**
(serums, toners) — which is why `vials_seed` + community coverage is load-bearing, not
optional.

---

## Pipelines (standalone scripts)

### 1. `seed_cosing.py` — dictionary
```
python3 seed_cosing.py COSING_Ingredients-Fragrance.Inventory_v2.csv out
# → out/ingredients_seed.sql  (load: turso db shell vials-corpus < ingredients_seed.sql)
```
Parses CosIng CSV → 24,100 unique ingredients. Normalizes names, extracts synonyms
(INN/Ph.Eur), functions, and **multi-annex membership** (`["III","V"]` — an ingredient
can sit in several annexes). Dedupes on normalized INCI name, keeping the richer record.

### 2. `active_key` assignment — the conflict vocabulary
Assigns each ingredient its canonical `ActiveIngredientKey` class (or NULL). Two signals:
- **Annex VI membership ⇒ `spf_filters`** (the EU's own legal UV-filter list — authoritative, catches filters a name-regex would miss).
- name/synonym patterns for the other 14 classes, with the pure-vs-derivative Vitamin C split preserved (only `ascorbic acid` → `vitamin_c_pure`; all esters → `vitamin_c_derivative`).
Output: `active_key_updates.sql` (applied to `ingredients`) and `active_key_map.json`
(the name→key map the product tagger consumes).

The original per-class classifier that *builds* `active_key_map.json` was never checked
into `handoff/`. To refresh `active_key_updates.sql` against a re-seeded `ingredients.db`,
`assign_active_keys.py` re-applies the existing map (+ the Annex VI rule) — it does not
regenerate the map itself:
```
python3 assign_active_keys.py out/ingredients.db active_key_map.json out
# → out/active_key_updates.sql  (load: turso db shell vials-corpus < active_key_updates.sql)
```
New ingredients not already covered by the map's ~283 curated names/synonyms come out
with `active_key = NULL` unless they're Annex VI. If the CosIng refresh introduced INCI
names for actives not yet in the map, extend `active_key_map.json` by hand before running
this script.

### 3. `seed_obf.py` — products (dogfood)
```
python3 seed_obf.py openbeautyfacts-products.jsonl.gz out --all-countries
# → out/products_seed.sql
```
Streams the OBF JSONL dump. Filter funnel: drop non-cosmetic, nameless, and
ingredientless rows; keep malformed-barcode rows with barcode nulled; dedupe on barcode
(richer record wins). Maps `categories_tags` → app product type, with a **multilingual
name-keyword fallback** (EN/FR/DE/NL/PL/ES) for the ~thousands of rows carrying only
generic tags. Every row stamped `source='obf_import'`. Result: 17,346 products.

`--all-countries` was chosen over EU-only: OBF is small enough that the extra ~5k
non-EU products (K-beauty/US imports EU users actually scan) are worth keeping. Drop the
flag for EU-only.

### 4. `tag_products.py` — populate `product_tags`
```
python3 tag_products.py out/products.db active_key_map.json out
# → out/product_tags_seed.sql
```
Tokenizes each product's `inci_raw`, matches tokens against the CosIng name→key map
(accent-folded, exact-match) plus a narrow word-boundary phrase fallback for
conflict-critical actives. **Dictionary-driven, not hardcoded regex** — new actives are a
data change, not a code change. Result: ~9,000 tags; 36% of products carry ≥1 active
(expected — most mass-market cosmetics contain none of the 15 tracked actives).

---

## Load order (rebuild from scratch)

```bash
turso db shell vials-corpus < corpus_schema.sql          # DDL
turso db shell vials-corpus < ingredients_seed.sql        # 24,100 ingredients
turso db shell vials-corpus < active_key_updates.sql      # active_key on dictionary
turso db shell vials-corpus < products_seed.sql           # 17,346 products (dogfood)
turso db shell vials-corpus < product_tags_seed.sql       # ~9,000 tags
# FTS rebuild statements are included at the end of each seed file.
```

---

## Known open item — parser parity (before launch, not before integration)

A parity diff between these CosIng-derived `active_key` assignments and the app's own
`parseActiveIngredientsFromInci()` (`actives.json` ruleset) found ~69 disagreements. Most
are the app ruleset's `vitamin_c_pure` matcher over-firing on derivatives (it excludes
only `ethyl ascorbic acid`), which can cause **false conflict warnings** (derivative
mis-read as pure C, tripping the C+niacinamide rule). Fix direction: broaden the
`vitamin_c_pure` negative pattern to exclude all ascorbyl/ascorbate forms, and treat the
dictionary as primary with the ruleset's mega-blend catches (cholesterol/phytosphingosine
→ ceramides) merged in. Tracked for the app team; does not block DB integration.
