# Product Intelligence — Copy

Status: DRAFT — product/UX design, not yet built.
Depends on: `02-analysis-screen.md`, `04-scanner-flow.md` (where most of this copy is placed).

---

## Voice principles

Before the examples, the contrast that matters most: this copy should sound like a knowledgeable person telling you a fact, not a product announcing a capability.

| Don't | Do |
|---|---|
| "Our AI has analyzed this product for you! ✨" | "Contains ceramides and niacinamide. Supports barrier repair." |
| "Analyzing…" | "Reading ingredient list…" |
| "Great choice! This product is perfect for you!" | "Adds barrier support your shelf doesn't have yet." |
| "Warning! Potential conflict detected!" | "May conflict with [Product] if used the same day." |
| "We couldn't determine this — sorry!" | "Not enough data to score antioxidant support yet." |

Rules underneath the examples:
- **No exclamation points.** Even good news is stated plainly.
- **No emoji.** Matches the existing app-wide tone (`PRD_Spec.md`'s clinical-adjacent copy has none).
- **State the fact, not the feeling about the fact.** "Adds barrier support" not "Great news — this adds barrier support!"
- **Never say "AI," "algorithm," "our model," or "analyzing."** Describe what's true about the product, not the mechanism producing the description.
- **Hedge exactly as much as the confidence tier warrants, never more or less.** A `deterministic` claim is stated flatly. A `heuristic` claim gets a light qualifier. `insufficient_data` says so directly, without apologizing for it.

---

## Loading

- "Reading ingredient list…"
- "Identifying product…"
- "Comparing to your shelf…"
- "Checking your routine…"

## Analysis (Product Intelligence — objective)

- "Supports barrier repair. Contains ceramides and niacinamide."
- "Moderate irritation potential. Contains a retinoid and an AHA."
- "Best used in the evening."
- "Contains a photosensitizing ingredient."
- "No fragrance-class ingredients detected." *(deterministic, stated flatly)*
- "Likely supports hydration, based on glycerin and hyaluronic acid." *(heuristic — note the "likely," absent from the deterministic examples above)*

## Recommendation (For You — personalized)

- **Buy:** "Adds barrier support your shelf doesn't have yet."
- **Replace:** "Very similar to [Product X], already on your shelf."
- **Skip:** "Mostly overlaps with what you already own."
- **Avoid:** "Contains an ingredient class restricted during your current rehab period."

## Warnings

- "May conflict with [Product] if used the same day."
- "Contains a photosensitizing ingredient — best paired with daily SPF."
- "This ingredient class is on your pregnancy/breastfeeding restriction list."

## Insufficient data

- "Antioxidant support can't be scored yet — this ingredient isn't in our database."
- "Not enough data to compare irritation confidently for this product."
- "We don't yet track concentration, so this reflects presence, not strength."

*(Per `../01-product-profile.md` §8, these never read as an error or apology — they're stated with the same plainness as a confirmed fact, just naming what isn't known instead of what is.)*

## Duplicate product

- "You already have this exact product on your shelf."
- "This looks identical to [Product X] — same brand, same formula."

## Better alternative

- "[Product X], already on your shelf, covers the same goal with fewer ingredients."
- "A similar product you own scores lower on irritation for the same benefit."

## Upgrade

- "A stronger version of what you're already using — same goal, higher potency."
- "Adds a second barrier-repair ingredient your current product doesn't have."

## Downgrade

- "A gentler version of what you're using — same goal, lower irritation potential."
- "Fewer active ingredients than your current product, same general purpose."

---

## A note on "upgrade" and "downgrade" specifically

Neither term should be presented as inherently good or bad — "downgrade" in particular must not read as a lesser product. A gentler, lower-irritation alternative is frequently the *better* choice (e.g. for sensitive skin, or during a rehab period), so copy in this category should name the trade-off plainly ("gentler, same goal") rather than implying a value judgment the data doesn't support. This mirrors the broader rule from `02-analysis-screen.md`: the app states facts and their relevance, and lets the user weigh what "better" means for them.

---

## Wishlist (My Shelf → Explore new)

- Confirmation on save: "Added to your Wishlist."
- Conversion action label: "Put on my shelf" *(not "Buy" or "Purchase" — the app doesn't know a purchase happened, it only knows the user is moving the product from considering to owning)*
- Empty Wishlist state: "Nothing here yet. Explore a product before you buy it to see how it fits."
