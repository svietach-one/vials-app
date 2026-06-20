# Technical Design: Vials MVP Implementation
Spec: docs/specs/vials-mvp-implementation.md
Author: planner-agent
Date: 2026-06-19

---

## 1. Architecture Overview

The app is a fully local React Native / Expo 52 client. Data flows in one direction: UI actions call Zustand store actions, which persist synchronously to MMKV. Screens read from stores via selectors. The ConflictEngine is a pure utility class — screens call it on render, never stores.

```
Screen / Component
    |
    ├── reads: Zustand selector (products, routines, procedures, profile, settings)
    ├── writes: store action (add / update / remove)
    |          └── MMKV.set(key, JSON.stringify(value))  [synchronous]
    |
    └── calls: ConflictEngine.detectConflicts() / checkSeasonalConflict() etc.
               └── reads: INGREDIENT_CONFLICT_RULES, PROCEDURE_COLLISION_RULES [constants]

OBF API (product search only, outbound, no user data)
    └── src/services/openBeautyFacts/search.ts
              └── fetch → world.openbeautyfacts.org
              └── offline guard: returns [] immediately if no network
```

No new architectural layers are introduced. All new code slots into the existing `src/` structure.

---

## 2. API Contracts

### External: Open Beauty Facts product search
```
GET https://world.openbeautyfacts.org/cgi/search.pl
  ?search_terms={query}
  &search_simple=1
  &action=process
  &json=1
  &page_size=10

Response 200:
{
  products: Array<{
    product_name: string,
    brands: string,
    product_type?: string,
    ingredients_text: string,
    _id: string
  }>
}

Errors handled locally:
  - Network unavailable → return []
  - Non-200 status → return []
  - Malformed JSON → return []
```

No auth headers. No user data in request. Internal wrapper signature:

```typescript
// src/services/openBeautyFacts/search.ts
export async function searchProducts(query: string): Promise<OBFProduct[]>
// Returns [] on any failure — never throws
```

---

## 3. Implementation Tasks

### Phase 0 — MMKV Migration

**engineer (scope=frontend)**

- P0-1: Install react-native-mmkv — `npx expo install react-native-mmkv`; update `app.json` if plugin config required; document custom dev client requirement in a comment at the top of `src/services/storage.ts`. Files: `package.json`, `app.json`, `src/services/storage.ts`

- P0-2: Rewrite `src/services/storage.ts` — replace AsyncStorage import with `import { MMKV } from 'react-native-mmkv'`; create a single module-level `storage` instance; implement synchronous `loadJson<T>(key, fallback)` using `storage.getString(key)` and `saveJson<T>(key, value)` using `storage.set(key, JSON.stringify(value))`; keep the `STORAGE_KEYS` constant unchanged. Files: `src/services/storage.ts`

- P0-3: Update all 5 stores to remove `await` on `saveJson` calls since writes are now synchronous; verify `hydrate()` functions still work (MMKV reads are sync but hydrate can remain async-shaped for API compatibility). Files: `src/store/productsStore.ts`, `routinesStore.ts`, `proceduresStore.ts`, `profileStore.ts`, `settingsStore.ts`

- P0-4: Update TypeScript types — add `deferralCount: number`, `realDuration?: number` to `UserProcedureLog`; add `'overdue'` to `ProcedureStatus`; add `individualDurationMonths: Partial<Record<CosmeticProcedureKey, number>>` to `UserProfile`; add `dismissedBanners: string[]` to `AppSettings`. Files: `src/types/index.ts`

### Phase 1 — Onboarding Stack

**engineer (scope=frontend)**

- P1-1: Create `MarketingSlidesScreen` — 3-slide horizontal swiper using `ScrollView` with `pagingEnabled`; dot indicator; primary black Button DS component on each slide; final slide CTA navigates to `SkinProfileSetupScreen`. Files: `src/screens/onboarding/MarketingSlidesScreen.tsx`

- P1-2: Create `SkinProfileSetupScreen` — form with age TextInput (numeric), gender selector (2 DS Tag chips), skin type selector (4 DS Tag chips), phototype 3-card selector; each phototype card is a TouchableOpacity with shade visual + full accessibilityLabel; on submit saves to `useProfileStore` and navigates to `FirstProductScreen`. Files: `src/screens/onboarding/SkinProfileSetupScreen.tsx`, `src/components/onboarding/PhototypeCard.tsx`

- P1-3: Create `FirstProductScreen` — OBF search bar + results list + manual form fallback + "Skip for now" secondary Button; on save or skip sets `profileStore.onboardingCompleted = true` and navigates to main tabs. Files: `src/screens/onboarding/FirstProductScreen.tsx`

- P1-4: Update `AppNavigator` — on mount read `profileStore.onboardingCompleted`; if false render `OnboardingStack` (new NativeStack with the 3 onboarding screens); if true render `MainTabs`. Files: `src/navigation/AppNavigator.tsx`

### Phase 2 — Today Screen

**engineer (scope=frontend)**

- P2-1: Create `ClinicalRestrictionsBlock` — reads `useProceduresStore` for rehab procedures; calls `ConflictEngine.getRehabRestrictions(procedure.procedureKey)`; renders restriction rows using DS ListRow with Cabernet icon tint; renders safe indicators in bottleGreen; hidden when no rehab procedures exist. Files: `src/components/routine/ClinicalRestrictionsBlock.tsx`

- P2-2: Create `SeasonalNoticeBanner` — calls `getCurrentSeason()` from timeHelpers; checks `settingsStore.dismissedBanners` to suppress if already dismissed; renders DS InlineAlert in cobalt; dismiss button writes `banner_YYYY_season` key to `settingsStore`. Files: `src/components/routine/SeasonalNoticeBanner.tsx`

- P2-3: Rewrite `RoutinesScreen.tsx` (Today sub-view) — replace all hardcoded mock data with real store selectors; filter steps for today's weekday; render DS Checkbox per step; wire checkbox toggle to `settingsStore.gamificationEnabled` for Cabernet vs. black fill; render `EmptySlotPlaceholder` when `step.productId` is null. Files: `src/screens/RoutinesScreen.tsx`

### Phase 3 — Weekly Plan

**engineer (scope=frontend)**

- P3-1: Install react-native-draggable-flatlist — `npx expo install react-native-draggable-flatlist`. Files: `package.json`

- P3-2: Create `WeeklyPlanView` — AM/PM DS SegmentedControl; `DraggableStepList` using draggable-flatlist wired to `routinesStore.updateRoutine`; per-step `WeeklySchedulePicker` (day chips array); `ConflictWarningInline` at bottom calling `ConflictEngine.detectConflicts()`. Files: `src/components/routine/WeeklyPlanView.tsx`, `src/components/routine/WeeklySchedulePicker.tsx`, `src/components/routine/ConflictWarningInline.tsx`

- P3-3: Wire the header toggle in RoutinesScreen between Today sub-view and Weekly Plan sub-view (local `useState` toggle, not a separate navigator screen). Files: `src/screens/RoutinesScreen.tsx`

### Phase 4 — Catalog Screen

**engineer (scope=frontend)**

- P4-1: Create `src/services/openBeautyFacts/search.ts` — implements `searchProducts(query: string): Promise<OBFProduct[]>` with fetch + offline guard + JSON parse + error catch → return []. Files: `src/services/openBeautyFacts/search.ts`, `src/services/openBeautyFacts/types.ts`

- P4-2: Rewrite `ProductsScreen.tsx` — replace hardcoded mock array with `useProductsStore` selector; compute PAO expiry inline; render DS Card per product with amber expiry label; render `CatalogFilterHeader` (category pills + biomarker toggles using DS Tag); empty state when `products.length === 0`. Files: `src/screens/ProductsScreen.tsx`

- P4-3: Create add-product flow — `ProductSearchInput` component (debounced OBF call, useDebounce hook); results list; `ProductForm` (manual entry DS Inputs for brand, name, type Dropdown, INCI textarea); `DeleteProductModal` (DS modal checking routinesStore for active steps before confirming delete). Files: `src/components/product/ProductSearchInput.tsx`, `src/components/product/ProductForm.tsx`, `src/components/product/DeleteProductModal.tsx`

### Phase 5 — Clinic Screen

**engineer (scope=frontend)**

- P5-1: Create `12MonthForecastTimeline` — horizontal ScrollView of monthly milestone markers; reads proceduresStore; uses Cobalt track color from tokens; renders procedure name and phase label per entry. Files: `src/components/clinic/ForecastTimeline.tsx`

- P5-2: Create `ProcedureLifespanCard` — progress bar computed from `(now - datePerformed) / totalEffectMonths`; Amber track color when current month >= `fadeTriggerMonth`; manual slider to adjust `expectedDurationMonths` via `proceduresStore.updateProcedure`. Files: `src/components/clinic/ProcedureLifespanCard.tsx`

- P5-3: Create `FadingInteractivePrompt` — "Still holding" primary Button increments `deferralCount`, extends effective end date by 14 days, calls `proceduresStore.updateProcedure`; at `deferralCount === 3` status becomes 'overdue' and "Still holding" button is hidden; "No, it faded" archives procedure and updates `profileStore.individualDurationMonths`. Files: `src/components/clinic/FadingInteractivePrompt.tsx`

- P5-4: Create `AddProcedureModal` — form inputs; on save attempt runs `ConflictEngine.checkSeasonalConflict()` and `ConflictEngine.checkProcedureCollision()`; if either returns a result renders Cabernet DS InlineAlert and disables save. Files: `src/components/clinic/AddProcedureModal.tsx`

- P5-5: Rewrite `ClinicScreen.tsx` — connect all clinic components to proceduresStore; render empty state when `procedures.length === 0`; render `HiddenStepsManager` footer. Files: `src/screens/ClinicScreen.tsx`

### Phase 6 — Profile Screen

**engineer (scope=frontend)**

- P6-1: Install expo-sharing and expo-document-picker — `npx expo install expo-sharing expo-document-picker`. Files: `package.json`

- P6-2: Create `ExportBackupUtility` — reads all 5 MMKV keys, composes `{version, exportedAt, data: {profile, products, routines, procedures, settings}}` JSON; triggers `expo-sharing` share sheet. Files: `src/components/profile/ExportBackupUtility.tsx`

- P6-3: Create `ImportRestoreUtility` — `expo-document-picker` for `.json` files; validates top-level `version` field; shows summary counts; renders Replace / Merge buttons; Merge skips records whose `id` already exists in the store; Replace wipes then loads. Files: `src/components/profile/ImportRestoreUtility.tsx`

- P6-4: Rewrite `ProfileScreen.tsx` — `SkinProfileEditor` form bound to `useProfileStore`; DS Switch for gamification; ExportBackupUtility; ImportRestoreUtility; `LocalDataWarningModal` gated on `settingsStore.hasSeenLocalDataWarning`. Files: `src/screens/ProfileScreen.tsx`

### Phase 7 — Polish

**engineer (scope=frontend)**

- P7-1: Four-state audit — add loading skeleton (DS placeholder shimmer or ActivityIndicator) to Catalog and Clinic screens; add error boundary around OBF fetch; verify all screens have explicit empty state UI. Files: all screen files

- P7-2: Replace emoji icon stubs with Feather icons from `@expo/vector-icons` across all screens. Files: all screen files

- P7-3: Replace all Russian-language inline comments with English. Files: all screen files

- P7-4: Run `npx tsc --noEmit` and resolve all errors before handoff. Files: any file with type errors

### engineer (unit tests)

- UT-1: Unit tests for `conflictEngine.ts` — all 5 conflicting pairs trigger `detectConflicts`; the 1 compatible pair (RETI + PEPT) does not trigger; seasonal check triggers for chemical_peel_deep in summer; phototype check triggers for type_3_4 and type_5_6 with chemical_peel_deep. Files: `src/utils/conflictEngine.test.ts`

- UT-2: Unit tests for `ingredientParser.ts` — verify INCI text maps to correct ActiveIngredientKey array for each tag group. Files: `src/utils/ingredientParser.test.ts`

- UT-3: Unit tests for `timeHelpers.ts` — verify `getCurrentSeason()` returns correct season for boundary dates (June 1, September 1, December 1, March 1). Files: `src/utils/timeHelpers.test.ts`

---

## 4. Assumptions

- All DS components in `src/components/ui/` are used as-is without API changes.
  Alternative: rebuild DS components inline per screen.
  Reason: the DS library is complete and tested; reuse prevents drift.

- MMKV module instance is created once at module level in `storage.ts` and imported by all stores.
  Alternative: one MMKV instance per store.
  Reason: single instance avoids multiple native bridge initializations and key namespace collisions.

- OBF search is fire-and-forget with a [] fallback — no retry logic in Phase 1.
  Alternative: exponential backoff retry.
  Reason: the manual entry path is always available; retry complexity is disproportionate for v1.

- `hydrate()` functions in all stores remain async-shaped (return `Promise<void>`) even though MMKV reads are sync, so callers do not need to change.
  Alternative: convert hydrate to sync.
  Reason: async-shaped API allows future migration or lazy hydration without store interface changes.

- Backup file format uses a `version: 1` top-level field for future schema evolution.
  Alternative: no versioning.
  Reason: import validation requires a version field to detect incompatible future schemas.

---

## 5. Open Questions

- Expo dev client build pipeline: engineer must confirm local `npx expo run:ios` / `npx expo run:android` works before starting P0-1, since MMKV cannot run in Expo Go.
- OBF `page_size=10` limit: if search results are insufficient, increase to 20; confirm with product owner whether a paginated results list is needed (deferred to Phase 4 scope review).
