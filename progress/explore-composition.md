## REVIEW SUMMARY (saved 2026-08-27, before context compaction — read this first)

**Branch:** `feature/explore-composition`, branched from `origin/dev`. Nothing committed yet —
everything below is uncommitted working-tree state. `git status --short` at save time showed 15
modified + ~24 new/untracked files (production code, tests, docs) plus one unrelated modified
file (`.claude/agents/engineer.md` — a session config fix, see its own Log entry, unrelated to
this feature).

**Overall state:** four slices, all independently tech-lead-reviewed and `PR_REVIEW`/ACCEPTED
(details in the chronological Log below), plus a long tail of same-day human-driven real-device
UI/UX fixes applied directly after each slice. `npx tsc --noEmit` is clean and
`npx jest tests/explore-composition` (+ the co-located unit tests for
`resolve`/`shelfComparison`/`skinTypeCaution`/`wishlistStore`/`useCompositionInsights`/
`ProductRepository`/`brandLookup`) is fully green as of the last change. **Correction (2026-08-27
tech-lead review):** a full `npm test` run actually shows 10 failing suites, not 1 as previously
noted here — all 10 confirmed byte-identical to `origin/dev` (stale partial `jest.mock`s for
`@/constants/tokens`/`@/constants/labels` missing recently-added exports like `palette.goldenTint`,
`shadow.sm`, `getProductTypeBadgeStatus`). Pre-existing base-branch debt, unrelated to this feature,
but worth its own cleanup task since it's grown past the single suite this note used to claim.

**RESOLVED 2026-08-27:** `src/constants/featureFlags.ts`'s `EXPLORE_COMPOSITION_ENABLED` was
temporarily `true` for the user's own real-device Expo Go testing session, marked TEMP/revert
inline. The user has now explicitly decided to ship it **ON** — "не вижу смысла выключать флаг.
фича уже более-менее работает" (no reason to turn it off, the feature already works reasonably
well). The flag's own doc comment was rewritten to record this as a real decision (2026-08-27,
post-testing) rather than leftover test scaffolding. No longer an action item before commit.

**Still genuinely open (not silently decided, needs a product/design owner):**
- Wishlist-tab presentation (spec §10) — how `WishlistEntry` rows should relate to the
  pre-existing fully-identified-product Wishlist tab. Shipped with a reversible default
  (distinct section, same tab) behind the flag.
- ~~Comparison-matrix "Ingredient count" parameter still counts every raw comma-token, including
  any non-ingredient OCR noise~~ — **RESOLVED 2026-08-27**, see the dated Log entry below and
  spec Story 2's updated follow-up note. New `ingredientSectionExtractor.ts`, wired into the
  capture screen's `goToResult`.

**Non-blocking, flagged for future cleanup (not required before merge):**
- `WishlistEntryDetailScreen.tsx` calls a hook (`useCompositionInsights`) after its own
  not-found early-return — a Rules-of-Hooks issue, but it faithfully mirrors an identical
  pre-existing pattern already in `ProductDetailScreen.tsx`. Low practical risk; see the
  fourth-slice tech-lead review entry below for full reasoning.

**Where to look for more:**
- `docs/specs/explore-composition.md` / `docs/tech-design/explore-composition.md` — living spec
  and tech design, updated after every decision (search for "2026-08-27" for today's changes).
- `progress/explore-composition-handoff.json` — structured handoff state, one summary block per
  agent-phase-transition.
- The chronological `## Log` below this point — full detail on every slice, every real-device fix,
  every judgment call and why it was made, in the order it happened.

**Unrelated, still pending, from before this task started:** the user's own prior
`feature/ocr-improvement` work is stashed (`git stash list` → `stash@{0}`,
"wip: ocr-improvement before starting explore-composition task") — untouched, not part of this
task, needs the user's own attention whenever they return to that branch.

---

Status: PR_REVIEW — fourth slice (Story 9: every saved `WishlistEntry` gets its own detail
screen — `WishlistEntryDetailScreen`, reusing the result screen's insight sections via a new
shared hook/component, plus a new notes field, plus Move-to-Shelf/Delete actions also reachable
from the detail screen). Spec + tech design written by planner 2026-08-27; FE-16..FE-23
implemented by engineer 2026-08-27, tech-lead ACCEPTED (one non-blocking WARNING noted). The
first, second, and third slices' `PR_REVIEW` / tech-lead `ACCEPT` verdicts (below), and every
small human-applied direct fix logged after them, stand unchanged — this status line tracks the
FOURTH slice's own lifecycle (QA → Engineer → Review), not a reopening or invalidation of
anything earlier.
Tech Design: docs/tech-design/explore-composition.md
Code:
- New: src/screens/catalog/ExploreCompositionCaptureScreen.tsx (FE-2)
- New: src/screens/catalog/ExploreCompositionResultScreen.tsx (FE-4)
- New: src/store/wishlistStore.ts + src/store/wishlistStore.test.ts (FE-5)
- New: src/components/product/WishlistEntryCard.tsx (FE-7)
- Modified: src/constants/featureFlags.ts (FE-8 — EXPLORE_COMPOSITION_ENABLED, default off)
- Modified: src/types/index.ts (WishlistEntry, FE-5)
- Modified: src/services/storage.ts (STORAGE_KEYS.wishlistEntries, FE-5)
- Modified: src/utils/productProfile/resolve.ts + resolve.test.ts (resolveFromRawText, FE-3)
- Modified: src/navigation/AppNavigator.tsx (ExploreCompositionCapture/Result routes,
  ManualProductForm's explorePrefill param)
- Modified: src/screens/CatalogScreen.tsx (FE-1 entry cards, FE-7 Wishlist-tab section, both
  behind EXPLORE_COMPOSITION_ENABLED)
- Modified: src/screens/ManualProductFormScreen.tsx (FE-6 explorePrefill mode + Story 5
  remove-after-save-success ordering)
- Test-authoring fixes (mechanical, not assertion changes — see Log below):
  tests/explore-composition/CatalogScreen.entry-cards.{enabled,disabled}.test.tsx,
  tests/explore-composition/CatalogScreen.wishlist-entries.{enabled,disabled}.test.tsx,
  tests/explore-composition/ExploreCompositionResultScreen.test.tsx
- Modified (BLOCKER-1 fix): App.tsx (added useWishlistStore.getState().hydrate()
  to hydrateStores()'s Promise.all, same pattern as the other 6 stores)
- Modified (BLOCKER-2 fix): src/screens/ManualProductFormScreen.tsx (explorePrefill
  branch now calls setBrand/setName when present, matching ocrPrefill's pattern)
- Modified (BLOCKER-2 coverage gap): tests/explore-composition/
  ManualProductFormScreen.explore-prefill.test.tsx (new Story 5 AC1 describe
  block asserting non-null brand/name actually pre-fill the form)
- **Second slice (FE-9..FE-15, comparison matrix / skin-type caution / routine placement /
  entry-card copy):**
  - New: src/utils/productProfile/shelfComparison.ts + shelfComparison.test.ts (FE-10)
  - New: src/utils/productProfile/skinTypeCaution.ts + skinTypeCaution.test.ts (FE-11)
  - New: src/components/catalog/CompositionComparisonMatrix.tsx (FE-13)
  - New: src/components/catalog/SkinTypeCautionNotice.tsx (FE-13)
  - New: src/components/catalog/RoutinePlacementCard.tsx (FE-13)
  - Modified: src/utils/productProfile/resolve.ts + resolve.test.ts (FE-9 — promoted shared
    `tokenizeIngredientsText()` export, reused by `findUnresolvedTokens`)
  - Modified: src/constants/labels.ts (FE-12 — `ROUTINE_PHASE_LABELS`, 14 entries)
  - Modified: src/screens/catalog/ExploreCompositionResultScreen.tsx (FE-14 — wired
    useProductsStore/useProfileStore, calls `buildRoutinePosition` when `category` is set,
    renders the 3 new sections in spec §5's order, corrected the stale top-of-file doc-comment)
  - Modified: src/screens/CatalogScreen.tsx (FE-15 — `Explore new` card's title/subtitle
    finalized; `Add new` untouched)
- **Second-slice tech-lead-review fix** (shelf-comparison average denominator, see Log):
  - Modified: src/utils/productProfile/shelfComparison.ts (new `sameCategoryWithDataCount`
    field; averages now divide only over items with recorded ingredient data)
  - Modified: src/utils/productProfile/shelfComparison.test.ts (rewrote the outdated
    "contributes 0" test to assert the corrected behavior; added a no-data-population case)
  - Modified: src/components/catalog/CompositionComparisonMatrix.tsx (averages now show
    data-coverage copy; "no data" state no longer reads as a real zero score)

- **Fourth slice (Story 9, FE-16..FE-23 — WishlistEntryDetailScreen):**
  - New: src/hooks/useCompositionInsights.ts + useCompositionInsights.test.ts (FE-18)
  - New: src/components/catalog/FunctionalProfileCard.tsx (FE-19, extracted verbatim)
  - New: src/components/catalog/DetectedActivesCard.tsx (FE-19, extracted verbatim)
  - New: src/components/catalog/CompositionInsightsSection.tsx (FE-20)
  - New: src/screens/catalog/WishlistEntryDetailScreen.tsx (FE-22)
  - Modified: src/types/index.ts (WishlistEntry.notes?: string | null, FE-16)
  - Modified: src/store/wishlistStore.ts + wishlistStore.test.ts (updateEntry action, FE-17)
  - Modified: src/screens/catalog/ExploreCompositionResultScreen.tsx (FE-21 — non-behavior-
    changing refactor onto useCompositionInsights + CompositionInsightsSection)
  - Modified: src/navigation/AppNavigator.tsx (WishlistEntryDetail: { wishlistEntryId } route
    + screen registration, FE-22)
  - Modified: src/screens/CatalogScreen.tsx (FE-23 — WishlistEntryCard's onCardPress now
    navigates to WishlistEntryDetail instead of a no-op)

- **Third slice (capture-screen visual hierarchy, 06):**
  - Modified (qa-lead, pre-implementation): tests/explore-composition/ExploreCompositionCaptureScreen.test.tsx
    — rewritten for the new primary-button ("Photograph the ingredient list") + secondary text-link
    ("Enter / paste text") hierarchy; production code (ExploreCompositionCaptureScreen.tsx) not yet
    touched, per the standard qa-lead-before-engineer order.
  - Modified (engineer): src/screens/catalog/ExploreCompositionCaptureScreen.tsx — replaced the
    "Capture" section header + two full-width `optionCard`/`actionRow` Pressables (icon-wrap,
    title, subtitle, chevron each) with a centered camera-icon circle (reusing the same
    `camera`/`palette.plum` icon), a primary `Button` ("Photograph the ingredient list",
    `variant="primary"`, same `onPress={() => setCameraVisible(true)}`), and a secondary
    text-link `Button` ("Enter / paste text", `variant="textActive"` — confirmed correct per
    the qa-lead-flagged judgment call, matching `CaptureFlowScreen.tsx`'s `PromptStep`
    precedent), same `onPress={() => setPasteVisible(true)}`. Removed the now-unused
    `actionRow`/`actionRowPressed`/`optionCard`/`optionIconWrap`/`actionContent`/`actionTitle`/
    `actionSubtitle` styles and the `Pressable`/`shadow` imports (no longer referenced); added
    `captureBlock`/`captureIconWrap` styles following this file's existing token conventions.
    `divider` kept — still separates the new capture block from the unaffected
    `Category (optional)` chip-grid section. `CameraCaptureModal`, the paste `Modal`,
    `handleCapture`, `handleParsePress`, `toggleCategory`, and navigation are unchanged
    (render-tree/JSX change only, per 06's scope). Also corrected the screen's stale top-of-file
    doc comment, which described photo/paste as an "equal, explicit choice" — now describes the
    primary/secondary hierarchy and cites 06 as the supersession.
  - Verified green: `npx tsc --noEmit` clean.
    `npx jest tests/explore-composition/ExploreCompositionCaptureScreen.test.tsx`: 9/9 tests green
    (6 previously-failing hierarchy tests now pass, 3 previously-passing tests unaffected).
    `npx jest tests/explore-composition src/utils/productProfile/resolve.test.ts
    src/utils/productProfile/shelfComparison.test.ts src/utils/productProfile/skinTypeCaution.test.ts
    src/store/wishlistStore.test.ts`: 12/12 suites, 120/120 tests green (118 previous + 2 new,
    from the rewritten test file's net test-count change) — zero regressions elsewhere.
  - Guardrails respected: no edits to `conflictEngine.ts`, `search-fix/`, `splitLabelText()`,
    `brandCorrection.ts`, `ProductRepository.search()`, `DeleteProductModal`, or any test file
    (test assertions untouched, per instruction — only the component was changed to satisfy them).
  Ready for tech-lead review.

## Карточка задачи
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [x] QA tests (qa-lead)
- [x] Implementation (engineer)
- [x] Architecture review (tech-lead)

## Log

- 2026-08-26 (planner): Spec + tech design written from the finalized source brief
  (`docs/tasks/00-explore-composition-spec.md`). Step 0 reconnaissance findings:
  - Entry points: the "two buttons" are `CatalogScreen.tsx`'s `entryPointRow` — `Add new`
    (→ `AddProductHub`, unchanged) and `Explore new` (→ today's brand-OCR `CaptureFlow` with
    `initialStatus: 'wishlist'` — this is the button being retargeted to the new flow, not
    anything inside `AddProductHubScreen.tsx`).
  - OCR pipeline: `CameraCaptureModal mode="inci"` already exists, already bypasses
    `splitLabelText()`/`brandCorrection.ts` entirely (those only run in `mode="label"`), and
    already produces cleaned raw INCI text via `ocrTextCleaner.ts`. Zero OCR/camera changes needed.
  - INCI parser: the source brief's assumed "raw INCI string → matched `ingredients` rows
    (function[]/active_key/position)" parser does not exist client-side — `product_ingredients`/
    `ingredients.function` are Postgres-only (db-setup-guide.md), and `IngredientRepository`
    doesn't select `function` or run offline. The real, already-shipped, already-tested reusable
    piece is `productProfile/resolve.ts` (wraps `ingredientParser.ts`), which already produces
    `unresolvedIngredientTokens` — reused via a new thin `resolveFromRawText()` export instead of
    a second parser.
  - Discovered (not in source brief): `CatalogScreen.tsx` already has a shipped "Wishlist · N" tab
    of fully-identified `catalogStore` products (`status: 'wishlist'`, via `WishlistProductCard.tsx`,
    already using `buildProductProfileFromProduct`/`CAPABILITY_LABELS`). The new, separate
    `WishlistEntry` store will present alongside this, not merged — see tech design Assumption 5.
    Flagged to product/design, shipped behind `EXPLORE_COMPOSITION_ENABLED` (default off).
  - Minor naming corrections vs. the source brief: `CatalogFilterHeader` is actually
    `CatalogFilterTrigger.tsx`; `catalogStore` is actually `productsStore.ts`.
  - Category-capture decision: adopted brief's own proposed default (single-tap selector at
    capture time) since `buildRoutinePosition()` hard-requires `productType` — but the
    comparison-matrix/routine-placement UI itself is deferred, not built, since the 5 parameters
    are unconfirmed anywhere in the repo (verified by search).
  - Shared completion form: designed as a new prefill mode on `ManualProductFormScreen.tsx`
    (already handles mutually-exclusive partial-identity sources), not `AddProductScreen.tsx`
    (whose own docstring says it's the only from-scratch entry point).
  - Three items remain flagged to product/design with named owners, not silently decided:
    comparison-matrix parameters, entry-card subtitle copy, Wishlist-tab presentation. See spec §10.
  - Guardrails respected: no edits made to `conflictEngine.ts`, `search-fix/`, `splitLabelText()`,
    `brandCorrection.ts`, `ProductRepository.search()`, or `DeleteProductModal`.

- 2026-08-26 (qa-lead): Wrote the integration/component test suite in
  `tests/explore-composition/` BEFORE any FE-1..FE-8 production code exists,
  per the standard qa-lead-before-engineer lifecycle. 9 files:
  `fixtures.ts`, `CatalogScreen.entry-cards.enabled/disabled.test.tsx` (FE-1/
  FE-8 flag gating, "Add new" unchanged, "Explore new" retargeted),
  `ExploreCompositionCaptureScreen.test.tsx` (FE-2: equal photo/paste choice,
  no brand/name field, immediate persistence before navigation, optional
  category), `ExploreCompositionResultScreen.test.tsx` (FE-3/FE-4: only the
  spec'd sections render, all 7 explicitly-excluded sections asserted absent,
  Save-to-Wishlist isolation from productsStore/conflictEngine/contribution,
  Put-on-Shelf handoff), `ManualProductFormScreen.explore-prefill.test.tsx`
  (FE-6: new prefill mode, asks only missing fields, never reuses the
  ingredients photo, unconditional share like AddProductScreen.tsx, Wishlist
  entry removed only after a successful save — never before, never on
  cancel), `WishlistEntryCard.test.tsx` + `CatalogScreen.wishlist-entries.
  enabled/disabled.test.tsx` (FE-7: distinct section from the pre-existing
  Wishlist tab per Assumption 5, delete has no confirmation and never reuses
  `DeleteProductModal`, promote wires to the shared completion form).
  Verified red-but-correct: `npx tsc --noEmit` shows only the 3 expected
  "cannot find module" errors for the not-yet-built screens/component;
  `npx jest tests/explore-composition` fails all 8 suites purely on
  module resolution for `wishlistStore.ts`/`WishlistEntryCard.tsx` (FE-5/
  FE-7), the same documented, accepted failure mode as
  `tests/inci-attribution-highlighting/DetectedActiveBadgeWiring.test.tsx`
  (this project's `@/*` jest moduleNameMapper can't resolve any mock —
  real or virtual — for a path with no file on disk yet).
  Judgment calls made (flagged, not silently invented — engineer/tech-lead
  should confirm or override):
  - Capture screen navigates straight to the result screen on either
    capture method completing (no intermediate "Continue" step) — satisfies
    "persisted before any further navigation" trivially and keeps capture to
    "one short screen" per spec Goals. Paste's submit control is literally
    "Parse ingredients", copied from `IngredientsSection.tsx` since FE-2 is
    speced to mirror it.
  - Result screen route params: `{ rawIngredientsText: string; category:
    ProductType | null }` — not given verbatim anywhere in the tech design.
  - `WishlistEntryCard` props mirror `WishlistProductCardProps`'s shape
    (`entry`, `onCardPress`, `onPromote`, `onDelete`) — FE-7 only says
    "sibling to, not shared with" `WishlistProductCard`.
  - `explorePrefill`'s save path is unconditional-share (mirrors the
    existing `prefillCorpusProduct` branch and `AddProductScreen.tsx`), no
    contribution-consent modal — per FE-6 saying "same as
    AddProductScreen.tsx's pattern".
  - No existing shared "disclaimer footer" component was found anywhere in
    `src/` (grepped for disclaimer/dermatologist/educational-purposes
    copy) despite FE-4 saying to reuse one — the result-screen test only
    asserts a `testID="explore-result-disclaimer"` footer exists, not any
    specific copy. Flagged for engineer: either extract a shared component
    or confirm new copy with product.
  - **Flagged, not resolved**: spec Story 3/4/5 ACs and tech design FE-7 both
    give the Wishlist-entry promote action's label verbatim as "Поставить
    на полку" (Russian), which conflicts with CLAUDE.md's English-only UI
    rule. `WishlistEntryCard.test.tsx` asserts the literal documented string
    (not a guessed English replacement) so this surfaces at implementation/
    review time rather than being silently resolved either way — needs a
    product/tech-lead decision before engineer builds FE-7.
  No unit tests written for pure logic (`resolveFromRawText`, wishlistStore
  add/remove/isolation) — those stay engineer's co-located `*.test.ts`
  responsibility per the tech design's own task split (§3).

- 2026-08-26 (user decision): promote-action label resolved as **"Move to Shelf"**
  (over "Put on Shelf", to distinguish it from the result-screen's "Put on My Shelf").
  Updated `docs/specs/explore-composition.md`, `docs/tech-design/explore-composition.md`,
  and the qa-lead test suite (`WishlistEntryCard.test.tsx`,
  `CatalogScreen.wishlist-entries.enabled.test.tsx`) to use the English label throughout.
  Item closed — engineer can proceed on FE-7 without further clarification.

- 2026-08-26 (engineer): Implemented FE-1..FE-8 exactly per the approved plan. All 8
  tests/explore-composition/ suites green (83 tests), plus new co-located unit tests for
  `resolveFromRawText` (src/utils/productProfile/resolve.test.ts) and `wishlistStore`
  (src/store/wishlistStore.test.ts). `npx tsc --noEmit` clean.
  - Deviation from tech design, justified here per architecture-review.md §6: FE-7's
    `WishlistEntryCard` "Move to Shelf" implemented directly (not "Поставить на полку") —
    this was already resolved by the prior user-decision log entry above, not a new
    deviation; noting it here only because the tech design's own FE-7 task-list prose
    (docs/tech-design/explore-composition.md line ~90-91) still carried the stale Russian
    string even after that decision — corrected in the doc-cleanup sweep below.
  - Found and fixed 3 pre-existing bugs in the qa-lead's test files (mechanical, no
    assertion/expectation was changed):
    1. `CatalogScreen.entry-cards.{enabled,disabled}.test.tsx` and
       `CatalogScreen.wishlist-entries.{enabled,disabled}.test.tsx`: the `@/constants/tokens`
       mock omitted `shadow`, which crashes on import (`ProductShelfCard.tsx` does
       `...shadow.sm`, always transitively imported by `CatalogScreen.tsx`, unrelated to this
       feature) — added `shadow: new Proxy({}, { get: () => ({}) })`, the same pattern already
       used in `tests/shelf-filtering/PaoChip.integration.test.tsx`.
    2. `ExploreCompositionResultScreen.test.tsx`: the `resolveFromRawText` mock's backing
       variable was named `resolveFromRawTextMock` (suffix, not prefix) — Jest's
       out-of-scope-variable guard for `jest.mock()` factories only allows names *prefixed*
       with `mock` (case-insensitive), so the suite failed to run at all. Renamed to
       `mockResolveFromRawText` throughout (matches this same file's own
       `mockAddEntry`/`mockAddProduct`/`mockSubmitContribution` convention).
    3. My own `resolve.test.ts` addition had one wrong expectation ("Aqua" doesn't resolve to
       a known class, so it's an unresolved token too, same as `resolveFromProduct`'s existing
       precedent test) — fixed before treating the file as green.
  - Confirmed no regressions: `git stash` (tracked changes only) reproduces the exact same
    10 pre-existing failing suites outside `tests/explore-composition/`
    (tests/product-shelf-card/ProductShelfCard.test.tsx,
    tests/catalog/{catalog-screen,catalog-screen-hide-toggle.integration,product-detail,
    add-product-hub,product-shelf-card-hidden}.test.tsx,
    tests/routines/weekly-plan-view-hidden-filter.test.tsx,
    tests/shelf-filtering/PaoChip.integration.test.tsx,
    tests/product-images/RoutineCalendarView.test.tsx,
    tests/inci-attribution-highlighting/DetectedActiveBadgeWiring.test.tsx) — these are
    unrelated to this task (incomplete/stale token mocks and other pre-existing issues on
    `main`/`dev`), out of scope, and untouched.
  - Guardrails respected: no new call sites added to `conflictEngine.ts` (verified by the
    result-screen test's spy assertions); `search-fix/` untouched; `splitLabelText()`/
    `brandCorrection.ts` never invoked from this flow; `ProductRepository.search()` never
    invoked from the new capture/result screens; `DeleteProductModal` never reused for
    `WishlistEntry` deletion; `Add new`'s existing routing/OCR/corpus logic unchanged in
    both flag states (regression-tested by the disabled-flag suites).
  Ready for tech-lead review.

- 2026-08-26 (tech-lead): **BLOCKED.** Independently re-verified `npx tsc --noEmit` (clean)
  and the full suite (`tests/explore-composition/` + `resolve.test.ts` + `wishlistStore.test.ts`
  — 10/10 suites, 83/83 tests green) — engineer's report was accurate on both counts. Ran the
  full fidelity/layer-separation/duplication/guardrail/quality-signal checklist from
  `.claude/rules/architecture-review.md` against every new/modified file. Guardrails confirmed
  respected (no `conflictEngine`/`search-fix`/`splitLabelText`/`brandCorrection`/
  `ProductRepository.search` call sites, `DeleteProductModal` not reused for `WishlistEntry`
  deletion — verified by grep, not just trusted from the engineer log). No hardcoded colors,
  no Cyrillic in any shipped file, `WishlistEntry` defined exactly once, no TODO/FIXME/console.log.
  Two BLOCKER findings, both outside what qa-lead's mocked-store component tests could catch:
  1. **`src/store/wishlistStore.ts`'s `hydrate()` is never called anywhere in the app.**
     `App.tsx`'s `hydrateStores()` calls `.hydrate()` on all six other persisted stores
     (profile/products/routines/procedures/settings/tracking) via `Promise.all(...)` at
     startup, but `wishlistStore` was not added to that list — confirmed by grep across the
     whole repo, only call site is the store's own test. `addEntry`/`removeEntry` do persist
     to `AsyncStorage` correctly, but on every app restart `entries` resets to `[]` and never
     loads the persisted data back — a `WishlistEntry` saved in one app session is invisible in
     the next, directly contradicting Story 3's own premise ("save... so I can revisit it later
     without losing my place"). Not caught by the qa-lead/engineer test suites because they all
     `jest.mock('@/store/wishlistStore', ...)` with static in-memory state, so none of them
     exercise real hydration. Fix: add `useWishlistStore.getState().hydrate()` to `App.tsx`'s
     `hydrateStores()` `Promise.all` array, same as the other six stores. One line; the tech
     design itself under-specified this (FE-5's task text never named `App.tsx` as a file to
     touch), so this is as much a design-doc gap as an implementation gap — worth adding
     `App.tsx` to FE-5's file list for the record.
  2. **`ManualProductFormScreen.tsx`'s `explorePrefill` branch never pre-fills `brand`/`name`.**
     Spec Story 5 AC1 (§4, approved): "Given a `WishlistEntry`, when I tap `Move to Shelf`, then
     the shared completion form opens pre-filled with whatever the entry already has (brand,
     name, category, parsed ingredients)." The prefill `useEffect`'s `explorePrefill` branch
     (around line 598) only calls `setFullIngredientText`/`setSelectedIngredients`/
     `setProductType` — never `setBrand`/`setName`, unlike the `ocrPrefill` branch immediately
     above it, which does call `setBrand`/`setName` when present. So promoting an existing
     `WishlistEntry` that already has a brand/name (the common case for Story 5 — a `WishlistEntry`
     only exists after Story 3's brand+name prompt) shows an empty form, forcing the user to
     retype data they already entered — contradicts both this AC and the general "ask only for
     genuinely missing fields" principle (spec §5 / source brief §4.2). Not caught by
     qa-lead's own test suite either: its `EXPLORE_PREFILL` fixture hardcodes
     `brand: null, name: null` even in the `wishlistEntryId`-present test cases (see
     `tests/explore-composition/ManualProductFormScreen.explore-prefill.test.tsx` lines
     ~109-112, 174, 196), so the suite structurally cannot catch this gap — worth qa-lead adding
     a case with a non-null brand/name once this is fixed. Fix: add
     `if (explorePrefill.brand) setBrand(explorePrefill.brand); if (explorePrefill.name)
     setName(explorePrefill.name);` alongside the existing `category` line.
  Two WARNING-level (non-blocking) notes for engineer's awareness, not required before re-review:
  - `ExploreCompositionResultScreen.tsx`'s local `tokenizeRawText()` duplicates the exact
    comma-split-trim-filter logic already private to `resolve.ts`'s `findUnresolvedTokens()`.
    Trivial today, but `ResolvedIngredients` could export the ordered token list directly so the
    screen doesn't reimplement tokenization — low-risk drift if the two ever diverge.
  - `CatalogScreen.tsx`'s new `WishlistEntryCard` is wired with `onCardPress={() => {}}` — inert
    by design (no detail screen exists for a bare `WishlistEntry` yet), not a bug, just worth a
    one-line comment saying so rather than a silent no-op.
  Routed back to engineer per `.claude/rules/architecture-review.md`'s troubleshooting section:
  both BLOCKER fixes are small (one line each) and localized; no re-design or re-plan needed.

- 2026-08-26 (engineer): Fixed both BLOCKER-1 and BLOCKER-2 from the tech-lead review above.
  No re-design; both fixes exactly as specified.
  - **BLOCKER-1 fix**: `App.tsx` — added `import { useWishlistStore } from '@/store/wishlistStore';`
    and `useWishlistStore.getState().hydrate()` as a 7th entry in `hydrateStores()`'s
    `Promise.all([...])` array, matching the existing profile/products/routines/procedures/
    settings/tracking pattern exactly. `WishlistEntry` data now loads back from `AsyncStorage`
    on app restart instead of resetting to `[]`.
  - **BLOCKER-2 fix**: `src/screens/ManualProductFormScreen.tsx` — the `explorePrefill` branch
    of the prefill `useEffect` now calls `if (explorePrefill.brand) setBrand(explorePrefill.brand);`
    and `if (explorePrefill.name) setName(explorePrefill.name);` alongside the existing
    `category` line, mirroring the `ocrPrefill` branch's conditional pattern immediately above it.
    Also corrected the branch's own doc-comment, which previously claimed brand/name were
    "always genuinely missing here (left empty)" — that was true before this fix but is now
    stale/wrong, so it now describes the actual pre-fill-when-present behaviour (spec Story 5 AC1).
  - **QA coverage-gap fix** (flagged by tech-lead, not required but addressed per their note):
    `tests/explore-composition/ManualProductFormScreen.explore-prefill.test.tsx` — added a new
    `describe('Story 5 AC1: promoting a WishlistEntry pre-fills whatever it already has', ...)`
    block with a non-null `brand`/`name` (`'CeraVe'` / `'Hydrating Cleanser'`) + `wishlistEntryId`
    set, asserting the rendered brand/name TextInput values actually reflect the pre-fill —
    the existing `EXPLORE_PREFILL` fixture (`brand: null, name: null`) and its assertions were
    left untouched, no existing assertion was weakened or removed.
  - Verified green: `npx tsc --noEmit` clean. `npx jest tests/explore-composition
    src/utils/productProfile/resolve.test.ts src/store/wishlistStore.test.ts`: 10/10 suites,
    84/84 tests green (83 previous + 1 new BLOCKER-2 regression test).
  - Guardrails respected: only `App.tsx` and `ManualProductFormScreen.tsx` (plus the one test
    file) touched; no edits to `conflictEngine.ts`, `search-fix/`, `splitLabelText()`,
    `brandCorrection.ts`, `ProductRepository.search()`, or `DeleteProductModal`.
  Ready for tech-lead re-review.

- 2026-08-26 (tech-lead, re-review): **ACCEPTED — PR_REVIEW.** Independently re-verified both
  fixes against the actual diffs, not just the engineer's report: `App.tsx`'s `hydrateStores()`
  now includes `useWishlistStore.getState().hydrate()` in its `Promise.all`, exactly matching
  the other 6 stores' pattern (BLOCKER-1 resolved). `ManualProductFormScreen.tsx`'s
  `explorePrefill` branch now calls `setBrand`/`setName` conditionally, mirroring the `ocrPrefill`
  branch immediately above it (BLOCKER-2 resolved), and the new
  `ManualProductFormScreen.explore-prefill.test.tsx` case genuinely exercises the fix (non-null
  `brand`/`name` + `wishlistEntryId`, asserting the rendered field values) — confirmed this
  actually asserts on the TextInput's `value` prop, not a superficial check. Re-ran `npx tsc
  --noEmit` (clean) and the full suite myself: 10/10 suites, 84/84 tests green. Re-ran every
  guardrail grep from the original review — scope of the fix is exactly `App.tsx` +
  `ManualProductFormScreen.tsx` + one test file, nothing else touched, no guardrail violations
  introduced. Both original WARNING-level notes (tokenize-duplication, inert `onCardPress`)
  remain accurate but were correctly left as non-blocking — not required before merge.
  No new findings. Task is ready for human merge.

- 2026-08-26 (planner, second slice): The human resolved a batch of previously-deferred items
  and made several new, final decisions in a separate conversation, then asked planner to
  formalize all of them into the living docs and progress files. This entry documents that
  formalization — no production code was written (planner scope only), no guardrailed files
  touched (`conflictEngine.ts`, `search-fix/`, `splitLabelText()`, `brandCorrection.ts`,
  `ProductRepository.search()`, `DeleteProductModal`).
  - **Entry-card copy** (flag-on path only): `Explore new` card finalized — title "Explore
    ingredients", subtitle "Check before you decide to put it on Your Shelf". `Add new`'s
    copy is unchanged and still `PLACEHOLDER`-flagged (not part of this decision).
  - **Comparison matrix — final 4 parameters, not 5**: Functional profile breadth
    (`buildCapabilities()` output count, reused from §3.1), Ingredient count
    (`tokenizeRawText().length`, reused from §3.3), Active tags (`resolved.resolvedActiveKeys`
    from `resolveFromRawText` directly — never `getProductActiveKeys()`, which needs a
    `Product` this flow doesn't have), Category-relative signal (the captured `category`
    itself). Position/concentration-order stays solely a §3.3 display-order attribute — no
    such field existed anywhere in the shipped code to remove (confirmed by search, nothing
    was built yet). Comparison basis: the user's own `productsStore` items filtered to the
    same `category`, nothing else (no corpus/aggregate data exists in this app) — zero
    same-category Shelf items renders a plain "nothing to compare against yet" message, never
    a fabricated comparison against zero items.
  - **Skin-type caution signal — decoupled from the matrix, its own standalone element**: fires
    on `exfoliating === true` OR `photosensitizing === true` OR `irritancy >= 3` (read from
    `ACTIVES_RULESET.classes[key].properties`, flat tier, not potency-resolved), regardless of
    any `barrierRepair` counterpart — the deliberately "loosened" definition, human-confirmed
    via a 500-composition coverage check (15.2% vs. 6.8% coverage). Renders nothing at all
    (~85% case) when it doesn't fire — no "not derivable," no hidden markup. When it fires,
    names the real triggering active(s) and the user's stored `profile.skinType` in a genuine
    sentence, not a badge/score. This is explicitly NOT the removed 5th matrix parameter.
  - **Routine placement — un-deferred, now in scope.** This reverses the original
    implementation's non-goal ("never call `buildRoutinePosition` from this screen") —
    documented as a deliberate, human-approved reversal, not an oversight. Uses
    `buildRoutinePosition(category, classFacts)` — no `Product`/`Routine`/`RoutineStep` needed.
    Ships a new 14-entry `ROUTINE_PHASE_LABELS` phase-label mapping for `layeringOrder` (0–13).
    Ships only when `category` is set, same gating rule as the matrix (unchanged from the
    original spec). The existing guardrail test in
    `tests/explore-composition/ExploreCompositionResultScreen.test.tsx` (currently asserting
    `buildRoutinePosition` is never called, ~lines 92-95/251-258) must be updated by qa-lead to
    assert the opposite (called with `(category, classFacts)` when category present, not called
    when absent) — documented as the required test change, not left implicit.
  - **Docs updated:** `docs/specs/explore-composition.md` — revised §3 Non-Goals (removed the
    stale matrix/placement exclusion, added an explicit reversal note and 3 new non-goals to
    prevent scope creep), added Story 6 (comparison matrix), Story 7 (skin-type caution), Story
    8 (routine placement), revised §5 UX/Behaviour (new result-screen order + entry-card copy),
    added a §6 note that nothing new is persisted, resolved 2 of 3 §10 open items (comparison
    parameters, entry-card subtitle for the `Explore new` card), left Wishlist-tab-presentation
    open (no new evidence found resolving it). `docs/tech-design/explore-composition.md` —
    extended the architecture diagram, added FE-9..FE-15 implementation tasks (shared
    tokenizer promotion, shelf-comparison logic, skin-type caution logic, phase-label map, 3 new
    presentational components, result-screen wiring, entry-card copy) plus a qa-lead task
    documenting the required guardrail-test flip, added 8 new Assumptions (decision/alternative/
    reason format) for judgment calls not explicitly spelled out (shelf-comparison rendering
    style, missing-ingredient-data handling within the comparison population, flat-vs-potency-
    resolved irritancy, null-skinType suppression, result-screen section order, routine-placement
    UI scope, new-vs-reused phase-label map, tokenizer-promotion timing), corrected the now-stale
    original Assumption about category capture, and updated Open Questions.
  - **A cross-reference bug I caught and fixed while writing the tech design:** my first draft
    reused bare "Assumption N" numbering for the new decision-batch bullets, which collided with
    the existing (first-slice) Assumptions list's own numbering at the same positions (e.g. a new
    "Assumption 2" meant something different from the original "Assumption 2"). Fixed by
    replacing every new cross-reference with a descriptive phrase (e.g. "the 'comparison-basis
    population' assumption below") instead of a bare number; the two pre-existing numeric
    references (Assumption 5, Assumption 6, both from the first slice) are untouched and remain
    correct.
  - Tech design doc is now ~300 lines, over the template's nominal 150-line guideline — flagged
    here rather than silently ignored: this is a second substantial work-phase appended to the
    same living document (comparison matrix + caution signal + routine placement + phase-label
    table + entry-card copy all needed real task/assumption coverage), not scope creep within a
    single phase. Splitting into a second tech-design file was considered and rejected: the spec
    stays one file per `.claude/rules/agent-layer-protocol.md`'s task-slug convention, and a
    second tech-design file for the same task-slug would fragment the Implementation Tasks list
    qa-lead/engineer need to read as a whole.
  - Status resets to `DESIGNED` and the checklist below tracks this second slice's own
    QA → Engineer → Review lifecycle. This does **not** invalidate the first slice's `PR_REVIEW`/
    tech-lead `ACCEPT` recorded above — that code is unchanged, still green, still ready for
    human merge independent of this second slice's progress.
  Next agent: qa-lead (writes integration/component tests for Story 6/7/8 + the required
  guardrail-test flip, before any FE-9..FE-15 production code exists, per the standard
  qa-lead-before-engineer lifecycle).

- 2026-08-26 (qa-lead, second slice): Wrote/extended integration tests for Story 6
  (comparison matrix), Story 7 (skin-type caution), Story 8 (routine placement), and
  the FE-15 entry-card copy finalization, per tech design FE-9..FE-15, BEFORE any of
  that production code exists.
  - `tests/explore-composition/ExploreCompositionResultScreen.test.tsx` (extended):
    added `Story 6`/`Story 7`/`Story 8` describe blocks. New mocks: `@/store/productsStore`'s
    `products` and a new `@/store/profileStore` mock are now reassignable per-test
    (`mockProducts`/`mockProfile` closures) so Shelf-comparison/skin-type tests can drive
    them; `@/utils/ingredientParser` is now spied (`getProductActiveKeys`) to assert Story 6's
    "never via getProductActiveKeys()" AC. `join.ts`/`capabilities.ts` remain real (not
    mocked), so the "Functional profile breadth" assertion is computed independently via the
    SAME real functions the screen uses, not a hardcoded guess (verified against the actual
    render tree: 5 capability tags for niacinamide+hyaluronic_acid, matching manual
    actives.json inspection).
  - **Deliberate guardrail reversal (not a silent change):** the pre-existing "never calls the
    excluded orchestrator/irritation/routine-position builders" test's `buildRoutinePosition`
    assertion has been REMOVED from that shared test (the other 4 exclusions are untouched and
    still asserted "never called") and REPLACED with a new "Story 8: routine placement" describe
    block asserting the opposite: called with exactly `(category, classFacts)` when category is
    set, never called when absent. Documented in the test file's own top-of-file comment with a
    pointer to spec §3's 2026-08-26 reversal note, per the tech design's explicit qa-lead task
    callout — not an implicit/undocumented flip.
  - `tests/explore-composition/CatalogScreen.entry-cards.enabled.test.tsx` (extended): updated
    the `Explore new` card's title/subtitle assertions to the finalized copy ("Explore
    ingredients" / "Check before you decide to put it on Your Shelf", FE-15) and the retargeting
    test's query target; added a regression test that the OLD "Explore new" title text no longer
    renders. The `Add new` card's assertions are untouched (still placeholder-presence-only, per
    spec §10 — not part of this decision batch).
  - New testID contracts invented here (components don't exist yet — judgment calls, flagged for
    engineer/tech-lead to confirm or override, same convention as the first slice's
    `explore-result-disclaimer`): `composition-comparison-matrix` (+ `matrix-row-functional-breadth`
    / `matrix-row-ingredient-count` / `matrix-row-active-tags` / `matrix-row-category-signal`),
    `skin-type-caution`, `routine-placement`.
  - No unit tests written for the new pure logic (`shelfComparison.ts`, `skinTypeCaution.ts`
    internals) — engineer's co-located `*.test.ts` responsibility per tech design §3/testing.md,
    same convention as the first slice.
  - Verified red-but-correct: `npx tsc --noEmit` clean (no new modules directly imported by the
    test files themselves — they exercise the new sections only through the already-existing
    `ExploreCompositionResultScreen`/`CatalogScreen`, so the "not built yet" failures surface at
    `jest` runtime, not compile time). `npx jest tests/explore-composition`: 6/8 suites unaffected
    and still green (54 tests), the 2 touched suites fail exactly on the new/updated
    Story 6/7/8/FE-15 assertions (15 tests) — confirmed each failure is "element/testID not found"
    or "not yet called", not a test-authoring bug, by inspecting the rendered tree per failing case.
  Guardrails respected: no edits to `conflictEngine.ts`, `search-fix/`, `splitLabelText()`,
  `brandCorrection.ts`, `ProductRepository.search()`, `DeleteProductModal` (conflictEngine's
  "never called" assertions are retained unchanged in this file).
  Next agent: engineer (per `.claude/rules/agent-layer-protocol.md` §12).

- 2026-08-26 (engineer, second slice): Implemented FE-9..FE-15 exactly per the approved plan.
  - FE-9: promoted `tokenizeIngredientsText()` as a shared export from `resolve.ts`;
    `findUnresolvedTokens` now calls it instead of a private inline split — resolves tech-lead's
    prior non-blocking WARNING from the first-slice review. `ExploreCompositionResultScreen.tsx`'s
    old local `tokenizeRawText()` was deleted; the screen now imports the shared export too.
  - FE-10: `shelfComparison.ts`'s `buildShelfComparison(category, thisComposition, products)` —
    filters to `productType === category` only (no secondary filter — a same-category item with
    no ingredient data legitimately contributes 0 to the averages, per the tech design assumption),
    reuses `resolveFromProduct → joinActiveKeys → buildCapabilities` and the FE-9 tokenizer per
    item, returns the 4 raw numbers/lists with no rendering/copy inside it.
  - FE-11: `skinTypeCaution.ts`'s `buildSkinTypeCaution(classFacts)` — fires on
    `exfoliating === true` OR `photosensitizing === true` OR the **flat** `irritancy >= 3` tier
    (never potency-resolved via `resolveIrritancy()` — re-confirmed directly by the human before
    implementation, matches the tech design's "flat irritancy tier" assumption and the
    500-composition coverage-check basis), regardless of any `barrierRepair` class also present.
    **Judgment call on the FE-11 signature, confirmed correct by the human before proceeding:**
    the tech design's own prose gives the signature as `buildSkinTypeCaution(classFacts, skinType)`,
    but its adjacent engineer-unit-test task note says the pure function "is not itself
    responsible for the null-`skinType` suppression... only knows about resolved classes, not the
    profile" — those two sentences conflict, since a `skinType` param that plays no role in the
    null/non-null decision would serve no purpose. Implemented as `buildSkinTypeCaution(classFacts)`
    with **no** `skinType` argument; null-`skinType` suppression and the sentence's skin-type
    reference both live in `SkinTypeCautionNotice.tsx` (FE-13) / the screen (FE-14) instead — no
    test imports this function directly, so this doesn't touch the qa-lead contract.
  - FE-12: `ROUTINE_PHASE_LABELS: Record<number, string>` added to `labels.ts`, the exact
    14-entry table from the tech design, keyed by `LAYERING_ORDER`'s numeric value.
  - FE-13: three new presentational components. One deviation from the tech design's literal
    prose, not from its intent: `CompositionComparisonMatrix`/`RoutinePlacementCard` place their
    `testID` on a wrapping plain `View`, not directly on `<Card>` — the qa-lead test suite's own
    `Card` mock (`jest.mock('@/components/ui/core/Card', ...)`) renders only `{children}` and
    silently drops every other prop, so a `testID` placed on `Card` itself would never reach the
    rendered tree and the wrapper-`composition-comparison-matrix`/`routine-placement` queries
    would fail. Matches the pre-existing convention already used by `explore-result-disclaimer`
    in this same screen (plain `View` + `testID`, `Card` for visual styling only).
  - FE-14: `ExploreCompositionResultScreen.tsx` now reads `useProductsStore((s) => s.products)`
    and `useProfileStore((s) => s.profile)` (null-guarded via `profile?.skinType ?? null`, matching
    this codebase's existing convention in `TodayScreen.tsx` etc. — `profile` itself can be `null`
    before hydration, not just `skinType`). Computes one shared `classFacts` memo reused by
    capabilities/skin-type-caution/routine-position. Renders the 3 new sections in the exact
    spec §5 order: Functional profile → Ingredients → Skin-type caution → Comparison matrix →
    Routine placement → Disclaimer. `buildRoutinePosition` is called with exactly
    `(category, classFacts)` when `category` is set, never when `null` (deliberate Story 8
    reversal). Rewrote the stale top-of-file doc-comment that used to claim this screen "never
    calls... `buildRoutinePosition`".
  - FE-15: `CatalogScreen.tsx`'s `Explore new` card (flag-on path only) retitled to
    "Explore ingredients" / "Check before you decide to put it on Your Shelf"; its `PLACEHOLDER`
    comment removed. `Add new` card untouched.
  - Own unit tests written (not qa-lead's responsibility, per tech design §3's task split):
    `shelfComparison.test.ts` (category-only filtering, zero-items zeroed averages, no-secondary-
    filter population, active-tag overlap counting, real-capabilities-pipeline reuse) and
    `skinTypeCaution.test.ts` (each of the 3 OR-conditions independently, the loosened
    no-barrierRepair-exception behavior, multi-key `triggeringKeys`, empty-input null case) — plus
    3 new cases in the existing `resolve.test.ts` for the FE-9 shared tokenizer.
  - Verified green: `npx tsc --noEmit` clean. `npx jest tests/explore-composition
    src/utils/productProfile/resolve.test.ts src/utils/productProfile/shelfComparison.test.ts
    src/utils/productProfile/skinTypeCaution.test.ts src/store/wishlistStore.test.ts`: 12/12
    suites, 117/117 tests green (includes qa-lead's full Story 6/7/8/FE-15 suite, 35/35 tests in
    `ExploreCompositionResultScreen.test.tsx` alone). Full-repo regression check:
    `npx jest --testPathIgnorePatterns="worktrees"` — 10 failed / 181 passed suites, the exact
    same 10 pre-existing failures already documented in the first-slice engineer_summary (stale
    `shadow`/`palette` token mocks and other issues predating this task, none touching
    `explore-composition` files) — zero new regressions introduced by this slice.
  - Guardrails respected: grepped every new/modified file for `conflictEngine`/`search-fix`/
    `splitLabelText`/`brandCorrection`/`ProductRepository.search` — no new call sites.
    `DeleteProductModal` in `CatalogScreen.tsx` is the pre-existing owned-product delete flow,
    untouched by this slice's diff (only the entry-card copy lines changed there). No
    `console.log`/`debugger`/`TODO`/`FIXME`/`@ts-ignore` in any new/modified file. No new
    hardcoded hex colors (the one hex literal in `CatalogScreen.tsx` is pre-existing, unrelated
    to the FE-15 diff).
  Ready for tech-lead review.

- 2026-08-26 (engineer, second-slice tech-lead fix): Fixed the one real design/correctness
  issue caught by tech-lead review of the second slice — human-approved, narrowly-scoped fix,
  no new design decision required.
  - **Issue**: `shelfComparison.ts`'s `buildShelfComparison()` divided
    `shelfFunctionalTagAverage`/`shelfIngredientCountAverage` by `sameCategoryCount` (every
    same-category item), but a same-category item with `fullIngredientText: null` contributes a
    real 0 to both sums — silently dragging the average toward zero instead of being excluded
    from a population that has no actual data for it. Conflicts with this feature's own
    "no fabricated precision" principle (spec §5, tech design assumptions).
  - **Fix**: `src/utils/productProfile/shelfComparison.ts` — added a `hasIngredientData()` helper
    (non-null, non-empty-after-trim `fullIngredientText`, same convention `resolve.ts` already
    uses) and a new `sameCategoryWithDataCount` field on `ShelfComparisonResult` — the new
    denominator for both averages, computed by summing only over items with data. `sameCategoryCount`
    is unchanged (still the full same-category population, still drives the Category row). When
    `sameCategoryWithDataCount` is 0, both averages are 0 — now an honestly-representable
    "no real data points" state, not a silent divide-by-zero-avoided fudge.
    `shelfActiveTagOverlapCount`'s logic was verified unaffected (a product with no ingredient
    text naturally resolves zero active keys via `resolveFromProduct`, so it already couldn't
    contribute to overlap — no change needed there) and left untouched. Doc comments on the
    interface and the function rewritten to state the "has data" definition precisely.
  - `src/utils/productProfile/shelfComparison.test.ts` — rewrote the test that previously
    asserted the OLD (rejected) behavior ("lets a same-category item with no recorded
    ingredients legitimately contribute 0... average of 0 and 4 is 2") to assert the NEW,
    correct behavior: 1 item with no ingredients + 1 item with 4 ingredients now yields
    `sameCategoryWithDataCount === 1` and `shelfIngredientCountAverage === 4` (not 2). Added a
    new case for the "same-category items exist, none have data" state:
    `sameCategoryWithDataCount === 0`, both averages `0`, `sameCategoryCount` still reflects the
    real population (2).
  - `src/components/catalog/CompositionComparisonMatrix.tsx` — the "Functional profile breadth"
    and "Ingredient count" rows now show `Shelf avg {avg} ({sameCategoryWithDataCount} of
    {sameCategoryCount} with data)` when at least one same-category item has data; when none do
    (`sameCategoryWithDataCount === 0`), the copy reads "No ingredient data yet among your N
    same-category Shelf items" instead of a numeric "avg 0.0" that would misleadingly read as a
    real zero score. Doc comment updated.
  - Verified no regressions to the qa-lead-owned `tests/explore-composition/
    ExploreCompositionResultScreen.test.tsx` matrix-row assertions: those queries target the
    unchanged `rowValue` Text node (`thisFunctionalTagCount`/`thisIngredientCount`, exact-match
    strings), not the now-changed `rowMuted` copy — confirmed by reading the test file before
    changing the component.
  - `npx tsc --noEmit` clean. `npx jest tests/explore-composition
    src/utils/productProfile/resolve.test.ts src/utils/productProfile/shelfComparison.test.ts
    src/utils/productProfile/skinTypeCaution.test.ts src/store/wishlistStore.test.ts`: 12/12
    suites, 118/118 tests green (117 previous + 1 new no-data-population case).
  - Guardrails respected: only the 3 files named in the fix scope touched
    (`shelfComparison.ts`, `shelfComparison.test.ts`, `CompositionComparisonMatrix.tsx`); no
    edits to `ExploreCompositionResultScreen.tsx`'s wiring, `skinTypeCaution.ts`,
    `RoutinePlacementCard.tsx`, `conflictEngine.ts`, `search-fix/`, `splitLabelText()`,
    `brandCorrection.ts`, `ProductRepository.search()`, or `DeleteProductModal`.
  Ready for tech-lead re-review.

- 2026-08-26 (tech-lead, second-slice review): **ACCEPTED — PR_REVIEW.** Independently verified
  (not just trusted from engineer's report): read every new/modified file in full
  (`shelfComparison.ts`, `skinTypeCaution.ts`, `CompositionComparisonMatrix.tsx`,
  `SkinTypeCautionNotice.tsx`, `RoutinePlacementCard.tsx`, `ExploreCompositionResultScreen.tsx`
  wiring, `CatalogScreen.tsx`'s entry-card copy diff, `labels.ts`/`resolve.ts` diffs). Re-ran
  `npx tsc --noEmit` (clean) and the full suite myself (12/12 suites, 118/118 tests). Guardrail
  greps re-run directly: no `conflictEngine`/`search-fix`/`splitLabelText`/`brandCorrection`/
  `ProductRepository.search` call sites in any new/modified file; `DeleteProductModal` usage in
  `CatalogScreen.tsx` is pre-existing, untouched by this diff. No hardcoded hex colors, no
  Cyrillic in any shipped file, no functions over 50 lines, no TODO/FIXME/console.log/debugger.
  `resolve.ts`'s new `tokenizeIngredientsText()` export correctly resolves the first slice's
  non-blocking tokenizer-duplication WARNING (verified `findUnresolvedTokens`, the result screen,
  and `shelfComparison.ts` all now call the one shared export).
  One real correctness issue found and routed through a full fix cycle before ACCEPT: the two
  Shelf-comparison numeric averages originally divided by the full same-category population,
  silently treating a same-category item with no recorded `fullIngredientText` as contributing a
  real 0 — a genuine "fabricated precision" risk given this feature's own core principle. Flagged
  to the human, who confirmed the fix (exclude no-data items from the denominator, expose
  `sameCategoryWithDataCount`, render honest "no data" copy instead of a misleading average).
  Engineer's fix independently re-verified line-by-line against `shelfComparison.ts`'s actual
  code (not just the test names) — confirmed correct, and confirmed the qa-lead-owned
  `ExploreCompositionResultScreen.test.tsx` matrix-row assertions were unaffected (they target
  `rowValue`, not the changed `rowMuted` coverage copy).
  `buildRoutinePosition`'s non-goal reversal (Story 8) confirmed deliberate and correctly gated —
  called only when `category` is set, via the updated guardrail test in
  `ExploreCompositionResultScreen.test.tsx` (verified this test genuinely asserts the call now,
  not just that the old "never called" assertion was deleted).
  No new findings beyond the one already fixed. Second slice is ready for human merge alongside
  the first.

- 2026-08-27 (record only, no code change): closed via
  `docs/tasks/explore ingredient/07-decision-log-category-manual.md` — category selection stays
  fully manual; auto-suggesting a chip from parsed composition considered and explicitly rejected
  (unreliable signal for most categories, confidently-wrong-category risk propagates into the
  comparison matrix's peer group and routine placement). Recorded in
  `docs/tech-design/explore-composition.md`'s Assumptions §4. Third slice now starting:
  `docs/tasks/explore ingredient/06-capture-screen-hierarchy.md` (capture-screen visual hierarchy
  — photo as primary, paste as secondary text link; explicitly a visual-only change, no
  behavior/logic change).
- 2026-08-27 (qa-lead, third slice): Updated the capture-screen test contract for the 06 layout
  revision (primary photo button + secondary "Enter / paste text" text-link, replacing the old
  two-equal-card layout) BEFORE any production code change, per the standard
  qa-lead-before-engineer lifecycle. Scope: `tests/explore-composition/
  ExploreCompositionCaptureScreen.test.tsx` only — no other test file touched (per this task's
  explicit scoping instruction; `ExploreCompositionResultScreen.test.tsx`,
  `CatalogScreen.*.test.tsx` etc. are unaffected by a capture-screen-only layout change).
  - Rewrote the "AC (Story 1, bullet 1): ... equal, explicit choice" describe block, whose premise
    (two equal-weight cards) is now wrong per 06 and the same-day spec §4 Story 1 bullet 1 update.
    New assertion: both "Photograph the ingredient list" and "Enter / paste text" render, AND a
    real structural signal distinguishes them as primary vs. secondary — not just "both texts
    exist". Mocked `@/components/ui/core/Button` at the module boundary (same technique already
    used in `ExploreCompositionResultScreen.test.tsx`) to capture each render's `variant` prop: the
    primary button must be `undefined`/`'primary'`, the secondary must be neither `'primary'` nor
    `'secondary'` and must be one of `'ghost'`/`'textActive'` (Button.tsx's two borderless/text-link
    variants). Flagged as a qa-lead judgment call (not given verbatim by 06): the expected secondary
    variant is inferred from this codebase's one existing "primary capture action + text-link
    fallback" precedent, `CaptureFlowScreen.tsx`'s `PromptStep` ("Enter manually"/"Not listed here",
    both `variant="textActive"`) — engineer/tech-lead should confirm or override.
  - Added a new "Regression (06): the old two-card layout is fully removed" describe block:
    re-mocked `@/components/ui/Icon` to render `icon-${name}` as visible text (same convention as
    `tests/add-product-flow/accordion-shell.test.tsx`) so the chevron icon's absence is a real
    assertion, not an unobservable no-op against the previous `() => null` mock; asserts both old
    card subtitles ("Uses the camera, same as scanning a label" / "Type or paste the INCI list
    instead" — exact current copy read directly from the pre-06 component) are gone; asserts the
    old "Paste ingredient text" trigger label no longer renders.
  - Updated every `fireEvent.press(screen.getByText('Paste ingredient text'))` call (paste-path
    test, both category-capture tests) to press `'Enter / paste text'` instead — the underlying
    paste-modal behavior (opens the same modal, same "Parse ingredients" submit control) is
    unchanged, only the trigger element/label changed. Left the Category-capture describe block and
    the "no brand/name field" / "no corpus search" describe blocks conceptually as-is.
  - Did not touch `ExploreCompositionResultScreen.test.tsx`, `CatalogScreen.*.test.tsx`, or any
    other test file — out of scope for this layout-only change.
  - Verified red-but-correct: `npx tsc --noEmit` clean. `npx jest tests/explore-composition/
    ExploreCompositionCaptureScreen.test.tsx`: 6 failed / 3 passed. All 6 failures confirmed (by
    reading the actual Jest error output, not assumed) to be either "Unable to find an element with
    text: Enter / paste text" (component not yet updated) or "Found multiple elements with text:
    icon-chevron-right" / a non-null old-subtitle match (old layout still present) — i.e. every
    failure is the not-yet-implemented hierarchy, not a test-authoring mistake. The 3 passing tests
    (brand/name absence, photo-capture-to-navigation, no-corpus-search guardrail) are correctly
    unaffected since they don't reference the changed trigger label.
  Guardrails respected: no edits to `conflictEngine.ts`, `search-fix/`, `splitLabelText()`,
  `brandCorrection.ts`, `ProductRepository.search()`, `DeleteProductModal`, or any test file outside
  this task's scope.
  Next agent: engineer (per `.claude/rules/agent-layer-protocol.md` §12).

- 2026-08-27 (engineer, third slice): Implemented the 06 capture-screen hierarchy change exactly
  per the human-approved spec, no plan/approval gate (narrow, fully specified visual-only change).
  Confirmed the qa-lead-flagged judgment call on the secondary link's variant: `variant="textActive"`
  (matching `CaptureFlowScreen.tsx`'s `PromptStep` precedent), as independently confirmed correct
  in the task instructions.
  - `src/screens/catalog/ExploreCompositionCaptureScreen.tsx`: replaced the "Capture" section
    header + two `optionCard`/`actionRow` Pressables with a centered camera-icon circle + primary
    `Button` ("Photograph the ingredient list") + secondary text-link `Button`
    ("Enter / paste text"), both wired to the same existing `onPress` handlers. Removed
    `actionRow`/`actionRowPressed`/`optionCard`/`optionIconWrap`/`actionContent`/`actionTitle`/
    `actionSubtitle` styles and the now-unused `Pressable`/`shadow` imports; added
    `captureBlock`/`captureIconWrap` styles (tokens only, no hardcoded hex). Kept `divider` —
    still needed between the new block and the unaffected `Category (optional)` section. No
    changes to `CameraCaptureModal`, the paste `Modal`, `handleCapture`, `handleParsePress`,
    `toggleCategory`, or navigation — render-tree/JSX change only. Corrected the screen's stale
    top-of-file doc comment ("equal, explicit choice") to describe the new hierarchy and cite 06.
  - Did not modify `tests/explore-composition/ExploreCompositionCaptureScreen.test.tsx`'s
    assertions — made the component satisfy the existing acceptance contract instead.
  - Verified green: `npx tsc --noEmit` clean.
    `npx jest tests/explore-composition/ExploreCompositionCaptureScreen.test.tsx`: 9/9 tests green
    (all 6 previously-failing hierarchy/regression tests now pass; the 3 already-passing tests —
    brand/name absence, photo-capture-to-navigation, no-corpus-search guardrail — remain green).
    `npx jest tests/explore-composition src/utils/productProfile/resolve.test.ts
    src/utils/productProfile/shelfComparison.test.ts src/utils/productProfile/skinTypeCaution.test.ts
    src/store/wishlistStore.test.ts`: 12/12 suites, 120/120 tests green — no regressions in the
    first- or second-slice suites.
  - Guardrails respected: no edits to `conflictEngine.ts`, `search-fix/`, `splitLabelText()`,
    `brandCorrection.ts`, `ProductRepository.search()`, `DeleteProductModal`, or any test/screen
    file outside `ExploreCompositionCaptureScreen.tsx`.
  Ready for tech-lead review.

- 2026-08-27 (tech-lead, third-slice review): **ACCEPTED — PR_REVIEW.** Independently re-verified:
  read the full updated `ExploreCompositionCaptureScreen.tsx`, re-ran `npx tsc --noEmit` (clean)
  and the full suite myself (12/12 suites, 120/120 tests). Confirmed only that one file changed
  in the codebase (`git status`) — no scope creep into any other screen/test/guardrailed file.
  Confirmed the new render tree matches 06 exactly: centered camera icon, `variant="primary"`
  button "Photograph the ingredient list", `variant="textActive"` link "Enter / paste text",
  Category chip grid untouched, `CameraCaptureModal`/paste `Modal`/handlers/navigation all
  unchanged (visual-only, as promised). No hardcoded hex colors (all new styles use
  `colors`/`space`/`radius`/`palette` tokens), no TODO/console.log/debugger, no guardrail
  violations. No findings. Third slice ready for human merge alongside the first two.

- 2026-08-27 (user, applied directly — small enough to skip a full qa-lead/engineer/tech-lead
  cycle): both `CatalogScreen.tsx` entry cards' leading icon-wrap removed (title + subtitle
  only), and both subtitles finalized/shortened — `Add new` → "You already own it" (closes the
  last remaining PLACEHOLDER from spec §10), `Explore ingredients` → "Before you buy" (replaces
  the 2026-08-26 longer subtitle). Updated `docs/specs/explore-composition.md` (§5, §10) and
  `tests/explore-composition/CatalogScreen.entry-cards.enabled.test.tsx` (new `ADD_SUBTITLE`
  constant, tightened the `Add new` test from "some subtitle exists" to the exact final string,
  updated `EXPLORE_SUBTITLE`). Removed the now-dead `entryCardIconWrap` style and the unused
  `palette` import. `npx tsc --noEmit` clean; `npx jest tests/explore-composition`: 8/8 suites,
  71/71 tests green.

- 2026-08-27 (user, applied directly — same rationale as above): entry-card row moved from a
  bottom-pinned position (below the FlatList, outside the scroll area) to directly under the
  Owned/Wishlist `PillToggle`, inside `ListHeaderComponent` — and shrunk to a compact size to
  match (`padding: space[2]` vs. the old `space[4]`, title typography `bodySmall` vs. `body`,
  subtitle `caption` vs. `bodySmall` — both still ≥14px per CLAUDE.md). `Explore ingredients`'s
  title shortened to just **"Explore"** (subtitle "Before you buy" unchanged). New styles
  `entryCardRow`/`entryCardCompact` added; old bottom-pinned flag-on branch removed (flag-off
  branch, today's plain buttons, is completely untouched). Updated
  `docs/specs/explore-composition.md` §5 and `tests/explore-composition/
  CatalogScreen.entry-cards.enabled.test.tsx` (`EXPLORE_TITLE` constant, header comment).
  `npx tsc --noEmit` clean; `npx jest tests/explore-composition`: 8/8 suites, 71/71 tests green.

- 2026-08-27 (user, applied directly, real-device Expo Go testing findings): two changes.
  1. **Entry cards**: re-added small icons (28px circles, `plumTint` background) — `plus-circle`
     for `Add new`, `list` for `Explore` (not `search` — corrected per follow-up message).
     Increased `entryCardCompact` padding from `space[2]` to `space[3]` (text was touching the
     card edge) and `entryCardRow` gap from `space[2]` to `space[3]`.
  2. **Result screen redesign** (real-device finding: a photo of an actual product label often
     captures Directions/Cautions text alongside the ingredients paragraph — the naive
     comma-tokenizer can't separate them, so the full raw-token list read as ~71 tokens, most
     flagged "not recognized" noise, not a usable ingredient breakdown):
     - **Removed** the full raw-token ingredient list and its per-token "not recognized" flagging
       entirely (superseded Story 2 AC, `docs/specs/explore-composition.md` updated with full
       reasoning and a flagged follow-up: the matrix's "Ingredient count" parameter still counts
       every raw token including any non-ingredient noise — not changed in this pass, out of scope).
     - **Added** a new "Detected actives" card in its place — shows `resolvedActiveKeys` as tags
       (via `ACTIVE_INGREDIENT_LABELS`), states plainly ("No known active ingredients detected...")
       when none resolve, never silently empty.
     - **Restyled** Functional profile, Detected actives, Comparison matrix, and Routine placement
       — each keeps its own separate card, but now uses this app's existing
       `ProductInsightsPanel.tsx` visual pattern (icon-circle header + title) instead of a plain
       text title, per human reference to that component. Icons: `layers` (Functional profile),
       `droplet` (Detected actives), `grid` (Comparison matrix), `calendar` (Routine placement).
       Skin-type caution intentionally NOT restyled — kept its distinct warning-alert treatment,
       since it's a caution, not an insight panel.
     - Updated `tests/explore-composition/ExploreCompositionResultScreen.test.tsx`: removed the
       full-list/unresolved-flag assertions, added a new `detected-actives` testID section with
       fire/no-fire assertions, updated the "Ingredient count" matrix test's description (count is
       unchanged, just no longer shown as an on-screen list).
     - `npx tsc --noEmit` clean. `npx jest tests/explore-composition
     src/utils/productProfile/resolve.test.ts src/utils/productProfile/shelfComparison.test.ts
     src/utils/productProfile/skinTypeCaution.test.ts src/store/wishlistStore.test.ts`: 12/12
     suites, 121/121 tests green.
     Guardrails respected: no edits to `conflictEngine.ts`, `search-fix/`, `splitLabelText()`,
     `brandCorrection.ts`, `ProductRepository.search()`, `DeleteProductModal`.

- 2026-08-27 (user, applied directly): entry-card icons moved from above the title (column
  layout) to the left of title+subtitle (row layout) — `entryCardCompact` now `flexDirection:
  'row'`, new `entryCardTextWrap` style wraps title+subtitle in their own column next to the
  icon. `npx tsc --noEmit` clean; `npx jest tests/explore-composition`: 8/8 suites, 72/72 tests
  green.

- 2026-08-27 (user, applied directly, reverted the above): icons moved back above the title
  (column layout) per follow-up request — `entryCardCompact`/`entryCardIconWrapSmall` restored
  to their pre-row-layout state, `entryCardTextWrap` removed. `npx tsc --noEmit` clean; `npx jest
  tests/explore-composition`: 8/8 suites, 72/72 tests green.

- 2026-08-27 (user, applied directly, real-device finding): the "Save to Wishlist" modal's Brand
  field had no autocomplete — real-device testing showed only the OS keyboard's own text
  prediction, not app-level brand suggestions, even though the app already has shelf-brand
  autocomplete built (`BrandAutocompleteInput.tsx`, currently only used in `AddProductScreen`'s
  manual-entry wizard). Confirmed with the human before wiring it in, since it transitively
  imports `detectScript` from the guardrailed `brandCorrection.ts` — approved as a narrow
  exception (script detection only, not identity-matching logic; suggestion source is the user's
  own local Shelf brands + a static dictionary, never a corpus/`ProductRepository` lookup).
  Documented in `docs/specs/explore-composition.md` §3 Non-Goals and in
  `ExploreCompositionResultScreen.tsx`'s own top-of-file doc comment. Swapped the plain `Input`
  for `BrandAutocompleteInput` (Name field unchanged — no autocomplete requested for it). Updated
  the test mock for `@/store/productsStore` to add a `.getState()` static (Zustand's real API,
  which `brandLookup.ts`'s `searchBrands()` calls directly — the existing mock only supported the
  `useProductsStore(selector)` hook form) and updated the 2 test call sites that type into the
  Brand field to fire a `blur` event before pressing Save (matching the established pattern in
  `tests/add-product-flow/AddProductScreen.integration.test.tsx` — `BrandAutocompleteInput` only
  commits its typed value on blur/submit, not on every keystroke). `npx tsc --noEmit` clean;
  `npx jest tests/explore-composition src/utils/productProfile/resolve.test.ts
  src/utils/productProfile/shelfComparison.test.ts src/utils/productProfile/skinTypeCaution.test.ts
  src/store/wishlistStore.test.ts src/utils/productForm/brandLookup.test.ts`: 13/13 suites,
  130/130 tests green.

- 2026-08-27 (user, applied directly): entry-card row moved from under the Owned/Wishlist
  `PillToggle` to above it (`entryCardRow` renamed `entryCardRowAboveTabs`, now renders before
  `PillToggle` in `tabsWrap`, `marginBottom` instead of `marginTop`). Added a plum outline
  (`borderWidth: 1, borderColor: palette.plum`) to `entryCardCompact` so the cards read closer to
  buttons. `npx tsc --noEmit` clean; `npx jest tests/explore-composition`: 8/8 suites, 72/72
  tests green.

- 2026-08-27 (user, real-device layout bug): `ExploreCompositionResultScreen.tsx` was the only
  screen in this task missing `SafeAreaView` (every other screen — `ExploreCompositionCaptureScreen`,
  `ProductDetailScreen`, etc. — wraps its root in one) — its `AppHeader` rendered flush at the top
  of the screen, overlapping the status bar/notch on a real device (visible in the user's
  screenshot as the back button overlapping the clock). Root `<View style={styles.flex}>` changed
  to `<SafeAreaView style={styles.flex}>` (imported from `react-native`, same source every other
  screen in this app uses — not `react-native-safe-area-context`). `npx tsc --noEmit` clean;
  `npx jest tests/explore-composition`: 8/8 suites, 72/72 tests green (no test changes needed —
  none of the qa-lead suite's assertions depended on the root element type).

- 2026-08-27 (planner, fourth slice): New requirement from the human (direct, translated from
  Russian): every `WishlistEntry` saved via Explore Composition should get its own detail page —
  reusing the result screen's insight sections, plus a notes block — instead of being a dead-end
  Wishlist-tab row. Read this file, the spec, and the tech design in full first, including every
  same-day log entry, per instruction. Formalized as spec Story 9 and new tech-design Implementation
  Tasks FE-16..FE-23 + a Story 9 Assumptions batch. No production code written (planner scope only);
  no guardrailed files touched (`conflictEngine.ts`, `search-fix/`, `splitLabelText()`,
  `brandCorrection.ts`, `ProductRepository.search()`, `DeleteProductModal`).
  - **Reuse-seam decision** (the core design question): extracted a new `useCompositionInsights`
    hook (`src/hooks/`, mirrors the existing `useRoutineLinking.ts` convention — store reads +
    pure-builder composition) plus a `CompositionInsightsSection` presentational component
    (composing 2 newly-extracted cards — Functional profile, Detected actives — alongside the 3
    already-extracted from the second slice — `SkinTypeCautionNotice`, `CompositionComparisonMatrix`,
    `RoutinePlacementCard` — plus the disclaimer). Both `ExploreCompositionResultScreen.tsx`
    (refactored, non-behavior-changing) and the new `WishlistEntryDetailScreen.tsx` call the same
    hook and render the same section — explicitly avoids "a second, parallel implementation of the
    same insight logic" per the task's own instruction. Screen-specific, NOT shared: the identity
    header, the Notes card, and the footer actions (Save-to-Wishlist/Put-on-Shelf on the result
    screen vs. Move-to-Shelf/Delete on the detail screen).
  - **Notes field design**: `WishlistEntry.notes?: string | null` (optional — no migration needed
    for the 3 slices' worth of already-persisted entries). Editing UX mirrors
    `ProductDetailScreen.tsx`'s existing `Textarea` + local-state + onBlur-commit pattern exactly
    (grepped every `Textarea` usage in the app: only `ProductDetailScreen.tsx` and
    `ProcedureDetailScreen.tsx` use it; the latter's whole-screen explicit-Save-button pattern is a
    poorer fit since it also commits an unrelated date field together, which doesn't apply here).
    Separately grepped every `stepNote` reference in `src/` — confirmed `RoutineStep.stepNote` has
    **no manual-editing UI anywhere in this app** (engine-populated only, at plan-generation time),
    so it offered no competing interaction precedent to reuse or avoid. Persisted via a new
    `wishlistStore.updateEntry(id, patch)` action, mirroring `productsStore.updateProduct`'s exact
    shape.
  - **Empty-state design**: no new logic needed — reusing the exact same 5 components the result
    screen already ships means every section's existing independent empty-state (Functional profile/
    Detected actives/caution/matrix/routine placement) transfers automatically. Verified this holds
    even for a `WishlistEntry` with an empty/near-empty `rawIngredientsText`: every derived value
    cascades to its own already-implemented empty branch, no new top-level "nothing loaded" guard
    was designed for the whole page (this was an explicit non-goal added to spec §3).
  - **Navigation contract**: new `WishlistEntryDetail: { wishlistEntryId: string }` route in
    `CatalogStackParamList`, matching `ProductDetail: { productId: string }`'s exact id-only
    convention (checked directly in `AppNavigator.tsx` before deciding). `WishlistEntryCard`'s
    `onCardPress={() => {}}` (flagged inert by the first-slice tech-lead review) now navigates there.
    Verified in `ManualProductFormScreen.tsx` that promoting from the new screen needs no extra
    navigation-stack handling: a successful save's `finishSave()` already calls
    `navigation.navigate('Catalog', { toast })` (not `goBack()`), which unwinds the whole stack
    regardless of the new screen sitting in between; a cancelled form already just uses the default
    back action, correctly returning to the entry's detail screen untouched (spec Story 5 AC2).
  - **Actions decision (Type B assumption)**: both "Move to Shelf" and "Delete" are added to the new
    detail screen, additively — `WishlistEntryCard`'s own existing versions are unchanged, not
    removed. Rendered as two plain footer buttons (matching the exact variants the card already uses
    — primary / `variant="ghost"`), not a `ProductActionSheet`-style overflow menu, since that
    component's props are `Product`-shaped and not reusable as-is for a 2-action `WishlistEntry`
    menu. Full decision/alternative/reason recorded in the tech design's new Story 9 Assumptions
    batch (7 total, plus the reuse-mechanism assumption — 8 in all).
  - **Parallel-session note**: while writing this batch, `progress/explore-composition.md` and
    `src/screens/catalog/ExploreCompositionResultScreen.tsx` were both modified by a concurrent
    session (a real-device `SafeAreaView` fix, logged just above this entry) mid-task. Re-verified
    file mtimes/tails before and after every write in this batch; no collision occurred (this
    entry's anchors and the two doc-file anchors all matched exactly once), but the new
    `WishlistEntryDetailScreen` task (tech design FE-22) was updated to explicitly require
    `SafeAreaView` as its root element, citing that exact concurrent fix, so the same real-device bug
    isn't repeated on the new screen.
  - Tech design doc is now ~530 lines (was ~313 before this batch). Flagged, not silently ignored —
    consistent with the second slice's own precedent of appending rather than fragmenting into a
    second tech-design file for the same task-slug (per `.claude/rules/agent-layer-protocol.md`'s
    one-tech-design-per-task-slug convention).
  Status resets to `DESIGNED`; the checklist below tracks this fourth slice's own
  QA → Engineer → Review lifecycle. This does **not** invalidate the first, second, or third
  slices' `PR_REVIEW`/tech-lead `ACCEPT` verdicts recorded above, nor any of the small
  human-applied direct fixes logged after them — all of that code is unchanged, still green, still
  ready for human merge independent of this fourth slice's progress.
  Next agent: qa-lead (writes integration/component tests for Story 9 — `WishlistEntryDetailScreen`
  not-found guard, identity header, all 5 reused insight sections, Notes round-trip, Move-to-Shelf/
  Delete parity with the card, plus the `CatalogScreen` `onCardPress` wiring regression — before any
  FE-16..FE-23 production code exists, per the standard qa-lead-before-engineer lifecycle).

- 2026-08-27 (qa-lead, fourth slice): Wrote/extended the integration/component
  test suite for Story 9 (`WishlistEntryDetailScreen`) per tech design
  FE-16..FE-23, BEFORE any of that production code exists, per the standard
  qa-lead-before-engineer lifecycle. Does not touch or invalidate the first,
  second, or third slices' shipped/PR_REVIEW code.
  - New: `tests/explore-composition/WishlistEntryDetailScreen.test.tsx` —
    not-found guard (mirrors `ProductDetailScreen.tsx`'s own "Product not
    found"/"Go Back" block, adapted to "Composition not found", never
    fabricates content), identity header (name/"Untitled composition"
    fallback — same string `WishlistEntryCard` already uses, brand shown
    only when set, category badge only when `category` is set, never a
    photo/thumbnail placeholder), all 5 reused insight sections + disclaimer
    each independently populated/empty (Functional profile, Detected
    actives, Skin-type caution, Comparison matrix gated on `category`,
    Routine placement gated on `category`) using the SAME already-shipped
    testIDs (`detected-actives`, `skin-type-caution`,
    `composition-comparison-matrix`, `routine-placement`,
    `explore-result-disclaimer`) the result screen already established —
    not re-deriving their internal computation logic (already covered by
    `ExploreCompositionResultScreen.test.tsx`'s Story 6/7/8 blocks and by
    engineer's own `shelfComparison.test.ts`/`skinTypeCaution.test.ts`), a
    dedicated Non-Goal check that no single combined "nothing to show
    yet"/"nothing here yet" page-level message ever stands in for all 5
    sections, the Notes card (empty+placeholder when `notes` is null,
    pre-filled when set, commits via `wishlistStore.updateEntry(id, {
    notes })` on blur only when the text actually changed, no other field
    in the patch), and the footer ("Move to Shelf" builds the identical
    `explorePrefill` payload `CatalogScreen.tsx`'s own
    `handlePromoteWishlistEntry` already builds and never calls
    `removeEntry` itself; "Delete" calls `removeEntry(id)` then
    `navigation.goBack()`, no confirmation modal, `DeleteProductModal`
    asserted never rendered for this action — same rule as
    `WishlistEntryCard`'s own Delete).
  - Modified: `tests/explore-composition/
    CatalogScreen.wishlist-entries.enabled.test.tsx` — extended (not
    replaced) the `WishlistEntryCard` mock to also capture `onCardPress`
    alongside its two pre-existing `onDelete`/`onPromote`
    pressables/testIDs (untouched), and added a new "Story 9: tapping the
    WishlistEntryCard now navigates to WishlistEntryDetail, no longer a
    no-op" describe block asserting `navigation.navigate('WishlistEntryDetail',
    { wishlistEntryId })` fires on card press, and that it never navigates
    to `ProductDetail` for a bare `WishlistEntry`. All 5 pre-existing tests
    in this file remain green, unmodified.
  - Modified: `tests/explore-composition/fixtures.ts` — added the optional
    `notes?: string | null` field (FE-16) to `WishlistEntryLike`/
    `makeWishlistEntry`, defaulted to `null` so the two existing consumers
    (`WishlistEntryCard.test.tsx`, the just-extended
    `CatalogScreen.wishlist-entries.enabled.test.tsx`) keep
    compiling/passing unmodified — neither asserts on its absence.
  - **Did not touch** `ExploreCompositionResultScreen.test.tsx`: read it in
    full first and confirmed every existing assertion targets a testID/text
    that FE-20's `CompositionInsightsSection` extraction is required to keep
    identical (`detected-actives`, `explore-result-disclaimer`,
    `composition-comparison-matrix`, `matrix-row-*`, `skin-type-caution`,
    `routine-placement`) — so FE-21's non-behavior-changing refactor has
    nothing in this file that needs updating now; engineer's own
    verification step (already called out in the tech design's qa-lead task
    bullet) is to confirm the refactor changes no existing assertion.
  - **Judgment call — no separate `CompositionInsightsSection.test.tsx`
    file**: the tech design's own qa-lead task list (§3) names only the new
    `WishlistEntryDetailScreen.test.tsx` file and the `CatalogScreen`
    regression — it does not call for a third, standalone component-test
    file for the shared `CompositionInsightsSection`/`useCompositionInsights`
    pair. Its rendered behavior (same 5 sections, same order, same
    per-section empty states) is exercised through BOTH of its real callers
    — the untouched `ExploreCompositionResultScreen.test.tsx` and the new
    `WishlistEntryDetailScreen.test.tsx` — without inventing an unscoped
    extra suite. `useCompositionInsights` itself (a thin recomposition of
    already-tested pure builders) stays engineer's co-located
    `*.test.ts` responsibility per tech design §3/`.claude/rules/testing.md`,
    same convention as `resolveFromRawText`/`shelfComparison`/
    `skinTypeCaution`'s own internals in every prior slice.
  - **Judgment call — navigation-param-list type test skipped**: grepped
    this codebase for a convention of testing `CatalogStackParamList`
    entries at the type level (e.g. for `ProductDetail: { productId:
    string }`) and found none — every existing screen's route-param
    contract is exercised only indirectly, via a component test asserting
    the actual `navigation.navigate(...)` call shape (as this file's own
    Story 9 regression test now does for `WishlistEntryDetail`). No new
    test authored for this item, consistent with that established
    precedent.
  - New testID contracts invented here (component doesn't exist yet —
    judgment calls, flagged for engineer/tech-lead to confirm or override,
    same convention as this task's own `explore-result-disclaimer`/
    `wishlist-entry-save-confirm`): `wishlist-detail-brand` (identity
    header's brand line, present only when `entry.brand` is set),
    `wishlist-detail-category-badge` (identity header's category badge,
    present only when `entry.category` is set), `wishlist-notes-input`
    (the Notes card's `Textarea`, which spreads unknown props onto its
    underlying `TextInput` per `src/components/ui/forms/Textarea.tsx` — a
    `testID` passed to it lands on the real `TextInput`, queryable/settable
    like any other RN `TextInput` in this suite).
  - Verified red-but-correct: `npx tsc --noEmit` shows exactly 1
    "cannot find module" error (`@/screens/catalog/WishlistEntryDetailScreen`
    — the direct-import screen under test, not yet built). `npx jest
    tests/explore-composition`: 7/9 suites green (73 tests, all pre-existing
    slices' suites fully unaffected/unmodified where not touched above), 2
    suites fail — `WishlistEntryDetailScreen.test.tsx` fails purely on module
    resolution (confirmed via the actual Jest "Configuration error: Could not
    locate module" output, the same documented pattern every prior slice's
    not-yet-built screen/component has hit), and
    `CatalogScreen.wishlist-entries.enabled.test.tsx` has exactly 1 new
    failing test (the FE-23 onCardPress wiring, confirmed via the actual
    assertion diff — `navigation.navigate` called 0 times, since
    `CatalogScreen.tsx` still has its old `onCardPress={() => {}}`) with its
    other 5 pre-existing tests green. Re-ran the full
    `tests/explore-composition/` + co-located unit-test set
    (`resolve.test.ts`, `shelfComparison.test.ts`, `skinTypeCaution.test.ts`,
    `wishlistStore.test.ts`) once more with the new suite excluded to confirm
    zero regressions: 7/8 suites, 73/74 tests green outside the one expected
    new failure, plus 49/49 unit tests green.
  - No unit tests written for pure logic (`useCompositionInsights`'s own
    internals) — engineer's co-located `*.test.ts` responsibility per the
    tech design's own task split (§3), same convention as every prior slice.
  Guardrails respected: no edits to `conflictEngine.ts`, `search-fix/`,
  `splitLabelText()`, `brandCorrection.ts`, `ProductRepository.search()`;
  `DeleteProductModal` asserted never rendered for the new screen's Delete
  action (in addition to the pre-existing `WishlistEntryCard` guardrail).
  Next agent: engineer (per `.claude/rules/agent-layer-protocol.md` §12).

- 2026-08-27 (engineer, fourth slice): Presented the implementation plan (files to
  create/modify, one line each) per Step 0's mandatory human-approval gate; approved
  as presented with no changes. Implemented FE-16..FE-23 exactly per the approved plan
  and the qa-lead test contract above.
  - FE-16: `src/types/index.ts` — added `WishlistEntry.notes?: string | null`.
  - FE-17: `src/store/wishlistStore.ts` — added `updateEntry(id, patch)`, mirroring
    `productsStore.updateProduct`'s exact map-and-persist shape. `src/store/
    wishlistStore.test.ts` — 4 new cases (patch-one-leaves-others-untouched,
    add-then-update-then-read-back round trip, no-op on an unknown id, only-the-given-
    field-changes).
  - FE-18: new `src/hooks/useCompositionInsights.ts` — mirrors `useRoutineLinking.ts`'s
    convention (reads `useProductsStore`/`useProfileStore` internally, returns computed
    values). Moved the exact `useMemo` chain that used to live inline in
    `ExploreCompositionResultScreen.tsx` here verbatim (`resolveFromRawText` →
    `tokenizeIngredientsText` → `joinActiveKeys` → `buildCapabilities` → capability-tag
    filter → `buildSkinTypeCaution` → `buildShelfComparison`/`buildRoutinePosition`, both
    gated on `category !== null`) — no new detection/matching logic. Returns
    `{ capabilityTags, resolvedActiveKeys, skinType, skinTypeCaution, shelfComparison,
    routinePosition }`. New co-located `useCompositionInsights.test.ts` (`renderHook` from
    `@testing-library/react-native`, mocking `productsStore`/`profileStore` only — the
    real `resolve.ts`/`join.ts`/`capabilities.ts`/`shelfComparison.ts`/
    `skinTypeCaution.ts`/`routinePosition.ts` pipeline runs for real): resolved-keys/
    capability-tag derivation via the real pipeline (glycolic-acid → `aha` → fires the
    caution independent of `skinType`), `skinType` passthrough from `profileStore`,
    `shelfComparison`/`routinePosition` both null when `category` is `null` and both
    real/populated when it's set, `shelfComparison` reflects a live `productsStore` read.
  - FE-19: new `src/components/catalog/FunctionalProfileCard.tsx` and
    `DetectedActivesCard.tsx` — lifted verbatim (same JSX/copy/testIDs, including
    `detected-actives`) from `ExploreCompositionResultScreen.tsx`'s previously-inline
    `Card` blocks. Pure extraction, no visual/copy change.
  - FE-20: new `src/components/catalog/CompositionInsightsSection.tsx` — composes
    `FunctionalProfileCard` → `DetectedActivesCard` → `SkinTypeCautionNotice` →
    `CompositionComparisonMatrix` (only when `shelfComparison` is non-null) →
    `RoutinePlacementCard` (only when `routinePosition` is non-null) → the disclaimer
    (`testID="explore-result-disclaimer"`, copied verbatim). Purely presentational —
    takes `useCompositionInsights`' output as props, no store/hook access of its own.
  - FE-21: `ExploreCompositionResultScreen.tsx` refactor — replaced the inline `useMemo`
    chain with one `useCompositionInsights(rawIngredientsText, category)` call and the
    inline Functional-profile/Detected-actives/disclaimer JSX + the 3 already-extracted
    components with one `<CompositionInsightsSection {...insights} />`. Removed the
    now-dead `CAPABILITY_ORDER` const, `Card`/`Tag`/orchestrator imports, and the
    now-unused `card*`/`tagRow`/`mutedText`/`disclaimer*` styles (and the `palette`/
    `radius` token imports they alone needed). Non-behavior-changing: verified every
    existing testID/text assertion in `ExploreCompositionResultScreen.test.tsx` still
    passes unmodified (35/35 green, file untouched by this slice).
  - FE-22: new `src/screens/catalog/WishlistEntryDetailScreen.tsx`, registered in
    `CatalogStackParamList`/`AppNavigator.tsx` as `WishlistEntryDetail: { wishlistEntryId:
    string }` (mirrors `ProductDetail: { productId: string }`'s exact id-only shape). Not-
    found guard mirrors `ProductDetailScreen.tsx`'s own block verbatim (`InlineAlert
    tone="sos" title="Composition not found"` + "Go Back" → `navigation.goBack()`). Root
    `SafeAreaView` (from `react-native`, matching every other screen in this app,
    including the just-fixed `ExploreCompositionResultScreen.tsx` — 2026-08-27
    real-device finding logged above). Renders `AppHeader` (title = `entry.name ??
    'Untitled composition'`, same fallback `WishlistEntryCard.tsx` already uses) → a
    text-only identity block (`testID="wishlist-detail-brand"` only when `entry.brand` is
    set, name, `testID="wishlist-detail-category-badge"` wrapping a `Badge`/
    `getProductTypeBadgeStatus`/`PRODUCT_TYPE_LABELS` only when `entry.category` is set —
    no photo, `WishlistEntry` has no image field) → `CompositionInsightsSection` (FE-20,
    fed by `useCompositionInsights(entry.rawIngredientsText, entry.category)`) → a Notes
    card mirroring `ProductDetailScreen.tsx`'s exact `Textarea` (`testID=
    "wishlist-notes-input"`) + local-state + onBlur-commit pattern, calling
    `updateEntry(entry.id, { notes })` only when the trimmed text actually changed → a
    footer with "Move to Shelf" (primary, builds the identical `explorePrefill` payload
    `CatalogScreen.tsx`'s `handlePromoteWishlistEntry` already builds, never calls
    `removeEntry`) and "Delete" (`variant="ghost"`, calls `removeEntry(entry.id)` then
    `navigation.goBack()`, no confirmation modal — never imports `DeleteProductModal`).
  - FE-23: `src/screens/CatalogScreen.tsx` — replaced `WishlistEntryCard`'s
    `onCardPress={() => {}}` with `onCardPress={(e) =>
    navigation.navigate('WishlistEntryDetail', { wishlistEntryId: e.id })}`, matching the
    same shape already used for `ProductDetail` two render-functions above it.
  - **TypeScript note (not a design deviation):** `handleMoveToShelf`/`handleDelete` in
    `WishlistEntryDetailScreen.tsx` are declared as `const ... = () => {...}` (arrow
    function expressions), not `function ...() {...}` declarations — a hoisted function
    declaration referencing `entry` after the not-found guard's early return does not
    retain TypeScript's narrowed (`entry` non-null) type the way a non-hoisted `const`
    arrow function does, which `tsc --noEmit` flagged as 7 `'entry' is possibly 'null'`
    errors. Switched to arrow functions, matching this same screen's own
    `handleNotesBlur` and `ProductDetailScreen.tsx`'s equivalent handlers — no behavior
    change, purely a TS-narrowing fix.
  - Verified green: `npx tsc --noEmit` clean. `npx jest tests/explore-composition
    src/hooks/useCompositionInsights.test.ts src/store/wishlistStore.test.ts
    src/utils/productProfile/resolve.test.ts src/utils/productProfile/shelfComparison.test.ts
    src/utils/productProfile/skinTypeCaution.test.ts`: 14/14 suites, 166/166 tests green
    (includes qa-lead's full `WishlistEntryDetailScreen.test.tsx` and the
    `CatalogScreen.wishlist-entries.enabled.test.tsx` Story 9 regression, both fully
    green; `ExploreCompositionResultScreen.test.tsx` unmodified and green). Full-repo
    regression: `npx jest --testPathIgnorePatterns="worktrees"` — 10 failed / 183 passed
    suites (2216 tests, 2133 passed) — the exact same 10 pre-existing failing suites
    already documented in the second-slice engineer_summary (stale `shadow`/`palette`
    token mocks in `tests/product-shelf-card/ProductShelfCard.test.tsx`,
    `tests/catalog/{catalog-screen,catalog-screen-hide-toggle.integration,product-detail,
    add-product-hub,product-shelf-card-hidden}.test.tsx`,
    `tests/routines/weekly-plan-view-hidden-filter.test.tsx`,
    `tests/shelf-filtering/PaoChip.integration.test.tsx`,
    `tests/product-images/RoutineCalendarView.test.tsx`,
    `tests/inci-attribution-highlighting/DetectedActiveBadgeWiring.test.tsx`) — none touch
    any file this slice created/modified; zero new regressions.
  - Guardrails respected: grepped every new/modified file for `conflictEngine`/
    `search-fix`/`splitLabelText`/`brandCorrection`/`ProductRepository.search`/
    `DeleteProductModal` — only doc-comment mentions (explaining what is deliberately
    NOT called/imported) and pre-existing, untouched code (`CatalogScreen.tsx`'s existing
    owned-product `DeleteProductModal` usage, its pre-existing `PAO_AMBER` hex) matched;
    no new call sites/imports. No `console.log`/`debugger`/`TODO`/`FIXME`/`@ts-ignore` in
    any new/modified file. No new hardcoded hex colors.
  Ready for tech-lead review.

- 2026-08-27 (tech-lead, fourth-slice review): **ACCEPTED — PR_REVIEW.** Independently verified
  (not just trusted from engineer's report): re-ran `npx tsc --noEmit` (clean) and
  `npx jest tests/explore-composition src/hooks/useCompositionInsights.test.ts
  src/store/wishlistStore.test.ts src/utils/productProfile/resolve.test.ts
  src/utils/productProfile/shelfComparison.test.ts src/utils/productProfile/skinTypeCaution.test.ts`
  myself (14/14 suites, 166/166 tests). Read every new/modified file in full
  (`WishlistEntryDetailScreen.tsx`, `useCompositionInsights.ts`, `CompositionInsightsSection.tsx`,
  `FunctionalProfileCard.tsx`, `DetectedActivesCard.tsx`, `wishlistStore.ts`/`types/index.ts`/
  `AppNavigator.tsx` diffs, `CatalogScreen.tsx`'s `onCardPress` wiring,
  `ExploreCompositionResultScreen.tsx`'s refactor). Confirmed the extraction is genuinely
  non-behavior-changing (`ExploreCompositionResultScreen.test.tsx` passes unmodified, 35/35).
  Guardrail greps re-run directly: no `conflictEngine`/`search-fix`/`splitLabelText`/
  `ProductRepository.search` call sites; `DeleteProductModal` never imported by the new screen;
  the pre-existing `brandCorrection.ts`/`detectScript` exception (already approved earlier today)
  unaffected. No hardcoded hex, no console.log/TODO/FIXME/@ts-ignore in any new/modified file.
  **One WARNING, non-blocking:** `WishlistEntryDetailScreen.tsx` calls `useCompositionInsights`
  (itself a hook, via internal `useMemo`s) *after* its own not-found early-return — a genuine
  Rules-of-Hooks violation (hook count could differ between renders if `entry` ever flips from
  missing to found within one mount). Not a regression introduced by this slice: it faithfully
  mirrors an identical pre-existing pattern already in `ProductDetailScreen.tsx` (its own
  `useMemo` is likewise called after that screen's not-found guard), per this slice's own explicit
  instruction to mirror that screen's structure. Low practical risk given normal navigation
  patterns (an id-valid entry doesn't typically go missing without the screen unmounting first).
  Flagged for a future cleanup pass across both screens (hoist the guard-independent hook calls
  above the early return), not required before merge. No other findings. Fourth slice is ready
  for human merge alongside the first three.

- 2026-08-27 (user, real-device finding): the Composition result screen's two footer buttons
  didn't both fit without text truncation — renamed "Put on My Shelf" → **"Put on Shelf"** and
  "Save to Wishlist" → **"Add to Wishlist"** (also renamed the wishlist-save modal's own title for
  consistency, since it's opened directly by that button). Scoped to
  `ExploreCompositionResultScreen.tsx` only — `ManualProductFormScreen.tsx`/`AddProductScreen.tsx`/
  `SaveBar.tsx` share similar-looking copy for an unrelated, pre-existing app-wide save button and
  were deliberately left untouched. Updated `tests/explore-composition/
  ExploreCompositionResultScreen.test.tsx`'s functional `getByText`/`fireEvent.press` queries to
  the new labels (8 occurrences), plus `docs/specs/explore-composition.md` (Story 3/4 ACs, §5 UX)
  and `docs/tech-design/explore-composition.md` (architecture diagram, FE-5 task description).
  `npx tsc --noEmit` clean; `npx jest tests/explore-composition`: 9/9 suites, 103/103 tests green.

- 2026-08-27 (user, product decision reversal, applied directly): on the capture screen,
  **Category is now required** (was optional through the first three slices) — neither the photo
  nor paste path opens without a category chip selected; pressing either without one shows an
  inline error ("Please select a category to continue.") instead, which clears once a chip is
  tapped. Reason: Stories 6/8 (comparison matrix, routine placement) only render when `category`
  is set, so an optional category was silently producing a thinner result screen whenever skipped.
  Also **moved the Category chip block above the capture block** (was below it), and **restyled
  the "Category" label** to black/`DMSans-Medium`/16px (was `typography.label`, 14px/secondary
  color) — new `categoryLabel` style replaces the old `sectionLabel`. `WishlistEntry.category`'s
  type is unchanged (still nullable) — this is a capture-time UI requirement, not a data migration;
  historical entries may still have `null`. Updated
  `tests/explore-composition/ExploreCompositionCaptureScreen.test.tsx`: rewrote the "Category
  capture" describe block (2 new tests asserting both paths are blocked with the inline error and
  never open the camera/paste modal, 1 new test for the clear-on-select flow), and added a category
  selection to 3 pre-existing tests that previously relied on category being skippable. Updated
  `docs/specs/explore-composition.md` (§5 capture-screen paragraph, §6 Data Requirements) and
  `docs/tech-design/explore-composition.md` (FE-2 task line, new reversed Assumption with full
  decision/alternative/reason). `npx tsc --noEmit` clean; `npx jest tests/explore-composition`:
  9/9 suites, 105/105 tests green.

- 2026-08-27 (user, design reference, applied directly): capture screen redesigned per a human
  design reference image. Added a headline ("Understand what's inside a product") + subheadline
  ("Select the product category and add the ingredient list to get a detailed analysis.") above
  the category chips — headline deliberately says "a product," not "your product" (the one
  correction the human explicitly called out, since the item isn't owned yet in this pre-purchase
  flow, per Story 1's own framing). No hero illustration — not available yet, per the human's own
  note. The photo action now reuses `ScanTile` (`src/components/addProduct/ScanTile.tsx` — an
  existing dashed-border camera-launch tile already shared by the manual-entry wizard's sections,
  not a new component) instead of a filled `Button`: "Take a photo" + caption "Photograph the
  ingredient list on the label". The paste action renamed "Enter / paste text" → **"Paste text
  manually"**, still a plain `Button variant="textActive"` text link — the primary/secondary
  hierarchy from 06 is unchanged, only the primary action's own presentation changed. Removed the
  now-unused `captureIconWrap` style and the `palette` import (no longer referenced once ScanTile
  owns its own icon); `captureBlock` no longer forces `alignItems: 'center'` (was shrinking its
  children to content width instead of letting ScanTile stretch full-width) — new `pasteLinkBtn:
  { alignSelf: 'center' }` centers the paste link under the now-full-width tile instead.
  Rewrote `tests/explore-composition/ExploreCompositionCaptureScreen.test.tsx` comprehensively:
  new describe block asserting the headline/subheadline copy (including the no-"your"-product
  regression check), rewrote the primary/secondary hierarchy test around the ScanTile/Button
  structural distinction (photo is provably not the mocked `Button` at all, paste still is),
  updated every `getByText`/`fireEvent.press` query across the file to the new labels. Updated
  `docs/specs/explore-composition.md` (Story 1 AC, §5 capture-screen paragraph) and
  `docs/tech-design/explore-composition.md` (FE-2 task line). `npx tsc --noEmit` clean;
  `npx jest tests/explore-composition`: 9/9 suites, 107/107 tests green.

- 2026-08-27 (user, applied directly): removed the divider line between the category chips and
  the capture block on the redesigned capture screen (unused `divider` style also removed). `npx
  tsc --noEmit` clean; `npx jest tests/explore-composition/ExploreCompositionCaptureScreen.test.tsx`:
  13/13 tests green.

- 2026-08-27 (user, follow-up simplification, applied directly): consolidated the headline+
  subheadline pair into a single headline — **"To get a detailed analysis, select a category and
  add the ingredient list."** — replacing both "Understand what's inside a product" and the
  separate subheadline sentence; `headline` style changed from `typography.h2` (28px) to `h3`
  (22px), more appropriate for a full sentence than a short title. Also reverted the category
  label back to just **"Category"** (was briefly "Select category"). Updated
  `tests/explore-composition/ExploreCompositionCaptureScreen.test.tsx`: merged the two headline/
  subheadline tests into one, and fixed a real test-collision this surfaced — the new headline's
  own copy contains the phrase "select a category," which the existing `/select a category/i`
  regex (meant to match the inline validation error) started matching too, giving a
  "multiple elements found" failure; tightened all 4 occurrences to `/please select a category/i`
  (unique to the actual error text) rather than loosening/removing the assertion. Updated
  `docs/specs/explore-composition.md`'s capture-screen paragraph. `npx tsc --noEmit` clean;
  `npx jest tests/explore-composition`: 9/9 suites, 106/106 tests green.

- 2026-08-27 (user, real-device finding, cross-cutting infra fix): after "Put on Shelf",
  `ManualProductFormScreen.tsx`'s Brand field had NO autocomplete at all (unlike the
  Save-to-Wishlist modal's `BrandAutocompleteInput`, added earlier today) — and even with one
  added, the user's actual brand might only exist in the ~21k-product corpus, not their own local
  Shelf + the small static seed dictionary `searchBrands()` uses. Investigated the corpus service
  layer first (`src/services/corpus/ProductRepository.ts`, `src/services/turso/httpClient.ts`) —
  confirmed the corpus is queried live over Turso HTTP (no local SQLite file despite
  `assets/corpus/vials_corpus.db` still existing on disk — it's unreferenced dead weight, not
  wired into any build config), and that `createTursoHttpClient()` is a plain importable function
  (not a hook), usable directly from a non-component utility. Implemented both fixes:
  - `src/services/corpus/ProductRepository.ts`: new `searchBrands(prefix)` method —
    `SELECT DISTINCT brand ... WHERE brand LIKE ? ESCAPE ...`, same case-variant/escape helpers
    `search()` already uses, same graceful-fallback-on-error convention as `getActiveKeys`
    (never blocks typing a brand by hand). New `ProductRepository.test.ts` coverage (empty-prefix
    short-circuit, prefix-not-substring query shape, LIKE-escaping, error fallback).
  - `src/utils/productForm/brandLookup.ts`: new `searchBrandsWithCorpus(query)` — calls the
    existing local-only `searchBrands()` first, then merges in corpus results (deduped
    case-insensitively, local results first, capped at 8) via `createTursoHttpClient()` +
    `ProductRepository`; falls back to local-only silently if the corpus client isn't configured.
    Kept as a SEPARATE export from `searchBrands` specifically so
    `ExploreCompositionResultScreen.tsx`'s Save-to-Wishlist modal (guardrailed — must stay
    local-only) is structurally unable to accidentally pick up corpus access. New test coverage
    in `brandLookup.test.ts` (no-client fallback, dedup-and-merge, 8-item cap).
  - `src/components/addProduct/BrandAutocompleteInput.tsx`: new optional `searchFn` prop
    (defaults to `searchBrands`) so call sites can inject a different suggestion source without
    the component needing to know about corpus access itself.
  - `src/screens/ManualProductFormScreen.tsx`: Brand field's plain `Input` replaced with
    `BrandAutocompleteInput` passing `searchFn={searchBrandsWithCorpus}` — this screen has no
    Explore Composition guardrail (already uses `useProductRepository()` elsewhere, is the shared
    completion form for both the ordinary "Add new" wizard and this flow's own "Put on
    Shelf"/"Move to Shelf" step).
  - Fixed `tests/explore-composition/ManualProductFormScreen.explore-prefill.test.tsx`'s
    `saveWithName` helper: added a `blur` event on the Brand field before pressing Save (same
    debounced-commit pattern as every other `BrandAutocompleteInput` integration today) — the only
    test across 4 `ManualProductFormScreen`-related suites that interacted with the Brand field
    directly; the other 3 (`contribution-consent-flow`, `product-images`, `conflict-matrix-expansion`)
    don't touch it and needed no changes.
  Updated `docs/specs/explore-composition.md` §3 Non-Goals with the guardrail-preservation note.
  `npx tsc --noEmit` clean. Full regression check: `npx jest tests/explore-composition
  tests/add-product-flow tests/contribution-consent-flow tests/product-images
  tests/conflict-matrix-expansion src/services/corpus src/utils/productForm` — 38/39 suites, only
  failure is `tests/product-images/RoutineCalendarView.test.tsx`, already documented as a
  pre-existing, unrelated failure (stale-copy issue predating this entire task).

- 2026-08-27 (user, copy shortening, applied directly): capture screen headline shortened again —
  **"Choose a category and add the ingredients to see the details."** (was "To get a detailed
  analysis, select a category and add the ingredient list.") — action first, the "why" moved to a
  brief trailing clause instead of a long lead-in. Updated the matching test assertion and
  `docs/specs/explore-composition.md`'s capture-screen paragraph. `npx tsc --noEmit` clean; `npx
  jest tests/explore-composition/ExploreCompositionCaptureScreen.test.tsx`: 12/12 tests green.

- 2026-08-27 (tech-lead review, then user-requested fix, applied directly): full working-tree
  review performed directly (see REVIEW SUMMARY at the top of this file) — ACCEPT verdict, 3
  findings, 2 fixed inline (stale doc-vs-code mismatches in spec §10 and tech design FE-2), 1
  accepted as pre-existing/non-blocking (`WishlistEntryDetailScreen.tsx`'s Rules-of-Hooks pattern,
  mirrors `ProductDetailScreen.tsx`). User then asked to resolve Story 2's "Ingredient count still
  counts OCR noise" follow-up specifically (root fix, not a display-only patch); user separately
  confirmed `feature/ocr-improvement` stays paused and out of scope.
  - New `src/utils/productProfile/ingredientSectionExtractor.ts` (+ co-located test, 9 cases): pure
    function `extractIngredientSection(text)` scanning 47 curated Directions/Warnings/
    manufacturer-metadata marker phrases (case-insensitive, whole-phrase match — deliberately
    excludes bare single verbs like "use"/"apply" to avoid false-triggering on marketing copy) and
    cutting the text at the first one found, gated behind a "at least one comma already seen"
    guard so a false-early match can't discard a real short ingredients list.
  - Wired into `ExploreCompositionCaptureScreen.tsx`'s `goToResult` — the single point both the
    photo and paste paths already converged on before navigating — so the cut happens once,
    before the text is ever stored on a `WishlistEntry` or read by `useCompositionInsights`, not
    as a per-consumer patch. One new regression test added to that screen's own suite (paste path,
    Directions + manufacturer noise both present).
  - Deliberately does NOT touch `ocrTextCleaner.ts`/`CameraCaptureModal.tsx` (the Add Product
    wizard's shared OCR pipeline) — scoped to Explore Composition's own capture path, matching
    `resolveFromRawText`'s own existing scope. Shelf products captured through the ordinary wizard
    may still carry this noise in their own `fullIngredientText`, still inflating
    `shelfComparison.ts`'s `shelfIngredientCountAverage` — a separate, pre-existing gap, documented
    in spec Story 2, not touched here.
  - Updated `docs/specs/explore-composition.md` Story 2's follow-up note from "not resolved" to
    resolved, with the scope boundary spelled out.
  `npx tsc --noEmit` clean; `npx jest src/utils/productProfile/ingredientSectionExtractor.test.ts
  tests/explore-composition`: 10/10 suites, 116/116 tests green.

- 2026-08-28 (user, real-device follow-up round, applied directly): committed the four-slice
  feature (`fdb5b26` config fix, `44df32a` feature) after user explicitly confirmed
  `EXPLORE_COMPOSITION_ENABLED` should ship ON rather than reverted — Wishlist-tab-presentation
  (spec §10) accepted as a non-blocking follow-up, not a reason to gate the flow; the flag's own
  doc comment in `featureFlags.ts` rewritten to record this as a decision, not leftover test
  scaffolding. Then a further round of device-testing fixes, all on top of that commit:
  - `WishlistEntryCard.tsx`: "Move to Shelf" → `variant="secondary"`; "Delete" → "Remove" (matches
    `WishlistProductCard.tsx`'s existing wording). Test updated to match.
  - **Bug: "Wishlist · N" tab counter read 0 after saving a composition.** `CatalogScreen.tsx`'s
    counter only ever summed `wishlistProducts.length` (real Products), never `wishlistEntries`.
    Fixed to `wishlistProducts.length + wishlistEntries.length` (gated on
    `EXPLORE_COMPOSITION_ENABLED`, consistent with every other read of that array in this file).
  - **Bug: "Nothing here yet" empty state rendered underneath a real WishlistEntry card.** The
    Wishlist tab's `FlatList` `data` is still just `wishlistProducts`, so it stayed "empty" (and
    rendered its own empty state) even once the header above it had shown a real entry card.
    `ListEmptyComponent` now resolves to `null` whenever `wishlistEntries.length > 0`.
  - "Explored compositions" section heading removed (user request) — `wishlistEntriesLabel` style
    deleted as dead code alongside it.
  - Entry cards ("Add new"/"Explore"): icon moved from a leading `plumTint`-circle badge to an
    absolutely-positioned top-right corner icon (per a user-supplied visual reference), card
    background set to `palette.plumTintLight` (the token tokens.ts already reserves for exactly
    this — a lighter wash than `plumTint`, for exactly the "would read too saturated" fill case).
    Title font iterated 14px/label → 16px/body+Medium → reverted back to 14px/`typography.label`
    per an explicit "step back" — net change from the pre-round baseline is None (still
    `typography.label`), only the code got slightly cleaner (was `bodySmall` + manual
    `fontFamily` override, now the canonical `label` token directly).
  - **Bug: `BrandAutocompleteInput`'s suggestion dropdown pushed the rest of the modal down**
    (Name field, Save button) instead of floating over it — real-device screenshot showed Name/Save
    shoved off-screen under the keyboard. Root cause: the dropdown was a normal-flow sibling of the
    Input. Fixed in the shared component itself (benefits every call site, not just the Wishlist
    modal): dropdown is now `position: 'absolute'` anchored via `top: '100%'`, split into an outer
    shadow/position layer and an inner rounded-corner-clip layer (`overflow: 'hidden'` and a shadow
    can't share one view on iOS), and the component's own root view got `zIndex: 10` so it — and
    the dropdown escaping its bounds — paints above later siblings (Name/Save) instead of behind
    them. **No automated test for this one** — RNTL doesn't run real layout, so there's nothing a
    component test can assert about an absolute-position overlay; verified by reasoning through the
    Yoga/zIndex model only, real-device confirmation still pending.
  Added 2 new tests to `CatalogScreen.wishlist-entries.enabled.test.tsx` (counter math, both empty-
  state branches) with an `afterEach` restoring the productsStore/wishlistStore mock
  implementations these tests override, so later tests in the same file don't inherit an emptied
  fixture. `npx tsc --noEmit` clean; `npx jest tests/explore-composition tests/add-product-flow
  src/components src/hooks src/store src/utils/productProfile src/services/corpus
  src/utils/productForm`: 39/39 suites, 447/447 tests green.
