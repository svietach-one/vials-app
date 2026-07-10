# Technical Design: Multi-Active Badges on Shelf Cards
Spec: docs/specs/multi-active-badges.md
Author: tech-designer
Date: 2026-07-06

## AI-SDLC Flags
```
backend_layer:  false
frontend_layer: true
infra_changes:  false
```

## 1. Architecture Overview

Pure frontend rendering fix — no persistence or API change. `ProductShelfCard` currently derives a single `activeKey` from `product.activeTags?.[0] ?? product.activeIngredients?.[0]?.key` (lines 70-71). `CatalogScreen.renderItem` already passes the full, unmodified `product` object as a prop to `ProductShelfCard` — confirmed there is no upstream truncation between the screen and the card; the bug is 100% localized to those two lines. The fix extracts key-derivation into a pure `src/utils/` function (business logic, unit-testable, no React) and keeps color mapping inside the component (consistent with the existing `TYPE_COLORS` pattern):

```
Product.activeTags / activeIngredients (unchanged, full arrays)
  -> getProductActiveKeys(product)         [NEW src/utils/activeBadges.ts]
       activeTags-else-activeIngredients precedence (unchanged rule, now array-wide) + dedupe + sort
       -> ActiveIngredientKey[]
            -> getActiveBadgeCategory(key)  [NEW src/utils/activeBadges.ts] -> ActiveBadgeCategory
                 -> ACTIVE_CATEGORY_COLORS[category] [NEW, in ProductShelfCard.tsx, sibling of TYPE_COLORS]
                      -> one outlined badge per key, inside existing badgesRow (flexWrap:'wrap' already present)
```

`RoutineStepCard.tsx` / `ProductPickerCard.tsx` have the identical single-key bug pattern but are explicitly out of scope per `docs/specs/multi-active-badges.md` Non-Goals.

## 2. API Contracts

No HTTP endpoints — frontend-only. New pure function / type signatures:

```ts
// src/utils/activeBadges.ts
function getProductActiveKeys(product: Product): ActiveIngredientKey[];
// activeTags when defined (even []) -> used as-is, deduped, sorted
// else activeIngredients.map(a => a.key) -> deduped, sorted
// else []

function getActiveBadgeCategory(key: ActiveIngredientKey): ActiveBadgeCategory;
// exhaustive mapping over ActiveIngredientKey -> one of the 4 buckets below
```

```ts
// src/types/index.ts (addition, next to ActiveIngredientKey)
export type ActiveBadgeCategory = 'exfoliant' | 'soothing' | 'hydrator' | 'other';
```

No error codes — both functions are total and synchronous; unmapped/legacy keys fall into `'other'` rather than throwing.

## 3. Implementation Tasks

### engineer (scope=frontend)
- FE-1: Add `export type ActiveBadgeCategory = 'exfoliant' | 'soothing' | 'hydrator' | 'other';` to `src/types/index.ts`, directly below `ActiveIngredientKey`. Files: `src/types/index.ts`.
- FE-2: Create `src/utils/activeBadges.ts` exporting `getProductActiveKeys(product: Product): ActiveIngredientKey[]` and `getActiveBadgeCategory(key: ActiveIngredientKey): ActiveBadgeCategory`. Category buckets: `exfoliant` = `retinoid, retinol, aha, bha, pha, benzoyl_peroxide, azelaic_acid, vitamin_c_pure, vitamin_c_derivative, vitamin_c`; `soothing` = `niacinamide, copper_peptides, cica, panthenol`; `hydrator` = `ceramides, hyaluronic_acid`; everything else (`spf_filters, spf_chemical`) = `other`. `getProductActiveKeys` dedupes via `Set` and sorts by a fixed key-priority array so badge order is deterministic across renders regardless of input array order. Files: `src/utils/activeBadges.ts`.
- FE-3: In `src/components/product/ProductShelfCard.tsx`, replace lines 70-71 (`const activeKey = ...` / `const activeLabel = ...`) with a call to `getProductActiveKeys(product)`. Add `ACTIVE_CATEGORY_COLORS: Record<ActiveBadgeCategory, { border: string; text: string }>` as a sibling constant to `TYPE_COLORS` (`exfoliant`: `amber`/`amberLine`, `soothing`: `bottleGreen`/`bottleGreenLine`, `hydrator`: `cobalt`/`cobaltLine`, `other`: `palette.black`/`zinc300`, matching today's neutral look — spec Story 2 AC4 is authoritative here: black text, zinc border, unchanged from the current single-badge style). Replace the single `activeLabel ? <View style={styles.activeBadge}>...` block with a `.map()` over the returned keys, each badge rendering `testID={`active-badge-${key}`}`, category `borderColor`, category `color`, and `ACTIVE_INGREDIENT_LABELS[key]` as the label (a total `Record`, so no `?? null` guard is needed, unlike the old single-key code). Update the `activeBadge` / `activeBadgeText` styles to accept a per-instance border/text color override instead of the hardcoded `zinc300`/`black`. Leave `typeBadge`, `TYPE_COLORS`, and `DEFAULT_TYPE_COLOR` untouched. Files: `src/components/product/ProductShelfCard.tsx`.

### engineer (unit tests, scope=frontend)
- FE-4: `src/utils/activeBadges.test.ts` — covers: `activeTags` with 2+ keys returns all of them, deduped; `activeTags: []` (defined, empty) returns `[]` even when `activeIngredients` is non-empty (the precedence-preserving case called out in spec Story 1); `activeTags: undefined` falls back to `activeIngredients.map(key)`; every key in each documented category bucket maps to that `ActiveBadgeCategory`; `spf_filters`/`spf_chemical` map to `'other'`; output order is identical across two calls whose input arrays have the same keys in different insertion order. Files: `src/utils/activeBadges.test.ts`.

## 4. Assumptions

- Category buckets are `exfoliant` (amber), `soothing` (covers both "soothing" and "brightening" actives, including `niacinamide`) (bottle-green), `hydrator` (cobalt), and `other` (neutral, unchanged) — 3 hued buckets plus 1 neutral, not 4 hued buckets.
  Alternative: a dedicated 4th "brightener" hue using `palette.cabernet`/`red`.
  Reason: `cabernet`/`red` are already the app's clinical-SOS/error colors (`colors.statusSOS`, `colors.statusError`); reusing either for a routine ingredient badge risks reading as a warning. The 3-bucket split instead reuses the exact grouping already shipped in `CatalogScreen`'s `ACTIVES_KEYS`/`SOOTHING_KEYS` constants and `docs/PRD_Spec.md`'s documented "Actives = amber / Soothing = green / Hydration = cobalt" intent — this task is the first to render that intent as pixels rather than inventing a new taxonomy.
- Active badges use an outlined style (colored border + text on a plain background, via the palette's `*Line` tokens: `amberLine`, `bottleGreenLine`, `cobaltLine`), while the type badge keeps its existing solid-fill `*Tint` style.
  Alternative: give active badges the same solid-fill treatment as `TYPE_COLORS`.
  Reason: guarantees the two badge kinds are never visually identical even when they land on the same hue family (e.g. an amber exfoliant badge next to an amber "Mask" type badge). The `*Line` hairline tokens already exist in `tokens.ts` for exactly this border use case and are currently unused anywhere in the app.
- Cards with 3+ actives wrap onto a second badge-row line; no "+N" truncation indicator is added.
  Alternative: truncate to 2 badges + a "+N" pill opening a details view.
  Reason: `badgesRow` already declares `flexWrap: 'wrap'`; a "+N" indicator would re-hide data — the exact bug this task fixes — and requires a new tap interaction that is out of scope (spec Non-Goals).
- Key-derivation and categorization are extracted to `src/utils/activeBadges.ts` as pure functions rather than computed inline in the component.
  Alternative: keep the derivation inline in `ProductShelfCard.tsx`, the way `activeKey` and `TYPE_COLORS` live today.
  Reason: `architecture-review.md`'s layer rule keeps business logic (precedence/dedupe/categorization) out of components; a co-located `.test.ts` lets the engineer unit-test the precedence rule — especially the `activeTags: []` vs `undefined` distinction — without mounting the component.
- `ActiveBadgeCategory` is added to `src/types/index.ts` rather than exported from `src/utils/activeBadges.ts`.
  Alternative: export the type directly from the new utils file.
  Reason: `architecture-review.md`'s duplication check flags any `export type`/`export interface` outside `types/index.ts` (excluding `*Props`); this is a genuine small domain concept worth keeping alongside `ActiveIngredientKey`, its sibling type.

## 5. Open Questions

No open questions block implementation. The spec's one open item — whether `RoutineStepCard.tsx`/`ProductPickerCard.tsx` get the same treatment as a fast-follow — is owned by the product owner and explicitly does not block this task (see `docs/specs/multi-active-badges.md` Section 10).
