# Product Intelligence — User Journey

Status: DRAFT — product/UX design, not yet built.
Constraint: the technical architecture (`../00-overview.md` through `../06-open-questions.md`) is LOCKED. This document designs experience on top of it; it does not revisit data model, algorithms, or engineering decisions.

---

## 1. What problem is the user actually trying to solve?

Not "I want to see an AI analysis." Two much more ordinary problems, both already implicit in why someone owns a skincare-tracking app at all:

1. **"Is this product actually right for me?"** — asked holding an unfamiliar product, either just bought or about to be bought.
2. **"How does this fit with what I already have?"** — asked about a product already on the shelf, usually much later, usually with lower urgency: am I duplicating something, is this still earning its spot, does it conflict with anything.

Product Intelligence exists to answer both without the user having to read an INCI list themselves and cross-reference it against everything else they own. It should feel like the natural next step after scanning a product into the app — not a separate destination the user has to seek out.

---

## 2. When do they discover it, and what triggers it?

Discovery happens **inside an action the user is already taking**, never as a standalone destination they have to learn about first:

- They scan or search for a product while adding it to their shelf (existing `FirstProductScreen` / Catalog `+ Add Product` flow) — analysis appears as part of that flow, not after it.
- They open a product they already own from the Catalog, out of curiosity or while reviewing their shelf.

There is no "Product Intelligence" tab, no onboarding tutorial explaining what it is, and no marketing moment introducing it as a feature. The first time a user sees it should be the first time they add or open a product after it ships — indistinguishable, from their perspective, from "the app got smarter," not "a new feature launched."

---

## 3. What happens after scanning?

Immediately, before anything computed appears: the product's identity (name, brand, image if available) — this is the fastest thing to resolve and anchors the user while everything else loads (full sequencing in `04-scanner-flow.md`).

Then, in order: what the product *is* (Product Intelligence — capabilities, irritation, routine position), then what it *means for the user specifically* (For You — similarity, gap coverage, routine impact, recommendation). This ordering is not arbitrary — see `02-analysis-screen.md` for why objective-before-personalized is a trust decision, not just a layout choice.

---

## 4. What decisions does the user make?

The available decisions depend on which of the two My Shelf entry points brought the user here (`01-entry-points.md`):

- **From Add new** (already bought): **Add to shelf**, **Replace** an existing product, or **Skip**.
- **From Explore new** (deciding whether to buy): **Add to Wishlist**, **Skip**, or — if the user has the product in hand and decides on the spot — **Add to shelf** directly.
- **Add anyway**, even against a caution, is always available regardless of entry point — per the existing app-wide pattern (procedure logging's "I understand the risk, log anyway"), the app can advise strongly but should not corner the user into a dead end except for genuine hard-safety gates. This mirrors the Decision Engine's own Avoid vs. Skip distinction (`../04-decision-engine.md` Stage 4): Skip is a guardrail, Avoid is closer to a hard stop, and even Avoid should explain itself rather than simply refuse.

---

## 5. What happens after the recommendation?

The decision routes back into flows the user already knows, not into a new confirmation ritual:

- **Add** → existing "Product added to your shelf" toast pattern (`SCREENS.md` `ProductForm`), optionally followed by a lightweight, dismissable prompt to place it in a routine slot (using the Routine Impact preview already computed).
- **Add to Wishlist** (from Explore new only) → a lighter confirmation with no shelf-inventory side effects — no PAO tracking, no routine-placement prompt, since the product isn't physically owned yet. It sits in the Wishlist tab until the user later taps **Put on my shelf** (`01-entry-points.md` §6).
- **Replace** → the existing product-deletion cascade pattern (`DeleteProductModal`, `US-08.1`), pre-populated with the reason ("replacing with [new product]") rather than a generic delete warning.
- **Skip** → clean exit, no side effects, same as declining anywhere else in the app.

---

## 6. Journey diagrams

### Journey A — Adding a newly purchased product

The lowest-stakes journey. The user has already decided to keep the product; they're logging it and want to understand how it fits, not whether to buy it.

```
[My Shelf — Owned tab] → [Add new] → [Scan or manual entry]
                                      │
                                      ▼
                        [Product identified — name/brand shown]
                                      │
                                      ▼
                     [Product Intelligence reveals: capabilities,
                      irritation, routine position]
                                      │
                                      ▼
                     [For You reveals: gap coverage, routine impact,
                      similarity to what's already owned]
                                      │
                         ┌────────────┴────────────┐
                         ▼                          ▼
                  [Add to Shelf]              [Replace existing /
                   (primary path,                Skip]
                   most common outcome)
                         │
                         ▼
              [Optional: place in routine now?]
                         │
                         ▼
                  [Back to My Shelf — Owned tab]
```

**Design implication:** since the user has already committed to owning the product, the Recommendation verdict here is informational, not gatekeeping — "Add to Shelf" should never feel harder to reach than the analysis itself, even on a Skip-leaning verdict.

### Journey B — Checking a product in a store before buying

The highest-stakes journey. The verdict genuinely drives a purchase decision, the user is standing in an aisle, and network conditions may be poor. Speed and clarity matter more here than anywhere else in the app.

```
[Physical product in hand, in-store] → [My Shelf → Explore new]
                                              │
                                              ▼
                                   [Barcode/OCR resolves product]
                                              │
                              ┌───────────────┴───────────────┐
                              ▼                                ▼
                     [Online: full analysis]          [Offline: Product
                                                        Intelligence still
                                                        computes locally
                                                        from typed INCI;
                                                        For You limited to
                                                        cached shelf data]
                              │                                │
                              └───────────────┬────────────────┘
                                               ▼
                               [Recommendation verdict shown
                                as early as possible — this is
                                the moment the user is waiting for]
                                               │
                          ┌────────────────────┼────────────────────┐
                          ▼                    ▼                    ▼
                   [Buy it — leave        [Skip — put it       [Uncertain — Add
                    app, purchase]         back, move on]       to Wishlist,
                                                                 revisit at home]
```

**Design implication:** the Recommendation verdict should surface *before* the full capability breakdown finishes rendering if there's any latency gap between them — a user in a store cares about the verdict first and the reasoning second, the inverse of Journey A/C's objective-first ordering. See `04-scanner-flow.md` for how perceived performance is designed around this.

### Journey C — Opening analysis later from an existing product

The lowest-urgency, most exploratory journey. Often triggered by browsing the Catalog, not by an explicit "let me check this" intent.

```
[My Shelf — Owned or Wishlist tab] → [Tap a product] → [Product Detail page]
                                                  │
                                                  ▼
                                  [Compact Product Intelligence strip
                                   already visible, no tap needed —
                                   see 03-product-page.md]
                                                  │
                                                  ▼
                                  [User taps to expand full analysis]
                                                  │
                                                  ▼
                            [Full Product Intelligence + For You,
                             same component as the scan-flow analysis
                             screen — not a separate view]
                                                  │
                              ┌───────────────────┴───────────────────┐
                              ▼                                       ▼
                    [Nothing to decide —                     [Consider Replace
                     just reviewing, close]                   (Owned) or Put on
                                                                my shelf (Wishlist)
                                                                if relevant]
```

**Design implication:** this journey has no "Add" action — the product is already owned — so the CTA hierarchy shifts entirely toward Replace/no-action, and For You content here should lean toward "should this still be on your shelf" rather than "should you get this."
