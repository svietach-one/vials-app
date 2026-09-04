# Product Intelligence — Integration into Product Detail

Status: DRAFT — product/UX design, not yet built.
Depends on: `02-analysis-screen.md` (the full-detail view this page links out to, rather than duplicates).

---

## 1. Governing rule: preview here, own the detail elsewhere

Product Detail is not a second place the full analysis lives — it's a **preview** of the same `ProductProfile`/Decision Engine output that `02-analysis-screen.md` fully owns. This avoids two problems at once: duplicated UI logic for the same data, and a page that tries to be both an inventory record and a full analysis report simultaneously. Product Detail stays a shelf record with a glanceable intelligence layer; the full analysis is one tap away, in the same component the scan flow already uses.

---

## 2. Always visible (no interaction required)

A single compact strip, added to the existing Product Detail layout without restructuring it:

- **Up to 3 primary-function badges** (e.g. "Barrier Repair · Soothing") — matches the collapsed Product Intelligence summary from `02-analysis-screen.md` §4.
- **One irritation indicator** — a single glanceable signal (not the full 0–5 breakdown).
- **One routine-fit signal** (Owned tab only — a Wishlist item has no routine to fit into), shown only if relevant to Journey C's actual question ("should this still be here") — e.g. a small flag if Gap Coverage now finds this product redundant with something added *after* it (a genuinely useful "your shelf has evolved past this" signal, not present in the scan-flow version of analysis since that's a first-look, not a review).

This strip should read in under two seconds — it exists to answer "do I need to think about this product at all right now," not to inform a decision by itself.

## 3. Inside expandable sections

Everything else — full capability list, strengths/weaknesses text, similarity, gap coverage, routine impact, the recommendation verdict machinery — lives behind a single "View full analysis" expansion that opens the same component `02-analysis-screen.md` defines. Not a re-implementation, not a trimmed-down variant: the identical component, fed the same `ProductProfile`, so behavior (progressive disclosure, CTA hierarchy, section independence) is consistent no matter which entry point brought the user there.

The only difference from the scan-flow presentation: the CTA row depends on which tab the product belongs to. For an **Owned** product, there's no "Add to Shelf" option (already owned) — only "Replace" (if Gap Coverage/Similarity suggest redundancy) or no action. For a **Wishlist** product, the primary CTA is **Put on my shelf** — the conversion action described in `01-entry-points.md` §6 — with Remove as the secondary option, and no Gap Coverage/Routine Impact "Replace" logic applied (a Wishlist item isn't in use yet, so nothing to replace).

## 4. Recomputed live vs. cached

| Data | Behavior | Why |
|---|---|---|
| Capabilities, irritation, routine position, strengths/weaknesses (Product Intelligence) | **Cached**, read from the stored `ProductProfile` | Per `../01-product-profile.md` §3, these only change on ruleset version bumps or corpus re-matches — rebuilding on every page view would be wasted work for data that is, by design, stable |
| Gap coverage, similarity (For You) | **Recomputed on view** | These depend on the *current* shelf/routine state, which changes independently of the product itself — showing a stale "adds Barrier Repair" after the user already added a different barrier-repair product elsewhere would be actively misleading |
| Recommendation verdict | **Recomputed on view** | Composes the above — same reasoning as gap coverage/similarity; a verdict computed when the product was first added can silently go stale as the shelf evolves |

**Practical implication:** the always-visible strip in §2 should draw its irritation/capability badges from the cached profile (fast, no wait), while the review-relevant routine-fit signal and the full For You section inside the expansion should be treated as short-lived and recomputed each time the section is opened — not cached alongside the product-level facts.

---

## 5. Avoiding overload

Three concrete constraints, not just a general "keep it simple" intention:

- **The strip in §2 never grows past three badges plus one irritation indicator plus one optional routine-fit flag** — if more capabilities are relevant, they're a reason to expand, not a reason to widen the strip.
- **No duplicate CTAs.** The Product Detail page's existing actions (edit, delete, mark opened) stay exactly where they are; the analysis expansion adds its own CTA row only inside itself, not two competing action rows on one page.
- **The strip appears once**, near the top of Product Detail alongside existing identity fields (brand, name, type) — not repeated in multiple places on the same page, and not inserted between existing, already-familiar fields the user expects to find in their current position.
