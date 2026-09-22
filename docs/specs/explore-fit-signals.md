# Explore Composition — Personalized Fit Signals
Date: 2026-09-14
Author: planner-agent
Jira: N/A (kebab-case task slugs only — see `.claude/rules/agent-layer-protocol.md` §1)
Status: APPROVED (same-day revision, 2026-09-14: product resolved Open Questions 1-3 below — goal-fit
miss-sentence rendering, two-goal-finding layout, and skin-type nudge scope are all confirmed. Open
Question 4, exact copy wording, remains open with design as owner; `PLACEHOLDER` copy stays in force
until that lands, same pattern `docs/specs/explore-composition.md` used for Story 7.)

## AI-SDLC flags
- `backend_layer`: false — this app is frontend-only (Expo/React Native, local storage, no server
  component owned by this repo), same convention as `docs/specs/explore-composition.md` and
  `docs/tech-design/product-profile-m1.md`.
- `frontend_layer`: true
- `infra_changes`: false

## 1. Problem Statement
Users who scan or paste a product's ingredient list on the Explore Composition result screen
(`ExploreCompositionResultScreen.tsx`, and since Story 9 also `WishlistEntryDetailScreen.tsx`) get an
honest functional breakdown of the composition, but almost nothing that reflects them specifically.
The only personalization on that screen today is `SkinTypeCautionNotice`, and it only ever warns — it
never says whether a composition actually serves the goal the user told Vials they care about
(`profile.primaryGoal`/`secondaryGoal`), and it never distinguishes a user with a self-reported skin
condition (`profile.skinConditions`: eczema / seborrheic dermatitis / rosacea) from one without, even
though condition-specific advisory language for exactly these active-ingredient classes already exists
and ships elsewhere in the app (`skinConditionModifiers.ts`'s `CONDITION_MODIFIERS` table). Reported
directly by the product owner: after scanning a product, a user still cannot tell whether it suits
their own skin or goals.

## 2. Goals
- A user with a stated care goal (`primaryGoal` and/or `secondaryGoal`, excluding the non-null
  `'maintenance'` default) sees a factual, non-scored sentence naming which detected active(s) are
  typically used for that goal, when there is overlap, and an equally honest sentence when there isn't.
- A user with one or more self-reported skin conditions sees the exact condition-specific advisory
  sentence(s) already used elsewhere in this app for any detected active that matches, without the
  existing generic skin-type caution silently disappearing when both signals have something to say.
- A user who has never set a skin type sees a clear, honest nudge toward the existing Profile edit
  entry point rather than a blank space, in exactly the cases that nudge already covers today.
- No invented numbers, scores, percentages, or confidence values are introduced anywhere in this work.

## 3. Non-Goals
- No % match, efficacy/quality score, per-concern percentage, or confidence number — same bar as
  `docs/specs/explore-composition.md` §3; every new sentence names real actives/goals/conditions by
  their real display name only.
- No new call sites into `conflictEngine.ts`. This work reads exactly two static rule tables —
  `actives.json`'s `goals` block (via `goalCoverage.ts`'s already-exported `coverageClasses`) and
  `skinConditionModifiers.ts`'s already-exported `CONDITION_MODIFIERS` advisory templates — never the
  pairwise engine (`detectConflicts`/`getConflictsForProduct`), and never
  `skinConditionModifiers.ts`'s own conflict-wrapping half (`applyConditionSeverityModifiers`/
  `getConditionRiskWarnings`), which is `Product[]`-shaped and irrelevant to a single unsaved
  composition.
- No "set your care goal" or "set your skin conditions" nudge is introduced. The skin-type nudge
  (already shipped — see §10, scope CONFIRMED unchanged 2026-09-14) is documented here, not modified —
  no new UI. `primaryGoal` always has a real, non-null default (`'maintenance'`) unlike `skinType`'s
  true `null`, so an unset goal is not "missing data" the way an unset skin type is.
- No changes to `WishlistEntry`'s persisted shape, `productsStore`, or any other store. Every signal in
  this spec is computed at render time from already-hydrated `profile` fields plus the composition's
  already-resolved active keys — same "no new persisted fields" precedent as Story 6/7/8 of
  `docs/specs/explore-composition.md`.
- No rewording of the existing generic skin-type caution sentence, `CONDITION_MODIFIERS`' advisory
  message text, or `goalCoverage.ts`'s Routines-tab copy. Every new sentence here is either new copy
  scoped to this screen or a verbatim reuse of an existing template string, never an edit to a shipped
  string used elsewhere.

## 4. User Stories

### Story 1: See whether a scanned composition matches my stated care goal
As a user with a stated care goal, I want to see which detected actives (if any) are typically used
for that goal, so I know whether this composition is even relevant to what I'm trying to achieve.

**Acceptance Criteria:**
- [ ] Given `profile.primaryGoal` is set to a real goal (anything other than `'maintenance'`) and at
      least one detected active is typically used for that goal, when the result screen renders, then
      a card names the matching active(s) and the goal by display name, in a factual sentence (no
      score, no percentage).
- [ ] Given both `primaryGoal` and `secondaryGoal` are set to two different real goals, when the result
      screen renders, then both findings are shown in a single `GoalFitCard`, one line per goal —
      CONFIRMED (product, 2026-09-14), mirroring `GoalCoverageBanner`'s existing up-to-two-independent-
      findings layout. Never two separate cards, never one goal silently dropped when the other also
      has a finding.
- [ ] Given `primaryGoal` is `'maintenance'` and `secondaryGoal` is `null`, when the result screen
      renders, then no goal-fit card, placeholder, or nudge renders at all.
- [ ] Given a real goal is set but none of the detected actives are typically used for it, when the
      result screen renders, then a miss sentence renders for that goal — CONFIRMED (product,
      2026-09-14): the miss case SHOWS, matching `goalCoverage.ts`'s "not_owned" tone (a factual
      statement that nothing detected currently addresses the goal, naming the goal by display name).
      Exact wording is `PLACEHOLDER` pending §10 Open Question 4.

### Story 2: See a condition-specific caution instead of (or alongside) the generic skin-type one
As a user with a self-reported skin condition, I want the caution notice to tell me the
condition-specific reason a detected active needs care, not just a generic skin-type sentence, so the
warning is actually useful to me.

**Acceptance Criteria:**
- [ ] Given `profile.skinConditions` includes at least one condition and a detected active's key
      appears in that condition's `CONDITION_MODIFIERS` advisory tags, when the result screen renders,
      then the exact existing advisory message for that (condition, active) pair is shown verbatim — no
      new copy invented.
- [ ] Given the same active also triggers the existing generic skin-type caution (`exfoliating`/
      `photosensitizing`/`irritancy >= 3`), when both are present, then the condition-specific sentence
      is shown for that active and the generic sentence is not repeated for it — but the generic
      sentence still names any OTHER triggering active not covered by a condition-specific line, so no
      fact from either signal is silently dropped.
- [ ] Given a detected active matches a condition advisory tag but does NOT meet the generic skin-type
      trigger (verified real case: azelaic acid under eczema — `actives.json` gives it `irritancy: 2`,
      `exfoliating: false`, `photosensitizing: false`, below the generic threshold), when the result
      screen renders, then the condition-specific sentence still renders on its own — the caution block
      is no longer gated solely on the generic trigger.
- [ ] Given no `skinConditions` are set, when the result screen renders, then behavior is unchanged from
      today (generic caution only, or nothing).

### Story 3: Get nudged to set a skin type when it would unlock a caution
As a user who hasn't set a skin type yet, I want to be told that setting it would show me something
useful, so I'm not left wondering why nothing appeared.

**Acceptance Criteria:**
- [ ] Given `profile.skinType` is `null` and the caution block has a generic-trigger-worthy finding,
      when the result screen renders, then the already-shipped nudge points the user toward the
      Profile screen's skin-type edit entry point — unchanged behavior, verified still correct after
      this task's condition-caution changes (Story 2).
- [ ] Given `profile.skinType` IS set but nothing triggered, when the result screen renders, then no
      card, nudge, or placeholder appears — a distinct, legitimate "nothing to flag" state, never
      conflated with the missing-data nudge above.
- [ ] Given `profile.skinType` is `null` and NOTHING in the composition would trigger a generic or
      condition-specific caution, when the result screen renders, then no nudge, card, or placeholder
      appears either — CONFIRMED (product, 2026-09-14): the nudge's scope stays exactly as already
      shipped (`caution !== null && skinType === null`); it is NOT widened to fire unconditionally on
      `skinType === null` alone. This is a deliberate, confirmed non-change, not an oversight — see §10
      Open Question 3 (resolved).

## 5. UX / Behaviour
Result screen order (both `ExploreCompositionResultScreen.tsx` and `WishlistEntryDetailScreen.tsx`, via
the shared `CompositionInsightsSection.tsx`): Functional profile → Detected actives → Skin-type/
condition caution (now condition-aware) → **new** Goal-fit card → Comparison matrix → Routine placement
→ disclaimer. The goal-fit card sits immediately after the caution block, preserving that block's
already-established "directly after ingredients" position rather than displacing it (see tech design
§4 for the placement assumption).

Goal-fit card: a plain informational card, matching `FunctionalProfileCard`/`DetectedActivesCard`'s
icon-circle-header visual family — this is a fit fact, not a warning, so it does not reuse the caution
block's tinted-alert treatment. Renders nothing at all when no real goal is set; renders one line per
set goal otherwise (match or miss, per Story 1).

Caution block: unchanged position and visual treatment (tinted alert). Gains condition-specific line(s)
per Story 2's precedence rule. The already-shipped skin-type-unset nudge
(`SkinTypeCautionNotice.tsx`, git `9280677`) is documented here, not redesigned — its scope is
CONFIRMED unchanged (§10 Open Question 3, resolved 2026-09-14).

## 6. Data Requirements
- New data needed: none persisted. Every new signal reads already-hydrated `profile.primaryGoal` /
  `profile.secondaryGoal` / `profile.skinConditions` (all already stored on `UserProfile`,
  `src/types/index.ts`) plus the composition's already-resolved `resolvedActiveKeys` (already computed
  by `useCompositionInsights.ts`).
- Existing data consumed: `actives.json`'s `goals` block (via `goalCoverage.ts`'s exported
  `coverageClasses`), `skinConditionModifiers.ts`'s exported `CONDITION_MODIFIERS` table.
- Data retention: N/A — render-time-only computation, nothing written to any store (same convention as
  Story 6/7/8 of `docs/specs/explore-composition.md`).

## 7. Dependencies
- Depends on: `docs/specs/explore-composition.md` / `docs/tech-design/explore-composition.md` — this is
  a continuation of that flow, reusing its `useCompositionInsights.ts` hook and
  `CompositionInsightsSection.tsx` composition point (both already shipped, `PR_REVIEW`/merged per
  `progress/explore-composition.md`).
- Depends on: the already-shipped `SkinTypeCautionNotice.tsx` skin-type-unset nudge (git `9280677`,
  part of an "explore-insights-v2" follow-up round tracked outside this task's own progress file — see
  §10 Open Question 3, resolved 2026-09-14: scope confirmed unchanged).
- Depends on: `goalCoverage.ts`'s exported `coverageClasses`/`GOALS` mapping and
  `skinConditionModifiers.ts`'s exported `CONDITION_MODIFIERS` table, both already shipped and
  unit-tested.
- Blocks: nothing currently planned depends on this shipping first.
- External services: none new.

## 8. Security & Privacy
- Authentication required: no (Phase 1 has no auth layer).
- Data sensitivity: `profile.skinConditions` is self-reported health-adjacent data already stored
  locally for onboarding/routine purposes (the same field `skinConditionModifiers.ts` already reads for
  the Routines tab). This work adds a second local-only read site — never a write, export, or
  transmission.
- Compliance considerations: none beyond the existing local-only storage posture (CLAUDE.md).

## 9. Success Metrics
Phase 1 has no analytics pipeline; success is verified at acceptance time: every AC in §4 passes,
`npx tsc --noEmit` and `npm test` are clean, and the new co-located unit tests
(`goalFit.test.ts`, `conditionCaution.test.ts`) plus the extended
`tests/explore-composition/SkinTypeCautionNotice.test.tsx` and a new
`tests/explore-composition/GoalFitCard.test.tsx` are green. The one remaining open item (exact copy
wording, §10 Open Question 4) does not block this — tests assert message structure/targeting against
the `PLACEHOLDER` copy and are expected to need a trivial string-literal update once final copy lands,
not a behavior change.

## 10. Open Questions
- [x] **Goal-fit "no overlap" rendering.** RESOLVED 2026-09-14 (product): SHOW the honest miss sentence
      — matches `goalCoverage.ts`'s own "not_owned" tone (which already renders by default on the
      Routines tab). Story 1 AC4 and the `GoalFitCard` miss-branch task in the tech design are both
      unblocked; only the exact sentence wording remains open (Open Question 4 below).
- [x] **Two simultaneous goal findings — exact layout.** RESOLVED 2026-09-14 (product): ONE card, one
      line per goal, mirroring `GoalCoverageBanner`'s existing up-to-two-independent-findings
      precedent, confirmed as proposed. Story 1 AC2 finalized.
- [x] **Skin-type-unset nudge scope.** RESOLVED 2026-09-14 (product): KEEP the current, already-shipped
      scope — the nudge fires only when a caution would otherwise have fired (`caution !== null &&
      skinType === null`), unchanged. It is explicitly NOT widened to an unconditional "you haven't set
      a skin type yet" prompt. This is now a confirmed, documented non-change, not an oversight — see
      Story 3 AC3.
- [ ] **Exact copy wording.** Every new sentence in this spec (goal-fit match/miss framing) is
      illustrative, matching the original brief's own examples, not final. Marked `PLACEHOLDER` in the
      tech design pending design review — same convention `docs/specs/explore-composition.md` used for
      Story 7's caution sentence before it was finalized. → owner: **design**. This is the only
      remaining open item; nothing else in this spec is blocked by it.
