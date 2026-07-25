# Onboarding Consent & Copy Update
Date: 2026-07-25
Author: planner-agent
Jira: N/A (kebab-case task slug per agent-layer-protocol.md: `onboarding-consent-copy-update`)
Status: DRAFT

## AI-SDLC Flags
```
backend_layer:  false
frontend_layer: true
infra_changes:  false
```

## 1. Problem Statement

`MarketingSlidesScreen`'s three onboarding slides were written under a "100% local, no cloud" model: slide 1 today states "No account, no cloud, no tracking. You own your data." That claim stopped being true once the shipped crowdsourcing pipeline (`docs/PRD_Spec.md` §4.3, `docs/USER_STORIES.md` US-22, built 2026-07-19) started sending a manually-added product's brand, name, and INCI text to the `vials-contributions` database for community review. `docs/PRD_Spec.md` §1 itself still asserts "100% data confidentiality... no cloud backend, no analytics, no trackers" — directly contradicting its own §4.3 a few sections later, a drift its own sync notes have already flagged but never resolved at the source. New users are told something false about their data the moment they open the app, which is both a trust problem and a GDPR Art. 13 transparency gap (data subjects must be told accurately what happens to data they submit). Separately, nothing in onboarding today asks a user to acknowledge that Vials is a planning tool rather than a medical device — a real gap given the app surfaces clinical guardrails (procedure spacing blocks, rehab restrictions, ingredient-conflict warnings) a user could reasonably mistake for medical guidance, with no recorded moment where they confirmed otherwise.

## 2. Goals

- Slide 2 accurately discloses that personal data (skin profile, routines, procedure history) stays on-device by default, while product metadata submitted via manual entry is sent to the Vials product database — closing the contradiction between `docs/PRD_Spec.md` §1 and §4.3.
- Every new user who reaches `SkinProfileSetupScreen` has affirmatively checked a consent box acknowledging Vials is not a medical app and that product/procedure decisions and their outcomes are the user's own responsibility, recorded with a timestamp and a copy-version number.
- The slide 3 CTA is a hard, functional gate: disabled until the box is checked, with no auto-check, no pre-checked default, and no skip path.
- `docs/SCREENS.md`, `docs/PRD_Spec.md`, and `docs/USER_STORIES.md` describe the corrected copy and new consent mechanism accurately, including a new `US-23` acceptance-criteria entry, closing documentation drift those files' own sync notes have already been flagging.

## 3. Non-Goals

- No inline "contribute this product to the Vials DB" consent checkbox on `ManualProductFormScreen` / `ProductForm` — that is a separate consent, for a separate data-sharing decision, and is a follow-up task only logged here, not designed or built.
- No new onboarding screen and no change to the onboarding step count. `MarketingSlidesScreen` stays at exactly 3 slides; the onboarding stack order (`MarketingSlides` → `SkinProfileSetup` → `ContributionConsent` → `FirstProduct`) is unchanged.
- No Terms-of-Use or Privacy-Policy document is written or linked — the checkbox sentence is the entire disclosure surface for this task.
- No re-consent / re-prompt flow for `medicalDisclaimerVersion` bumps, and no retroactive prompt for users who completed onboarding before this ships — only the versioned storage fields are added now, specifically so that future flow won't require its own schema migration; building the prompt itself (for either case) is out of scope.
- No change to `profileStore.onboardingCompleted` or the `AppNavigator` root gate — the new consent write happens alongside that gate, not instead of it.
- No change to the existing `ContributionConsentScreen` (photo-sharing consent, already shipped) — a distinct, unrelated consent mechanism this task does not touch.

## 4. User Stories

### Story 1: Accurate data-handling copy on slides 1 and 2
As a new user reading the onboarding slides, I want the copy to accurately describe what happens to my data, so that I can trust the app's privacy claims once I start using it.

**Acceptance Criteria:**
- [ ] Given I open the app for the first time, when slide 1 renders, then it shows kicker "CARE THAT ASKS LESS OF YOU", headline "Beauty isn't just about the right products.", body "It's a system of small decisions and reminders you have to keep in mind. Let Vials hold that part — so your ritual keeps only what you actually enjoy.", and CTA "Get started" — verbatim.
- [ ] Given I advance to slide 2, when it renders, then it shows kicker "PRIVACY FIRST", headline "Your beauty secrets stay exactly that — yours.", body "Your skin profile, routines, and procedure history stay on your device by default — nothing personal is uploaded unless you choose to. When you add a new product to your shelf, anonymous data about it joins the Vials database, so the catalog grows for the whole community.", and CTA "Continue" — verbatim.
- [ ] Given slide 2's copy, when read alongside `docs/PRD_Spec.md` §1 and §4.3 after this task's doc updates land, then the two sections no longer contradict each other about whether any data leaves the device.

### Story 2: Medical disclaimer consent gate on slide 3
As a new user finishing the onboarding slides, I want to explicitly confirm I understand Vials is not a medical app before continuing into the app, so that I'm not misled about what its warnings mean and my acknowledgment is recorded.

**Acceptance Criteria:**
- [ ] Given I am on slide 3, when it first renders, then the consent checkbox is unchecked and the "Get started" CTA is disabled.
- [ ] Given the checkbox is unchecked, when I try to activate the disabled CTA, then nothing happens — no navigation, no store write.
- [ ] Given I am on slide 3, when I tap the checkbox, then it becomes checked and the CTA becomes enabled; no other action on this screen can check it for me.
- [ ] Given I check the box and then uncheck it again, when it becomes unchecked, then the CTA becomes disabled again.
- [ ] Given the checkbox is checked, when I tap the enabled CTA, then `settingsStore.acceptMedicalDisclaimer(1)` is called — setting `medicalDisclaimerAcceptedAt` to the current ISO 8601 timestamp and `medicalDisclaimerVersion` to `1` — and I am navigated to `SkinProfileSetupScreen`.
- [ ] Given slide 3, there is no secondary "Skip" action of any kind — checking the box and tapping the CTA is the only way to proceed (distinct from `FirstProductScreen`'s "Skip for now" in US-21, which this task does not change).

## 5. UX / Behaviour

Slide 1 and slide 2 behave exactly as today (horizontal paging `ScrollView`, dot indicator, single footer CTA) — only their kicker/headline/body/CTA text changes; no logic changes.

Slide 1: kicker "CARE THAT ASKS LESS OF YOU", headline "Beauty isn't just about the right products.", body "It's a system of small decisions and reminders you have to keep in mind. Let Vials hold that part — so your ritual keeps only what you actually enjoy.", CTA "Get started".

Slide 2: kicker "PRIVACY FIRST", headline "Your beauty secrets stay exactly that — yours.", body "Your skin profile, routines, and procedure history stay on your device by default — nothing personal is uploaded unless you choose to. When you add a new product to your shelf, anonymous data about it joins the Vials database, so the catalog grows for the whole community.", CTA "Continue".

Slide 3, in order:
1. Renders kicker "WARNINGS THAT ACTUALLY MATTER" and body "Instead of long lists of generic advice, Vials watches your own routine and warns you only about the combinations of products and procedures that actually apply to you." — no headline line on this slide (unlike slides 1–2).
2. Below the body, a checkbox with label "I understand Vials is a planning tool, not a medical app. It doesn't replace a consultation with a doctor or aesthetician, and it doesn't diagnose. Decisions about which products to use and procedures to undergo — and responsibility for their outcome, including possible allergic reactions — are mine to make." Default state: unchecked. Tapping it toggles checked/unchecked; nothing else on the screen changes its state.
3. Footer CTA reads "Get started" on this slide. It is visually and functionally disabled (not just dimmed — not pressable) whenever the checkbox is unchecked, and becomes enabled the moment it's checked.
4. Tapping the enabled CTA writes both consent fields to `settingsStore` (see §6) and then navigates to `SkinProfileSetupScreen`, exactly as slide 3's CTA does today.

**Loading state:** none — the consent write and navigation are synchronous, local-only operations (Zustand `set` + a fire-and-forget AsyncStorage write); nothing on this screen ever awaits a network call.

**Error state:** none applicable — there is no network call and no validatable user input beyond a boolean checkbox. The only theoretical failure (an AsyncStorage write error) is already handled invisibly at the storage layer (`services/storage.ts`'s `saveJson` catches and dev-warns without blocking the UI), identically to every other `settingsStore` write today.

**Empty state:** not applicable — this is a fixed 3-slide screen with no data-dependent content.

## 6. Data Requirements

- New data: two fields on the existing `AppSettings` type — `medicalDisclaimerAcceptedAt: string | null` (ISO 8601, `null` until accepted) and `medicalDisclaimerVersion: number` — plus one new `settingsStore` action, `acceptMedicalDisclaimer(version: number)`, that sets both. Persisted inside the existing `STORAGE_KEYS.settings` (`@vials/settings`) AsyncStorage entry; no new storage key.
- Existing data consumed: none. `profileStore.onboardingCompleted` continues to gate `AppNavigator`'s root switch, unread and unwritten by this mechanism.
- Data retention: identical to the rest of `AppSettings` — persists on-device indefinitely until uninstall or a user-triggered restore/wipe via `ImportRestoreUtility`; never transmitted off-device, consistent with what slide 2's corrected copy says about personal data.

## 7. Dependencies

- Depends on: the shipped crowdsourcing pipeline this task's copy correction describes (`docs/PRD_Spec.md` §4.3, `docs/USER_STORIES.md` US-22, 2026-07-19) and the existing `docs/specs/contribution-consent.md` feature (photo-sharing consent, already shipped) — this task does not modify either, only ensures the earlier onboarding slides no longer contradict them.
- Blocks: nothing identified.
- External services: none — no network calls are introduced.
- This task's own delivery includes updating four documentation files (`docs/SCREENS.md`, `docs/PRD_Spec.md`, `docs/USER_STORIES.md`, `docs/IMPLEMENTATION_PLAN.md`) in lockstep with the code change — tracked as explicit tasks in the tech design, not a follow-up, since resolving the documentation contradiction is this task's own stated purpose.

## 8. Security & Privacy

- Authentication required: no — local-only app, Phase 1, same as the rest of onboarding.
- Data sensitivity: `medicalDisclaimerAcceptedAt` / `medicalDisclaimerVersion` are low-sensitivity local metadata (a timestamp and an integer); never transmitted.
- Compliance considerations: the slide 3 checkbox is a liability/trust-boundary acknowledgment, not a GDPR Art. 7 consent-to-processing gate — checking it does not newly authorize any data processing (contrast with `contribution-consent`'s photo-sharing checkbox, which is an Art. 7(4) consent gate). Slide 2's copy correction is itself a GDPR Art. 13 transparency fix: accurately disclosing that manually-entered product metadata is sent off-device, resolving the factual inaccuracy described in §1.

## 9. Success Metrics

- 100% of fresh installs that reach `SkinProfileSetupScreen` carry a non-null `medicalDisclaimerAcceptedAt` — enforced by construction (no code path from slide 3 to slide 4 skips the write).
- Zero installs ever have `medicalDisclaimerAcceptedAt` set while the CTA was tapped with the checkbox unchecked — enforced by the CTA's disabled state being driven by the same boolean as the checkbox, not a separate flag that could drift.
- `docs/PRD_Spec.md` §1 and §4.3 make consistent claims about what leaves the device, verifiable by inspection at review time.

## 10. Open Questions

None. The technical gaps encountered while designing this (default value of `medicalDisclaimerVersion` before acceptance, where the version constant lives, per-slide CTA text modeling, and how the checkbox renders its label) were resolved as documented assumptions in `docs/tech-design/onboarding-consent-copy-update.md` §4 — none are business-level gaps requiring escalation.
