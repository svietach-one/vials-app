# Technical Design: Explore Composition — Personalized Fit Signals
Spec: docs/specs/explore-fit-signals.md
Author: tech-designer
Date: 2026-09-14 (revised same day: product resolved 3 of 4 spec §10 Open Questions — see §5)

## 1. Architecture Overview
Extends the shipped Explore Composition pipeline (`docs/tech-design/explore-composition.md`) — no new
screens, stores, or navigation. Two new pure builders join the existing
`useResolvedComposition`/`useCompositionInsights` chain, reading `profile.primaryGoal`/`secondaryGoal`/
`skinConditions` (new reads) alongside the already-resolved `resolvedActiveKeys`. Both reuse existing
exported rule tables (`goalCoverage.ts`'s `coverageClasses`, `skinConditionModifiers.ts`'s
`CONDITION_MODIFIERS`) — no new rule data, no `conflictEngine.ts` call sites. Because both screens
already spread `{...insights}` into `CompositionInsightsSection.tsx`, zero changes are needed in
`ExploreCompositionResultScreen.tsx` or `WishlistEntryDetailScreen.tsx`.

```
useCompositionInsights(rawIngredientsText, category)
 resolved.resolvedActiveKeys ─┬─► buildGoalFit(keys, primaryGoal, secondaryGoal) [new] ─► goalFit
 (existing)                   └─► buildConditionCaution(keys, skinConditions)   [new] ─► conditionCaution
 profile.{primaryGoal,secondaryGoal,skinConditions} — new reads, top-level hook only
                    ▼
        CompositionInsightsSection
          ├─ SkinTypeCautionNotice  (extended: + conditionCaution prop, guard/precedence updated)
          └─ GoalFitCard [new]  — after SkinTypeCautionNotice, before the comparison matrix
```

## 2. API Contracts
N/A — local-only app, no backend/HTTP surface in this repo (CLAUDE.md). Zero network calls added.

## 3. Implementation Tasks

### engineer (scope=frontend — app is frontend-only)

- FE-1: `src/utils/productProfile/goalFit.ts` (+ `goalFit.test.ts`) — pure
  `buildGoalFit(resolvedActiveKeys: ActiveIngredientKey[], primaryGoal: SkinGoal, secondaryGoal:
  SkinGoal | null): GoalFitFinding[]`, `GoalFitFinding = { goal: SkinGoal; matchedKeys:
  ActiveIngredientKey[] }`. Goal list built the same way `goalCoverage.ts`'s `getGoalCoverageFindings`
  already does (`[...new Set([primaryGoal, secondaryGoal])].filter(g => g !== null && g !==
  'maintenance')`); `matchedKeys = coverageClasses(goal, resolvedActiveKeys)`, reusing the
  already-exported `coverageClasses` directly (its 2nd param is a plain candidate-key filter, not
  order-sensitive — no `GOALS` re-export needed). `matchedKeys.length === 0` is the miss case. Also
  exports two copy builders, `buildGoalFitMatchMessage`/`buildGoalFitMissMessage` (using
  `ACTIVE_INGREDIENT_LABELS`/`GOAL_LABELS` from `@/constants/labels`) — **copy is `PLACEHOLDER`**,
  pending spec §10 Open Question 4 (design). Both builders are wired into `GoalFitCard` (FE-2) — Open
  Question 1 resolved 2026-09-14 (SHOW the miss sentence), so neither branch is a stub.

- FE-2: `src/components/catalog/GoalFitCard.tsx` — `props: { goalFit: GoalFitFinding[] }`. Returns
  `null` when `goalFit.length === 0`. Renders exactly ONE card with one line per `GoalFitFinding` (up
  to 2 — primary + secondary) — CONFIRMED layout, spec §10 Open Question 2, mirroring
  `GoalCoverageBanner`'s existing up-to-two-independent-findings precedent; never two separate cards,
  never a goal silently dropped. Each line uses FE-1's `buildGoalFitMatchMessage` when
  `matchedKeys.length > 0`, else `buildGoalFitMissMessage` — Open Question 1 resolved 2026-09-14 (SHOW
  the miss sentence), both branches required, matching `goalCoverage.ts`'s "not_owned" tone. Message
  text itself stays `PLACEHOLDER` pending Open Question 4 — implement with FE-1's illustrative copy,
  swap the literal strings on landing, no structural change expected. Visual treatment mirrors
  `FunctionalProfileCard`/`DetectedActivesCard`'s icon-circle-header `Card` pattern (informational, not
  `SkinTypeCautionNotice`'s tinted-alert style), tokens only, 14px minimum text —
  `testID="goal-fit-card"`, each line also `testID="goal-fit-row-{goal}"` for independent assertions.

- FE-3: `src/utils/productProfile/conditionCaution.ts` (+ `conditionCaution.test.ts`) — pure
  `buildConditionCaution(resolvedActiveKeys: ActiveIngredientKey[], skinConditions:
  SkinConditionType[]): ConditionCautionFinding[]`, `ConditionCautionFinding = { tag:
  ActiveIngredientKey; conditions: SkinConditionType[]; conditionLabels: string[]; severity:
  AdvisorySeverity; message: string }`. Algorithm mirrors `skinConditionModifiers.ts`'s
  `getConditionRiskWarnings` exactly (filter `CONDITION_MODIFIERS` to selected conditions, one finding
  per matching `advisories[].tags` entry present in `resolvedActiveKeys`, merge by tag taking the
  highest-severity matching condition's message) — adapted from that function's `Product[]` carriers
  map to a direct `resolvedActiveKeys.includes(tag)` check, since this flow has no `Product[]`. Imports
  only `CONDITION_MODIFIERS`/`ConditionAdvisoryRule` (already-exported) — never
  `applyConditionSeverityModifiers`, `getConditionRiskWarnings`, or `conflictEngine.ts`. Message text is
  `CONDITION_MODIFIERS`'s existing strings, used verbatim — no new copy.

- FE-4: `src/components/catalog/SkinTypeCautionNotice.tsx` — extend `Props` with `conditionCaution:
  ConditionCautionFinding[]`. Top-level guard becomes `if (caution === null && conditionCaution.length
  === 0) return null;` — verified necessary: azelaic acid (`actives.json`: `irritancy: 2`,
  `exfoliating: false`, `photosensitizing: false`) never trips `buildSkinTypeCaution`'s threshold but
  IS an eczema advisory tag in `CONDITION_MODIFIERS` — a real case where only the condition signal
  fires. Render order: condition line(s) first (`testID="condition-caution"`, always shown when
  present, independent of `skinType`), then the existing skin-type-unset nudge (`skinType === null`
  branch, gate unchanged — reachable only when `caution !== null`; CONFIRMED unchanged 2026-09-14, spec
  §10 Open Question 3, not widened). Else the generic sentence over `caution.triggeringKeys` MINUS any
  key already named in a `conditionCaution` finding, suppressed entirely when that remainder is empty.
  Existing `testID="skin-type-caution"`/`"skin-type-nudge"` unchanged.

- FE-5: `src/hooks/useCompositionInsights.ts` — add `goalFit: GoalFitFinding[]` and `conditionCaution:
  ConditionCautionFinding[]` to `CompositionInsights` and its returned object. Computed at the
  top-level `useCompositionInsights` function only (mirroring how `skinType` itself is read directly
  from `profile`, never inside the two sub-hooks): `buildGoalFit(resolved.resolvedActiveKeys,
  profile?.primaryGoal ?? 'maintenance', profile?.secondaryGoal ?? null)` and
  `buildConditionCaution(resolved.resolvedActiveKeys, profile?.skinConditions ?? [])`, each its own
  `useMemo`.

- FE-6: `src/components/catalog/CompositionInsightsSection.tsx` — render `<GoalFitCard goalFit=
  {goalFit} />` immediately after `<SkinTypeCautionNotice ... />`, before `CompositionComparisonMatrix`
  (preserves the caution block's existing "directly after ingredients" position — see §4). Pass the new
  `conditionCaution` prop to `<SkinTypeCautionNotice>`. No changes needed to either result screen.

### qa-lead
- Extend `tests/explore-composition/SkinTypeCautionNotice.test.tsx`: condition-only trigger (azelaic
  acid + eczema, `caution === null`) still renders; same-active precedence (condition line shown,
  generic sentence excludes that key); multi-key remainder (generic sentence still names a second,
  non-covered key); nudge gate unchanged; no-conditions path unchanged.
- New `tests/explore-composition/GoalFitCard.test.tsx`: no-goal case renders nothing; match and miss
  lines each render correctly for a single goal; two-goal case renders both rows in one card via
  `testID="goal-fit-row-{goal}"` (Open Questions 1 and 2).
- Extend `tests/explore-composition/fixtures.ts` and both screens' existing suites with profile variants
  carrying `primaryGoal`/`secondaryGoal`/`skinConditions`, asserting identical behavior on both screens
  (shared-hook reuse guarantee).

### engineer (unit tests, both scopes)
- FE-1, FE-3 get co-located `*.test.ts` per `.claude/rules/testing.md` (pure logic, no React/store
  imports), including FE-1's miss-case branch. FE-5 extends the existing `useCompositionInsights.test.ts`,
  mocking `profileStore`'s new fields, asserting pure recomposition — same convention as that file's
  existing coverage.

## 4. Assumptions
- `buildGoalFit` reuses `goalCoverage.ts`'s exported `coverageClasses` directly.
  Alternative: export `GOALS` itself and re-filter in the new module.
  Reason: `coverageClasses` is a plain, non-order-sensitive filter against `GOALS[goal]`; reusing it is
  a smaller footprint than exporting the underlying private map.
- `buildConditionCaution` inlines its own one-line condition filter instead of requesting an export of
  `skinConditionModifiers.ts`'s private `modifiersFor`.
  Alternative: export and reuse `modifiersFor`.
  Reason: it is a one-line `.filter()`, not a business rule; the reused asset is `CONDITION_MODIFIERS`
  itself (already exported), satisfying "reuse the table" without touching a second shipped module's
  exports.
- Goal-fit card sits immediately after the (now condition-aware) caution block, before the matrix.
  Alternative: before Detected Actives, or merged into the Functional Profile card.
  Reason: preserves the caution block's already-reasoned "directly after ingredients" position
  unchanged, and keeps the two profile-personalization blocks adjacent.
- No "set your goal"/"set your skin conditions" nudge is added, unlike skin type's nudge.
  Alternative: symmetric nudges for all three profile inputs.
  Reason: `primaryGoal` always has a real default (`'maintenance'`), unlike `skinType`'s true `null`;
  `skinConditions` is an optional multi-select most users legitimately leave empty. Neither reads as
  missing data the way an unset required field does, and neither is requested by spec §2/§4.
- `SkinTypeCautionNotice.tsx` keeps its name/file despite gaining condition-advisory rendering.
  Alternative: rename to a more general `CautionNotice.tsx`.
  Reason: shipped, tested, three-call-site component; renaming for a prop/copy addition is unrequested
  churn with no behavior benefit.

## 5. Open Questions
Product resolved 3 of 4 spec §10 Open Questions on 2026-09-14: (1) goal-fit "no overlap" — SHOW the
miss sentence; FE-1/FE-2's miss branch is now a required implementation, not a stub. (2)
two-simultaneous-goal-findings layout — ONE card, one line per goal, confirmed as proposed; FE-2 updated
accordingly. (3) skin-type-unset nudge scope — KEEP the current `caution !== null && skinType === null`
gate; FE-4 explicitly does NOT widen it, confirmed as a deliberate non-change. Only Open Question 4
remains: exact copy wording for the goal-fit match/miss sentences, owner **design**, `PLACEHOLDER` in
FE-1/FE-2 until it lands (same convention as the original spec's Story 7 caution copy). No
implementation task in §3 is blocked by this remaining item.
