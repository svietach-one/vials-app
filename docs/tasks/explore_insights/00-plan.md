# Explore Insights v2 — Plan

**Status:** ready to execute
**Based on:** `docs/explore-audit.md` (read-only audit, 2026-09-05)
**Goal:** the Explore result screen stops restating the label and starts saying something the user cannot read off the box.

---

## Why

The screen today shows a functional-profile tag list, a detected-actives tag list, and a 4-row comparison matrix whose rows are `Functional profile breadth`, `Ingredient count`, `Active tags`, `Category`, rendered as `Shelf avg 4 (3 of 5 with data)`.

Those rows are statistics about a shelf, not observations about a decision. "Ingredient count: 42 vs shelf avg 38" changes nobody's mind about buying a serum. Meanwhile two genuinely non-obvious signals are computed in the pipeline today and thrown away before they reach the UI:

1. **INCI position** — `parseActiveIngredientDetails` computes a 1-based position per active class (`ingredientParser.ts:46-56`), and `resolve.ts:144` alphabetizes the keys and drops it.
2. **The ordered token array** — `tokenizeIngredientsText` already produces it (`resolve.ts:48-53`), and `useCompositionInsights.ts:70` already calls it, using only `.length`.

From those two we get the one thing no competitor app says: **where an active sits in the list, and whether it is above or below the 1% line.** "Niacinamide is 6th of 42" and "Niacinamide sits below the 1% line — this is a label mention, not a working dose" are real information, derived from data already in memory.

The second theme is **shelf context**: replacing abstract averages with named overlaps — *"3 products on your Shelf already have niacinamide: CeraVe PM, The Ordinary 10%, Anua Toner."* Nobody else can say this, because nobody else knows the shelf.

---

## Correction to an earlier assumption — read this before task 01

The audit's §8F proposes a coverage string, "parsed N of M ingredients", as the cheapest win. **Do not build it as written.**

`findUnresolvedTokens` (`resolve.ts:64-68`) marks a token unresolved when `parseActiveIngredientDetails` finds no match. But `actives.json` is an **active-class ruleset (~20 classes), not an INCI dictionary**. Water, glycerin, phenoxyethanol, xanthan gum and every other ordinary ingredient are "unresolved" by construction. On a real 42-ingredient label the string would read *"recognised 6 of 42"* — which is not a coverage figure, it is a description of the ruleset's scope, and it would read to the user as "this app barely works."

`unresolvedIngredientTokens` is a **matcher-gap signal for us**, not a user-facing metric. Keep it internal. The honest user-facing number is the plain ingredient count, which task 01 exposes anyway.

---

## Decisions — all CONFIRMED 2026-09-05, no further sign-off needed

| # | Decision | Ruling |
|---|---|---|
| **D1** | `docs/specs/explore-composition.md:223-224` makes "no position/concentration-order value" a non-goal. Tasks 01 and 03 reverse it. | **CONFIRMED — reversed, scoped.** Position is surfaced on `DetectedActivesCard` only. The comparison matrix stays position-free, so the original spec constraint holds where it was actually written. Task 01 updates the spec's non-goal to say "matrix only". |
| **D2** | Task 04 deletes the `Functional profile breadth` and `Ingredient count` matrix rows. | **CONFIRMED — delete both.** They are the least actionable content on the screen and they crowd out the rows that matter. Task 04 proceeds without further sign-off. |
| **D3** | `conflictEngine` on the result screen is an explicit non-goal (`explore-composition.md:71`). | **CONFIRMED — stays a non-goal for this batch.** Shelf duplicates (task 04) deliver most of the same value without reversing a product boundary. Revisit after 04 ships and there is usage to look at. |
| **D4** | There is no analytics layer anywhere in `src/` (audit §7). | **CONFIRMED — task 07 adds a minimal one.** Without it none of this batch is measurable and every later decision on this screen is guesswork. Task 07 runs last and is deliberately small. |

---

## Task order and dependencies

```
01 carry position + tokens   (foundation, no UI)
      ├──> 02 one-percent line  ──> 03 actives card: position + dose
      └──> 04 shelf duplicates
05 skin-type nudge            (independent, tiny)
06 routine gap / SPF          (independent)
07 analytics events           (last — instruments 03/04/06)
```

| Task | What the user gets | Size |
|---|---|---|
| `01-carry-position-and-tokens.md` | nothing yet — plumbing | S |
| `02-one-percent-line.md` | nothing yet — pure module | S |
| `03-actives-card-position-dose.md` | "Niacinamide · 6th of 42 · below the 1% line" | S |
| `04-shelf-duplicates.md` | "3 on your Shelf already have this" — with product names | M |
| `05-skin-type-nudge.md` | a blank card becomes a prompt to finish the profile | XS |
| `06-routine-gap-spf.md` | "your morning routine still has no SPF" | M |
| `07-analytics-events.md` | nothing — but we can finally tell whether any of the above worked | S |

Run them in order. 01 must land before 02–04. 07 runs after 03, 04 and 06 exist, since it instruments them. Each task ends green: `npm test` and `npx tsc --noEmit`.

---

## Out of scope for this batch

- Personal allergens (`UserProfile` has no `allergies` field; `Product.detectedAllergens` is a regulatory scan, not a personal one — audit §5). Separate batch, needs a profile change and a UI for declaring allergies.
- Comedogenic / malassezia data — needs curated data, not plumbing.
- Expanding `actives.json` into a full INCI dictionary.
- Any change to the corpus, Turso, or the contributions DB.
- `conflictEngine` call sites (D3).
