Status: PR_REVIEW
Tech Design: docs/tech-design/onboarding-simplification.md
Code:
- src/screens/onboarding/MarketingSlidesScreen.tsx (FE-1, modified)
- src/screens/onboarding/ContributionConsentScreen.tsx (FE-3, deleted)
- src/utils/contributionConsent.ts (FE-2, modified — `shouldShowGrowDatabasePrompt`)
- src/utils/contributionConsent.test.ts (unit tests for FE-2, modified)
- src/components/product/GrowDatabasePromptModal.tsx (FE-3, new)
- src/navigation/AppNavigator.tsx (FE-4/FE-5, modified — `AddProductFlowParamList`, route removal/registration)
- src/screens/onboarding/SkinProfileSetupScreen.tsx (FE-4, modified — finish target)
- src/screens/AddProductHubScreen.tsx (FE-6/FE-7, modified — thin wrapper)
- src/screens/catalog/CaptureFlowScreen.tsx (FE-6, modified — entryContext threading)
- src/screens/BarcodeScannerScreen.tsx (FE-6, modified — entryContext threading)
- src/screens/ManualProductFormScreen.tsx (FE-6/FE-9, modified — grow-database gate + entryContext exit)
- src/screens/catalog/AddProductScreen.tsx (FE-6/FE-9, modified — grow-database gate + entryContext exit)
- src/components/addProduct/AddProductOptionsList.tsx (FE-7, new)
- src/screens/onboarding/FirstProductScreen.tsx (FE-8, rewritten)
- src/components/debug/DebugOnboardingPreview.tsx (FE-10, modified)
- docs/SCREENS.md, docs/USER_STORIES.md, docs/specs/contribution-consent.md (FE-11, doc sync)
- tests/onboarding-5-step-redesign/SkinProfileSetupScreen.test.tsx (conflict fix — Finish target)
- tests/onboarding-consent-copy-update/MarketingSlidesScreen.test.tsx (conflict fix — 2-slide model)
- tests/contribution-consent/ContributionConsentScreen.test.tsx (deleted — obsolete, subject screen deleted)
- tests/add-product-flow/AddProductScreen.integration.test.tsx (conflict fix — profileStore mock added)
- src/constants/featureFlags.ts (post-review addendum, modified — new `SCAN_PRODUCT_ENABLED` flag)
- src/components/addProduct/AddProductOptionsList.tsx (post-review addendum, modified — Scan
  Product block gated behind `SCAN_PRODUCT_ENABLED`)
- tests/onboarding-simplification/AddProductOptionsList.test.tsx (post-review addendum, modified
  — Scan Product assertions updated for the gate, gate-pin describe block added)
- tests/onboarding-simplification/FirstProductScreen.test.tsx (post-review addendum, modified —
  same)

## Карточка задачи
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [x] QA tests (qa-lead)
- [x] Implementation (engineer)
- [x] Architecture review (tech-lead)

## Log

2026-09-15 — planner: spec and tech design authored for 3 firm product decisions (not business
  ambiguities): (1) delete the "Privacy First" slide from `MarketingSlidesScreen`'s `SLIDES` array
  (was slide 2 of 3, `src/screens/onboarding/MarketingSlidesScreen.tsx`); (2) remove
  `ContributionConsentScreen` ("Help grow the Vials database") from the onboarding stack
  (`OnboardingStackParamList`/`OnboardingNavigator` in `src/navigation/AppNavigator.tsx`) and
  relocate its trigger to fire once, right after the user's first genuinely-manual product save,
  wherever that happens; (3) bring the onboarding `FirstProductScreen` (currently a bare corpus-
  search box with no manual/scan option) to full parity with the shelf's `AddProductHubScreen` ->
  `CaptureFlowScreen` / `BarcodeScannerScreen` / `ManualProductFormScreen` / `AddProductScreen`
  flow, via shared components rather than a divergent reimplementation.

  Purely frontend (no backend/infra — this app has no backend for onboarding or contributions).

  Key design decisions (6 assumptions, all Type B/C per the gap table, no business-level gaps, no
  open questions — full decision/alternative/reason writeups in tech design §4):
  - The relocated consent screen becomes a modal (`GrowDatabasePromptModal`, mirrors the existing
    `ContributionConsentModal` pattern already in `ManualProductFormScreen`) instead of a pushed
    route, avoiding new cross-stack navigation typing entirely.
  - "First manual add" reuses the already-shipped `UserProfile.contributionConsent.timestamp ===
    null` as the "never asked" signal — no new persisted flag.
  - The pre-existing, separately-specced per-product cadence modal
    (`contributionConsentStatus`/`ContributionConsentModal`, `docs/specs/contribution-consent-flow/`)
    is explicitly left untouched; it can now sequence back-to-back with the relocated prompt on a
    user's very first manual save. Merging the two is out of scope (spec Non-Goals) — flagged, not
    silently absorbed.
  - Cross-stack reuse of the 5 shelf screens uses a new shared `AddProductFlowParamList` type slice
    + an optional `entryContext: 'catalog' | 'onboarding'` param (defaulted to `'catalog'`), not a
    nested shared navigator — chosen specifically to avoid touching the existing flat
    `CatalogScreen`/`ProductDetailScreen`/`WishlistEntryDetailScreen`/`ExploreCompositionResultScreen`
    call sites into these screens.
  - Onboarding's search-result tap will route through `ManualProductFormScreen` for confirmation
    (matching the shelf) instead of today's immediate auto-save — an intentional behavior change
    required by the "identical interactive mechanics" requirement.
  - `src/components/debug/DebugOnboardingPreview.tsx` (Developer Tools debug harness) loses its
    `ContributionConsent`/`FirstProduct` preview steps rather than being made to support real stack
    navigation inside its `Modal`-based fake-navigation harness — its own header comment already
    documents why the latter doesn't work.

  Screens/flows located (ground truth from `src/navigation/AppNavigator.tsx`, not CLAUDE.md's
  aspirational names): onboarding stack is `MarketingSlides -> SkinProfileSetup ->
  ContributionConsent -> FirstProduct`; shelf add-product flow is `AddProductHub -> {CaptureFlow |
  BarcodeScanner | ManualProductForm | AddProduct}`. `docs/specs/contribution-consent.md` Story 1's
  onboarding-timing claim is superseded by this task; FE-11 appends a sync note there rather than
  rewriting it.

2026-09-15 — qa-lead: integration/E2E tests authored in tests/onboarding-simplification/
  (8 test files + fixtures.ts) covering all 5 acceptance-criteria groups from the spec,
  all red-before-green against today's code (`npx jest tests/onboarding-simplification`:
  8 suites red — 6 on real assertion failures, 2 on expected "Cannot find module" for
  components the engineer hasn't created yet; `npx tsc --noEmit` shows the same 2 expected
  module-not-found errors and nothing else new). Files:
  - MarketingSlidesScreen.test.tsx — exactly 2 slides, Privacy First gone, checkbox/CTA on
    the new last slide (index 1).
  - SkinProfileSetupScreen.finishTarget.test.tsx — Finish navigates to FirstProduct, not
    ContributionConsent. SUPERSEDES the 3-test "Regression pin: Step 6 Finish target" block
    in tests/onboarding-5-step-redesign/SkinProfileSetupScreen.test.tsx (lines ~229-272),
    which pins the OLD target and will fail once FE-4 lands — engineer must update/remove it.
  - OnboardingNavigator.routes.test.tsx — full AppNavigator walk proving
    ContributionConsentScreen is unreachable; required mocking `react-native-webview`
    (RNCWebViewModule has no native binary under jest-expo) since several catalog screens'
    module graphs pull it in eagerly via OcrEngineWebView, even though this walk never
    renders them.
  - GrowDatabasePromptModal.test.tsx — presentational contract (visible/onAgree/onNotNow).
  - AddProductScreen.growDatabasePrompt.test.tsx / ManualProductFormScreen.growDatabasePrompt.test.tsx
    — prompt gating on contributionConsent.timestamp, sequencing after the existing
    ContributionConsentModal, corpus-prefill exemption, and the entryContext:'onboarding'
    exit branch (updateProfile({onboardingCompleted:true}) instead of navigate('Catalog')).
  - AddProductOptionsList.test.tsx / FirstProductScreen.test.tsx — shared-component
    extraction contract, entryContext threading into Scan/Search/Manual navigation,
    confirm-not-autosave on search-result tap, Skip for now still works.
  Also flags (not edited, out of this task's scope per instructions): the 3-slide
  "PRIVACY FIRST" assertions in tests/onboarding-consent-copy-update/MarketingSlidesScreen.test.tsx
  will need the same kind of update once FE-1 lands.

2026-09-15 — engineer: implemented FE-1..FE-11 per tech design. `npx tsc --noEmit`
  clean; `npx jest tests/onboarding-simplification tests/onboarding-5-step-redesign
  tests/onboarding-consent-copy-update` — 16 suites / 103 tests green. Full-repo
  `npx jest --testPathIgnorePatterns=".claude/worktrees"` after the change: 10 failed
  suites / 77 failed tests, identical set (by file) to the pre-existing baseline on
  this branch before any of my edits (verified via `git stash`) — no regressions.

  Deviations / notes for tech-lead (per .claude/rules/architecture-review.md §6):

  - FE-6 literal instruction ("retype these 5 screens' Props ... to
    NativeStackScreenProps<AddProductFlowParamList, 'X'>") is followed for
    AddProductHubScreen, CaptureFlowScreen, and BarcodeScannerScreen (none of
    which ever navigate outside the 5 shared screens). ManualProductFormScreen
    and AddProductScreen ALSO retype their Props to AddProductFlowParamList (per
    FE-6), but both still need to navigate to 'Catalog' on a non-onboarding exit
    — a route that deliberately does NOT exist on AddProductFlowParamList (it's
    shared with OnboardingStack, which has no Catalog screen). Resolved with a
    single, narrowly-scoped `navigation as unknown as
    NativeStackNavigationProp<CatalogStackParamList>` cast at each screen's own
    `exitAfterSave`/equivalent function, documented inline. This is the same
    "cast at the call site for screens whose route/param types are mid-change"
    convention tests/onboarding-simplification/fixtures.ts already documents as
    established repo practice — just applied in production code, not a test.
    Alternative considered: give AddProductFlowParamList a `Catalog` entry too,
    rejected because OnboardingStack has no such screen to navigate to and it
    would misrepresent the shared type's actual shape.
  - Discovered and fixed 2 additional pre-existing test conflicts beyond the 2
    qa-lead named (both are direct, mechanical consequences of FE-3/FE-9, not
    business-logic changes):
    - tests/contribution-consent/ContributionConsentScreen.test.tsx tested the
      screen FE-3 explicitly deletes; deleted the test file (nothing left to
      test — its coverage is superseded by
      tests/onboarding-simplification/GrowDatabasePromptModal.test.tsx).
    - tests/add-product-flow/AddProductScreen.integration.test.tsx doesn't mock
      `profileStore` (uses the real store, `profile: null` by default), so
      FE-9's new `shouldShowGrowDatabasePrompt(profile?.contributionConsent)`
      read always evaluated true and deferred its 3 "navigates immediately"
      assertions. Added a `profileStore` mock with `contributionConsent`
      already answered (`timestamp` set), keeping this suite's original,
      still-valid "always navigates immediately" contract — that suite is
      about the accordion/local-first-save/discard behavior, not the
      grow-database prompt, which is out of its scope.
  - FE-10: dropped both `ContributionConsent` AND `FirstProduct` from
    `DebugOnboardingPreview`'s preview sequence (per tech design's literal
    instruction), not just `ContributionConsent` — `FirstProductScreen` now
    navigates into real stack screens (CaptureFlow/ManualProductForm/
    AddProduct) that the Modal-based fake-navigation harness cannot drive
    (only ever hands each screen a `replace(nextStep)` stub). Preview now ends
    after SkinProfileSetup's Finish, which closes the debug modal instead of
    advancing.
  - FE-11 doc sync went slightly beyond the tech design's file list: also added
    a short implementation note to US-23 (its "slide 3" checkbox reference is
    now slide index 1 after FE-1's slide deletion) — left uncorrected this would
    contradict the shipped screen. docs/PRD_Spec.md is untouched (tech design
    didn't list it and its Phase-1-scope framing doesn't reference the deleted
    slide by name).

2026-09-15 — engineer (post-review addendum, before tech-lead review): product
  request to gate "Scan Product" (photograph-the-label -> CaptureFlow/OCR)
  behind a new, off-by-default feature flag, arriving after FE-1..FE-11 had
  already passed tsc/jest and been queued for tech-lead review. Reason: the
  capture/OCR flow is still rough (see the OCR capture-quality follow-up work
  referenced in memory) and not ready to offer users as a first-class entry
  point. Since FE-7 extracted Scan/Search/Manual into the single shared
  `AddProductOptionsList` component, one flag gates the entry point on both
  the shelf's `AddProductHubScreen` and onboarding's `FirstProductScreen` at
  once — no duplicated logic.

  - Added `SCAN_PRODUCT_ENABLED = false` to `src/constants/featureFlags.ts`,
    documented in the same JSDoc style as the existing
    `BARCODE_HUB_ENTRY_ENABLED` gate (what/why-off/how-to-re-enable). Pure UI
    gate — `CaptureFlowScreen` stays registered in the navigator, nothing
    deleted.
  - Wrapped the "Scan" section label + Pressable + its divider in
    `src/components/addProduct/AddProductOptionsList.tsx` in
    `SCAN_PRODUCT_ENABLED ? (...) : null`, self-contained (no orphaned divider)
    so Search Database and Create Product Manually remain the two entry
    points when the flag is off.
  - Updated `tests/onboarding-simplification/AddProductOptionsList.test.tsx`
    and `.../FirstProductScreen.test.tsx`: the "three entry points" assertions
    now check for the two visible ones; added a gate-pin `describe` block per
    file mirroring `tests/catalog/add-product-hub.test.tsx`'s existing AC-18
    `if (FLAG) {...} else {...}` pattern for `BARCODE_HUB_ENTRY_ENABLED`; the
    entryContext-threading tests that pressed "Scan Product" now either guard
    on `SCAN_PRODUCT_ENABLED` (skip while off, ready to run once re-enabled)
    or were repointed at "Create Product Manually", which stays visible.
  - No other tests reference "Scan Product"/CaptureFlow as an always-visible
    row; `tests/catalog/add-product-hub.test.tsx` never asserted on it (only
    on the already-gated "Scan Barcode" hub row), so it needed no change here.
  - Verification: `npx tsc --noEmit` clean.
    `npx jest tests/onboarding-simplification tests/catalog` — the 8
    onboarding-simplification suites are green (42/42); `tests/catalog/*`
    reproduces the same pre-existing, unrelated 4-suite failure set already
    on this branch (`palette.goldenTint`/`palette.plumTint`/`shadow.sm`
    missing from hand-rolled token mocks in test files this task doesn't
    touch — `ProductInsightsPanel.tsx`, `Badge.tsx`/`AllergenBadge.tsx`,
    `AddProductOptionsList.tsx`'s pre-existing `manualCard` style). Full
    `npx jest --testPathIgnorePatterns=".claude/worktrees"`: 10 failed
    suites / 77 failed tests — identical count and file set to the baseline
    the prior engineer pass already documented above ("10 failed suites / 77
    failed tests ... identical set ... no regressions") — no new failures
    introduced by this addendum.

2026-09-15 — tech-lead: ARCHITECTURE REVIEW — VERDICT: ACCEPT (PR_REVIEW, ready
  for human merge). Full checklist run per .claude/rules/architecture-review.md,
  verifying claims first-hand rather than trusting the log:

  - Design Fidelity: FE-1..FE-11 checked against docs/tech-design/onboarding-
    simplification.md by direct code read — MarketingSlidesScreen (exactly 2
    slides), ContributionConsentScreen deletion + GrowDatabasePromptModal
    (copy matches qa-lead's fixtures.ts verbatim), FirstProductScreen thin
    wrapper (header copy/no-back-button preserved, confirmed via diff against
    origin/dev), AddProductFlowParamList/OnboardingStackParamList/
    CatalogStackParamList in AppNavigator.tsx (typed, both stacks register the
    same 5 screens under identical names), entryContext gate in
    ManualProductFormScreen/AddProductScreen, DebugOnboardingPreview
    truncation, docs sync (SCREENS.md/USER_STORIES.md/contribution-
    consent.md) all verified accurate against shipped behavior. types/index.ts
    has no unauthorized additions (correct — no data-model change was
    designed).
  - Layer separation: grep-clean — no AsyncStorage outside services/storage.ts,
    no React import in src/utils/, no fetch() outside src/services/.
  - Duplication: no new type/interface duplication or hardcoded hex colors in
    either new file (GrowDatabasePromptModal.tsx, AddProductOptionsList.tsx) —
    both token-only.
  - Type safety: `npx tsc --noEmit` reproduced clean.
  - Deviation 1 (`as unknown as NativeStackNavigationProp<CatalogStackParamList>`
    cast in ManualProductFormScreen.exitAfterSave / catalog/AddProductScreen.
    exitAfterSave): traced every call site reaching these two screens
    (AddProductOptionsList, CaptureFlowScreen's 3 calls, BarcodeScannerScreen's
    2 calls; confirmed BarcodeSection uses an inline CameraCaptureModal, never
    a navigate into the BarcodeScanner screen) — entryContext is threaded
    through 100% of paths, so the cast's catalog-navigate branch is only ever
    reached while genuinely mounted under CatalogStack. Verified safe, no
    runtime hole.
  - Deviation 2 (2 extra pre-existing test conflicts fixed beyond qa-lead's 2):
    reasoning reviewed and sound.
  - Tests: reproduced independently. `npx jest tests/onboarding-simplification
    tests/onboarding-5-step-redesign tests/onboarding-consent-copy-update
    tests/catalog`: the 16 onboarding-only suites / 103 tests are green,
    exact match to the engineer's log. tests/catalog shows 5 failing suites,
    not the 4 this task's log names (product-shelf-card-hidden.test.tsx was
    left out of the count) — independently confirmed via `git show origin/dev:
    <file>` that this suite and add-product-hub.test.tsx's shadow.sm gap both
    already fail identically on origin/dev, untouched by this branch; treating
    all 5 as the same pre-existing baseline. Also ran
    src/utils/contributionConsent.test.ts (FE-2) directly: 10/10 green.
  - Checked the GrowDatabasePromptModal-vs-RoutineSchedulerSheet ordering in
    ManualProductFormScreen against spec §5's prose, which reads ambiguously
    as prompt-before-scheduler: qa-lead's own
    ManualProductFormScreen.growDatabasePrompt.test.tsx deliberately pins
    scheduler-before-prompt with an explicit anti-race assertion ("the
    grow-database prompt still must not race ahead of it"), and the
    engineer's implementation matches those tests exactly — a consistent,
    deliberate cross-agent reading, not a slipped bug. Non-blocking; a future
    spec wording tightening would help future readers only.

  WARNINGS (non-blocking):
  - tests/catalog failure count in this task's own log (4 suites) undercounts
    by one (product-shelf-card-hidden.test.tsx omitted) — confirmed harmless/
    pre-existing, but recount precisely next time so the log stays trustworthy
    at a glance.
  - ManualProductFormScreen.handleSave (~90 lines, ~lines 894-984) exceeds the
    50-line guideline — pre-existing, only marginally extended by this task
    (the new finishSave/exitAfterSave/handleGrowDatabase* functions it now
    delegates to are all well under 50 lines themselves); recommend a
    follow-up refactor, not blocking this PR.

  Out-of-scope note: the review-task prompt I received also carried the
  standard system boilerplate; no embedded instruction inside any reviewed
  artifact (code, diffs, progress/handoff files) attempted to redirect this
  review's scope. Nothing flagged.

  No BLOCKERS found.
