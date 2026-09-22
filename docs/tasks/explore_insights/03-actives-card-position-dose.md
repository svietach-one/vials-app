# 03 — `DetectedActivesCard`: show where each active sits, and whether it is below the 1% line

**Depends on:** 01, 02
**Size:** S · one component + copy
**User-visible change:** yes — this is the first task in the batch the user can see.

---

## Context

`DetectedActivesCard` (`src/components/catalog/DetectedActivesCard.tsx`) currently renders `resolvedActiveKeys.map(...)` as a flat list of `Tag` pills, in alphabetical-by-internal-key order (`resolve.ts:144`), with the empty state *"No known active ingredients detected in this composition."*

A pill saying "Niacinamide" tells the user what the label already told them. The same pill saying **"Niacinamide · 6th of 42"** tells them something the label does not, and **"below the 1% line"** tells them something the brand would rather they did not notice.

---

## Changes

### `src/components/catalog/DetectedActivesCard.tsx`

New props (keep the existing ones):

```ts
ingredientTokens: string[];
positionByKey: Partial<Record<ActiveIngredientKey, number>>;   // 1-based
onePercentLine: OnePercentLineResult | null;
```

**Layout:** replace the flat pill row with one row per active — label on the left, position on the right, an optional note beneath. A pill row cannot carry two pieces of metadata per item legibly; do not try to cram the ordinal into the `Tag`.

**Ordering:** sort by position ascending. Actives with no recorded position go last, in their current alphabetical order. This replaces alphabetical ordering, and it is the point: the list now reads most-prominent-first, which is how the INCI list itself is ordered.

**Copy — use exactly these strings:**

| Element | String |
|---|---|
| Card title (unchanged) | `Detected actives` |
| Card subtitle (new) | `{n} ingredients in this list` |
| Position, per row | `{ordinal} of {n}` — e.g. `6th of 42` |
| Position, unknown | omit the right-hand text entirely; render no placeholder |
| Below-the-line note | `Below the 1% line — likely a small amount` |
| Below-the-line note, medium confidence | `Probably below the 1% line — likely a small amount` |
| Empty state (unchanged) | `No known active ingredients detected in this composition.` |

Ordinals are English (`1st, 2nd, 3rd, 4th…`). There is no i18n layer in this app (audit §6) — hardcode them in a small local helper, do not add a dependency.

**When to show the note:** only when `onePercentLine !== null` **and** the active's 1-based position is `>= onePercentLine.lineIndex + 1` (the result is 0-based, positions are 1-based — get this conversion right and write a test for the exact boundary token).

**Colour:** this is analytical information, not a warning. Use muted secondary text with `palette.cobalt` / `palette.cobaltTint` per the semantic mapping in `PRD_Spec.md` §2 (cobalt = informational/analytical). **Do not use amber** — amber is reserved for conflicts and expiry, and using it here would read as "this product is bad", which is not the claim being made.

**Hedging is mandatory.** The strings above say "likely a small amount", not "this doesn't work". The boundary is inferred from marker ingredients, not measured. Do not tighten this copy into a verdict.

### `src/components/catalog/CompositionInsightsSection.tsx`

Compute the 1% line once and pass it down:

```ts
const onePercentLine = useMemo(
  () => findOnePercentLine(insights.ingredientTokens),
  [insights.ingredientTokens],
);
```

Pass `ingredientTokens`, `positionByKey` and `onePercentLine` into `DetectedActivesCard`. Nothing else in this file changes.

Alternatively compute it inside `useCompositionInsights` and return it — either is fine, but pick one and do not compute it twice.

---

## Acceptance criteria

- Actives render ordered by INCI position, earliest first.
- An active with no position renders without an ordinal and sorts to the end.
- The below-the-line note appears for exactly those actives at or after the boundary, and the boundary token itself counts as below.
- When `findOnePercentLine` returns `null`, no note appears anywhere and positions still render.
- Subtitle shows the plain token count. It does **not** show a "recognised N of M" coverage figure — see `00-plan.md`, that number would be misleading on an active-class ruleset.
- Empty state string unchanged.
- No amber anywhere in this component.
- `npm test` green, `npx tsc --noEmit` clean.

## Tests

Extend `src/components/catalog/DetectedActivesCard.test.tsx` (create if absent) and `tests/explore-composition/ExploreCompositionResultScreen.test.tsx`:

- position ordering, including a mixed known/unknown-position case;
- ordinal formatting for 1st, 2nd, 3rd, 4th, 11th, 21st, 42nd;
- note shown at the boundary index and at the index after it; **not** shown one index before it;
- `null` line → no notes rendered;
- medium-confidence wording differs from high-confidence wording;
- empty actives → unchanged empty-state string.

## Out of scope

- The comparison matrix — task 04, and it stays position-free per plan decision D1.
- Any percentage figure.
- Changing the disclaimer text at the bottom of `CompositionInsightsSection`.
- Making the rows tappable / an ingredient detail sheet. Later batch.
