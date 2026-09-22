# Onboarding Simplification
Date: 2026-09-15
Author: planner-agent
Jira: N/A (kebab-case task slug per agent-layer-protocol.md: `onboarding-simplification`)
Status: DRAFT

## AI-SDLC Flags
```
backend_layer:  false
frontend_layer: true
infra_changes:  false
```

## 1. Problem Statement

Today's four-screen onboarding stack (`MarketingSlides` -> `SkinProfileSetup` -> `ContributionConsent`
-> `FirstProduct`) forces every new user through two pieces of friction that no longer earn their
place. First, the "Privacy First" marketing slide sells a "your data stays on this device" narrative
the product has since dropped and that nothing else in the app reinforces — the very next screen,
`ContributionConsentScreen`, already asks about sharing product data with the community, which makes
the slide's framing stale and slightly contradictory. Second, "Help grow the Vials database" asks
users to decide, in the abstract and before they have added a single product, whether to help
crowdsource product data — a decision that only becomes concrete once a user actually hits the "we
don't recognize this product" moment. Finally, `FirstProductScreen` only offers a text search box
wired to the product corpus; it has no manual-entry or scan option, which is a materially worse
experience than "My Shelf"'s `AddProductHubScreen`, pushes first-time users with an unrecognized
product to "Skip for now" instead of adding it, and is a separate, already-diverging code path.

## 2. Goals

- `MarketingSlidesScreen` shows exactly 2 slides ("Care that asks less of you", "Safety logic"); the
  "Privacy First" slide and its copy are deleted, not just hidden.
- The onboarding stack contains exactly 3 screens: `MarketingSlides`, `SkinProfileSetup`,
  `FirstProduct`. `ContributionConsentScreen` is no longer a registered onboarding route.
- The "Help grow the Vials database" prompt is shown at most once per install, immediately after the
  first time the user successfully saves a genuinely manually-entered product (brand-new, not a
  corpus/OCR/barcode match, not an edit) — whether that first manual save happens during onboarding
  or later in the main app.
- The onboarding `FirstProduct` screen offers the same three ways to add a product as
  `AddProductHubScreen` does today (Scan Product, Search Database, Create Product Manually), via the
  exact same shared components/screens as the shelf's Add Product flow, not a reimplementation.
- The onboarding `FirstProduct` screen keeps a working "Skip for now" action that proceeds straight
  into the main app with an empty shelf, exactly as it does today.

## 3. Non-Goals

- No change to the existing per-product contribution cadence system (`ContributionConsentModal`,
  `settingsStore.contributionConsentStatus`, the 5/15/30-save reminder cadence, per
  `docs/specs/contribution-consent-flow/`). It keeps running exactly as today; on a user's very
  first genuinely-manual save it can now appear back-to-back with the relocated "Help grow the Vials
  database" prompt, and reconciling or merging the two prompts is explicitly out of scope here.
- No change to `AddProductHubScreen`, `CaptureFlowScreen`, `BarcodeScannerScreen`,
  `ManualProductFormScreen`, or `AddProductScreen`'s behavior, copy, or layout when reached from "My
  Shelf" — this task reuses them for onboarding, it does not redesign them.
- No change to `SkinProfileSetupScreen`'s 5-step content, order, or skip semantics.
- No localization/i18n work (CLAUDE.md: English-only UI text for Phase 1).
- No backend/API changes — this app has no backend for onboarding or contributions; the existing
  local-first save + direct Turso `contributions` write (`src/services/contributions.ts`) is
  untouched.
- `src/components/debug/DebugOnboardingPreview.tsx` (a "Developer Tools" debug-only tool) is not
  required to keep previewing a first-product step; it only needs to stop referencing the two
  removed steps so it does not crash. It is not part of any real user flow.

## 4. User Stories

### Story 1: Fresh install sees a shorter, non-contradictory marketing carousel
As a new user opening Vials for the first time, I want the marketing slides to only describe things
that are still true, so that I'm not told something the app doesn't actually do.

**Acceptance Criteria:**
- [ ] Given a fresh install, when `MarketingSlidesScreen` renders, then it shows exactly 2 slides, in
      this order: "Care that asks less of you", "Safety logic" — the "Privacy First" slide never renders.
- [ ] Given the medical-disclaimer checkbox is tied to the last slide, when there are only 2 slides,
      then the checkbox still renders on slide index 1 ("Safety logic") and still gates the "Get
      started" CTA exactly as it does today.

### Story 2: Onboarding no longer asks about database contribution up front
As a new user, I want onboarding to only ask me about my skin profile and my first product, so that
I'm not asked to make a data-sharing decision before it means anything to me.

**Acceptance Criteria:**
- [ ] Given a fresh install, when I finish `SkinProfileSetupScreen`'s step 5, then I land directly on
      `FirstProduct` — `ContributionConsentScreen` never appears.
- [ ] Given I finish onboarding via any path (adding a product or Skip), when I inspect the onboarding
      stack's registered routes, then `ContributionConsent` is not one of them.

### Story 3: The database-contribution prompt appears once, right after it becomes relevant
As a user who has just typed in a product by hand, I want to be asked about sharing it with the
community right after I do it, so that the ask is grounded in something I just did.

**Acceptance Criteria:**
- [ ] Given a fresh install whose `contributionConsent.timestamp` is `null`, when I successfully save
      my first genuinely manual product (via "Create Product Manually" or via a manual, no-corpus-match
      save in `ManualProductFormScreen`) — whether during onboarding's `FirstProduct` flow or later
      from "My Shelf" — then the "Help grow the Vials database" prompt appears once, with today's
      copy and "Agree and share" / "Not now" actions, before I land on the next screen.
- [ ] Given I respond to that prompt (either button), when I check
      `profileStore.profile.contributionConsent`, then it is `{ granted: <my choice>, timestamp: <ISO
      now> }`, identically to today's onboarding-screen behavior.
- [ ] Given `contributionConsent.timestamp` is already non-null (I was already asked, via this prompt
      or via the Settings toggle), when I save any later manual product, then the prompt does not
      appear again.
- [ ] Given I add a product via search (a corpus hit) or a recognized barcode scan, when the save
      completes, then the "Help grow the Vials database" prompt does not appear — it only follows a
      genuinely manual, unrecognized-product save.

### Story 4: Onboarding's first-product screen offers real parity with the shelf
As a new user during onboarding, I want the exact same ways to add a product that I'd have on "My
Shelf", so onboarding doesn't shortchange me into a worse experience.

**Acceptance Criteria:**
- [ ] Given I'm on the onboarding `FirstProduct` screen, when it renders, then I see the same three
      options `AddProductHubScreen` shows: "Scan Product", "Search Database" (same live-search-as-
      you-type behavior and result list), and "Create Product Manually".
- [ ] Given I tap "Scan Product", a "Search Database" result, or "Create Product Manually" on the
      onboarding screen, when the resulting screen(s) render, then they are the exact same
      `CaptureFlowScreen` / `ManualProductFormScreen` / `AddProductScreen` components "My Shelf" uses,
      with identical fields, validation, and navigation between manual/search/scan modes.
- [ ] Given I complete a product save from any of these three modes during onboarding, when the save
      succeeds, then onboarding completes (`onboardingCompleted: true`) and I land on the main tabs,
      instead of the shelf's "back to Catalog with a toast" behavior.
- [ ] Given I'm on the onboarding `FirstProduct` screen and haven't started a sub-flow, when I tap
      "Skip for now", then onboarding completes with an empty shelf, exactly as today.

## 5. UX / Behaviour

- `MarketingSlidesScreen`: identical mechanics (horizontal paging, dot indicator, checkbox-gated final
  CTA), just 2 cards instead of 3.
- `FirstProduct` screen: header copy stays ("Add your first product"), no back button (mirrors today
  — there's nothing to go back to), body is the same tile/search layout as `AddProductHubScreen`,
  footer keeps the existing secondary "Skip for now" button. Loading/empty/error search states (no
  corpus configured, network failure, no results) are identical to the shelf's, since it's the same
  component.
- "Help grow the Vials database" prompt: same 3-paragraph copy and 2-button layout as today's screen,
  presented as a full-screen modal shown right after a qualifying save completes, dismissed (either
  button) before the user is taken to the next screen — never left waiting on it indefinitely.
- On a user's very first genuinely manual save via `ManualProductFormScreen`, if the existing
  per-product cadence modal (`ContributionConsentModal`, "Make adding products easier for everyone")
  is also due, it is shown first; the "Help grow the Vials database" prompt (if also due) follows
  immediately after it resolves, then the save's normal follow-up (routine scheduler sheet /
  navigation) proceeds. Only one modal is ever visible at a time.

## 6. Data Requirements

- No new persisted fields. Reuses the existing `UserProfile.contributionConsent: { granted: boolean;
  timestamp: string | null }` (already shipped, `docs/specs/contribution-consent.md`) as the "has this
  ever been asked" signal — `timestamp === null` means not yet asked.
- No new AsyncStorage keys.
- A new, non-persisted navigation param (`entryContext: 'catalog' | 'onboarding'`) threads through the
  shared add-product screens so they know whether to return to "My Shelf" or complete onboarding; it
  is never written to storage.

## 7. Dependencies

- Depends on the already-shipped `docs/specs/contribution-consent.md` (defines `contributionConsent`
  and its Settings-screen toggle) and `docs/specs/contribution-consent-flow/` (the separate per-product
  cadence modal, left untouched — see Non-Goals).
- Supersedes `docs/specs/contribution-consent.md` Story 1's specific claim that the consent screen
  appears "before FirstProduct" during onboarding; that spec is not rewritten, but gets a short sync
  note pointing here (see tech design).
- Blocks: none.
- External services: none new.

## 8. Security & Privacy

- Authentication required: no (local-only app, Phase 1).
- Data sensitivity: unchanged from today — this task only moves *when* the existing photo-sharing
  consent screen is shown, not what it collects or gates.
- Compliance: GDPR Art. 7(4) / Recital 43 still holds — both prompt actions remain equal-weight and
  non-blocking, and moving the ask closer to the moment it describes (an actual unrecognized-product
  save) if anything strengthens "informed" consent versus asking abstractly during onboarding.

## 9. Success Metrics

- 100% of fresh installs that complete onboarding do so having seen exactly 2 marketing slides and 3
  onboarding screens (verified via component/integration tests — this app has no analytics telemetry).
- 0 installs see `ContributionConsentScreen` as an onboarding step (route removed — verifiable
  statically from `OnboardingStackParamList` / `OnboardingNavigator`).
- The "Help grow the Vials database" prompt fires exactly once per install across integration tests
  covering: onboarding manual add, onboarding search add (must NOT fire), post-onboarding manual add.
- `npx tsc --noEmit` and `npm test` stay green, with no duplicated implementation of the add-product
  screens (checked in review per `.claude/rules/architecture-review.md`'s duplication checks).

## 10. Open Questions

None — all three changes are confirmed product decisions; technical implementation gaps are resolved
as assumptions in `docs/tech-design/onboarding-simplification.md`.
