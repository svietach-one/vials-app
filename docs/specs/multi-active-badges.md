# Multi-Active Badges on Shelf Cards
Date: 2026-07-06
Author: planner-agent
Jira: N/A (kebab-case task slug per agent-layer-protocol.md: `multi-active-badges`)
Status: DRAFT

## Revision — 2026-07-22 (screen-improvements card redesign)
The `ProductShelfCard` redesign (edge-to-edge photo, uniform active-badge
style) supersedes two decisions below:
- **Story 2 (category colors)**: active badges no longer color-code by
  function. All actives now render with one neutral fill (the shared
  `Badge` component, `Default`/`Light`: `colors.surfaceSunken` background),
  matching the type badge's "distinct recipe, not distinct hue" goal via a
  flat-vs-tint contrast instead of an outlined-vs-filled one.
- **Story 4 (wrap, not truncate)**: the badge row no longer wraps to a
  second line. It shows a fixed cap (`MAX_VISIBLE_ACTIVE_BADGES = 3`) and
  rolls any remainder into a trailing "+N" badge, the same cap-then-"+N"
  convention already used by `AddProductScreen.tsx`'s actives summary.

`tests/product-shelf-card/ProductShelfCard.test.tsx`'s "Story 2" and "Story 4"
multi-active-badges describe blocks were updated to match.

## AI-SDLC Flags
```
backend_layer:  false
frontend_layer: true
infra_changes:  false
```

## 1. Problem Statement
Users add products with multiple detected/confirmed active ingredients — e.g. a serum tagged both `bha` and `niacinamide` — but on the "My Shelf" screen, `ProductShelfCard` only ever renders the FIRST entry of `product.activeTags` (or, absent that, `product.activeIngredients`) as a badge; every other active on the same product is silently dropped from the card (`src/components/product/ProductShelfCard.tsx`, lines 70-71). The full data already exists on the `Product` record (`activeTags: ActiveIngredientKey[]`, `activeIngredients: ActiveIngredient[]`), so this is a rendering defect, not a data-collection gap. Users who took the time to confirm multiple actives via the add-product wizard see the app "forget" all but one of them on their own shelf, which misrepresents their catalog and undermines trust in the ingredient engine — an engine the app's core safety promise (conflict warnings) depends on being trusted.

## 2. Goals
- Every active ingredient key present on a product (per the existing `activeTags`-then-`activeIngredients` precedence) renders as its own badge on `ProductShelfCard` — zero truncation before the badges reach the screen.
- Active badges are color-coded by ingredient function (exfoliating/treatment acids, soothing/brightening, hydrating) using only existing `palette` tokens — no new hex values, no pink.
- Product-type badges (e.g. "Cream") remain visually distinguishable from the new active-category badges at a glance, not relying on color alone.
- Cards with 3 or more actives display all of them without a "+N hidden" affordance (see Section 5 for the wrap decision).

## 3. Non-Goals (explicitly out of scope)
- Fixing the identical single-active truncation bug in `RoutineStepCard.tsx` (Today/Routines screen, line 68) and `ProductPickerCard.tsx` (routine scheduler picker, line 46) — both share the exact `activeTags?.[0] ?? activeIngredients?.[0]?.key` pattern being fixed here, but this task is scoped to the "My Shelf" screen only. See Open Questions for a follow-up recommendation.
- Any new tap-through interaction on the badges (e.g. a tooltip explaining a matched ingredient) — that is the subject of the separate, already-designed `inci-attribution-highlighting` feature. This task only changes which badges render and how they're colored.
- Changing which array is authoritative between `activeTags` and `activeIngredients` — the existing precedence (`activeTags` wins whenever it is defined, even if empty; `activeIngredients` is read only when `activeTags` is `undefined`) is preserved, just applied to the full array instead of index `[0]`.
- A settings/user toggle to hide active badges or customize category colors — the category → color mapping is fixed and derived entirely from `ActiveIngredientKey`.
- Changing `CatalogFilterHeader`'s "Actives / Soothing / Hydration" biomarker filter pills — those are plain `FilterChip`s today (no per-category color) and are not touched by this task, even though their category names overlap conceptually with the new badge categories.

## 4. User Stories

### Story 1: See every active ingredient on a multi-active product
As a shelf user, I want to see a badge for every active ingredient the app detected or I confirmed on a product, so that my shelf accurately reflects what's actually on file instead of hiding all but one active.

**Acceptance Criteria:**
- [ ] Given a product with `activeTags: ['bha', 'niacinamide']`, when the shelf card renders, then both a "BHA" badge and a "Niacinamide" badge are visible on the card.
- [ ] Given a product with `activeTags: undefined` and `activeIngredients: [{key:'retinoid',...}, {key:'ceramides',...}]`, when the shelf card renders, then both a "Retinoids" badge and a "Ceramides" badge are visible — the fallback array is read in full, not just index 0.
- [ ] Given a product with `activeTags: []` (explicitly empty — user confirmed zero actives) and a non-empty `activeIngredients` left over from parsing, when the shelf card renders, then no active badge renders at all (the empty confirmed array wins, exactly as it does today for the single-badge case).
- [ ] Given a product with no actives in either array, when the shelf card renders, then no active badge renders and the layout is unchanged from today.

### Story 2: Distinguish active categories by color
As a shelf user scanning many cards, I want actives from different functional groups to look visually distinct, so that I can spot, for example, "this has an exfoliating acid" versus "this is just a hydrator" without reading every word.

**Acceptance Criteria:**
- [ ] Given a product tagged with an exfoliating/treatment acid (`retinoid`, `retinol`, `aha`, `bha`, `pha`, `benzoyl_peroxide`, `azelaic_acid`, or any vitamin C key), when its badge renders, then it uses the amber category color (`palette.amber` text / `palette.amberLine` border).
- [ ] Given a product tagged with a soothing/brightening active (`niacinamide`, `copper_peptides`, `cica`, `panthenol`), when its badge renders, then it uses the bottle-green category color (`palette.bottleGreen` text / `palette.bottleGreenLine` border).
- [ ] Given a product tagged with a hydrating/barrier active (`ceramides`, `hyaluronic_acid`), when its badge renders, then it uses the cobalt category color (`palette.cobalt` text / `palette.cobaltLine` border).
- [ ] Given a product tagged with an active outside all three buckets (`spf_filters`, `spf_chemical`), when its badge renders, then it uses the existing neutral treatment (zinc border, black text), unchanged from today's single-badge look.

### Story 3: Tell the product-type badge apart from active badges
As a shelf user, I want the "Cream"/"Serum"/etc. type badge to remain visually distinct from active badges, so that I never confuse "what this product is" with "what it contains."

**Acceptance Criteria:**
- [ ] Given any product, when the card renders, then the type badge keeps its existing solid-fill treatment (tint background, e.g. `palette.cobaltTint`) exactly as `TYPE_COLORS` defines today — unchanged.
- [ ] Given any product with at least one active, when the card renders, then active badges use an outlined treatment (colored border + text on a plain background) so the two badge kinds are never rendered with the same visual recipe, even when they happen to share a hue family.

### Story 4: Cards with many actives stay fully readable
As a shelf user with a heavily-actived product (3 or more actives), I want to see all of them, so that I don't have to open the product just to find out what I'm missing.

**Acceptance Criteria:**
- [ ] Given a product with 4 active tags, when the card renders, then all 4 badges render, wrapping onto a second line of the badge row if they don't fit on one line — no badge is hidden and no "+N" indicator is shown.
- [ ] Given the badge row wraps to a second line, when the card renders, then the overflow ("more actions") button stays on the first line of the bottom row and remains tappable — the existing `bottomRow` layout is not broken by a taller `badgesRow`.

## 5. UX / Behaviour
Badges render left-to-right inside the existing `badgesRow` (bottom-left of the card, left of the overflow button), in a fixed category-then-key order rather than raw array-insertion order, so the same product renders its badges in the same order across renders. The hidden-state eye-off badge (existing) and the type badge (existing, always last) keep their current positions; active badges are inserted between them.

**Overflow strategy — wrap, not truncate.** `badgesRow` already declares `flexWrap: 'wrap'` today (dead capacity, since only one active badge could ever appear before this task). This task activates that existing capacity instead of adding a "+N" chip, because: (1) truncating defeats the goal of this task — a "+N" indicator still hides real data behind a tap that doesn't exist yet (no new interaction is in scope; see Non-Goals); (2) the card's height is already variable (product titles wrap up to 2 lines), so an occasional second badge line is consistent with the card's existing flexible-height behaviour, not a new layout risk; (3) it requires zero new components or interactions, keeping this a pure rendering fix.

**Empty state:** no actives → badge row renders exactly as it does today (type badge only). No loading state applies — this is synchronous, local data already present on the `Product` object, nothing is fetched.

## 6. Data Requirements
- New data needed: none. This reads the full existing `activeTags` / `activeIngredients` arrays already stored on `Product` (`src/types/index.ts`) — no schema change, no migration.
- Existing data consumed: `Product.activeTags`, `Product.activeIngredients`, `ACTIVE_INGREDIENT_LABELS` (`src/constants/labels.ts`), `palette` tokens (`src/constants/tokens.ts`).
- Data retention: N/A — no new persisted data.

## 7. Dependencies
- Depends on spec: none. This is a self-contained rendering fix on top of the already-shipped `docs/specs/product-shelf-card.md`.
- Blocks: nothing. `inci-attribution-highlighting` (badge tap → attribution tooltip) is a separate, independently-shippable feature that can layer an `onPress` onto these badges later without requiring this task to change further.
- External services: none.

## 8. Security & Privacy
- Authentication required: no (same as the existing shelf screen).
- Data sensitivity: none — the same product/ingredient data already rendered today, just no longer truncated.
- Compliance considerations: none.

## 9. Success Metrics
- Zero products in a manual QA pass (10 multi-active products spanning all three category buckets) show fewer active badges than the length of their de-duplicated `activeTags`/`activeIngredients` key set.
- `npx tsc --noEmit` and the full Jest suite stay green after the change — no regression in the 27 existing `ProductShelfCard.test.tsx` cases or the 8 `product-shelf-card-hidden.test.tsx` cases.
- Support/user-feedback reports of "the app is hiding my ingredients" (the complaint category that prompted this task) trend to zero post-release.

## 10. Open Questions
- [ ] Should `RoutineStepCard.tsx` and `ProductPickerCard.tsx` receive the identical multi-badge + category-color treatment as a fast-follow task, given they share the exact same truncation bug pattern confirmed during this task's investigation? → owner: product owner (svietach@gmail.com). Does not block this task, which is scoped to `ProductShelfCard` only.
