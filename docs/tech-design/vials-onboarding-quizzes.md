# Technical Design: Onboarding Quizzes (Phototype + Skin Type)
Spec: docs/specs/vials-onboarding-quizzes.md
Author: planner-agent
Date: 2026-08-21

## AI-SDLC Flags
```
backend_layer:  false
frontend_layer: true
infra_changes:  false
```

## 1. Architecture Overview

Two existing screens (`SkinProfileSetupScreen`'s `SkinTypeStep`/`PhototypeStep`, and
`SkinProfileEditModal`) each gain a quiz-sheet-visibility flag and a soft-copy flag as local `useState`, plus
one field (`sensitive`) added to state each already has. No new store, no new screen, no navigator change.
`onComplete` never calls `updateProfile` directly — it only writes to the same local draft state a manual
card/chip tap already writes to, so the existing Next/Save button remains the sole persist path (spec §5).

```
"Not sure?" tap ─> quizVisible=true ─> PhototypeQuizSheet | SkinTypeQuizSheet (unchanged, dependency task)
                                              │ onComplete(result)
                                              v
                 host's own local draft state (fitzpatrick | skinType+sensitive) + soft-copy flag
                                              │ existing Next / Save tap (unchanged code path)
                                              v
                                  profileStore.updateProfile ──> AsyncStorage (via migrateProfile v7)
```

`sensitive` flows through the standard migration path: `UserProfile` → `DEFAULT_PROFILE` →
`migrateProfile` (schema v6→v7 backfill) — the identical shape already used twice for
`hormoneTherapy`/`pregnantOrBreastfeeding` (schema v5→v6, `docs/tech-design/onboarding-5-step-redesign.md`
Assumption 5).

## 2. API Contracts

N/A — no backend/API layer exists (Phase 1 is local-only storage, `CLAUDE.md`). The closest analogous
contracts are the `UserProfile.sensitive` field addition (§3 FE-1) and the two quiz sheets' `onComplete`
payload shapes, both already fixed by the dependency task and unchanged here:
`PhototypeQuizSheet.onComplete({ phototype: SkinPhototype })`,
`SkinTypeQuizSheet.onComplete({ skinType: SkinType; sensitive: boolean })`.

## 3. Implementation Tasks

### engineer (scope=backend)
N/A — no backend layer in Phase 1 (`CLAUDE.md`).

### engineer (scope=frontend)
- FE-1: Add `sensitive: boolean` to `UserProfile` (`src/types/index.ts`, after `spfSensitivity`), docstring
  analogous to `hormoneTherapy`/`pregnantOrBreastfeeding`. (The `isPhysicalExfoliant` docstring at ~line 396
  already forward-references "the `sensitive` profile flag" — this closes that reference.)
- FE-2: `src/utils/routineEngine/migrations.ts` — bump `CURRENT_SCHEMA_VERSION` 6→7; add a
  `sensitivePresent` check to `migrateProfile`'s guard clause and backfill `sensitive: false`, mirroring the
  `hormoneTherapyPresent`/`pregnantOrBreastfeedingPresent` branches exactly. Update
  `migrations.test.ts`'s `CURRENT_SCHEMA_VERSION` assertion (currently `.toBe(6)`) and add a backfill-branch
  test case, co-located per `.claude/rules/testing.md`.
- FE-3: `src/store/profileStore.ts` — add `sensitive: false` to `DEFAULT_PROFILE`.
- FE-4: `src/constants/labels.ts` — add `SENSITIVE_LABEL`/`SENSITIVE_HINT` (provisional copy, spec Open
  Questions), mirroring `HORMONE_THERAPY_LABEL`/`HINT`. Hoist `FITZPATRICK_DESCRIPTIONS`
  (currently local to `PhototypeStep.tsx`) into `labels.ts` alongside `SKIN_TYPE_OPTIONS`, so both onboarding
  and Tab 4 can build identical soft-copy text without duplicating/drifting the 6-entry map; update
  `PhototypeStep.tsx`'s import accordingly.
- FE-5: `src/screens/onboarding/steps/SkinTypeStep.tsx` — add `initialSensitive: boolean` prop; local
  `sensitive` state; a `ListRow`+`Switch` row (mirrors `AboutYouStep`'s hormone-therapy row) using
  `SENSITIVE_LABEL`/`HINT`, below the chip row; a `Button variant="ghost"` "Not sure? Help me figure it out"
  under the chip row opening `SkinTypeQuizSheet`; `onComplete({skinType, sensitive})` sets local
  `skinType`/`sensitive` plus a local soft-copy string — never calls `onNext`. Any manual chip/switch change
  clears the soft-copy string. `onNext`'s patch gains `sensitive`.
- FE-6: `src/screens/onboarding/steps/PhototypeStep.tsx` — same shape as FE-5: local quiz-visible state, "Not
  sure?" button under the 6-card grid, `onComplete({phototype})` sets local `fitzpatrick` via
  `deriveFitzpatrick(phototype)` (imported from `@/utils/routineEngine/migrations`) plus a local soft-copy
  string built from `FITZPATRICK_DESCRIPTIONS[fitzpatrick]` (FE-4). Manual card tap clears the soft-copy
  string.
- FE-7: `src/screens/onboarding/SkinProfileSetupScreen.tsx` — pass `initialSensitive={profile?.sensitive ??
  false}` into `SkinTypeStep`.
- FE-8: `src/components/profile/SkinProfileEditModal.tsx` — pre-fill local `sensitive` state from
  `profile?.sensitive` in the existing pre-fill `useEffect`; add the same `ListRow`+`Switch` row near the Skin
  Type field; add "Not sure?" buttons for both the Skin Type and Phototype fields, wired the same way as
  FE-5/FE-6 (local state + soft copy only, no direct save); `handleSave`'s patch gains `sensitive`.

### devops-lead
N/A — `infra_changes: false`.

### engineer (unit tests, both scopes)
- FE-2 ships its own co-located `migrations.test.ts` case (schema bump, backfill-to-`false`, idempotency on
  an already-migrated profile), per `.claude/rules/testing.md`.
- Screen-level behavior for FE-5/6/8 (Not-sure button opens the correct sheet, `onComplete` pre-selects
  without saving, Skip/Cancel/Back discards, Next/Save persists, manual selection clears the soft-copy hint,
  manual `sensitive` toggle works with no quiz taken) is qa-lead's `tests/vials-onboarding-quizzes/`
  integration scope per `testing.md`'s layer split — not enumerated here.

## 4. Assumptions

- `sensitive` ships as a required, non-optional `boolean`, added via a full schema migration (v6→v7) rather
  than left bare-optional.
  Alternative: ship `sensitive?: boolean`, matching lighter-weight optional fields like `Product.isHidden`.
  Reason: identical precedent already used twice for `hormoneTherapy`/`pregnantOrBreastfeeding` — a
  guaranteed boolean is safer for the future conflict-engine consumer this field is explicitly meant to feed.
- Quiz result hand-off writes only to each host's pre-existing local draft state; `onComplete` never calls
  `updateProfile`/`onNext`/`handleSave` itself.
  Alternative: have `onComplete` persist immediately.
  Reason: this is the literal requirement of spec Story 3 / brief rule 7 ("nothing saves without an explicit
  final confirm tap"); the existing Next/Save buttons are already gated on this same local state, so reusing
  them costs no new code and guarantees quiz-driven and manual selections share one already-tested write path.
- Phototype's 3-bucket quiz result maps to one pre-selected `FitzpatrickCard` via the existing
  `deriveFitzpatrick()` helper (`type_1_2`→I, `type_3_4`→IV, `type_5_6`→VI).
  Alternative: leave every card in the matched bucket unhighlighted, or write a second mapping function.
  Reason: `deriveFitzpatrick` already solves exactly this bucket→member problem for migration and is
  documented as the intentional "safety-first default... user can refine it" — the same framing this task's
  pre-select-then-confirm design relies on; a second mapping would duplicate existing logic.
- A manual "Sensitive skin" `Switch` ships alongside the quiz entry point, not only reachable via the quiz.
  Alternative: gate `sensitive` exclusively behind `SkinTypeQuizSheet`.
  Reason: every structurally similar boolean flag (`hormoneTherapy`, `pregnantOrBreastfeeding`,
  `spfSensitivity`) already has a direct manual control; flagged for explicit human confirmation in spec Open
  Questions since the source brief never states this itself.
- The soft-copy hint is new, transient, per-host local UI state — not wired to `phototypeNeedsConfirmation` /
  `goalNeedsConfirmation` or `PhototypeConfirmBanner`.
  Alternative: reuse `phototypeNeedsConfirmation` to also drive the post-quiz hint.
  Reason: that flag has a distinct, already-shipped, persisted meaning (one-time migration-confirmation nag);
  overloading it would make its existing consumer (`PhototypeConfirmBanner` in Routines) behave
  unpredictably. `SkinProfileEditModal.handleSave` already unconditionally sets
  `phototypeNeedsConfirmation: false` on every save regardless of source, so no regression exists either way.
- `quizScoring.ts`'s existing weights and both quiz sheets' existing question/answer copy are kept verbatim —
  no code change.
  Alternative: rewrite scoring or copy to "finalize" it per the brief's own "Open items" list.
  Reason: audited against the brief's clinical rationale (spec Story 5) and found correct on every testable
  invariant (A4-never-outweighs-A1 exhaustively property-tested; dehydration guard covered by 3 dedicated
  tests; B4→`sensitive` threshold now documented as intentional). The remaining brief items (racial-
  sensitivity read on A1's tone copy, population-validation caveat) are content/clinical-review questions,
  not implementation defects — carried forward as spec Open Questions, not resolved unilaterally here.

## 5. Open Questions

No open questions block Implementation Tasks FE-1 through FE-8. See spec §10 for the three non-blocking,
ship-relevant items (copy/sensitivity-read sign-off, manual-`sensitive`-toggle confirmation) that need a
human answer before this ships — not before qa-lead or engineer start.
