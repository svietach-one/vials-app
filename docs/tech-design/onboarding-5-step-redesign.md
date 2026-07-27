# Technical Design: Onboarding 5-Step Redesign
Spec: docs/specs/onboarding-5-step-redesign.md
Author: planner-agent
Date: 2026-07-27

## 1. Architecture Overview
`SkinProfileSetupScreen` (same file, same navigator entry — no `AppNavigator.tsx` change) becomes a thin container holding `step: 1..5` (`useState`) and rendering `OnboardingProgressRing` plus one of 5 new step components (`src/screens/onboarding/steps/`). Steps are presentational (props/callbacks only, no store access); the container is the sole `useProfileStore` caller: `onNext(patch)` → `updateProfile(patch)` then `step+1`; `onSkip()` → `step+1` only, no write; `onBack()` → `step-1`. Step 5's Finish calls `updateProfile(patch)` then `navigation.replace('ContributionConsent')` — it must NOT set `onboardingCompleted` (see Assumption 4). Two new optional `UserProfile` fields (`hormoneTherapy?: boolean`, `pregnantOrBreastfeeding?: boolean`) ship through the standard migration path (schema v5→v6, `migrateProfile`, `DEFAULT_PROFILE`), mirroring the `contributionConsent` v3→v4 precedent (`progress/contribution-consent.md`). All step bodies reuse existing components: `GoalSelector`, `SkinConcernsSelector`, `FitzpatrickCard` (6-card, already shipped), `FilterChip`, `Switch`, `InlineAlert`, `Input`, `Button`, `Icon`.

```
SkinProfileSetupScreen (step 1..5, useState)
 ├─ OnboardingProgressRing(step, totalSteps=5, iconName)
 ├─ 1 SkinTypeStep   2 GoalsStep   3 PhototypeStep   4 AboutYouStep   5 AdditionalInfoStep
 └─ onNext(patch) → updateProfile(patch) + step++  |  onSkip() → step++  |  onBack() → step--
    step 5 Next/Finish → updateProfile(patch) → navigation.replace('ContributionConsent')  [no onboardingCompleted write]
```

## 2. API Contracts
N/A — no backend/API layer exists (Phase 1 is local-only storage per `CLAUDE.md`); every change is client-side (types, Zustand store, RN screens/components). The closest analogous contract is the `UserProfile` field addition in §1 / §3 FE-1.

## 3. Implementation Tasks

### engineer (scope=backend)
N/A — no backend layer in Phase 1 (`CLAUDE.md`).

### engineer (scope=frontend)
- FE-1: Add `hormoneTherapy?: boolean`, `pregnantOrBreastfeeding?: boolean` to `UserProfile` (`src/types/index.ts`). Bump `CURRENT_SCHEMA_VERSION` 5→6 and backfill both to `false` in `migrateProfile` (`src/utils/routineEngine/migrations.ts`) — update the existing `CURRENT_SCHEMA_VERSION` test assertion (currently `.toBe(5)`) alongside it. Set both `false` in `DEFAULT_PROFILE` (`src/store/profileStore.ts`).
- FE-2: Add `'shield-check': ShieldCheck` to `ICON_MAP` in `src/components/ui/Icon.tsx` (import `ShieldCheck` from `lucide-react-native`). The other 4 step icons already exist in the map: `droplet`, `target`, `sun`, `user`.
- FE-3: New `src/components/onboarding/OnboardingProgressRing.tsx` — `react-native-svg` circular arc sized by `step/totalSteps`, centered `Icon`, sibling "Step {step} of {totalSteps}" text for low-vision/screen-reader parity.
- FE-4: New `src/screens/onboarding/steps/SkinTypeStep.tsx` — single-select `FilterChip` row (Oily/Dry/Combination/Normal); Next disabled until a value is chosen.
- FE-5: New `src/screens/onboarding/steps/GoalsStep.tsx` — wraps the existing `GoalSelector` unchanged (its max-2 cap is already built in).
- FE-6: New `src/screens/onboarding/steps/PhototypeStep.tsx` — wraps the 6 existing `FitzpatrickCard`s (currently inline in `SkinProfileSetupScreen.tsx`) in a 2-column grid; Next disabled until a value is chosen.
- FE-7: New `src/screens/onboarding/steps/AboutYouStep.tsx` — `Input` age (numeric), gender `FilterChip`s (binary — see OQ-2), always-visible caption `Text`, divider, hormone-therapy `Switch` + helper text.
- FE-8: New `src/screens/onboarding/steps/AdditionalInfoStep.tsx` — `InlineAlert tone="warning"` with the pregnancy/breastfeeding `Switch` in its `action` slot, plus the existing `SkinConcernsSelector` below it.
- FE-9: Rewrite `src/screens/onboarding/SkinProfileSetupScreen.tsx` as the 5-step container per §1 (step state, progress ring, next/skip/back wiring, Finish behavior).
- FE-10: Doc sync — one-line corrections to `docs/SCREENS.md` (§1 `SkinProfileSetupScreen` bullet + the `US-03` phototype description, both still say "3 cards"), `docs/PRD_Spec.md` (matching lines), `docs/IMPLEMENTATION_PLAN.md` (Phase 1 scope list + the stale Phase 7 Feather→lucide-react-native bullet).
- ~~FE-11~~ — dropped. OQ-2 resolved to "keep binary" (2026-07-27); no `UserProfile.gender` widening.

### devops-lead
N/A — `infra_changes: false`.

### engineer (unit tests, both scopes)
- Each task above includes writing unit tests for the code produced (in particular, `migrateProfile`'s new backfill branch and the updated `CURRENT_SCHEMA_VERSION` assertion, co-located per `.claude/rules/testing.md`).

## 4. Assumptions
1. **Phototype step reuses the existing 6-card `FitzpatrickCard`** (numeral + swatch + accessibilityLabel), not the 3-grouped-card `PhototypeCard`.
   Alternative: build new individual cards, or keep the grouped 3-card component, per the original task brief's framing.
   Reason: `FitzpatrickCard` is already shipped and in production use in the exact screen being split (`SkinProfileSetupScreen.tsx`; `profileStore.ts`/`migrations.ts` docstrings: "FE-9 flipped the UI to the six-card...input"; `docs/IMPLEMENTATION_PLAN.md` line 191 lists "6-card phototype onboarding" under completed FE-9). The 3-vs-6 choice was already made and shipped by a prior, ACCEPTED task — only `SCREENS.md`/`PRD_Spec.md`'s prose is stale. See §5 OQ-1.
2. **Existing `FITZPATRICK_A11Y` strings and card face (numeral + swatch only) are kept verbatim** — not rewritten to match `SCREENS_onboarding_spec.md`'s accessibilityLabel table or its "Label text on card" column.
   Alternative: rewrite the 6 accessibility labels and add visible descriptive text under each card to match the reference doc word-for-word.
   Reason: shipped copy conveys equivalent meaning; rewriting a live, tested a11y contract and redesigning the card face for wording parity alone is unnecessary churn for a step-decomposition task.
3. **Steps are presentational (props/callbacks only); only the container calls `useProfileStore`.**
   Alternative: each step component calls `updateProfile` directly, per the original brief's wording.
   Reason: centralizes the "Skip doesn't persist / Next does" rule in one place; keeps each step trivially testable with plain props, no store mocking per test file.
4. **Step 5 "Finish" navigates to `ContributionConsent` and does not set `onboardingCompleted`.**
   Alternative: set `onboardingCompleted = true` on Step 5 Finish and navigate to `FirstProductScreen`, per the original brief.
   Reason: `onboardingCompleted` gates `RootNavigator`'s `OnboardingNavigator`-vs-`MainTabs` choice (`AppNavigator.tsx`); today it's set only inside `FirstProductScreen.completeOnboarding`. Setting it earlier would unmount the whole onboarding stack and skip `ContributionConsent`/`FirstProduct`.
5. **New fields get a full migration** (schema v5→v6, `migrateProfile` backfill, `DEFAULT_PROFILE` entry) rather than staying bare-optional/undefined.
   Alternative: leave both fields fully optional with no migration, matching lighter-weight flags like `Product.isHidden`.
   Reason: matches the `contributionConsent` precedent named for this task; gives the (future, out-of-scope) conflict-engine consumer a guaranteed boolean instead of `boolean | undefined`.
6. **`OnboardingProgressRing` uses `react-native-svg`** (installed, currently unused elsewhere in `src/`) and accepts the app's existing `IconName` string type via `@/components/ui/Icon`, not a raw `LucideIcon` reference.
   Alternative: approximate the ring with plain `View`/rotation tricks, or accept a `LucideIcon` prop directly per the original brief.
   Reason: SVG stroke-dasharray is the reliable way to render a precise partial-circle arc; every other icon call site in the app goes through the `Icon` adapter, never raw lucide imports.
7. **Next is disabled until a choice is made only on Step 1 (skin type) and Step 3 (phototype)**; Steps 2/4/5 always leave Next enabled.
   Alternative: disable Next on every step, or never disable it anywhere.
   Reason: mirrors today's single-screen `canContinue = skinType !== null && fitzpatrick !== null` gating; every field on steps 2/4/5 is explicitly optional per the copy doc.
8. **Back-navigation re-seeds each step's local state from the current `profile` on remount**; edits abandoned via Back/Skip are discarded, not held in a separate draft store.
   Alternative: keep all 5 steps mounted simultaneously to preserve in-progress edits across Back/Forward.
   Reason: simplest mental model ("Next commits, anything else doesn't"); avoids a second state system living outside `profileStore`.
9. **Button color / icon library are non-blockers** — `Button.tsx`'s `variant="primary"` already resolves to `palette.plum`, and icons already go through the shared `Icon` adapter (`lucide-react-native` underneath). `colors.controlFill` in `tokens.ts` is a separate, unused-by-`Button.tsx` alias (black) — a doc-hygiene note only, not touched by this task.

## 5. Open Questions
No open questions. Both were confirmed by human/product (Sviatlana) on 2026-07-27:
- **OQ-1 — resolved: 6 cards.** Phototype step uses the already-shipped 6-card `FitzpatrickCard` (Assumption 1 stands as written).
- **OQ-2 — resolved: keep binary.** Gender stays Female/Male only; FE-11 is dropped from scope (no `UserProfile.gender` widening, no `SkinProfileEditModal`/`ProfileScreen` changes).
