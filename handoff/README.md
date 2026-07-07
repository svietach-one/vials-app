# Vials Product DB — Handoff Package

The product database is **built, seeded, and validated on-device**. This package hands it
to a developer (using Claude Code) to integrate into the Vials app. It is an integration
task, not a design task.

## Read in this order

1. **`INTEGRATION_GUIDE.md`** — start here. Architecture, env/build config, schema,
   what to build, where it plugs in, acceptance tests, and the mandatory OBF cutover.
2. **`INTEGRATION_CODE.md`** — drop-in reference implementations for the four modules.
3. **`corpus_schema.sql`** — authoritative DDL (already applied to the live Turso DB).

## Only if refreshing/rebuilding data (not needed to integrate)

4. **`DATA_PIPELINE.md`** — how the corpus was seeded and tagged.
5. `seed_cosing.py`, `seed_obf.py`, `tag_products.py`, `active_key_map.json` — the pipelines.

## The five things not to get wrong

1. **Enable libSQL in `app.json`** (`useLibSQL: true`) and use a **dev build** — Expo Go can't run it.
2. **Read-only token, pull-only replica** — the app never writes to the corpus.
3. **Use the trigram helper for search** — FTS5 trigram is substring, not similarity; a raw query won't tolerate OCR noise.
4. **`product_tags.active_key` already equals the app's `ActiveIngredientKey`** — tagged products feed `ConflictEngine` with no changes.
5. **Delete `source='obf_import'` before public release** — it's ODbL dogfood data, not owned. Build so this DELETE can't crash the app.

## Current DB contents (dogfood state)

24,100 ingredients (CosIng) · 17,346 products (OBF, dogfood-only) · ~9,000 conflict tags ·
EU region (aws-eu-west-1) · ~30 MB on device after a fresh sync, fully offline-capable.
