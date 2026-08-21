Status: DESIGNED
Tech Design: docs/tech-design/vials-onboarding-quizzes.md
Code: —

## Карточка задачи
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [ ] QA tests (qa-lead)
- [ ] Implementation (engineer)
- [ ] Architecture review (tech-lead)

## Log

2026-08-21 — planner: Read the source brief (`docs/tasks/vials-onboarding-quizzes-task.md`, untracked on
this branch) in full, plus `progress/vials-bottomsheet-consolidation.md` in full (Status: ACCEPTED, PR #44
merged, commit `5f8c779` now on this branch's base — confirmed via `git log`). That log explicitly flagged
several of the source brief's assumptions as stale and instructed re-verification rather than trust. Verified
every one directly against current code before writing anything:

- **`skinType`/`phototype` already exist — confirmed, and the reality is bigger than the brief knew.**
  `src/types/index.ts`: `SkinType` (line 171), `UserProfile.skinType: SkinType | null` (line 214),
  `SkinPhototype` (line 154), `UserProfile.phototype: SkinPhototype | null` (line 220), **plus** a parallel
  `UserProfile.fitzpatrick: FitzpatrickType | null` (line 226, numeric 1–6, schema-v2) with its own sync
  machinery (`deriveFitzpatrick`/`deriveGroupedPhototype`/`syncPhototypeFields` in `migrations.ts`/
  `profileStore.ts`) that the brief's "Type changes" section never mentions at all. Only `sensitive: boolean`
  is genuinely net-new — confirmed by a repo-wide grep (zero matches for a `UserProfile.sensitive` field; the
  only "sensitive" hits are an unrelated clinic `barrierStatus: 'disrupted'|'sensitive'` type, and a
  *forward-referencing* docstring on `Product.isPhysicalExfoliant` that already anticipates "the `sensitive`
  profile flag" as a future addition) — independently corroborated by `docs/specs/vials-bottomsheet-
  consolidation.md` §3/§6, which explicitly names `UserProfile.sensitive` as not-yet-existing and owned by
  this task.
- **"3 grouped phototype cards" is stale — confirmed false in BOTH places, not just onboarding.** Read
  `PhototypeStep.tsx` (onboarding step 3) and `SkinProfileEditModal.tsx` (the actual file behind "Tab 4 /
  `SkinProfileEditor`" — see below): both render 6 individual `FitzpatrickCard`s
  (`src/components/onboarding/PhototypeCard.tsx`), not the grouped 3-card `PhototypeCard` (which still exists
  in the same file but is dead code, unused by either current screen since `onboarding-5-step-redesign`'s
  FE-9). `docs/SCREENS.md`/`PRD_Spec.md`/`IMPLEMENTATION_PLAN.md` and the archived `engine 4.0`/
  `routine-engine-v2.2` doc snapshots still say "3 unlabeled phototype card selectors" for the Tab-4 mention
  specifically — confirmed stale, out of scope to fix here (spec Non-Goals), same treatment as the dependency
  task gave `LocalDataWarningModal`.
- **No shared progress-dots component — confirmed, and moot.** `MarketingSlidesScreen`'s dots
  (`styles.dots`/`dot`/`dotActive`) are local inline styles, not exported. However `QuizSheet.tsx` (already
  shipped by the dependency task) ships its own independent dots implementation
  (`progressRow`/`dot`/`dotActive`) — visually similar, not literally shared, and already built. Nothing left
  for this task to do here.
- **`SkinProfileEditor` is not a component — it's `ProfileScreen.tsx`'s (Tab 4, confirmed 4th
  `Tab.Screen` in `AppNavigator.tsx`) "Skin Profile" card + Edit button, which opens
  `SkinProfileEditModal.tsx`** (a full-screen `pageSheet` `Modal`) — that's the actual file with the skin-type
  chips (line ~145) and Fitzpatrick cards (line ~181) to wire "Not sure?" into. Confirmed by reading both
  files plus grepping every "SkinProfileEditor" reference across `src/`+`docs/`.
- **Bonus staleness beyond what the dependency task flagged:** `SkinProfileSetupScreen.tsx` is a live
  **6-step** flow today (`TOTAL_STEPS = 6`: SkinType→Goals→Phototype→AboutYou→AdditionalInfo→City), not the
  5-step flow `docs/tech-design/onboarding-5-step-redesign.md`/`SCREENS.md`/`PRD_Spec.md` still describe (a
  `CityStep` was added later — see `progress/onboarding-city-step.md`). Used the *real* step numbers
  (SkinTypeStep=1, PhototypeStep=3) when designing; did not perpetuate the stale "5-step" claim.

**Quiz scoring audit against the brief's clinical rationale (`docs/tasks/vials-onboarding-quizzes-task.md`
§Quiz A/B), per the task's explicit instruction to audit rather than re-implement:**
- Read `src/utils/onboardingQuiz/quizScoring.ts` and its `quizScoring.test.ts` in full. Quiz A: exactly 4
  questions (tone/sun-reaction/marks/tanning), no eye/hair-color question, no race/ethnicity labels in any
  `TONE_ANSWERS` copy — confirmed by reading the literal answer label strings in `PhototypeQuizSheet.tsx`.
  Weighting is High/High/Medium/Low (A1=6, A2=5, A3=3, A4=tie-break-only) exactly matching the brief's table;
  A4 can only nudge the result to the *adjacent* bucket inside two narrow bands and has zero effect outside
  them — verified by an exhaustive property test iterating every tone×sunReaction×marks combination across
  all tanning values, confirming the bucket spread A4 alone can produce is never more than 1 band. This is
  **strictly stronger** than the brief's literal minimum bar ("A4 can never override A1"). No defect found.
- Quiz B: exactly 4 questions (B1–B4); B4 sets `sensitive` independent of the sebum axis — confirmed by
  source and dedicated tests. Dehydration guard: `dry` is reachable ONLY when B1=`tight_flaky` AND B2/B3
  report zero shine/breakout signal; any shine corroboration (including via B1's own dedicated
  `tight_but_also_shiny` option) routes to `combination`, never `dry` — matches the brief's described guard
  mechanism exactly (including the brief's own worked example: tight/flaky + T-zone shine → combination, not
  dry — directly covered by a named test). Never emits `dehydrated` — confirmed by source and an explicit
  test. No defect found. One previously-undocumented judgment call found and now written down as binding
  (spec Story 5 AC3): B4's threshold treats both "often reacts" and "sometimes reacts" as `sensitive: true`,
  only "almost never reacts" as `false` — a reasonable single-answer technical read, not a defect.
- **Conclusion: zero implementation tasks against `quizScoring.ts`, `PhototypeQuizSheet.tsx`, or
  `SkinTypeQuizSheet.tsx`.** Per the task's explicit instruction, this is recorded as a verified-correct
  audit finding (spec Story 5, tech design Assumption 6), not silently skipped.

**Real, novel scope for this task** (what the dependency task explicitly left undone): added
`UserProfile.sensitive` via the standard schema-migration path (v6→v7, mirroring the `hormoneTherapy`/
`pregnantOrBreastfeeding` v5→v6 precedent in `docs/tech-design/onboarding-5-step-redesign.md` exactly); "Not
sure?" entry buttons + quiz wiring in `SkinTypeStep.tsx`/`PhototypeStep.tsx` (onboarding) and
`SkinProfileEditModal.tsx` (Tab 4); a pre-select-then-confirm hand-off where `onComplete` only ever touches
each host's own existing local draft state (never calls `updateProfile` directly), so the pre-existing
Next/Save button is the "explicit final confirm tap" the brief's rule 7 requires, with zero new write path;
a `deriveFitzpatrick()`-based mapping (existing helper, reused, not reinvented) from the quiz's 3-bucket
phototype result to one specific pre-selected `FitzpatrickCard`.

**Genuine judgment call flagged, not silently decided:** added a manual "Sensitive skin" `Switch` next to the
quiz entry point (spec Story 4) — the brief only describes `sensitive` as a Quiz-B output, but every
structurally similar boolean flag on `UserProfile` already has a direct manual control, and without one
`sensitive` would be the only write-only-through-quiz field. Flagged in spec §10 Open Questions for explicit
human confirmation.

**Gap classification:** no Type A (business) or Type D (contradiction) gaps found — the ownership boundary
with `vials-bottomsheet-consolidation` was already fully resolved and double-confirmed by the human in that
task's own log before this one started. Every real gap resolved to a Type B assumption backed by direct,
in-repo precedent (schema migration shape, manual-control parity, `deriveFitzpatrick` reuse). Status:
**DESIGNED**, not BLOCKED. Three non-blocking, ship-relevant Open Questions remain (provisional copy,
PRD §6 clinical-review addition, manual-toggle confirmation) — spec Status left at DRAFT until a human
resolves them, matching how `vials-bottomsheet-consolidation`'s spec stayed open until its own two open
questions were answered.

`npx tsc --noEmit` verified clean before starting (no pre-existing errors this task's design could be
mistaken for). No code written — planner scope is spec + tech design only. Proceeding to commit
docs/specs/vials-onboarding-quizzes.md, docs/tech-design/vials-onboarding-quizzes.md, this file, the handoff
JSON, and the previously-untracked `docs/tasks/vials-onboarding-quizzes-task.md` brief itself (same precedent
as `docs/tasks/vials-bottomsheet-consolidation-task.md` being committed alongside that task's planner output
in `5f8c779`). Next: qa-lead, once a human has reviewed the three flagged Open Questions.

2026-08-21 — human requester: resolved the one blocking open question. Story 4's manual "Sensitive skin"
toggle — confirmed as designed: keep the manual control, ships alongside the quiz-driven path, matching
`hormoneTherapy`/`pregnantOrBreastfeeding`/`spfSensitivity` parity. Spec's §10 item checked off, Status
bumped to APPROVED. The other two open questions (provisional soft-copy wording; PRD §6 clinical-review
addition) remain open but are non-blocking/informational per the planner's own classification — do not block
qa-lead or engineer. Proceeding to qa-lead.
