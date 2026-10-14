Status: PR_REVIEW
Tech Design: — (field-report bugfix, no planned design doc)
Code: branch `fix/precleanse-gap-card` (from origin/dev)

## Карточка задачи
- [x] Product requirements (planner) — N/A, driven directly from field reports
- [x] Technical design (planner) — N/A, see DEVIATION-BY-RULING below
- [x] QA tests (qa-lead) — engineer-written; 2 regression tests authored by tech-lead
- [x] Implementation (engineer)
- [x] Architecture review (tech-lead) — ACCEPTED 2026-10-14 (re-review)

## Log

2026-10-14 — origin. User field report with screenshots: "No Cleanser in your
shelf" rendered directly below two cleanser steps on the Routines screen, and
the blue pre-cleanse banner fired on a night the cleanser WAS scheduled.

**Root cause** (found by enumerating shelf configurations, not from user data):
the cap ladder day-splits an ACID cleanser that won the cleanse slot down to
two nights, while the user's plain cleanser sits in `slotAlternatives` — owned,
eligible, beaten only on ranking. `pmCleanseCoverage` only looked at slot
WINNERS, so the engine asked the user to buy a cleanser she already had.

### DEVIATION-BY-RULING 2026-10-14 (five behaviour changes)

1. **Pre-cleanse gap is filled from the shelf before it is reported.**
   `fillPreCleanseGapFromAlternatives` (generate.ts) promotes same-slot loser
   cleansers onto uncovered nights, intersected with their own resolved
   schedule. Chosen by the user over two alternatives (stay silent / new copy).
   The 2026-07-20 ruling (note and placeholder derive from ONE coverage
   predicate, never both silent) is preserved — the fill runs BEFORE coverage
   is computed. Verified by tech-lead on the FIXED tree over 14,080 deterministic
   + 20,000 random + 20,000 promotion-focused runs: 0 ruling violations, 0
   non-determinism, 0 unaccounted products.

2. **`findPreCleanseReminder` is weekday-aware.** It judged the whole week while
   the screen renders one day, so it told a user looking at Wednesday — with the
   cleanser right below — that nothing followed her micellar water. Scoped to a
   weekday, coverage is "is a cleanser scheduled that night", not week-wide
   maths (an unrestricted `[]` pre_cleanse step otherwise reads as needing all
   seven days).

3. **`balm` joined the moisturiser skeleton slot** (slotting.ts). `gel` was
   deliberately NOT added: it shares LAYERING_ORDER index 6 with `serum`, so
   admitting it would let a gel serum beat an actual cream. The gel-cream case
   is handled by name instead (`reclassifyGelCream`). Lip balms are demoted to
   `other` so they are never scheduled as a twice-daily face step.

4. **Every unfilled REQUIRED structural slot now reports a gap**
   (`structuralGapPlaceholders`, skeleton.ts), replacing
   `neutralMoisturizerPlaceholders`. The old prompt only fired when a treatment
   had been selected, so a retinol cream — reclassified into the treatment pool
   by `isStrongCarrier`, then reserved as `not_needed_for_goals` — left the
   moisturiser slot empty in total silence. **Deviates from**
   `docs/specs/routine-engine-v2.1/phase-04-skeleton-buildup.md` §94-97, which
   scoped the placeholder to a reclassified-vacated slot. Placeholders are
   deduped by (period, productType), ordered mandate > pre-cleanse follow-up >
   generic gap, then sorted by LAYERING_ORDER so an all-gaps period reads as a
   routine.

5. **One read-time normalisation entry point.** `normalizeProductType` composes
   the makeup-remover, gel-cream and lip-balm guards; all four call sites moved
   off `reclassifyMakeupRemover`.

### tech-lead review 2026-10-14 — BLOCKED

> B1: gap fill from slotAlternatives bypassed pair-rule safety (repro: Micellar
> + Glycolic Wash + PHA Wash + Copper Peptide Moisturiser; avoid-level
> rule_copper_peptides_acids on nights 0 and 1). B2: promoted cleanser remained
> in slotAlternatives; Draft Preview "Change" duplicated the product and the
> persisted step id. See review for W1-W6.

**Resolved since:**
- B1 — every candidate night is now re-checked with `findViolationsAgainst`
  against the admitted PM entries, which grow as promotions land. Nights that
  cannot be cleared are left uncovered and fall through to the placeholder.
- B2 — promoted ids are pruned from the evening `slotAlternatives`, and entries
  emptied by the prune are dropped so no dead "Change" affordance remains.
- W1 — `GapCard` takes a `period` and says "No Cleanser in your morning
  routine" instead of asserting something false about the shelf (user's choice
  of three options).
- W2 — placeholders sorted by LAYERING_ORDER after dedupe.
- W3 — lip balms demoted out of the moisturiser slot (user's choice: keep
  `balm` in the slot, exclude lip products by name).
- W4 — CORRECTED after re-review: widening `RANDOM_PRODUCT_TYPES` alone does
  NOT guard either BLOCKER. The tech-lead ran the widened fixtures against the
  pre-fix engine and `determinism-and-safety`, `explainability-invariant` and
  `seasonal-masks` all still passed. The real guard is the new
  `tests/routine-engine/promotion-safety-sweep.test.ts`: 1,500 promotion-shaped
  shelves (always a pre_cleanse step, 2-5 cleansers, active-bearing products),
  asserting no EVENING finding involves a promoted cleanser. Verified to fail
  with 4 avoid-level offenders when the B1 night-clearance check is removed, and
  to pass with it. The widened `RANDOM_PRODUCT_TYPES` is kept as extra coverage,
  not as the guard.
- W5 — this file.
- Both tech-lead-authored regression tests added as
  `tests/routine-engine/precleanse-promotion-safety.test.ts`; they failed on
  the broken tree and pass now.

### tech-lead re-review 2026-10-14 — ACCEPT, no BLOCKER

Independently re-verified: B1 repro now plans `pha_wash` on `[3,4,5]` with no
findings (new findings 12/28 goal+season combos -> 0); 20,000 promotion-focused
shelves went from 36 conflicted runs (29 avoid-level) to 0; stale alternatives
9,152 -> 0 and duplicate-producing swaps 5,952 -> 0.

**W3 resolved after the re-review (user decision 2026-10-14).** Corpus data the
first decision lacked: `assets/corpus/vials_corpus.db` holds 53 `balm`-typed
products — 38 hair balms, 6 lip balms, 3 cleansing balms, ~6 face balms. Since
balms now fill the moisturiser slot, 41 of those would have been scheduled as a
twice-daily FACE step while also suppressing the missing-moisturiser prompt.
Fixed: `reclassifyMakeupRemover` now accepts `balm` as well as `cleanser`, so a
cleansing balm becomes a pre_cleanse (closing a gap in the 2026-07-19 ruling);
`demoteNonFaceBalm` retypes hair/scalp and lip balms to `other`. Guard order is
makeup-remover first, so a "Cleansing Balm" is never demoted out of the routine.
Tests use real corpus names.

**Open / not addressed:** W6 (`fillPreCleanseGapFromAlternatives` is 54 lines,
`generatePlan` 118 — WARNING under the severity matrix, merge allowed) and
NITs. Follow-ups logged, not blocking:
- Swapping the winner on a 3+ cleanser shelf can leave two cleansers
  overlapping on nights 2-6 (no duplicate ids). Needs day reconciliation on
  swap, not a guard.
- A balm fills the `moisturizer` slot but maps to the `seal` StepAction, so a
  balm-only shelf shows a "Seal" step with no "Moisturize" step and no gap card.
- `scheduleFullyCovers` is now dead code.
- SCREENS.md §319 still documents the old "No SPF in your shelf" copy.

### Test baseline
`npx tsc --noEmit` clean. `npx jest --testPathIgnorePatterns="worktrees"`:
9 suites / 61 tests fail, all pre-existing — verified identical on a pristine
`HEAD` export by the tech-lead (`diff` of failing test titles empty). This work
added ~29 passing tests.
