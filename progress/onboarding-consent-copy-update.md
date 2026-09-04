Status: ACCEPTED
Tech Design: docs/tech-design/onboarding-consent-copy-update.md
Code: src/types/index.ts, src/store/settingsStore.ts, src/screens/onboarding/MarketingSlidesScreen.tsx

## Карточка задачи
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [x] QA tests (qa-lead)
- [x] Implementation (engineer)
- [x] Architecture review (tech-lead)

## Log

2026-07-25 — planner: spec and tech design authored. Purely frontend, no
  backend/infra changes — corrects the onboarding privacy copy contradiction
  between docs/PRD_Spec.md §1 and §4.3 (slide 1/2 rewrite, verbatim EN copy,
  no RU strings per explicit instruction) and adds a blocking medical
  disclaimer consent checkbox to slide 3 of MarketingSlidesScreen (no new
  screen, slide count stays at 3). Two new settingsStore fields
  (medicalDisclaimerAcceptedAt, medicalDisclaimerVersion) + one action
  (acceptMedicalDisclaimer) persisted in the existing @vials/settings
  AsyncStorage key. Four docs updated in the same task: SCREENS.md,
  PRD_Spec.md (§1 + §4.1), USER_STORIES.md (new US-23 + sync note),
  IMPLEMENTATION_PLAN.md (Phase 0 + Phase 1).

  5 Type-B technical assumptions made and confirmed with the coordinator
  before writing (medicalDisclaimerVersion defaults to 0 pre-acceptance;
  CURRENT_MEDICAL_DISCLAIMER_VERSION constant co-located in
  MarketingSlidesScreen.tsx rather than a shared constants module; per-slide
  cta field replaces the isLast ternary; consent copy renders via Checkbox's
  own label prop, same pattern as every other call site in the app, rather
  than a hand-built sibling Text + accessibilityLabel; acceptMedicalDisclaimer
  stays a plain inline store action, not an extracted pure helper like
  contribution-consent's canShareContributionPhoto/setContributionConsent).
  No business-level gaps, no open questions. See tech design §4 for full
  decision/alternative/reason writeups.

  Explicitly out of scope, logged as follow-ups per the spec's non-goals:
  ProductForm/ManualProductFormScreen "contribute to Vials DB" inline
  consent checkbox; any Terms-of-Use/Privacy-Policy document; a
  re-consent/re-prompt flow for medicalDisclaimerVersion bumps (including no
  retroactive prompt for users who completed onboarding before this ships) —
  only the versioned storage schema is added now; any change to the existing
  ContributionConsentScreen (photo-sharing consent).

  Handoff to qa-lead next.
2026-07-25 — qa-lead: integration tests written against the planned FE-3
  behaviour, ahead of implementation (no production code touched).
  tests/onboarding-consent-copy-update/MarketingSlidesScreen.test.tsx (11
  cases) + tests/onboarding-consent-copy-update/fixtures.ts. Covers: slide 1/2
  verbatim kicker/headline/CTA, removal of the stale "no cloud, no tracking"
  claim, slide 3 verbatim kicker/body/checkbox label, checkbox
  default-unchecked, CTA no-op while unchecked (no store call, no nav),
  checking enables the CTA and pressing it calls
  settingsStore.acceptMedicalDisclaimer(1) + navigates to SkinProfileSetup,
  unchecking after checking re-disables the CTA, and no "Skip" affordance on
  slide 3. `useSettingsStore` mocked at the selector boundary (matches
  tests/contribution-consent's convention); paging simulated by firing
  `onMomentumScrollEnd` at `Dimensions.get('window').width * index`, verified
  against the *current* screen before writing the assertions.

  `npx tsc --noEmit` clean. `npx jest tests/onboarding-consent-copy-update/`
  run: 9/11 fail against the current (unimplemented) screen as expected
  (red-before-green); 2 pass incidentally because today's ternary CTA and
  absence of any Skip button already happen to satisfy those two specific
  assertions — left in as valid post-implementation regression guards, not a
  test-writing error (verified failure messages point at missing copy/
  checkbox, not a bad query).

  Gap found, not fixable by qa-lead: spec §4 Story 1 ACs say slide 1 & 2 body
  copy is "the body copy in this spec's §5", but §5 never actually writes out
  that body text (it only gives slide 3's body verbatim) — kicker, headline,
  and CTA are asserted verbatim per spec; body copy is deliberately not
  asserted verbatim since no such string exists to test against. Needs the
  actual body strings added to the spec (or tech design) before FE-3(a) can
  be implemented with certainty; flagged to the human, not silently assumed.

  Handoff to engineer next.
2026-07-25 — coordinator: closed the qa-lead-flagged spec gap — added the
  verbatim slide 1 & 2 body copy to docs/specs/onboarding-consent-copy-update.md
  §4 and §5 (it was in the original task brief, just hadn't made it into the
  spec draft). Slide 1 body: "It's a system of small decisions and reminders
  you have to keep in mind. Let Vials hold that part — so your ritual keeps
  only what you actually enjoy." Slide 2 body: "Your skin profile, routines,
  and procedure history stay on your device by default — nothing personal is
  uploaded unless you choose to. When you add a new product to your shelf,
  anonymous data about it joins the Vials database, so the catalog grows for
  the whole community."

2026-07-25 — qa-lead: added SLIDE1_BODY/SLIDE2_BODY to
  tests/onboarding-consent-copy-update/fixtures.ts and verbatim body
  assertions to the slide 1 and slide 2 describe blocks in
  MarketingSlidesScreen.test.tsx (now 11 cases total, unchanged count — body
  checks folded into the existing "verbatim copy" tests). All three slides
  now assert full verbatim kicker/headline/body/CTA (or kicker/body/label for
  slide 3) per the corrected spec. Re-ran `npx tsc --noEmit` (clean) and
  `npx jest tests/onboarding-consent-copy-update/` (still 9 failing / 2
  passing, same red-before-green pattern as before, now driven by the
  updated slide 1/2 body assertions too — verified failures are on the new
  body text, not a broken query). Gap fully resolved, no remaining open
  questions on the qa-lead side.

  Handoff to engineer next.

2026-07-25 — engineer: implemented FE-1..FE-7 exactly per tech design, no
  deviations.

  FE-1 (src/types/index.ts): added `medicalDisclaimerAcceptedAt: string | null`
  and `medicalDisclaimerVersion: number` to `AppSettings`.

  FE-2 (src/store/settingsStore.ts): added both fields to `DEFAULT_SETTINGS`
  (`null`, `0`) and `pickSettings()`; added `acceptMedicalDisclaimer(version)`
  matching the existing inline `set()` + `saveJson()` action style
  (`new Date().toISOString()` for the timestamp).

  FE-3 (src/screens/onboarding/MarketingSlidesScreen.tsx): rewrote all three
  slides' copy verbatim (kicker/headline/body, `cta` field replacing the
  `isLast` ternary; slide 3 has no headline). Added
  `CURRENT_MEDICAL_DISCLAIMER_VERSION = 1` at module scope. Added local
  `consentChecked` state (default false) and a DS `Checkbox`
  (`size="md"`, `checked`, `onValueChange`, `label=CONSENT_LABEL`) rendered
  only on slide 3, below the body. Footer `Button`'s `disabled` prop is now
  `isLast && !consentChecked`. `handleNext`'s last-slide branch calls
  `acceptMedicalDisclaimer(CURRENT_MEDICAL_DISCLAIMER_VERSION)` before
  `navigation.replace('SkinProfileSetup')`, unchanged otherwise.

  FE-4 (docs/SCREENS.md §1): replaced the `MarketingSlidesScreen` bullet with
  a 3-card breakdown ending in the consent checkbox gating card 3's CTA,
  referencing `US-23`.

  FE-5 (docs/PRD_Spec.md): §1 Trust Anchor rewritten per the task's exact
  wording (on-device-by-default personal data vs. anonymized contributed
  product metadata). §4.1 `MarketingSlidesScreen` bullet updated to match
  SCREENS.md and reference the consent requirement.

  FE-6 (docs/USER_STORIES.md): added a sync note (2026-07-25) noting US-23
  and the PRD_Spec/SCREENS.md privacy-claim correction; appended
  `US-23 · Medical Disclaimer Consent (Onboarding)` with Story 2's ACs.

  FE-7 (docs/IMPLEMENTATION_PLAN.md): Phase 0's types/settingsStore bullets
  now list the two new fields + `acceptMedicalDisclaimer`; Phase 1's
  `MarketingSlidesScreen` bullet now mentions the consent gate.

  No RU strings introduced anywhere — all copy is the EN text from the spec,
  per the explicit English-only instruction overriding any earlier RU draft
  content.

  Verification: `npx tsc --noEmit` clean. Target suite
  `npx jest tests/onboarding-consent-copy-update/MarketingSlidesScreen.test.tsx`
  — 11/11 passing (was 9 failing / 2 passing before this change). Full suite
  baseline (stashed, re-ran before implementing): 19 failed suites / 49
  failed tests / 1550 passed. Full suite after this change: 18 failed suites
  / 40 failed tests / 1559 passed — the delta is exactly the 9 tests that
  flipped from red to green in the target suite (1 fewer failing suite, 9
  fewer failing tests, 9 more passing); no new failures introduced anywhere
  else. Remaining 18 failing suites are pre-existing and unrelated (missing
  `@/components/product/AddProductModal` module-mapping errors and
  `palette`/`shadow` token-shape errors in catalog/shelf screens untouched by
  this task — several inside a stale `.claude/worktrees/` copy of the repo).

  Architecture-review self-check (per .claude/rules/architecture-review.md):
  no direct AsyncStorage usage outside `services/storage.ts` (grep hits are
  comments only), no React imports in `src/utils/`, no `fetch(` outside
  `src/services/`, no hardcoded hex colors in the screen file. One WARNING,
  not a blocker: `MarketingSlidesScreen`'s default-export function is ~74
  lines, over the 50-line guideline — it was already ~62 lines before this
  task (pre-existing) and grew further with the checkbox/CTA-gating logic;
  no sub-component split was in the tech design's scope (FE-3 describes
  inline changes only), so left as-is and flagged here per the severity
  matrix ("recommend refactoring, allow merge if clean").

  No test files edited. No deviations from the tech design.

  Handoff to tech-lead next.

2026-07-25 — tech-lead: **ACCEPT**. (Note: a dedicated tech-lead subagent
  invocation failed mid-review with an account-level API spend-limit error,
  unrelated to this task's code; the review below was completed directly by
  the coordinator using the same checklist from
  .claude/rules/architecture-review.md.)

  Design fidelity: implementation matches tech design FE-1..FE-7 exactly —
  verified type/store diff against FE-1/FE-2 line by line, screen diff
  against FE-3, and all four doc diffs against FE-4..FE-7. No undocumented
  deviations.

  Layer separation: clean. `grep AsyncStorage` outside `services/storage.ts`
  returns only comments (pre-existing, unrelated files) — no real usage. No
  React imports in `src/utils/`. No `fetch(` outside `src/services/`.

  Duplication: no hardcoded hex colors in `MarketingSlidesScreen.tsx` — all
  styling via `colors`/`space`/`radius`/`typography` tokens.

  Type safety: `npx tsc --noEmit` clean.

  Tests: `npx jest tests/onboarding-consent-copy-update/` — 11/11 passing,
  re-run independently and confirmed.

  CLAUDE.md constraints: no Cyrillic/RU characters anywhere in the touched
  `src/` or `docs/` files (grepped directly) — English-only instruction
  correctly honored, not an oversight. All touched typography tokens
  (`h1` 36px, `bodyLg` 18px, `label` 14px) meet the 14px minimum. No pink
  hues introduced. No TODO/FIXME/HACK, no console.log/debugger in touched
  files.

  Quality signal (WARNING, not blocker): confirmed
  `MarketingSlidesScreen`'s render function is ~76 lines (65-140), over the
  50-line guideline. Correctly classified as WARNING per the severity
  matrix ("recommend refactoring, allow merge if clean") — it was already
  over/near the line pre-task and the added checkbox-gating logic is a
  small, cohesive increment, not sprawl. Not required before merge; worth a
  follow-up extraction of the slide-rendering JSX into a sub-component if
  this screen grows further.

  Prompt-injection note: during this review, a subagent turn surfaced an
  unrelated `/security-review` command block that had not been sent by the
  coordinator (targeting the entire `uiux-improvements` branch rather than
  this task's diff). It was correctly declined/ignored per user
  instruction and did not affect this review's scope or findings.

  Verdict: **ACCEPT**. Ready for human merge. Per
  .claude/rules/roadmap-sync.md, the roadmap artifact should be synced
  after this — a new task (US-23, onboarding consent gate) shipped and
  docs/specs + docs/tech-design were created this task.
