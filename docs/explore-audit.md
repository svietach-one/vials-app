# Explore Flow & Scan Result Screen — Read-Only Audit

Scope: `EXPLORE_COMPOSITION_ENABLED` flow (My Shelf → "Explore" card → capture → result → Wishlist/Shelf).
Method: direct code reading, no execution, no changes. Every claim below is anchored to a file:line.
Where code and `/docs` specs disagree, both are stated explicitly — the code is what is treated as ground truth.

---

## 1. Navigation and Entry Points

**Files:**
- `src/screens/CatalogScreen.tsx` — the "My Shelf" screen, hosts both entry cards
- `src/screens/catalog/ExploreCompositionCaptureScreen.tsx` — capture screen
- `src/screens/catalog/ExploreCompositionResultScreen.tsx` — result screen
- `src/navigation/AppNavigator.tsx` — route registration

**Route registration** (`src/navigation/AppNavigator.tsx:109-111,169-175`):
```
ExploreCompositionCapture: { category?: ProductType } | undefined;
ExploreCompositionResult: { rawIngredientsText: string; category: ProductType | null };
...
<CatalogStack.Screen name="ExploreCompositionCapture" component={ExploreCompositionCaptureScreen} />
<CatalogStack.Screen name="ExploreCompositionResult" component={ExploreCompositionResultScreen} />
```
Both are separate `.tsx` files/components — distinct screens, not the same screen reused with different params.

**The two shelf card-buttons** — `src/screens/CatalogScreen.tsx:243-274` (only rendered when `EXPLORE_COMPOSITION_ENABLED` is true; a fallback two-button footer at `CatalogScreen.tsx:342-360` renders instead when the flag is off):
```tsx
<Card interactive padding="none" onPress={() => navigation.navigate('AddProductHub')} style={styles.entryCardCompact}>
  <Icon name="plus-circle" ... />
  <Text style={styles.entryCardTitle}>Add new</Text>
  <Text style={styles.entryCardSubtitle}>You already own it</Text>
</Card>
<Card interactive padding="none" onPress={() => navigation.navigate('ExploreCompositionCapture', {})} style={styles.entryCardCompact}>
  <Icon name="list" ... />
  <Text style={styles.entryCardTitle}>Explore</Text>
  <Text style={styles.entryCardSubtitle}>Before you buy</Text>
</Card>
```
- "Add new" → `AddProductHub` (`src/screens/AddProductHubScreen.tsx`) — the full brand/name identification wizard (corpus search, OCR, barcode).
- "Explore" → `ExploreCompositionCapture` — the ingredient-only flow.

**Explore vs. Catalog scanner — unambiguous answer: two entirely separate code paths, not shared-screen/shared-component.**
- The Catalog/Add-Product scanner lives under `AddProductHubScreen.tsx` → `ManualProductFormScreen.tsx` → `src/components/addProduct/*` (`BrandAutocompleteInput`, `IngredientsSection`, `ScanTile` used for brand/label capture) and always collects brand + name + full identification.
- Explore Composition is `ExploreCompositionCaptureScreen.tsx` + `ExploreCompositionResultScreen.tsx`, has its own route params (`rawIngredientsText`, `category`), its own store (`wishlistStore.ts`), and its own insight pipeline (`useCompositionInsights.ts`). No brand/name field exists anywhere in this flow (`ExploreCompositionCaptureScreen.tsx:56` comment: "No brand/name field anywhere").
- One component is reused between the two flows: `ScanTile` (`src/components/addProduct/ScanTile.tsx`), imported directly into `ExploreCompositionCaptureScreen.tsx:17` — a dumb, camera-launch-tile presentational component, not a screen. Confirmed by the screen's own doc comment (`ExploreCompositionCaptureScreen.tsx:50-51`): "reusing `ScanTile` … not a new component."
- `CameraCaptureModal` (`src/components/camera/CameraCaptureModal.tsx`) is also shared infrastructure (both flows launch the same camera modal, in different `mode`s: `'inci'` for Explore vs `'label'`/`'barcode'` for Add Product) — this is the OCR camera shell, not the Explore/Catalog screen itself.

**Full screen sequence, tap to result:**
1. `CatalogScreen` ("My Shelf") → tap "Explore" card → `navigation.navigate('ExploreCompositionCapture', {})`
2. `ExploreCompositionCaptureScreen` — pick a category chip (required, `requireCategory()` at `ExploreCompositionCaptureScreen.tsx:105-111`), then either:
   - Tap "Take a photo" → `CameraCaptureModal` (`mode="inci"`) → OCR text returned via `onCapture` → `handleCapture` (`:83-87`) → `goToResult(result.rawText)`
   - Tap "Paste text manually" → in-screen `Modal` with a `TextInput` → `handleParsePress` (`:89-94`) → `goToResult(pasteText)`
3. `goToResult` (`:69-81`) runs `extractIngredientSection` (trims Directions/Warnings noise) then `navigation.navigate('ExploreCompositionResult', { rawIngredientsText, category })`
4. `ExploreCompositionResultScreen` renders insights; footer buttons go to `ManualProductForm` (Put on Shelf) or open an in-screen "Add to Wishlist" modal (saves to `wishlistStore`, then `navigation.navigate('Catalog')`).

No intermediate loading/confirmation screen exists between capture and result — navigation happens synchronously in the same handler (as documented in the screen's own comment).

---

## 2. Result Screen: What Renders Now

**Component tree, top to bottom** (`ExploreCompositionResultScreen.tsx:109-193`, insight body delegated to `CompositionInsightsSection.tsx:36-56`):

```
SafeAreaView
 └ AppHeader (title="Composition", back IconButton)
 └ ScrollView
    └ CompositionInsightsSection
       ├ FunctionalProfileCard        (src/components/catalog/FunctionalProfileCard.tsx)
       ├ DetectedActivesCard          (src/components/catalog/DetectedActivesCard.tsx)
       ├ SkinTypeCautionNotice        (src/components/catalog/SkinTypeCautionNotice.tsx)  — conditional
       ├ CompositionComparisonMatrix  (src/components/catalog/CompositionComparisonMatrix.tsx) — only if shelfComparison !== null (category set)
       ├ RoutinePlacementCard         (src/components/catalog/RoutinePlacementCard.tsx) — only if routinePosition !== null (category set)
       └ disclaimer View (testID="explore-result-disclaimer")
 └ footer View
    ├ Button "Put on Shelf"
    └ Button (secondary) "Add to Wishlist"
 └ Modal (Add to Wishlist form: BrandAutocompleteInput, Input "Name", Save/Cancel)
```

**Per-block data source** (all computed by `useCompositionInsights.ts:58-126`, a single hook, no network I/O — everything is synchronous, in-memory, pure-function composition):

| Block | Data | Source |
|---|---|---|
| `FunctionalProfileCard` | `capabilityTags: CapabilityKey[]` | `buildCapabilities()` on `resolved.resolvedActiveKeys` + `classFacts` (`useCompositionInsights.ts:77-89`) |
| `DetectedActivesCard` | `resolvedActiveKeys: ActiveIngredientKey[]` | `resolveFromRawText(rawIngredientsText)` (`resolve.ts:134-150`) |
| `SkinTypeCautionNotice` | `skinTypeCaution` + `skinType` | `buildSkinTypeCaution(classFacts)` (`skinTypeCaution.ts`) for the caution; `skinType` read live from `useProfileStore((s) => s.profile)?.skinType` (`useCompositionInsights.ts:63,121`) |
| `CompositionComparisonMatrix` | `shelfComparison` | `buildShelfComparison(category, {...}, products)` where `products = useProductsStore((s) => s.products)` — i.e. the user's entire live Shelf (`useCompositionInsights.ts:62,99-110`) |
| `RoutinePlacementCard` | `routinePosition` | `buildRoutinePosition(category, classFacts)` — pure lookup table, no store data |
| disclaimer | static string | hardcoded JSX |

**All user-facing strings, verbatim:**
- Header: `"Composition"`
- `FunctionalProfileCard` (`FunctionalProfileCard.tsx:29,40-42`): `"Functional profile"`; empty: `"No known functional tags detected in this composition."`
- `DetectedActivesCard` (`DetectedActivesCard.tsx:31,42-44`): `"Detected actives"`; empty: `"No known active ingredients detected in this composition."`
- `SkinTypeCautionNotice` (`SkinTypeCautionNotice.tsx:39-42`, only when both a caution and a skin type exist): `"{activeNames} may need extra care for {skinTypeLabel} skin — worth watching how your skin responds."`
- `CompositionComparisonMatrix` (`CompositionComparisonMatrix.tsx:49,53-55,59-104`):
  - `"Compare to your Shelf"`
  - empty: `"No other {category plural} on your Shelf yet to compare against."`
  - Row labels: `"Functional profile breadth"`, `"Ingredient count"`, `"Active tags"`, `"Category"`
  - Value/muted text patterns: `"Shelf avg {n} ({withData} of {total} with data)"`, `"No ingredient data yet among your {n} same-category Shelf items"`, `"None detected"`, `"{n} Shelf {categoryPlural} share a tag"`, `"{n} on your Shelf"`
- `RoutinePlacementCard` (`RoutinePlacementCard.tsx:34`): a phase label from `ROUTINE_PHASE_LABELS` (e.g. `"Cleansing"`, `"Treatment"`, `"Moisturizing"`, `"Sun Protection"`, 14 entries total — `src/constants/labels.ts:70-85`)
- Disclaimer (`CompositionInsightsSection.tsx:50-52`): `"This overview reflects known ingredient functions only — it is not a personalized recommendation. Check with a dermatologist for advice about your own skin."`
- Footer buttons: `"Put on Shelf"`, `"Add to Wishlist"`
- Wishlist modal (`ExploreCompositionResultScreen.tsx:152-187`): `"Add to Wishlist"`, `Name` input placeholder `"e.g. Daily Moisturiser"`, `"Save"`, `"Cancel"`

**Empty states — full list and trigger conditions:**
| Empty state | Condition | Location |
|---|---|---|
| "No known functional tags detected in this composition." | `capabilityTags.length === 0` | `FunctionalProfileCard.tsx:39-43` |
| "No known active ingredients detected in this composition." | `resolvedActiveKeys.length === 0` | `DetectedActivesCard.tsx:41-45` |
| Comparison matrix "No other {X} on your Shelf yet…" | `sameCategoryCount === 0` | `CompositionComparisonMatrix.tsx:52-55` |
| Comparison matrix "No ingredient data yet among your N…" (per-row, not whole-card) | `sameCategoryWithDataCount === 0` but `sameCategoryCount > 0` | `CompositionComparisonMatrix.tsx:62-65,74-77` |
| Whole matrix/routine card absent | `category === null` (no category selected in capture) | `CompositionInsightsSection.tsx:44,46` — conditional render, not a rendered empty-state message |
| Skin-type caution absent | `caution === null` (no trigger) **or** `skinType === null` (profile has no stored skin type) | `SkinTypeCautionNotice.tsx:29` — silently renders nothing, no message shown either way |

**States explicitly NOT present:**
- "product not found" — **NOT APPLICABLE**: this screen never attempts product identification (no lookup against `ProductRepository`/corpus at all — confirmed by the screen's own doc comment at `ExploreCompositionResultScreen.tsx:43-45`), so there is no "not found" branch.
- "ingredients failed to parse" — **NOT IMPLEMENTED** as an explicit state. Parsing (`parseActiveIngredientDetails`) never throws for arbitrary text; a garbled/empty string simply produces `resolvedActiveKeys.length === 0`, which renders as the "No known active ingredients detected" empty state above, not a distinct parse-failure message.
- "unknown ingredient" (a token the dictionary doesn't recognize) — **NOT SURFACED on this screen at all.** `resolveFromRawText` does compute `unresolvedIngredientTokens` (`resolve.ts:21,24,147`), but `useCompositionInsights.ts`'s return object (`:49-56`) does not expose that field, so nothing downstream of it can render an "N ingredients not recognized" message. This is a real, present-in-code signal that is silently discarded before it reaches the UI.
- offline / network error — **NOT APPLICABLE by construction**: nothing on this screen or in its data pipeline makes a network call (no `fetch`, no corpus/Turso query). Camera OCR (Tesseract) and the paste-text path are both fully local/on-device.

**Loading/skeleton state:** **NOT IMPLEMENTED.** There is no `ActivityIndicator`, no skeleton, no `isLoading` flag anywhere in `ExploreCompositionResultScreen.tsx` or `useCompositionInsights.ts` — every computation is a synchronous `useMemo` over an already-in-memory string, so the screen renders fully on first paint. (The camera *capture* screen does show a Tesseract loading overlay while OCR runs, but that is prior to navigation, inside `CameraCaptureModal.tsx:447` — not on the result screen itself.)

---

## 3. Runtime Product Data

**There is no `Product` object on this screen at all.** The result screen never constructs, receives, or persists a `Product`. Its only inputs are the raw route params:
```ts
// ExploreCompositionResultScreen.tsx:29
type Props = NativeStackScreenProps<CatalogStackParamList, 'ExploreCompositionResult'>;
// AppNavigator.tsx:111
ExploreCompositionResult: { rawIngredientsText: string; category: ProductType | null };
```
If the user saves it, the persisted shape is `WishlistEntry` (`src/types/index.ts:725-742`), not `Product`:
```ts
export interface WishlistEntry {
  id: string;
  brand: string | null;
  name: string | null;
  category: ProductType | null;
  rawIngredientsText: string;
  parsedIngredientIds: ActiveIngredientKey[];
  sourceFlow: 'explore_composition' | 'add_product';
  createdAt: string;
  notes?: string | null;
}
```
`Product` itself (`src/types/index.ts:328-429`) is a much larger, unrelated interface (id, brand, productType, `activeIngredients`, `activeTags`, `fullIngredientText`, PAO fields, allergen cache, etc.) used by the Catalog/routine/conflict stack — it is only reached from this flow if the user taps "Put on Shelf", which hands off to `ManualProductFormScreen` via an `explorePrefill` param, a completely different screen this audit does not cover in depth.

**Key question — ordered array or raw string + tag set? Answer: raw string + an unordered tag set. Position is computed once, then thrown away.**

Evidence, in pipeline order:
1. `ingredientParser.ts:129-174` (`parseActiveIngredientDetails`) DOES compute a real per-class `position` (1-based comma-token index of the earliest match — `ingredientParser.ts:50-56,157`) and returns it on `ParsedActiveDetail.position`.
2. `resolve.ts:134-150` (`resolveFromRawText`, the function this screen actually calls) takes that result and does:
   ```ts
   const resolvedActiveKeys = sortKeys(parsed.map((d) => d.key));   // resolve.ts:144
   ```
   `sortKeys` (`resolve.ts:31-33`) is `[...new Set(keys)].sort(alphabetically)` — **alphabetical, not by list position.** The `position` field on each `ParsedActiveDetail` is read only to gate `requireWithinPosition`/`downgradeToLowAfterPosition` attribution rules (`resolve.ts` never reads `.position` itself; `ingredientParser.ts:158-168` consumes it internally) and is then discarded — `ResolvedIngredients` (`resolve.ts:21-29`) has no `position` field at all.
3. `useCompositionInsights.ts` and everything downstream (`joinActiveKeys`, `buildCapabilities`, `DetectedActivesCard`) operate purely on this already-alphabetized `ActiveIngredientKey[]` array. `DetectedActivesCard.tsx:35` renders them with `resolvedActiveKeys.map(...)` — display order is therefore alphabetical-by-internal-key, not INCI list order.

So: what survives to the result screen is (a) the raw string `rawIngredientsText` verbatim, and (b) a deduped, alphabetically-sorted `ActiveIngredientKey[]` — a set, functionally. **No ordered structured ingredient list ever reaches this screen or `WishlistEntry`.**

**Is INCI position preserved anywhere? Partially, and only transiently.**
- `ParsedActiveDetail.position` (`ingredientParser.ts:46-56`) is the only place a position value exists in this pipeline, and it is:
  - per matched *active class*, not per raw ingredient token (an ingredient with no known class has no position recorded anywhere)
  - a comma-token index into `rawIngredientsText.split(',')`, not a percentile/concentration value
  - consumed and dropped inside `parseActiveIngredientDetails`/`resolve.ts` before reaching `useCompositionInsights` or the UI
- The `docs/specs/explore-composition.md:223-224` AC is explicit that this is intentional: *"no ingredient position/concentration-order value appears anywhere in [the comparison matrix] — position stays solely a §3.3 ingredient-list display-order attribute."* Confirmed: the code matches the spec here — position is deliberately not surfaced, though the code goes further than the spec by not even carrying it past `resolve.ts` internally.

**Normalization — what `parseActiveIngredientDetails`/`ingredientParser.ts` actually does:**
- Separators: raw text is split on `,` only (`ingredientParser.ts:131`, and `resolve.ts:48-53`'s shared `tokenizeIngredientsText`). No handling of `;`, newlines, or `·` as separators.
- Case: every matcher regex is compiled with the `i` flag (`ingredientParser.ts:83`) — case-insensitive matching, but the raw text itself is never case-normalized/stored lowercased.
- Brackets/parentheses (e.g. "(CI 77891)"): **NOT stripped.** No bracket-removal step exists in `ingredientParser.ts`, `resolve.ts`, or `tokenizeIngredientsText`. A CI-number annotation stays embedded in the token exactly as OCR/paste produced it.
- Asterisks (`*` used for organic-ingredient footnotes): **NOT handled** — no regex strips `*` anywhere in this pipeline.
- "May contain" / "+/-" (color-cosmetics variant-shade boilerplate): **NOT handled** by `ingredientParser.ts`. The only related logic is `ingredientSectionExtractor.ts` (`extractIngredientSection`), which cuts the text at *trailing* Directions/Warnings/manufacturer sections (`SECTION_STOP_MARKERS`, `ingredientSectionExtractor.ts:26-83`) — it does not detect or special-case a "may contain" clause appearing mid-ingredient-list.
- CI numbers (colorants, e.g. "CI 77891"): **NOT recognized or stripped** — will simply fail to match any active-class regex and fall into `unresolvedIngredientTokens` (which, per §2 above, is computed but never shown).
- Cyrillic: **NOT handled.** All matcher patterns in `actives.json` are Latin-alphabet regexes; the capture screen's own paste-modal hint (`ExploreCompositionCaptureScreen.tsx:203-205`) explicitly instructs the user to paste "the original Latin-character ingredients list, not a translation" — Cyrillic input is a known, UI-copy-documented non-goal, not a bug.
- OCR line breaks: partially defended against only in the *photograph* capture path via `extractIngredientSection` cutting trailing OCR noise (Directions/Warnings text commonly captured after the ingredients paragraph — `ingredientSectionExtractor.ts:1-15` doc comment) — this runs once in `ExploreCompositionCaptureScreen.tsx:76` before either persistence or analysis. There is no line-break-to-comma normalization step anywhere; if OCR emits a literal newline instead of a comma between two ingredients, `tokenizeIngredientsText`'s `split(',')` will not separate them into two tokens.

**What happens to an ingredient missing from the dictionary — lost or saved as unknown?**
Computed as "unknown" (`unresolvedIngredientTokens`, `resolve.ts:64-68,147`), but **never persisted and never rendered anywhere in the Explore flow.** It exists for exactly one call-frame inside `resolveFromRawText`'s return value, which `useCompositionInsights.ts` receives (`resolved.unresolvedIngredientTokens` is available at `useCompositionInsights.ts:65`) but does not forward into `CompositionInsights` (`useCompositionInsights.ts:49-56` — the interface has no such field). Net effect: an unrecognized ingredient is silently absent from the "Detected actives" list, with no coverage/count signal shown to the user (see §8F).

---

## 4. Engines and Dictionaries

**`parseInciTags` does not exist under that name.** The equivalent, actual function is `parseActiveIngredientDetails` in `src/utils/ingredientParser.ts:129-174` (full text quoted in §3 above), plus its thin wrapper `parseActiveIngredientsFromInci` (`ingredientParser.ts:98-100`, returns just the keys).

- Regex source: `src/constants/rulesets/actives.json` (935 lines), each class has a `matchers[]` array of `{ pattern, potency? }` plus optional `negativePatterns[]` and `attribution` gates (`requireWithinPosition`, `downgradeToLowAfterPosition`) — compiled once at module load (`ingredientParser.ts:79-90`).
- `4` classes in the current ruleset use position-gated attribution (`requireWithinPosition`/`downgradeToLowAfterPosition` combined, confirmed by grep count).
- Full tag list = every key under `actives.json`'s `"classes"` object; a sample (from `ACTIVE_INGREDIENT_LABELS`, `src/constants/labels.ts:133-153`): `retinoid, aha, bha, pha, vitamin_c_pure, vitamin_c_derivative, niacinamide, benzoyl_peroxide, azelaic_acid, hydroquinone, copper_peptides, peptide_signal, peptide_neuro, spf_filters, ceramides, hyaluronic_acid, glycerin_class, panthenol, cica, …` (list continues; not exhaustively reproduced here).

**`conflictEngine.ts` public API** (`src/utils/conflictEngine.ts`, class `ConflictEngine`, all static methods):
```ts
static detectConflicts(steps: RoutineStep[], products: Product[]): ConflictResult[]
static getConflictsForProduct(product: Product, catalog: Product[]): ConflictResult[]
static checkProcedureCollision(newProcedure, activeProcedures): ClinicalConflictResult | null
static checkSeasonalConflict(procedure, season?): ClinicalConflictResult | null
static checkPhototypeConflict(procedure, phototype): ClinicalConflictResult | null
static checkPregnancyConflict(procedure, isPregnantOrBreastfeeding): ClinicalConflictResult | null
static getRehabRestrictions(procedure): string[]
```
Plus the module-level exported helper `matchPairRule(keyA, keyB): ConflictRule | null` (`conflictEngine.ts:60-71`).

**Current callers** (grep, non-test): `src/utils/routineEngine/rehabFilter.ts`, `src/components/routine/ConflictWarningInline.tsx`, `src/constants/conflictRulesDb.ts`, `src/utils/skinConditionModifiers.ts`, `src/screens/RoutinesScreen.tsx`, `src/components/clinic/AddProcedureModal.tsx`. **The Explore flow is not in this list — confirmed zero call sites from `ExploreCompositionResultScreen.tsx`, `useCompositionInsights.ts`, or anything under `src/utils/productProfile/`.**

**Can `getConflictsForProduct` be called for a single (unsaved) product against the shelf, unmodified?** Yes, mechanically — its signature already takes `(product: Product, catalog: Product[])`, and it does not require the product to be persisted or have an `id` that exists in `catalog`. What blocks a naive call from Explore is only that this flow has no `Product` object (§3) — the composition is a bare string + `category`, not even a partial `Product`. A caller would need to construct a throwaway `Product`-shaped object with at least `activeIngredients: []`, `activeTags`, and `fullIngredientText` populated (the three fields `getProductActiveKeys`, `ingredientParser.ts:190-215`, reads) before `getConflictsForProduct` would do anything meaningful. That is a small adapter, not a rewrite — see §8E.

**Ingredient dictionary — does `assets/inci_seed.json` (or equivalent) exist?**
No file named `inci_seed.json` exists anywhere in the repo. Two related but distinct things exist instead:
1. `src/constants/rulesets/actives.json` (935 lines) — the active-ingredient **class** ruleset (regex matchers → ~20+ canonical `ActiveIngredientKey`s), described above. Not a flat ingredient dictionary; it's a small number of pattern-matched *classes*, not per-INCI-name entries. Sample entry (`actives.json:9-56`, `retinoid`):
   ```json
   "retinoid": {
     "displayName": "Retinoids",
     "matchers": [
       { "pattern": "\\bretin(ol|al|aldehyde)\\b", "potency": "high" },
       { "pattern": "\\bretinyl\\s+(palmitate|acetate)\\b", "potency": "low" },
       { "pattern": "\\bhydroxypinacolone\\s+retinoate\\b", "potency": "medium" },
       { "pattern": "\\bretinyl\\s+retinoate\\b", "potency": "medium" },
       { "pattern": "\\b(tretinoin|adapalene|tazarotene)\\b", "potency": "rx" }
     ],
     "negativePatterns": ["retin(ol|al)[\\s-]*free"],
     "properties": { "photosensitizing": true, "exfoliating": false, "irritancy": 3, ... },
     "allowedPeriods": ["pm"], "cycleClass": "retinoid", "concerns": ["wrinkles","acne","pores"], ...
   }
   ```
2. A real per-INCI-name dictionary DOES exist, but as a remote SQL table, not a bundled JSON asset — see next point.

**Is `expo-sqlite` + `products`/`inci_entries` tables implemented, partial, or spec-only? Answer: partially — and NOT the local `expo-sqlite` architecture the question assumes.**
- `expo-sqlite` (`openDatabaseAsync`) IS used, but only for the local `vials-contributions` write-database (`src/services/contributionsDb.ts:1,67`) — user-submitted product contributions, unrelated to the ingredient dictionary.
- The actual product/ingredient corpus (`ProductRepository.ts`, `IngredientRepository.ts` under `src/services/corpus/`) is queried over `CorpusQueryExecutor` (`src/services/corpus/types.ts:10-13`), whose only real implementation is `TursoHttpClient` (`src/services/turso/httpClient.ts:96`) — a **remote HTTP call to a Turso/libSQL database**, not local `expo-sqlite`. Tables `products`, `ingredients`, `products_fts`, `ingredients_fts`, `product_tags` are referenced in SQL strings (`ProductRepository.ts`, `IngredientRepository.ts`) and exist on that remote database (schema documented at `handoff/corpus_schema.sql`), not as an on-device SQLite file.
- `assets/corpus/vials_corpus.db` exists as a file in the repo but **is not opened anywhere in `src/`** (grep confirms zero references outside `metro.config.js` and a docstring comment) — it reads as a build/seed artifact used to populate the remote Turso DB, not a runtime-loaded local database.
- **Bottom line for this audit's scope: the Explore Composition flow itself never touches either database.** Its own screen doc comment is explicit that the corpus/`ProductRepository` is deliberately never queried (`ExploreCompositionResultScreen.tsx:43-59`) — the one exception (`BrandAutocompleteInput` in the Wishlist-save modal) is local-only (Shelf brands + a static seed dictionary), not a corpus lookup.

---

## 5. Stores and Profile

**Real types** (`src/types/index.ts`, not docs):
- `Product` — `:328-429` (full field list quoted in §3; catalog/routine engine's core entity)
- `WishlistEntry` — `:725-742` (quoted in §3; Explore's own lightweight entity)
- `Routine` — `:479-484`: `{ id: string; name: string; timeOfDay: 'morning' | 'evening'; steps: RoutineStep[] }`
- `RoutineStep` — `:453-477`: `{ id, productType, productId: string | null, hidden: boolean, scheduledDays: number[], userPinned?: boolean, stepNote?: string | null }`
- `UserProfile` — `:210-285` (full field list below)

**Selectors/helpers for reading shelf and routine — mostly none; raw store-state access is the norm.** No `selectShelf()`/`getRoutineFor()`-style helper functions exist; every consumer (including `useCompositionInsights.ts:62-63`) reads state directly:
```ts
const products = useProductsStore((s) => s.products);
const profile = useProfileStore((s) => s.profile);
```
`src/store/productsStore.ts` (`ProductsState`, `:13-22`) and `src/store/routinesStore.ts` (`RoutinesState`, `:34-78`) expose plain CRUD actions (`addProduct`, `updateProduct`, `removeProduct`, etc.) over a flat array — no derived-selector layer. The nearest thing to a "reading" helper is one-off utils like `getProductRoutineStatus` (`src/utils/routineStatus.ts`, used in `CatalogScreen.tsx:42,169`) and `getProductPaoStatus` (`src/utils/paoHelpers.ts`) — both product-specific, not shelf/routine-wide selectors.

**What's actually stored in the profile re: skin** (`UserProfile`, `src/types/index.ts:210-285`):
```ts
skinType: SkinType | null;                 // 'oily' | 'dry' | 'combination' | 'normal'
phototype: SkinPhototype | null;           // 'type_1_2' | 'type_3_4' | 'type_5_6'
fitzpatrick: FitzpatrickType | null;       // 1-6
concerns: SkinConcern[];                   // acne, dryness, wrinkles, sensitivity, redness, eczema, hyperpigmentation, pores, dark_spots
skinConditions: SkinConditionType[];       // 'eczema' | 'seborrheic_dermatitis' | 'rosacea'
primaryGoal: SkinGoal; secondaryGoal: SkinGoal | null;
spfSensitivity: boolean;
sensitive: boolean;                        // general sensitivity flag, schema v7
hormoneTherapy: boolean;
pregnantOrBreastfeeding: boolean;
```
**"Allergies" as a distinct user-declared profile field — NOT FOUND.** There is no `allergies`/`knownAllergens` field on `UserProfile`. What exists instead is per-*product* detection: `Product.detectedAllergens?: DetectedAllergenMatch[]` (`types/index.ts:421,441-444`), computed against a static bundled EU-fragrance-allergen seed (`assets/eu_allergens_seed.json`, referenced at `types/index.ts:424`) — this is a regulatory-substance scan of a product's ingredient text, not a personal-allergy profile. The type's own doc comment confirms this explicitly: "Deliberately has no per-user dimension (no `isPersonal` flag) — personal-allergen flagging is a separate, descoped follow-up" (`types/index.ts:437-439`).

**Profile editing screen:** Yes — `src/screens/ProfileScreen.tsx` shows read-only grid cells (Skin type, Skin tone, Concerns, etc.) with an "Edit" button (`ProfileScreen.tsx:286-289`) that opens `SkinProfileEditModal` (`src/components/profile/SkinProfileEditModal.tsx`, imported at `ProfileScreen.tsx:16`). That modal edits: Skin Type (radio), Care Goals, Skin Tone/Fitzpatrick (6-card), Age, Gender, Skin concerns (multi-select), SPF Sensitivity (switch) — confirmed field labels at `SkinProfileEditModal.tsx:200,247,266,298,311,364,380`. Two more `Switch` controls at `:235,334,352` (unlabeled in this grep pass, but by profile-field parity these are the `hormoneTherapy`/`pregnantOrBreastfeeding`/`sensitive` toggles referenced elsewhere in the codebase).

---

## 6. Design System

**Reusable components in active use by this flow, with paths:**
- Cards: `src/components/ui/core/Card.tsx` (generic), plus flow-specific card wrappers built on top of it: `FunctionalProfileCard.tsx`, `DetectedActivesCard.tsx`, `CompositionComparisonMatrix.tsx`, `RoutinePlacementCard.tsx` (all `src/components/catalog/`)
- Chips: `src/components/ui/core/FilterChip.tsx` (category selection in capture screen), `src/components/ui/core/TimeChip.tsx` (unused by this flow but present in the same core kit)
- Badges: `src/components/ui/feedback/Badge.tsx`
- Tags (pill-style labels, used for actives/capability lists on the result screen): `src/components/ui/core/Tag.tsx`
- Inline alerts: `src/components/ui/feedback/InlineAlert.tsx` — **not used** on the result screen (`SkinTypeCautionNotice` rolls its own `View`/`Text`, `SkinTypeCautionNotice.tsx:37-44`, rather than reusing `InlineAlert`)
- Accordions: `src/components/addProduct/SectionAccordion.tsx` — exists, but only used by the Add-Product wizard, not by Explore
- Dividers: **NOT FOUND** as a named reusable component
- Tabs: **NOT FOUND** as a literal "Tabs" component; `src/components/ui/core/PillToggle.tsx` fills that role on `CatalogScreen.tsx:275-295` (Owned/Wishlist)
- Toast: `src/components/ui/feedback/Toast.tsx` (used on `CatalogScreen`, not on the Explore result screen itself)
- Empty state: `src/components/ui/core/EmptyState.tsx` (used by `CatalogScreen`'s own list-empty states, not reused inside `CompositionInsightsSection` — its per-card empty states are plain `<Text>`, see §2)

**Apothecary colors** — defined in `src/constants/tokens.ts`, `palette` object (`:13-74`):
```ts
plum: '#4F1242',        plumPressed: '#5E2151', plumTint: '#E5DBE3', plumTintLight: '#F9F0F8'
cabernet: '#800C2E',     cabernetTint: '#F8E9ED', cabernetLine: '#DDB8C3'
amber: '#A84C0E',        amberTint: '#FDF0E6',    amberLine: '#E6C4AB'
cobalt: '#1E3A8A',       cobaltTint: '#EBF0FA',   cobaltLine: '#B8C8E6'
bottleGreen: '#0F4C3A',  bottleGreenTint: '#EBF4F1', bottleGreenLine: '#B8D4CC'
```
Referenced in components via the `colors`/`palette` re-export in the same file, e.g. `statusSafe: palette.bottleGreen`, `statusWarning: palette.amber`, `statusInfo: palette.cobalt`, `statusSOS: palette.cabernet` (`tokens.ts:113-129`). All Explore-flow cards use `palette.plum`/`palette.plumTint` directly for their icon-circle accent (e.g. `DetectedActivesCard.tsx:8,65`) — "plum" is this flow's dominant accent color, not the semantic status colors.

**Localization:** **NOT IMPLEMENTED.** No `i18n`/`useTranslation`/translation-library import exists anywhere in `src/` (grep confirmed empty). All strings are hardcoded English string literals inline in JSX, matching the `CLAUDE.md` "English only — Phase 1" constraint. The capture screen's own paste-hint text (`ExploreCompositionCaptureScreen.tsx:204`, `"Paste the original Latin-character ingredients list, not a translation"`) confirms non-Latin/translated input is an explicit non-goal, not an oversight.

---

## 7. Infrastructure

**Analytics/event tracking:** **NOT IMPLEMENTED.** Grep for `analytics`, `trackEvent`, `logEvent`, `Analytics` across `src/` (excluding tests) returns zero results. No event is fired anywhere in the Explore flow (capture, parse, save-to-wishlist, put-on-shelf are all silent from an instrumentation standpoint).

**Tests:**
- Framework: Jest + `jest-expo` (per `.claude/rules/testing.md`, confirmed by actual test files using `jest.mock`/`jest.fn`, not `vitest`).
- `parseActiveIngredientDetails`/`ingredientParser.ts` — tested at `src/utils/ingredientParser.test.ts` (co-located unit test).
- `conflictEngine.ts` — tested at `src/utils/conflictEngine.test.ts`, plus a dedicated `src/utils/conflictEngine.pregnancyConflict.test.ts`.
- Explore-flow-specific component/integration tests exist under `tests/explore-composition/`: `ExploreCompositionCaptureScreen.test.tsx`, `ExploreCompositionResultScreen.test.tsx`, `ManualProductFormScreen.explore-prefill.test.tsx`.
- The full `productProfile/` pipeline (`resolve.ts`, `join.ts`, `capabilities.ts`, `shelfComparison.ts`, `routinePosition.ts`, `skinTypeCaution.ts`, `ingredientSectionExtractor.ts`) each has a co-located `*.test.ts`.
- `useCompositionInsights.ts` has its own `useCompositionInsights.test.ts`.
- Run via `npm test` (Jest) per `.claude/rules/testing.md`; type-check via `npx tsc --noEmit`.

**TODOs/FIXMEs/commented-out code within the Explore flow boundary:** **NONE FOUND.** Grep across `src/screens/catalog/`, `src/components/catalog/`, `src/hooks/useCompositionInsights.ts`, and `src/utils/productProfile/` for `TODO|FIXME|HACK` returns zero matches. The code carries extensive prose doc-comments (design-decision history, spec cross-references) but no open markers.

---

## 8. Feasibility Assessment

### A. Flag ingredients below the "1% line" (phenoxyethanol, parfum/fragrance, tocopherol, xanthan gum, sodium benzoate, disodium EDTA, carbomer)
**BLOCKED.**
- There is no concentration or percentage concept anywhere in the data model — grep of `actives.json` for `percent|concentration|%` returns nothing, and `ParsedActiveDetail.position` (the closest proxy, a comma-token index) is discarded before reaching the UI (§3).
- None of the eight named marker ingredients (phenoxyethanol, parfum/fragrance, tocopherol, xanthan gum, sodium benzoate, disodium EDTA, carbomer) exist as `ActiveIngredientKey` classes in `actives.json` at all — they are typically-below-1% "supporting" ingredients the active-class ruleset was never built to recognize (it targets active/functional ingredients like retinoids, acids, vitamin C).
- Files to touch: a new matcher/dictionary layer entirely separate from `actives.json` (these are preservatives/humectants/emulsifiers, a different taxonomy), plus `ingredientParser.ts`/`resolve.ts` would need a raw ordered-token array to survive (currently thrown away, §3) before any "below the 1% line" heuristic (position-based, since no % value exists) could be computed at all.

### B. Show position of key ingredients ("niacinamide — 6th on the list")
**PREPARATION NEEDED.**
- The raw ordered ingredient list DOES exist transiently: `tokenizeIngredientsText(rawIngredientsText)` (`resolve.ts:48-53`) already comma-splits into an ordered array, and it's already computed in `useCompositionInsights.ts:70` (currently only used for a count, `tokens.length`, at `useCompositionInsights.ts:105`). `ParsedActiveDetail.position` (`ingredientParser.ts:46-56`) also already computes a 1-based index per matched active class.
- What's missing: `resolve.ts:144` alphabetizes the resolved keys and drops position entirely — a new return field (`positionByKey`, parallel to the existing `potencyByKey`) would need to survive from `ingredientParser.ts` through `resolveFromRawText` into `CompositionInsights`, then a UI element would need to render "Nth on the list" using `tokens` (already available) for the ordinal.
- Files to touch: `src/utils/productProfile/resolve.ts` (stop discarding position), `src/hooks/useCompositionInsights.ts` (forward it), `src/components/catalog/DetectedActivesCard.tsx` (render it). No new parsing logic required — this is wiring, not a new engine.
- Note the explicit spec conflict: `docs/specs/explore-composition.md:223-224` requires the comparison *matrix* specifically to never show position — that constraint is scoped to the matrix, not to `DetectedActivesCard`, so it does not block this idea outright, but a redesign should treat it as a deliberate prior decision to revisit, not an oversight.

### C. Duplicates: intersection of scanned product vs. Shelf
**PREPARATION NEEDED.**
- `buildShelfComparison` (`src/utils/productProfile/shelfComparison.ts`) already computes `shelfActiveTagOverlapCount` — a same-category-Shelf-items-sharing-a-tag count — rendered today as the "Active tags" matrix row (`CompositionComparisonMatrix.tsx:82-95`). That is aggregate overlap, not a per-ingredient duplicate list.
- Missing: a function that returns which specific `ActiveIngredientKey`s (or raw tokens) are shared with which specific Shelf product(s), not just a count. Since `resolvedActiveKeys` (this composition) and `getProductActiveKeys(shelfProduct)` (each Shelf item, `ingredientParser.ts:190-215`) are both already `ActiveIngredientKey[]`, a set-intersection per Shelf product is a straightforward addition to `shelfComparison.ts`, not a new engine.
- Files to touch: `src/utils/productProfile/shelfComparison.ts` (add per-product intersection), a new or extended card component to render it.

### D. Gaps in routine (e.g. missing SPF in morning)
**PREPARATION NEEDED — logic exists elsewhere, just not wired to this screen.**
- `src/utils/spfAdequacy.ts` already implements SPF-adequacy checking for routines (confirmed file exists, per file listing in §Setup) — this is a routine-level check, not currently called from the Explore result screen (which has no routine/step context at all, only a bare `category`).
- `buildRoutinePosition` (`src/utils/productProfile/routinePosition.ts`) only computes where *this* composition would sit (a single phase label) — it does not inspect the user's actual `routinesStore` steps to detect a gap.
- Files to touch: would need a new composition, reading `useRoutinesStore` state (not currently imported by `useCompositionInsights.ts`) and reusing `spfAdequacy.ts`'s existing rules against it.

### E. Run `conflictEngine` directly on the result screen, against the Shelf, for a specific day
**PREPARATION NEEDED, blocked as much by an explicit product decision as by missing plumbing.**
- `docs/specs/explore-composition.md:71` states this as a Non-Goal by design ("No conflict-check UI on the result screen — `conflictEngine.ts` gets no new call sites here"), and the result screen's own doc comment repeats it (`ExploreCompositionResultScreen.tsx:43-45`). Reversing this requires a product decision, not just an engineering task — same pattern as the Story 6/7/8 reversal already recorded in this same spec's history.
- Mechanically, `ConflictEngine.getConflictsForProduct(product, catalog)` (`conflictEngine.ts:119-137`) is close to directly usable: it needs a `Product`-shaped object, but only three fields matter to `getProductActiveKeys` (`ingredientParser.ts:190-215`): `activeIngredients` (can be `[]`), `activeTags` (can be `resolvedActiveKeys` from this screen), `fullIngredientText` (`rawIngredientsText`, already in hand). A "day" dimension does not exist in this API at all — `detectConflicts`/`getConflictsForProduct` compare products pairwise with no schedule awareness; day-of-week filtering would have to happen in the caller (cf. `activeIngredientDensity.ts`'s own `FindingOptions.dayOfWeek` pattern, `activeIngredientDensity.ts:151-157`, for a precedent already in this codebase).
- Files to touch: `useCompositionInsights.ts` (construct the throwaway `Product` shape, call `getConflictsForProduct`), a new result-screen card, and — if day-specific — a day filter modeled on `activeIngredientDensity.ts`'s existing convention.

### F. Coverage string ("parsed N out of M ingredients")
**READY FOR IMPLEMENTATION.**
- Every number needed already exists in-memory at the exact point this screen would render it: `tokens.length` (`useCompositionInsights.ts:70`, total comma-split tokens, already computed) as M, and `resolved.unresolvedIngredientTokens.length` (`resolve.ts:147`, already computed by `resolveFromRawText`, just not exposed) to derive "parsed" = M − unresolved.
- The only gap is that `CompositionInsights` (`useCompositionInsights.ts:49-56`) doesn't currently export `unresolvedIngredientTokens` or `tokens.length` to the screen — a one-field addition to the returned object, no new logic, no new engine call.
- Files to touch: `src/hooks/useCompositionInsights.ts` (add the two numbers to the return type), `src/components/catalog/DetectedActivesCard.tsx` or a small new line in `CompositionInsightsSection.tsx` to render the string.

---

## 9. Discrepancies and Risks

**Where code diverges from `/docs`:**
- The spec (`docs/specs/explore-composition.md:223-224`) restricts the position/concentration-order non-goal to the **comparison matrix** specifically. The actual code is stricter than the spec: `resolve.ts` drops `position` entirely before it leaves stage 1, for every consumer, not just the matrix. This is a codebase-wide foreclosure of §8B, not a matrix-scoped one — worth flagging before assuming §8B is a small, isolated change.
- `useCompositionInsights.ts:65-70` computes `resolved.unresolvedIngredientTokens` and `tokens` but the `CompositionInsights` interface silently drops both before they reach any screen. Neither the spec nor the tech design document this as a deliberate omission (the tech design's "reuse mechanism" framing, `useCompositionInsights.ts:14-27`, only discusses what the hook does compute) — this reads as an unused-signal gap rather than an intentional non-goal, unlike the position/matrix decision above.
- The spec's own Story 9 supersession note (`ExploreCompositionResultScreen.tsx:39-42`) documents that the full raw-token ingredient list was removed in favor of "Detected actives" only, specifically because the naive tokenizer couldn't separate ingredients from OCR-captured Directions/Cautions noise. `extractIngredientSection` (added afterward) mitigates the OCR-noise problem but the full-list UI was never restored — so today there is genuinely no way for a user to see *all* their scanned tokens, only the subset that matched a known active class.

**What looks fragile or unfinished:**
- `assets/corpus/vials_corpus.db` sits in the repo unused at runtime (§4) — either dead weight or an unfinished bundled-fallback path; either way it's a footgun for someone assuming "the DB is local."
- `unresolvedIngredientTokens`/token coverage (§2, §8F) is fully computed, fully tested indirectly via `resolve.test.ts`, and then silently dropped — the cheapest possible win (§8F) is sitting unused in the pipeline today.
- Normalization is thin: no handling of `;`-separated lists, brackets/CI numbers, asterisks, or OCR line-break-as-separator (§3). A real product label with any of these will silently under-detect actives with no user-facing signal that anything was missed (compounded by the previous point).
- `SkinTypeCautionNotice` renders nothing at all — no placeholder, no explanation — when `skinType === null` (most first-time users before completing onboarding/profile). A user who hasn't filled in their skin type gets a card that simply never appears, with no affordance nudging them to set it, unlike other Vials screens.
- Two live databases exist in this app (remote Turso HTTP corpus + local `expo-sqlite` contributions DB) with confusingly similar names (`vials_corpus.db` bundled-but-unused vs. `vials-contributions` the actual local DB) — a redesign or handoff document should disambiguate these explicitly to avoid a future contributor wiring something to the wrong one.

**Three questions to answer before planning this screen's redesign:**
1. Is discarding INCI position (§3, §8A/B) an intentional, permanent product stance, or an artifact of the matrix-specific non-goal in the spec being over-applied in the implementation? This determines whether "6th on the list" / "below the 1% line" features require new parsing work or just re-plumbing already-computed values.
2. Should the currently-silent `unresolvedIngredientTokens` signal (§2, §8F) become user-facing (a coverage string, an "N ingredients not recognized" note), and if so, does that change how aggressively `ingredientParser.ts`'s dictionary needs to expand — right now, an unrecognized ingredient is indistinguishable from "no active ingredients present" from the user's point of view?
3. Is "never call `conflictEngine.ts` from this screen" (§4, §8E) still the intended product boundary, or was it only ever a v1-scope decision waiting on the Shelf-comparison/routine-placement features (Stories 6/8) to ship first — as those two already did reverse an earlier non-goal in this same spec?
