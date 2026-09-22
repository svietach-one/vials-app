# Vials — Conflict Resolution Scope (Slot vs Day)
Date: 2026-09-21
Author: planner-agent
Jira: N/A (kebab-case task slug per agent-layer-protocol.md: `conflict-resolution-scope`)
Status: DRAFT

## AI-SDLC Flags
```
backend_layer:  false
frontend_layer: true
infra_changes:  false
```

## 1. Problem Statement

The conflict warning users see on the Routines screen (`ConflictEngine.detectConflicts`, rendered by
`ConflictWarningInline`) treats every ingredient-pair conflict as day-level binary: it warns whenever both
conflicting actives are scheduled on the same day, regardless of whether they land in the same AM/PM period
or in different ones. Dermatologically, conflicts fall into two different mechanisms that respond
differently to AM/PM separation. Degradation/pH-mechanism pairs (e.g. Vitamin C + Retinol) are fully
resolved by keeping the two actives in separate periods — they never coexist on skin, so nothing degrades.
Additive-irritation pairs are not resolved by AM/PM separation alone, because irritation load accumulates
across the day regardless of period. Today the engine cannot tell these two cases apart, so a user who
correctly splits a degradation-type pair into a morning routine and an evening routine — a textbook-correct
routine — still sees a conflict warning. That false positive erodes trust in the warning system.

## 2. Goals

- Every conflict pair rule in the ruleset (both live and still-gated draft rules) carries an explicit,
  tested `resolutionScope` classification (`'slot'` or `'day'`) instead of behaving as day-level-binary with
  no way to say otherwise.
- A `'slot'`-scoped pair's warning fires only when both conflicting steps land in the same AM/PM period on
  the same day; splitting the two products across the morning and evening routines clears the warning.
- A `'day'`-scoped pair's warning keeps firing whenever both conflicting steps are scheduled on the same
  day, in any period — identical to today's behavior.
- Zero warning-behavior change for any pair that ships today: every existing (and currently-gated draft)
  pair explicitly classifies as `'day'` in this task. Reclassifying specific pairs to `'slot'` is a
  separately-tracked, product/clinical-sign-off-gated follow-up (§10).
- When a `'slot'`-scoped pair does fire (the same-period case), its suggestion copy becomes actionable,
  naming the specific fix the engine now knows about (move one product to the other routine).

## 3. Non-Goals (explicitly out of scope)

- Changing which pairs exist or what severity they carry. This task adds one new axis (`slot` vs `day`) to
  pairs that already exist or are already drafted; it does not add, remove, or re-severity any pair. That
  work belongs to `vials-conflict-matrix-expansion`'s still-BLOCKED FE-4 and to `proposedPairRules.ts`'s
  still-gated rows (§10).
- Flipping any real pair's `resolutionScope` to `'slot'`. Every pair ships classified `'day'` (today's exact
  behavior) in this task. Deciding which pairs should actually become `'slot'` is routed to product/clinical
  sign-off (§10), not decided here.
- Changing the routine auto-generation/scheduling engine (`routineEngine/resolve.ts`). That engine already
  has its own, separately-authored mechanism for whether a pair can be resolved by relocating a product to
  the other period (the `resolutions` array's `'separate_periods'` entry). This task does not read, write,
  or otherwise touch it — the display engine's and the scheduling engine's period-scoping concepts stay
  decoupled after this ships.
- Promoting a pair's scope from `slot` back to `day` for users with reactive-skin conditions
  (eczema/rosacea). Explicitly unconfirmed and flagged "not building until confirmed" by the source research
  — left as an Open Question / future task (§10).
- Reconciling or renaming the pre-existing `PairRule.scope` field (`'same_period' | 'same_day' | 'anywhere'`,
  which governs weekday-overlap checks inside the scheduler). The new `resolutionScope` field is
  deliberately separate vocabulary — a product decision made during planning, not an oversight.
- Any change to the severity-prefix copy mechanic ("Strong conflict — " / "Possible conflict — ") shipped by
  `vials-conflict-matrix-expansion`. This task's copy change is additive to it (a smarter suggestion string
  for the same-period `slot` case only), not a replacement.

## 4. User Stories

### Story 1: Splitting a slot-resolvable pair across AM/PM clears the warning
As a user, I want conflict warnings to go away when I correctly split two slot-resolvable actives into
separate morning/evening routines, so a textbook-correct routine isn't flagged as if it were wrong.

**Acceptance Criteria:**
- [ ] Given a pair rule classified `resolutionScope: 'slot'`, when one product is scheduled in the morning
  routine and the other in the evening routine on the same day, then no conflict warning renders for that
  pair.
- [ ] Given the same pair, when both products are scheduled in the same routine (both morning, or both
  evening) on the same day, then the conflict warning still renders.
- [ ] Given the app ships this task with every pair defaulted to `'day'` (§2), when no pair is yet classified
  `'slot'`, then this story's behavior is present in the code but not yet user-visible for any real pair —
  verified via a test fixture rule, not a live one (§10 gates turning any real pair `'slot'`).

### Story 2: Additive-irritation pairs keep warning regardless of AM/PM split
As a user, I want the app to keep warning me about irritation-accumulating pairs even when I split them
across morning and evening, so I don't unknowingly over-irritate my skin by assuming AM/PM separation is
always enough.

**Acceptance Criteria:**
- [ ] Given a pair rule classified `resolutionScope: 'day'` (the default for every pair shipped today), when
  the two products are scheduled in different routines (one AM, one PM) on the same day, then the conflict
  warning still renders, identical to today's behavior.
- [ ] Given the same pair scheduled on two different days entirely, when conflicts are computed, then no
  warning renders — unchanged from today's existing different-day rule.

### Story 3: Actionable copy for a same-period slot conflict
As a user seeing a slot-resolvable conflict warning, I want the suggestion to tell me specifically that
moving one product to my other routine would resolve it, so I know exactly what to do.

**Acceptance Criteria:**
- [ ] Given a `resolutionScope: 'slot'` pair with both products in the same morning routine, when the
  warning renders, then its suggestion text names the evening routine as the place to move one product.
- [ ] Given the equivalent case in the evening routine, when the warning renders, then its suggestion text
  names the morning routine.
- [ ] Given a `resolutionScope: 'day'` pair firing in any configuration, when the warning renders, then its
  suggestion text is unchanged from today's per-rule copy — the new actionable phrasing applies only to the
  slot/same-period case.

### Story 4: No regression for existing pairs
As an existing user, I want every conflict warning I see today to keep behaving exactly the same after this
ships, so a routine I've already reviewed doesn't silently change meaning.

**Acceptance Criteria:**
- [ ] Given the 7 live pairs and the severity-prefix mechanic already shipped, when conflicts are computed
  before and after this task ships, then trigger condition, severity, and rendered copy are identical for
  every one of them (all default to `resolutionScope: 'day'`).
- [ ] Given the 4 draft rows in `proposedPairRules.ts`, when `PROPOSED_V12_PAIR_RULES_ENABLED` is eventually
  flipped on (a separate, still-gated decision), then those rows also carry an explicit
  `resolutionScope: 'day'` default rather than being left unclassified.

## 5. UX / Behaviour

No new screen, modal, or navigation entry point. The conflict row keeps rendering through the existing
amber (`InlineAlert tone="warning"`) styling on the Routines screen, with the existing severity prefix
unchanged. The only visible change — and only once a pair is eventually flipped to `'slot'` by a future
sign-off pass — is the suggestion line for a same-period `slot` conflict, which names the other routine
instead of the pair's generic stored suggestion text. No new loading, empty, or error state: this is pure
logic and copy branching over data that's already loaded today.

## 6. Data Requirements

- New data needed: a required `resolutionScope: 'slot' | 'day'` field on every entry in
  `ACTIVES_RULESET.pairRules` (`actives.json`) and in `PROPOSED_V12_PAIR_RULES` (`proposedPairRules.ts`).
- Existing data consumed: `Routine.timeOfDay` (period is a property of the containing routine — `RoutineStep`
  itself carries no period field), and each step's already-resolved active-ingredient classes (unchanged).
- Data retention: identical to the rest of the ruleset — static, bundled, local-only, no new retention
  policy.

## 7. Dependencies

- Depends on spec: none. Builds entirely on the already-shipped ruleset/`ConflictEngine`/
  `ConflictWarningInline` system from `vials-conflict-matrix-expansion`; aware of, but not blocked by, that
  task's still-open FE-4.
- Blocks: none identified. The deferred `'slot'` reclassification work (§10) is a follow-up, not something
  this task blocks.
- External services: none — fully local, per `CLAUDE.md`.

## 8. Security & Privacy

- Authentication required: no (no accounts in Phase 1).
- Data sensitivity: none beyond the existing local product/routine data. `resolutionScope` is a static
  ruleset classification, not user data.
- Compliance considerations: none new.

## 9. Success Metrics

No production install base or in-feature analytics yet, so success is engineering/QA completeness:
- Every `pairRules` entry (live and proposed) has an explicit, tested `resolutionScope` — zero pairs left
  unclassified.
- 100% of pre-existing `conflictEngine`, `ConflictWarningInline`, and ruleset-integrity test assertions
  continue to pass unmodified (zero regressions).
- `npx tsc --noEmit` and the full `npm test` suite are clean, per `.claude/rules/testing.md`.

## 10. Open Questions

- [ ] Which specific pairs, if any, should reclassify from `'day'` to `'slot'` — the source research's §4
  table, cross-checked against each shipped rule's current `resolutions` array (full annotated table in
  `progress/conflict-resolution-scope-handoff.json`) → owner: product/clinical reviewer, same gate as
  `PRD_Spec.md` §6.
- [ ] Whether skin-condition modifiers (Phase 8 eczema/rosacea logic) should promote a `'slot'`-scoped pair
  back to `'day'`-equivalent behavior for reactive-skin users → owner: product/clinical reviewer. Explicitly
  deferred this pass — not building until confirmed.
- [ ] This task's `slot`-vs-`day` sign-off overlaps in subject matter (not in question type) with
  `vials-conflict-matrix-expansion`'s still-open FE-4 (pair existence/severity) and `proposedPairRules.ts`'s
  gated rows. Flagged for reviewer awareness; the two decision lists are kept intentionally separate, not
  merged, per product decision → owner: product/clinical reviewer, to sequence at their discretion.
