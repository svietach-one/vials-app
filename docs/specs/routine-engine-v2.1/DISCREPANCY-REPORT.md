# V2.1 Package — Codebase Reconciliation Report

Date: 2026-07-17
Branch: `engine-improvements`
Audited against: merged V2 engine (`src/utils/routineEngine/`, 18 suites / 284
tests green at time of audit), `src/constants/rulesets/*.json`, `src/types/index.ts`.

## Summary

The V2.1 package was written against the **V2 design document**, not the
**merged V2 implementation**. The behavioral intents are sound and are
preserved in full. The premises and file targets are substantially stale:
of 9 phases, 4 rest on problems that no longer exist (1, 2, 6, 8), 3 are
accurate (4, 5, and the cycling half of 6), and 2 are structural (7, 9).

Three files the package instructs us to create or edit **do not exist**:
`assets/inci_seed.json`, `InciRepository`, and the "inline table in
conflictEngine". Two files it instructs us to create would have become
**duplicate sources of truth** for data already in `actives.json`.

Nothing in the "may not change" list was changed. Four items are raised as
open questions rather than resolved silently (§4).

---

## 1. Premises removed (problem does not exist in merged code)

| # | Package claim | Reality | Evidence |
|---|---|---|---|
| 1 | Phase 1: "`irritancy` is referenced by rules but defined nowhere — the rule is unimplementable." | Defined for **all 15 classes** as `properties.irritancy`, and read by the resolver. | `actives.json` every class; `resolve.ts:235` |
| 2 | Phase 1: "The legacy `PEPT` tag matches any peptide and raises a vitamin C conflict on harmless signal peptides (Matrixyl)." | **No `PEPT` tag exists** in `ActiveIngredientKey`. `copper_peptides` matchers are already narrow (`copper tripeptide-1`, `ghk-cu`, `copper peptides`) and cannot match Matrixyl. The false-positive bug is not reachable. | `types/index.ts:9-29`; `actives.json` `copper_peptides.matchers` |
| 3 | Phase 1: "V2 introduced new classes without updating the matrix." | `benzoyl_peroxide` and `vitamin_c_derivative` both exist as classes **and** `benzoyl_peroxide` appears in `pairRules`. The stale table is the *legacy* one (`conflictRulesDb.ts`), which the package does not mention. | `actives.json` `pairRules`; `conflictRulesDb.ts:3` |
| 4 | Phase 2: "Path A relocates a product AM↔PM without checking whether the class is allowed in the target period — the engine can legally schedule a retinoid in the morning." | **The guard already exists.** Relocation is gated on `periodsForProduct(...).includes(other)`, and `retinoid.allowedPeriods = ["pm"]`. A retinoid cannot reach AM through any cascade today. | `resolve.ts:420`; `slotting.ts:44`; `productFacts.ts:139` |
| 5 | Phase 2: "The SPF mandate is tied only to phototypes 1–2." | Half true. It fires on phototype 1–2 **or** summer, and the `planContainsProperty: photosensitizing` mechanism the phase asks us to build **already exists and works**. | `actives.json` `phototypeModifiers[1]`; `seasons.json` `summer_spf_mandate`; `mandates.ts:148` |
| 6 | Phase 6: "The weather source for `seasonMask` breaks the '100% local, deterministic' mandate." | The engine core is **already pure**: it receives `seasonMask` as a resolved `EngineInput` field and never fetches. Weather resolution already lives outside the pipeline. | `generate.ts:44`; `seasonMask.ts:9-12` |
| 7 | Phase 8: phototype 3-card → 6-card migration is outstanding. | **Already shipped** in schema v2. `deriveFitzpatrick()` implements the exact mapping the phase specifies (`type_1_2→1`, `type_3_4→4`, `type_5_6→6`). | `migrations.ts:22,34`; `types/index.ts` `UserProfile.fitzpatrick` |
| 8 | Phase 8: `vitamin_c → vitamin_c_pure` migration is outstanding. | **Already shipped** via `legacyKeyMap`, and the `vitaminCAutoMigrated` flag the wizard prompt needs already exists. | `actives.json` `legacyKeyMap`; `migrations.ts:92,107` |
| 9 | Phase 8: "the legacy `PEPT` tag migrates to `peptide_copper`…" | No `PEPT` tag was ever persisted → **migration has no input**. Rewritten to target the reachable case (see §3). | as #2 |
| 10 | Phase 4.3: "Remove Recency as a factor." | Recency is **already not a score factor**. `scoreCandidate` = `boost*1000 + concernHits*100 + potency*10`; `addedAt` appears only in the tiebreak, exactly as the phase requests. | `resolve.ts:121-146` |
| 11 | Phase 9.8: "the existing property test (100 runs → byte-identical plans)". | The existing determinism test runs the input **twice**, not 100 times. | `entryPoints.test.ts:140` |

## 2. Structures the package would have duplicated (collapsed per instruction 3)

| Package artifact | Collapsed into | Why |
|---|---|---|
| `src/constants/activeRegistry.ts` → `ActiveClass`, `ActiveClassMeta` | `actives.json` `classes[].properties` | `actives.json` already carries `irritancy`, `photosensitizing`, `exfoliating`, `barrierRepair`, plus `stacking`, `allowedPeriods`, `concerns`, `adaptation` per class. A parallel TS taxonomy would fork it. |
| `src/constants/conflictMatrix.ts` | `actives.json` `pairRules` | `pairRules` is strictly richer than the proposed matrix: it has `scope`, `resolutions`, potency-based `exceptions`, `explanation`, `suggestion`. A third table (after `pairRules` and `conflictRulesDb`) is a tech-lead BLOCKER under `architecture-review.md` §3. |
| `PERIOD_ELIGIBILITY` table | `actives.json` `allowedPeriods` + `preferredPeriod` | Already implemented, and matches the proposed table **1:1** (see §5). |
| `GOAL_TREATMENT_MAP` (new file) | `actives.json` `goals` block | The inverse index (`classes[].concerns`) already exists and already drives goal-match scoring. The new block adds the priority ordering that the inverse index cannot express. |

**Consolidation direction:** `conflictRulesDb.ts` `INGREDIENT_CONFLICT_RULES`
(4 legacy rules) is deleted; `ConflictEngine` reads `pairRules`. One matrix.

## 3. Renames and retargets

| Package says | Corrected to | Reason |
|---|---|---|
| `assets/inci_seed.json`, `InciRepository` | `src/constants/rulesets/actives.json` `matchers` | Neither exists. INCI data lives in `assets/corpus/vials_corpus.db` (26 MB SQLite); active *attribution* is regex-matcher-driven in the ruleset. |
| `peptide_copper` | `copper_peptides` | Existing key, **persisted in user data** as an `activeTags` value. Renaming it would require a migration for zero benefit. |
| `ceramide`, `centella`, `hyaluronic`, `spf` | `ceramides`, `cica`, `hyaluronic_acid`, `spf_filters` | Same — existing persisted class keys. |
| severity `high` / `medium` | `avoid` / `caution` | `ConflictSeverity = 'avoid' \| 'caution'` is used across engine, UI, and 284 passing tests. Mapped `high→avoid`, `medium→caution`. |
| `maxActivesPerPeriod` | per-class `stacking.maxPerPeriod` + `sharedCapWith` | No global cap by that name exists. The intent (*"peptides must not consume the irritant cap"*) is preserved and made structural — see §4.1. |
| "Step 5 greedy admission", "Step 6 mandates" | `resolve.ts` `runPeriodPass` / `mandates.ts` `applyMandates` | Step numbers are design-doc-only; the code has named modules. |
| `skinIssues[]` | `concerns: SkinConcern[]` | Actual field name; 9 values (`acne`, `dryness`, `wrinkles`, `sensitivity`, `redness`, `eczema`, `hyperpigmentation`, `pores`, `dark_spots`). |
| Adaptation "Phase 1/2/3" | `phaseIndex: 0 \| 1 \| 2` | Existing type. Prose keeps 1/2/3; acceptance criteria cite the real values. |
| Phase 8 "PEPT → peptide_copper" migration | `copper_peptides` tag whose INCI lacks copper markers → `peptide_signal` | The only reachable form of the intent: wizard-confirmed tags are persisted, INCI attribution is derived at read time. |

## 4. Open questions (intent conflicts with real code — NOT resolved silently)

### 4.1 `isStrongActive = irritancy >= 3` newly caps pure vitamin C — RESOLVED 2026-07-17

**Resolved:** `vitamin_c_pure` moves to irritancy 3, and the cap is intended.

Superseded in scope by the **cumulative active exposure rule** (user directive,
2026-07-17), which amends Phases 1 and 4 and makes the question moot: per-class
`stacking.maxPerPeriod` is subsumed by a cumulative cap keyed on
`irritancy >= 3` across all slots. Pure vitamin C is capped either way; the
mechanism is now the cumulative rule rather than a per-class block.

Consequences of `vitamin_c_pure: 2 → 3`, all accepted and all conservative:
subject to the cumulative cap; excluded from treatment candidates under the
`barrier_repair` goal (Phase 3); subject to break regression (Phase 5);
reclassified as a treatment candidate in any leave-on format (Phase 4).

See §7 for the full cumulative rule and the sub-questions it raises.

### 4.2 `pm_preferred` for AHA/BHA **loosens** a safety constraint — RESOLVED 2026-07-17

**Resolved (user):** dropped. AHA/BHA stay hard `["pm"]`; PHA stays
`["am","pm"]` as the morning-safe exfoliant path. Two reasons, both binding on
future design work:

1. An SPF step in the *plan* is not verifiable sun protection on *skin* — a
   planned step cannot gate a safety exception (do-no-harm principle).
2. The unconditional invariant "no acid in AM, ever" is property-testable
   without conditional states; `pm_preferred` would trade that for a
   plan-dependent eligibility no static table can express.

Original finding kept below for the record.

The package proposes `aha`/`bha` = `pm_preferred` ("AM allowed only if the
routine contains SPF"). Today both are `allowedPeriods: ["pm"]` — **AM is
never permitted at all**. Implementing `pm_preferred` therefore *relaxes* the
current rule. This collides with shared principle #3 (do-no-harm > efficacy)
and #7 (all V2 mandates remain in force). Phase 2 AC #4 ("AHA in AM is possible
only when the same AM routine contains an SPF step") encodes the loosening.
Recommend dropping it and keeping AHA/BHA PM-only; needs your call.

### 4.3 Pregnancy/lactation is a new subsystem, not a flag

Phase 3 refers to "Pregnancy/lactation (profile flag)" as though it exists.
**Nothing pregnancy-related exists anywhere in the codebase.** Delivering
`PREGNANCY_BLOCKED` requires: a new `UserProfile` field, onboarding + profile
editor UI, a migration, and a hard-block path in the engine — plus a product
decision about asking that question at all. This is its own feature, not a
sub-bullet of Phase 3. Recommend splitting it out; kept in Phase 3 as
`[OPEN]`-marked and excluded from the phase's acceptance until you decide.

### 4.4 A closed `DecisionReasonCode` enum must absorb dynamic codes — RESOLVED 2026-07-17

**Resolved (user):** the proposed approach is confirmed, with one sharpening —
the enum stays **decoupled from pair-rule IDs**. Reason codes are decision
*categories*; rule IDs are *data* and may change freely (Phase 1 already
deleted `rule_vitc_niacinamide` and added two). A log entry may carry `ruleId`
as an optional payload field, never as the enum value. Phase 7 implements:
`reasonCode` on each `pairRules` entry, `resolve.ts:410` emits it and keeps
`ruleId` as provenance, template-literal member for `stacking_cap_*`, integrity
test for JSON ↔ enum agreement.

Original finding kept below for the record.

Phase 7 wants a closed union with `satisfies Record<DecisionReasonCode, string>`.
Three obstacles:

- **(a)** **22 reason codes already exist** in the ruleset JSON
  (`phototype_pih_risk`, `summer_photosensitizer_spf`, `meso_spf_mandatory`, …)
  plus code-level ones (`product_hidden`, `pao_expired`, `no_allowed_period`,
  `relocation_rejected`) — none of which the phase's proposed enum lists. They
  originate in JSON, so the enum cannot be their source of truth.
- **(b)** `resolve.ts:246` **synthesizes** codes at runtime:
  `` `stacking_cap_${cls.key}` ``. A plain string union cannot express this
  without a template-literal type.
- **(c)** **`reasonCode` and `ruleId` are conflated today.** `resolve.ts:410`
  writes `reasonCode: primary.ruleId` — so `FrozenItem.reasonCode` currently
  receives *pair-rule IDs* (`rule_retinol_aha`, `rule_vitc_pure_acids`, …) and
  synthesized `stacking_cap_*` IDs, neither of which is a reason code. The
  field mixes two vocabularies. Closing the enum forces a decision the phase
  never contemplated: either the enum absorbs every pair-rule ID (coupling the
  reason vocabulary to the rule registry, and breaking the moment a rule is
  renamed — note Phase 1 *deletes* `rule_vitc_niacinamide`), or `pairRules`
  gain their own `reasonCode` field and `resolve.ts:410` stops borrowing
  `ruleId`.

Proposed resolution in the rewritten Phase 7: enum = existing ∪ new; a
template-literal member for the stacking family; add `reasonCode` to
`pairRules` and split it from `ruleId` at line 410; an integrity test
(extending `rulesetIntegrity.test.ts`) asserting JSON ↔ enum agreement in both
directions. This is a bigger change than "add a constants file" — confirm the
approach before Phase 7 starts.

## 5. Notable: Phase 2's table is already correct

`PERIOD_ELIGIBILITY` as proposed vs. `actives.json` as shipped:

| Class | Package | Shipped | Match |
|---|---|---|---|
| retinoid | `'pm'` | `["pm"]` | identical |
| spf | `'am'` | `["am"]` | identical |
| pha, benzoyl_peroxide | `'both'` | `["am","pm"]` | identical |
| vitamin_c_pure | `'both'`, "AM preferred via slotting priority" | `["am","pm"]` + `preferredPeriod: "am"` | identical, including the mechanism |
| aha, bha | `'pm_preferred'` | `["pm"]` | **shipped is stricter** → §4.2 |
| everything else | `'both'` | `["am","pm"]` | identical |

## 6. Behavior changes that reverse a *documented* decision

Per `architecture-review.md` §6, an undocumented deviation is an automatic
BLOCKER. One rewritten phase deliberately reverses a decision recorded in a
code comment, and the progress log must say so:

- **Phase 5** reverses `adaptation.ts:31-35`: *"A product owned long before
  tracking shipped lands directly in phase 3 (no retroactive throttling)."*
  The usage-anchor intent requires the opposite (never-applied → Phase 1).
  The rewritten phase carries an explicit instruction to update that JSDoc and
  log the reversal in `progress/routine-engine-v2-cosmetologist.md`.

## 7. Cumulative active exposure rule (user directive, 2026-07-17)

Amends Phases 1 and 4. An active class is a property of a **product**, not of a
**slot** — the same class arriving via serum, toner, or cream is governed by one
cumulative rule set.

1. **Mild classes (`irritancy <= 2`)** — peptides, niacinamide, vitamin C
   derivatives, hydrators, azelaic acid, PHA: no cumulative restriction, any
   number per period, any slot. Class-dedup applies **only** to
   treatment-candidate selection; a peptide cream in the moisturizer slot
   alongside a peptide serum treatment is valid and desirable.
2. **Strong classes (`irritancy >= 3`), leave-on:**
   - **Cumulative period cap:** at most **one** leave-on product carrying any
     strong class per period, counted across *all* slots.
   - **Format reclassification:** any leave-on product carrying a strong class
     is a **treatment candidate** regardless of format (acid toner, acid cream
     = treatments). It inherits treatment frequency caps and can never inherit a
     structural slot's daily frequency. The structural slot then needs a neutral
     alternative from the shelf, or renders a placeholder.
3. **Rinse-off exemption:** `rinseOff: true` products carrying strong classes do
   not consume the cap; log an info-level note instead.

Reason code: `cumulative_active_cap` (lower_snake_case — the directive wrote
`CUMULATIVE_ACTIVE_CAP`, normalized to match the 22 codes already in the
rulesets; see §3).

### Sub-questions resolved as documented assumptions

These follow from the directive but are not stated in it. Flagged here rather
than resolved silently; all resolve conservatively.

- **8.1 — The cumulative cap subsumes per-class `stacking`.** "At most one
  strong leave-on per period across all slots" is strictly stronger than every
  existing per-class `maxPerPeriod: 1`. Sequencing: **Phase 1** adds `stacking`
  to `vitamin_c_pure` to satisfy the `isStrongActive` invariant against the
  shipped mechanism; **Phase 4** replaces per-class `stacking` wholesale with
  the cumulative cap and restates the invariant as *"subject to the cumulative
  cap iff `irritancy >= 3`"*. The Phase 1 addition is deliberate short-lived
  churn — it keeps each phase independently green.
  *Alternative:* skip the Phase 1 stacking edit and defer the whole invariant to
  Phase 4. *Reason for choice:* the Phase 1 review checklist requires the
  invariant to hold at Phase 1.

- **8.2 — AHA + PHA in one period becomes legal.** Today `aha.sharedCapWith`
  includes `pha`, capping the group at 1. Under the directive PHA is mild
  (irritancy 1) and carries no cumulative restriction, so an AHA serum + PHA
  toner in one PM becomes permitted where it is blocked today. This is a
  **loosening**, and the directive's mild/strong split requires it.
  *Assumption:* accepted — PHA is the gentlest exfoliant and the pair carries no
  `pairRules` conflict. *Flag:* if unintended, PHA needs either irritancy 3 or
  an explicit exfoliant-family cap; it cannot stay mild and stay capped.

  **LANDED IN PHASE 1, not Phase 4 (2026-07-17).** This entry assigned the
  change to Phase 4, where per-class `stacking` is removed wholesale. In
  practice the Phase 1 invariant (`stacking` iff `irritancy >= 3`) fails
  immediately on `pha`, which ships a stacking block at irritancy 1 — so the
  block had to go in Phase 1. Removing `pha` from `aha`/`bha`'s `sharedCapWith`
  had to go with it: leaving it there makes the cap admission-order dependent
  (PHA-first blocks a later AHA; AHA-first does not block PHA), which is a
  determinism defect, not a safety tradeoff. Locked by two regression tests in
  `resolve.test.ts` covering both admission orders. Exfoliant exposure is still
  capped by `phototype_pih_exfoliant_cap` and `summer_uv_exfoliant_limit`, which
  target `properties.exfoliating` and are untouched.

- **8.3 — "Treatment frequency caps" for non-exfoliating strong classes.** The
  directive specifies "exfoliating <= 2 days/week, 48h rest", which only covers
  exfoliants. Retinoid and pure vitamin C are strong but not exfoliating.
  *Assumption:* a reclassified leave-on inherits the caps its own classes
  already declare — exfoliants get the exfoliant cap, retinoids keep their
  existing `adaptation` phase caps, and the invariant enforced is the narrower
  "never inherits a structural slot's daily frequency". No new frequency table.

- **8.4 — `rinseOff` derivation.** The directive says "derived from product
  type". `ProductType` has 18 members; only `cleanser` and `makeup_remover` are
  unambiguously rinse-off. `peeling` and `mask` are ambiguous (peel gels rinse,
  peel pads do not; sleeping masks are leave-on).
  *Assumption:* `rinseOff: true` for `cleanser` and `makeup_remover` only.
  *Reason:* do-no-harm — an ambiguous product consumes the cap rather than
  escaping it. `rinseOff` is derived, not persisted, so a future per-product
  override is non-breaking.

## 8. What did not change

Every item on the protected list survives intact: skeleton build-up replacing
greedy admission (Phase 4 — premise confirmed accurate, `runPeriodPass` is
genuinely greedy); goal model as Step 0 (Phase 3); retinoid never in AM
(Phase 2 — already true, now locked by a property test); SPF driven by
photosensitizing actives (Phase 2 — mechanism exists, trigger widened);
peptide subclasses copper/signal/neuro (Phase 1 — under existing key names);
`isStrongActive = irritancy >= 3` only (Phase 1 — §4.1); phase regression
after breaks (Phase 5); DecisionLog reason codes + override (Phase 7 — §4.4);
migration idempotency (Phase 8 — infra already guarantees it).
