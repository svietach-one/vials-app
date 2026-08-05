# Vials — Task: EU Fragrance Allergen Detection (Phase 1 — seed with original 26)
Task slug: vials-eu-allergen-detection
Date: 2026-08-04
Status: DESIGNED
Touches: `assets/`, `utils/conflictEngine.ts` (or a sibling parser), `CatalogList`, `RoutineStepCard`, product detail screen, `profileStore`

---

## Goal

Detect EU-regulated fragrance allergens in a product's INCI text and surface them as neutral informational badges (list, catalog card, routine card) and a detailed list on the product detail screen. Ship first with the original/legacy allergen set as the seed, then swap the JSON for the full 82-substance Annex III list later without code changes.

**Scope of this task: seed data + detection mechanism + display. The list itself is deliberately the smaller starter set; expanding to 82 is a data-only follow-up.**

---

## Why start with the original set

- The original list has been stable for ~20 years and is well-documented across many independent sources, so it's low-risk to seed.
- It covers the most common real-world cases — `Limonene` and `Linalool` in particular are the two most frequently present fragrance allergens across cosmetic categories, so even the starter set flags a large share of scented products.
- The full Annex III list (82 substances under Regulation (EU) 2023/1545, first hard label deadline 31 July 2026) is a superset — expanding is a JSON swap, not a code change, provided the mechanism is built list-agnostic from day one.

---

## 1. Seed data: `assets/eu_allergens_seed.json`

The original Annex III fragrance-allergen set. Names below are the INCI/label forms to match against `full_ingredients_text`. **Verify every entry against the official regulation text before treating as final** — same caution already applied to the brand dictionary (`ocr-brand-dictionary-reference.md`) and INCI seed; this list was assembled from multiple secondary sources plus the EMA appendix and SCCNFP opinion, but a regulatory-literate human check is required before shipping.

```
Alpha-isomethyl ionone
Amyl cinnamal
Amylcinnamyl alcohol
Anise alcohol (Anisyl alcohol)
Benzyl alcohol
Benzyl benzoate
Benzyl cinnamate
Benzyl salicylate
Butylphenyl methylpropional (Lilial)          ← see §1.1
Cinnamal
Cinnamyl alcohol
Citral
Citronellol
Coumarin
Eugenol
Evernia furfuracea (treemoss) extract
Evernia prunastri (oakmoss) extract
Farnesol
Geraniol
Hexyl cinnamal
Hydroxycitronellal
Hydroxyisohexyl 3-cyclohexene carboxaldehyde (Lyral / HICC)  ← see §1.1
Isoeugenol
Limonene
Linalool
Methyl 2-octynoate
```

Proposed JSON record shape (mirrors the `InciEntry` pattern from `db-product-spec.md`, so the same detection approach carries over to the full list later):

```json
{
  "list_version": "eu-annex-iii-original",
  "entries": [
    {
      "canonical": "Limonene",
      "synonyms": ["d-Limonene", "Limonene"],
      "cas": ["138-86-3", "5989-27-5", "5989-54-8"],
      "restricted": false
    }
  ]
}
```

### 1.1 Two entries are banned-but-keep

`Butylphenyl methylpropional` (Lilial) and `Hydroxyisohexyl 3-cyclohexene carboxaldehyde` (Lyral/HICC) are **prohibited in new EU products** since 2021–2022 (moved to the banned list). They are intentionally retained in the seed:

- The task is detecting what's printed on a product a user actually owns — older stock containing these can still be on someone's shelf.
- Mark them `"restricted": true` so the detail view can note "no longer permitted in new EU products" rather than treating them as a routine allergen. This is a deliberate decision, not an oversight — flag for review whether that extra note is worth showing or is over-scoped for Phase 1.

---

## 2. Detection mechanism (build list-agnostic)

- Scan `full_ingredients_text` against the seed's `canonical` + `synonyms`, same lowercase-normalised approach as the existing `parseInciTags`.
- Allergen names are standardised, so exact/near-exact matching is enough — this does **not** need the fuzzy trigram layer used for OCR brand matching. Keep it simple.
- Output: a list of matched entries (canonical names) per product, plus the `list_version` used, stored on the product record. Storing the version matters because the list has already changed once (original → 82) and will change again — without it, old detections can't be distinguished from ones computed against a newer list.
- The mechanism must not hardcode the 26-item set anywhere — swapping `eu_allergens_seed.json` for the 82-item file and bumping `list_version` is the only change required to expand.

---

## 3. Display

### 3.1 Catalog card + routine card — minimal badge only
A small round "A" badge, styled like the existing lightning-bolt "actives" indicator (same size, same treatment), shown when a product has ≥1 matched allergen. **Cobalt**, not amber:

- Cobalt is the reserved color for informational/analytical ingredient tags per the PRD color system; amber means caution about a specific problem (PAO, conflict). An allergen badge is neutral information (these are legal fragrance components), not a warning.
- No count, no text on the card — just the badge. Detail lives on the product detail screen. Do not overload the routine/catalog card.

### 3.2 Product detail screen — full list
Expandable list of the specific matched allergen names, each with a short neutral one-liner (e.g. "fragrance component, regulated in the EU as a potential allergen"). No hazard-score framing. For `restricted: true` entries, optionally note their banned-in-new-products status (see §1.1).

### 3.3 Personal allergens (optional, if cheap)
A user can mark specific allergens as personally relevant in `profileStore`. For that user, a personal match renders in **Cabernet** (the reserved "restriction for you specifically" color) instead of neutral Cobalt. Everyone else still sees neutral Cobalt. This mirrors how competitor apps let users flag ingredients they react to. Can be deferred if it stretches the task.

---

## 4. Acceptance criteria

- [ ] `eu_allergens_seed.json` bundled, one record per original allergen, with synonyms + CAS, human-verified against the regulation
- [ ] Detection runs off the JSON with no hardcoded allergen names; swapping to the 82-item file needs zero code change
- [ ] `list_version` is stored alongside each product's detected-allergen result
- [ ] Catalog + routine cards show the round "A" badge in Cobalt when ≥1 match, no text/count
- [ ] Product detail screen shows the full matched list with neutral copy
- [ ] Products with no fragrance allergens show no badge (not an empty badge)
- [ ] (If in scope) personal-allergen matches render Cabernet for that user only

---

## 5. Follow-up (separate task, data-only)

- Expand `eu_allergens_seed.json` to the full 82-substance Annex III list (Regulation (EU) 2023/1545), bump `list_version`, re-verify against the official EUR-Lex / CosIng source.
- Handle Annex III "group name" entries (one label name covering multiple CAS substances) — the 82-list has these; the original set is mostly stand-alone, so this complexity can wait until the expansion.
- Keep the file independently updatable (bundled JSON, not inline constants) so the list can be refreshed without a full app release — the list has changed before and will again.

---

## 6. Open items

- Regulatory-literate human verification of the seed list before shipping (blocking).
- Decide whether the `restricted: true` banned-product note (§1.1) is worth surfacing in Phase 1 or is over-scoped.
- Confirm the badge glyph/placement sits cleanly next to the existing actives lightning bolt without crowding the card (mockup already sketched separately).
