# Decision log addendum — category selection stays fully manual

**No implementation change required by this file — record only.** This closes open item #1 from
`00-explore-composition-spec.md`'s "Open items to confirm" section: category *is* captured in
`Исследовать состав` (already implemented as manual chip selection — confirmed working per the
current build's `Category (optional)` chip grid).

**Considered and explicitly rejected:** auto-suggesting/pre-selecting a category from the parsed
composition (e.g. detecting SPF via UV-filter ingredients, or Cleanser via surfactant-dominant
top-of-INCI signal, and pre-highlighting that chip).

**Why rejected:** the signal is only strong for a few categories (SPF via UV filters is close to a
reliable marker; Cleanser/Oil somewhat plausible via surfactant/oil-phase position). For most of
the category list — Serum vs. Essence vs. Ampoule, Cream vs. Eye Cream, Toner vs. Essence — the
distinction is a product-positioning/texture decision, not a chemical one, and composition alone
cannot reliably distinguish them. Guessing here risks a confidently-wrong category, which then
propagates into both the comparison matrix's peer group and routine placement — real downstream
consequences, not a cosmetic label. This is the same class of mistake as every fabricated-precision
issue already rejected elsewhere in this spec (the % match scores, the invented efficacy numbers) —
just at the category-selection layer instead of the results layer.

**If this is revisited later:** a narrower, high-confidence-only version (e.g. auto-suggest *only*
SPF, and only when UV-filter ingredients are unambiguously present, leaving every other category
chip unprejudiced and blank as today) would be worth reconsidering — but that is a new proposal for
a future pass, not something to build now. Do not implement any auto-suggestion behavior without a
new decision recorded here.

---

## Status

Category selection: **manual only, unchanged, no further action needed.**
