# 04 — Replace the comparison matrix's abstract rows with named shelf overlaps

**Depends on:** 01
**Size:** M · one new pure module + a reworked component
**User-visible change:** yes — the largest one in this batch.
**Plan decision D2 (delete the two abstract rows) is CONFIRMED — proceed without asking.**

---

## Context

`CompositionComparisonMatrix` (`src/components/catalog/CompositionComparisonMatrix.tsx`) renders four rows: `Functional profile breadth`, `Ingredient count`, `Active tags`, `Category`, with values like `Shelf avg 4 (3 of 5 with data)` and `2 Shelf serums share a tag`.

These are statistics about a shelf. *"Ingredient count: 42 vs shelf avg 38"* does not help anyone decide anything, and *"2 Shelf serums share a tag"* withholds the only part that matters — **which** tag, and **which** products.

The replacement: name the overlap. *"Niacinamide — you already have 3: CeraVe PM Lotion, The Ordinary 10%, Anua Toner."* That is a purchase decision made in one line, and it is only possible because we know the shelf.

Two scope changes are deliberate:

1. **Whole shelf, not same-category.** `buildShelfComparison` filters to the captured category by design (spec Story 6 AC2/AC7). Duplicate detection must not: a niacinamide serum duplicates a niacinamide moisturiser just as surely. So overlap detection goes in a **new module** rather than widening `buildShelfComparison` and breaking its documented contract.
2. **Two rows are deleted** — decision D2, confirmed. Delete them; do not ask again.

---

## New file: `src/utils/productProfile/shelfOverlap.ts`

Pure module, same constraints as its siblings (no React, no store, no I/O).

```ts
export interface OverlappingProduct {
  id: string;
  /** Display label: brand + name, trimmed; falls back to name alone when brand is null. */
  label: string;
}

export interface SharedActive {
  key: ActiveIngredientKey;
  products: OverlappingProduct[];
}

/**
 * Which of this composition's actives already appear somewhere on the Shelf,
 * and in which products. Scans the entire Shelf regardless of category.
 */
export function buildShelfOverlap(
  activeKeys: ActiveIngredientKey[],
  products: Product[],
): SharedActive[];
```

Implementation notes:

- Reuse `resolveFromProduct` (`resolve.ts:101`) per Shelf product — same call `buildShelfComparison` already makes. No new detection logic. If per-product resolution turns out to be expensive on a large shelf, memoise at the hook level, do not reimplement resolution here.
- A product with no `fullIngredientText` and no `activeTags` resolves to no keys and simply contributes nothing. Do not special-case it.
- Return only keys with at least one matching product. Never return empty `products` arrays.
- **Ordering:** by `products.length` descending, then by the key's INCI position ascending (pass `positionByKey` in, or sort alphabetically as a tiebreak — pick one and document it), so the most-duplicated and most-prominent overlap is first.
- Do not truncate here. The component decides how many to show.

---

## Changes to `src/components/catalog/CompositionComparisonMatrix.tsx`

**Delete** the `Functional profile breadth` and `Ingredient count` rows, and the `shelfFunctionalTagAverage` / `shelfIngredientCountAverage` values feeding them. Leave the fields on `ShelfComparisonResult` in place for now (other consumers may exist; removing them is a separate cleanup) but stop rendering them.

**Replace** the `Active tags` row with a named-overlap block.

**Keep** the `Category` row as-is (`N on your Shelf`).

**Copy — exactly these strings:**

| Element | String |
|---|---|
| Card title | `How this fits your Shelf` |
| Overlap row | `{Active label} — you already have {n}` |
| Product list, per row | `{label}, {label}, {label}` — at most 3, then `+{n} more` |
| No overlap, but shelf has items | `Nothing on your Shelf overlaps with this composition.` |
| No same-category items (existing) | `No other {category plural} on your Shelf yet to compare against.` |
| Empty shelf entirely | `Your Shelf is empty — add a product to start comparing.` |

The "nothing overlaps" case is a **result, not an empty state**: it means the product fills a gap. Render it in the normal content style, not greyed out, and not with an `EmptyState` component.

Show at most **4** overlapping actives. If more, append a muted line `+{n} more shared with your Shelf`.

**Colour:** overlaps are informational, not warnings — muted text plus the flow's existing `palette.plum` accent, consistent with the sibling cards. **No amber, no cabernet.** An overlap is not a conflict; conflict detection on this screen remains a non-goal (plan decision D3).

## Changes to `src/hooks/useCompositionInsights.ts`

Add `shelfOverlap: SharedActive[]` to `CompositionInsights`, computed with `useMemo` over `resolved.resolvedActiveKeys` and `products` (both already read in this hook at `:62,65`). Unlike `shelfComparison`, it is **not** gated on `category !== null` — overlap does not need a category.

---

## Acceptance criteria

- Overlaps are detected across the whole Shelf, not only the captured category. Test explicitly with a matching product in a *different* category.
- Products are labelled `brand + name`, falling back to `name` when brand is null; no `null` or `undefined` ever reaches the screen.
- More than 3 products on one active → first 3 plus `+{n} more`.
- More than 4 shared actives → 4 rows plus the muted overflow line.
- Empty shelf, and non-empty shelf with zero overlap, render their distinct strings.
- `Functional profile breadth` and `Ingredient count` no longer appear anywhere on screen.
- The `Category` row is unchanged.
- No position value is rendered in this component — the matrix stays position-free per decision D1.
- `npm test` green, `npx tsc --noEmit` clean.

## Tests

- New `src/utils/productProfile/shelfOverlap.test.ts`: cross-category match; product with no ingredient data; ordering by count then tiebreak; no overlap → `[]`; empty shelf → `[]`.
- Update `tests/explore-composition/ExploreCompositionResultScreen.test.tsx`: the two deleted rows are gone, the overlap block renders, all three empty/zero cases render their exact strings.
- Existing `shelfComparison.test.ts` must pass **unchanged** — this task does not alter `buildShelfComparison`'s behaviour.

## Out of scope

- Calling `conflictEngine` (decision D3).
- Routine gaps — task 06.
- Removing the now-unused average fields from `ShelfComparisonResult`.
- Making product names tappable / navigating to the Shelf item. Good idea, later batch.
