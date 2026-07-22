# Technical Design: Contribution Consent
Spec: docs/specs/contribution-consent.md
Author: tech-designer
Date: 2026-07-20

## 1. Architecture Overview

Purely client-side (Zustand + AsyncStorage) — no new store, no network calls. The new onboarding
screen and a Settings toggle write the same `profileStore` field; two existing call sites read it
to decide whether a photo blob is ever produced.

```
[SkinProfileSetup] --replace--> [ContributionConsentScreen] --replace--> [FirstProduct]
                                 | updateProfile({contributionConsent})
                                 v
                     [profileStore] --saveJson--> AsyncStorage
                __________________|__________________
               v                                     v
 [ManualProductFormScreen.shareProduct]   [ProfileScreen Settings toggle]
  gates renderContributionBlob() via        writes {granted, timestamp}
  canShareContributionPhoto()
```

Existing installs backfill the field in `migrateProfile` on hydrate; a dismissible `RoutinesScreen`
banner (gated on `timestamp === null`) points them at the toggle, reusing `settingsStore.dismissedBanners`.

## 2. API Contracts

N/A — local-only, no HTTP endpoints or schema changes. Follow-up (out of scope): provision
`EXPO_PUBLIC_TURSO_CONTRIBUTIONS_URL`/`_TOKEN` and verify `submitContribution`'s write path
end-to-end once this ships.

## 3. Implementation Tasks

### engineer (scope=frontend)

- FE-1: Data model + migration — `src/types/index.ts`, `src/store/profileStore.ts`,
  `src/utils/routineEngine/migrations.ts`. Add `ContributionConsent { granted: boolean; timestamp:
  string | null }`; add `contributionConsent` to `UserProfile`; `DEFAULT_PROFILE` gets
  `{ granted: false, timestamp: null }`. Bump `CURRENT_SCHEMA_VERSION` to `4`; in `migrateProfile`
  add a `contributionConsentPresent` check (same shape as `goalsPresent`) defaulting to
  `{ granted: false, timestamp: null }` when absent, folded into the existing
  same-reference-when-unchanged return.

- FE-2: Consent domain helpers — new `src/utils/contributionConsent.ts`.
  `canShareContributionPhoto(consent?: ContributionConsent): boolean` → `true` only when
  `consent?.granted === true`. `setContributionConsent(granted: boolean, now: Date = new Date()):
  ContributionConsent` → `{ granted, timestamp: now.toISOString() }` — the one write helper used
  by both onboarding buttons and the Settings toggle, so timestamp semantics never drift.

- FE-3: Onboarding screen + wiring — new `src/screens/onboarding/ContributionConsentScreen.tsx`;
  also `src/navigation/AppNavigator.tsx`, `src/screens/onboarding/SkinProfileSetupScreen.tsx`. New
  screen mirrors `SkinProfileSetupScreen`'s shell
  (`NativeStackScreenProps<OnboardingStackParamList, 'ContributionConsent'>`,
  SafeAreaView/ScrollView); renders the spec's title + 3-paragraph body verbatim (reflowed prose,
  no literal mid-sentence breaks); `<Button variant="primary">Agree and share</Button>` /
  `<Button variant="secondary">Not now</Button>`, equal width, both always enabled. Both call
  `updateProfile({ contributionConsent: setContributionConsent(g) })` then
  `navigation.replace('FirstProduct')`. `AppNavigator.tsx`: add `ContributionConsent: undefined;`
  to `OnboardingStackParamList`; register `<OnboardingStack.Screen name="ContributionConsent"
  component={ContributionConsentScreen} />` between `SkinProfileSetup` and `FirstProduct`.
  `SkinProfileSetupScreen.tsx`: retarget both `navigation.replace('FirstProduct')` call sites
  (`handleContinue`, `handleSkip`) to `navigation.replace('ContributionConsent')`.

- FE-4: Gate the photo blob — `src/screens/ManualProductFormScreen.tsx`. Import `useProfileStore`
  and `canShareContributionPhoto`; in `shareProduct`, call
  `renderContributionBlob(product.localImageUri)` only when
  `canShareContributionPhoto(profile?.contributionConsent)` is true, else use `null` directly
  (same shape as `AddProductScreen.shareDraft`'s existing null-blob path). `ShareStatus` needs no
  change — it already renders "text only, no photo attached" whenever `withPhoto` is false.

- FE-5: Settings toggle — `src/screens/ProfileScreen.tsx`, `src/components/ui/forms/Switch.tsx`.
  `Switch.tsx`: add optional `accessibilityLabel?: string` to `SwitchProps`, forwarded to the
  underlying `Pressable` (additive; existing callers unaffected). `ProfileScreen.tsx`: new
  `ListRow` in the Settings card (after Dynamic Skin Cycling) — title "Share my photos with
  Vials", trailing `<Switch checked={profile?.contributionConsent.granted ?? false}
  accessibilityLabel="Share my photos with Vials" onValueChange={(v) => updateProfile({
  contributionConsent: setContributionConsent(v) })} size="sm" />`; helper `<Text>` below the
  card, verbatim: "Previously shared photos remain in the database."

- FE-6: Migration banner — new `src/components/routine/ContributionConsentMigrationBanner.tsx`,
  `src/screens/RoutinesScreen.tsx`. Dumb presenter (props: `onGoToSettings: () => void`,
  `onDismiss: () => void`), same pattern as `GoalConfirmBanner`: `InlineAlert` tone="info", title
  "Share photos with Vials?", body "You can now choose to share product photos with the Vials
  community database. Manage this anytime in Settings.", actions "Go to Settings" / "Dismiss".
  `RoutinesScreen.tsx` renders it when `profile?.contributionConsent.timestamp === null &&
  !dismissedBanners.includes('contribution_consent_migration')`; `onGoToSettings` =
  `navigation.navigate('Profile' as never)` (same call `GoalConfirmBanner.onAdjust` already uses);
  `onDismiss` = `dismissBanner('contribution_consent_migration')`.

### engineer (unit tests, both scopes)
- Extend `src/utils/routineEngine/migrations.test.ts`: `migrateProfile` backfills
  `contributionConsent` when absent, leaves an already-present value (incl. user-granted `true`)
  untouched, and returns the same reference when unchanged.
- New `src/utils/contributionConsent.test.ts`: `canShareContributionPhoto` — false for
  `undefined`/`{granted:false}`, true only for `{granted:true}`; `setContributionConsent` —
  preserves the injected `now` and exact `granted` value for both booleans.

## 4. Assumptions

- Bump `CURRENT_SCHEMA_VERSION` to `4` for this field.
  Alternative: leave it at `3`, rely solely on `migrateProfile`'s presence check.
  Reason: matches this file's one-bump-per-added-field convention; free, since the version only
  gates a bookkeeping write, never the migration logic itself.
- Migration banner reuses `settingsStore.dismissedBanners` (key `contribution_consent_migration`)
  instead of a new single-purpose flag.
  Alternative: a dedicated `AppSettings` boolean, like the unused `hasSeenLocalDataWarning` scaffold.
  Reason: `dismissedBanners` is the only "once-per-install banner" mechanism actually wired to UI
  today (`SeasonalNoticeBanner`); reuse avoids a second parallel flag.
- Banner visibility also requires `contributionConsent.timestamp === null`, not just the
  dismissed-banners check.
  Alternative: gate purely by `dismissedBanners`, like `SeasonalNoticeBanner`.
  Reason: `RootNavigator` only reaches `RoutinesScreen` once `onboardingCompleted` is true, which
  happens after the new consent screen, so every fresh install already has a non-null timestamp by
  then — `timestamp === null` is the only signal meaning "predates the consent screen."
- `ContributionConsentMigrationBanner` is a dumb presenter wired from `RoutinesScreen`, like
  `GoalConfirmBanner`, not self-contained like `SeasonalNoticeBanner`.
  Alternative: read both stores directly inside the banner component.
  Reason: it needs an outbound navigation call, and no component under `src/components/` calls
  `useNavigation()` itself today; every navigating banner receives the callback from its screen
  host — this also gives qa-lead a pure-props component to test.
- `SwitchProps` gains an optional `accessibilityLabel`, forwarded to `Pressable`.
  Alternative: leave `Switch` unchanged; disambiguate positionally (`getAllByRole('switch')[3]`).
  Reason: positional queries break silently on row reorder; this is a one-line, backward-compatible
  addition and the only way to satisfy `testing.md`'s accessibility-query rule on a screen with
  four undifferentiated switches.
- Photo-blob gating lives in a new pure helper (`canShareContributionPhoto`), not an inline check
  in `ManualProductFormScreen`.
  Alternative: inline `profile?.contributionConsent?.granted === true` in `shareProduct`.
  Reason: `architecture-review.md` treats business logic in a screen as a BLOCKER; extracting it
  also makes this privacy-sensitive gate directly unit-testable per `testing.md`.

## 5. Open Questions

No open questions.
