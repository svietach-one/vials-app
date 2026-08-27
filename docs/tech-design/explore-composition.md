# Technical Design: Explore Composition Flow
Spec: docs/specs/explore-composition.md
Author: planner
Date: 2026-08-26 (revised same day — 2026-08-26 decision batch: comparison matrix, skin-type caution
signal, routine placement, entry-card copy. First slice already shipped to `PR_REVIEW`; this revision
adds a second slice on top, per spec §3 reversal note. Revised again 2026-08-27 to add Story 9:
a `WishlistEntryDetailScreen` that reuses this screen's insight sections rather than reimplementing
them — see the new Story 9 subsections below.)

## 1. Architecture Overview
No new OCR/parsing engine. Capture reuses `CameraCaptureModal mode="inci"` (photo, unchanged) or a
new paste modal (mirrors `IngredientsSection.tsx`) to get raw INCI text through the existing
Tesseract/`ocrTextCleaner` pipeline. That text feeds a new thin entry point on
`productProfile/resolve.ts` into the existing `join.ts` → `capabilities.ts` pipeline for the result
screen's tags + unrecognized-token flags. Saves write to a new isolated `wishlistStore.ts`, or reuse
`productsStore.addProduct` via a new prefill mode on `ManualProductFormScreen.tsx` (the existing
partial-identity completion screen — not `AddProductScreen.tsx`'s from-scratch accordion).
`CatalogScreen.tsx`'s two `entryPointRow` buttons become the two cards; `Add new`'s destination is
unchanged.

**2026-08-26 addition:** the same `classFacts` already computed for the Functional Profile tags
(`joinActiveKeys(resolved.resolvedActiveKeys, resolved.potencyByKey)`) now also feeds
`buildRoutinePosition(category, classFacts)` (existing function, previously excluded — now
un-deferred) and a new pure `skinTypeCaution.ts`. A new pure `shelfComparison.ts` reads
`productsStore.products` (filtered to `category`) plus this composition's own already-computed stats
to produce the comparison matrix. All three are render-time-only reads — no new persisted fields.

```
CatalogScreen entryPointRow (2 cards)
  ├─ Add new ─────────────► AddProductHub (unchanged: Scan/Search/Manual)
  └─ Explore new ──► ExploreCompositionCaptureScreen (new; replaces CaptureFlow+wishlist target)
                          │ photo: CameraCaptureModal(mode="inci")  [existing, unmodified]
                          │ paste: new TextInput modal
                          ▼ raw INCI text (persisted immediately to local state)
                       resolve.ts: resolveFromRawText() [new, thin] → join.ts → capabilities.ts [existing]
                          ▼
                    ExploreCompositionResultScreen (new)
                          ├─ join.ts → capabilities.ts ──────────► Functional Profile tags (unchanged)
                          ├─ skinTypeCaution.ts [new] + useProfileStore.profile ─► Skin-type caution
                          ├─ shelfComparison.ts [new] + productsStore.products (read) ─► Comparison matrix
                          ├─ routinePosition.ts buildRoutinePosition() [un-deferred] ─► Routine placement
                          ├─ Add to Wishlist ───────► wishlistStore.ts (new)
                          └─ Put on Shelf ──────────► ManualProductFormScreen (new prefill mode)
                                                          → productsStore.addProduct [existing]
wishlistStore entry ──"Move to Shelf"──► ManualProductFormScreen (same prefill mode;
                                                entry removed only after save succeeds)
```

**2026-08-27 addition (Story 9):** the insight sections and disclaimer already rendered by
`ExploreCompositionResultScreen.tsx` are extracted into one reusable pair — a
`useCompositionInsights` hook (`src/hooks/`, mirrors the existing `useRoutineLinking.ts`
convention) for the data, and a `CompositionInsightsSection` component for the rendering — so a
second screen, `WishlistEntryDetailScreen`, shows the exact same sections for an already-saved
`WishlistEntry` without a second implementation (see the 'reuse mechanism' assumption below).
`ExploreCompositionResultScreen.tsx` itself is refactored, non-behavior-changing, to call the
same hook/component. The new screen adds only what's genuinely screen-specific: an identity
header, a `notes` field + `wishlistStore.updateEntry` action, and a footer exposing the same
"Move to Shelf"/"Delete" actions `WishlistEntryCard` already has.

```
WishlistEntryCard.onCardPress ──► WishlistEntryDetailScreen (new, keyed by { wishlistEntryId })
                                      │ looks up the entry from wishlistStore.entries
                                      ▼
                     useCompositionInsights(entry.rawIngredientsText, entry.category)  [new hook]
                                      │ same resolveFromRawText → capabilities → skinTypeCaution →
                                      │ shelfComparison → routinePosition pipeline, unchanged
                                      ▼
                          CompositionInsightsSection  [new, shared with the result screen]
                            ├─ FunctionalProfileCard / DetectedActivesCard  [newly extracted]
                            ├─ SkinTypeCautionNotice / CompositionComparisonMatrix /
                            │  RoutinePlacementCard  [already extracted, reused as-is]
                            └─ disclaimer  [extracted]
                          + Notes card (new, screen-specific) ──► wishlistStore.updateEntry
                          + footer: Move to Shelf / Delete (screen-specific, mirrors the card)

ExploreCompositionResultScreen ──► refactored to call the same hook + CompositionInsightsSection;
                                    keeps its own Save-to-Wishlist/Put-on-Shelf footer, no identity
                                    header, no Notes card (nothing saved yet to attach notes to).
```

## 2. API Contracts
N/A — local-only app, no backend/HTTP surface in this repo (CLAUDE.md: no Supabase/Firebase in
Phase 1). This flow adds zero network calls, including the 2026-08-26 addition and the
2026-08-27 Story 9 addition.

## 3. Implementation Tasks

### engineer (scope=frontend — app is frontend-only)

- FE-1: Entry cards — file: `src/screens/CatalogScreen.tsx`. Replace the two `entryPointRow` Buttons
  with full-card tap targets (title + subtitle), reusing the card visual pattern already in
  `AddProductHubScreen.tsx` (`actionRow`/`manualCard` styles). `Add new` → unchanged destination.
  `Explore new` → new destination (FE-2), dropping the `CaptureFlow`/`initialStatus:'wishlist'` call
  for this button only. Subtitle copy ships as an explicit `// PLACEHOLDER — pending design review`
  comment (spec §10). **Superseded for the `Explore new` card only by FE-15 below** — its copy is now
  final, not placeholder.

- FE-2: Capture screen — new file `src/screens/catalog/ExploreCompositionCaptureScreen.tsx`,
  registered in `CatalogStackParamList`/`AppNavigator.tsx`. Photo path: `<CameraCaptureModal
  mode="inci" />` unmodified. Paste path: new multiline `TextInput` modal mirroring
  `IngredientsSection.tsx`'s existing paste UI. Raw text written to local state immediately on either
  path (before FE-3 runs). Single-tap category selector on this screen, stored alongside —
  **required as of 2026-08-27** (was optional; see Assumptions below), rendered above the capture
  block, neither capture path opens without one selected. **Redesigned again 2026-08-27** (human
  design reference): headline + subheadline added above the category chips (no hero illustration —
  not available yet); the photo action reuses `ScanTile` (`src/components/addProduct/ScanTile.tsx`,
  already shared by the manual-entry wizard) instead of a filled `Button` — "Take a photo" +
  caption "Photograph the ingredient list on the label"; paste renamed "Paste text manually",
  still a plain `Button variant="textActive"` text link, same primary/secondary weighting as
  before, no changes to the paste modal itself. **Superseded same day** (human follow-up,
  logged in `progress/explore-composition.md`'s 2026-08-27 entries): the headline/subheadline
  pair was consolidated into one final headline, "Choose a category and add the ingredients to
  see the details.", and the divider line between the category chips and the capture block was
  removed.

- FE-3: Raw-text resolver — extend `src/utils/productProfile/resolve.ts` (additive only): export
  `resolveFromRawText(inciText: string): ResolvedIngredients`, built from the same internals
  `resolveFromProduct` already uses (`parseActiveIngredientDetails`, `normalizeActiveKey`,
  `isKnownClass`, `applyTagPotencyDefaults`, `sortKeys`, the existing private unresolved-token
  finder) — no new matching/tokenizing logic. Tests added to the existing `resolve.test.ts`.

- FE-4: Result screen — new file `src/screens/catalog/ExploreCompositionResultScreen.tsx` (+
  presentational pieces under `src/components/catalog/` or `src/components/product/`, reusing the
  `CAPABILITY_LABELS` tag pattern from `WishlistProductCard.tsx`/`ProductInsightsPanel.tsx`).
  Pipeline: `resolveFromRawText` (FE-3) → `joinActiveKeys` → `buildCapabilities` (existing,
  unmodified) for Functional Profile (tags where `score !== null && score > 0`, no numbers shown).
  Ingredient list: comma-split raw text (same tokenization `resolve.ts` already uses) + `capabilities`
  call's `unresolvedIngredientTokens`, with total count. Reuse the existing disclaimer-footer
  component/copy. **Superseded in part by FE-14 below** — this screen no longer excludes
  `buildRoutinePosition`; the other exclusions (`buildIrritationProfile`,
  `buildSensitivityCompatibility`, `buildProductProfileFromProduct`/`FromActiveKeys`) are unchanged.

- FE-5: `WishlistEntry` store — append `WishlistEntry` to `src/types/index.ts` (shape per spec §6);
  new `src/store/wishlistStore.ts` mirroring `productsStore.ts`'s `create()`/`hydrate`/`loadJson`/
  `saveJson` pattern; new `STORAGE_KEYS.wishlistEntries` in `src/services/storage.ts`. No import of
  `productsStore`, `conflictEngine.ts`, or Catalog filter logic. `addEntry`/`removeEntry` only.
  "Add to Wishlist" (renamed 2026-08-27 from "Save to Wishlist") on FE-4 opens a minimal brand+name prompt, then calls `addEntry`. Also touches
  `App.tsx` (`hydrateStores()`'s `Promise.all` — see progress log, BLOCKER-1 fix).

- FE-6: Shared completion form — extend `src/screens/ManualProductFormScreen.tsx` with a new prefill
  mode (e.g. `explorePrefill: { rawIngredientsText, activeKeys, brand, name, category,
  wishlistEntryId }`, added to `ManualProductForm`'s params in `AppNavigator.tsx`, mutually exclusive
  with the existing `prefillCorpusProduct`/`editingProductId`/`ocrPrefill`). Asks only for missing
  brand/name/category + a front/jar photo, written to the existing single `localImageUri` slot — the
  flow's ingredients photo (if any) must never be written there (no client-side photo-type field
  exists; see Assumption 6). On save: `productsStore.addProduct` + the existing
  `submitContribution`/contribution-flow trigger (same as `AddProductScreen.tsx`'s pattern); if
  `wishlistEntryId` is set, `wishlistStore.removeEntry` fires only after save succeeds.

- FE-7: Wishlist tab rendering — file: `src/screens/CatalogScreen.tsx` (existing
  `renderWishlistItem`/Wishlist tab) + new `src/components/product/WishlistEntryCard.tsx` (sibling to,
  not shared with, `WishlistProductCard.tsx` — different shape/actions: `Delete` + `Move to
  Shelf`). Renders `wishlistStore` entries as a distinct, separately-labeled section within the
  existing "Wishlist · N" tab (Assumption 5), behind `EXPLORE_COMPOSITION_ENABLED`.

- FE-8: Feature flag — `src/constants/featureFlags.ts`: add `EXPLORE_COMPOSITION_ENABLED = false`,
  documented per this file's existing convention. Gates FE-1's card swap and FE-7's rendering.

#### 2026-08-26 decision batch (comparison matrix, skin-type caution, routine placement, entry copy)

- FE-9: Shared ingredient tokenizer — promote the comma-split-trim-filter tokenizer to a shared
  export from `src/utils/productProfile/resolve.ts` (e.g. `tokenizeIngredientsText()`), extend
  `resolve.test.ts`. `ExploreCompositionResultScreen.tsx`'s local `tokenizeRawText()` calls the shared
  export instead of reimplementing it. Resolves tech-lead's prior non-blocking WARNING now that FE-10
  needs the identical logic for a third call site.

- FE-10: Shelf-comparison logic — new `src/utils/productProfile/shelfComparison.ts` (+
  `shelfComparison.test.ts`): pure `buildShelfComparison(category, thisComposition, products)`.
  `thisComposition` is `{ functionalTagCount, ingredientCount, activeKeys }` (already computed by
  FE-4/FE-14 for the Functional Profile/ingredient list — never recomputed here). Filters `products:
  Product[]` to `p.productType === category` only, no other filter (spec §5; see the 'comparison-basis population' assumption below). Per
  matching product, reuses `resolveFromProduct` → `joinActiveKeys` → `buildCapabilities` for its
  functional-tag count, and FE-9's tokenizer on `product.fullIngredientText ?? ''` for its ingredient
  count — no new detection logic anywhere. Returns the 4 raw numbers/lists needed (this composition's
  value, the same-category average/overlap, and `sameCategoryCount`); rendering/copy (including the
  zero-items message) stays in the presentational component (FE-13), not this pure module.

- FE-11: Skin-type caution logic — new `src/utils/productProfile/skinTypeCaution.ts` (+
  `skinTypeCaution.test.ts`): pure `buildSkinTypeCaution(classFacts, skinType)`. Returns `null` when
  no present class has `activeClass.properties.exfoliating === true`,
  `activeClass.properties.photosensitizing === true`, or `(activeClass.properties.irritancy ?? 0) >=
  3` — regardless of any `barrierRepair === true` class also present (spec Story 7; see the 'flat irritancy tier' assumption below on why
  this reads that tier directly, not potency-resolved). Else returns `{
  triggeringKeys: ActiveIngredientKey[] }` naming every class that matched (not just the first).

- FE-12: Routine phase-label map — `src/constants/labels.ts`: add
  `ROUTINE_PHASE_LABELS: Record<number, string>` keyed by `LAYERING_ORDER`'s numeric value (0–13):
  `0 Makeup Removal, 1 Cleansing, 2 Exfoliation, 3 Toning, 4 Essence, 5 Ampoule / Booster, 6
  Treatment, 7 Other, 8 Spot Treatment, 9 Eye Care, 10 Mask, 11 Moisturizing, 12 Sealing / Oil, 13 Sun
  Protection`. New map, not a rename/extension of the existing `SLOT_CATEGORY_LABELS` (see the 'new phase-label map' assumption below).

- FE-13: New presentational components — `src/components/catalog/CompositionComparisonMatrix.tsx`
  (renders FE-10's output as 4 rows, or the zero-items message via `getSlotCategoryLabelPlural
  (category)` when `sameCategoryCount === 0`), `src/components/catalog/SkinTypeCautionNotice.tsx`
  (renders `null`/nothing when its prop is `null`; else one sentence naming FE-11's
  `triggeringKeys` via `ACTIVES_RULESET.classes[key].displayName` and `useProfileStore`'s
  `profile.skinType` via `SKIN_TYPE_OPTIONS`'s label — copy is `PLACEHOLDER`, spec §5),
  `src/components/catalog/RoutinePlacementCard.tsx` (one line: `ROUTINE_PHASE_LABELS[layeringOrder]`).

- FE-14: Result-screen wiring — file: `src/screens/catalog/ExploreCompositionResultScreen.tsx`. Add
  `useProductsStore((s) => s.products)` and `useProfileStore((s) => s.profile)` reads. Call
  `buildRoutinePosition(category, classFacts)` only when `category !== null` (never when `category`
  is `null` — same gate as the matrix). Render FE-13's 3 components in order: Functional profile →
  Ingredients → Skin-type caution → Comparison matrix → Routine placement → Disclaimer (see the 'result-screen order' assumption below). Correct the file's top doc-comment, which currently states this screen "never calls...
  `buildRoutinePosition`" — that line is now false and must be rewritten in place, not left stale.

- FE-15: Entry-card copy — file: `src/screens/CatalogScreen.tsx`. `Explore new` card (flag-on path
  only): title → "Explore ingredients", subtitle → "Check before you decide to put it on Your
  Shelf"; remove its `PLACEHOLDER` comment (now human-confirmed final). `Add new` card is untouched,
  including its own still-pending `PLACEHOLDER` comment (spec §10).

#### Story 9 (2026-08-27): Wishlist entry detail screen

- FE-16: `WishlistEntry.notes` field — file: `src/types/index.ts`. Add `notes?: string | null`
  (optional — already-persisted entries need no migration; absent = no note, same convention as
  `Product`'s own optional fields — see the 'optional notes field' assumption below).

- FE-17: `wishlistStore.updateEntry` action — file: `src/store/wishlistStore.ts` (+
  `wishlistStore.test.ts`). Add `updateEntry: (id: string, patch: Partial<WishlistEntry>) => void`,
  mirroring `productsStore.ts`'s existing `updateProduct(id, patch)` map-and-persist shape exactly
  (map `entries` replacing the matching id, `set()`, then `saveJson`). `WishlistEntryDetailScreen`'s
  Notes card is its first caller; the action itself is generic, not notes-only.

- FE-18: Shared insights hook — new file `src/hooks/useCompositionInsights.ts` (+ co-located
  test), mirroring the existing `useRoutineLinking.ts` hook convention (reads store state
  internally, returns computed values to the caller). Signature:
  `useCompositionInsights(rawIngredientsText: string, category: ProductType | null)`. Internally
  reads `useProductsStore((s) => s.products)` and `useProfileStore((s) => s.profile)`, then
  re-runs — with no new logic — exactly the pipeline `ExploreCompositionResultScreen.tsx` already
  inlines: `resolveFromRawText` → `tokenizeIngredientsText` → `joinActiveKeys` →
  `buildCapabilities` → capability-tag filter (`score !== null && score > 0`) →
  `buildSkinTypeCaution` → `buildShelfComparison` (only when `category !== null`) →
  `buildRoutinePosition` (only when `category !== null`). Returns `{ capabilityTags,
  resolvedActiveKeys, skinType, skinTypeCaution, shelfComparison, routinePosition }` (see the
  'reuse mechanism' assumption below).

- FE-19: Extract the two remaining insight cards — new files
  `src/components/catalog/FunctionalProfileCard.tsx` and
  `src/components/catalog/DetectedActivesCard.tsx`, lifted verbatim (same JSX, copy, and
  testIDs — including `detected-actives`) from `ExploreCompositionResultScreen.tsx`'s current
  inline `Card` blocks. Pure extraction, no visual or copy change — completes the set alongside
  the 3 cards already extracted in the prior batch (`SkinTypeCautionNotice`,
  `CompositionComparisonMatrix`, `RoutinePlacementCard`).

- FE-20: Shared insights section — new file
  `src/components/catalog/CompositionInsightsSection.tsx`. Composes, in the existing fixed order,
  `FunctionalProfileCard` → `DetectedActivesCard` → `SkinTypeCautionNotice` →
  `CompositionComparisonMatrix` (only when `shelfComparison` is non-null) → `RoutinePlacementCard`
  (only when `routinePosition` is non-null) → the disclaimer block (lifted verbatim, same
  `testID="explore-result-disclaimer"` — kept identical so the result screen's existing qa-lead
  assertion on it keeps passing unmodified). Purely presentational: takes FE-18's hook output
  (+ `skinType`) as props, no store/hook access of its own.

- FE-21: `ExploreCompositionResultScreen.tsx` refactor — same file. Replace its own inline
  `useMemo` chain with a single `useCompositionInsights(rawIngredientsText, category)` call
  (FE-18), and replace its inline Functional-profile/Detected-actives/disclaimer JSX (plus its
  existing `<SkinTypeCautionNotice>`/`<CompositionComparisonMatrix>`/`<RoutinePlacementCard>`
  calls) with one `<CompositionInsightsSection ... />` (FE-20). Non-behavior-changing: every
  existing testID/text/assertion in `tests/explore-composition/
  ExploreCompositionResultScreen.test.tsx` must keep passing unmodified — the same kind of safe
  internal promotion already done once in this task for the tokenizer (FE-9).

- FE-22: New screen — new file `src/screens/catalog/WishlistEntryDetailScreen.tsx`, registered
  in `CatalogStackParamList`/`AppNavigator.tsx` as `WishlistEntryDetail: { wishlistEntryId:
  string }` (mirrors `ProductDetail: { productId: string }`'s exact convention — an id, never the
  full entity, to avoid stale-data risk). Looks up `entry = useWishlistStore((s) =>
  s.entries).find((e) => e.id === wishlistEntryId) ?? null`; the not-found branch mirrors
  `ProductDetailScreen.tsx`'s own not-found block verbatim (`InlineAlert tone="sos"` + "Go
  Back"). Root element is `SafeAreaView` (from `react-native`), matching every other screen in
  this app including `ProductDetailScreen.tsx` and the just-fixed
  `ExploreCompositionResultScreen.tsx` (2026-08-27 real-device finding, see progress log) —
  never a plain `View`. Renders, top to bottom: `AppHeader` (title =
  `entry.name ?? 'Untitled composition'`, the same fallback `WishlistEntryCard.tsx` already
  uses) → a text-only identity block (brand
  line only when set, name, a `Badge`/`getProductTypeBadgeStatus`/`PRODUCT_TYPE_LABELS` category
  badge only when `entry.category` is set — no photo, `WishlistEntry` has no image field) →
  `CompositionInsightsSection` (FE-20, fed by FE-18's hook called with
  `entry.rawIngredientsText`/`entry.category`) → a Notes card mirroring
  `ProductDetailScreen.tsx`'s exact `Textarea` + local-state + `onBlur`-commit pattern, calling
  FE-17's `updateEntry(entry.id, { notes: ... })` instead of `updateProduct` → a footer with
  "Move to Shelf" (primary `Button`, builds the identical `explorePrefill` navigation payload
  `CatalogScreen.tsx`'s existing `handlePromoteWishlistEntry` already builds) and "Delete"
  (`variant="ghost"`, same variant the card already uses for this exact action — calls
  `removeEntry(entry.id)` then `navigation.goBack()`, no confirmation modal, same rule as the
  card).

- FE-23: Wire the card's `onCardPress` — file: `src/screens/CatalogScreen.tsx`. Replace
  `onCardPress={() => {}}` (the intentionally-inert placeholder the first-slice tech-lead review
  flagged) with `onCardPress={(e) => navigation.navigate('WishlistEntryDetail', {
  wishlistEntryId: e.id })}`, matching the exact `onCardPress={(p) =>
  navigation.navigate('ProductDetail', { productId: p.id })}` shape already used two
  render-functions above it in the same file.

- FE-24 (2026-08-27, tech-lead review follow-up, Story 2's "Ingredient count" gap): new file
  `src/utils/productProfile/ingredientSectionExtractor.ts` — pure `extractIngredientSection(text)`
  cutting raw ingredient text at the first of 47 curated Directions/Warnings/manufacturer-metadata
  marker phrases (case-insensitive, whole-phrase), gated on at least one comma of real content
  already preceding the match. Wired into `ExploreCompositionCaptureScreen.tsx`'s `goToResult` —
  applied once, before either capture path's text is stored or analyzed. Does not touch
  `ocrTextCleaner.ts`/`CameraCaptureModal.tsx` (out of scope — see spec Story 2's updated note for
  the resulting gap on Shelf-side `fullIngredientText`).

### qa-lead (required test update on existing suite, not new authoring from scratch)
- `tests/explore-composition/ExploreCompositionResultScreen.test.tsx`: the existing "never calls the
  excluded orchestrator/irritation/routine-position builders" test (currently ~lines 92-95 mock setup,
  ~251-258 assertions) asserts `buildRoutinePosition` is **never** called — this must change to two
  cases: called with exactly `(category, classFacts)` when `category` is set, never called when
  `category` is `null`. The other 4 assertions in that same test (`buildIrritationProfile`,
  `buildSensitivityCompatibility`, `buildProductProfileFromProduct`, `buildProductProfileFromActiveKeys`)
  are unaffected and must remain "not called" — this is a deliberate, human-approved reversal of one
  guardrail assertion only, documented here and in the spec §3 reversal note, not a silent test change.
  Add new describe blocks for Story 6 (matrix, incl. zero-shelf-items case), Story 7 (fires / doesn't
  fire / null-`skinType` suppression), and Story 8 (placement label + category-absent gating).

- **Story 9 (2026-08-27):** new `tests/explore-composition/WishlistEntryDetailScreen.test.tsx` —
  not-found guard, identity header (name/"Untitled composition" fallback, brand-only-when-set,
  category badge only when `category` is set), all 5 insight sections independently
  populated/empty (reusing the same fixtures as `ExploreCompositionResultScreen.test.tsx` where
  the underlying data is identical), disclaimer present, Notes add/edit/blur-persist/reopen
  round-trip, "Move to Shelf" pre-fill parity with `CatalogScreen.tsx`'s existing
  `handlePromoteWishlistEntry` plus cancel-preserves-entry, "Delete"
  no-confirmation-then-navigate-back. Also extend `tests/explore-composition/
  CatalogScreen.wishlist-entries.enabled.test.tsx` with a regression asserting `onCardPress` now
  navigates to `WishlistEntryDetail` instead of being a no-op. A light pass over
  `ExploreCompositionResultScreen.test.tsx` confirms FE-21's refactor changed no existing
  assertion (non-behavior-changing, per FE-21's own task description).

### engineer (unit tests, both scopes)
- FE-3, FE-5 get co-located `*.test.ts` per `.claude/rules/testing.md` (pure logic, no React/store
  imports for FE-3; store add/remove/isolation for FE-5).
- FE-6's new prefill mode and delete-only-after-save-success ordering get engineer-level unit
  coverage on the extracted save logic; qa-lead owns the integration/E2E layer per the standard
  pipeline split.
- FE-9, FE-10, FE-11 get co-located `*.test.ts` per `.claude/rules/testing.md` (pure logic, no
  React/store imports). `shelfComparison.test.ts` covers the category-only-filter/zero-items/
  no-secondary-filter behavior explicitly (see the 'comparison-basis population' assumption
  below). `skinTypeCaution.test.ts` covers each of
  the 3 OR-conditions independently, the loosened (no-`barrierRepair`-exception) behavior, and that
  it is not itself responsible for the null-`skinType` suppression (that's FE-13/FE-14's job, per
  the 'null skinType suppression' assumption below — the pure function only knows about resolved
  classes, not the profile).

- FE-16, FE-17 get co-located `*.test.ts` additions (`WishlistEntry.notes` round-trips through
  `wishlistStore.test.ts`'s existing add/remove coverage; `updateEntry` gets its own
  add-then-update-then-read-back case, mirroring `productsStore.ts`'s `updateProduct` coverage
  style). FE-18's `useCompositionInsights` gets a co-located test mocking `productsStore`/
  `profileStore`, asserting it is pure recomposition of the existing builders (no new
  detection/matching logic) — same convention as FE-9/FE-10/FE-11's own unit tests.

## 4. Assumptions
- Category is captured at capture time (single-tap selector). **Updated 2026-08-26:** the
  comparison-matrix and routine-placement UI, originally deferred here, are now built (FE-9..FE-14
  above) — this entry is kept only for the historical reasoning on why category capture shipped in
  the first pass at all.
  Alternative: skip category capture until that decision is confirmed.
  Reason: `buildRoutinePosition()` (the function Story 8 reuses) requires `productType` as a
  non-optional input — capturing it in the first pass avoided a future migration once the deferred UI
  was eventually confirmed, which is exactly what happened.
- **Category is now required, not optional (reversed 2026-08-27).** The chip grid also moved above
  the capture block (was below it). Neither the photo nor the paste path opens until a category is
  selected — pressing either without one shows an inline error ("Please select a category to
  continue.") and does not open the camera/paste modal; the error clears once a chip is tapped.
  Alternative: keep it optional, matching the first three slices' behavior.
  Reason: human/real-device decision — Story 6/7/8 (comparison matrix, skin-type caution's Shelf
  comparison basis is unaffected, but routine placement) already only render when `category` is
  set, so an optional category silently produced a materially thinner result screen for any capture
  where it was skipped; making it required guarantees every capture gets the full result screen.
  `WishlistEntry.category` itself stays nullable (unchanged type) since entries saved before this
  change may still have `null` — this is a capture-time UI requirement, not a retroactive data
  migration.
- **Category selection stays fully manual — no auto-suggestion from parsed composition.**
  **Closed 2026-08-27** (product decision log,
  `docs/tasks/explore ingredient/07-decision-log-category-manual.md`), no implementation change.
  Alternative considered and explicitly rejected: auto-suggesting/pre-selecting a chip from the
  parsed composition (e.g. detecting SPF via UV-filter ingredients, or Cleanser via a
  surfactant-dominant top-of-INCI signal).
  Reason: the chemical signal is only reliable for a handful of categories (SPF, loosely
  Cleanser/Oil); for most of the list (Serum vs. Essence vs. Ampoule, Cream vs. Eye Cream, Toner
  vs. Essence) the distinction is a product-positioning/texture decision composition alone cannot
  make. A confidently-wrong auto-suggested category would propagate into both the comparison
  matrix's peer group and routine placement — the same class of fabricated-precision risk already
  rejected elsewhere in this spec (% match scores, invented efficacy numbers), just at the
  category-selection layer. If revisited, a narrower SPF-only high-confidence version is the
  proposed starting point for a future pass — not implemented now.
- The reusable parser is `ingredientParser.ts`'s active-class matcher (via `productProfile/
  resolve.ts`), including its existing unresolved-token detection — not a full per-ingredient
  dictionary matcher.
  Alternative: build a full-dictionary matcher to satisfy the source brief's literal wording.
  Reason: no client-side module matches raw text against `ingredients.function` rows — that table is
  Postgres-only; `IngredientRepository` doesn't select `function` and needs network. `resolve.ts`
  already ships and unit-tests an "unresolved token" signal that fits spec §2/§3.3 directly.
- Functional Profile reuses `capabilities.ts`'s 10-key `buildCapabilities()` output, not the coarser
  3-tag `CatalogFilterTrigger`/US-20 badge set the source brief named (component since renamed from
  `CatalogFilterHeader`).
  Alternative: use the named 3-tag set.
  Reason: `capabilities.ts` is newer, more precise, and already reused by `WishlistProductCard.tsx`
  for the same "plain tags, no fabricated score" purpose in the same tab.
- The shared completion form is a new prefill mode on `ManualProductFormScreen.tsx`.
  Alternative: a new standalone screen, or reuse `AddProductScreen.tsx`.
  Reason: `AddProductScreen.tsx` documents itself as the only from-scratch entry point;
  `ManualProductFormScreen.tsx` already completes partial identity from mutually-exclusive prefill
  sources — architecturally identical to this need.
- `WishlistEntry` rows render as a distinct section inside the existing Wishlist tab, not a new
  screen or a merged list, shipped behind a default-off flag.
  Alternative: new standalone screen; or merge into one list/card type with existing wishlist
  products.
  Reason: the source brief never accounts for the pre-existing tab/`status:'wishlist'` mechanism
  (currently produced by the `Explore new` button this task repoints) — a planner-reconnaissance
  finding. One navigable location avoids an orphaned surface; keeping card types distinct avoids
  conflating a fully-identified product with a possibly brand/name-less entry. The flag makes the
  choice reversible without a second code change.
- The flow's ingredients photo is never written to `localImageUri`; only the front/jar photo is.
  Alternative: treat any captured photo as satisfying the completion form's photo step.
  Reason: the client has one untyped photo slot per product (no `product_images.type` discriminator
  exists outside the Postgres schema) — conflating the two is exactly the confusion spec §4.2 warns
  against; the suggested `WishlistEntry` shape already has no image field.

#### 2026-08-26 decision batch
- Shelf-comparison rendering: functional-breadth/ingredient-count show this composition's value
  alongside the same-category Shelf average (1 decimal); active tags show this composition's tags
  alongside the count of same-category Shelf items sharing at least one tag; category-relative signal
  shows the category name alongside the same-category Shelf item count.
  Alternative: a min–max range instead of an average; or a fully expanded per-tag overlap breakdown.
  Reason: the human flagged this exact rendering choice as unspecified and asked for a sensible pick,
  not an open question — average/count are the simplest honest single numbers computable directly
  from `productsStore`, with no invented percentile/scoring, matching §3.1's "no verdict" framing.
- Comparison-basis population is category-match only; a same-category Shelf product with no recorded
  `fullIngredientText`/`activeTags` legitimately contributes 0 to the two numeric averages rather than
  being excluded from the population.
  Alternative: exclude such products from the averages (and from the "N items" count) so they don't
  silently pull the average down.
  Reason: the human's own wording — "filtered to the same category... nothing else" — rules out a
  second, unrequested filter; a product with genuinely no recorded ingredients does have a real (zero)
  value for these two counts, so including it isn't fabrication.
- Skin-type caution reads the flat `properties.irritancy` tier, not potency-resolved via
  `resolveIrritancy(properties, potency)` (the helper `irritation.ts`/`isStrongActive` use elsewhere).
  Alternative: call `resolveIrritancy()` for consistency with every other irritancy consumer.
  Reason: the human's own confirmed 500-composition coverage check (15.2% vs. 6.8%) that selected this
  exact logic was run against the flat tier; `potencyByKey` here is a best-effort signal that may be
  absent, so anchoring the trigger to the always-present flat tier keeps the shipped fire rate
  matching the number that was actually measured.
- Null `profile.skinType` suppresses the caution block entirely, even when the exfoliating/
  photosensitizing/irritancy trigger is otherwise met.
  Alternative: render a skin-type-agnostic sentence naming only the active(s).
  Reason: the spec requires "referencing the user's own stored skin type" as part of what makes this
  "a real sentence, not a generic label" — dropping that reference would produce exactly the vague
  copy this feature exists to avoid; treating unset skin type as its own suppression reason (like the
  ~85% non-firing case) fits the project's no-fabrication convention better than writing around a
  missing value.
- Result-screen order: functional profile → ingredients → skin-type caution → comparison matrix →
  routine placement → disclaimer.
  Alternative: matrix before caution; or caution merged adjacent to the matrix.
  Reason: the human's placement instruction for the caution signal ("near the functional-profile/
  ingredient-list area... structurally and visually separate from the matrix") is satisfied by
  placing it directly after ingredients and before the matrix, and no other ordering was discussed.
- Routine-placement UI scope is the phase label only; `buildRoutinePosition`'s `eligiblePeriods`/
  `preferredPeriod`/`rinseOff`/`confidence`/`caveat` are computed (the function isn't partially
  called) but not surfaced.
  Alternative: also show AM/PM eligibility and rinse-off status.
  Reason: the decision batch only specified a phase-label mapping keyed to `layeringOrder`; the other
  fields are an unrequested UI scope-add. `layeringOrder` is guaranteed non-null whenever `category`
  is set (`LAYERING_ORDER` is total over `ProductType`), so no confidence-branching is needed here.
- `ROUTINE_PHASE_LABELS` is a new map, not a rename/reuse of the existing
  `SLOT_CATEGORY_LABELS: Record<ProductType, string>` (which already groups the same layering slots).
  Alternative: extend/rename `SLOT_CATEGORY_LABELS`.
  Reason: the two serve different call sites and casing conventions — `SLOT_CATEGORY_LABELS` is a
  lowercase product-category noun already used in existing duplicate-slot-warning copy elsewhere; the
  human specified new Title-Case, gerund/phase-style strings keyed by `layeringOrder`'s number.
  Reusing/renaming the existing map risks silently changing wording an unrelated call site didn't ask
  to change.
- FE-9 promotes the shared tokenizer instead of adding a third private copy inside `shelfComparison.ts`.
  Alternative: leave the comma-split-trim-filter logic duplicated a third time, as tech-lead's
  original review flagged as low-risk-but-worth-watching.
  Reason: a third independent copy meaningfully raises the drift risk the original review already
  flagged; since `shelfComparison.ts` is new code in this same pass anyway, fixing it now costs
  nothing extra.

#### Story 9 decision batch (2026-08-27)
- **Reuse mechanism**: extract a `useCompositionInsights` hook (`src/hooks/`) plus a
  `CompositionInsightsSection` presentational wrapper, and refactor
  `ExploreCompositionResultScreen.tsx` to call both instead of its own inline logic.
  Alternative: leave `ExploreCompositionResultScreen.tsx` untouched and duplicate its `useMemo`
  chain and JSX inside the new screen.
  Reason: duplicating the chain would be exactly the "second, parallel implementation of the
  same insight logic" this task was explicitly told not to build. `src/hooks/` already exists
  with a precedent for this exact shape (`useRoutineLinking.ts`: store reads + pure-builder
  composition, returned for a screen to render) — extending it fits this codebase's own
  layering better than either duplication or a third, novel architecture.
- **Optional notes field**: `WishlistEntry.notes` is `notes?: string | null`, not a required
  field.
  Alternative: required `notes: string | null`, matching `Product.notes`'s own shape.
  Reason: `WishlistEntry` records already exist on disk from three prior accepted slices; an
  optional field needs no migration step and is read as "absent = no note" everywhere, the same
  backward-compatible convention already used for every other field added to an existing entity
  in this codebase (e.g. `Product.isHidden?`, `Product.spfValue?`).
- **Notes editing pattern**: mirrors `ProductDetailScreen.tsx`'s `Textarea` + local-state +
  onBlur-commit pattern.
  Alternative: `ProcedureDetailScreen.tsx`'s pattern (one screen-level "Save" button committing
  all edited fields together); or `RoutineStep.stepNote`'s pattern.
  Reason: `WishlistEntryDetailScreen` has exactly one editable field, the same situation
  `ProductDetailScreen` is in (its Notes card is the only inline-editable field there too);
  `ProcedureDetailScreen`'s explicit-Save button exists because it also commits an edited date
  field in the same action, which doesn't apply here. `RoutineStep.stepNote` was checked
  directly (grepped every reference in `src/`) and has no manual-editing UI anywhere in the
  app — it is set only by the routine engine at plan-generation time — so it offers no
  competing interaction precedent to reuse or avoid.
- **Card actions stay additive**: both "Move to Shelf" and "Delete" are added to the new detail
  screen; `WishlistEntryCard`'s own existing inline versions are unchanged, not removed.
  Alternative: remove these actions from the card once the detail screen exists, mirroring
  `ProductDetailScreen`, where a `Product`'s mutating actions live only behind the detail screen
  (via `ProductActionSheet`), never on `ProductShelfCard` itself.
  Reason: removing the card's own actions is extra, riskier scope this task didn't ask for, and
  would touch already-shipped, tech-lead-accepted `WishlistEntryCard` behavior; keeping the
  card's fast path (particularly its explicit no-confirmation Delete) while also making both
  actions reachable from the detail screen gives the same "also reachable from the detail
  screen" property `ProductDetailScreen` has, without removing anything.
- **Footer buttons, not an action sheet**: the detail screen's "Move to Shelf"/"Delete" render
  as two plain footer buttons, not a `ProductActionSheet`-style overflow menu.
  Alternative: an overflow "···" menu, mirroring `ProductDetailScreen`'s header
  `more-vertical` → `ProductActionSheet`.
  Reason: `ProductActionSheet`'s props are `Product`-shaped (`onEdit`/`onDelete`/
  `onToggleHidden`) and not reusable as-is for a `WishlistEntry`'s 2-action set; with only 2
  actions, a footer button row matches the pattern already used twice in this exact flow
  (`ExploreCompositionResultScreen.tsx`'s own footer, `ProductDetailScreen.tsx`'s own footer)
  rather than introducing a new sheet component for a two-item menu.
- **Notes card placement**: rendered last, directly above the footer — after
  `CompositionInsightsSection`, not before it.
  Alternative: Notes first, directly under the identity header, ahead of the auto-derived
  insight sections.
  Reason: mirrors `ProductDetailScreen.tsx`'s own section order exactly (its Notes card is also
  last, immediately above its footer) — the one existing precedent for "where a manual note
  sits relative to auto-derived content" in this app, not a new ordering invented for this
  screen.
- **Identity header has no photo**: text-only (brand/name/category badge), no `ProductThumbnail`
  or placeholder image box.
  Alternative: reuse `ProductThumbnail` with its existing placeholder-image fallback, for visual
  parity with `ProductDetailScreen`'s header.
  Reason: `WishlistEntry` has no image field at all by design (see this doc's existing
  Assumption on `localImageUri` — the flow's ingredients photo is deliberately never attached to
  an entry); rendering an empty photo placeholder would visually suggest a photo could exist
  here when the data model guarantees it structurally never does.
- **No navigation-stack fix needed for "Move to Shelf" from the new screen**: FE-22 opens
  `ManualProductForm` directly from `WishlistEntryDetailScreen`, one level deeper in the stack
  than today's card-driven path (`Catalog → WishlistEntryDetail → ManualProductForm` vs. today's
  `Catalog → ManualProductForm`).
  Alternative: add an explicit re-routing step (e.g. `popToTop`) to account for the extra stack
  depth on both the success and cancel paths.
  Reason: verified directly in `ManualProductFormScreen.tsx` that a successful save's
  `finishSave()` calls `navigation.navigate('Catalog', { toast })` — not `goBack()` — which
  already unwinds the whole stack back to `Catalog` regardless of how many screens are
  underneath it; a cancelled form already just uses the default back action, correctly
  returning to `WishlistEntryDetailScreen` with the entry untouched (spec Story 5 AC2,
  unchanged). No code beyond FE-22's own navigation call is required.

## 5. Open Questions
No open questions blocking this batch. Comparison-matrix parameters and entry-card subtitle copy
(for the `Explore new` card) are RESOLVED — see spec §10. The one still-open item from the first
pass, Wishlist-tab-presentation (Assumption 5 above), remains open, owned by product + design;
`EXPLORE_COMPOSITION_ENABLED` stays default-off pending that confirmation, unrelated to this batch's
readiness to implement. Story 9 (2026-08-27) introduces no open questions of its own — every
judgment call it required is captured as an assumption above.
