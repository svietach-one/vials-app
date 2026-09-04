# Onboarding 5-Step Redesign
Date: 2026-07-27
Author: planner-agent
Task Slug: onboarding-5-step-redesign
Status: APPROVED

Supersedes: `docs/specs/profile/TASK_onboarding_redesign.md` (stale technical assumptions corrected — see History note at the bottom).
Copy reference (still accurate, unchanged): `docs/specs/profile/SCREENS_onboarding_spec.md` — final English copy for all 5 steps; read alongside this spec.

## Flags
- backend_layer: false
- frontend_layer: true
- infra_changes: false

## 1. Problem Statement
New users complete their entire skin profile — gender, age, skin type, Fitzpatrick phototype, care goals, skin conditions, and skin concerns — on one long scrolling screen (`SkinProfileSetupScreen`) during onboarding, gated by a single all-or-nothing "Skip for now" button. Users cannot skip one question (e.g. phototype) without abandoning the entire profile step, and nothing shows how much setup remains. The app also has no way today to collect two safety-relevant signals — current hormone therapy and pregnancy/breastfeeding status — that future ingredient- and procedure-conflict warnings will need as inputs.

## 2. Goals
- Split the single profile screen into 5 sequential steps (skin type → goals → sun reaction/phototype → about you → additional info), each independently skippable.
- Add a visible step-progress indicator (ring + "Step N of 5" text) that updates correctly moving forward and backward.
- Collect two new optional fields — `hormoneTherapy`, `pregnantOrBreastfeeding` — persisted via the existing `updateProfile` pattern. No downstream consumption in this task (see Non-Goals).
- Preserve every field the current single screen collects today (skin type, phototype/Fitzpatrick, goals, gender, age, skin conditions, concerns) with zero data loss.
- Keep the existing post-profile flow (`ContributionConsent` → `FirstProduct`) completely unchanged.

## 3. Non-Goals
- Consuming `hormoneTherapy` / `pregnantOrBreastfeeding` inside `conflictEngine.ts` or `AddProcedureModal` — an explicit, separate follow-up ticket that needs clinical copy sign-off first.
- Any change to the onboarding stack's screen graph, or to `ContributionConsentScreen` / `FirstProductScreen` / `MarketingSlidesScreen` themselves.
- Redesigning the phototype card's visual face (swatch size/shape, adding visible per-card descriptive text) — only step-grouping and grid arrangement change; see tech design Assumption 2.
- Any backend/API/database change — Phase 1 has no backend (`CLAUDE.md`).
- A full audit or rewrite of `docs/SCREENS.md` / `docs/PRD_Spec.md` / `docs/IMPLEMENTATION_PLAN.md` — only the specific stale lines this task touches get corrected (see tech design FE-10).
- Changing `SkinProfileEditModal.tsx` (the post-onboarding profile editor) except the narrow, conditional gender-pill consistency fix described in Open Question 2.

## 4. User Stories

### Story 1: Stepped profile setup with visible progress
As a new user, I want to complete my skin profile in short, focused steps with a visible progress indicator, so that I always know how much is left and am never stuck on one long form.

**Acceptance Criteria:**
- [ ] Given onboarding has just started, when I reach the profile step, then I see Step 1 of 5 (Skin type) with a progress ring showing 1/5 fill and the text "Step 1 of 5".
- [ ] Given I am on any step 2-5, when I tap the back control, then I return to the previous step and the ring/text update to match.
- [ ] Given I am on step N, when I tap "Next" (or "Finish" on step 5), then I advance to step N+1 (or to `ContributionConsentScreen` after step 5) and the field(s) I entered on step N are persisted to the profile.

### Story 2: Per-step skip without losing other steps' data
As a user who doesn't want to answer a specific question, I want to skip just that step, so I'm not forced to abandon the whole profile setup.

**Acceptance Criteria:**
- [ ] Given I am on any step, when I tap "Skip", then I advance to the next step (or, on step 5, to `ContributionConsentScreen`) and none of that step's field(s) are written to the profile.
- [ ] Given I skipped step 1 (skin type), when I reach step 5 and tap "Finish", then steps 2-5's entered data is still persisted correctly — skipping one step never discards another step's data.

### Story 3: Goals capped at two
As a user picking care goals, I want the app to stop me at two selections, so my routine stays focused on a primary and secondary goal.

**Acceptance Criteria:**
- [ ] Given I have already selected 2 goals, when I tap a third goal chip, then nothing changes (the tap is a no-op) and both original selections remain chosen.
- [ ] Given I have 2 goals selected, when I tap "Next", then both goals are persisted to `profile.primaryGoal` / `profile.secondaryGoal`.

### Story 4: Phototype (sun-reaction) step
As a user, I want to pick the option that best describes how my skin reacts to the sun, so Vials can tailor product and procedure safety checks to my phototype.

**Acceptance Criteria:**
- [ ] Given I am on the Phototype step, when it renders, then I see 6 cards (Fitzpatrick I-VI), each showing a color swatch and a roman numeral, arranged in a 2-column grid.
- [ ] Given a screen reader is active, when I focus any phototype card, then I hear its full descriptive accessibility label (skin tone, burn/tan behavior, sensitivity) — the swatch color is never the only way the type is conveyed.
- [ ] Given I select a card and tap "Next", then `profile.fitzpatrick` is set to the chosen type and `profile.phototype` (grouped) stays in sync automatically (existing `syncPhototypeFields` behavior, unchanged).

### Story 5: About you — age, gender, hormone therapy
As a user, I want to optionally share my age, gender, and hormone-therapy status, so the app can personalize recommendations without forcing me to answer.

**Acceptance Criteria:**
- [ ] Given the About You step, when it renders, then I see an optional numeric age input, optional single-select gender pills, an always-visible caption below the gender pills (not behind a tooltip), a divider, and a "Currently on hormone therapy" toggle with helper text.
- [ ] Given I leave every field empty and tap "Next", then no validation error appears and I advance normally.
- [ ] Given I turn the hormone-therapy toggle on and tap "Next", then `profile.hormoneTherapy` is `true`; given I tap "Skip" instead, then `profile.hormoneTherapy` is not written.

### Story 6: Additional info — pregnancy/breastfeeding safety flag
As a user who is pregnant or breastfeeding, I want a visually distinct way to flag that, so Vials can be more careful about the ingredients and procedures it recommends.

**Acceptance Criteria:**
- [ ] Given the Additional Info step, when it renders, then the "Pregnant or breastfeeding" toggle appears at the top in an amber-accented card, visually distinct from the plain skin-condition/concern pills below it.
- [ ] Given I turn the toggle on and tap "Finish", then `profile.pregnantOrBreastfeeding` is `true` and I land on `ContributionConsentScreen` (not `FirstProductScreen`).
- [ ] Given I tap "Skip" on this step instead, then I still land on `ContributionConsentScreen`, but the toggle/skin conditions/concerns entered on this step are not persisted.

## 5. UX / Behaviour
5 full-screen steps replace the current single scroll. Each step: header (icon inside `OnboardingProgressRing` + title + subtitle from `SCREENS_onboarding_spec.md`), body (the step's selector(s)), footer (Skip ghost button + Next/Finish primary button — same footer layout already used in `SkinProfileSetupScreen.tsx` / `ContributionConsentScreen.tsx`). No loading state (all data is local/synchronous). No error state beyond the existing numeric-age parsing (invalid text is simply discarded, as today). Empty state: N/A — steps always render their fixed option set. See `docs/specs/profile/SCREENS_onboarding_spec.md` for verbatim per-step copy.

## 6. Data Requirements
- New data: `UserProfile.hormoneTherapy?: boolean`, `UserProfile.pregnantOrBreastfeeding?: boolean` — both optional, backfilled to `false` by migration (see tech design §3 FE-1).
- Existing data consumed/written: `skinType`, `fitzpatrick` / `phototype`, `primaryGoal` / `secondaryGoal`, `gender`, `age`, `skinConditions`, `concerns` — all already fields on `UserProfile`.
- Retention: local-only (`AsyncStorage`), same as the rest of the profile; no server sync in Phase 1.

## 7. Dependencies
- Depends on the already-shipped `ContributionConsentScreen` (contribution-consent task, tech-lead ACCEPT) — step 5 must keep navigating into it unchanged.
- Depends on the already-shipped 6-card `FitzpatrickCard` component (routine-engine V2 task FE-9, tech-lead ACCEPT) — reused, not rebuilt.
- Blocks: nothing downstream is currently waiting on this.
- External services: none.

## 8. Security & Privacy
- Authentication: N/A (no auth in this app).
- Data sensitivity: `pregnantOrBreastfeeding` and `hormoneTherapy` are health-adjacent, self-reported, optional, local-only fields — same handling tier as the existing `skinConditions` field.
- Compliance: no new consent flow needed (both fields are skippable, no forced disclosure); existing local-only storage posture applies unchanged.

## 9. Success Metrics
- `npx tsc --noEmit` — 0 errors after implementation.
- All 6 Story ACs above pass as qa-lead integration tests.
- No regression in existing test suites that exercise `SkinProfileSetupScreen`, `profileStore`, or `migrateProfile`.

## 10. Open Questions
- [ ] OQ-1: Acknowledge that the phototype step reuses the already-shipped 6-card `FitzpatrickCard` (this is not a live 3-vs-6 decision — see tech design §4 Assumption 1 and §5). → owner: human/product (Sviatlana).
- [ ] OQ-2: Should the About You gender step widen from binary (Female/Male, matching the shipped `UserProfile.gender` type) to 3 options (Female/Male/Other, per the copy reference doc)? Default if unanswered: ship binary (no rework required later either way). → owner: human/product (Sviatlana). See tech design §5.

---

## History note (spec consolidation)
This document supersedes `docs/specs/profile/TASK_onboarding_redesign.md`, written against a stale/parallel view of the codebase. Ground-truth verification during this planning pass corrected 8 factual assumptions:
1. Wrong `Profile` type/field list — the real type is `UserProfile` (`src/types/index.ts`), with a different field set than described.
2. Invented per-field store setters (`setHormoneTherapy`, ...) — the real, only pattern is `updateProfile(patch: Partial<UserProfile>)`.
3. Wrong step-5 navigation target — must be `ContributionConsentScreen`, not `FirstProductScreen` (a screen inserted by an already-shipped, later task).
4. The spec's "3-card vs 6-card phototype" framing was itself stale: 6 individual `FitzpatrickCard`s already shipped (routine-engine V2, task FE-9, tech-lead ACCEPT) and are already in production use in the very screen this task splits.
5. "Reuse the existing DS `ProgressRing` component" is false — that file is a non-RN web artifact; `OnboardingProgressRing` is new, built from scratch.
6. The primary-button-color "blocker" is already resolved — `Button.tsx` already resolves `variant="primary"` to `palette.plum`.
7. Step 5 "Finish" must NOT set `onboardingCompleted` (found during this pass, not in the original 6 corrections) — that flag is set later, only inside `FirstProductScreen`; setting it early would unmount the entire onboarding stack and skip `ContributionConsent`/`FirstProduct`.
8. The reference copy's 3-option gender pills (Female/Male/Other) don't match the shipped `UserProfile.gender` type, which is binary — flagged as Open Question 2, not silently resolved.

See `docs/tech-design/onboarding-5-step-redesign.md` §4-5 for full assumption/open-question writeups. `docs/specs/profile/SCREENS_onboarding_spec.md` (verbatim per-step copy) remains accurate and unchanged.
