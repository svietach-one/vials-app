# Technical Design: Onboarding Simplification
Spec: docs/specs/onboarding-simplification.md
Author: tech-designer
Date: 2026-09-15

## 1. Architecture Overview

Three independent, local-only changes in the RN/Expo navigation + screens layer — no backend, no
store schema change.

1. Delete one slide object from `MarketingSlidesScreen`'s `SLIDES` array.
2. Convert `ContributionConsentScreen` (today an onboarding route) into `GrowDatabasePromptModal`, a
   presentational modal shown from the two "genuinely manual save" success paths (`AddProductScreen`,
   `ManualProductFormScreen`), gated by the already-shipped `contributionConsent.timestamp === null`.
3. Give the shelf's Add Product screens (`AddProductHubScreen`, `CaptureFlowScreen`,
   `BarcodeScannerScreen`, `ManualProductFormScreen`, `AddProductScreen`) a shared param-list slice
   (`AddProductFlowParamList`) so `OnboardingStack` can register and reuse the identical components,
   distinguished only by a new `entryContext: 'catalog' | 'onboarding'` param that picks the post-save
   destination (`Catalog` vs. `onboardingCompleted: true`).

```
OnboardingStack: MarketingSlides -> SkinProfileSetup -> FirstProduct(=Hub) -> {CaptureFlow|BarcodeScanner|ManualProductForm|AddProduct}
CatalogStack:    Catalog -> AddProductHub(=Hub)         -> {CaptureFlow|BarcodeScanner|ManualProductForm|AddProduct}
                 (same 5 components, same AddProductFlowParamList; entryContext picks the exit)
```

## 2. API Contracts

N/A — no backend/HTTP surface in this app (CLAUDE.md: local-only storage, Phase 1). The existing
local save + direct Turso `contributions` write (`src/services/contributions.ts`) is unchanged.

## 3. Implementation Tasks

### engineer (scope=frontend)

- FE-1: Delete the "Privacy First" slide object from `SLIDES` — `src/screens/onboarding/MarketingSlidesScreen.tsx`. No other change; the consent checkbox already binds to `SLIDES.length - 1`.
- FE-2: Add `shouldShowGrowDatabasePrompt(consent?: ContributionConsent): boolean` (`!consent || consent.timestamp === null`), alongside `canShareContributionPhoto` — `src/utils/contributionConsent.ts`.
- FE-3: Delete `src/screens/onboarding/ContributionConsentScreen.tsx`; add `src/components/product/GrowDatabasePromptModal.tsx` — identical copy/2-button layout, `Modal`-based like the sibling `ContributionConsentModal.tsx`, props `{ visible, onAgree, onNotNow }`.
- FE-4: `src/navigation/AppNavigator.tsx` — remove `ContributionConsent` from `OnboardingStackParamList` and `OnboardingNavigator`. `src/screens/onboarding/SkinProfileSetupScreen.tsx` — change its step-5 finish target from `navigation.replace('ContributionConsent')` to `navigation.replace('FirstProduct')`.
- FE-5: `src/navigation/AppNavigator.tsx` — introduce `AddProductFlowParamList` covering `AddProductHub`, `CaptureFlow`, `BarcodeScanner`, `ManualProductForm`, `AddProduct` (copy today's `CatalogStackParamList` shapes for these 5 verbatim, adding `entryContext?: 'catalog' | 'onboarding'` to each). `CatalogStackParamList` and `OnboardingStackParamList` both fold it in (`& AddProductFlowParamList`); register the same 5 screen components inside `OnboardingStack.Navigator` under identical route names.
- FE-6: Retype these 5 screens' `Props` from `NativeStackScreenProps<CatalogStackParamList, 'X'>` to `NativeStackScreenProps<AddProductFlowParamList, 'X'>` — `AddProductHubScreen.tsx`, `screens/catalog/CaptureFlowScreen.tsx`, `BarcodeScannerScreen.tsx`, `ManualProductFormScreen.tsx`, `screens/catalog/AddProductScreen.tsx`. Thread `entryContext` through every internal `navigation.navigate(...)` call between them (Hub's Scan/Manual tiles + search-result tap; `CaptureFlowScreen`'s 3 calls into `ManualProductForm`; `BarcodeScannerScreen`'s 2 calls into `ManualProductForm`).
- FE-7: Extract `AddProductHubScreen`'s body (Scan/Search/Manual tiles + inline search state) into `src/components/addProduct/AddProductOptionsList.tsx`, taking `(navigation, initialStatus?, entryContext?)`. `AddProductHubScreen.tsx` keeps its `AppHeader` + back button and renders this component — "My Shelf" behavior is unchanged.
- FE-8: Rewrite `src/screens/onboarding/FirstProductScreen.tsx` as a thin wrapper: existing header copy, no back button, renders `<AddProductOptionsList entryContext="onboarding" />`, keeps the existing "Skip for now" button unchanged (still calls today's `completeOnboarding`). Delete the inline corpus-search implementation it replaces.
- FE-9: Insert the grow-database-prompt gate and the `entryContext` exit branch at the two save-success choke points: `screens/catalog/AddProductScreen.tsx` `handleSave` (before its existing `navigate('Catalog', {toast})`), and `ManualProductFormScreen.tsx` `finishSave` (after the existing `ContributionConsentModal` sequence resolves, scoped to `!isEditMode && !prefillSource && !explorePrefill`). In both: if `shouldShowGrowDatabasePrompt(profile.contributionConsent)`, render `GrowDatabasePromptModal` and defer; on resolve (or immediately when not due), branch on `route.params?.entryContext === 'onboarding'` → `updateProfile({ onboardingCompleted: true })`, else keep today's `navigate('Catalog', { toast })`.
- FE-10: `src/components/debug/DebugOnboardingPreview.tsx` — drop `ContributionConsent` and `FirstProduct` from its `DebugStep` union/sequence (its own header comment already documents that real stack screens cannot run inside its `Modal`-based fake-navigation harness); the preview now ends after `SkinProfileSetup`.
- FE-11: Doc sync — `docs/SCREENS.md` §1 (drop the Privacy-First bullet, update the `FirstProductScreen` bullet and remove the `ContributionConsentScreen` one), `docs/USER_STORIES.md` (US-21 Skip Path; a note on US-24 sequencing with the relocated prompt), and a short "Sync note" at the top of `docs/specs/contribution-consent.md` pointing at this task for its Story 1 timing change.

### engineer (unit tests, both scopes)

- Extend `src/utils/contributionConsent.test.ts` with cases for `shouldShowGrowDatabasePrompt` (undefined consent, `timestamp: null`, `timestamp` set). The remaining tasks are navigation/UI wiring, covered by qa-lead's integration tests rather than new pure-logic units.

## 4. Assumptions

- The relocated "Help grow the Vials database" screen becomes a modal instead of a pushed navigation screen.
  Alternative: register it as a route in both stacks (like the other 5 shared screens) and navigate/replace to it after save.
  Reason: this codebase already ships an identical "block on a post-save decision, then continue" modal pattern (`ContributionConsentModal` in `ManualProductFormScreen`) with comparable copy weight; reusing that pattern needs no new routes and no cross-stack exit-navigation typing.
- "First manual add" is tracked implicitly via the existing `contributionConsent.timestamp === null`, not a new persisted flag.
  Alternative: add a new `hasCompletedFirstManualAdd: boolean` field to `UserProfile`.
  Reason: the only behavior gated on "has this ever been asked" is showing this exact prompt, and `contributionConsent.timestamp` already encodes that precisely, including honoring an earlier answer given via the Settings toggle — a second field could only disagree with the first.
- The existing per-product cadence modal (`ContributionConsentModal`) and the relocated prompt are not merged or deduplicated; both can appear back-to-back on one save.
  Alternative: suppress one when the other is due, or merge their copy into a single screen.
  Reason: they gate two different, independently-specced, already-shipped settings (`contributionConsentStatus` per-product cadence vs. `contributionConsent` global photo-sharing); merging is a product decision affecting two live features, not a relocation, and is out of scope per the spec's Non-Goals.
- Cross-stack reuse of the 5 add-product screens uses a shared `AddProductFlowParamList` slice plus an `entryContext` param, not a nested shared navigator.
  Alternative: extract one `AddProductFlowNavigator` (nested stack) mounted inside both `CatalogStack` and `OnboardingStack`.
  Reason: `CatalogScreen`, `ProductDetailScreen`, `WishlistEntryDetailScreen`, and `ExploreCompositionResultScreen` already navigate into these 5 routes as flat siblings of `Catalog`; nesting would force updating every one of those call sites to nested-navigator syntax for no behavioral gain, versus a small additive param-list change.
- Onboarding's "Search Database" result tap now opens `ManualProductFormScreen` for confirmation instead of auto-saving immediately, changing today's `FirstProductScreen` search behavior.
  Alternative: keep the auto-save-on-tap shortcut for onboarding only.
  Reason: the spec requires interactive mechanics identical to the shelf, whose search always confirms via `ManualProductFormScreen` before saving.
- `entryContext` defaults to `'catalog'` when absent, so every existing "My Shelf" call site keeps working unmodified.
  Alternative: make `entryContext` a required param everywhere it's threaded.
  Reason: an optional, defaulted param keeps this strictly additive for the much larger set of already-shipped, already-tested catalog call sites (`CatalogScreen`, `ProductDetailScreen`, `WishlistEntryDetailScreen`, `ExploreCompositionResultScreen`, and the 5 screens' own intra-flow calls).

## 5. Open Questions

None.
