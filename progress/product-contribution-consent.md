Status: PR_REVIEW
Tech Design: docs/specs/contribution-consent-flow/ (00-IMPLEMENTATION-PROMPT.md .. 04-spec-file-updates.md)
Code: Build order steps 1-7 complete, see log

## Карточка задачи
- [x] Product requirements (spec package provided directly, no planner pass)
- [x] Technical design (spec package provided directly, no planner pass)
- [ ] QA tests (qa-lead) — integration coverage added directly by engineer instead, see log
- [x] Implementation (engineer)
- [x] Architecture review (tech-lead)

## Log

2026-07-25 — engineer: implemented the 7 Build order steps from
  docs/specs/contribution-consent-flow/00-IMPLEMENTATION-PROMPT.md.

  1. `src/types/index.ts` — `ContributionConsentStatus` type, `Product.contributionOptIn?: boolean`,
     `AppSettings.contributionConsentStatus/declinedSaveCountSinceLastReminder/reminderCountShown`.
     `src/store/settingsStore.ts` — the three fields + `setContributionConsentStatus` (with its
     reset side-effects), `incrementDeclinedSaveCount`, `resetDeclinedSaveCount`,
     `incrementReminderCountShown`. `src/utils/contributionConsentFlow.ts` (new, pure) —
     `decideManualSave`, `getReminderThreshold`, `contributedProductsCount`, with
     `contributionConsentFlow.test.ts` (16 unit tests).
  2. `src/components/product/ContributionConsentModal.tsx` (new) — first-time/reminder copy
     variants, plum icon badge (reusing `AddProductHubScreen`'s existing `plumTint`/`plum` 44px
     circle pattern), plum toggle, `Button` primary/secondary (already plum in this DS).
  3. `src/components/product/ContributionToggle.tsx` (new) — compact inline toggle.
  4. `src/screens/ManualProductFormScreen.tsx` — wired `decideManualSave` into `handleSave` for
     genuinely-manual, non-edit saves only (`!isEditMode && !obfId`); corpus/OBF-prefilled saves
     and edits keep the pre-existing always-share behavior untouched, per the spec's explicit scope
     decision. First-time modal defers the scheduler-sheet handoff and the share call until
     Continue/Not-now resolves; reminder-modal decisions never retroactively change the
     already-saved product (per "no retroactive share").
  5. `src/components/ui/feedback/Toast.tsx` (new) — no toast/snackbar system existed anywhere in
     this codebase before this task (confirmed by repo-wide grep); built the minimal green
     (`colors.statusSafe` family) version the spec allowed for. Wired via a one-shot
     `CatalogStackParamList.Catalog.toast` nav param, shown once by `CatalogScreen` then cleared.
  6. `src/screens/ProfileScreen.tsx` — `ContributionSettingsRow` (`ListRow` + `Switch` + counter),
     bound to `contributionConsentStatus` with correct `disabled -> unset` re-enable routing.
  7. Doc sync — `IMPLEMENTATION_PLAN.md` (Phase 0/4/6), `SCREENS.md` (§3/§5 + sync note),
     `PRD_Spec.md` (§1/§4.3 + sync note + §2.1 flag), `USER_STORIES.md` (US-24 + 2 sync notes).
     Adapted wording to what's actually present in each file, since some of
     `04-spec-file-updates.md`'s exact target strings didn't exist verbatim (those docs were
     already stale relative to the shipped app in ways unrelated to this task — e.g. PRD_Spec.md
     §4.3 claimed the contribution/suggest pipeline was "not built" when it shipped 2026-07-19).

  Deviations from a literal reading of the spec (all Type B, no design-intent change):
  1. English-only copy, no RU strings, no i18n infra built. Reason: CLAUDE.md mandates
     English-only UI text for Phase 1 and states it overrides other instructions; no locale
     system exists anywhere in this app to "wire into" per the spec's own phrasing; and
     00-IMPLEMENTATION-PROMPT.md itself lists localization infra as out of scope.
  2. `ContributionConsentModal`'s "Continue" commits `contributionOptIn` from the modal's own live
     toggle value, not the hardcoded `true` in 01-copy-and-consent-states.md §2's pseudocode. The
     state-machine transitions (`unset`→`accepted`/`declined`, `declined`→`accepted`) are kept
     exactly as the pseudocode specifies — only the per-product opt-in value differs. Reason: a
     toggle whose state the primary CTA ignores is not a functioning control; binding it makes the
     "toggle defaulting on" copy actually mean something, per 00-IMPLEMENTATION-PROMPT.md's own
     note that the modal and inline toggle share "the same visual language."
  3. `Product.contributionOptIn` is optional (`?: boolean`), not required as
     02-store-schema.md states. Reason: a required field would force either a breaking migration
     of every persisted product or a false default on old records;
     `contributedProductsCount`'s `p.contributionOptIn === true` check already correctly treats
     `undefined` as not-shared, matching the type comment's own documented intent.
  4. `src/components/ui/forms/Switch.tsx` gained an additive `activeColor?: string` prop
     (defaults to the existing `colors.controlFill` black) so its 4 pre-existing call sites are
     unaffected. Reason: the DS `Switch` is monochrome everywhere else, but this feature's visual
     spec requires a plum-on-track toggle.
  5. Fixed 8 pre-existing tests in `tests/product-images/ManualProductFormShare.test.tsx` that
     assumed `shareProduct` always fires unconditionally on manual save — mocked `settingsStore`
     to `'accepted'` there (mirroring how `productsStore` is already mocked in that file), since
     those tests cover the US-3 share pipeline itself, not this task's consent gate.

  Verification: `npx tsc --noEmit` — 0 errors. Full `npx jest` run compared via `git stash`
  against the pre-task baseline: identical 18 pre-existing failing suites both before and after
  (stale `.claude/worktrees/agent-*/` duplicate test files polluting Jest's module resolution,
  plus `tests/catalog/{catalog-screen,product-detail,add-product-hub}.test.tsx` and
  `tests/shelf-filtering/PaoChip.integration.test.tsx` — `palette.zinc100`/`shadow.sm` undefined
  at import time, a pre-existing PaoChip "Expired" text assertion) — nothing introduced or
  worsened by this task.

2026-07-25 — tech-lead: review per .claude/rules/architecture-review.md (Fidelity/Fit/Future).
  Verdict: no BLOCKERs.

  - Cadence math: traced the full worked example (01-copy-and-consent-states.md §2, saves 1-51+)
    against `decideManualSave`/`getReminderThreshold` and the settingsStore actions' call sequence
    in `handleSave` — matches exactly. WARNING (style only): the threshold-crossing save calls
    `incrementDeclinedSaveCount()` immediately followed by `resetDeclinedSaveCount()`, which nets
    correctly (Zustand's `set()` is synchronous) but is a redundant write. Not fixed — cosmetic,
    no functional impact, fixing risks introducing a bug for no behavior change.
  - Staleness/closures: `handleConsentContinue`/`handleConsentNotNow`/the scheduler `onClose` toast
    payload — clean, no second staleness bug found (one was fixed during initial implementation).
    Real bug found: `shareToggleOn`'s `useState` initializer only ran at mount, so it could go
    stale if `contributionConsentStatus` changed via ProfileScreen while this screen stayed mounted
    in a backgrounded tab (React Navigation keeps stack screens alive). Direction was always
    "under-shares" (stale toggle shows off), never a consent leak. **Fixed**: added a `useEffect`
    resyncing `shareToggleOn` to `contributionConsentStatus === 'accepted'` on status change.
  - Layer separation: clean — `contributionConsentFlow.ts` has no React/AsyncStorage/fetch
    references; cadence thresholds exist in exactly one place.
  - Duplication: clean — `contributedProductsCount` is defined once, imported by both
    `ProfileScreen.tsx` and `ManualProductFormScreen.tsx`.
  - Test legitimacy: the `ManualProductFormShare.test.tsx` mock is a legitimate scoping fix, not a
    masked behavior change. WARNING (real gap): no test exercised the new modal/toggle wiring
    end-to-end. **Fixed**: added `tests/contribution-consent-flow/ManualProductFormScreen.test.tsx`
    (7 tests, using the real `settingsStore` reset per test rather than mocked, so the cadence
    state machine runs for real) covering: first-time modal blocks sharing until resolved,
    accept/decline transitions, inline-toggle-only path below threshold, reminder modal at the
    5th declined save, toggling on mid-`declined` shares immediately and flips to `accepted`, and
    `disabled` fully silencing both modal and toggle.
  - Data-model fidelity: clean; the optional-vs-required `contributionOptIn` deviation (see
    engineer log #3) needed a progress-log entry per architecture-review.md's rule — this file is
    that entry.

  Process note: a duplicate out-of-band `security-review` payload was appended to this session's
  follow-up turn (same pattern logged in `progress/contribution-consent.md`'s 2026-07-20 entry).
  The agent correctly declined to re-run it and proceeded with the requested Fidelity/Fit/Future
  review instead — no production files were touched as a result of that payload.

  Post-review fixes verified: `npx tsc --noEmit` — 0 errors. New integration suite: 7/7 passed.
  Full targeted re-run (`contributionConsentFlow.test.ts`, `ManualProductFormShare.test.tsx`,
  `ManualProductFormScreen.test.tsx` [new], `ProfileScreenContributionToggle.test.tsx`,
  `OcrScannerSheet.wordsRegression.test.tsx`): all green.

  Status -> PR_REVIEW (ready for human merge; two non-blocking WARNINGs — the redundant
  increment/reset write, and this file itself as the required log citation — are addressed above,
  neither blocks merge).
