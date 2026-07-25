# Technical Design: Onboarding Consent & Copy Update
Spec: docs/specs/onboarding-consent-copy-update.md
Author: tech-designer
Date: 2026-07-25

## 1. Architecture Overview

Purely client-side — no new store, no network calls, no schema/version bump. `MarketingSlidesScreen`'s existing per-slide config gains per-slide CTA text and a slide-3-only consent checkbox bound to local `useState`; the final CTA press writes two new fields to the existing `settingsStore` (same `@vials/settings` AsyncStorage key) before continuing exactly as today. Four documentation files are corrected/extended in the same task to remove the standing PRD/SCREENS.md contradiction about data leaving the device.

```
MarketingSlidesScreen, slide 3
  Checkbox (useState, default false) --checked--> enables footer Button
                                                        |
                                              onPress (only if enabled)
                                                        v
                                settingsStore.acceptMedicalDisclaimer(1)
                                                        |
                       set({medicalDisclaimerAcceptedAt, medicalDisclaimerVersion})
                                                        |
                                  saveJson(STORAGE_KEYS.settings, ...)  [AsyncStorage]
                                                        |
                              navigation.replace('SkinProfileSetup')   [unchanged]
```

## 2. API Contracts

N/A — local-only. No HTTP endpoints. No `STORAGE_KEYS` addition and no `CURRENT_SCHEMA_VERSION` bump: the two new fields live inside the existing `@vials/settings` blob, and `settingsStore.hydrate()`'s existing `{ ...DEFAULT_SETTINGS, ...stored }` merge already backfills them for settings blobs persisted before this change.

## 3. Implementation Tasks

### engineer (scope=frontend)

- FE-1: `src/types/index.ts` — add `medicalDisclaimerAcceptedAt: string | null` and `medicalDisclaimerVersion: number` to `AppSettings`.

- FE-2: `src/store/settingsStore.ts` — add both fields to `DEFAULT_SETTINGS` (`null`, `0`) and to `pickSettings()`; add `acceptMedicalDisclaimer(version: number)` following the existing inline `set()` + `saveJson()` pattern used by every other action here (e.g. `dismissBanner`): sets `medicalDisclaimerAcceptedAt` to `new Date().toISOString()` and `medicalDisclaimerVersion` to `version`.

- FE-3: `src/screens/onboarding/MarketingSlidesScreen.tsx` —
  (a) rewrite `SLIDES[0]`/`SLIDES[1]` copy verbatim per spec §5 (`eyebrow`→Kicker, `title`→Headline, `body`→Body); add a `cta: string` field per slide (`'Get started'`, `'Continue'`, `'Get started'`) and render `slide.cta`, replacing the current `isLast ? 'Get started' : 'Continue'` ternary;
  (b) `SLIDES[2]` gets its kicker/body verbatim per spec §5 and no `title` — omit the `styles.title` text node for this slide only, it has no headline;
  (c) add `const CURRENT_MEDICAL_DISCLAIMER_VERSION = 1` at module scope and local `const [consentChecked, setConsentChecked] = useState(false)`; render, only on slide 3, a DS `Checkbox` (`size="md"`, `checked={consentChecked}`, `onValueChange={setConsentChecked}`, `label` set to the exact checkbox text from spec §5) below the body;
  (d) footer `Button`'s `disabled` prop becomes `isLast && !consentChecked` (currently always enabled); in `handleNext`'s `isLast` branch, call `acceptMedicalDisclaimer(CURRENT_MEDICAL_DISCLAIMER_VERSION)` (from `useSettingsStore`) before `navigation.replace('SkinProfileSetup')`.

- FE-4: `docs/SCREENS.md` §1 — replace the `MarketingSlidesScreen` bullet with a 3-card description ending in the required consent checkbox gating card 3's CTA, referencing `US-23`; correct any "never leaves the device" phrasing to match `docs/PRD_Spec.md` §4.3 (resolve in favor of §4.3).

- FE-5: `docs/PRD_Spec.md` — §1 Trust Anchor: replace "100% data confidentiality... no cloud backend, no analytics, no trackers" with copy distinguishing on-device-by-default personal data from contributed, anonymized product metadata. §4.1: update the `MarketingSlidesScreen` bullet to match `SCREENS.md`, referencing the new consent requirement.

- FE-6: `docs/USER_STORIES.md` — add a sync note at the top (US-23 added; PRD_Spec/SCREENS.md privacy-claim correction) and a new `US-23 · Medical Disclaimer Consent (Onboarding)` section using this spec's §4 Story 2 acceptance criteria.

- FE-7: `docs/IMPLEMENTATION_PLAN.md` — Phase 1: add the consent-gate detail to the `MarketingSlidesScreen` bullet. Phase 0: add the `settingsStore` field/action addition to its existing bullet, alongside `dismissedBanners`.

### engineer (unit tests, both scopes)
- No new `src/utils/` pure function is introduced — FE-2's action is a direct `set` + `saveJson` pair, matching every other (untested-in-isolation) `settingsStore` action, so no co-located unit test is required beyond FE-1–FE-3 type-checking cleanly. Behavioral coverage (checkbox default/toggle, disabled→enabled CTA, store write on press, verbatim copy) is qa-lead's `MarketingSlidesScreen` integration test, written before FE-3 per the agent protocol.

## 4. Assumptions

- `medicalDisclaimerVersion` defaults to `0` in `DEFAULT_SETTINGS`, not `1`.
  Alternative: default it to `1`, matching the version passed on first acceptance.
  Reason: keeps "never accepted" unambiguous from either field alone — `0` can never collide with a real version (which starts at `1` per spec) — without requiring every future reader to also check `medicalDisclaimerAcceptedAt !== null` first.
- The version constant lives as `CURRENT_MEDICAL_DISCLAIMER_VERSION` inside `MarketingSlidesScreen.tsx`, not a shared constants module.
  Alternative: add it to `src/constants/tokens.ts` or a new `src/constants/legal.ts`.
  Reason: this task's only call site is the screen itself — the future re-prompt-on-bump flow that would need a shared reference is explicitly out of scope; co-locating with the copy it versions is simplest and trivially hoistable later, and keeps it visibly distinct from the unrelated `CURRENT_SCHEMA_VERSION` in `migrations.ts`.
- Per-slide CTA text is added as a `cta` field on each `SLIDES` entry, replacing the `isLast` ternary.
  Alternative: keep the ternary, treat slide 1's "Get started" as a spec slip and render "Continue" there.
  Reason: the spec is marked "do not paraphrase" and lists distinct CTA text per slide, including a repeated "Get started" on slides 1 and 3; the existing binary ternary can't express that.
- Slide 3's consent sentence renders via the DS `Checkbox`'s own `label` prop, unmodified — same pattern every other `Checkbox` call site in the app uses.
  Alternative: bypass `label`, lay the sentence out as a sibling `<Text>` next to a bare checkbox, with a hand-built wrapping `accessibilityLabel`.
  Reason: `Checkbox`'s `Pressable` already carries `accessibilityRole="checkbox"` + `accessibilityState`, and RN's default accessibility tree announces nested `Text` as the element's name — the sibling-`Text` alternative would need a second hand-built accessible wrapper and risks nesting two interactive elements. The component's checked-state strikethrough is a minor cosmetic quirk on a long sentence, not a functional or accessibility regression — worth a QA visual look, not a bespoke pattern.
- `acceptMedicalDisclaimer` is a plain inline store action, not an extracted pure helper module.
  Alternative: mirror `contribution-consent`'s `src/utils/contributionConsent.ts` pattern (`canShareContributionPhoto`/`setContributionConsent`).
  Reason: that extraction earned its keep because a second call site (`ManualProductFormScreen`) needed to independently query consent state via a gating predicate; nothing in this task's scope reads these fields anywhere else, so a pure helper would be unused indirection — this matches every existing `settingsStore` action's own style.

## 5. Open Questions

No open questions.
