# Vials — Phased Implementation Plan
Task slug: vials-mvp-implementation
Date: 2026-06-19
Status: DESIGNED

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
- react-native-mmkv installed or wired (storage layer is AsyncStorage)
- Onboarding stack (no MarketingSlidesScreen, SkinProfileSetupScreen, FirstProductScreen)
- Real screen implementations connected to Zustand stores and DS components
- Open Beauty Facts API integration
- Export/Import backup utilities

---

## Option B — AsyncStorage retained (CONFIRMED)

AsyncStorage stays as the persistence layer for Phase 1 MVP so the app can run in Expo Go without a custom native build. MMKV is deferred to a future infrastructure pass.

---

## Phase 0 — Foundation (Types + DS Component Ports)

**Goal:** Close the two gaps that block all screen work: missing type fields and missing React Native DS components.

**Scope:**
1. Update `src/types/index.ts` — add `deferralCount`, `realDuration`, `'overdue'` status, `individualDurationMonths`, `dismissedBanners`
2. Update `src/store/settingsStore.ts` — add `dismissedBanners: string[]` field and `dismissBanner(key)` action
3. Port remaining web DS components to React Native `.tsx`: `Input`, `Checkbox`, `Switch`, `SegmentedControl` (needed by Phase 1–3 screens)

---

## Phase 1 — Onboarding Stack

**Goal:** Give new users a first-run flow that populates the profile store before unlocking the main tabs.

**Screens to build:**
- `MarketingSlidesScreen` — 3 swipeable slides, black primary CTA
- `SkinProfileSetupScreen` — age, gender, skin type, phototype selector (3 unlabeled cards with accessibilityLabel)
- `FirstProductScreen` — OBF search bar + manual fallback form + "Skip for now" outline button

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

**Goal:** Replace hardcoded mock data with real store data, add add-product flow with OBF API + manual fallback.

**Components to build:**
- `CatalogList` — reads productsStore, computes PAO expiry from `product.openedDate + paoMonths`, shows Amber label if within 30 days
- `CatalogFilterHeader` — category pills + biomarker toggles (Soothing/Actives/Hydration) using DS Tag/Chip
- `ProductSearchInput` — debounced OBF API call (`src/services/openBeautyFacts/`)
- `ProductForm` — manual entry fallback, triggered immediately if offline or no OBF result
- `DeleteProductModal` — checks routinesStore for active steps before deleting, DS modal pattern

**New service to build:** `src/services/openBeautyFacts/search.ts` — wraps OBF search endpoint, handles offline gracefully.

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
- `ExportBackupUtility` — serializes all MMKV keys to JSON string, triggers native share sheet via `expo-sharing`
- `ImportRestoreUtility` — document picker via `expo-document-picker`, schema validation, Replace/Merge confirmation, summary screen before commit
- `LocalDataWarningModal` — shown once per install (guarded by `settingsStore.hasSeenLocalDataWarning`)

**New dependencies:** `expo-sharing`, `expo-document-picker` (check Expo SDK 52 compatibility before installing).

---

## Phase 7 — Polish & All-States Compliance

**Goal:** Ensure every screen and component handles loading, empty, error, and data states per the All-States Rule.

**Tasks:**
- Audit every screen against the four-state rule (loading / empty / error / data)
- Add skeleton loaders for catalog list and clinic timeline
- Wire error boundaries around OBF API calls
- Add haptic feedback on checkbox toggle (via `expo-haptics`)
- Replace all emoji icon stubs (`⚙️`, `⚠️`, `🔍`) with Feather icons from `@expo/vector-icons`
- Replace all hardcoded Russian comment strings with English
- Run `npx tsc --noEmit` to zero out TypeScript errors across src/

---

## Dependency Installation Checklist

| Package | Phase | Status |
|---|---|---|
| react-native-mmkv | 0 | Not installed |
| react-native-draggable-flatlist | 3 | Not installed |
| expo-sharing | 6 | Not installed |
| expo-document-picker | 6 | Not installed |
| expo-haptics | 7 | Not installed |

All above require `npx expo install <package>` (not `npm install`) for correct SDK 52 version pinning.

---

## Architecture Constraints (apply to all phases)

- No network calls store user data — only OBF product lookup sends data outbound, and it sends only the search string
- All stores remain synchronous after MMKV migration (no `await` on writes)
- ConflictEngine is never called from inside a store — only from screen/component render cycle
- Gamification default is OFF — settingsStore initializes `gamificationEnabled: false`
- No AI features ship in Phase 1 MVP — Anthropic service files remain stubs
