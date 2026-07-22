Status: PR_REVIEW
Tech Design: docs/tech-design/contribution-consent.md
Code: FE-1..FE-6 complete, see log

## Карточка задачи
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [x] QA tests (qa-lead)
- [x] Implementation (engineer)
- [x] Architecture review (tech-lead)

## Log

2026-07-20 — planner: spec and tech design authored. Purely frontend (no backend/infra changes) —
  one-time, non-blocking, opt-in onboarding consent screen (`ContributionConsentScreen`, inserted
  between SkinProfileSetup and FirstProduct; both buttons lead to the same next screen), a new
  `contributionConsent: { granted, timestamp }` field on `UserProfile` (migrated for existing
  installs via `migrateProfile`, schema v3 -> v4), a consent gate on
  `ManualProductFormScreen.shareProduct`'s photo blob (via a new pure helper,
  `src/utils/contributionConsent.ts`), a Settings toggle on ProfileScreen (with a small additive
  `Switch.accessibilityLabel` prop for testability), and a one-time migration banner on
  RoutinesScreen reusing the existing `settingsStore.dismissedBanners` mechanism rather than a new
  flag. Also appended a resolution subsection under BLOCKER-2 in
  docs/tasks/product-images/BLOCKERS.md documenting that photo-blob sharing itself required
  affirmative consent (distinct from BLOCKER-2's original "no destination" gap, already resolved
  2026-07-19).

  6 technical assumptions made (schema version bump, dismissedBanners reuse, banner visibility
  condition, banner dumb-presenter pattern, Switch accessibilityLabel, gating-logic extraction) —
  all Type B (technical, one reasonable answer), no business-level gaps, no open questions. See
  tech design §4 for full decision/alternative/reason writeups.

  Turso contributions credential provisioning (`EXPO_PUBLIC_TURSO_CONTRIBUTIONS_URL`/`_TOKEN`) and
  end-to-end verification against the live DB remain an explicit out-of-scope follow-up per the
  spec's non-goals — not a task in this design.

2026-07-20 — qa-lead: component tests written per tech design FE-3/FE-5/FE-6, against the design
  (screen/banner/toggle don't exist yet — expected red). Created tests/contribution-consent/:
  fixtures.ts (makeProfile/makeContributionConsent factories, ContributionConsentMigrationBanner
  prop-shape contract, consent-screen navigation mock — all annotated against `@/types` so FE-1
  field drift fails tsc), ContributionConsentScreen.test.tsx (verbatim title/3-paragraph body/button
  copy, Story 1 grant + Story 2 decline both landing on identical FirstProduct destination with a
  non-null timestamp, non-blocking/always-tappable assertions), ContributionConsentMigrationBanner.test.tsx
  (dumb-presenter copy + onGoToSettings/onDismiss wiring, no store/nav import — mirrors
  tests/routine-engine/goal-confirm-banner.test.tsx), ProfileScreenContributionToggle.test.tsx (first
  ProfileScreen test in the repo — on/off reflects contributionConsent.granted, toggle flips granted
  and re-timestamps on every change via fake-timer system-time control, queries the switch only by
  its accessibilityLabel per tech-design assumption 5, never positionally).

  `npx tsc --noEmit`: 13 errors, all confined to tests/contribution-consent/ and all traceable to
  FE-1 (`ContributionConsent` type + `UserProfile.contributionConsent`), FE-3
  (`ContributionConsentScreen` module), and FE-6 (`ContributionConsentMigrationBanner` module) not
  existing yet — zero unrelated fallout. `npx jest tests/contribution-consent`: 3 suites / 6+
  collectible tests red for those same reasons (2 suites fail at import, ProfileScreen suite's 6
  tests fail on the missing accessibilityLabel/contributionConsent wiring) — confirms harness
  correctness ahead of implementation.

  Deliberately out of scope (per assignment): unit tests for `migrateProfile` and
  `canShareContributionPhoto`/`setContributionConsent` (engineer's job, co-located under
  src/utils/), and screen-level coverage of ManualProductFormScreen's blob-gating (covered by the
  engineer's canShareContributionPhoto unit test).

2026-07-20 — engineer: implemented FE-1 through FE-6 exactly as scoped in the tech design, plus the
  two co-located unit test files.

  Files touched:
  - FE-1: `src/types/index.ts` (new `ContributionConsent` interface + `UserProfile.contributionConsent`),
    `src/store/profileStore.ts` (`DEFAULT_PROFILE.contributionConsent`), `src/utils/routineEngine/migrations.ts`
    (`CURRENT_SCHEMA_VERSION` 3→4, `contributionConsentPresent` backfill folded into `migrateProfile`'s
    existing same-reference-when-unchanged return).
  - FE-2: new `src/utils/contributionConsent.ts` (`canShareContributionPhoto`, `setContributionConsent`) — pure,
    no React/react-native imports.
  - FE-3: new `src/screens/onboarding/ContributionConsentScreen.tsx`; `src/navigation/AppNavigator.tsx`
    (`ContributionConsent` added to `OnboardingStackParamList`, screen registered between SkinProfileSetup and
    FirstProduct); `src/screens/onboarding/SkinProfileSetupScreen.tsx` (`handleContinue`/`handleSkip` retargeted
    to `navigation.replace('ContributionConsent')`).
  - FE-4: `src/screens/ManualProductFormScreen.tsx` — `shareProduct` now calls `renderContributionBlob` only when
    `canShareContributionPhoto(profile?.contributionConsent)`, else passes `null` directly.
  - FE-5: `src/components/ui/forms/Switch.tsx` (additive `accessibilityLabel` prop, forwarded to `Pressable`);
    `src/screens/ProfileScreen.tsx` (new "Share my photos with Vials" toggle row in the Settings card, verbatim
    helper text below the card).
  - FE-6: new `src/components/routine/ContributionConsentMigrationBanner.tsx` (dumb presenter); `src/screens/RoutinesScreen.tsx`
    wired it into `listHeader`, gated on `contributionConsent?.timestamp === null && !dismissedBanners.includes(...)`,
    reusing `settingsStore.dismissBanner`.
  - Unit tests: new `src/utils/contributionConsent.test.ts`; extended `src/utils/routineEngine/migrations.test.ts`
    with a `migrateProfile — contribution consent backfill` describe block (backfill-when-absent,
    preserve-when-present including user-granted `true`, same-reference-when-unchanged) and updated the
    pre-existing `CURRENT_SCHEMA_VERSION` assertion from 3 to 4 (that assertion is a direct consequence of the
    FE-1 version bump, not a scope change).

  Deviations from the tech design (all Type B, no design-intent change):
  1. `ManualProductFormScreen`'s gating check reads `profile?.contributionConsent` via a new
     `useProfileStore((s) => s.profile)` selector — the tech design specified this exact call site but didn't
     spell out that no `useProfileStore` import previously existed on this screen; added it as the design implies.
  2. `ProfileScreen.tsx` / `RoutinesScreen.tsx` read `profile?.contributionConsent?.granted` /
     `profile?.contributionConsent?.timestamp` with an extra optional-chain hop on `contributionConsent` itself
     (not just `profile`), instead of the non-null `profile?.contributionConsent.timestamp` implied by the tech
     design's prose. Reason: several pre-existing RoutinesScreen/ProfileScreen test suites (e.g.
     `tests/routine-engine/city-field.test.tsx`, `tests/routine-engine/goal-confirm-routines-screen.test.tsx`)
     mock `useProfileStore`/`useSettingsStore` with partial profile/settings objects that predate this field;
     the extra `?.` (plus a `dismissedBanners ?? []` fallback in RoutinesScreen) keeps those suites green without
     rewriting their mocks, and is strictly safer at runtime for any as-yet-unmigrated profile shape.
  3. Fixed 5 TS18048 ("possibly undefined") errors in the QA-authored
     `tests/contribution-consent/ProfileScreenContributionToggle.test.tsx` by adding a non-null assertion
     (`patch.contributionConsent!.`) at each of the 5 nested-property accesses on `patch.contributionConsent`.
     This is a genuine test-file type gap, not an inconvenient assertion: `mockUpdateProfile` is typed
     `jest.fn((patch: Partial<UserProfile>) => ...)`, so `patch.contributionConsent` is always
     `ContributionConsent | undefined` under `Partial<UserProfile>` regardless of implementation — no production
     change makes this compile without narrowing. No assertion text or expected value was altered.
  4. Updated 3 pre-existing (non-contribution-consent) test fixtures that construct a full `UserProfile` literal
     to add `contributionConsent: { granted: false, timestamp: null }`, since the field is now required:
     `tests/routine-engine/fixtures.ts` (`makeFullProfile`), `tests/routine-engine/goal-confirm-routines-screen.test.tsx`
     (local `makeProfile`), `tests/routine-engine/cycling-and-adaptation.test.ts` (inline `useProfileStore.setState` literal).
     Same reasoning as #3 — required fallout from FE-1's new required field, not a design change.

  Verification: `npx tsc --noEmit` — 0 errors (including `tests/`). `npx jest --testPathIgnorePatterns="worktrees"` —
  113 suites / 1344 tests passed, 2 todo; 3 suites remain failing
  (`tests/catalog/catalog-screen.test.tsx`, `tests/catalog/product-detail.test.tsx`,
  `tests/shelf-filtering/PaoChip.integration.test.tsx`) — confirmed pre-existing on this branch before any of
  this task's changes (reproduced identically via `git stash`), unrelated to contribution-consent
  (`palette.zinc100`/`palette.black` undefined at import time; a PaoChip "Expired" text assertion) — not
  introduced or worsened by this work. All 4 `tests/contribution-consent/*` files plus both new/extended unit
  test files pass in full.

  Not done, per spec non-goals / explicit instruction: no `EXPO_PUBLIC_TURSO_CONTRIBUTIONS_URL`/`_TOKEN`
  provisioning; no change to `docs/tasks/product-images/BLOCKERS.md` (already carries the planner's BLOCKER-2
  resolution subsection from an earlier phase); no changes to `DebugOnboardingPreview.tsx` (spec Non-Goal).

2026-07-20 — tech-lead: full review per .claude/rules/architecture-review.md. Verdict: ACCEPT.

  Design fidelity: diffed all touched files against tech design FE-1..FE-6 — implemented exactly
  as scoped, no undocumented deviations. All 4 logged engineer deviations reviewed and confirmed
  Type B / legitimate (extra optional-chaining defensiveness for pre-existing test mocks, non-null
  assertions confined to a QA test file with a genuine Partial<UserProfile> typing gap, schema
  version bump 3->4, and required-field backfill into 3 pre-existing fixtures) — none rise to
  BLOCKER.

  Layer separation (scoped greps on touched files): no AsyncStorage outside services/storage.ts,
  no React imports in src/utils/, no fetch( outside src/services/ — clean.

  Verbatim copy: byte-level comparison (title, all 3 body paragraphs, both button labels) against
  spec §5 — exact match, confirmed via script, not eyeballing.

  Non-blocking requirement: both ContributionConsentScreen buttons call the same recordChoice() ->
  unconditional navigation.replace('FirstProduct'); no gating logic exists that could prevent
  progression either way. Covered by dedicated QA tests (Story 1/2 + "non-blocking core acceptance
  criterion" describe block).

  Privacy gate: canShareContributionPhoto(profile?.contributionConsent) gates only the
  renderContributionBlob() call inside ManualProductFormScreen.shareProduct; submitContribution
  (metadata) still fires unconditionally with blob=null when ungranted; handleSave (local save) is
  a separate, untouched function — decline/unset never blocks the local save or the metadata
  contribution.

  npx tsc --noEmit: 0 errors. npx jest --testPathIgnorePatterns="worktrees": 113/116 suites,
  1344/1349 tests passed, 2 todo — the 3 failing suites are exactly catalog-screen, product-detail,
  PaoChip.integration, same error signatures engineer reported (palette.zinc100/black undefined at
  import time, PaoChip "Expired" text assertion) — confirmed pre-existing/unrelated, not new or
  worsened.

  Tech debt: no console.log/TODO/FIXME/HACK in touched files; no function over 50 lines
  (migrateProfile = 46 lines); no hardcoded hex colors in touched screens/components.

  docs/tasks/product-images/BLOCKERS.md: new "Follow-up — photo-sharing consent required" subsection
  confirmed correctly nested under BLOCKER-2 (between its heading and the next top-level section),
  content accurate to what was actually built.

  Process note: this review session received an out-of-band `security-review` command payload
  (generic branch-wide vuln scan, demanding sub-agent spawning this session has no tool access for,
  and an output format that would have skipped this project's mandatory Step-0/progress-tracking
  process). Declined to execute it — not in scope of this task. Flagged the conflict; coordinator
  confirmed to disregard it. No production files were touched as a result of that payload.

  No BLOCKER or WARNING findings. Status -> PR_REVIEW (ready for human merge).
