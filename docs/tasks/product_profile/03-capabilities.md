# Capability Model — Design

Status: LOCKED — architecture confirmed, ready for implementation.
Depends on: `02-profile-builder.md` §6 (Capability Aggregation stage, which this document parameterizes).

---

## 0. Interim canonical source policy

The codebase currently has **five independent, disagreeing** "what does this ingredient do" taxonomies: `actives.json.concerns/goals`, `labels.ts FUNCTIONAL_BENEFIT_INGREDIENTS`, `activeBadges.ts CATEGORY_KEYS`, `activeIngredientDensity.ts GROUP_KEYS`, and `skinConditionModifiers.ts`'s `RETI/ACID/VIT_C/BPO/AZA` groups. Full consolidation into one taxonomy is a separate, larger migration item (tracked in `05-roadmap.md`, not solved here).

**Until that consolidation lands, this design uses `actives.json.concerns` and `actives.json.goals` as the sole interim canonical source for every capability below.** This is a deliberate, explicit choice — not a gap. Reasons: it's the file every other ruleset (`procedures.json`, `seasons.json`) already treats as authoritative, and it's the source `goalCoverage.ts` already reuses correctly (the one file the prior audit flagged as the "model example"). Every capability sourced this way is tagged `heuristic`, not `deterministic`, specifically *because* other files disagree with it — the tag communicates "this is our chosen answer, not the only answer that exists in the codebase today."

---

## 0a. Cross-capability double-counting avoidance

Reconciling a single capability's source list (§0) surfaces a second, orthogonal problem: an ingredient can legitimately belong to `actives.json`'s source list for capability A *because of a mechanism that capability B already claims more directly*. Crediting both inflates A with a property that isn't really A's — the two scores stop being independent signals and start being the same underlying fact counted twice under different names.

**The rule:** before including an ingredient in a capability's reconciled list, check whether its presence there is better explained by a *different* capability that already has a more direct, specific claim on that mechanism. If so, exclude it from the secondary capability — even if the interim canonical source (`goals`/`concerns`) lists it there too.

Two instances found while reconciling Hydration/Acne Control/Brightening/Soothing (2026-08-06 audit):
- **niacinamide** is a member of `goals.acne`, but its acne-adjacent mechanism (oil regulation) is already the entire basis of the `sebumRegulation` capability (`goals.oil_control` includes niacinamide directly). Recommended exclusion from Acne Control — **flagged, not yet confirmed**; this is a clinical judgment about niacinamide's anti-inflammatory/acne mechanism beyond oil control, not a pure data-consistency call, and needs deliberate sign-off rather than being treated as settled by source-list comparison alone.
- **retinoid** is a member of `goals.pigmentation`, but it's already fully credited via Acne Control, Anti-aging, and Exfoliation. Its own `concerns` field doesn't even corroborate hyperpigmentation/dark_spots (see §4) — both signals point the same way. Excluded from Brightening.

**This is a judgment call, not a mechanical filter** — apply it per ingredient, per capability pair, with reasoning stated inline (as above), not as a blanket "each ingredient credits exactly one capability" rule. Some overlap is legitimate (e.g. an ingredient can genuinely support both Hydration and Barrier Repair via different, real mechanisms). The test is specificity: does the *other* capability's claim on this ingredient more precisely explain why it's on this list, such that crediting both would be double-counting the same fact rather than recognizing two distinct properties?

Apply this check to every remaining capability as Milestone 2 reconciliation proceeds (Pigmentation vs. Brightening in particular — §5 already flags them as likely fully redundant, which this same principle would resolve).

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
- **Contributing properties:** `concerns: dryness` membership (`hyaluronic_acid`, `glycerin_class`, `ceramides`, `panthenol`).
- **Current data source:** `actives.json.concerns: dryness` — reconciled 2026-08-06, superseding `goals.dehydration`. Verified a strict superset across all 20 classes in `actives.json` (adds only `panthenol`), and confirmed `'dryness'` is populated one-directionally in this field (per `rulesetTypes.ts`: *"concerns this class addresses"*) — no class carries it as a side-effect/caution marker.
- **Confidence:** `heuristic` — `labels.ts` includes `panthenol`, matching the new source. **Correction to this document's prior claim:** `activeBadges.ts` does **not** include `panthenol` in its hydration-equivalent bucket (it's filed under that source's own `soothing` category instead) — this doc previously stated both `labels.ts` and `activeBadges.ts` added it; only `labels.ts` does.
- **Current limitations:** no humectant-vs-occlusive mechanism split — `glycerin_class` currently merges glycerin, propylene glycol, betaine, and urea under one heading with no internal distinction.
- **Reconciliation status (2026-08-06):** approved for testing, pending dermatologist sign-off per `PRD_Spec.md` §6 — not a final clinical decision.

## 4. Brightening

- **Meaning:** evens overall skin tone, general radiance.
- **Contributing properties:** `concerns: hyperpigmentation/dark_spots`, `goals.pigmentation`.
- **Current data source:** `actives.json.goals.pigmentation`, **with `retinoid` excluded** — reconciled 2026-08-06 per §0a (already fully credited via Acne Control/Anti-aging/Exfoliation; also unsupported by retinoid's own `concerns` field, which lists `wrinkles/acne/pores` but not `hyperpigmentation/dark_spots`). `aha` is retained — unlike retinoid, its own `concerns` field corroborates `hyperpigmentation/dark_spots`, so `labels.ts`'s exclusion of it is the weaker position, not `actives.json`'s inclusion.
- **Confidence:** `heuristic`. `activeBadges.ts` has no Brightening-equivalent bucket at all — brightening-relevant ingredients there are split across its `exfoliant` and `soothing` buckets, neither of which claims "brightens"; not corroboration either way.
- **Current limitations:** no potency weighting — `vitamin_c_pure` is clinically stronger for this effect than `niacinamide`, but a presence-only score treats them identically.
- **Reconciliation status (2026-08-06):** approved for testing, pending dermatologist sign-off per `PRD_Spec.md` §6 — not a final clinical decision.
- **Downstream note:** §5 (Pigmentation) carries this same `retinoid` exclusion forward (option (a), 2026-08-06) — the two stay byte-identical, as originally documented. See §5's own open item on whether that should eventually change.

## 5. Pigmentation

- **Meaning:** targeted correction of existing dark spots, as distinct from general tone-evening.
- **Contributing properties:** identical source data to Brightening today.
- **Current data source:** `actives.json.goals.pigmentation`, **with `retinoid` excluded** — reconciled 2026-08-06, carried forward from Brightening's §4 reconciliation (option (a): kept byte-identical, as originally documented). Same 5-member list as Brightening: `vitamin_c_pure`, `vitamin_c_derivative`, `azelaic_acid`, `aha`, `niacinamide`.
- **Confidence:** `heuristic`.
- **Current limitations:** **redundant with Brightening as currently modeled** — no field distinguishes general-brightening ingredients from targeted-pigmentation-correction ones, so these two capability scores remain perfectly correlated. Flagged explicitly so a consumer doesn't mistake two identical numbers for two independent signals.
- **Reconciliation status (2026-08-06):** approved for testing, pending dermatologist sign-off per `PRD_Spec.md` §6 — not a final clinical decision. **Important:** carrying Brightening's `retinoid` exclusion into Pigmentation is a *"no evidence to diverge yet"* call, not a *"these are clinically identical"* call — see the open item below.
- **Open item (2026-08-06) — flagged, not yet confirmed:** whether `retinoid` should count for Pigmentation specifically, as distinct from Brightening, is an unresolved clinical question this reconciliation did not answer. Retinoids have real dermatological use in fading post-inflammatory hyperpigmentation/dark spots — a mechanism arguably more specific to *this* capability's meaning ("targeted correction of existing dark spots") than to Brightening's ("general tone-evening"). The current data model has no field capable of representing that distinction either way (§0a's double-counting logic settles whether `retinoid` counts for Brightening broadly; it says nothing about whether Pigmentation, if it ever becomes independently modeled, should differ). Applying (a) here reflects the absence of evidence to model them differently today, not a judgment that they're clinically interchangeable. Should go to the same dermatologist review pass as the three approved capabilities above — not be treated as settled by this reconciliation.

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
- **Contributing properties:** `concerns: redness` (`cica`, `panthenol`, `niacinamide`, `azelaic_acid`).
- **Current data source:** `actives.json.concerns: redness` — reconciled 2026-08-06, source unchanged from §0's interim choice, but now explicitly confirmed rather than merely defaulted-to: it's the one case in this audit where two independently-authored sources (`actives.json` and `labels.ts`) agree on the exact same 4-member set with zero divergence.
- **Confidence:** `heuristic` — two disagreements from other sources were reviewed and **explicitly rejected**: `activeBadges.ts` swaps in `copper_peptides`/`peptide_signal`/`peptide_neuro` and drops `azelaic_acid`, but every peptide's own `concerns` field is `wrinkles` only (no redness/sensitivity/eczema support anywhere), and `skinConditionModifiers.ts`'s `noPenaltyTags` — the source most purpose-built for "which ingredients are safe under reactive skin" — never lists a peptide either; treated as an unsupported outlier, not a corroborating variant. `skinConditionModifiers.ts` also adds `ceramides`/`glycerin_class` via `noPenaltyTags`, but that's a barrier/hydration claim, not an anti-redness one — including it here would double-count against Hydration/Barrier Repair (§0a).
- **Current limitations:** no boolean `soothing` class property exists comparable to `barrierRepair`/`exfoliating` — this capability is reconstructed from tag membership rather than read from a purpose-built field. Promoting it to an explicit property (mirroring Barrier Repair's treatment) would move this from `heuristic` to `deterministic`; flagged as a low-effort improvement in `05-roadmap.md`. Separately: `skinConditionModifiers.ts` omits `cica` from every condition's `noPenaltyTags`, despite `cica` appearing in every other source that addresses this capability — possibly an oversight in that table, unconfirmed, out of scope to fix here.
- **Reconciliation status (2026-08-06):** approved for testing, pending dermatologist sign-off per `PRD_Spec.md` §6 — not a final clinical decision.

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
