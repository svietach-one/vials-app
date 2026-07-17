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
