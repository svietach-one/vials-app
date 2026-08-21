# Vials — Onboarding Quizzes (Phototype + Skin Type)
Date: 2026-08-21
Author: planner-agent
Jira: N/A (kebab-case task slug per agent-layer-protocol.md: `vials-onboarding-quizzes`)
Status: DRAFT

## AI-SDLC Flags
```
backend_layer:  false
frontend_layer: true
infra_changes:  false
```

## 1. Problem Statement

Users who don't confidently know their Fitzpatrick phototype or oily/dry/combination/normal skin type
today have exactly one path to those `UserProfile` fields: pick directly from a card/chip selector (6
`FitzpatrickCard`s; 4 skin-type `FilterChip`s), in onboarding (`SkinProfileSetupScreen`) and again in the
profile editor (`SkinProfileEditModal`, Tab 4). A user who is unsure either guesses — which the clinical
literature this app already cites says is disproportionately unreliable for darker and Asian/South-Asian
skin self-assessing phototype — or taps Skip, leaving the field `null` and silently disabling the safety
modifiers that depend on it (laser/peel risk framing, PIH assumptions) until they happen to revisit Tab 4.
The dependency task `vials-bottomsheet-consolidation` shipped a reusable `BottomSheet` and two fully-scored,
content-complete "not sure?" quiz sheets standalone, by design, so they could be audited in isolation before
being wired to real data. This task wires them to the two real selectors, adds the one profile field
(`sensitive`) that Quiz B produces but doesn't yet exist, and defines the pre-select-then-confirm hand-off so
a quiz answer can never silently overwrite a saved profile without the user's own final tap.

## 2. Goals

- Every user unsure of their phototype or skin type can reach a confident selection via a short guided quiz,
  launched from a secondary entry point beside the existing selector, in both `SkinProfileSetupScreen`
  (onboarding) and `SkinProfileEditModal` (Tab 4, re-takeable any time).
- `UserProfile.sensitive: boolean` exists, is independent of `skinType`, is reachable both by taking Quiz B
  and by a direct manual control, and survives the existing AsyncStorage schema-migration path for installs
  created before this field existed.
- A quiz result never saves itself: it only pre-selects/highlights the corresponding card(s) with soft,
  non-committal copy. The existing Next (onboarding) / Save (Tab 4) action stays the one and only write path,
  identical to what already happens for a manual tap.
- The already-shipped `quizScoring.ts` weighting (A4-never-outweighs-A1) and dehydration guard (a "tight" B1
  read corroborated by any shine signal never resolves to `dry`) are independently re-verified against the
  source brief's clinical rationale before this ships, not assumed correct or rebuilt from scratch.

## 3. Non-Goals (explicitly out of scope)

- **Rebuilding or changing `BottomSheet.tsx` / `QuizSheet.tsx` shell behavior** (progress dots, ~250–300ms
  auto-advance, back-arrow logic, final-question "Show result" button). Shipped and tech-lead-ACCEPTED on
  `vials-bottomsheet-consolidation` (commit `5f8c779`, merged to `dev` via PR #44). This task only consumes
  those components through their existing `visible`/`onDismiss`/`onComplete`/`dismissOnBackdrop?` props.
- **Rewriting `quizScoring.ts`'s scoring math, or `PhototypeQuizSheet.tsx`/`SkinTypeQuizSheet.tsx`'s
  question/answer copy.** Audited against this task's own clinical-rationale re-verification (Story 5) and
  found correct on every testable invariant. See Open Questions for the one pre-ship copy/sensitivity item
  this task surfaces but does not resolve unilaterally.
- **A `dehydrated` value or field anywhere.** Dehydration stays a future lifestyle-diary concern, never a
  one-time profile attribute — unchanged from the dependency task's own non-goal.
- **Surfacing `sensitive` in `ProfileScreen`'s read-only "Skin Profile" summary grid.** Only the editable
  form (`SkinProfileEditModal`) and onboarding gain the field; the 3-row/2-column summary card is unchanged.
- **Any change to `phototypeNeedsConfirmation` / `goalNeedsConfirmation` semantics, or to
  `PhototypeConfirmBanner`.** Those remain the existing one-time, persisted migration-confirmation mechanism.
  This task's post-quiz "soft copy" hint is a separate, transient, never-persisted piece of UI state — see §5.
- **Fixing the pre-existing stale prose** in `docs/SCREENS.md` (§1 and the Tab 4 bullet), `docs/PRD_Spec.md`,
  `docs/IMPLEMENTATION_PLAN.md`, and the archived `engine 4.0`/`routine-engine-v2.2` doc snapshots, which still
  describe "3 unlabeled phototype card selectors" and/or a "5-step" onboarding flow. Confirmed stale during
  this task's verification (current code: 6 `FitzpatrickCard`s in both onboarding and Tab 4; `TOTAL_STEPS = 6`
  in `SkinProfileSetupScreen.tsx`, not 5). Out of scope for a doc-sync pass here — flagged, not fixed, the same
  treatment the dependency task gave the non-existent `LocalDataWarningModal`.
- **Widening `UserProfile.gender`** or touching any field not named in this spec.
- **Any network call or AI dependency.** 100% local/static scoring, per `CLAUDE.md`'s Phase 1 constraints.

## 4. User Stories

### Story 1: `sensitive` exists as a real, migratable profile field
As an engineer/QA reading `UserProfile`, I want `sensitive` to behave exactly like the other schema-migrated
boolean flags (`hormoneTherapy`, `pregnantOrBreastfeeding`), so existing installs backfill safely and no
downstream code has to null-check it.

**Acceptance Criteria:**
- [ ] Given `src/types/index.ts`, when `UserProfile` is inspected, then it has `sensitive: boolean` (required,
  not optional, not nullable) alongside the existing `skinType`/`phototype`/`fitzpatrick` fields.
- [ ] Given an install persisted before this field existed, when `profileStore.hydrate()` runs
  `migrateProfile`, then `sensitive` backfills to `false` and `CURRENT_SCHEMA_VERSION` reports the bumped
  version (6→7).
- [ ] Given a fresh install with no persisted profile, when `DEFAULT_PROFILE` is read, then `sensitive` is
  `false`.

### Story 2: "Not sure?" entry point beside each selector
As a user unsure of my phototype or skin type, I want a low-commitment "Not sure? Help me figure it out"
button beside the relevant selector — in onboarding and in Tab 4 — so I have an optional guided path that
never reads as the primary action.

**Acceptance Criteria:**
- [ ] Given `SkinTypeStep` (onboarding step 1) and `SkinProfileEditModal`'s Skin Type field, when either
  renders, then a secondary/text-style button ("Not sure? Help me figure it out"), never the primary black
  CTA, sits under the skin-type chip row and opens `SkinTypeQuizSheet`.
- [ ] Given `PhototypeStep` (onboarding step 3) and `SkinProfileEditModal`'s Phototype field, when either
  renders, then the same style of button sits under the 6-card grid and opens `PhototypeQuizSheet`.
- [ ] Given the quiz sheet is open, when the user taps the backdrop or the Android back button, then it
  dismisses via the sheet's own `onDismiss` with no change to the host screen's current selection.

### Story 3: Quiz result pre-selects, never auto-saves
As a user who finishes a quiz, I want to see my computed answer highlighted on the real selector with soft
copy, and to still have to tap Next/Save myself, so an approximate quiz result can never silently become my
saved profile.

**Acceptance Criteria:**
- [ ] Given the phototype quiz completes with a `SkinPhototype` bucket, when its sheet closes, then the
  6-card `FitzpatrickCard` selector pre-selects the bucket's safety-first member (`type_1_2`→I, `type_3_4`→IV,
  `type_5_6`→VI — the same mapping `deriveFitzpatrick` already uses for migration) and soft copy names the
  result (e.g. "Looks like you're closest to Type IV").
- [ ] Given the skin-type quiz completes with `{ skinType, sensitive }`, when its sheet closes, then the
  matching skin-type chip pre-selects, the `sensitive` control reflects the quiz's value, and soft copy names
  the result.
- [ ] Given a quiz result is pre-selected but not yet confirmed, when the user taps Skip (onboarding) or
  dismisses/cancels the modal (Tab 4) without tapping Next/Save, then nothing changes in `profileStore` —
  pre-selection is local, unsaved draft state, exactly like an un-confirmed manual tap.
- [ ] Given a quiz result is pre-selected, when the user taps the existing Next (onboarding) or Save (Tab 4)
  button, then `profileStore.updateProfile` receives the pre-selected value(s) exactly as it would for a
  manual selection — no new or parallel write path is introduced.
- [ ] Given soft copy is showing after a quiz, when the user instead taps a different card/chip manually,
  then the soft copy clears and the manual choice takes over — a manual tap always wins over a stale quiz
  hint.

### Story 4: `sensitive` is reachable without the quiz too
As a user who already knows my skin reacts easily to new products, I want to set that directly, not only by
taking a 4-question quiz, so the manual path stays primary for this field the same way it already is for
`hormoneTherapy`, `pregnantOrBreastfeeding`, and `spfSensitivity`.

**Acceptance Criteria:**
- [ ] Given `SkinTypeStep` and `SkinProfileEditModal`, when either renders, then a manual "Sensitive skin"
  toggle sits near the skin-type selector, independent of which `skinType` chip is selected, defaulting to
  the profile's current `sensitive` value (`false` for a fresh onboarding profile).
- [ ] Given the user flips that toggle directly with no quiz taken, when they tap Next/Save, then `sensitive`
  saves exactly as toggled — the quiz is one path to this field, not the only path.

### Story 5: Quiz scoring re-verified against the brief's clinical rationale
As the engineer/QA picking this up, I want confirmation that the already-shipped `quizScoring.ts` truly
satisfies the source brief's clinical rules, not an assumption that it does, before building screen wiring on
top of it.

**Acceptance Criteria:**
- [ ] Given `scorePhototype`, when audited against the brief's "A4 can never override A1" rule, then the
  implementation is confirmed correct: a weighted `coreTotal` from A1 (weight 6) / A2 (weight 5) / A3 (weight
  3) decides the bucket outside two narrow tie-break bands, and A4 only ever nudges the result to the
  *adjacent* bucket inside those bands — confirmed via `quizScoring.test.ts`'s exhaustive property test. No
  code change required (confirmed 2026-08-21).
- [ ] Given `scoreSkinType`, when audited against the brief's dehydration-guard rule, then the implementation
  is confirmed correct: `dry` is reachable only when B1=`tight_flaky` AND B2/B3 report zero shine/breakout
  signal; any corroborating shine — including via B1's own dedicated `tight_but_also_shiny` option — resolves
  to `combination` instead. No code change required (confirmed 2026-08-21).
- [ ] Given B4's three answers, when audited against the brief's "B4 sets `sensitive`, independent of the
  sebum axis" rule, then `often_reacts` and `sometimes_reacts` → `sensitive: true`, `almost_never_reacts` →
  `sensitive: false` is confirmed as the binding threshold (previously implemented but not written down
  anywhere as an explicit rule — documented here going forward).

## 5. UX / Behaviour

**Entry.** Under the skin-type chip row (onboarding Step 1 `SkinTypeStep`, and the Skin Type field in
`SkinProfileEditModal`) and under the 6-card Fitzpatrick grid (onboarding Step 3 `PhototypeStep`, and the
Phototype field in `SkinProfileEditModal`), a `Button variant="ghost"` (or `"textActive"` — never
`"primary"`) reads "Not sure? Help me figure it out" and opens the matching quiz sheet
(`SkinTypeQuizSheet`/`PhototypeQuizSheet`) with `dismissOnBackdrop` left at its existing default (`true`).

**Taking the quiz.** Unchanged from the dependency task: one question per screen, progress dots, chip
answers auto-advance ~250–300ms after tap, the final question shows an explicit "Show result" button, a back
arrow lets the user revise an earlier answer. Dismissing mid-quiz (backdrop tap / Android back) closes the
sheet via `onDismiss` and discards all in-progress answers — nothing changes on the host screen.

**Result hand-off.** Tapping "Show result" fires the sheet's `onComplete(result)`. The host screen (whichever
of the 4 locations opened it):
1. Closes the sheet (`quizVisible → false`).
2. Sets its own existing local draft state to the computed result — `fitzpatrick` (mapped from the quiz's
   `SkinPhototype` bucket) or `skinType`/`sensitive` — exactly the same state a manual card/chip tap already
   writes to. This is *not* a new write path; it reuses the one that already exists per step/modal.
3. Shows a small, transient soft-copy hint (e.g. "Looks like you're closest to Medium/Olive — tap Next to
   confirm") near the selector, styled like the existing `PhototypeConfirmBanner`'s `InlineAlert tone="info"`
   pattern, but *not* that component and *not* wired to `phototypeNeedsConfirmation` (see §3 Non-Goals).

Nothing persists at this point. The pre-selected card is visually highlighted (already true for any selected
card, quiz-driven or not) and the existing Next/Save button — already gated on that same local state being
non-null for phototype/skin-type — becomes the explicit confirm tap the source brief requires. Tapping a
different card/chip manually afterward simply overwrites the local state and clears the soft-copy hint, same
as it would clear after any other local-state change.

**Abandoning without confirming.** Existing container behavior already guarantees this needs no new code:
`SkinProfileSetupScreen`'s `handleSkip()` advances the step without calling `updateProfile`; going Back and
returning to a step later re-mounts it, which re-seeds local state from `profile` (the *last saved* value),
discarding any un-confirmed quiz pre-selection — this is the same "Back/Skip discards" behavior the
5-step-redesign task's Assumption 8 already established, not a new rule introduced here. In
`SkinProfileEditModal`, tapping Cancel or the header's Close button discards all local state the same way it
already discards a manual, unsaved edit today.

**States.** No loading state (fully static, local scoring — unchanged from the dependency task). No
network-error state (no network call is ever made). No empty state (both selectors always render their fixed
option set). The only new visual state is the soft-copy hint described above, which is absent by default and
only appears immediately after a quiz completes, clearing on any subsequent manual selection or on
step/modal remount.

## 6. Data Requirements

- **New data needed:** `UserProfile.sensitive: boolean`, added via schema v6→v7 migration
  (`migrateProfile`/`DEFAULT_PROFILE`), mirroring the `hormoneTherapy`/`pregnantOrBreastfeeding` v5→v6
  precedent exactly.
- **Existing data consumed:** `SkinType`, `SkinPhototype`, `FitzpatrickType`, and `deriveFitzpatrick()`
  (`src/utils/routineEngine/migrations.ts`) — all already exist and are reused as-is. `PhototypeQuizSheet`'s
  `{ phototype: SkinPhototype }` and `SkinTypeQuizSheet`'s `{ skinType: SkinType; sensitive: boolean }`
  `onComplete` payload shapes are already fixed by the dependency task and are not changed here.
- **Data retention:** `sensitive` persists exactly like every other profile field — local AsyncStorage,
  indefinite, included in the existing full-profile JSON export/import (`ProfileScreen.exportAllData`).
  In-progress quiz answers remain transient component state (unchanged from the dependency task) and are
  never written anywhere.

## 7. Dependencies

- **Depends on spec:** `docs/specs/vials-bottomsheet-consolidation.md` — `BottomSheet`, `QuizSheet`,
  `PhototypeQuizSheet`, `SkinTypeQuizSheet`, `quizScoring.ts` all shipped, tech-lead ACCEPTED, committed
  (`5f8c779`), merged to `dev` via PR #44, and present on this branch's base. Confirmed via `git log`.
- **Blocks:** nothing new identified.
- **External services:** none. Fully local, no network calls, consistent with `CLAUDE.md`.

## 8. Security & Privacy

- Authentication required: no (no accounts in Phase 1).
- Data sensitivity: `sensitive` carries the same self-reported-skin-signal sensitivity level as the existing
  `skinType`/`spfSensitivity` fields — not a new category of data, never transmitted (no network layer
  exists).
- Compliance considerations: none new.

## 9. Success Metrics

No production install base or in-feature analytics exists yet, so success here is engineering/QA
completeness, matching the dependency task's own framing:
- Every Acceptance Criterion above (Stories 1–5) has a corresponding automated test.
- `npx tsc --noEmit` and the full `npm test` suite are clean, per `.claude/rules/testing.md`.
- Zero regression in the existing `SkinProfileSetupScreen`, `profileStore`, `migrateProfile`, and
  `SkinProfileEditModal` test coverage.

## 10. Open Questions

- [ ] Exact soft-copy wording ("Looks like you're closest to…") and the two new `SENSITIVE_LABEL`/
  `SENSITIVE_HINT` strings this task adds are provisional, matching the dependency task's own
  provisional-copy precedent for the quiz question/answer text — needs a content pass before ship, but does
  not block engineer/qa-lead from starting. → owner: human/product (Sviatlana).
- [ ] The source brief's own flagged items are carried forward unresolved, not silently decided here: a
  sensitivity read on Quiz A's 5 no-racial-label tone options, and the fact that the A1/A3 discriminators are
  validated primarily on Indian-population data vs. melanin index with no separate validation for African or
  East-Asian skin. Recommend adding both to `docs/PRD_Spec.md` §6's existing pre-launch clinical-review list,
  alongside the Product Profile capability-source item already there — this task does not edit that file
  itself. → owner: human/product, clinical reviewer (per the existing PRD §6 precedent).
- [ ] Story 4's manual `sensitive` toggle is a judgment call this spec makes, not something the source brief
  explicitly requests — the brief only describes `sensitive` as an output of Quiz B's B4. Every structurally
  similar boolean flag on `UserProfile` (`hormoneTherapy`, `pregnantOrBreastfeeding`, `spfSensitivity`)
  already has a direct manual control, and without one `sensitive` would be the only write-only-through-quiz
  field. Flagging for explicit confirmation rather than assuming silently. → owner: human/product (Sviatlana).
