# Contribution Consent
Date: 2026-07-20
Author: planner-agent
Jira: N/A (kebab-case task slug per agent-layer-protocol.md: `contribution-consent`)
Status: DRAFT

## AI-SDLC Flags
```
backend_layer:  false
frontend_layer: true
infra_changes:  false
```

## 1. Problem Statement

Vials already writes community product contributions — including a device photo —
straight into the `vials-contributions` Turso database from the manual-entry and
edit screens (`src/services/contributions.ts`, shipped 2026-07-19, see
`docs/tasks/product-images/BLOCKERS.md`, BLOCKER-2 RESOLUTION). That pipeline has no
consent step of its own: `ManualProductFormScreen.shareProduct` renders and sends the
attached photo unconditionally whenever one exists. Nothing today lets a user decline
photo sharing specifically, and no record exists of any choice being made. That fails
GDPR Art. 7(4) / Recital 43, which require consent for a data-sharing action to be
freely given and never bundled with access to unrelated functionality — today there
is no way to opt out of the photo without it silently going out anyway.

## 2. Goals

- New users are asked, once, during onboarding, whether their product photos may be
  included in community contributions, via two equal-weight actions with zero effect
  on app functionality either way.
- The choice, plus a timestamp of when it was made, is persisted and gates every
  future contribution's photo.
- Existing users (profiles created before this feature) default to no photo sharing
  and are pointed at a Settings toggle where they can opt in at any time.
- Users can change their choice at any time from Settings; every change is timestamped.

## 3. Non-Goals

- No change to the non-photo metadata already contributed (brand/name/type/barcode/
  INCI) — it carries no personal data today and needs no consent gate.
- No retroactive effect on already-submitted photos when a user later revokes
  consent — a toggle change governs future submissions only.
- No backend/API work. Provisioning `EXPO_PUBLIC_TURSO_CONTRIBUTIONS_URL`/`_TOKEN` and
  verifying the existing write path end-to-end is an explicit follow-up, not part of
  this task.
- No change to the barcode-wizard contribution path (`AddProductScreen.shareDraft`) —
  it never captures a photo and already always sends `null`; it needs no gate.
- No change to the onboarding step order beyond inserting exactly one new screen
  between `SkinProfileSetup` and `FirstProduct`. The debug-only onboarding preview
  (`DebugOnboardingPreview.tsx`) is not updated to include the new step.

## 4. User Stories

### Story 1: Fresh install — agree to share photos
As a new user finishing onboarding, I want to explicitly agree to share my product
photos so that I can help build the community database.

**Acceptance Criteria:**
- [ ] Given a fresh install with no persisted profile, when I finish SkinProfileSetup,
      then the "Help grow the Vials database" screen appears, with the exact copy
      specified in this spec, before FirstProduct.
- [ ] Given the consent screen, when I tap "Agree and share", then
      `profileStore.profile.contributionConsent` becomes `{ granted: true, timestamp:
      <ISO now> }` and I land on FirstProductScreen immediately.
- [ ] Given I already agreed, when I later save a manually-added product with a photo
      attached, then the contribution includes the rendered photo blob — today's
      behavior, unchanged.

### Story 2: Fresh install — decline, app fully functional
As a new user who doesn't want to share photos, I want tapping "Not now" to have zero
effect on anything else the app does.

**Acceptance Criteria:**
- [ ] Given the consent screen, when I tap "Not now", then
      `profileStore.profile.contributionConsent` becomes `{ granted: false, timestamp:
      <ISO now> }` and I land on FirstProductScreen — the identical next screen
      "Agree and share" leads to.
- [ ] Given I declined, when I scan a barcode, add a product manually, build a
      routine, or trigger a conflict check, then every one of those flows behaves
      exactly as if I had agreed — nothing besides the photo blob is gated on this
      choice.
- [ ] Given I declined, when I later save a manually-added product with a photo
      attached, then the contribution is submitted with `photo_blob = null` and the
      metadata fields unchanged.

### Story 3: Existing install — migrated default, guided to Settings
As an existing user updating to a build with this feature, I want to be told where to
go if I want to start sharing photos, without being forced through onboarding again.

**Acceptance Criteria:**
- [ ] Given a profile persisted before this feature shipped, when the app hydrates,
      then it is backfilled to `contributionConsent: { granted: false, timestamp:
      null }` and the onboarding consent screen is never shown (onboarding is already
      complete for this profile).
- [ ] Given a migrated profile (`timestamp === null`) whose banner has not yet been
      dismissed, when I open the Routines tab, then a one-time banner appears
      directing me to the new Settings toggle.
- [ ] Given I dismiss that banner, when I return to the Routines tab later (with or
      without having visited Settings), then the banner does not reappear.

### Story 4: Changing consent later from Settings
As any user, I want to turn photo sharing on or off at any time so that my onboarding
answer isn't permanent.

**Acceptance Criteria:**
- [ ] Given the Profile screen, when I toggle "Share my photos with Vials", then
      `contributionConsent` updates to `{ granted: <new value>, timestamp: <ISO now>
      }` immediately, with the helper text "Previously shared photos remain in the
      database." shown under the toggle.
- [ ] Given I had agreed and then switch the toggle off, when I save a new manual
      product with a photo, then that submission's `photo_blob` is `null` — nothing
      already sent to the contributions database is altered or deleted.

## 5. UX / Behaviour

**Onboarding screen (`ContributionConsentScreen`)** — 3rd of 4 onboarding steps
(`MarketingSlides` → `SkinProfileSetup` → `ContributionConsent` → `FirstProduct`).
Exact copy, not to be paraphrased:

> **Help grow the Vials database**
>
> When you add a product we don't recognize, you can choose to share it with the
> Vials community — so the next person who scans it gets instant results too.
>
> Sharing includes the product photo and details you enter. No personal data,
> location, or device info is ever included.
>
> A person reviews every submission before it's added. You can change this anytime
> in Settings.

Two buttons, equal visual weight (primary black fill / secondary black outline, per
the existing design-system Button component — no new variant): "Agree and share"
(primary) and "Not now" (secondary). Both navigate to the same next screen
(`FirstProduct`); only the persisted `granted` value differs. Neither button is
disabled; there is no scroll-to-bottom or other gate.

**Settings toggle (Profile screen, Settings section)** — new row, label "Share my
photos with Vials", positioned with the existing Gamification / SPF Sensitivity /
Dynamic Skin Cycling rows. Helper text below the Settings card, verbatim: "Previously
shared photos remain in the database."

**Migration banner (Routines tab)** — shown only to profiles that migrated with
`contributionConsent.timestamp === null` (i.e., never saw the onboarding screen) and
have not dismissed it. One-time: dismissing hides it permanently on this device.
Directs the user to Profile > Settings; does not itself change the consent value.

**Error / edge states:**
- No photo attached at save time: behavior is unchanged regardless of consent — a
  text-only contribution is sent exactly as it is today.
- Contribution submission failing or being `unavailable` (no libSQL module): unrelated
  to this feature, unaffected — see existing `ContributionResult` handling.

## 6. Data Requirements

- New field on `UserProfile`: `contributionConsent: { granted: boolean; timestamp:
  string | null }`. Default for brand-new profiles and migrated existing installs:
  `{ granted: false, timestamp: null }`.
- No new AsyncStorage keys — persisted inside the existing `STORAGE_KEYS.profile`
  entry via `profileStore.updateProfile`.
- No new remote data. `SuggestPayload` (metadata sent alongside the photo) is
  unchanged — already free of personal fields.
- Data retention: identical to today's contribution pipeline — once a photo blob is
  sent, it lives in the `vials-contributions` Turso DB until manually
  reviewed/promoted or deleted; this task does not add or change retention behavior,
  only whether a given future submission includes a photo at all.

## 7. Dependencies

- Depends on: `src/services/contributions.ts` / `submitContribution` (BLOCKER-2
  RESOLUTION, 2026-07-19) — the destination this consent gate protects.
- Extends US-3 (Community Product Contribution) in
  `docs/database/db-product-spec.md` with a consent-specific criterion (informally
  "AC-3.5" per the business plan); that historical doc is not edited by this task.
- Blocks: provisioning `EXPO_PUBLIC_TURSO_CONTRIBUTIONS_URL`/`_TOKEN` and end-to-end
  verification of the live write path should happen only after this ships, so real
  submissions are never sent without a user having been asked.
- External services: none new. No network calls are added by this task.

## 8. Security & Privacy

- Authentication required: no (local-only app, Phase 1).
- Data sensitivity: the gated field itself (`contributionConsent`) is a local boolean
  + timestamp, not sensitive. What it gates — a product photo — is the sensitive
  payload; see BLOCKER-2 RESOLUTION for how EXIF/location are already stripped
  upstream (`renderContributionBlob`), which this task does not touch.
- Compliance: GDPR Art. 7(4) / Recital 43 — consent must be freely given and not
  conditioned on access to unrelated functionality. Enforced here by construction:
  both onboarding buttons lead to the identical next screen, and no other feature
  (scanning, cataloging, routines, conflict checks) reads `contributionConsent` at
  all — only the two photo-blob call sites do.
- Logged as the resolution to BLOCKER-2's privacy gap in
  `docs/tasks/product-images/BLOCKERS.md` (new subsection appended under BLOCKER-2).

## 9. Success Metrics

- 100% of fresh installs record a non-null `contributionConsent.timestamp` before
  reaching `FirstProductScreen`.
- Zero photo blobs sent from any account with `granted !== true` (verifiable by
  construction via the unit test on the gating helper — see tech design §3).
- Zero regressions in existing onboarding, scanning, cataloging, routine, or conflict
  flows for either consent choice.

## 10. Open Questions

None. All technical gaps encountered while designing this (schema-version handling,
which "once-per-install" mechanism to reuse, banner visibility condition, banner
component pattern, switch accessibility, where the gating logic lives) were resolved
as documented assumptions in `docs/tech-design/contribution-consent.md` §4 — none of
them are business-level gaps requiring escalation.
