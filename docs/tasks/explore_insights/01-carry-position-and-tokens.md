# 01 — Carry INCI position and the ordered token list through the pipeline

**Depends on:** nothing
**Blocks:** 02, 03, 04
**Size:** S · plumbing only, no UI change, no new parsing logic
**User-visible change:** none. This task must not change a single pixel.

---

## Context

`parseActiveIngredientDetails` (`src/utils/ingredientParser.ts:129-174`) already computes a 1-based comma-token position for every matched active class and returns it on `ParsedActiveDetail.position`. `resolveFromRawText` (`src/utils/productProfile/resolve.ts:134-150`) reads that result, alphabetizes the keys with `sortKeys` (`resolve.ts:31-33`) and discards position entirely — `ResolvedIngredients` has no position field.

Separately, `tokenizeIngredientsText` (`resolve.ts:48-53`) produces the ordered comma-token array, and `useCompositionInsights.ts:70` already computes it, using only `.length` for the comparison matrix.

Both signals are needed by tasks 02–04. This task makes them survive to the hook's public return value. Nothing more.

Note the prior product decision this reverses: `docs/specs/explore-composition.md:223-224` records "no ingredient position/concentration-order value" as a non-goal. That constraint was written about the comparison matrix and is being re-scoped to the matrix only — plan decision D1, **confirmed 2026-09-05**. Update that spec line as part of this task; do not silently contradict it, and do not stop to ask.

---

## Changes

### 1. `src/utils/productProfile/resolve.ts`

Add a position map to the stage-1 output shape:

```ts
export interface ResolvedIngredients {
  resolvedActiveKeys: ActiveIngredientKey[];
  unresolvedIngredientTokens: string[];
  potencyByKey: Partial<Record<ActiveIngredientKey, Potency>>;
  /** 1-based comma-token index of the earliest match for each resolved key.
   *  Empty for the corpus path, which has no source text to position against. */
  positionByKey: Partial<Record<ActiveIngredientKey, number>>;
}
```

Populate it in the two text-based entry points, mirroring exactly how `potencyByKey` is built in the same loop:

- `resolveFromRawText` (`:134-150`) — from `parsed`.
- `resolveFromProduct` (`:101-124`) — from `parsed`. Keys that came only from `product.activeTags` (the wizard-confirmed union at `:102-104`) have **no** position: leave them absent from the map. A tag with no source text has no position, and inventing one would be a false claim.

Rule when a class matches more than once: **keep the lowest (earliest) position.** `ParsedActiveDetail.position` is already the earliest match per class per `ingredientParser.ts:157`, but write the reducer defensively (`Math.min`) so a future parser change cannot silently regress this.

`resolveFromActiveKeys` (`:160-169`) returns `positionByKey: {}`.

Do **not** change `sortKeys`, do **not** change the ordering of `resolvedActiveKeys` — display ordering is task 03's concern and it will use the map, not the array order.

### 2. `src/hooks/useCompositionInsights.ts`

Extend the public interface:

```ts
export interface CompositionInsights {
  capabilityTags: CapabilityKey[];
  resolvedActiveKeys: ActiveIngredientKey[];
  /** Ordered comma-split ingredient tokens, verbatim from the captured text. */
  ingredientTokens: string[];
  /** `ingredientTokens.length`, exposed separately so consumers need not depend on the array. */
  ingredientCount: number;
  /** 1-based INCI position per resolved key; a key may be absent. */
  positionByKey: Partial<Record<ActiveIngredientKey, number>>;
  skinType: SkinType | null;
  skinTypeCaution: SkinTypeCautionResult | null;
  shelfComparison: ShelfComparisonResult | null;
  routinePosition: RoutinePosition | null;
}
```

`tokens` is already computed at `:70` — return it as `ingredientTokens`, and `tokens.length` as `ingredientCount`. Forward `resolved.positionByKey`. Update the stale comment at `:67-69` ("Still computed for Story 6's Ingredient count matrix parameter, even though the full token-by-token list is no longer rendered") — it is no longer accurate once tokens are exposed.

Do **not** expose `unresolvedIngredientTokens`. See `00-plan.md` → "Correction to an earlier assumption": on an active-class ruleset that field is a matcher-gap signal, not a coverage metric, and surfacing it would produce a misleading number. It stays internal.

### 3. `docs/specs/explore-composition.md`

Re-scope the non-goal at `:223-224` so it constrains the comparison matrix specifically, and note that `DetectedActivesCard` may surface position as of this batch. One or two sentences; do not rewrite the section.

---

## Acceptance criteria

- `ResolvedIngredients.positionByKey` is populated by both text entry points and empty (`{}`) for `resolveFromActiveKeys`.
- A key present only via `product.activeTags` in `resolveFromProduct` is absent from `positionByKey` — not `0`, not `null`, absent.
- A class matching at several positions maps to the earliest one.
- `useCompositionInsights` returns `ingredientTokens`, `ingredientCount` and `positionByKey`.
- `unresolvedIngredientTokens` is still **not** exposed on `CompositionInsights`.
- `resolvedActiveKeys` ordering is byte-for-byte unchanged (still alphabetical).
- No rendered output changes: existing tests under `tests/explore-composition/` pass without a single snapshot or assertion edit. **If one needs editing, stop and report — it means this task changed behaviour it should not have.**
- `npm test` green, `npx tsc --noEmit` clean.

## Tests to add

In `src/utils/productProfile/resolve.test.ts`:
- position map populated from raw text, values are 1-based and match comma order;
- earliest-wins when one class matches twice;
- tag-only key (via `resolveFromProduct` with `activeTags` set and text lacking that class) is absent from the map;
- `resolveFromActiveKeys` returns `{}`.

In `src/hooks/useCompositionInsights.test.ts`:
- the three new fields are returned and consistent (`ingredientCount === ingredientTokens.length`);
- `unresolvedIngredientTokens` is absent from the returned object.

## Out of scope

- Any UI file.
- Changing `actives.json`.
- Percentage or concentration values — the position is a list index, nothing more. Do not name any variable or comment as if it were a concentration.
- Normalization improvements (semicolons, brackets, CI numbers, asterisks, OCR line breaks). Known gaps, tracked separately, not this task.
