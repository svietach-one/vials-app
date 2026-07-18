Status: PHASE_1_COMPLETE (self-review ACCEPT) — awaiting human review
Tech Design: docs/tech-design/routine-engine-v2-cosmetologist.md
Code: engine-improvements (uncommitted)

## Карточка задачи
- [x] Product requirements (planner) — docs/specs/routine-engine-v2.1/
- [x] Technical design (planner) — Phase 1
- [x] QA tests (qa-lead) — N/A for Phase 1 (no UI surface); unit tests co-located
- [x] Implementation (engineer) — Phase 1
- [x] Architecture review (tech-lead) — Phase 1 structured self-review, ACCEPT

Package: `docs/specs/routine-engine-v2.1/` — 9 phases, one phase per session.
Phase order is mandatory: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9.
This file tracks the whole package; each phase appends to the Log.

## Log

- 2026-07-17: **Codebase-reconciliation audit of the whole package (phases
  1–9).** The V2.1 specs were authored against the V2 *design document*, not
  the merged V2 implementation. 4 of 9 phases rested on problems that no longer
  exist; two proposed new files would have forked `actives.json`. All 9 phase
  files rewritten; `DISCREPANCY-REPORT.md` added. Behavioral intents unchanged;
  4 conflicts raised as open questions rather than resolved silently. Baseline
  measured: 18 suites / 284 tests green (`npx jest src/utils/routineEngine`).

  Premises removed (full evidence in the report §1): irritancy scale already
  exists for all 15 classes; no `PEPT` tag ever existed and `copper_peptides`
  matchers are already narrow; Path A already guards period eligibility
  (`resolve.ts:420`), so retinoid-in-AM was already unreachable; the
  photosensitizing-SPF mechanism already works; `seasonMask` is already pure;
  the phototype and vitamin C migrations already shipped in schema v2; recency
  was already absent from scoring.

  Structures collapsed (report §2): `activeRegistry.ts` and `conflictMatrix.ts`
  are NOT created — folded into `src/constants/rulesets/actives.json`, already
  the single source of truth. Legacy `conflictRulesDb.ts`
  `INGREDIENT_CONFLICT_RULES` is deleted in Phase 1 so one matrix remains.

- 2026-07-17: **Open question §4.1 resolved** (user): `vitamin_c_pure` moves to
  irritancy 3 and the resulting cap is intended. §4.2 / §4.3 / §4.4 remain open
  but block only Phases 2, 3, and 7 respectively — not Phase 1.

- 2026-07-17: **Cumulative active exposure rule** added by user directive;
  amends Phases 1 and 4 (report §7). An active class is a property of a
  product, not a slot. Mild (`irritancy <= 2`) — no cumulative restriction.
  Strong (`irritancy >= 3`) leave-on — one carrier per period across all slots,
  reclassified as a treatment candidate in any format. Rinse-off carriers are
  exempt with an info-level note. New reason code `cumulative_active_cap`
  (normalized from the directive's SCREAMING_CASE to match the 22 codes already
  in the rulesets).

  Split across phases: **Phase 1** owns the data (`isStrongActive` boundary,
  `rinseOff` on `ProductFacts`); **Phase 4** owns enforcement (cumulative cap,
  format reclassification, neutral-moisturizer placeholder, cap emission).

  Four sub-questions the directive does not state were resolved as documented
  assumptions (report §7.1–§7.4), not silently:
  - 8.1 the cumulative cap subsumes per-class `stacking`; Phase 1 adds
    `stacking` to `vitamin_c_pure` to keep the shipped invariant coherent,
    Phase 4 removes all `stacking` blocks. Deliberate short-lived churn.
  - 8.2 AHA + PHA in one period becomes **legal** (PHA is mild, so it leaves
    `aha.sharedCapWith`). A loosening required by the mild/strong split.
  - 8.3 "treatment frequency caps" resolve per-class (exfoliant cap for
    exfoliants, existing `adaptation` caps for retinoids); no new table.
  - 8.4 `rinseOff` is true for `cleanser` and `makeup_remover` only; `peeling`
    and `mask` are conservatively leave-on.

- 2026-07-17: Process for phases 1–9 set by user: inline execution of all four
  roles, no subagents. Tech-lead review is replaced by a **structured
  self-review pass** run separately after implementation, judged strictly
  against the artifacts (corrected phase file, discrepancy report,
  `.claude/rules/architecture-review.md`, the diff) — a decision not written
  down is either documented or flagged as a deviation. Output is a pass/fail
  checklist with file/line refs; any FAIL is fixed and the checklist re-run.

- 2026-07-17: **PHASE 1 IMPLEMENTED.** Irritancy recalibrated in actives.json
  (bha 2→3, vitamin_c_pure 2→3, benzoyl_peroxide 3→4, azelaic_acid 1→2,
  copper_peptides 1→2); `irritancyByPotency` added to retinoid
  (low/medium 3, high/rx 4) and resolved per attributed class in
  `productFacts.aggregateProperties`; `resolveIrritancy` + `isStrongActive`
  added to rulesetTypes.ts as the single mild/strong boundary, with the
  0–5 scale documented on `ActiveProperties.irritancy` (its JSDoc previously
  claimed "0–3"); `peptide_signal` + `peptide_neuro` classes added with a
  conservative unknown-peptide fallback; conflict matrix consolidated onto
  `pairRules` (INGREDIENT_CONFLICT_RULES deleted, `rule_vitc_niacinamide`
  removed, `rule_vitc_pure_copper_peptides` + `rule_vitc_derivative_bpo`
  added); `rinseOff` derived on ProductFacts; ruleset version 2026-07-04 →
  2026-07-17.

  Verified: `npx tsc --noEmit` clean. `npx jest src/utils/routineEngine` →
  18 suites / **309** tests green (baseline was 284; +25 new). Full
  `npx jest src tests` → 1089 passed, 3 failed. Those 3 failures were
  confirmed **pre-existing** by stashing all Phase 1 work and re-running clean
  HEAD, which fails identically: tests/catalog/catalog-screen (AsyncStorage
  native module null), tests/catalog/product-detail (`palette.cobaltTint`
  undefined), tests/shelf-filtering/PaoChip (3 tests). Unrelated to this phase;
  not grown.

- 2026-07-17: **Phase 1 DEVIATIONS from the artifacts** (recorded per
  .claude/rules/architecture-review.md §6 — an undocumented deviation is an
  automatic BLOCKER):

  1. **`glycerin_class` NOT added; deferred to Phase 3.** The corrected
     phase-01 §1.3 called for it. Implemented, then removed on evidence:
     glycerin/glycols appear in most formulations, so the class attributed to
     nearly every product, breaking the parser's contract that a formula with no
     meaningful actives yields no classes (5 existing tests). More seriously,
     `concerns: ['dryness']` on a near-universal class would give almost every
     product a goal-match hit and flatten the Phase 3 ranking it exists to
     serve. It has no Phase 1 consumer, so shipping it early also violates
     shared principle #1. Phase 3 adds it with the `goals` block and must decide
     attribution then (likely INCI position or productType, not bare presence).
     phase-01 §1.3 amended with the rationale.

  2. **PHA left the exfoliant shared cap in Phase 1, not Phase 4.** Report §7.2
     assigned this to Phase 4. The Phase 1 invariant fails immediately on `pha`,
     which ships a stacking block at irritancy 1, so the block had to go now.
     Removing `pha` from aha/bha `sharedCapWith` had to go with it: leaving it
     makes the cap admission-order dependent (PHA-first blocks a later AHA;
     AHA-first does not block PHA) — a determinism defect, not a safety
     tradeoff. Two regression tests in resolve.test.ts cover both orders.
     Exfoliant exposure stays capped by phototype_pih_exfoliant_cap and
     summer_uv_exfoliant_limit (both target properties.exfoliating, untouched).
     Report §7.2 and phase-01 §1.2 amended.

  3. **`src/utils/productForm/conflictPreview.ts` migrated — a third consumer
     of the legacy table** that the tech design's file list missed (it grepped
     as `INGREDIENT_CONFLICT_RULES`, which the design listed only for
     conflictRulesDb + conflictEngine). Rather than duplicate the new array-side
     matching, `matchPairRule(keyA, keyB)` is exported from conflictEngine.ts
     and both consumers call it, so the preview and the real check cannot
     disagree.

  4. **Ruleset version stamped 2026-07-17.** Not called out in the artifacts,
     but `RoutinePlan.rulesetVersion` exists so a rules change prompts
     revalidation — leaving it at 2026-07-04 after changing the rules would
     defeat it. Two tests assert the literal (entryPoints.test.ts,
     tests/routine-engine/generate.test.ts) and were updated.

- 2026-07-17: **Phase 1 test expectation changes** (all justified, per the
  Phase 9 rule that a changed expectation must be explained):
  - conflictEngine / entryPoints: vitamin C + niacinamide flipped from
    `caution` to no-finding, and both are now **regression locks** against
    reintroducing the myth. entryPoints' caution-pair case moved to
    vitC + copper peptides; resolve.ts's keep_with_note case likewise.
  - context.test.ts: the "does not escalate when one side is below the
    threshold" case cited `rule_vitc_niacinamide`, now deleted — moved to
    `rule_vitc_derivative_bpo` (derivative irritancy 1 fails the `>= 2` gate).
  - targeting / productFacts: a wizard-tagged retinoid takes the pre-existing
    conservative `high` potency default, so it now resolves to irritancy 4, not
    3. Added a companion case proving a low-potency retinyl palmitate resolves
    to 3 — i.e. the potency-awareness, not a blanket bump.
  - resolve.test.ts: the AHA+PHA shared-cap case became two order-independence
    cases (deviation 2). Note both fixtures were default `serum`s, so the
    original assertion was partly measuring the same-slot cap; the replacements
    use distinct productTypes to isolate the stacking cap.

- 2026-07-17: **PHASE 1 SELF-REVIEW PASS — verdict ACCEPT.** Run as a separate
  pass after implementation, judged against the corrected phase-01 file, the
  discrepancy report, .claude/rules/architecture-review.md, and the diff.

  | # | Check | Verdict | Evidence |
  |---|---|---|---|
  | 1 | No parallel taxonomy alongside actives.json | PASS | `activeRegistry.ts` / `conflictMatrix.ts` never created; no competing `ActiveClass` union in src/. All class data in `src/constants/rulesets/actives.json`. |
  | 2 | Single conflict matrix; conflictRulesDb collapsed | PASS | `INGREDIENT_CONFLICT_RULES` gone (`conflictRulesDb.ts:1-10` now only `PROCEDURE_COLLISION_RULES` + a pointer comment). All 3 consumers read `pairRules` via `conflictEngine.ts:60 matchPairRule`. |
  | 3 | `isStrongActive` ⇔ irritancy ≥ 3, no exemption lists | PASS | `rulesetTypes.ts:96` is the sole definition (`resolveIrritancy(...) >= 3`). Invariant enforced over all 17 classes by `rulesetIntegrity.test.ts` "declares a stacking cap for exactly the strong actives" — genuine fail-before: it caught `pha` (irritancy 1 with a stacking block) during implementation. |
  | 4 | Cumulative cap + rinseOff exemption as specified | PASS (data half) / **N/A (enforcement)** | `rinseOff` shipped at `productFacts.ts:74` + `RINSE_OFF_TYPES`, covered by 2 tests. The **cap itself is Phase 4 by design** — phase-01 §1.5 and tech design §1 both state Phase 1 adds no emission and no enforcement, and that `rinseOff` has no consumer until Phase 4. Not a gap. |
  | 5 | Migrations idempotent (double-run test) | **N/A** | Phase 1 introduces no migration. Schema stays at 2; the single bump to 3 is Phase 8, which owns the goal + peptide re-attribution migrations. `migrations.test.ts` (12 KB) untouched and green. |
  | 6 | Every phase-01 acceptance criterion maps to a passing test | PASS | All 12 mapped and individually re-run by name; table in this log's implementation entry. Notably AC1 asserts the *attribution* (`peptide_signal`), not just conflict-absence — the old behavior passed that AC vacuously by matching no class at all. |
  | 7 | `tsc --noEmit` clean; no Math.random / unsorted iteration in engine | PASS | tsc clean. No `Math.random` in `src/utils/routineEngine/` or `src/constants/`; the only occurrence is `src/utils/generateId.ts:3`, which the engine never imports (grep clean), so it is unreachable from `generatePlan`. No `Object.keys/entries`/`for..in` in any touched engine file. |

  Additional architecture-review.md checks, all PASS: no AsyncStorage outside
  `services/storage.ts` (hits are comments/test mocks only); no React in
  `src/utils/`; no `fetch(` outside `src/services/`; no console.log/TODO/FIXME
  in touched files; no function over 50 lines in touched files; engine stayed
  pure (`generatePlan` still performs no writes).

  Four deviations found and documented rather than waved through (previous log
  entry). Under §6 each would otherwise be an automatic BLOCKER; all four are
  now recorded in the artifacts they deviate from.

  **No FAIL items, so no re-run was required.**

  Carried to later phases:
  - Phase 3 must add `glycerin_class` **and** decide its attribution rule
    (bare INCI presence is not viable — deviation 1).
  - Phase 4's assumption 8.1 (cumulative cap subsumes per-class `stacking`)
    still stands; `vitamin_c_pure`'s new stacking block is the short-lived
    churn that entry predicted, and `pha`'s removal is already done.

- 2026-07-17: **Phase 1 ACCEPTED by user; all four deviations approved as
  logged.** Committed as dfa61f6 on engine-improvements. The 3 pre-existing
  test failures filed as progress/known-test-failures.md with the clean-HEAD
  repro, so later phases diff against a known list instead of re-diagnosing.

- 2026-07-17: **User rulings on remaining open questions:**
  - §4.2 RESOLVED — `pm_preferred` dropped. AHA/BHA stay hard `pm`; PHA stays
    `both` as the morning-safe exfoliant path. Rationale (binding): a planned
    SPF step is not verifiable protection on skin, so it cannot gate a safety
    exception; and "no acid in AM, ever" is property-testable without
    conditional states. Phase 2 file updated: no eligibility-table change,
    property test widened to retinoid + aha + bha.
  - glycerin_class deferral APPROVED; Phase 3 must solve its attribution
    jointly with trace-amount attribution for strong actives (acid cream with
    glycolic at the INCI tail) — same "position ≈ concentration" heuristic,
    same clinical-consultant review as the goals values. Phase 3 file updated
    with the three-item consultant list.
  - §4.4 RESOLVED — DecisionReasonCode enum stays decoupled from pair-rule
    IDs: reason codes are decision categories, rule IDs are data. ruleId may
    ride along as an optional payload field, never as the enum value.
    Phase 7 unblocked.
  Remaining open: §4.3 (pregnancy subsystem) — blocks only Phase 3's
  pregnancy bullet, already excluded from that phase's acceptance.

- 2026-07-17: **PHASE 2 IMPLEMENTED.** Scope shrank per the §4.2 ruling to:
  (2.1) base `mandates` block in actives.json — one entry,
  `spf_photosensitizing` (unconditional: SPF required in AM whenever the plan
  contains a photosensitizer, any phototype, any season), typed as
  `RulesetMandate` in rulesetTypes.ts (SeasonRule shape minus `seasons`),
  folded as a 4th source in `collectRequireMandates` (mandates.ts) — reads
  ACTIVES_RULESET directly, consistent with the seasonal source;
  `applyMandates` untouched, the new source flows through the existing
  per-period merge. (2.2) period-safety property suite
  tests/routine-engine/period-safety.test.ts: 100 seeded shelves × seasons ×
  fitzpatrick assert no retinoid/AHA/BHA ever reaches AM; adversarial variant
  (PM-only products user-pinned to morning must freeze as no_allowed_period,
  never be "rescued" into AM); daily-view variant (the rendered day, not just
  the plan). (2.3) no eligibility-table change — ruling locked by an integrity
  test asserting aha/bha/retinoid `["pm"]`, pha `["am","pm"]`.

  Placement deviation (documented in tech design Assumption 1): the property
  test lives in tests/routine-engine/, not src/utils/routineEngine/ as the
  phase file suggested — the seeded PRNG + randomShelf machinery lives in
  tests/routine-engine/fixtures.ts and testing.md's fixture-sharing rule says
  don't duplicate it.

  Test expectation changes, all from the intended widening: mandates.test.ts's
  two collectRequireMandates exact-array assertions became
  membership + count-excluding-base (the base mandate is now in every
  collection by design); the concurrent-merge case now sees 3 placeholder
  decisions (summer + phototype + base), still 1 merged placeholder;
  entryPoints "day-separated pair" and phototype.test.ts "baseline no
  escalation" fixtures gained an AM SPF step — both carried a photosensitizer
  with no SPF, so the new mandate correctly fired an avoid finding unrelated
  to what those tests measure; completing the fixture keeps their strict
  assertions meaningful instead of weakening them.

  Verified: tsc clean; jest src tests → 1100 passed / 3 failed — exactly the
  3 known pre-existing failures (progress/known-test-failures.md), not grown.

- 2026-07-17: **PHASE 2 SELF-REVIEW PASS — verdict ACCEPT.**

  | # | Check | Verdict | Evidence |
  |---|---|---|---|
  | 1 | No parallel taxonomy | PASS | mandates block + type live in actives.json / rulesetTypes.ts; no new constants file. |
  | 2 | Single conflict matrix | PASS | untouched this phase. |
  | 3 | isStrongActive invariant | PASS | untouched; integrity suite still green (28 tests). |
  | 4 | Cumulative cap + rinseOff | N/A | Phase 4 scope; no Phase 2 surface. |
  | 5 | Migrations idempotent | N/A | no migration in this phase; schema still 2. |
  | 6 | Every AC → passing test | PASS | 10/10 mapped and individually re-run (log above). |
  | 7 | tsc clean; no Math.random / unsorted iteration | PASS | tsc clean; period-safety uses fixtures.makeRng (mulberry32); no Object.keys/entries iteration added. |
  | 8 | §4.2 ruling honored: no eligibility change | PASS | `git diff actives.json` contains no allowedPeriods hunk; integrity lock added. |
  | 9 | applyMandates untouched (design constraint) | PASS | diff shows only the collectRequireMandates fold. |

  One deviation (property-test placement), documented in the tech design and
  this log. No FAIL items; no re-run required.

- 2026-07-17: **PHASE 3 IMPLEMENTED.** Goal model as pipeline Step 0.
  - Types/profile: `SkinGoal` (7 members) + flat `primaryGoal`/`secondaryGoal`/
    `goalNeedsConfirmation` on UserProfile; defaults in profileStore.
  - Derivation: `deriveGoalFromConcerns` + goal fields in `migrateProfile`
    (idempotent, every hydrate; existing profiles get goals NOW — the schema
    bump 2→3 stays with Phase 8, per the fold-the-bump rule).
    `goalNeedsConfirmation` set only when derived from non-empty concerns
    (a default is not a guess — design Assumption 1).
  - Data: `goals` block in actives.json (draft rankings, consultant item);
    `spf_goal_pigmentation` mandate with the new `goalIn` condition (caution,
    matches primary OR secondary — design Assumption 2); glycerin_class
    RE-ADDED with `attribution.requireWithinPosition: 5`; trace-amount
    `downgradeToLowAfterPosition: 8` on aha/bha/vitamin_c_pure — the joint
    "INCI position ≈ concentration" heuristic from the user ruling, all three
    values on the consultant review list.
  - Parser: `parseActiveIngredientDetails` is position-aware
    (`ParsedActiveDetail.position`, 1-based comma-token index); gates applied
    IN the parser so facts, ConflictEngine, and badges agree. Freeform
    no-comma text → position 1 → no gating (conservative). Trace strong
    actives are downgraded to 'low', never dropped (visible to safety checks).
  - Engine: `resolveGoalContext` (Step 0) → `RoutineContext.{goals,
    treatmentClassRanking, goalDecisions}`; barrier_repair modifier drops
    flat-irritancy ≥ 3 classes with new `goal_exclude` DecisionAction +
    `barrier_repair_excludes_irritants`; Fitzpatrick 4–6 pigmentation promotes
    azelaic/niacinamide above aha; generatePlan prepends Step-0 decisions.
    Scoring untouched — Phase 4 consumes the ranking; maintenance plans are
    byte-identical to pre-phase-3 plans.
  - UI (qa-lead tests written first): `GoalSelector` (max 2, first = primary,
    third tap no-op, deselect-primary promotes secondary) in
    SkinProfileSetupScreen + SkinProfileEditModal (saving the editor clears
    goalNeedsConfirmation — the user chose); `GoalConfirmBanner` on
    RoutinesScreen while the flag is set; Confirm clears it, Change routes to
    the Profile tab. Stateful-mock integration test proves the once-only loop.

  Test expectation changes, justified: fixtures across 3 suites used
  ", Glycerin" as an INERT filler — no longer inert with the gated class, and
  at position ≤ 3 in short synthetic lists the gate correctly fires; replaced
  with ", Squalane" (unmapped) so those tests keep measuring their real
  subject. One realistic-formula test (activeIngredientMatcher) now expects
  glycerin_class at position 2 — correct new behavior, documented in-test.
  mandates.test.ts collectRequireMandates membership assertions unchanged
  (goalIn mandates are filtered out for non-pigmentation contexts).

  Verified: tsc clean; jest src tests → 1145 passed / 3 known pre-existing
  failed (list unchanged, progress/known-test-failures.md); engine suites +
  new goal suites green.

- 2026-07-17: **PHASE 3 SELF-REVIEW PASS — verdict ACCEPT.**

  | # | Check | Verdict | Evidence |
  |---|---|---|---|
  | 1 | No parallel taxonomy | PASS | goals block + attribution config live in actives.json; GOAL_TREATMENT_MAP never created as a TS file; GOAL_LABELS is display-only. |
  | 2 | Single conflict matrix | PASS | untouched. |
  | 3 | isStrongActive invariant | PASS | untouched; integrity suite green (33 tests). |
  | 4 | Cumulative cap + rinseOff | N/A | Phase 4 scope. |
  | 5 | Migrations idempotent | PASS | goal derivation added to migrateProfile keeps the same-reference contract; "second run returns the same reference" test added and green. No schema bump (Phase 8's). |
  | 6 | Every AC → passing test | PASS | 13/13 mapped and individually re-run (AC table in log). |
  | 7 | tsc clean; no Math.random / unsorted iteration | PASS | the one Object.entries hit in context.ts is pre-existing phototype code and a conjunction (.every) — order-independent. |
  | 8 | Layer separation | PASS | Step 0 pure in context.ts; UI components read labels/tokens only; store writes via updateProfile. |
  | 9 | qa-lead before engineer (protocol) | PASS | goal-selector + goal-confirm-banner contract tests written before the components existed. |
  | 10 | §4.3 exclusion honored | PASS | nothing pregnancy-related in the diff; pregnancyBlocked property not added. |

  Deviations: none beyond documented design assumptions (goalNeedsConfirmation
  only for real guesses; caution severity + primary-or-secondary goalIn;
  gates in the parser; draft gate values 5/8; trace downgrades never drop).
  Note for Phase 8: §8.4's derivation half is already live via migrateProfile —
  Phase 8 executes only the schema bump + re-persist.

  Consultant review list (values, not structure): goals rankings;
  glycerin requireWithinPosition=5; trace downgradeToLowAfterPosition=8 and
  the downgrade-vs-drop policy.

- 2026-07-17: **PHASE 4 IMPLEMENTED — the core rewrite.** Greedy admission
  replaced by goal-driven skeleton build-up; per-class stacking replaced by the
  cumulative active exposure rule (report §7).
  - New `src/utils/routineEngine/skeleton.ts` (pipeline step 4.5 "selection"):
    decides WHO enters each period's admission pass. Structural slots
    (cleanser/makeup_remover, moisturizer/cream/lotion, spf) admit all
    type-matching candidates (the existing same-slot cap picks the winner +
    keeps swap alternatives); treatment slot = 0-or-1 per period by the Step-0
    `treatmentClassRanking` walk. Strong carrier := irritancy>=3 && !rinseOff;
    strong carriers are treatment candidates in ANY format (reclassification);
    at most one selected per period. Emits reserve[] with precise reason codes
    (duplicate_function / cumulative_active_cap / not_needed_for_goals),
    treatment freq caps (exfoliant 2/wk, reclassified 4/wk — draft, consultant
    list), rinse-off info notes, and neutral-moisturizer placeholders.
  - resolve.ts: buildPools intersects with the selection; findCapViolations
    rewritten from per-class stacking to the cumulative rule (one strong
    leave-on carrier per period per DAY — day-overlap scoped so the classic
    day-separated pattern stays legal for validate); scoreCandidate rebanded to
    boost*100000 + goalRank*1000 + tolerability*200 + concernHits*10 +
    potency*2 (concern-over-potency order preserved; tolerability fed 0 until
    Phase 5); treatment caps merge strictest-wins with adaptation caps.
  - actives.json: all 5 stacking blocks removed; rulesetIntegrity restated
    ("no per-class stacking; cumulative rule owns strong actives").
  - slotting.ts: SKELETON_SLOTS + structuralSlotFor; isTreatment tightened to
    the strong boundary (mild actives render both periods per the directive).
  - generate.ts: RoutinePlan.reserve (required); skeleton wired before resolve;
    skeleton placeholders merged with mandate placeholders; Step-0 + skeleton
    decisions prepended. planApply narrates the reserve in the draft summary.

  Verified: tsc clean; full `jest --testPathIgnorePatterns=worktrees` →
  1157 passed / 3 known pre-existing failed (progress/known-test-failures.md,
  unchanged) / 2 todo.

- 2026-07-17: **Phase 4 DEVIATION** (documented per architecture-review.md §6):
  the phase-04 acceptance item "two hyaluronic products of different
  productType (serum + cream) → one admitted, one duplicate_function" is
  SUPERSEDED by the cumulative-exposure directive (design Assumption 2). Mild
  same-class dedup applies ONLY to treatment-candidate selection, so a mild
  product filling a *structural* slot is not a duplicate — the directive's own
  "peptide serum + peptide cream → both admitted" case requires this. The
  phase-04 acceptance file was amended to match; skeleton.test.ts asserts the
  corrected behavior.

- 2026-07-17: **Phase 4 test expectation changes**, all from the intended
  greedy→skeleton shift and justified in-test:
  - slotting: isTreatment(niacinamide) true→false (boundary tightened to >=3).
  - resolve: stacking_cap_aha ruleId → cumulative_active_cap; scoring 130→16
    (rebanding, relative order preserved).
  - entryPoints + qa Story suites (generate/phototype/seasonal/custom/cycling):
    tests that push a single active THROUGH generation now pass a goal ranking
    that active — a maintenance profile reserves it (the whole point of
    phase-04). Tests targeting post-generation logic (substitute) hand-build
    the plan instead.
  - phototype Story 7 rewritten: skeleton selection prevents co-layering two
    strong actives in generation, so pair escalation is now a VALIDATE-only
    concern; two strong actives same-day is a cumulative_active_cap avoid
    regardless of phototype; vitC_pure + copper_peptides is the pair that
    isolates the phototype escalation (copper irritancy 2 = not a strong
    carrier, so the cap stays silent).
  - realistic-shelf generate test rewritten to assert minimalism + reserve
    instead of full greedy admission.

- 2026-07-17: **PHASE 4 SELF-REVIEW PASS — verdict ACCEPT.**

  | # | Check | Verdict | Evidence |
  |---|---|---|---|
  | 1 | No parallel taxonomy | PASS | skeleton is logic, not a data taxonomy; actives.json unchanged as the source of truth. |
  | 2 | Single conflict matrix | PASS | pairRules untouched; cumulative cap lives in findCapViolations, not a new table. |
  | 3 | isStrongActive invariant | PASS | restated: no class declares stacking; integrity suite asserts it + both-sides-populated. |
  | 4 | Cumulative cap + rinseOff enforced as specified | PASS | 6 directive cases in skeleton.test.ts; rinseOff exemption + info note covered. |
  | 5 | Migrations idempotent | N/A | no migration this phase; schema still 2. |
  | 6 | Every AC → passing test | PASS | 11/11 mapped and individually re-run (AC table in log). |
  | 7 | tsc clean; no Math.random / unsorted iteration | PASS | tsc clean; 50-seed byte-identical determinism test green; SKELETON_SLOTS iteration is a fixed 3-key const. |
  | 8 | Layer separation | PASS | skeleton.ts pure (no React/store/fetch); generate orchestrates. |
  | 9 | Function length | WARNING (accepted) | selectSkeleton refactored 117→66 lines; remaining length is a clear linear 4-phase orchestrator, allowed as WARNING "if clean". classifyEntries + neutralMoisturizerPlaceholders extracted. |

  Deviation (acceptance item correction) documented above. No FAIL items; the
  one WARNING (66-line orchestrator) is accepted with rationale.

  Carried to later phases: Phase 5 feeds tolerability (currently 0 at
  weight 200) from the usage-anchored phaseIndex. Phase 7 splits
  reasonCode/ruleId (ladder freezes still land in frozen[] with ruleId) and
  closes the enum over the new reason codes (reserve/info/goal_exclude +
  cumulative_active_cap + not_needed_for_goals + duplicate_function +
  moisturizer_recommended + rinse_off_active_note). Consultant list grows by
  the two treatment-cap draft values (2/wk exfoliant, 4/wk reclassified).

- 2026-07-18: **PHASE 5 IMPLEMENTED — adaptation usage anchor + phase regression.**
  - **DOCUMENTED-DECISION REVERSAL (architecture-review.md §6):** adaptation.ts
    previously stated as deliberate design "A product owned long before tracking
    shipped lands directly in phase 3 (no retroactive throttling)." Phase 5
    reverses it: the adaptation clock now anchors on the product's FIRST
    SCHEDULED date, not its shelf-add date, so a never-scheduled product sits at
    phase 1. The JSDoc was rewritten to document the reversal (it no longer
    asserts the old behavior). This is intentional per the phase-05 spec, not a
    bug fix.
  - Usage anchor: ProductApplicationStats gains firstAppliedDate;
    trackingStore persists firstScheduledDates (productId → skincare date) +
    recordFirstScheduled (idempotent — never moves an existing anchor);
    applyRoutinePlan records it for newly-scheduled products on SAVE (the engine
    stays write-free). virtualApplicationCount now takes firstScheduledDate
    (absent → 0 → phase 1).
  - Phase regression (applyAdaptationRegression, pure): irritancy>=3 products,
    break > 28d → phase 1, break > 14d → phase −1 (floor 0), measured from
    lastAppliedDate; computed never persisted so determinism holds.
  - §5.4: applicationCountFor now consults tracked stats in BOTH cycle modes
    (was dynamic-only) — a fixed-mode user who checks in has real data.
  - Tolerability: collectTolerability → phaseIndex/2 (0|0.5|1.0); scoreCandidate
    multiplies by the *200 band reserved in Phase 4; buildPools + the PM
    relocation rescore pass it, so an adapted product outranks a new same-class
    one for a contested treatment slot.
  - **Phase 3 integration gap fixed here:** buildEngineInputFromStores never
    threaded primaryGoal/secondaryGoal, so the LIVE app was generating
    maintenance plans regardless of the user's goal (and Phase 4 made
    maintenance reserve everything). Now threaded, plus firstScheduledDates.

  Verified: tsc clean; full jest --testPathIgnorePatterns=worktrees →
  1173 passed / 3 known pre-existing failed / 2 todo.

- 2026-07-18: **Phase 5 test expectation changes**, all from the intended
  reversal + §5.4, justified in-test:
  - adaptation.test: virtualApplicationCount tests re-anchored on
    firstScheduledDate; applicationCountFor "fixed mode ignores stats" flipped
    to "uses stats in both modes"; "long-owned adapted → phase 3 via addedAt"
    → now needs an OLD ANCHOR; added the reversal case (never-scheduled → phase
    1 capped).
  - cycling Story 6: "derives virtual count from addedAt" → from the
    first-scheduled anchor (via TrackingInput); "grandfathered phase 3" test
    became "never-scheduled → phase 1" (the reversal); added "adapted beats
    new" tolerability case.
  - determinism-and-safety: the avoid-pair safety loop now varies a random
    goal (maintenance reserves all actives → nothing to check), and a
    deterministic retinoid-cleanser + AHA-serum anchor guarantees a non-vacuous
    pairsChecked > 0. New fixtures.randomGoal helper.

- 2026-07-18: **PHASE 5 SELF-REVIEW PASS — verdict ACCEPT.**

  | # | Check | Verdict | Evidence |
  |---|---|---|---|
  | 1 | No parallel taxonomy | PASS | adaptation logic + trackingStore field; no new taxonomy. |
  | 2 | Single conflict matrix | PASS | untouched. |
  | 3 | isStrongActive invariant | PASS | untouched; regression gates on irritancy>=3 via the same boundary. |
  | 4 | Cumulative cap + rinseOff | N/A | Phase 4 scope; untouched. |
  | 5 | Migrations idempotent | N/A | no migration; firstAppliedDate is additive (null for old stats), firstScheduledDates defaults {} on hydrate. Schema still 2. |
  | 6 | Every AC → passing test | PASS | 10/10 mapped and individually re-run (AC table in log). |
  | 7 | tsc clean; no Math.random / unsorted iteration | PASS | tsc clean; regression computed from injected now; determinism suite green. |
  | 8 | Layer separation | PASS | engine stays write-free (no store imports); the anchor write lives in domain/applyRoutinePlan + trackingStore. |
  | 9 | Documented-decision reversal logged | PASS | JSDoc rewritten + logged above per §6 (would otherwise auto-block). |
  | 10 | Function length | PASS | new functions 10/16/40 lines; getAdaptationStatus grew to 40 (regression branch), still under 50. |

  No deviations beyond the design assumptions (break from lastAppliedDate only;
  regression on phaseIndex not count; anchor for scheduled-not-reserved;
  tolerability in admission scoring only). No FAIL items.

  Carried to Phase 7: reason code adaptation_phase_N already existed; no new
  codes this phase. Phase 6 (dynamic cycling) is next; the anchor/regression
  are independent of it.

- 2026-07-18: **PHASE 6 IMPLEMENTED — dynamic cycling from shelf composition.**
  - cycleState.ts (pure additions): resolveCyclePhase(state, available) degrades
    an exfoliation/retinoid night to recovery when its class is absent, WITHOUT
    touching cyclePhaseIndex (checkInCycle untouched — the index keeps advancing
    mod 4, so returning a product restores the full cycle);
    isDynamicCyclingAvailable + DYNAMIC_UNAVAILABLE_REASON.
    Takes a Set<string>, not ProductFacts, to keep cycleState free of
    eligibility/facts semantics.
  - dailyView.ts: availableCycleClasses computes cycle classes from products
    that are ELIGIBLE (facts.eligible) AND not clinically frozen tonight — a
    PAO-expired or frozen retinoid never keeps retinoid night alive.
    getDynamicCycleStatus returns { phase, available, reasonCode } for the
    Today card; getDailyView's internal dynamicPhase now uses resolveCyclePhase.
  - UI: TodayScreen shows the resolved phase, or a "skin cycling paused — add an
    exfoliant or retinoid" notice when unavailable (check-in still works —
    advisory, not blocking). ProfileScreen confirm-dialog copy now states the
    manual weekly schedule is preserved across a mode switch.

  Verified: tsc clean; full jest --testPathIgnorePatterns=worktrees →
  1191 passed / 3 known pre-existing failed / 2 todo.

- 2026-07-18: **Phase 6 STALE PREMISES** (verified against real code, like
  earlier phases; documented per architecture-review.md §6):
  - §6.2 "enabling dynamic silently discards manual scheduledDays" — FALSE.
    Dynamic mode gates at RENDER (dailyView cycledOut); switchCycleType only
    touches settings + cycleState, never routines. Manual days survive a
    round-trip by construction. Built NO "preserved copy" storage machinery
    (would duplicate state render-gating already keeps intact); added a
    round-trip regression test + enhanced the confirm-dialog copy instead.
  - §6.4 seasonMask purity — already pure (report §1 #6). Test-only: a
    source-invariance pin (same season, weather vs calendar → identical plan)
    over 40 seeded shelves.

- 2026-07-18: **PHASE 6 SELF-REVIEW PASS — verdict ACCEPT.**

  | # | Check | Verdict | Evidence |
  |---|---|---|---|
  | 1 | No parallel taxonomy | PASS | resolution logic; cycleClass data already in actives.json. |
  | 2 | Single conflict matrix | PASS | untouched. |
  | 3 | isStrongActive invariant | PASS | untouched. |
  | 4 | Cumulative cap + rinseOff | N/A | Phase 4 scope; untouched. |
  | 5 | Migrations idempotent | N/A | no migration; no schema change. |
  | 6 | Every AC → passing test | PASS | 9/9 (AC8 idempotency covered by the unchanged pause/idempotent suite, green). |
  | 7 | tsc clean; no Math.random / unsorted iteration | PASS | tsc clean; resolveCyclePhase pure over a Set; determinism + source-invariance pins green. |
  | 8 | Layer separation | PASS | cycleState takes a Set<string> (no facts/store); eligibility derivation lives in dailyView where facts+freeze context are. |
  | 9 | Function length | PASS | new functions 2/8/15/28 lines, all under 50. |
  | 10 | checkInCycle / pause-on-miss unchanged | PASS | additive only; idempotency + pause suites green and unmodified. |

  Two stale premises documented (no machinery built for either). No deviations
  beyond the design assumptions (available = eligible set; resolveCyclePhase
  takes a Set; unavailable is surfaced not enforced). No FAIL items.

  Phase 7 note: DYNAMIC_UNAVAILABLE_REASON = 'dynamic_unavailable_no_actives' is
  a new reason code for the enum. Phase 7 (explainability) is next.

- 2026-07-18: **PHASE 7 IMPLEMENTED — explainability (DecisionLog → UX) + override.**
  - reasonCode/ruleId SPLIT (§4.4 ruling): each pairRule gains a `reasonCode`
    (e.g. rule_retinol_aha → retinoid_acid_conflict); Violation/ViolationSummary
    carry both; resolve.ts frozen item + day_split + keep_with_note emit
    reasonCode (the code) and keep ruleId (provenance). validate.ts finding
    reasonCode was also conflated (used ruleId) — fixed. No rule_* id ever
    lands in a reasonCode now.
  - decisionReasons.ts (new): closed DecisionReasonCode union (46 codes: 30
    JSON + 16 engine) + REASON_TEXT `satisfies Record<DecisionReasonCode,string>`
    (orphan = compile error) + defensive reasonText(). NO template-literal
    member — Phase 4 removed stacking_cap_* synthesis, so the enum is a plain
    closed union (simpler than the spec assumed). Dead 'stacking_cap'
    DecisionAction dropped.
  - Types tightened end-to-end: reasonCode fields on ruleset schema (PairRule,
    ProcedureProductRule, SeasonRule, phototype effects, RulesetMandate) + engine
    carriers (Violation, ViolationSummary, AdaptationStatus/Limit, DerivedLimit,
    DerivedMandate, PrioritizeTarget, RequireMandate, EligibilityRejection,
    ActiveProcedureRule) + plan types (FrozenItem, ReserveItem, PlaceholderSlot,
    DecisionLogEntry) are DecisionReasonCode, not string.
  - Integrity tests: every JSON reasonCode ∈ enum (forward); every engine-source
    reasonCode literal ∈ enum (backward, via source grep); no rule_* in the enum
    or any pairRule reasonCode; reason code stable under a pairRule id rename.
  - Override (§7.3): EngineInput.userOverrides threaded to selectSkeleton, which
    rescues a reserved product into its ELIGIBLE periods (retinoid-in-AM
    structurally impossible via periodsForProduct — no bespoke guard). Admission
    still resolves any conflict (override bypasses minimalism, not same-day
    safety). Persistence + hash in trackingStore + routinePlanActions:
    computeOverrideHash(sorted ids, goals); activeOverrides() drops the set on a
    hash mismatch (shelf/goal change invalidates). generatePlan stays pure.
  - UI: DraftPreviewSheet shows reason text on frozen rows (not rule ids) + a
    new "In reserve" block with per-product reason + "Add anyway" override;
    RoutinesScreen wires onOverride → addOverride + regenerate.

  Verified: tsc clean; full jest --testPathIgnorePatterns=worktrees →
  1207 passed / 3 known pre-existing failed / 2 todo.

- 2026-07-18: **Phase 7 DEVIATIONS + notes** (documented per §6):
  - Override persistence lives in **trackingStore**, not routinesStore as the
    spec's file list said. trackingStore is the established home for
    user→engine runtime inputs (firstScheduledDates is the exact same shape);
    routinesStore holds the routines themselves. Rationale logged.
  - Override is the **conservative reading** (design Assumption 1): it bypasses
    skeleton minimalism (reserve), not the admission ladder's same-day safety —
    a forced-in strong active still day-splits/relocates rather than
    co-scheduling an avoid pair. The acceptance ("brought back + survives
    regen") is satisfied by eligible-period re-inclusion.
  - The enum contains ONLY codes the engine/rulesets emit — the spec's
    speculative conflicts_with_selected / frozen_irritation / period_not_eligible
    / frequency_capped are NOT added (nothing emits them; adding them breaks the
    "no orphan enum member" acceptance). pregnancy_blocked excluded (§4.3 open).
  - Test fixtures that used a pair-rule id as reasonCode (the old conflation)
    updated to real codes: retinoid_acid_conflict (frozen), etc.

- 2026-07-18: **PHASE 7 SELF-REVIEW PASS — verdict ACCEPT.**

  | # | Check | Verdict | Evidence |
  |---|---|---|---|
  | 1 | No parallel taxonomy | PASS | decisionReasons is the single reason-code vocabulary; JSON codes enumerated, not duplicated. |
  | 2 | Single conflict matrix | PASS | pairRules unchanged except +reasonCode; still the one matrix. |
  | 3 | isStrongActive invariant | PASS | untouched. |
  | 4 | Cumulative cap + rinseOff | N/A | untouched. |
  | 5 | Migrations idempotent | N/A | no migration; new persisted fields default safely on hydrate. |
  | 6 | Every AC → passing test | PASS | 11/11 mapped and individually re-run (AC table in log). |
  | 7 | tsc clean; no Math.random / unsorted iteration | PASS | tsc clean; reason-code integrity both directions green. |
  | 8 | Layer separation | PASS | engine takes userOverrides as input (no store access); persistence in trackingStore/domain. |
  | 9 | §4.4 ruling honored: enum decoupled from rule ids | PASS | integrity test forbids rule_* in reasonCode + rename-invariance test. |
  | 10 | Function length | PASS | new code within limits; selectSkeleton override pass is a small loop. |

  Deviations documented above (trackingStore home; conservative override
  reading; enum = emitted codes only). No FAIL items.

  Phase 8 note: the schema bump 2→3 is Phase 8 (goal derivation already runs in
  migrateProfile; peptide re-attribution + confirmation prompts remain). Phase 9
  is the updated test contract.
