# Fix — resolve the two flagged gaps from your verification report

**Context:** your framing-check report (re: `01-fix-comparison-matrix-parameters.md`) correctly
caught that `ingredients.function[]` and `products.skin_types_suitability` are Postgres-only with
no client-side mirror, and asked for a decision on both instead of guessing. Good — that's exactly
the process this file exists to lock in. Decisions below. Implement exactly as specified; if either
turns out infeasible for a reason not anticipated here, stop and report — do not substitute
something else silently, same rule as last time.

---

## Decision A — "Functional profile breadth"

Redefine this parameter to use what's already shipped and real: count of distinct `CapabilityKey`
tags present, from the same `buildCapabilities()` output already driving §3.1's tag list
(`src/utils/productProfile/capabilities.ts`).

- Parameter value = number of distinct `CapabilityKey` values returned by `buildCapabilities()` for
  this composition (hydration, barrierRepair, brightening, pigmentation, acneControl,
  sebumRegulation, antioxidantProtection, soothing, exfoliation, antiAging — whichever subset
  applies).
- This is a **re-derivation of data already shown in §3.1**, not a duplicate concern — the matrix
  parameter is a summary count of that same tag list, same relationship `ingredient count` (§3.2)
  has to the ingredient list (§3.3).
- No new logic to write beyond reading `buildCapabilities()`'s output length — do not build a
  parallel capability-detection path.

## Decision B — "Skin-type suitability" replaced with a personalized derived signal

`products.skin_types_suitability` does not exist client-side and never will in Phase 1 — confirmed
in your report as absent on every product type, matched or not. Do not use it, do not leave a
parameter that always reads "not derivable."

**Replace it with:** a personalized compatibility signal derived from `UserProfile.skinType`
(oily/dry/combination/normal — confirmed to exist) cross-referenced against the boolean properties
already in `src/constants/rulesets/actives.json` for whichever active-ingredient classes are
present in the composition (`barrierRepair`, `exfoliating`, `photosensitizing`, `irritancy`, and
any other relevant boolean already in that ruleset — use what's there, don't invent new properties
on the ruleset).

This is **not** "this product suits skin type X" (a general, product-level marketing-style claim,
which is what the old field would have implied). It is **"given ingredients in this composition and
this user's stored skin type, here's a real caution/fit signal"** — e.g. high-`irritancy` or
`exfoliating` actives present with no `barrierRepair` counterpart, shown as a caution for a
`dry`/`combination`-profile user. Personalized to the signed-in user's own profile, not a generic
label.

**Before wiring this into the UI, do a coverage check and report back:**

- `actives.json` covers 20 active-ingredient classes. A composition with none of those 20 present
  (e.g. a plain moisturizer with no actives) will produce no signal — same "empty" problem as the
  field we're replacing, just for a different subset of products.
- Run this against a representative sample of real ingredient lists (use whatever fixtures exist
  from the search-eval work, or the corpus if reachable) and report: **what percentage of typical
  compositions trigger at least one signal from this mechanism.**
- If coverage is meaningfully better than "basically never" (the old field's 0%), proceed with
  implementation as specified. If coverage still comes back very low, **stop and report the number
  instead of shipping it** — that's a decision for product, not something to resolve by loosening
  the signal's definition on your own judgment.

---

## Final 5-parameter list (restated in full, supersedes both prior versions)

1. **Functional profile breadth** — count of distinct `CapabilityKey` tags from `buildCapabilities()`
   (Decision A above).
2. **Ingredient count** — existing comma-tokenization count, unchanged, already correct.
3. **Active tags** — `ActiveIngredientKey` / `Product.activeTags`, read via `getProductActiveKeys()`
   in `ingredientParser.ts`, unchanged from `01-fix-comparison-matrix-parameters.md`.
4. **Personalized skin-type compatibility signal** — `UserProfile.skinType` × `actives.json` boolean
   properties for actives present in the composition (Decision B above, gated on the coverage check).
5. **Category-relative signal** — `product_type`, unchanged, already correctly wired.

`Position`/concentration-order remains out of the matrix entirely, per the prior fix — still only a
§3.3 ingredient-list display attribute.

---

## Report back

1. Confirmation that Decision A reuses `buildCapabilities()` with no new detection logic.
2. The coverage-check number for Decision B (% of sampled compositions producing at least one
   signal), and whether you proceeded or stopped based on it.
3. If you stopped on B: what the number was and what you need from product to proceed (a lower
   threshold accepted as "good enough," a different data source, or dropping this parameter for a
   later phase).
4. Final confirmation of all 5 parameters as implemented, matching the list above exactly.
