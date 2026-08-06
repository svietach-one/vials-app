# Capability Model — Design

Status: LOCKED — architecture confirmed, ready for implementation.
Depends on: `02-profile-builder.md` §6 (Capability Aggregation stage, which this document parameterizes).

---

## 0. Interim canonical source policy

The codebase currently has **five independent, disagreeing** "what does this ingredient do" taxonomies: `actives.json.concerns/goals`, `labels.ts FUNCTIONAL_BENEFIT_INGREDIENTS`, `activeBadges.ts CATEGORY_KEYS`, `activeIngredientDensity.ts GROUP_KEYS`, and `skinConditionModifiers.ts`'s `RETI/ACID/VIT_C/BPO/AZA` groups. Full consolidation into one taxonomy is a separate, larger migration item (tracked in `05-roadmap.md`, not solved here).

**Until that consolidation lands, this design uses `actives.json.concerns` and `actives.json.goals` as the sole interim canonical source for every capability below.** This is a deliberate, explicit choice — not a gap. Reasons: it's the file every other ruleset (`procedures.json`, `seasons.json`) already treats as authoritative, and it's the source `goalCoverage.ts` already reuses correctly (the one file the prior audit flagged as the "model example"). Every capability sourced this way is tagged `heuristic`, not `deterministic`, specifically *because* other files disagree with it — the tag communicates "this is our chosen answer, not the only answer that exists in the codebase today."

---

## 1. Barrier Repair

- **Meaning:** supports or restores the skin's moisture barrier function.
- **Contributing properties:** `actives.json.classes[key].properties.barrierRepair: boolean` — an explicit, per-class flag (true for `ceramides`, `niacinamide`, `copper_peptides`, `peptide_signal`, `peptide_neuro`, `panthenol`, `cica`).
- **Current data source:** the `barrierRepair` boolean property directly — **not** `goals.barrier_repair`, which only lists 4 of the 7 flagged classes and would silently under-count.
- **Confidence:** `deterministic` — single unambiguous boolean per class, no competing source.
- **Current limitations:** boolean only, no gradation ("how much" barrier support is not modeled). A product with one weakly-supportive class and one with three strongly-supportive classes would need a saturation-based score (`02-profile-builder.md` §6) to differentiate, which is presence-count-based, not strength-based.

## 2. Exfoliation

- **Meaning:** chemical or physical removal of dead skin cells.
- **Contributing properties:** `actives.json.classes[key].properties.exfoliating: boolean` (true for `aha`, `bha`, `pha`, `physical_exfoliant`).
- **Current data source:** the `exfoliating` property directly.
- **Confidence:** `deterministic` within `actives.json` itself, **but** `labels.ts FUNCTIONAL_BENEFIT_INGREDIENTS.exfoliation` includes `retinoid`, which `actives.json` explicitly sets `exfoliating: false`. Per §0, this design follows `actives.json` and excludes retinoid — flagged here as a known, resolvable contradiction between sources, not a silent choice.
- **Current limitations:** potency exists per-matcher but is never aggregated into an intensity score — a 2%-BHA toner and a professional-strength peel would score identically today.

## 3. Hydration

- **Meaning:** adds or retains water content in the skin.
- **Contributing properties:** `concerns`/`goals.dehydration` membership (`hyaluronic_acid`, `glycerin_class`, `ceramides`).
- **Current data source:** `actives.json.goals.dehydration`, per §0.
- **Confidence:** `heuristic` — `labels.ts` and `activeBadges.ts` disagree on whether `panthenol` belongs (both add it; `goals.dehydration` doesn't), so the chosen source measurably differs from at least two others.
- **Current limitations:** no humectant-vs-occlusive mechanism split — `glycerin_class` currently merges glycerin, propylene glycol, betaine, and urea under one heading with no internal distinction.

## 4. Brightening

- **Meaning:** evens overall skin tone, general radiance.
- **Contributing properties:** `concerns: hyperpigmentation/dark_spots`, `goals.pigmentation`.
- **Current data source:** `actives.json.goals.pigmentation`, per §0 (broadest of the three disagreeing sources — includes AHA and retinoid, which `labels.ts`'s narrower list excludes).
- **Confidence:** `heuristic`.
- **Current limitations:** no potency weighting — `vitamin_c_pure` is clinically stronger for this effect than `niacinamide`, but a presence-only score treats them identically.

## 5. Pigmentation

- **Meaning:** targeted correction of existing dark spots, as distinct from general tone-evening.
- **Contributing properties:** identical source data to Brightening today.
- **Current data source:** `actives.json.goals.pigmentation`, same as Brightening.
- **Confidence:** `heuristic`.
- **Current limitations:** **redundant with Brightening as currently modeled** — no field distinguishes general-brightening ingredients from targeted-pigmentation-correction ones, so these two capability scores will be perfectly correlated until new differentiating metadata exists. Flagged explicitly so a consumer doesn't mistake two identical numbers for two independent signals.

## 6. Acne Control

- **Meaning:** reduces active breakouts / supports acne-prone skin.
- **Contributing properties:** `concerns`/`goals.acne` membership.
- **Current data source:** `actives.json.goals.acne` (5 members: `retinoid`, `bha`, `benzoyl_peroxide`, `azelaic_acid`, `niacinamide`), per §0.
- **Confidence:** `heuristic` — `labels.ts`'s narrower 3-member list excludes retinoid and niacinamide; `niacinamide`'s own `concerns` tag doesn't include `acne` even though it's in `goals.acne`, an internal inconsistency within the chosen source itself.
- **Current limitations:** no comedogenic/negative flag exists anywhere — the score can only credit positive actives, never penalize a pore-clogging ingredient, since no such property is modeled.

## 7. Sebum Regulation

- **Meaning:** reduces excess oil production.
- **Contributing properties:** `goals.oil_control` membership only (3 members: `niacinamide`, `bha`, `azelaic_acid`).
- **Current data source:** `actives.json.goals.oil_control` — the only source that exists; there is no independent tag to cross-check it against.
- **Confidence:** `heuristic`, and the weakest-supported of the ten capabilities — a single, unverified source with no corroboration.
- **Current limitations:** no `SkinConcern` value for oiliness/excess sebum exists in the type system at all. `UserProfile.hormoneTherapy` is collected with an in-code comment stating it's intended for future sebum/sensitivity weighting but has no downstream consumer today — a known, previously-anticipated gap.

## 8. Antioxidant Protection — cannot be calculated today

- **Meaning:** protects against oxidative/environmental damage (UV, pollution).
- **Contributing properties:** none exist. No property, concern, goal, or taxonomy anywhere in the codebase models "antioxidant" as a concept.
- **Current data source:** none. `vitamin_c_pure`/`vitamin_c_derivative` are chemically antioxidants but are only reachable via `concerns: hyperpigmentation/wrinkles/dark_spots` — using that as a proxy would be an unbacked inference, not a derivation, and would still miss every other antioxidant class entirely (vitamin E/tocopherol, ferulic acid, resveratrol, green tea extract, CoQ10 have no matcher, no class, nothing in `actives.json`).
- **Confidence:** `insufficient_data` by design — the builder must return `null`/`insufficient_data` here, never attempt the vitamin-C proxy.
- **Current limitations:** this is a genuine data gap, not a consolidation problem like the others above. Closing it requires new matcher classes for the unmodeled antioxidants plus a new `antioxidant: boolean` property — tracked in `05-roadmap.md` as explicitly deferred, not part of the first Product Profile milestone.

## 9. Soothing

- **Meaning:** calms irritation/redness, supports compromised skin.
- **Contributing properties:** `concerns: redness` (most internally consistent single source: `cica`, `panthenol`, `niacinamide`, `azelaic_acid`).
- **Current data source:** `actives.json.concerns: redness`, per §0.
- **Confidence:** `heuristic` — four disagreeing sources exist in total (`labels.ts` matches this one; `activeBadges.ts` swaps in peptides and drops azelaic_acid; `skinConditionModifiers.ts`'s per-condition `noPenaltyTags` adds ceramides/glycerin_class as a third variant).
- **Current limitations:** no boolean `soothing` class property exists comparable to `barrierRepair`/`exfoliating` — this capability is reconstructed from tag membership rather than read from a purpose-built field. Promoting it to an explicit property (mirroring Barrier Repair's treatment) would move this from `heuristic` to `deterministic`; flagged as a low-effort improvement in `05-roadmap.md`.

## 10. Anti-aging

- **Meaning:** reduces or prevents visible signs of aging (wrinkles, loss of elasticity).
- **Contributing properties:** `goals.aging` membership, `concerns: wrinkles`.
- **Current data source:** `actives.json.goals.aging` (6 members: `retinoid`, `peptide_signal`, `copper_peptides`, `vitamin_c_pure`, `vitamin_c_derivative`, `peptide_neuro`) — the best-agreeing array of the ten, `concerns: wrinkles` mostly corroborates it.
- **Confidence:** `heuristic` (still, per §0's blanket policy, despite being comparatively well-supported) — because this capability is **entirely absent** from the separate `FunctionalBenefit` UI enum (`hydration | exfoliation | soothing | anti_acne | barrier_repair | brightening`, 6 values, no anti-aging member). If a future consumer needs to power My Shelf filtering specifically with this capability, that UI-level enum needs its own extension — a real gap distinct from the data question.
- **Current limitations:** no prevention-vs-correction mechanism split — antioxidant-driven prevention is entirely unmodeled (see Antioxidant Protection above), so this capability currently only credits direct correction actives, not preventive ones.

---

## Summary table

| Capability | Calculable today? | Confidence | Primary limitation |
|---|---|---|---|
| Barrier Repair | Yes | `deterministic` | No gradation (boolean only) |
| Exfoliation | Yes | `deterministic`* | *One contradicting source exists (labels.ts); this design follows actives.json |
| Hydration | Yes | `heuristic` | Disagreeing membership, no humectant/occlusive split |
| Brightening | Yes | `heuristic` | No potency weighting |
| Pigmentation | Yes | `heuristic` | Redundant with Brightening (no differentiating field) |
| Acne Control | Yes | `heuristic` | No comedogenic/negative flag |
| Sebum Regulation | Yes, weakly | `heuristic` | Single unverified source, no `SkinConcern` value exists |
| **Antioxidant Protection** | **No** | `insufficient_data` | No data modeled anywhere — genuine gap |
| Soothing | Yes | `heuristic` | Four disagreeing sources, no boolean property |
| Anti-aging | Yes | `heuristic` | Absent from the separate UI `FunctionalBenefit` enum |

Two capabilities (Barrier Repair, Exfoliation) can ship at `deterministic` confidence immediately. One (Antioxidant Protection) cannot ship at all until new ingredient data is added. The remaining seven are calculable today at `heuristic` confidence using the interim canonical source in §0, and become more trustworthy — not newly possible — once taxonomy consolidation lands.
