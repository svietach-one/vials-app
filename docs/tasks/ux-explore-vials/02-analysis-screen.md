# Product Intelligence — Analysis Screen

Status: DRAFT — product/UX design, not yet built. No mockups; structure and interaction model only.
Depends on: `00-user-journey.md`, `01-entry-points.md`, and the underlying data model (`../01-product-profile.md`, `../04-decision-engine.md`).

---

## 1. The core structural decision: two sections, strictly separated

**Product Intelligence** — objective. What the product *is*. Capabilities, irritation, strengths, weaknesses, routine position. Every field here comes from `ProductProfile` (`../01-product-profile.md`) and is true regardless of who's looking at it.

**For You** — personalized. What it *means for this user*. Similarity to what they own, gap coverage, routine impact, the recommendation verdict. Every field here comes from the Decision Engine (`../04-decision-engine.md`) and depends on this user's specific shelf, routine, and goals.

This is not a visual-design choice, it's a direct translation of the two-layer architecture into the interface — the same boundary that exists in the data model exists on screen, in the same order.

---

## 2. Why this separation improves trust

Three concrete reasons, not a general "transparency is good" claim:

1. **The user can independently verify the objective layer.** If Product Intelligence says a product "contains niacinamide, supports barrier repair," the user can check the ingredient label themselves and confirm it. Once they've verified the app gets the *facts* right, they extend more trust to the *judgment* layer below it — trust is earned bottom-up from something checkable, not asked for up front.
2. **Disagreement stays legible instead of feeling arbitrary.** If a user disagrees with a Skip verdict, the separation lets them see exactly which layer they disagree with — "I don't think this is redundant with what I own" (a For You disagreement) reads completely differently from "I don't think this product is actually irritating" (a Product Intelligence disagreement). A merged, undifferentiated screen would make every disagreement feel like "the app is wrong" instead of "the app weighted this differently than I would."
3. **It matches how the confidence system already works.** Product Profile fields carry `deterministic`/`heuristic`/`insufficient_data` confidence per field (`../01-product-profile.md` §7); Decision Engine verdicts inherit the worst confidence among the fields they compose (`../04-decision-engine.md` Stage 4). Keeping the two sections visually distinct lets confidence language stay honest at the right altitude — "we're not fully sure this product has X" (Product Intelligence) is a different kind of uncertainty than "we're not sure this is the right move for you" (For You), and collapsing them into one undifferentiated screen would blur which kind of uncertainty the user is looking at.

---

## 3. Information hierarchy (top to bottom)

```
1. Identity header        — name, brand, type, image if available
                             (always visible, no interaction needed)

2. PRODUCT INTELLIGENCE   — objective
   2a. Primary functions    — top capability badges (e.g. "Barrier Repair, Soothing")
   2b. Irritation indicator — single glanceable signal, expandable for detail
   2c. Routine position     — "Evening · after cleansing"
   2d. Strengths            — 2-3 lines, template-generated
   2e. Weaknesses/caveats   — always shown, never hidden even when short

3. FOR YOU                — personalized
   3a. Recommendation verdict — the single most prominent element in this section
   3b. Why                    — reason codes, plain language
   3c. Gap coverage            — "adds X you don't have"
   3d. Similarity               — "similar to [existing product]" if applicable
   3e. Routine impact            — brief preview, expandable

4. CTA row                — varies by entry point (Add new vs Explore
                             new), see §6 for the full matrix
                             (always visible, never requires scrolling
                             past both sections above to reach)
```

The CTA row's persistent visibility is deliberate — see §5.

---

## 4. Progressive disclosure

Default (collapsed) state for each section shows a **summary**, not the full data:

- Product Intelligence collapsed: top 2-3 capability badges, one irritation indicator, one-line routine position. No per-ingredient breakdown, no confidence tags visible yet.
- For You collapsed: the verdict badge plus one supporting line ("adds Barrier Repair" / "very similar to X"). No full reason-code list yet.

Expanding a section reveals, in order: the full capability list with individual confidence indicators where relevant, the specific contributing ingredients behind each claim, and any caveats (`insufficient_data` fields, structural gaps like "no concentration data"). Expansion is per-section, not a single "show everything" toggle — a user curious about irritation shouldn't have to also expand gap coverage to see it.

**Rule:** caveats and `insufficient_data` fields are never hidden behind an extra tap beyond the section's own expand action. They're part of the honest summary, not buried detail — consistent with `../01-product-profile.md` §8's rule that insufficient data is never silently omitted.

---

## 5. Interaction model

- **Sections expand independently**, remembering their own state during the session (expanding Product Intelligence doesn't force-expand For You).
- **The CTA row is pinned**, not pushed down by expansion — a user who expands every section to read the full reasoning shouldn't have to scroll back up to act on it.
- **No modal stacking.** Expanding a section reveals more content inline; it does not open a new screen or sheet on top of the analysis screen. The only screen transitions are entering (from scan/search/product page) and exiting (via a CTA or explicit close).
- **Tapping a specific claim** (e.g. a capability badge, a reason code) reveals its source — which ingredients, which classes — inline, not via a separate "learn more" destination. This keeps explainability one tap deep, never two.

---

## 6. CTA hierarchy

The primary CTA follows both the verdict and which entry point brought the user here — **Add new** (already bought) versus **Explore new** (deciding whether to buy) — but no combination fully removes user agency (`00-user-journey.md` §4):

| Entry point | Verdict | Primary CTA | Secondary CTA |
|---|---|---|---|
| Add new | Buy | **Add to Shelf** (filled, primary color) | — |
| Add new | Replace | **Replace [existing product]** (filled, primary color) | Add anyway (outline) |
| Add new | Skip | Add anyway (outline — intentionally *not* filled, since this isn't the suggested path, but it's never removed) | — |
| Add new | Avoid | Explanation + acknowledgment required ("I understand, add anyway") before the add action becomes available — mirrors the existing procedure-logging block+override pattern (`AddProcedureModal`, `US-18`), not a silent hard block | — |
| Explore new | Buy | **Add to Wishlist** (filled, primary color) | Add to Shelf directly (outline — for "I have it in hand, buying now") |
| Explore new | Replace | **Add to Wishlist** (filled, primary color), noting it would likely replace [existing product] later | — |
| Explore new | Skip | Add to Wishlist anyway (outline) | — |
| Explore new | Avoid | Same acknowledgment pattern as Add new, gating the Wishlist action | — |

**Open question, flagged rather than decided here:** should Avoid gate Wishlist saves with the same force it gates an actual Shelf add? Wishlist is a considering state with no product-use consequence, so the same hard-safety reasoning may not apply with equal weight — worth a deliberate call before implementation rather than inheriting the Add new behavior by default.

No verdict/entry-point combination produces a CTA row with only one disabled-looking option — every state gives the user a clear way to act on their own judgment, even against the app's advice, short of the same class of hard safety gate the rest of the app already enforces elsewhere.
