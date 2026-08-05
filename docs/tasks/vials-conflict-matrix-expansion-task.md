# Vials — Task: Ingredient Conflict Matrix Expansion
Task slug: vials-conflict-matrix-expansion
Date: 2026-08-04
Status: DESIGNED
Touches: `utils/conflictEngine.ts`, `src/types/index.ts`, `ProductForm`

---

## Goal

Extend the existing 4-tag / 6-pair conflict matrix (`RETI`, `ACID`, `VIT_C`, `PEPT`) with additional well-known ingredient interactions, without introducing a new color tier or changing the existing amber/cabernet semantics.

---

## Scope

1. Two new `ActiveIngredientKey` tags: `BPO` (benzoyl peroxide), `NIAC` (niacinamide)
2. One new severity tier: `Low`
3. Five new pairwise rules (including one explicit "no conflict")
4. `EXFOL_PHYS` sourced from a product flag, not parsed from INCI text

---

## 1. Type changes (`src/types/index.ts`)

```ts
type ActiveIngredientKey = 'RETI' | 'ACID' | 'VIT_C' | 'PEPT' | 'BPO' | 'NIAC'
type ConflictSeverity = 'High' | 'Medium' | 'Low'
```

Add to the local `Product` entity (Phase 1 Zustand/AsyncStorage scope only):

```ts
isPhysicalExfoliant?: boolean
```

Note: this is a client-local field for Phase 1. If the Vials DB schema (`db-product-spec.md` §4.1) is later extended to carry the same signal server-side, `active_ingredient_keys` and this flag need to be reconciled — flagged as a cross-doc open item, not resolved here.

---

## 2. `parseInciTags` updates (`utils/conflictEngine.ts`)

Add regex detection for:

- `BPO` — matches "benzoyl peroxide"
- `NIAC` — matches "niacinamide", "nicotinamide"

`EXFOL_PHYS` is **not** parsed from `full_ingredients_text`. It is read directly from `product.isPhysicalExfoliant`. Any conflict check involving `EXFOL_PHYS` reads the flag on the product record, not the INCI tag list — a scrub's ingredient list rarely contains a chemically distinct marker for "has abrasive particles."

---

## 3. Updated pairwise matrix

| Pair | Result | Severity |
|---|---|---|
| `RETI` + `ACID` | Conflict | High *(existing)* |
| `VIT_C` + `RETI` | Conflict | High *(existing)* |
| `PEPT` + `VIT_C` | Conflict | Medium *(existing)* |
| `ACID` + `VIT_C` | Conflict | Medium *(existing)* |
| `ACID` + `PEPT` | Conflict | Medium *(existing)* |
| `RETI` + `PEPT` | No conflict | — *(existing)* |
| `BPO` + `RETI` | Conflict | **High** *(new)* |
| `BPO` + `ACID` | Conflict | **Medium** *(new)* |
| `NIAC` + `VIT_C` | **No conflict** — explicit; historically miscited as incompatible | — *(new)* |
| `NIAC` + `ACID` | Conflict | **Low** *(new)* |
| `RETI` + `NIAC` | **No conflict** — niacinamide commonly paired with retinoids specifically to buffer irritation | — *(new, resolves §7.3)* |
| `VIT_C` + `BPO` | Conflict | **Medium** *(new, resolves §7.3 — well-corroborated: BPO oxidizes/inactivates ascorbic acid)* |
| `PEPT` + `BPO` | Conflict | **Medium** *(new, resolves §7.3 — moderately corroborated; some sources frame it as irritation-adjacent rather than direct oxidation)* |
| `PEPT` + `NIAC` | **No conflict** — explicit; the "chelation cancels copper" claim is not supported at typical cosmetic pH/concentrations | — *(new, resolves §7.3)* |
| `BPO` + `NIAC` | **No conflict** — explicit, but contested (see §7.3) | — *(new, resolves §7.3)* |
| `EXFOL_PHYS` + `ACID` | Conflict | **Medium** *(new, flag-based)* |
| `EXFOL_PHYS` + `RETI` | Conflict | **High** *(new, flag-based)* |

Fragrance / essential oil components are explicitly **out of scope** for this matrix. Decision: flagging them as ingredient conflicts would make the warning system noisy enough (fragrance appears in most products) that users stop trusting it. Fragrance-related information is surfaced separately via the EU allergen badge, not through `ConflictWarningInline`.

---

## 4. Severity → UI mapping

All severities render with the **existing amber** `InlineAlert` / `ConflictWarningInline` styling — this task does not introduce a new color. High/Medium/Low differ in copy only:

- High → "Strong conflict — ..."
- Medium → "Possible conflict — ..."
- Low → "Minor interaction — ..."

Exact copy is not blocking implementation; placeholder text is acceptable for the first pass, to be finalized with product/content.

---

## 5. Acceptance criteria

- [ ] `parseInciTags` correctly detects `BPO` and `NIAC` across a range of real INCI strings
- [ ] `NIAC` + `VIT_C` scheduled same-day does **not** trigger `ConflictWarningInline` (negative test, same pattern as the existing `RETI`+`PEPT` negative test in US-09)
- [ ] `EXFOL_PHYS` conflicts trigger based on `isPhysicalExfoliant`, independent of `full_ingredients_text` content
- [ ] `ProductForm` exposes a toggle for "Physical exfoliant" so the flag can be set on manually-added products
- [ ] New pairs render amber with tier-appropriate copy
- [ ] Existing 6-pair matrix behavior is unchanged (regression check — assert identical output for all 6 original pairs before/after this change, not just spot-checked)
- [x] All 15 possible pairs among the 6 tags are now explicitly defined — see §3 for the full matrix and §7.3 for reasoning/confidence on the 5 pairs resolved after initial review. Two of the five (`PEPT`+`BPO`, `BPO`+`NIAC`) are lower-confidence and should get priority attention in clinical sign-off, not just a rubber stamp alongside the rest.

Not a blocker pre-launch (no production install base yet — see §7.1): backfill/re-parse of already-added products. Revisit as a blocking item the next time this matrix changes after launch.

---

## 7. Compatibility risks — read before implementing

### 7.1 Cached tags on existing products won't retroactively update — not applicable pre-launch
No production install base exists yet, so there's nothing to backfill right now. Keeping this section for the next time the matrix changes after launch, since by then real users will have persisted `inciTags[]` that this same problem applies to.

Per the Product schema in `IMPLEMENTATION_PLAN.md` (`inciTags[]`), tags appear to be parsed once at add-time and persisted, not recomputed live from `full_ingredients_text` on every conflict check. This means products already in a user's catalog before this update ships will **not** automatically gain `BPO`/`NIAC` tags. Two blockers to check before assuming a fix is possible:

- Is raw `full_ingredients_text` retained anywhere in the local Phase 1 (AsyncStorage) product record? It's part of the future Vials DB schema (`db-product-spec.md` §4.1) but not listed in the local `Product` entity fields — needs to be confirmed, not assumed.
- If it is retained: run a one-time re-parse migration on app update for all existing products.
- If it isn't retained: backfill isn't possible without asking users to re-scan/re-enter — decide explicitly whether that's acceptable rather than shipping a silent gap.

### 7.2 Previously "clean" routines may surface new warnings post-update — not applicable pre-launch
Same reasoning as §7.1: no real routines exist yet to be surprised. Relevant again once there's a live install base and this matrix changes again.

Even with a correct backfill, a user whose routine showed zero conflicts before this update may see a new Low/Medium warning appear after updating, on a product/schedule combination that hasn't changed. Not a bug, but likely to read as one to the user. Consider a one-time explanatory banner tied to the update rather than a silent appearance.

### 7.3 Matrix is now exhaustive — 5 of 15 pairs resolved, two need priority review
The original matrix was explicitly a full pairwise table for its 4 tags. With 6 tags there are 15 possible pairs. The 5 that were undefined are now resolved (added to §3), based on general dermatological consensus cross-checked against current sources, not just recalled from memory — this is exactly the kind of specific factual claim worth verifying rather than guessing:

| Pair | Resolution | Confidence |
|---|---|---|
| `RETI` + `NIAC` | No conflict | High — extremely well-established pairing, niacinamide is routinely marketed specifically to buffer retinoid irritation |
| `VIT_C` + `BPO` | Conflict, Medium | High — consistent across many independent sources: benzoyl peroxide is a strong oxidizer, ascorbic acid is an antioxidant, BPO measurably degrades vitamin C efficacy plus some irritation risk |
| `PEPT` + `BPO` | Conflict, Medium | Moderate — several sources describe BPO oxidizing/degrading copper peptides, but at least one source frames it as irritation-when-layered rather than a direct chemical reaction. Treat as the closer call of the two "real" additions |
| `PEPT` + `NIAC` | No conflict | High — this is a well-documented myth. Copper is tightly chelated in GHK-Cu and doesn't meaningfully interact with niacinamide at cosmetic pH/concentrations; multiple sources explicitly debunk the "cancels each other out" claim |
| `BPO` + `NIAC` | No conflict | **Contested — lowest confidence of the five.** Majority of sources describe this as a favorable pairing (niacinamide buffers BPO irritation) and frame the "oxidizes niacinamide" claim as an outdated concern not borne out by newer evidence. But at least one source directly asserts the oxidation claim without hedging. Flag this one specifically for clinical sign-off rather than folding it in with the others as a rubber-stamp batch |

Net effect: the matrix is complete (all 15 pairs defined), but `PEPT`+`BPO` and especially `BPO`+`NIAC` carry meaningfully less certainty than the rest of the table and shouldn't ship without being called out individually in review — not just listed alongside the high-confidence entries.

### 7.4 `EXFOL_PHYS` is structurally different from the other 5 tags
It's read from a product boolean flag, not from parsed INCI text, so it doesn't fit the existing symmetric tag-pair lookup cleanly. Whoever implements this should isolate the flag-merging logic carefully — this is the most likely place to accidentally affect the original 4-tag pairs while wiring in a 5th, non-INCI signal.

### 7.5 Same-tag exemption must stay generic
Confirm the existing "two products with the same tag aren't flagged as conflicting" rule is implemented as a generic `tagA === tagB` check, not hardcoded against the original 4-tag list — otherwise it silently stops applying to `BPO`/`NIAC`.

---

## 8. Open items for clinical/product review

Same review process already flagged in `PRD_Spec.md` §6 for the original matrix and the procedure-spacing table:

- Sign-off needed on the three new conflict pairs (`BPO`+`RETI`, `BPO`+`ACID`, `NIAC`+`ACID`) and their assigned severities, plus the 5 pairs resolved in §7.3 — with `PEPT`+`BPO` and `BPO`+`NIAC` flagged for priority attention given their lower confidence, rather than approved as a batch with the rest.
- Confirm final Low-tier copy.
- Confirm `isPhysicalExfoliant` as a boolean flag is acceptable for Phase 1, vs. a dedicated `ProductType` value long-term — this task uses the flag because it's the smaller change, not because it's necessarily the correct permanent model.
