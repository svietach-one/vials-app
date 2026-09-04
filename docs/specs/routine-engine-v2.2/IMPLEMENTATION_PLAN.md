# Vials — Phased Implementation Plan
Task slug: vials-mvp-implementation
Date: 2026-06-19
Status: DESIGNED

> **Update (2026-07-25):** Phases 8–10 added below, continuing this plan for the
> skin-condition / active-density / SPF-adequacy work specified in `PRD_Spec.md` v1.2 and
> `USER_STORIES.md` US-23–US-29. All three phases are additive to Phases 0–7 above — no
> existing phase's scope changes, and Phase 8/9's engine work has an explicit no-op
> regression requirement (US-27) for users who don't opt in.

---

## Context & Baseline

The project has a working Expo SDK 52 shell with:
- React Navigation v7 bottom tab navigator (4 tabs wired)
- Zustand stores for products, routines, procedures, profile, settings (all hydrating from AsyncStorage)
- Design token system (`src/constants/tokens.ts`) translated from CSS token files
- DS component library in `src/components/ui/` (Button, Card, IconButton, ListRow, Tag, Badge, InlineAlert, ProgressRing, Checkbox, Input, SegmentedControl, Switch, TabBar — all built as .jsx/.tsx with .d.ts stubs)
- ConflictEngine class fully implemented with ingredient, procedure-collision, seasonal, phototype, and rehab-restriction checks
- Screen stubs in `src/screens/` — currently holding hardcoded mock data, not wired to stores

What does NOT yet exist:
- Onboarding stack (no MarketingSlidesScreen, SkinProfileSetupScreen, FirstProductScreen)
- Real screen implementations connected to Zustand stores and DS components
- Vials API client service (`src/services/vialsApi/`)
- Universal Scanner overlay with barcode + OCR dual-stream pipeline
- Export/Import backup utilities

---

## Option B — AsyncStorage retained (CONFIRMED)

AsyncStorage stays as the persistence layer for Phase 1 MVP so the app can run in Expo Go without a custom native build. All Zustand store hydration and persistence reads/writes use AsyncStorage throughout Phase 1 — no alternative storage driver is introduced in this phase. Any future migration to a faster storage backend is deferred to a post-MVP infrastructure pass.

---

## Phase 0 — Foundation (Types + DS Component Ports + Network Infrastructure)

**Goal:** Close the gaps that block all screen work: missing type fields, missing React Native DS components, and the network client infrastructure required by the Universal Scanner.

**Scope:**
1. Update `src/types/index.ts` — add `deferralCount`, `realDuration`, `'overdue'` status, `individualDurationMonths`, `dismissedBanners`
2. Update `src/store/settingsStore.ts` — add `dismissedBanners: string[]` field and `dismissBanner(key)` action
3. Port remaining web DS components to React Native `.tsx`: `Input`, `Checkbox`, `Switch`, `SegmentedControl` (needed by Phase 1–3 screens)
4. Scaffold `src/services/vialsApi/` network client infrastructure:
   - `src/services/vialsApi/client.ts` — base fetch client pointed at the Vials API base URL (read from `EXPO_PUBLIC_VIALS_API_URL` env var); handles request timeout and generic error normalization
   - `src/services/vialsApi/products.ts` — three named exports:
     - `lookupBarcode(code: string)` → `GET /api/v1/products/lookup`
     - `searchByText(query: string)` → `GET /api/v1/products/search` (leverages backend trigram `pg_trgm` matching)
     - `suggestProduct(payload: SuggestPayload)` → `POST /api/v1/products/suggest`

**Dependencies to install in Phase 0:** `expo-camera` — required by `UniversalScannerOverlay` in Phases 1 and 4; installed now to avoid a breaking re-install mid-phase.

---

## Phase 1 — Onboarding Stack

**Goal:** Give new users a first-run flow that populates the profile store before unlocking the main tabs.

**Screens to build:**
- `MarketingSlidesScreen` — 3 swipeable slides, black primary CTA
- `SkinProfileSetupScreen` — age, gender, skin type, phototype selector (3 unlabeled cards with accessibilityLabel)
- `FirstProductScreen` — text search bar querying the Vials API (`searchByText`) + `UniversalScannerOverlay` camera button + `ProductForm` manual fallback + "Skip for now" outline button

**Navigation change:** AppNavigator must check `profileStore.onboardingCompleted` on launch and route to the onboarding stack or main tabs accordingly.

---

## Phase 2 — Today Screen (Tab 1, Sub-View A)

**Goal:** Wire the Today view to real store data and DS components.

**Components to build:**
- `ClinicalRestrictionsBlock` — reads `proceduresStore`, renders rehab restrictions from `ConflictEngine.getRehabRestrictions()` with Cabernet/Green accents
- `SeasonalNoticeBanner` — reads `timeHelpers.getCurrentSeason()`, dismissible, stores dismissed state in settingsStore
- `RoutineChecklistContainer` — AM/PM split, filters steps for today's weekday from routinesStore
- `RoutineStepCard` — reads product from productsStore, DS Checkbox wired to gamification toggle
- `EmptySlotPlaceholder` — shown when step.productId is null (product deleted)

---

## Phase 3 — Routine Hub Weekly Plan (Tab 1, Sub-View B)

**Goal:** Build the schedule editing view with drag-and-drop reorder and inline conflict detection.

**Components to build:**
- `AM_PM_SegmentedControl` — uses DS SegmentedControl
- `DraggableStepList` — react-native-draggable-flatlist wired to routinesStore.updateRoutine
- `WeeklySchedulePicker` — day-of-week multi-select embedded in each step row
- `ConflictWarningInline` — calls `ConflictEngine.detectConflicts()` on each render, renders DS InlineAlert in amber if conflicts exist

**Dependencies:** react-native-draggable-flatlist must be installed (not currently in package.json).

---

## Phase 4 — Catalog Screen (Tab 2)

**Goal:** Replace hardcoded mock data with real store data; implement the Universal Scanner + Vials API ingestion pipeline with crowdsourced manual fallback.

**Components to build:**
- `CatalogList` — reads productsStore, computes PAO expiry from `product.openedDate + paoMonths`, shows Amber label if within 30 days
- `CatalogFilterHeader` — category pills + biomarker toggles (Soothing/Actives/Hydration) using DS Tag/Chip
- `UniversalScannerOverlay` — full-screen camera overlay (built on `expo-camera`) with a central rectangular viewfinder bracket:
  - Simultaneously runs a barcode decoder (`EAN-13 / UPC`) and an OCR text-frame capture pipeline on the same live camera feed
  - Barcode recognition takes absolute priority: a successful decode immediately fires `lookupBarcode(code)` → `GET /api/v1/products/lookup` and halts the OCR pipeline
  - When no barcode is detected but a stable block of text is visible in the viewfinder, fires `searchByText(query)` → `GET /api/v1/products/search`; the viewfinder frame pulses Cobalt (`#1E3A8A`) during active OCR processing
  - **Offline state:** If the network is unavailable, a banner mounts above the viewfinder: *"Offline Mode. Scanning unavailable. Switch to manual entry"*. The scan trigger is disabled and the UI automatically transitions to an empty `ProductForm`
  - **No-result state:** If both `/lookup` and `/search` return an empty array, a *"Product Not Found. Add Manually"* button is presented; tapping it opens `ProductForm` pre-filled with any text extracted by the OCR layer
- `ProductForm` (Manual Fallback + Crowdsourcing) — text inputs for Brand, Name, Type dropdown, and a large multi-line raw INCI field (`inci_raw`):
  - **Pre-fill:** When accessed via a failed Universal Scan, `brand` and `name` fields are auto-populated with OCR-extracted strings, minimizing typing friction
  - **Instant local activation on save:** The new record is immediately written to `productsStore` with `source: 'manual'`, making it available for routines and conflict checks without any server round-trip
  - **Asynchronous background sync:** After the local write, the app fires `suggestProduct(payload)` → `POST /api/v1/products/suggest` in the background with `status: 'pending'`. The save action never awaits this call — the user sees an immediate success toast ("Product added to your shelf") and is returned to the Shelf with no loader or blocking state
- `DeleteProductModal` — checks routinesStore for active steps before deleting, DS modal pattern

**Service consumed:** `src/services/vialsApi/products.ts` (scaffolded in Phase 0).

---

## Phase 5 — Clinic Screen (Tab 3)

**Goal:** Build the procedure timeline and fading prompt flow from real store data.

**Components to build:**
- `12_MonthForecastTimeline` — horizontal calendar ribbon using Cobalt track, reads proceduresStore
- `ProcedureLifespanCard` — progress bar based on `CLINICAL_RULES_DB` durations, Amber fading zone
- `FadingInteractivePrompt` — "Still holding" / "No, it faded" CTA pair; 3-deferral cap written to procedure record via `proceduresStore.updateProcedure`
- `AddProcedureModal` — form + seasonal check + spacing check via ConflictEngine, Cabernet block alert on violation
- `HiddenStepsManager` — expandable list of `step.hidden === true` entries from routinesStore

---

## Phase 6 — Profile Screen (Tab 4)

**Goal:** Wire profile editing, gamification toggle, and backup utilities to real stores.

**Components to build:**
- `SkinProfileEditor` — form bound to profileStore (age, gender, skin issues, phototype cards reused from onboarding)
- `GamificationToggle` — DS Switch bound to settingsStore.gamificationEnabled
- `ExportBackupUtility` — reads all AsyncStorage keys belonging to the Zustand persistence namespace, serializes the full dataset to a single tagged `.json` file (with schema version header), and triggers the native share sheet via `expo-sharing`
- `ImportRestoreUtility` — accepts a previously exported `.json` via `expo-document-picker`, validates schema version against the current AsyncStorage schema, and offers **Replace** (clears current AsyncStorage store, loads file as-is) or **Merge** (adds records from file that don't already exist locally by ID, skips exact duplicates) before a confirmation summary screen ("This will add 12 products, 3 procedures...") and final commit
- `LocalDataWarningModal` — shown once per install (guarded by `settingsStore.hasSeenLocalDataWarning`)

**New dependencies:** `expo-sharing`, `expo-document-picker` (check Expo SDK 52 compatibility before installing).

---

## Phase 7 — Polish & All-States Compliance

**Goal:** Ensure every screen and component handles loading, empty, error, and data states per the All-States Rule.

**Tasks:**
- Audit every screen against the four-state rule (loading / empty / error / data)
- Add skeleton loaders for catalog list and clinic timeline
- Wire error boundaries around Vials API calls
- Add haptic feedback on checkbox toggle (via `expo-haptics`)
- Replace all emoji icon stubs (`⚙️`, `⚠️`, `🔍`) with Feather icons from `@expo/vector-icons`
- Replace all hardcoded Russian comment strings with English
- Run `npx tsc --noEmit` to zero out TypeScript errors across src/

---

## Dependency Installation Checklist

| Package | Phase | Expo Go Compatible? | Status |
|---|---|---|---|
| expo-camera | 1, 4 | ✅ Yes | Not installed |
| react-native-draggable-flatlist | 3 | ✅ Yes | Not installed |
| expo-sharing | 6 | ✅ Yes | Not installed |
| expo-document-picker | 6 | ✅ Yes | Not installed |
| expo-haptics | 7 | ✅ Yes | Not installed |

All above require `npx expo install <package>` (not `npm install`) for correct SDK 52 version pinning.

---

## Phase 8 — Skin Condition Risk Modifiers

**Goal:** Add optional, self-reported skin-condition profile flags (eczema, seborrheic
dermatitis, rosacea) that escalate existing warning severity and copy — additive only,
zero behavior change for users who select none (`US-27`).

**Reference:** `PRD_Spec.md` §4.2.2, §5.1, §5.2; `USER_STORIES.md` US-23–US-27.

### Phase 8.0 — Types & Data Model
- Add `skinConditions: SkinConditionType[]` to `Profile` in `src/types/index.ts`
- Add `BPO`, `AZA` to `ActiveIngredientKey`; add `BarrierIngredientKey` type
  (`CERA`/`PANT`/`GLYC`/`NIAC`/`ZPCA`)
- Add `Severity` as an explicit `'Low' | 'Medium' | 'High'` type; update existing matrix
  constants in `conflictEngine.ts` to use it explicitly (type-only tightening, no
  behavior change — covered by the US-27 regression test)
- `profileStore`: default `skinConditions: []` on init/hydration

### Phase 8.1 — Engine Layer
- `src/utils/conflictEngine.ts`: add `BPO_PATTERNS`/`AZA_PATTERNS` to `parseInciTags`; add
  new exported `parseBarrierTags()` (separate function, separate output type — never
  merged into the conflict-tag array)
- `src/utils/skinConditionModifiers.ts` (NEW): `CONDITION_MODIFIERS` table,
  `applyConditionSeverityModifiers()`, `getConditionRiskWarnings()`,
  `getRecoveryConditionCaution()`
- Unit tests: full escalation matrix (escalation, cap-at-High, no-stacking), US-27
  regression harness (empty-conditions equivalence test)

### Phase 8.2 — Onboarding & Profile UI
- `SkinProfileSetupScreen`: new `ConditionSelector` step (US-23), skip-compatible
- `SkinProfileEditor` (Tab 4): same picker, editable post-onboarding

### Phase 8.3 — Warning Surface Wiring
- `ConflictWarningInline` (Tab 1B): wire `applyConditionSeverityModifiers` into existing
  pairwise render path; add `condition-advisory` row type (US-24)
- `ClinicalRestrictionsBlock` (Tab 1A): wire `getRecoveryConditionCaution` for Rehab (US-25)
- `ProcedureLifespanCard` / `FadingInteractivePrompt` (Tab 3): wire same for Fading (US-25)
- **Defer** the seborrheic "rich/occlusive" product-format check if `Product.texture` or
  equivalent doesn't exist yet in the catalog schema — ship as a documented no-op with a
  tracked follow-up rather than adding a new catalog field under this phase's scope.

### Phase 8.4 — Compliance & Polish
- Central banned-phrase lint over `CONDITION_MODIFIERS` message strings (US-26)
- Visual QA: condition-advisory rows distinguishable from pairwise-conflict rows and from
  Cabernet hard-block modals
- Add disclaimer copy review to the existing clinical/legal review checklist
  (`PRD_Spec.md` §6)
- Run `npx tsc --noEmit`

**Dependencies:** none new.

---

## Phase 9 — Active Ingredient Density Insights

**Goal:** Detect the same active ingredient appearing in ≥2 products within one AM/PM
period and surface a tiered, non-blocking note — informational for mild actives, a real
caution for irritant-prone ones. Runs for every user, not gated behind Phase 8's
condition flags (though it composes with them).

**Reference:** `PRD_Spec.md` §5.2 (Active Ingredient Density Insights subsection);
`USER_STORIES.md` US-28.

### Phase 9.0 — Taxonomy
- Add `HYAL` to `BarrierIngredientKey` and `parseBarrierTags()` (Hyaluronic Acid / Sodium
  Hyaluronate — also finally backs the existing `Hydration` biomarker pill in
  `CatalogFilterHeader`, `PRD_Spec.md` §4.3, which had no detection rule until now)

### Phase 9.1 — Engine
- `src/utils/activeIngredientDensity.ts` (NEW): `TIER_MAP` (Ignore/Insight/Warning per
  `PRD_Spec.md` §5.2), `DENSITY_MESSAGES`, `getActiveDensityFindings()`,
  `applyConditionDensityModifiers()` (reuses Phase 8's `escalate()` helper — insight→warning
  only, same no-stacking cap as US-24)
- Unit tests: tier assignment for all 9 non-ignore-eligible tags, the `productCount >= 2`
  threshold boundary, period-scoping (AM vs PM independence), condition-escalation cap

### Phase 9.2 — UI Wiring
- `ConflictWarningInline`: add `density-insight` (**Cobalt**) and `density-warning`
  (Amber) row kinds
- Visual QA: `density-insight` rows must not read as warnings — distinct from `conflict`,
  `condition-advisory`, and `density-warning` rows

### Phase 9.3 — Compliance
- Extend the Phase 8.4 banned-phrase lint to cover `DENSITY_MESSAGES` (US-26)
- No separate clinical-sign-off item — route through the same combined review pass as
  Phase 8 and the §5.2 collision-matrix proposal (`PRD_Spec.md` §6)

**Dependencies:** none new.

---

## Phase 10 — Phototype-Aware SPF Adequacy Recommendation

**Goal:** Recommend stronger sunscreen to Light/Fair-phototype users in summer when their
scheduled SPF product is below the commonly-recommended minimum. Grounded in mainstream,
non-contested dermatological consensus (unlike Phases 8–9's ingredient-interaction work),
so it does not carry the same clinical-sign-off gate.

**Reference:** `PRD_Spec.md` §4.2.1; `USER_STORIES.md` US-29.

### Phase 10.0 — Schema
- Add `spfValue: number | null` to local `Product` type (`PRD_Spec.md` §5.1)
- Add `spf_value integer` to remote `products` table (Supabase migration — see
  `db-tech-design.md` §3–4 for the local/remote schema pair this extends)
- `ProductForm`: conditional numeric input when `Type === 'SPF'`

### Phase 10.1 — Engine
- `src/utils/spfAdequacy.ts` (NEW): `getSpfAdequacyFinding()` — phototype gate (Light/Fair
  only in v1), season gate (reuses `timeHelpers.getCurrentSeason()`, same summer boundary
  already used for procedure blocking in `PRD_Spec.md` §5.3), SPF-30 threshold
- Unit tests: phototype gating, season gating, missing-`spfValue` handling (no false
  positive), threshold boundary (exactly SPF 30 does not trigger; SPF 29 does)

### Phase 10.2 — UI
- Extend `SeasonalNoticeBanner` with the new finding type, rendered **Cobalt**
- Dismiss key is season-and-year-scoped (e.g. `spf-upgrade-summer-2026`) via the existing
  `settingsStore.dismissedBanners`/`dismissBanner(key)` mechanism from Phase 0 — must not
  permanently suppress the banner past the current season

**Dependencies:** none new.

**Explicitly deferred (tracked, not forgotten):** SPF-30 baseline enforcement for
Medium/Olive and Dark/Deep phototypes; a separate "no SPF scheduled at all" finding;
PA-rating (UVA) evaluation for Asian/European-labeled sunscreens.

---

## Architecture Constraints (apply to all phases)

- **Hybrid Ingestion Anonymity:** No personal configurations, user profiles, or routine schedules are ever transmitted outbound. The Vials API endpoints interact exclusively with anonymous product metadata strings during barcode/OCR scanning and item suggestion payloads — no user identity is attached to any outbound network request.
- **Fuzzy Search Resilience:** UI elements displaying server search results must gracefully handle and rank items based on backend trigram score weights (`pg_trgm`), keeping the product-selection workflow smooth even when OCR introduces minor recognition typos.
- **Offline Manual Infallibility:** If network lookup services fail or are unavailable, the UI must seamlessly unlock the manual `ProductForm` so the user's shelf-addition flow remains entirely unblocked — no dead-ends and no error screens requiring a network retry.
- All stores remain synchronous after hydration (no `await` on writes); persistence is via AsyncStorage throughout Phase 1
- ConflictEngine is never called from inside a store — only from the screen/component render cycle
- Gamification default is OFF — settingsStore initializes `gamificationEnabled: false`
- No AI features ship in Phase 1 MVP — Anthropic service files remain stubs
