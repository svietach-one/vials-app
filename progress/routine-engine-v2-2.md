Status: IMPLEMENTED (awaiting tech-lead review)
Tech Design: docs/specs/routine-engine-v2.2/ (PRD_Spec.md v1.2, USER_STORIES.md US-23–US-29, IMPLEMENTATION_PLAN.md Phases 8–10)
Code: Phases 8, 9, 10 complete — see log

## Карточка задачи
- [x] Product requirements (spec package provided directly, no planner pass)
- [x] Technical design (spec package provided directly, no planner pass)
- [x] QA tests (component tests in tests/skin-conditions/, added by engineer — no qa-lead pass)
- [x] Implementation (engineer)
- [ ] Architecture review (tech-lead)

## Log

2026-07-26 — engineer: implemented Phases 8–10 of `docs/specs/routine-engine-v2.2/`.

### Phase 8 — Skin condition risk modifiers (US-23–US-27)

- `src/types/index.ts` — `SkinConditionType`, `UserProfile.skinConditions`,
  `BarrierIngredientKey`, `AdvisorySeverity`, `Product.spfValue`,
  `RehabNotice.aggressive`.
- `src/store/profileStore.ts` — `skinConditions: []` default.
  `src/utils/routineEngine/migrations.ts` — pre-v5 profiles get `[]`;
  `CURRENT_SCHEMA_VERSION` 4 → 5.
- `src/utils/barrierTags.ts` (new) — `parseBarrierTags` / `getProductBarrierTags`,
  separate output type, never merged into the conflict-tag array.
- `src/utils/skinConditionModifiers.ts` (new) — `CONDITION_MODIFIERS`,
  `escalate`, `applyConditionSeverityModifiers`, `getConditionRiskWarnings`,
  `getRecoveryConditionCaution`, `AGGRESSIVE_PROCEDURES`, `CONDITION_DISCLAIMER`.
- `src/components/profile/ConditionSelector.tsx` (new), wired into
  `SkinProfileSetupScreen` (after the phototype step, skip-compatible) and
  `SkinProfileEditModal`.
- Warning surfaces: `ConflictWarningInline` (escalated pairwise + advisory rows,
  now actually mounted on `RoutinesScreen`), `RehabNoticeCard` (+
  `conditionCaution` prop), `ProcedureLifespanCard` (+ `skinConditions` prop,
  fading phase).
- Tests: `src/utils/skinConditionModifiers.test.ts` (incl. the US-27 no-op
  harness over 10 pair cases), `src/utils/barrierTags.test.ts`,
  `tests/skin-conditions/*`.

### Phase 9 — Active ingredient density insights (US-28)

- `src/utils/activeIngredientDensity.ts` (new) — `TIER_MAP`,
  `DENSITY_MESSAGES`, `getActiveDensityFindings`,
  `applyConditionDensityModifiers` (reuses Phase 8's escalation rule).
- `ConflictWarningInline` renders `density-insight` (Cobalt `info` tone) and
  `density-warning` (Amber `warning` tone) rows.
- Tests: `src/utils/activeIngredientDensity.test.ts` (27),
  `tests/skin-conditions/condition-advisory-rows.test.tsx`.

### Phase 10 — Phototype-aware SPF adequacy (US-29)

- `src/utils/spfAdequacy.ts` (new) — `getSpfAdequacyFinding`, phototype +
  season + SPF-30 gates, `now` injected.
- `AddProductDraft.spfValue` + `SET_SPF_VALUE` reducer action + conditional
  numeric input in `BrandNameCategorySection`; same conditional input and
  save mapping in `ManualProductFormScreen`; `buildProductFromDraft` maps it.
- `SeasonalNoticeBanner` renders the Cobalt recommendation with a
  season-and-year-scoped dismiss key (`spf-upgrade-summer-2026`).
- Tests: `src/utils/spfAdequacy.test.ts` (16),
  `tests/skin-conditions/spf-adequacy-banner.test.tsx`.

### Compliance (US-26 + clinical gate)

- `src/utils/advisoryCopy.ts` + `advisoryCopy.test.ts` — banned-phrase lint over
  every advisory template (condition advisories, recovery cautions, density
  messages, picker disclaimer, generated SPF copy). Build-failing, per US-26.
- `src/constants/rulesets/proposedPairRules.ts` +
  `PROPOSED_V12_PAIR_RULES_ENABLED = false` in `featureFlags.ts`, with
  `proposedPairRules.test.ts` asserting the rows stay out of the shipped
  matrix while BPO/AZA tag detection keeps working.

## Deviations from the spec (all deliberate, none silent)

1. **Severity scale.** The spec asks for an explicit `'Low' | 'Medium' | 'High'`
   `Severity` type replacing the matrix's implicit scale. This codebase's
   production matrix uses `ConflictSeverity = 'avoid' | 'caution'` and is read
   by the whole V2.1 routine engine (`resolve.ts`, phototype modifiers, ruleset
   integrity tests). Rewriting it would have violated the kickoff's
   "never rewrite the existing pairwise matrix" constraint far more seriously
   than keeping two scales. Resolution: `AdvisorySeverity` ('low'|'medium'|'high')
   is introduced for the NEW layers only, with one documented projection
   (`caution` ↔ medium, `avoid` ↔ high) in `skinConditionModifiers.ts`. A
   one-level escalation of a rendered pairwise conflict is therefore
   caution → avoid, and an `avoid` pair renders unchanged (the cap).

2. **BPO / AZA tags already existed.** Phase 8.0 asks to add `BPO`/`AZA` to
   `ActiveIngredientKey`; `benzoyl_peroxide` and `azelaic_acid` (with matchers)
   have been in `actives.json` since V2. Nothing to add. Likewise two of §5.2's
   five "proposed" rows — `benzoyl_peroxide + retinoid` and
   `vitamin_c_derivative + benzoyl_peroxide` — are ALREADY in the shipped
   production matrix, predating this task; they were left untouched (removing
   live rules was not in scope). The three genuinely-new proposals, plus a pure
   vitamin C + BPO row, sit in `proposedPairRules.ts` behind the disabled flag.

3. **`parseBarrierTags` reuses actives.json patterns.** CERA/PANT/GLYC/NIAC/HYAL
   already exist as ruleset classes, so the barrier parser maps those hits into
   the separate barrier key space rather than re-declaring regexes; only `ZPCA`
   (Zinc PCA), which the ruleset does not model, carries a local matcher. The
   output type stays strictly separate, which is what §5.2 actually requires.

4. **Seborrheic dermatitis ships as a documented no-op.** As the kickoff prompt
   instructs: `Product.texture` (or any occlusivity field) does not exist, and
   `productType` describes a category, not formulation weight. The condition is
   selectable and persisted, its advisory table is empty, and the reason is
   documented at the table entry. **Follow-up needed** when a texture field lands.

5. **Aggressive-procedure set mapped to this catalog.** §5.3 names deep peel /
   laser resurfacing / microneedling; this app's `CosmeticProcedureKey` has
   `chemical_peel_deep`, `smas_lifting`, `mesotherapy`, `botox`, `fillers`,
   `mechanical_facial`. `AGGRESSIVE_PROCEDURES` = the first three (deep peel,
   energy-based lift, injectable micro-wounding). Botox and fillers are excluded,
   as US-25 requires. **This mapping is a judgement call and wants product/
   clinical confirmation.**

6. **No separate Today screen.** The spec addresses `ClinicalRestrictionsBlock`
   (Tab 1A) and `ConflictWarningInline` (Tab 1B) as distinct sub-views. This app
   merged them into one Routines tab: rehab restrictions render through
   `RehabNoticeCard`, and the advisory stack renders in the list-view header for
   the selected day. Density findings are therefore day-scoped rather than
   "weekly plan only" — the same data the user is looking at, but worth a
   product glance.

7. **`RehabNotice` gained an `aggressive` field.** `buildRehabNotices` is pure
   and has no profile access, so the classification is computed there (it owns
   the procedure key) and the caution string is computed by the screen. Derived
   per render, never persisted.

## Open items flagged, not resolved (per the kickoff prompt)

- `skinIssues[]` (here: `UserProfile.concerns`, which has its own `eczema`
  member) vs. the new `skinConditions[]` — kept strictly separate, nothing
  derives one from the other, migration never infers a condition from a concern.
  **Needs product-owner input** (PRD §5.1).
- Seborrheic "rich/occlusive format" check — blocked on a catalog texture field
  (deviation 4).
- The four/five §5.2 proposed pairwise rows — blocked on the combined clinical
  review pass (PRD §6). Gated, not implemented into the matrix.

## Self-review pass (2026-07-26, after implementation)

Reviewed the working diff against `.claude/rules/architecture-review.md`. Four
findings, all fixed in the same session:

1. **BLOCKER — `ConflictWarningInline` warned about invisible steps.** It took
   whole `routines` and re-derived visibility itself, so it ignored
   `RoutinesScreen`'s `frozenStepIds`: a retinoid frozen during peel rehab still
   produced a conflict row naming a product absent from the list. It also meant
   the screen computed conflicts twice from different inputs.
   Fix: props are now `morningSteps` / `eveningSteps` — the exact filtered
   arrays the list renders. `getActiveDensityFindings` takes `PeriodSteps[]`
   instead of `Routine[]` for the same reason (`toPeriodSteps()` provided for
   callers holding routines). Regression tests in
   `tests/skin-conditions/condition-advisory-rows.test.tsx`.
2. **BLOCKER — the US-26 lint could silently pass.** `findBannedPhrases` used
   `indexOf` once, so a leading false positive ("scannot") masked a real
   violation later in the same string. Now scans every occurrence; regression
   test added.
3. **WARNING — duplicate advisory rows.** Eczema + rosacea + a retinoid rendered
   two near-identical "Sensitivity note" rows. `getConditionRiskWarnings` now
   emits one row per tag, merging condition labels and taking the highest
   matching severity (ties resolve in `CONDITION_MODIFIERS` order).
4. **WARNING — component length + test gap.** `ConflictWarningInline` split into
   `ConflictRow` / `AdvisoryRow` / `DensityRow` (main function now 59 lines,
   under the 50-line rule for the logic body). Added `SET_SPF_VALUE` reducer
   tests and `buildProductFromDraft` spfValue tests — the Phase 10 plumbing had
   engine coverage but none.

Also fixed while in there: advisory carriers key on `product.id` rather than
display name, and density counts distinct products rather than steps.

Deliberately not changed: `spfAdequacy` uses `now.getDay()` rather than the
04:00 skincare-day boundary — that matches `RoutinesScreen`'s own `selectedDow`,
and diverging would be worse than the inconsistency.

## Verification

- `npx tsc --noEmit` — clean, 0 errors, including `tests/`.
- `npx jest --testPathIgnorePatterns="worktrees"` — 125/129 suites,
  1548/1553 tests passed, 2 todo (1527 before the self-review pass). The 4 failing suites
  (`tests/shelf-filtering/PaoChip.integration`, `tests/catalog/catalog-screen`,
  `tests/catalog/product-detail`, `tests/catalog/add-product-hub`) are
  PRE-EXISTING on this branch — verified identical (same 4 suites, same 3 test
  failures, same `shadow.sm` module-mock error) before any file in this task was
  touched. Baseline before this work: 116/120 suites, 1366 tests passing.
