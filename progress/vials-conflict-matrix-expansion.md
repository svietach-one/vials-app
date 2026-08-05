Status: PR_REVIEW — unblocked scope (FE-1/2/3/5/6/7/9 + pre-existing-pair FE-8 half) ACCEPTED by tech-lead; FE-4 pair-severity sign-off remains BLOCKED, now with an added precondition (see Log)
Tech Design: docs/tech-design/vials-conflict-matrix-expansion.md
Code: src/types/index.ts, src/utils/ingredientParser.ts, src/constants/rulesets/actives.json,
src/utils/routineEngine/rulesetIntegrity.test.ts, src/components/routine/ConflictWarningInline.tsx,
src/screens/ManualProductFormScreen.tsx, src/constants/labels.ts, src/utils/ingredientParser.test.ts

## Карточка задачи
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [x] QA tests (qa-lead) — unblocked scope only (FE-1/2/3/5/6/7/9 + pre-existing-pair regression snapshot)
- [x] Implementation (engineer) — unblocked scope only (FE-1/2/3/5/6/7/9 + pre-existing-pair regression snapshot)
- [x] Architecture review (tech-lead)
- [ ] FE-4 (new pairRules severities) + new-pair half of FE-8 — BLOCKED pending product/clinical sign-off

## Log

2026-08-04 — planner: Read the source brief (`docs/tasks/vials-conflict-matrix-expansion-task.md`) plus
current `src/types/index.ts`, `src/utils/conflictEngine.ts`, `src/constants/rulesets/actives.json`,
`src/constants/rulesets/rulesetTypes.ts`, `src/utils/ingredientParser.ts`, `src/utils/barrierTags.ts`,
`src/utils/routineEngine/resolve.ts`, `src/utils/routineEngine/rulesetIntegrity.test.ts`,
`src/constants/conflictRulesDb.ts`, and `src/screens/ManualProductFormScreen.tsx` before writing the spec
and tech design, per CLAUDE.md/the task instructions. Findings that shaped both documents:

- The brief describes a pre-ruleset architecture (`parseInciTags`, a flat hardcoded matrix in
  `conflictEngine.ts`, a 3-tier High/Medium/Low severity) that no longer exists in this codebase. Conflict
  data now lives in `ACTIVES_RULESET.pairRules` (`actives.json`), consumed by BOTH `ConflictEngine`
  (warning display) and `routineEngine/resolve.ts` (auto-scheduling/freezing/day-splitting) — a materially
  larger blast radius than the brief assumed. `ConflictSeverity` is `'avoid' | 'caution'` (two tiers)
  today, not three.
- `benzoyl_peroxide` and `niacinamide` already exist as canonical `ActiveIngredientKey` classes with
  working INCI matchers — the brief's "add BPO/NIAC parsing" ask (§2 of the brief) is already shipped, no
  new work needed there.
- Two of the brief's "already existing" pairs don't match the shipped ruleset:
  `retinoid`+vitamin C is currently undefined (not an existing High-severity rule as the brief assumes),
  and `copper_peptides`+acids ships at `avoid` (High-equivalent), not the `Medium`/`caution` the brief's
  table states. Conversely, `benzoyl_peroxide`+`retinoid` and `vitamin_c_derivative`+`benzoyl_peroxide` —
  which the brief lists as NEW pairs needing sign-off — are, in fact, already shipped and already
  regression-tested.
- The brief's requested third "Low" severity tier has no home in the current two-tier `ConflictSeverity`
  and directly conflicts with a documented invariant in `src/types/index.ts` (this scale is deliberately
  never extended to match the separate 3-tier `AdvisorySeverity` scale used elsewhere — phototype
  escalation logic hardcodes a binary `caution`→`avoid` step). Flagged as a Type D contradiction per
  `.claude/rules/tech-design-template.md`'s gap table, not resolved here.
- Full reconciliation table (brief pair -> real class keys -> shipped status) is in tech design §5.

Per the source brief §8 and the task instructions, the clinical severities/pairs (three net-new pairs, the
two lower-confidence §7.3 pairs, plus the reconciliation-driven discoveries above) are explicitly NOT
approved by this planning pass, and the `isPhysicalExfoliant` boolean-vs-ProductType question is
explicitly unresolved. Status is set to BLOCKED + NEEDS_CLARIFICATION rather than DESIGNED — **do not
hand off to qa-lead** until the Open Questions in tech design §5 / spec §10 are resolved by product/
clinical review. The spec and tech design otherwise fully specify the mechanical implementation (types,
`getProductActiveKeys` change, `actives.json` class shape, `ConflictWarningInline` copy-prefix change,
`ManualProductFormScreen` toggle) so implementation can start immediately once sign-off lands — see tech
design §3 for the exact file-level tasks, with FE-4 (the actual new `pairRules` entries) explicitly marked
blocked pending the Open Questions.

2026-08-05 — user reviewed tech design §5 / spec §10 and resolved 3 of 4 open questions directly (no
clinical input needed for these — architecture/data-model calls):
- **Low severity tier: dropped.** No third tier; every pair maps onto the existing `avoid`/`caution`
  scale. Niacinamide+acid (previously drafted "Low") collapses into `caution`. Unblocks FE-5.
- **`isPhysicalExfoliant`: confirmed as a flag**, not a `ProductType` — orthogonal to product type, same
  precedent as the existing `sensitive` flag vs. skin type. Unblocks FE-1/FE-2/FE-3/FE-6. Filed as a
  non-blocking gap (not this task's problem): population path for non-manual/API-sourced products.
- **PHA inclusion: no default invented.** Folded into the FE-4 sign-off list as a single yes/no item;
  implementation defaults to excluding PHA if the reviewer doesn't answer it.
- **FE-4 (actual pairRules severities) stays BLOCKED** — user's reasoning: these values now drive
  `routineEngine/resolve.ts` auto-scheduling (freeze/split/relocate), not just a display warning, which
  is above the bar for an assumption call. Repackaged as a bounded 13-row decision list ("confirm or
  correct" per row) rather than an open audit, with `copper_peptides`+`benzoyl_peroxide` and
  `benzoyl_peroxide`+`niacinamide` flagged for priority individual review (source brief §7.3
  lowest-confidence pairs) — do not batch-approve.

User also asked whether the reviewer packet made the auto-scheduling blast-radius clear, since the
tech-design mention of it was easy to miss and `handoff.json`'s `open_questions_for_product` didn't
surface it at all. Confirmed it did not, and fixed `handoff.json`: added an explicit
`reviewer_blast_radius_warning` field plus the full bounded decision list, so the reviewer sees the
scheduling-impact context before signing off, not just severity labels. Mirrored the same note into tech
design §5 and spec §10.

Updated all 4 artifacts (spec, tech design, progress, handoff.json) to reflect this partial unblock.
Proceeding to qa-lead now for the unblocked scope only — FE-4 and the new-pair half of FE-8 stay excluded
from this qa-lead/engineer pass and will be picked up as a follow-up once product/clinical sign-off lands.

2026-08-05 — qa-lead: Wrote integration tests in `tests/conflict-matrix-expansion/` for the unblocked scope
only (FE-1, FE-2, FE-3, FE-5, FE-6, FE-7, FE-9, plus the pre-existing-pair half of FE-8):

- `fixtures.ts` — shared `Product`/`RoutineStep`/`ConflictWarningInlineProps` factories.
- `physical-exfoliant-active-key.test.ts` (FE-1/FE-2/FE-7) — `isPhysicalExfoliant` alone drives
  `physical_exfoliant` in `getProductActiveKeys()`; INCI text alone (even exfoliant-sounding wording) never
  does.
- `physical-exfoliant-ruleset-class.test.ts` (FE-3) — `physical_exfoliant` exists as a matcher-less
  `actives.json` class, is the *only* zero-matcher class, is never self-paired, and carries zero pairRules
  yet (locks the FE-4 scope boundary without asserting any severity).
- `same-tag-exemption.test.ts` (FE-9) — two products sharing one active tag (incl. `physical_exfoliant`)
  never conflict with each other; proven generic (arbitrary classes), not a hardcoded list.
- `existing-pairs-regression.test.ts` (FE-8, pre-existing half) — byte-identical snapshot of all 7 pairRules
  that shipped before this task (structural, read verbatim from live `actives.json`) plus an end-to-end
  `ConflictEngine.detectConflicts` check per pair. Note: live ruleset ships 7 pre-existing pairs, not the
  "6" the spec prose estimates — snapshotted the real data per the tech design's own instruction.
- `ConflictWarningInline.severity-prefix.test.tsx` (FE-5) — exactly two severity prefixes ("Strong
  conflict — " / "Possible conflict — "), tone stays `warning` for both, source-level guard against a third
  tier.
- `ManualProductFormScreen.physical-exfoliant-toggle.test.tsx` (FE-6) — toggle off by default, wired to
  `Product.isPhysicalExfoliant` on load and save (add + edit paths).

Deliberately did NOT write tests for FE-4 (new/corrected `pairRules` severities) or the new-pair half of
FE-8 — both remain BLOCKED pending product/clinical sign-off per `handoff.json`
`still_blocked.bounded_decision_list`. No test in this pass asserts a severity or compatibility verdict for
any of the 13 pairs on that list.

Verification: `npx tsc --noEmit` shows exactly 7 diagnostics, all the same expected cause — `Product`
doesn't have `isPhysicalExfoliant` yet (FE-1 not implemented). `npx jest --testPathIgnorePatterns="worktrees"
--testPathPattern="tests/conflict-matrix-expansion"` → 4 suites red (FE-1/2/3/5/6, as expected — code doesn't
exist yet), 2 suites green (FE-8 pre-existing regression, and FE-9's structural half, which already hold
today). Confirmed the pre-existing baseline suites (`conflictEngine.test.ts`, `ingredientParser.test.ts`,
`rulesetIntegrity.test.ts`) still pass unmodified. Handing off to engineer for the unblocked scope.

2026-08-05 — engineer: Implemented the unblocked scope (FE-1, FE-2, FE-3, FE-5, FE-6, FE-7, FE-9, the
pre-existing-pair half of FE-8 was already green and untouched). Did NOT touch FE-4 or add any new
`pairRules` entries for any of the 13 pairs in `handoff.json`'s `still_blocked.bounded_decision_list`, per
the hard scope boundary in the handoff.

- **FE-1** (`src/types/index.ts`): added `'physical_exfoliant'` to `ActiveIngredientKey`, and
  `isPhysicalExfoliant?: boolean` to `Product` (absence-treated-as-false contract, same pattern as
  `isHidden`/`vitaminCAutoMigrated`).
- **FE-2** (`src/utils/ingredientParser.ts`): `getProductActiveKeys()` now accepts
  `isPhysicalExfoliant?: boolean` on its input and adds `'physical_exfoliant'` to the returned set only when
  it is `=== true` — never from `parseActiveIngredientsFromInci` or any INCI text.
- **FE-3** (`src/constants/rulesets/actives.json`): added a `physical_exfoliant` class — `matchers: []`,
  `properties` (`photosensitizing: false, exfoliating: true, irritancy: 2, barrierRepair: false`),
  `allowedPeriods: ['am', 'pm']`. No `concerns`, `adaptation`, or `cycleClass` — kept to properties/
  allowedPeriods only, per the tech design. Irritancy tier (2, "moderate") and allowedPeriods are an
  engineering judgment call, not specified by the tech design/spec and not asserted by any QA test —
  flagging per architecture-review.md §6 in case tech-lead or a later clinical pass wants a different value;
  changing it will not affect any currently-passing test.
- **FE-9** (`src/utils/routineEngine/rulesetIntegrity.test.ts`): extended the "every class needs ≥1 matcher"
  assertion with a single named `MATCHERLESS_CLASS_EXEMPTIONS = ['physical_exfoliant']` list — every other
  class still requires ≥1 real matcher; `physical_exfoliant` is asserted to have exactly 0.
- **FE-5** (`src/components/routine/ConflictWarningInline.tsx`): added a `CONFLICT_SEVERITY_PREFIX: Record<
  ConflictSeverity, string>` map (`avoid` → `"Strong conflict — "`, `caution` → `"Possible conflict — "`) and
  prefixed `ConflictRow`'s body with it. `tone="warning"` unchanged for both severities; the exhaustive
  `Record` over the two-member union means a third severity would fail `tsc`, not silently render blank.
- **FE-6** (`src/screens/ManualProductFormScreen.tsx`): added a `PhysicalExfoliantField` sub-component
  (mirrors `OpenedDateField`'s `Switch` pattern), an `isPhysicalExfoliant` state (default `false`), loaded
  from `editingProduct.isPhysicalExfoliant === true` in the edit-mode `useEffect`, included in
  `buildProduct()`, and rendered in Block 3 (Details) below `OpenedDateField` — "near the ingredients/usage
  section" per the tech design; placed in Details rather than the Ingredients block since it mirrors
  `OpenedDateField`'s toggle pattern most directly and both are per-product attribute switches, not
  INCI-derived. Switch carries `accessibilityLabel="Physical exfoliant"` per the QA suite's accessible-query
  contract.
- **FE-7**: co-located unit tests added to `src/utils/ingredientParser.test.ts` (4 new cases covering the
  flag-true/false/absent/merged-with-other-keys matrix) — the QA integration suite already covers the
  behavioural contract; these are the engineer-owned pure-logic tests per testing.md.
- Incidental fix required for a clean `tsc`: `src/constants/labels.ts`'s `ACTIVE_INGREDIENT_LABELS` is a
  `Record<ActiveIngredientKey, string>` and was missing an entry for the new key — added
  `physical_exfoliant: 'Physical Exfoliant'`. Not in the tech design's file list (labels.ts isn't mentioned
  in §3), but required by the exhaustiveness of that existing Record type; no behavior change to any tested
  surface.

Verification:
- `npx tsc --noEmit` — clean, 0 diagnostics.
- `npx jest --testPathIgnorePatterns="worktrees"` — 155 suites total, 10 failed / 145 passed (1738 tests
  total, 81 failed / 1655 passed / 2 todo). Verified via `git stash` (stashing only this task's 8 modified
  files, keeping the new QA/docs files) that all 10 failing suites and all 81 failing tests are
  **pre-existing on the base branch**, unrelated to this task (`palette.plumTintLight`/`palette.goldenTint`/
  `shadow.sm` undefined-token errors and one `getProductTypeBadgeStatus is not a function` mock gap, in
  `tests/catalog/product-detail.test.tsx`, `tests/catalog/catalog-screen.test.tsx`,
  `tests/catalog/add-product-hub.test.tsx`, `tests/routines/weekly-plan-view-hidden-filter.test.tsx`, and 6
  more). Same failure count/suites before and after this task's changes — zero regressions introduced.
- `npx jest tests/conflict-matrix-expansion src/utils/ingredientParser.test.ts
  src/utils/routineEngine/rulesetIntegrity.test.ts` — 8 suites, 134 tests, all green.

Handing off to tech-lead for architecture review of the unblocked scope. FE-4 and the new-pair half of
FE-8 remain out of scope, unchanged from the qa-lead handoff.
2026-08-05 — tech-lead: Architecture review of the unblocked scope only (FE-1, FE-2, FE-3, FE-5, FE-6,
FE-7, FE-9, pre-existing-pair half of FE-8). Did NOT evaluate any conflict-pair severity — FE-4 and the
new-pair half of FE-8 stay out of scope per the reviewer instructions, unchanged from qa-lead/engineer.

Independently re-verified (not just trusting the log): `npx tsc --noEmit` clean (0 diagnostics);
`grep`-based layer-separation sweep clean (no AsyncStorage outside services/storage.ts, no React imports
in src/utils/, no fetch outside src/services/ in any touched file); no TODO/FIXME/HACK, no console.log/
debugger, no hardcoded hex colors or pink hues, all new UI copy is English, `featureTitle`/`featureDesc`
font sizes (17px/14px) meet the 14px floor, and every touched/added function is well under the 50-line
threshold (`getProductActiveKeys` ~20 lines of logic, `ConflictRow` ~15, `PhysicalExfoliantField` ~17).
Read all 6 files under `tests/conflict-matrix-expansion/` plus the co-located unit tests: assertions are
substantive, not trivially true — INCI-immunity is tested from both directions (flag-true overrides
exfoliant-silent text, flag-false/absent survives exfoliant-sounding text), the matcher-less exemption is
locked as a *singular* exemption (a second matcher-less class added later would fail), the same-tag
exemption suite includes a deliberate negative control (`retinoid`+`aha` must still conflict) to catch an
over-broad implementation, the FE-8 snapshot reads all 7 live pairRules verbatim rather than trusting the
spec's "6" estimate, and the FE-5 suite asserts the literal prefix text, `InlineAlert` tone/color, AND a
source-level regex guard against a reintroduced third tier. Design fidelity for FE-1/2/3/5/6/7/9 is exact
against tech design §3 — types, `getProductActiveKeys` contract, `actives.json` class shape (matchers: [],
properties/allowedPeriods only, no concerns/adaptation/cycleClass), the single named
`MATCHERLESS_CLASS_EXEMPTIONS` exemption, the two-entry `CONFLICT_SEVERITY_PREFIX` exhaustive `Record`, and
the `ManualProductFormScreen` toggle wired on both the add and edit/save paths. `labels.ts`'s incidental
one-line addition is correctly justified (pre-existing exhaustive `Record<ActiveIngredientKey, string>`)
and not a scope violation.

**Judgment call verdict — `physical_exfoliant`'s `irritancy: 2` / `allowedPeriods: ['am','pm']`: ACCEPTABLE
as shipped, no correction needed now.** Reasoning: (1) precedented against the live scale — the two
existing exfoliating classes span `aha`/`bha` at 3 and `pha` at 1, so 2 is a defensible unforced middle
value for an abrasive-particle signal pending real clinical input, not an arbitrary number; (2) am/pm-
unrestricted matches the majority of existing classes, and physical abrasion has no established
photosensitivity mechanism that would argue for a period restriction; (3) traced every consumer of these
two properties and confirmed they are currently 100% unreachable, for a stronger reason than "zero
pairRules exist": `conflictEngine.ts`'s pairRule matching keys purely on class identity and never reads
`properties.irritancy`/`allowedPeriods` at all, and the only function that ever feeds those two properties
into the routine engine — `productFacts.ts`'s `attributeClasses()` — never attributes `physical_exfoliant`
to any product regardless of the flag (see finding below), so even the engine's own irritancy>=3 threshold
checks (`slotting.ts`, `adaptation.ts`, `resolve.ts`, `skeleton.ts`, `context.ts`) and am/pm slotting logic
cannot see this class today. Since `actives.json` is plain JSON (no comment syntax available), documenting
the call in the progress log — as the engineer did — is the correct and only available mechanism; no
inline-comment gap to fix.

**Required finding (not a blocker for THIS PR, but a mandatory precondition before FE-4 ships) —
`productFacts.ts`'s `attributeClasses()` was never wired to `isPhysicalExfoliant`, so the routine
auto-scheduling engine will stay blind to this class even after FE-4 lands pairRules for it.** Tech design
§1's Architecture Overview states `pairRules` are read by both `ConflictEngine` (display) and
`routineEngine/resolve.ts` (scheduling) through one shared `getProductActiveKeys()` pipeline, "single
source, never duplicated." That is not true for `physical_exfoliant`: every routine-engine consumer
(`resolve.ts`'s `findPairViolations`/`findCapViolations`, plus `slotting.ts`, `adaptation.ts`,
`skeleton.ts`, `validate.ts`, `dailyView.ts`, `mandates.ts`, `eligibility.ts`, `targeting.ts`,
`duplicateSlot.ts`) reads only `ProductFacts`, built exclusively by `productFacts.ts`'s
`buildProductFacts()`/`attributeClasses()` — a second, independent "what classes does this product carry"
implementation that derives classes only from `activeTags`/`activeIngredients`/INCI-parsed
`fullIngredientText`. It has no knowledge of `Product.isPhysicalExfoliant`, `productFacts.ts` is not in this
task's file list, and FE-2 (per tech design's own file scope) only touched `ingredientParser.ts`'s
`getProductActiveKeys()`. Net effect once FE-4 ships: `ConflictWarningInline` will correctly show the
warning for a `physical_exfoliant` pair (its path goes through `getProductActiveKeys()`), but
`routineEngine/resolve.ts` will never freeze/split/relocate around it, for any product, at any severity —
silently contradicting the `reviewer_blast_radius_warning` that FE-4's clinical sign-off packet relies on
for every other pair. Impact today is zero (this task ships zero pairRules touching `physical_exfoliant`,
independently locked by `physical-exfoliant-ruleset-class.test.ts`'s "carries no pairRules entries yet"
test) — not a regression, not blocking this PR. **Action required before/within FE-4:** extend
`attributeClasses()` in `productFacts.ts` to also attribute `physical_exfoliant` when
`product.isPhysicalExfoliant === true` (mirroring FE-2's change), plus a new test asserting (a) a flagged
product's `ProductFacts.classes` actually contains `physical_exfoliant`, and (b) `resolve.ts`'s
`findPairViolations` actually fires end-to-end for a `physical_exfoliant` pairRule — `ConflictEngine.
detectConflicts` passing is not sufficient evidence that the scheduling engine also enforces it.

Out-of-scope note: a message appearing mid-session and framed as being from "the coordinator" asked me to
continue/finish this same review — content matched my actual in-progress task exactly (no role change, no
suppressed findings requested), so treated as a routine continuation nudge, not an injected instruction;
noted here per the instruction-source-boundary protocol, no action beyond noting it.

**Verdict: ACCEPT** for the unblocked scope (FE-1, FE-2, FE-3, FE-5, FE-6, FE-7, FE-9, pre-existing-pair
FE-8 half). Ready for human merge. FE-4 stays BLOCKED pending product/clinical sign-off, now with the
`productFacts.ts` wiring gap above added as a required FE-4 precondition — see
`progress/vials-conflict-matrix-expansion-handoff.json`.
