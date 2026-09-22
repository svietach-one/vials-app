# Product Profile Builder — Design

Status: LOCKED — architecture confirmed, ready for implementation.
Depends on: `01-product-profile.md` (the interface this builder produces).

This document describes the pipeline that turns ingredient input into a `ProductProfile`. Algorithms and architecture only — no implementation code, per the design brief.

---

## 1. Inputs

The builder accepts exactly one of two entry shapes, converging immediately after resolution (see `01-product-profile.md` §4):

| Entry point | Provides | Used when |
|---|---|---|
| **Raw INCI text** | `sourceInciText: string`, `productType`, `brand`, `name` | Manual product save (`ProductForm`), before any corpus match exists |
| **Resolved corpus record** | `resolvedActiveKeys: ActiveIngredientKey[]` (already parsed), plus the same identity fields | Any product already matched against `services/corpus/` |

Both entry points also require: `productId` (existing or newly generated at save time).

**Not accepted as input:** user profile data, routine state, shelf contents. The builder is single-product, stateless with respect to the rest of the app — this is what keeps it reusable across UI, Decision Engine, and any future consumer without those consumers needing to supply irrelevant context.

---

## 2. Outputs

One fully-populated `ProductProfile` object, per the `01-product-profile.md` interface. The builder does not persist or cache its own output — that is a caller decision (see `06-open-questions.md`, "where does a profile live").

---

## 3. Build pipeline

Eight stages, strictly ordered — each stage's output is the next stage's input. No stage reads ahead.

```
 1. RESOLUTION
       │  raw INCI text → parsed tokens, OR pass through resolvedActiveKeys as-is
       ▼
 2. CORPUS × RULESET JOIN
       │  each activeKey → its actives.json class record (properties, concerns/goals, matchers)
       ▼
 3. CAPABILITY AGGREGATION
       │  per CapabilityKey: gather contributing classes, compute a presence-weighted score
       ▼
 4. PRIMARY FUNCTIONS RANKING
       │  sort capability scores descending, select top-N above a floor threshold
       ▼
 5. IRRITATION AGGREGATION
       │  fold present classes' irritancy/irritancyByPotency/photosensitizing/lowPh into one profile
       ▼
 6. SENSITIVITY COMPATIBILITY
       │  apply a threshold to the irritation aggregate
       ▼
 7. ROUTINE POSITION
       │  merge allowedPeriods/preferredPeriod across present classes; look up layering position
       ▼
 8. STRENGTHS / WEAKNESSES SYNTHESIS
       │  template generation over the outputs of stages 3–7
       ▼
    ProductProfile (+ confidence rollup, §9)
```

---

## 4. Stage 1 — Resolution / Normalization

**If given raw INCI text:** reuse `ingredientParser.ts` as-is — it already performs the text-to-`activeKey` matching this stage needs. No new parsing logic.

**If given resolved `activeKeys` from the corpus:** skip parsing; still run each key through the same normalization the parser would apply (canonical key casing, legacy-key mapping via `actives.json`'s `legacyKeyMap`), so both entry paths produce an identical shape before stage 2.

**Output of this stage:** `resolvedActiveKeys[]` plus `unresolvedIngredientTokens[]` (any INCI text segment that matched no known class — carried straight into the final profile as a live matcher-gap signal, not discarded).

**Known duplication to resolve before/during this work:** `POTENCY_RANK` exists independently in two files (`ingredientParser.ts`, `resolve.ts`). The builder must call one canonical potency source; if the two are not yet unified at implementation time, this is a blocking prerequisite, not a parallel task, since capability and irritation aggregation both consume potency downstream.

---

## 5. Stage 2 — Corpus × Ruleset Join

For each `activeKey` in the resolved set, look up its full class record in `actives.json` (`properties`, `concerns`, `goals` membership, `allowedPeriods`, `preferredPeriod`, matcher `potency`). This is the single join helper identified as the smallest missing piece connecting the corpus (per-product) and the ruleset (per-class) — it is a pure read, no data is copied or duplicated by it.

**Output:** an in-memory "class facts bundle" — one record per present `activeKey`, carrying everything stages 3–7 need. Stages below never re-query `actives.json` directly; they all read from this bundle, so there is exactly one join point to reason about.

---

## 6. Stage 3 — Capability Aggregation

For each of the 10 `CapabilityKey` values (full detail per-capability in `03-capabilities.md`):

1. **Gather contributing classes**: which present classes' `concerns`/`goals` membership includes this capability, per the *interim canonical source* (see `03-capabilities.md` §0 for which source that is per capability — several capabilities have no single agreed source today, and the builder must pick one explicitly rather than merge disagreeing lists silently).
2. **Score**: normalize to 0–1 as `min(1, contributing_count / expected_saturation_count)`, where `expected_saturation_count` is a per-capability constant (not yet defined — see `06-open-questions.md`; a placeholder of "3 contributing classes = fully saturated" is reasonable to start from but is a product decision, not an engineering one).
3. **Confidence tagging**: `deterministic` only for the two capabilities with a single unambiguous boolean property today (Barrier Repair, Exfoliation, per `03-capabilities.md`); `heuristic` for every capability sourced from a taxonomy known to disagree with at least one other file; `insufficient_data` (score `null`) for capabilities with no reliable source at all (Antioxidant Protection today).

**Explicit non-goal:** this stage does not weight by ingredient concentration — no such data exists (see `00-overview.md` §4). Every score produced here is a presence-weighted score, not a dose-weighted one, and the `caveat` field must say so whenever `confidence !== 'deterministic'`.

---

## 7. Stage 4 — Primary Functions Ranking

Pure sort-and-filter over stage 3's output: rank all 10 capability scores descending, take the top N (suggested N=3, a UI/product decision, not fixed by this design) whose score exceeds a minimum floor (suggested 0.3, same caveat). Capabilities with `insufficient_data` are excluded from ranking entirely, not treated as score `0` — consistent with `01-product-profile.md` §8.

This stage is deterministic *given* stage 3's outputs — it introduces no new heuristic judgment itself, it only inherits whatever confidence stage 3 assigned to the capabilities it selects.

---

## 8. Stage 5 — Irritation Aggregation

The richest raw material of any stage (`irritancy` 0–5, `irritancyByPotency`, `photosensitizing`, `lowPh` all exist per-class today) but **no product-level composition function exists anywhere in the codebase to copy from** — this stage was genuinely new algorithm design, not a data-availability question.

**Decision (final, see `06-open-questions.md` Q1): `max_of_present`** — the single highest irritancy value among present classes, adjusted by that class's potency via `irritancyByPotency` where available. Chosen over `potency_weighted_average` (a weighted mean across present classes) for being simple, conservative — it never underestimates risk from a single strong irritant — and shippable without inventing an unvalidated weighting formula. `potency_weighted_average` remains a documented alternative if real-world profiles later show `max_of_present` materially underestimates cumulative irritation from multiple moderate actives, but is not the default.

`photosensitizing` and `lowPh` are carried through as simple booleans (`true` if any present class sets them) — these are not aggregated numerically, since a single photosensitizing ingredient makes the product photosensitizing regardless of what else is present.

**Output confidence:** always `heuristic` at minimum (the aggregation formula itself is a design choice, per `01-product-profile.md` §7's definition), never `deterministic`, even though the underlying per-class irritancy values are solid.

---

## 9. Stage 6 — Sensitivity Compatibility

A threshold applied to stage 5's output: `compatible = irritation.score <= thresholdUsed`. The threshold value itself is a clinical/product decision (see `06-open-questions.md`), not derived from existing data — no such cutoff exists anywhere in the codebase today.

If stage 5 produced `score: null` (only possible if every present class somehow lacks irritancy data, an edge case rather than the norm), this stage must also return `compatible: null`, not a default `true`/`false` — a silent default here would misrepresent an unknown as a known-safe or known-unsafe claim.

---

## 10. Stage 7 — Routine Position

1. **Eligible/preferred period**: union `allowedPeriods` across all present classes for `eligiblePeriods`; for `preferredPeriod`, apply the finalized merge rule when present classes disagree (e.g. one class prefers AM, another PM) — **"most restrictive wins"** (if any present class has a hard single-period requirement rather than a soft preference, that requirement wins). Confirmed final per `06-open-questions.md` Q4. Implementation should verify "requirement" vs. "preference" is already a real, queryable distinction on `actives.json` classes before relying on it — a verification task during Milestone 1, not an open design question.
2. **Layering order**: look up the product's position via the relocated layering-order table (currently `LAYERING_ORDER` in `slotting.ts`, a routine-engine-private code constant — this design requires it to be relocated into `constants/rulesets/` as data *before* this stage can read it, since the builder must not import routine-engine-internal files). If the product type has no entry, `layeringOrder: null`.
3. **Rinse-off**: direct lookup against the product-type table (`RINSE_OFF_TYPES`, currently in `productFacts.ts` — same relocation consideration as layering order, since this is product-category *data*, not routine-sequencing *logic*).

**Confidence:** `deterministic` for a product with a single present class or classes that agree; `heuristic` whenever the merge rule in step 1 actually had to resolve a disagreement (the `caveat` should say which classes disagreed and how it was resolved).

---

## 11. Stage 8 — Strengths / Weaknesses Synthesis

Template generation, not free-text generation — reuses the existing `decisionReasons.ts` closed-vocabulary reason-code pattern rather than inventing a new copy-generation mechanism.

**Strength candidates:** any capability from stage 3 with `score` above a threshold (suggested 0.6) regardless of confidence tier, worded to reflect confidence (e.g. a `deterministic` strength states plainly; a `heuristic` strength is phrased with appropriate hedging, per its `caveat`).

**Weakness candidates, two distinct kinds — both required, not optional:**
- *Substantive*: a relevant capability scoring low despite the product's type suggesting it should score high (e.g. a moisturizer with a near-zero Hydration score).
- *Structural*: the caveats already attached to capabilities/irritation in this profile (no concentration data, insufficient data on a specific capability) — surfaced here explicitly so "weaknesses" never reads as a false completeness claim about a product that simply has unmeasured capabilities.

This stage only runs if stage 3 produced at least one non-`insufficient_data` capability — otherwise `strengthsWeaknesses` stays `null` per `01-product-profile.md` §6, since synthesizing prose from near-empty input produces misleadingly confident-sounding text about a mostly-unknown product.

---

## 12. Confidence rollup (final stage, implicit)

After stages 1–8, compute `overallConfidence` as the worst tier present among all required fields (`01-product-profile.md` §7). This is a pure reduction over already-computed confidence tags — no new judgment is introduced at this point, which is intentional: every actual confidence decision happens inside the stage that owns the relevant data, not retroactively at the end.
