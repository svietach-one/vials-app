# Vials — Explore Composition Flow
Date: 2026-08-26
Author: planner-agent
Jira: N/A (kebab-case task slugs only — see `.claude/rules/agent-layer-protocol.md` §1)
Status: APPROVED (first slice shipped to `PR_REVIEW` 2026-08-26 — see `progress/explore-composition.md`.
This same-day revision formalizes a second, human-approved decision batch: the comparison matrix,
the skin-type caution signal, and routine placement are now in scope — see Story 6/7/8 and the §3
reversal note below. This 2026-08-27 revision adds Story 9: every saved `WishlistEntry` now gets
its own detail screen, reusing the same insight sections rather than a second implementation. Only
the Wishlist-tab-presentation item in §10 remains genuinely open.)

## AI-SDLC flags
- `backend_layer`: false — this app is frontend-only (Expo/React Native, local storage, no server
  component owned by this repo; per `docs/tech-design/product-profile-m1.md`'s identical convention).
- `frontend_layer`: true
- `infra_changes`: false

## 1. Problem Statement
Users often want to evaluate a skincare product's ingredient list *before* buying it — standing in a
store aisle, time-pressured, with the physical product in hand or looking at a website. Today,
Vials' only "add" entry points (`Add new` / `Explore new` on the Catalog tab) both route through the
same full brand + product-name identification pipeline (corpus search, brand-logo OCR). A user who
just wants to check ingredients has no lightweight path that skips identification, and no place to
keep a "still deciding" composition that isn't yet a fully-identified catalog product. Once they do
see a composition's breakdown, they also have no honest way to judge it against what's actually on
their own Shelf, or against their own skin type, without the app inventing scores it can't back up.

## 2. Goals
- A user can capture an ingredient list (photo of the label, or pasted text) with zero brand/name
  input required, in one short screen.
- The captured composition is reviewed using only real, already-existing product-intelligence data
  (functional tags, unrecognized-ingredient flags) — no invented scores, percentages, or matches.
- The user can save the reviewed composition to a lightweight Wishlist (identity optional) or commit
  it straight to their Shelf (identity required), reusing whatever was already captured.
- Raw OCR/pasted text is persisted the moment capture completes, before any parsing or navigation, so
  the source evidence is never lost even if parsing produces a poor result.
- When a category was captured, the user can see the composition compared against their own similar
  Shelf items, get a plain-language caution when an active commonly needs extra care for their skin
  type, and see roughly where it would sit in a routine — all still with no invented numbers.

## 3. Non-Goals (explicitly out of scope)
> **2026-08-26 reversal note:** the first implementation pass listed "no comparison matrix or
> routine-placement section" below as a Non-Goal, deferred pending product sign-off on 5 proposed
> parameters. The human has since finalized this: a 4-parameter comparison matrix and routine
> placement are now in scope — see Story 6/7/8. This is a deliberate reversal of that prior decision,
> not an oversight or documentation drift. The originally-proposed 5th matrix parameter (skin-type
> suitability) was dropped from the matrix entirely; a related but structurally separate caution
> signal ships instead (Story 7), never as a matrix row.

- No brand or product-name recognition anywhere in this flow. `splitLabelText()`,
  `ProductRepository.search()`, and `brandCorrection.ts`'s actual brand-matching logic are never
  invoked from this flow. **Narrow, human-approved exception (2026-08-27):** the Save-to-Wishlist
  modal's Brand field reuses `BrandAutocompleteInput` (real-device finding — no autocomplete on a
  manual-entry field the user is explicitly typing into by hand felt broken, and the app already
  has this exact suggestion mechanism elsewhere), which transitively imports `detectScript` from
  `brandCorrection.ts` — script detection only, not that module's identity-matching logic. Its
  suggestion source is purely local (the user's own Shelf brands + a static seed dictionary),
  never a corpus/`ProductRepository` lookup, and it never attempts to identify the captured
  composition itself. **This is still true after 2026-08-27's follow-up:** a second, corpus-backed
  suggestion function (`searchBrandsWithCorpus`, `src/utils/productForm/brandLookup.ts`) was added
  for `ManualProductFormScreen.tsx`'s own Brand field (real-device finding — that screen's Brand
  field had no autocomplete at all, and once one is added, users expect the full ~21k-product
  corpus, not just their own Shelf). `BrandAutocompleteInput` now takes an injectable `searchFn`
  prop specifically so the two call sites can diverge: this flow's Save-to-Wishlist modal keeps
  passing no `searchFn` (defaults to the local-only `searchBrands`), while
  `ManualProductFormScreen.tsx` explicitly opts into `searchBrandsWithCorpus` — a screen this
  guardrail was never about (it already calls `useProductRepository()`/corpus access elsewhere,
  and is the shared completion form for both the ordinary "Add new" wizard and Explore
  Composition's own "Put on Shelf"/"Move to Shelf" step, which is a genuine manual
  product-identification step, not the composition-analysis flow itself).
- No conflict-check UI on the result screen — `conflictEngine.ts` gets no new call sites here.
- No % match / identification-confidence badge, no efficacy/quality score, no per-concern
  percentages, no allergen/fragrance/preservative breakdown, no usage/application section.
- No merge of the new `WishlistEntry` store with the pre-existing `CatalogScreen.tsx` "Wishlist · N"
  tab's `catalogStore` products (`status: 'wishlist'`) into one data source — two stores remain;
  only their on-screen presentation is unified (see tech design Assumption 5).
- `Add new`'s existing routing, OCR pipeline, and corpus-matching logic are unchanged — only its
  visual treatment (button → card) changes.
- The skin-type caution signal (Story 7) is not the removed 5th matrix parameter — it is a binary,
  sometimes-entirely-absent notice, never a suitability score, ranking, or matrix row.
- Routine placement (Story 8) shows only the phase-label position — it does not surface AM/PM
  eligibility, rinse-off status, or add this composition to any actual `RoutineStep`/`routinesStore`
  entry. It is a descriptive hint, not scheduling.
- The comparison matrix's shelf-comparison basis is a purely local `productsStore` read — no new
  network call, corpus lookup, or community/aggregate data source is introduced by this batch.
- **2026-08-27 addition (Story 9):** the new `WishlistEntryDetailScreen` does not make brand, name,
  or category inline-editable — those stay editable only through the existing "Move to Shelf"
  completion form, exactly as today. Only the new notes field is directly editable on this screen.
- **2026-08-27 addition (Story 9):** no new page-level empty-state pattern is introduced. The detail
  screen reuses the exact per-section empty states `ExploreCompositionResultScreen.tsx`'s components
  already implement — it does not add a separate "nothing here yet" banner for the whole page.

## 4. User Stories

### Story 1: Capture a composition without identifying the product
As a shopper in a store, I want to photograph or paste an ingredient list without naming the brand
or product, so that I can evaluate it before deciding to buy.

**Acceptance Criteria:**
- [x] Given the Catalog tab, when I tap the `Explore new` card, then I see a capture screen with a
      "Take a photo" tile (`ScanTile`) as the primary action and a "Paste text manually" secondary
      text link below it. **Supersedes 2026-08-27** (product decision,
      `docs/tasks/explore ingredient/06-capture-screen-hierarchy.md`): the original "two
      equally-weighted options" framing is deliberately replaced with a primary/secondary hierarchy
      — most real-world usage is in-store with the physical product in hand, so photo is the
      default path, not a coin-flip. Paste remains fully functional and reachable, just visually
      secondary. **Presentation updated again 2026-08-27** (design-reference redesign): the primary
      action's own control changed from a filled `Button` to `ScanTile` (labels also renamed:
      "Photograph the ingredient list" → "Take a photo", "Enter / paste text" → "Paste text
      manually") — the primary/secondary weighting itself is unchanged, this is still a
      visual-hierarchy change only, no behavior/logic change.
- [ ] Given I photograph an ingredient list, when OCR completes, then the raw recognized text is
      persisted immediately, before any further navigation.
- [ ] Given I paste ingredient text instead, when I submit it, then the same immediate persistence
      applies, with no OCR step involved.
- [ ] Given either capture method completes, when I view any screen in this flow, then no brand/name
      input field is present anywhere.

### Story 2: Review a composition's honest breakdown
As a user who just captured an ingredient list, I want to see a functional tag summary and the
active ingredients we could actually identify, so I can judge the product without being shown
fabricated confidence or an unreadable wall of OCR noise.

**Acceptance Criteria:**
- [x] Given a captured composition, when the result screen renders, then it shows a functional-profile
      tag list (plain tags, no scores/ranking), a **Detected actives** list, and a disclaimer footer
      — nothing else besides what Stories 6/7/8 add when a category is set.
- [x] **Superseded 2026-08-27** (product decision, real-device testing finding): the full raw-token
      ingredient list with per-token "not recognized" flagging is REMOVED from this screen. Reason:
      a photo of a real product label frequently captures Directions/Cautions/usage text alongside
      the ingredients paragraph — the naive comma-tokenizer has no way to separate them, so the full
      list ends up dominated by unrelated label text marked "not recognized" (observed: 71 tokens,
      the large majority non-ingredient junk). Showing that wall of noise is worse than showing
      nothing — so instead the screen shows only the actives it can identify with real confidence
      (**Detected actives**, from `resolvedActiveKeys`), and states plainly when none are found,
      rather than presenting a list where "not recognized" reads as a data quality signal about
      *this specific tool*, not a fact about the product. The raw OCR text is still persisted in
      full at capture time (§2) — nothing is lost, just not dumped on-screen as a token-by-token list.
      **Follow-up RESOLVED 2026-08-27** (tech-lead review finding, actioned same day): the raw
      capture text is now passed through `extractIngredientSection()`
      (`src/utils/productProfile/ingredientSectionExtractor.ts`) the instant either capture path
      completes, in `ExploreCompositionCaptureScreen.tsx`'s `goToResult` — before it is stored on a
      `WishlistEntry` or handed to `useCompositionInsights` at all. That function scans a curated
      list of 47 Directions/Warnings/manufacturer-metadata marker phrases (case-insensitive,
      whole-phrase match) and cuts the text at the first one found, but only once at least one
      comma of real ingredient-like content already precedes it — a deliberately conservative guard
      against a false-early match discarding a short real ingredients list (under-filtering is
      preferred to over-filtering). This fixes Story 6's "Ingredient count" at the source rather
      than patching the matrix's own math, and as a side effect also keeps a promoted Product's
      `fullIngredientText` (Story 5) clean of the same noise. Does not touch the pre-existing Add
      Product wizard's own OCR pipeline (`ocrTextCleaner.ts`/`CameraCaptureModal.tsx`) — scoped to
      Explore Composition's own capture path only, since `resolveFromRawText` (this fix's downstream
      consumer) is itself Explore-Composition-only. Shelf products captured through the ordinary
      wizard may still carry this same class of noise in their own `fullIngredientText`, which
      would still inflate `shelfIngredientCountAverage` in `shelfComparison.ts` — a separate,
      pre-existing data-quality gap in the wizard's own capture path, out of scope here.
- [x] Given the result screen, when it renders, then no % match, conflict warning, efficacy/quality
      score, allergen/fragrance breakdown, or usage/application section is present.

### Story 3: Save to Wishlist without committing to an identity
As a user unsure whether to buy, I want to save the composition to a Wishlist with minimal typing, so
I can revisit it later without losing my place.

**Acceptance Criteria:**
- [x] Given the result screen, when I tap `Add to Wishlist` (**renamed 2026-08-27** from "Save to
      Wishlist" — real-device finding, the two footer buttons didn't both fit without truncation),
      then I'm prompted for brand + name
      (both required, both start empty) and, on submit, a `WishlistEntry` is created with no
      `catalogStore` write, no `conflictEngine.ts` evaluation, and no community-contribution submission.
- [ ] Given a saved `WishlistEntry`, when I open the Catalog tab's Wishlist view, then I see it listed
      with `Delete` and `Move to Shelf` actions.
- [ ] Given I tap `Delete` on a `WishlistEntry`, when nothing else happens, then it is removed
      immediately with no confirmation modal (`DeleteProductModal` is not reused here).

### Story 4: Commit a composition directly to the Shelf
As a user who has decided to buy, I want to put the analyzed composition directly on my Shelf, so I
don't have to re-enter ingredients I already captured.

**Acceptance Criteria:**
- [x] Given the result screen, when I tap `Put on Shelf` (**renamed 2026-08-27** from "Put on My
      Shelf", same fitting fix as Story 3's rename), then I see the shared completion form
      asking only for brand, name, category (if not already captured), and a front/jar photo —
      never re-asking for the ingredients photo already captured in this flow.
- [ ] Given I submit the completion form, when it saves, then a full catalog product is created
      (`product_type` required, per the existing `CosmeticsProduct`/`Product` shape) and the existing
      community-contribution flow fires, same as today's manual-entry path.

### Story 5: Promote a Wishlist entry to the Shelf without losing it on failure
As a user completing a previously-saved Wishlist entry, I want the entry to survive if I back out of
the completion form, so I don't lose my saved research by accident.

**Acceptance Criteria:**
- [ ] Given a `WishlistEntry`, when I tap `Move to Shelf`, then the shared completion form opens
      pre-filled with whatever the entry already has (brand, name, category, parsed ingredients).
- [ ] Given the form is open, when I close it without submitting, then the `WishlistEntry` is
      unchanged and still present.
- [ ] Given the form is open, when I submit successfully, then a catalog product is created AND the
      `WishlistEntry` is removed — never a state with both existing or neither existing.

### Story 6: Compare a composition against my own Shelf
As a user reviewing a captured composition, I want to see how it compares to the similar products I
already own, so I can judge it against my own real Shelf rather than a fabricated benchmark.

**Acceptance Criteria:**
- [ ] Given a captured composition with a category set, when the result screen renders, then a
      comparison matrix shows exactly 4 parameters — functional profile breadth, ingredient count,
      active tags, and category-relative signal — no 5th parameter, and no skin-type/suitability row.
- [ ] Given a category is set and the user has at least one `productsStore` item of that same
      `category`, when the matrix renders, then each parameter is computed against that filtered set
      of the user's own Shelf items, and nothing else (no corpus/aggregate data).
- [ ] Given a category is set and the user has zero `productsStore` items of that same `category`,
      when the matrix renders, then it states plainly that there are no other items of that category
      on the Shelf yet to compare against, instead of showing any comparison numbers.
- [ ] Given no category was captured, when the result screen renders, then no comparison matrix
      renders (unchanged gating rule from the original pass).
- [ ] Given the matrix renders, when inspected, then "Functional profile breadth" equals the same
      count already driving the Functional Profile tag list (distinct `CapabilityKey` values with a
      positive score from `buildCapabilities()`), and "Ingredient count" equals the same count
      already shown next to the ingredient list — neither is computed by new detection logic.
- [ ] Given the matrix renders, when inspected, then "Active tags" is `resolved.resolvedActiveKeys`
      from `resolveFromRawText` — never a value obtained by calling `getProductActiveKeys()` (which
      requires a `Product` this flow doesn't have).
- [ ] Given the matrix renders, when inspected, then no ingredient position/concentration-order value
      appears anywhere in it — this constraint is scoped to the comparison matrix specifically
      (explore-insights-v2 plan decision D1, confirmed 2026-09-05); `DetectedActivesCard` may surface
      an ingredient's INCI position elsewhere on the result screen.

### Story 7: See an honest caution when an active may not suit my skin type
As a user reviewing a captured composition, I want to be told plainly, in real language, when an
ingredient in it commonly needs extra care for my skin type, so I'm not shown a vague badge that
hides the actual reason.

**Acceptance Criteria:**
- [ ] Given at least one of the composition's resolved active classes has `exfoliating === true`,
      `photosensitizing === true`, or `irritancy >= 3` (read from `ACTIVES_RULESET.classes[key]
      .properties`), when the result screen renders, then a standalone caution element renders —
      regardless of whether a `barrierRepair` active is also present in the composition.
- [ ] Given none of the composition's resolved active classes meet that condition, when the result
      screen renders, then no caution element, placeholder, or hidden/collapsed markup exists for it
      at all.
- [ ] Given the caution element renders, when read, then it names the actual triggering active(s) by
      their display name and references the user's own stored `profile.skinType` in a real sentence —
      never a generic icon, badge, or unnamed "may cause irritation" label.
- [ ] Given the user has never set a skin type (`profile.skinType` is `null`), when the trigger
      condition would otherwise be met, then the caution element still does not render (there is no
      skin type to honestly reference).
- [ ] Given the caution element renders, when inspected against the comparison matrix, then it is a
      structurally separate block, not a parameter/row/slot inside the matrix component.

### Story 8: See where this composition would sit in a routine
As a user reviewing a captured composition, I want a plain-language sense of what step of a routine
it would occupy, so I can picture how it fits alongside what I already do, without it being
scheduled anywhere yet.

**Acceptance Criteria:**
- [ ] Given a captured composition with a category set, when the result screen renders, then a
      routine-placement element shows the human-readable phase label (e.g. "Treatment", "Cleansing")
      corresponding to `buildRoutinePosition(category, classFacts).layeringOrder`.
- [ ] Given no category was captured, when the result screen renders, then no routine-placement
      element renders (same gating rule as Story 6's matrix).
- [ ] Given the routine-placement element renders, when inspected, then `buildRoutinePosition` was
      called with exactly `(category, classFacts)` — the same `classFacts` already computed via
      `joinActiveKeys(resolved.resolvedActiveKeys, resolved.potencyByKey)` for the Functional Profile
      tags — and with no `Product`/`Routine`/`RoutineStep` argument.
- [ ] Given this feature exists, when compared to the original implementation pass, then this is
      understood as a deliberate reversal of that pass's non-goal ("never call `buildRoutinePosition`
      from this screen") — not an oversight (see §3 reversal note).

### Story 9: Every saved Wishlist entry has its own detail page
As a user who saved a composition to the Wishlist, I want to open it and see everything we already
know about it, plus my own notes, so it's never just a dead-end list row.

**Acceptance Criteria:**
- [ ] Given the Wishlist tab shows at least one `WishlistEntry` card, when I tap the card, then I
      navigate to a real detail screen for that exact entry — never a no-op, and never the
      pre-existing `ProductDetailScreen` used for fully-identified catalog products.
- [ ] Given I open a `WishlistEntry`'s detail screen, when it renders, then the header shows the
      entry's name (or "Untitled composition" when `name` is null) and, only when `brand` is set,
      the brand shown above it — the same fallback text `WishlistEntryCard` already uses, not a
      new string.
- [ ] Given the entry's `category` is set, when the header renders, then a category badge is shown;
      given `category` is null, when the header renders, then no category badge, placeholder, or
      "unknown category" text is shown at all.
- [ ] Given the detail screen renders, when I look at the Functional profile, Detected actives,
      Skin-type caution, Comparison matrix, and Routine placement sections, then each one
      independently shows either its own real content or its own real empty-state — the exact same
      per-section rules `ExploreCompositionResultScreen.tsx` already implements for a
      `rawIngredientsText` + `category` pair — never a single combined "nothing to show yet" message
      standing in for all five, and never fabricated data for a section that genuinely has nothing
      to show.
- [ ] Given the entry's `category` is null, when the detail screen renders, then the Comparison
      matrix and Routine placement sections do not render at all — the same gating rule Story 6/8
      already established for the result screen, unchanged here.
- [ ] Given the detail screen renders, when I scroll past the insight sections, then the same
      disclaimer footer text already shown on `ExploreCompositionResultScreen.tsx` is shown here too.
- [ ] Given a `WishlistEntry` id that no longer exists (deleted elsewhere, or a stale link), when its
      detail screen would render, then it shows a "Composition not found" state with a "Go Back"
      action — never a crash, never a blank screen, never fabricated placeholder content.
- [ ] Given a `WishlistEntry` with no notes yet, when I open its detail screen, then the Notes card
      shows an empty text area with a placeholder — never pre-filled or fabricated text.
- [ ] Given I type into the Notes text area and then move focus away, when the typed text differs
      from what was last saved, then it is persisted to that exact `WishlistEntry` via a new
      `wishlistStore.updateEntry` action — no other field on the entry changes as a side effect.
- [ ] Given I reopen the same `WishlistEntry`'s detail screen later, including after an app restart,
      when it renders, then the previously-saved note text is shown, unchanged.
- [ ] Given the detail screen renders, when I look for actions, then both "Move to Shelf" and
      "Delete" are available directly on this screen, in addition to — not instead of —
      `WishlistEntryCard`'s own existing versions of the same two actions.
- [ ] Given I tap "Delete" on the detail screen, when it completes, then I'm returned to the
      Catalog tab and the entry no longer appears anywhere (card or detail) — no confirmation
      modal, the same rule Story 3 AC3 already established for the card's own Delete button.
- [ ] Given I tap "Move to Shelf" on the detail screen and complete the save, when it succeeds,
      then a catalog product is created AND this `WishlistEntry` is removed — the same
      never-both/never-neither guarantee Story 5 AC3 already established, now also reachable from
      this screen.
- [ ] Given I tap "Move to Shelf" on the detail screen and back out of the completion form without
      submitting, when I return, then the `WishlistEntry` is unchanged and its detail screen still
      renders normally.

## 5. UX / Behaviour
- **Catalog tab** (`CatalogScreen.tsx`): the existing `Add new` / `Explore new` buttons become two
  compact card tap targets (title + subtitle, no leading icon — **updated 2026-08-27**, icon-wrap
  removed from both). **Position updated 2026-08-27**: the cards sit directly under the
  Owned/Wishlist tab toggle (top of the list, inside `ListHeaderComponent`), not pinned at the
  bottom of the screen as originally shipped — and are sized compactly to match that position
  (smaller padding/type scale than the original bottom-row cards, still ≥14px per CLAUDE.md). `Add
  new` keeps routing to `AddProductHub` unchanged; its copy is finalized (no longer PLACEHOLDER):
  title **"Add new"**, subtitle **"You already own it"**. The Explore card's copy is finalized as:
  title **"Explore"** (shortened 2026-08-27 from "Explore ingredients"), subtitle **"Before you
  buy"** (shortened 2026-08-27 from the earlier, longer "Check before you decide to put it on Your
  Shelf" — both shortenings match `Add new`'s terse phrasing and the more compact card size). It
  is retargeted from today's brand-OCR `CaptureFlow` (with `initialStatus: 'wishlist'`) to the new
  ingredient-only capture screen, unchanged from the first pass. The flag-off path (today's plain
  `Add new`/`Explore new` buttons, pinned at the bottom) is untouched by any of this.
- **Capture screen** (**redesigned 2026-08-27**, per a human design reference, **consolidated to a
  single headline the same day, then shortened again**): one neutral headline — "Choose a category
  and add the ingredients to see the details." — no separate subheadline (an initial
  headline+subheadline pair was tried first, then merged into one sentence, then trimmed to this
  final wording — action first, benefit ["to see the details"] last and brief). Deliberately says
  "a category"/"the ingredients," never "your product" — the item isn't owned yet in this
  pre-purchase flow, spec Story 1's own framing. No hero illustration — not available yet. Below
  that: `Category` chip grid
  (label styled black/medium/16px, no divider line below it), now **required** (**changed
  2026-08-27** — was optional through the first three slices; see the reversed Assumption in the
  tech design) — neither capture path opens without one selected, an inline error shows instead,
  clearing once one is picked. Below the chips: a photo-capture tile reusing `ScanTile`
  (`src/components/addProduct/ScanTile.tsx` — the same dashed-border camera-launch tile already
  shared by the manual-entry wizard's sections, not a new component; wraps `CameraCaptureModal
  mode="inci"`, unchanged), with "Paste text manually" as a lower-emphasis secondary text link below
  it (large multiline field on tap, mirrors `IngredientsSection.tsx`'s existing paste modal) —
  renamed from "Enter / paste text" (2026-08-27 update, itself renamed from the original
  "Photograph the ingredient list" / two-equal-weight-cards framing — see Story 1's superseded AC).
  The primary/secondary weighting from the 06 hierarchy decision is preserved — only the primary
  action's presentation changed from a filled `Button` to `ScanTile`. Raw text is written to local
  state the instant either path completes, before parsing.
- **Result screen**, top to bottom (**updated 2026-08-27**): Functional profile tags → **Detected
  actives** (replaces the removed full ingredient list, see Story 2) → Skin-type caution (only when
  triggered, Story 7) → Comparison matrix (only when category is set, Story 6) → Routine placement
  (only when category is set, Story 8) → Disclaimer footer. No identity/hero card. Two footer
  actions, always both visible: `Put on Shelf` (primary) and `Add to Wishlist` (secondary) —
  **renamed 2026-08-27** from "Put on My Shelf"/"Save to Wishlist" (real-device finding: the two
  buttons didn't both fit side-by-side without text truncation).
- **Card visual treatment updated 2026-08-27**: Functional profile, Detected actives, Comparison
  matrix, and Routine placement each keep their own separate card (not merged into one), but are
  now visually consistent with this app's existing `ProductInsightsPanel.tsx` pattern (icon-circle
  header + title, per section) rather than a plain text title — human decision, referencing that
  existing component as the model. Skin-type caution keeps its distinct warning-alert treatment
  (background tint, no icon-header), since it's a caution, not an insight panel.
- **Comparison matrix** (Story 6): 4 rows — Functional profile breadth, Ingredient count, Active
  tags, Category-relative signal — each compared against the user's own Shelf items of the same
  category, nothing else. Zero same-category Shelf items renders a plain "no other [category] on
  your Shelf yet to compare against" message instead of the 4 rows (exact copy provisional, same
  `PLACEHOLDER` convention as the entry-card subtitle was before this batch resolved it).
- **Skin-type caution** (Story 7): a single sentence, rendered only when triggered, naming the
  triggering active(s) by display name and the user's stored skin type. Exact copy is provisional
  pending design review (`PLACEHOLDER` convention), but must always be a real, specific sentence when
  it renders — never a generic label.
- **Routine placement** (Story 8): a single phase-label line (e.g. "Treatment", "Moisturizing")
  derived from the composition's category + resolved actives, per the 14-entry phase-label table in
  the tech design. No AM/PM, rinse-off, or scheduling detail is shown.
- **Add to Wishlist**: minimal brand+name prompt → creates `WishlistEntry` → confirmation, returns
  to Catalog.
- **Wishlist entries**: render inside the existing Catalog "Wishlist · N" tab as a distinct,
  separately-labeled section from existing fully-identified wishlist products (see tech design
  Assumption 5). Each entry: `Delete` (no confirm) and `Move to Shelf` (opens the shared
  completion form, pre-filled).
- **Wishlist entry detail screen (Story 9, new)**: tapping a `WishlistEntryCard` opens
  `WishlistEntryDetailScreen`, keyed by `wishlistEntryId` (same id-only route-param convention as
  `ProductDetail`'s `{ productId }`). Shows a text-only identity header (brand/name, category badge
  only when set — no photo, since `WishlistEntry` has no image field), then the exact same five
  insight sections and disclaimer already on `ExploreCompositionResultScreen.tsx` (Functional
  profile → Detected actives → Skin-type caution → Comparison matrix → Routine placement →
  disclaimer), reused via a shared block rather than reimplemented, then a new Notes card (mirrors
  `ProductDetailScreen.tsx`'s existing `Textarea` + auto-commit-on-blur pattern), then a footer with
  "Move to Shelf" and "Delete" — both additive to, not replacing, the card's own existing versions
  of those two actions. A not-found state (mirrors `ProductDetailScreen.tsx`'s own) covers a stale
  or deleted entry id.
- **Shared completion form**: opened from the result screen or from a Wishlist entry. Asks only for
  genuinely missing fields — brand/name always missing from this flow, category only if not already
  captured, front/jar photo always (only an ingredients photo may already exist). Error states follow
  the existing manual-entry pattern: land on the first incomplete required field, no silent failure.

## 6. Data Requirements
- **New:** `WishlistEntry` local store — `id`, `brand: string | null`, `name: string | null`,
  `category: string | null`, `rawIngredientsText: string`, `parsedIngredientIds: string[]` (active
  ingredient keys), `sourceFlow: 'explore_composition' | 'add_product'`, `createdAt`. Isolated: no
  import of `productsStore`, `conflictEngine.ts`, or the Catalog filter/biomarker logic.
- **New:** a `category` (`ProductType`) capture step at `Explore new` capture time, carried through
  to `WishlistEntry` / the completion form. **Changed 2026-08-27:** now required at the UI level
  (previously optional) — neither capture path opens without one selected. The field itself stays
  `category: string | null` on `WishlistEntry` (unchanged type) since historical entries saved
  before this change may still have `null`; only new captures going forward are guaranteed non-null.
- **No new persisted fields for Story 6/7/8.** The comparison matrix, skin-type caution, and routine
  placement are all computed at render time from data already captured (`rawIngredientsText`,
  `category`) plus two already-hydrated stores read fresh on each render: `productsStore.products`
  (Shelf comparison) and `useProfileStore`'s `profile.skinType` (caution signal). Nothing new is
  written to `WishlistEntry`, `Product`, or the completion-form prefill shape.
- **Existing, reused, unmodified:** `ingredientParser.ts` (active-class matching), the
  `productProfile/` pipeline (capability scoring, unresolved-token detection, routine position — see
  tech design), `ocrTextCleaner.ts`, `CameraCaptureModal`, `OcrEngineWebView`,
  `productsStore.addProduct`, `submitContribution`.
- **Retention:** `WishlistEntry` rows persist locally until deleted or promoted (which deletes the
  entry) — same local-only lifecycle as every other entity in this app (CLAUDE.md, Phase 1).
- **New (Story 9):** `WishlistEntry.notes?: string | null` — optional so already-persisted entries
  without it need no migration (absent = no note, same convention as `Product`'s own optional
  fields). Edited only via the new detail screen's Notes card.
- **New (Story 9):** `wishlistStore.updateEntry(id, patch)` — a generic partial-update action,
  mirroring `productsStore.updateProduct`'s existing shape exactly. Used today only to persist
  `notes`, but not restricted to that one field.

## 7. Dependencies
- Depends on: the existing Tesseract OCR pipeline, `ingredientParser.ts`/`productProfile/` modules,
  and the existing community-contribution flow — all already shipped, none modified in behavior.
- Depends on: `productsStore` and `useProfileStore` being hydrated at app startup (already wired in
  `App.tsx`) — Story 6/7/8 add read-only consumption of both, no new hydration wiring.
- Blocks: nothing currently planned depends on this shipping first.
- External services: none new. Tesseract.js still loads from its existing CDN dependency.

## 8. Security & Privacy
- Authentication required: no (Phase 1 has no auth layer).
- Data sensitivity: none beyond what any product already stores (ingredient text, category) — no PII
  added. `WishlistEntry` never reaches the shared/community database (explicitly excluded from the
  contribution flow). The skin-type caution signal reads `profile.skinType` (already stored locally
  for onboarding/routine purposes) but does not write, export, or transmit it anywhere new.
- Compliance considerations: none beyond the existing local-only storage posture (CLAUDE.md).
- **Story 9:** notes text is free-form user-authored content, stored the same local-only way as
  every other `WishlistEntry` field — never included in the community-contribution flow, same as
  the rest of this entity (§3).

## 9. Success Metrics
Phase 1 has no analytics pipeline; success is verified at acceptance time: every AC in §4 passes,
`npx tsc --noEmit` and `npm test` are clean, and the source brief's Definition of Done
(`docs/tasks/00-explore-composition-spec.md`) is walked end to end: entry card → capture → result →
both save destinations → wishlist entry actions. This decision batch (Story 6/7/8, entry-card copy)
is verified the same way, plus the updated guardrail test in `tests/explore-composition/
ExploreCompositionResultScreen.test.tsx` (tech design §3) correctly distinguishing "`
buildRoutinePosition` called with category set" from "not called with category absent," while the
other 4 excluded-orchestrator assertions in that same test remain "never called." Story 9 is
verified the same way: its own describe blocks in the qa-lead test suite (a new
`WishlistEntryDetailScreen.test.tsx` plus a `CatalogScreen` regression asserting the card now
navigates instead of no-op), `npx tsc --noEmit`, and `npm test` all clean.

## 10. Open Questions
- [x] Final comparison-matrix parameters — **RESOLVED 2026-08-26** (product): 4 parameters, not 5 —
      functional profile breadth, ingredient count, active tags, category-relative signal, compared
      only against the user's own same-category Shelf items. The originally-proposed 5th parameter
      (skin-type suitability) was removed from the matrix entirely; see Story 7's standalone caution
      signal instead. See Story 6.
- [x] Entry-card subtitle copy — **RESOLVED 2026-08-27** (design), both cards, no longer
      PLACEHOLDER: `Add new` → "You already own it", `Explore` (shortened from "Explore
      ingredients") → "Before you buy" (supersedes 2026-08-26's longer "Check before you decide to
      put it on Your Shelf", now shortened to match `Add new`'s terse phrasing). **Superseded same
      day:** the leading icon-wrap, briefly removed, was re-added and is final — a small
      `plumTint`-circle icon (`plus-circle` / `list`) sits above the title on both cards (see
      `progress/explore-composition.md`'s 2026-08-27 log entries for the full remove/re-add/
      reposition history). The cards themselves also moved above the Owned/Wishlist tabs and gained
      a `palette.plum` 1px border, both same-day follow-ups.
- [ ] How the new `WishlistEntry` list should visually relate to the pre-existing `CatalogScreen.tsx`
      "Wishlist · N" tab (a planner-reconnaissance discovery, not addressed in the source brief) →
      owner: **product + design**. Still open — not addressed in this decision batch either. Shipped
      behind `EXPLORE_COMPOSITION_ENABLED` (default off) with a documented default in the tech design
      (Assumption 5), reversible without a second code change.
