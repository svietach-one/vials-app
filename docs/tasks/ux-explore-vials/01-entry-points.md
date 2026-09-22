# Product Intelligence — Entry Points

Status: DRAFT — product/UX design, not yet built.
Depends on: `00-user-journey.md`.

---

## 0. Shelf model (context for everything below)

My Shelf is now two entities behind one screen, switched via a tab pair at the top — **Owned** and **Wishlist** — not a single Catalog list. This split exists specifically to serve the two different intents below: Owned is inventory you actually use (feeds Gap Coverage, Routine Impact, conflict checks); Wishlist is a considering state with no inventory side effects. See `03-product-page.md` for how this affects the Product Detail page, and `06-future-expansion.md` for why Wishlist is MVP scope now rather than deferred.

## 1. My Shelf → Add new / Explore new (finalized primary entry points)

Two explicit, always-visible buttons anchored at the bottom of My Shelf, not one combined action:

- **Add new** (primary, filled) — **user intent:** "I already bought this, log it." **Trigger:** tap → scan or manual entry → straight toward an Owned-shelf outcome. **Expected outcome:** Journey A (`00-user-journey.md`).
- **Explore new** (secondary, outline) — **user intent:** "help me decide whether to get this." **Trigger:** tap → scan → full analysis, verdict-forward. **Expected outcome:** Journey B, ending in Add to Shelf, Skip, or **Add to Wishlist** if the user isn't ready to decide.

Both converge on the same scan/analysis machinery underneath — this is a difference in framing and default outcome, not two separate technical pipelines. This supersedes the earlier single-button design: rather than one primary entry point with a deferred floating-button alternative, the two intents (Journey A vs. Journey B) now each get their own explicit, equally-visible door, permanently anchored, reachable from My Shelf in one tap regardless of scroll position.

## 2. Floating Scan button — resolved, not deferred

- **Original concern:** a persistent floating button risked visually announcing itself as *the* AI thing to press, and had no natural screen home.
- **Resolution:** moot as a separate question. Entry Point 1's **Explore new** button already is a persistent, always-reachable action anchored to My Shelf's bottom bar — it doesn't require navigating into a sub-screen first, which was the floating button's main proposed advantage. A separate floating button on top of that would be redundant, not complementary.

## 3. Existing Product page

- **User intent:** "should this still be on my shelf" (Owned) or "should I actually buy this" on a second look (Wishlist) — both are Journey C, general review rather than a fresh decision.
- **Trigger:** opening any product already saved, in either the Owned or Wishlist tab.
- **Expected outcome:** a compact, always-visible Product Intelligence strip (see `03-product-page.md`) with an expand affordance into the full analysis. The CTA differs by tab — see `03-product-page.md` §3.

This is not optional — every saved product, owned or wishlisted, should have this available, since Product Profiles are cached and cheap to display once built (`../01-product-profile.md` §3). It is a required secondary entry point, not a nice-to-have.

## 4. Future Product Catalog (browsable global database)

- **User intent:** "let me see if this product is worth trying" *before* owning it — closer to research than logging.
- **Trigger:** a hypothetical public/global product browser, distinct from today's Catalog (which is the user's personal inventory only).
- **Expected outcome:** the same analysis screen, but without shelf-specific "For You" data unless the user is signed into their shelf context.

Not available today — the current Catalog tab is explicitly personal-inventory-only per `SCREENS.md`. This entry point is real but future-facing, and ties directly to the business plan's public SKU page / programmatic SEO strategy (`Vials_Business_Plan_v1_1.docx` §3.3), where each public product page already ends with a CTA back into the app. Tracked in `06-future-expansion.md` as Long-term Vision, not MVP.

## 5. Universal Search

- **User intent:** "I know the name, let me just look it up" — an alternative to scanning when the product isn't physically in hand, or camera access is inconvenient.
- **Trigger:** a text search, reusing the already-scaffolded `searchByText` endpoint (`IMPLEMENTATION_PLAN.md` Phase 0) instead of the camera pipeline.
- **Expected outcome:** same analysis screen as scanning, since both converge on the same identified-product state.

This is close to free — the backend call already exists, and it's not a new navigational concept, just a second way to trigger the same resolution step Entry Point 1 already has. Recommended as a near-future fast-follow (`06-future-expansion.md`), not blocked on anything new.

---

## 6. Wishlist → Owned conversion ("Put on my shelf")

Not a fresh entry point into analysis — the analysis was already done when the product was added to Wishlist via Explore new. This is a status change: tapping **Put on my shelf** on a Wishlist card converts the existing record to Owned (prompts for opened-date/PAO tracking as needed) without re-running the Decision Engine. If shelf composition has changed materially since the Wishlist entry was analyzed, the For You section shown at conversion time reflects that — since it's recomputed on view per `03-product-page.md` §4, not stale from the original Explore session.

---

## Recommendation: two co-primary entry points, not one

Superseding the earlier single-primary recommendation: **Add new** and **Explore new** (Entry Point 1) are now equally primary, distinguished by intent rather than ranked by importance — collapsing them back into one button was the actual mistake in the original design, since it hid the pre-purchase use case (Journey B) behind inventory-logging language ("add") that doesn't fit someone who hasn't bought anything yet.

Reasoning for treating both as primary rather than one-primary-one-secondary:
- **Each serves a distinct, real intent that the other's label actively mismatches.** "Add" doesn't read as "help me decide" any more than "Explore" reads as "I already own this."
- **Both are equally cheap to build.** They converge on the same scan/analysis pipeline underneath (`04-scanner-flow.md`) — this is a UI/copy fork, not two features.
- **Journey B (pre-purchase) is a named, real use case**, not a hypothetical — under-serving it by burying it in secondary UI was the actual gap being corrected here.

Entry Point 3 (Existing Product page, both tabs) remains a **required secondary** entry point. Entry Points 4 and 5 (Future Product Catalog, Universal Search) remain deferred as before — see `06-future-expansion.md`. Entry Point 2 (Floating Scan button) is resolved, not deferred, per §2 above.

---

## A note on filter and search (adjacent, not Product-Intelligence-owned)

My Shelf's filter (category pills, reachable via a header icon rather than an inline strip) and search now live together behind one consolidated affordance rather than as separate persistent UI. This is a Catalog-level information-architecture decision, not a Product Intelligence feature — noted here only because it shares the same screen as the two entry points above and affects how crowded My Shelf feels alongside them. Biomarker filtering (`SCREENS.md` `CatalogFilterHeader`, `US-20`) is a separately specified requirement outside this RFC's scope; its omission from the current filter-sheet mockup is a simplification for this design pass, not a decision to drop it, and should be reconciled against `US-20`'s acceptance criteria before implementation.
