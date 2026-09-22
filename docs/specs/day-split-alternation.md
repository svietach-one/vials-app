# Vials — Day-Split Cycling for Competing Strong Actives
Date: 2026-09-22
Author: planner-agent
Jira: N/A (kebab-case task slug per agent-layer-protocol.md: `day-split-alternation`)
Status: DRAFT

## AI-SDLC Flags
```
backend_layer:  false
frontend_layer: true
infra_changes:  false
```

## 1. Problem Statement

`skeleton.ts`'s treatment-slot picker (`pickTreatment`) admits only one strong leave-on active
(irritancy >= 3) per period into an auto-generated routine. When a user owns both a retinoid and an
AHA/BHA exfoliant, both are `allowedPeriods: ["pm"]`-only in `actives.json` — there is no AM slot to
separate them into, so only one is ever picked by goal ranking; the other is silently reserved with the
generic `cumulative_active_cap` reason and never scheduled. The only existing way to get both into a
routine is the phase-07 "Add anyway" override, which re-admits the loser but does not itself assign
non-overlapping days — planning-phase tracing confirmed the existing admission ladder (`pickSplitDays`/
`attemptDaySplit`) does not produce a working split for two independently frequency-capped actives; it
collides on the same preferred days and the loser freezes instead. Users who own and use both products for
different goals (e.g. anti-aging retinoid + brightening AHA) have no automatic path to safely alternating
them across nights of the week, a standard, well-understood skincare pattern the app's own `scheduledDays`
mechanism already models everywhere else.

## 2. Goals

- `skeleton.ts` detects when 2+ candidates from different `cycleClass` values (retinoid vs exfoliant, the
  only pairing this applies to today) compete for one period's treatment slot, and tags the losing
  candidate with a distinguishable reason (`cycle_class_rival`) instead of the generic
  `cumulative_active_cap`, carrying enough data (which winner it lost to, which period) for the UI to act on.
- Draft Preview surfaces a prominent, dismissible prompt card — not buried in the collapsible "In reserve"
  section — offering "Alternate automatically" and "Keep only [winner]."
- Doing nothing, or tapping "Keep only [winner]," preserves today's exact single-winner/reserve behavior —
  zero default behavior change.
- Tapping "Alternate automatically" schedules both products in the same period on complementary,
  non-overlapping days, each side capped at `min(the two products' own current frequency caps)` — never
  exceeding either product's own safety-derived cap (retinoid adaptation-phase ramp; exfoliant treatment
  cap).
- The choice persists across future routine regenerations so the user is not re-asked every time they
  reopen Draft Preview, reusing the existing phase-07 override persistence mechanism.
- Existing day-level conflict warnings (`rule_retinol_aha`/`rule_retinol_bha`, both `resolutionScope: 'day'`)
  correctly stop firing once the pair is genuinely on non-overlapping days — verified by a regression test,
  not new conflict-engine logic.

## 3. Non-Goals (explicitly out of scope)

- Reviving `cycleState.ts`'s check-in-based dynamic-cycling engine (`performDailyCheckIn`,
  `switchCycleType`, `dailyView.ts`'s `cycledOut`/`getDynamicCycleStatus`), or any Settings toggle for it.
  Stays fully dead/untouched, per the human's explicit decision.
- AM/PM period splitting for this pair. Architecturally impossible: retinoid/aha/bha are all
  `allowedPeriods: ["pm"]` only.
- Any change to `resolutionScope` or the `conflict-resolution-scope` task's bounded decision list — a
  separate, already-shipped concern this task only regression-verifies against, never modifies.
- Rewriting `resolve.ts`'s general-purpose pair-rule/cap resolution ladder for any pair other than a
  detected, user-approved cycle-class rivalry. This task adds one new, narrowly-triggered resolution path;
  it does not change how any other conflict or cap is resolved.
- Splitting at the larger of the two products' caps, or any ratio other than the smaller-of-both cap
  (decided: always split at `min(cap)`, e.g. both sides get 2 nights/week even once a ramped retinoid would
  otherwise qualify for 4).
- Adding new engine visibility into the currently-saved `Routine[]` to detect a pre-existing manual
  `scheduledDays` edit. "Alternate automatically" always overwrites both products' current schedule; no
  merge or preservation logic is built for this case.
- Offering the prompt for more than one rival at a time. Only the single best-ranked candidate of the
  losing `cycleClass` is ever detected; any other same-class product keeps today's plain
  `cumulative_active_cap` reserve treatment.
- Any new Settings or Profile screen UI. The only new UI is the Draft Preview prompt card.

## 4. User Stories

### Story 1: Detecting a cycle-class rival instead of a generic cap loser
As a user with both a retinoid and an AHA (or BHA) product on my shelf, I want the app to recognize these
two products are structurally competing for one nightly slot, so it can offer an alternating schedule
instead of silently dropping one.

**Acceptance Criteria:**
- [ ] Given a shelf with a retinoid and an AHA product both eligible for the PM treatment slot, when the
  routine is generated, then the losing product's reserve entry carries reason `cycle_class_rival` (not
  `cumulative_active_cap`) and identifies which admitted product it lost to.
- [ ] Given a shelf with a retinoid and a same-class competitor (e.g. two retinoid products), when
  generated, then the existing `duplicate_function` reserve reason is unchanged.
- [ ] Given a shelf with two exfoliants (one AHA, one BHA) both losing to the same retinoid winner, when
  generated, then only the single best-ranked exfoliant is tagged `cycle_class_rival`; the other keeps
  today's plain `cumulative_active_cap` reason.

### Story 2: Being offered an automatic alternating schedule
As a user viewing my Routine Draft, I want a clear, prominent prompt when two of my products can't coexist
nightly, so I can choose to use both instead of losing access to one.

**Acceptance Criteria:**
- [ ] Given a generated draft with a detected cycle-class rival, when Draft Preview renders, then a
  dedicated prompt card renders outside the collapsible "In reserve" section, naming both products and
  offering "Alternate automatically" and "Keep only [winner name]."
- [ ] Given the same draft, when the user does not interact with the card, then the draft is unchanged from
  today: the winner is scheduled, the loser is in reserve with "Add anyway" available exactly as before.
- [ ] Given a draft with no cycle-class-rival case, when Draft Preview renders, then no prompt card renders.

### Story 3: Accepting the alternating schedule
As a user, when I tap "Alternate automatically," I want both products added to my routine on different,
non-overlapping nights, so I get the benefit of both without exceeding either product's safe frequency.

**Acceptance Criteria:**
- [ ] Given the prompt card, when the user taps "Alternate automatically," then both products are admitted
  into the plan with non-overlapping `scheduledDays`, each sized to `min()` of the two products' own current
  frequency caps.
- [ ] Given the same tap and a subsequent commit (save), when the user later reopens Draft Preview without
  any other shelf change, then the same two products are admitted with a schedule again — the prompt does
  not need to be re-answered from scratch.
- [ ] Given one or both products already had a manually-set `scheduledDays` value (via the existing weekly
  schedule picker) before this prompt appeared, when the user taps "Alternate automatically," then the new
  complementary days replace the prior value for both products.

### Story 4: Keeping today's behavior
As a user, when I tap "Keep only [winner]," I want the routine to behave exactly as it does today, so
declining has no surprising side effects.

**Acceptance Criteria:**
- [ ] Given the prompt card, when the user taps "Keep only [winner]," then the draft is unchanged from
  today's existing single-winner/reserve outcome, and the prompt does not render again for this pair within
  the same Draft Preview session.

### Story 5: No stale conflict warning for a genuinely alternated pair
As a user with an automatically alternated retinoid/exfoliant pair, I don't want to see a conflict warning
for a pair that's now correctly split across non-overlapping days.

**Acceptance Criteria:**
- [ ] Given two products scheduled via automatic alternation with non-overlapping `scheduledDays`, when
  conflicts are computed for the Routines screen, then no `rule_retinol_aha`/`rule_retinol_bha` warning
  renders for that pair.

## 5. UX / Behaviour

No new screen or navigation entry point — the prompt is a new card inside the existing Draft Preview
screen, styled consistently with existing dismissible advisory cards (`SeasonalNoticeBanner`,
`GoalCoverageBanner`). It renders directly below the AM/PM step lists and above the "In reserve" section,
only when a `cycle_class_rival` case is present in the generated plan. It shows both product names in plain
language (e.g. "[Retinoid] and [Exfoliant] can't go together every night.") with two actions: "Alternate
automatically" and "Keep only [winner name]." Tapping either resolves the card for the current session —
it does not reappear for the same pair without a fresh app/screen session. There is no loading state (the
computation is synchronous, local, deterministic) and no error state beyond the app's existing generic
draft-generation failure handling, which this feature does not change. Empty state: when no rival is
detected, the card is simply absent — nothing renders in its place.

## 6. Data Requirements

- New data needed: a new `cycle_class_rival` reason code; two new optional fields identifying the rival
  relationship on the existing reserve-item shape; a small, in-memory list pairing an approved rival with
  its winner, used only during plan generation (not a new persisted entity).
- Existing data consumed: each active class's `cycleClass` (`actives.json`, already populated for
  retinoid/aha/bha/pha), each product's current frequency cap (adaptation-phase ramp or flat exfoliant
  treatment cap, both already computed today), `RoutineStep.scheduledDays`.
- Persistence reuses the existing phase-07 override mechanism (already-persisted, hash-invalidated product
  id list) rather than introducing a new persisted field — see tech design §4 Assumption 1.
- Data retention: identical to the existing override mechanism — local-only, invalidated the same way,
  no new retention policy.

## 7. Dependencies

- Depends on spec: none formally. Builds on the already-shipped phase-07 override mechanism and the
  `routine-similar-product-priority` slot-alternatives display pattern for its UI/data conventions.
- Builds on, does not modify: `conflict-resolution-scope` (`resolutionScope`) — this task verifies day-level
  conflict-warning correctness against the new schedule but does not change that logic.
- Blocks: none identified.
- External services: none — fully local, per `CLAUDE.md`.

## 8. Security & Privacy

- Authentication required: no (no accounts in Phase 1).
- Data sensitivity: none beyond the existing local product/routine data already handled by the app.
- Compliance considerations: none new.

## 9. Success Metrics

No production install base or in-feature analytics yet, so success is engineering/QA completeness:
- Every acceptance criterion above is covered by a passing automated test.
- Zero regression in existing `cumulative_active_cap`/`duplicate_function` reserve behavior, existing
  pair-rule/cap admission tests, and existing conflict-warning tests.
- `npx tsc --noEmit` and the full `npm test` suite are clean, per `.claude/rules/testing.md`.

## 10. Open Questions

None. The four clarifying questions raised during Step 0 planning (day-split ratio when caps diverge,
persistence across regenerations, pre-existing manual `scheduledDays` edits, multiple same-`cycleClass`
rivals) were resolved by product decision on 2026-09-22 — see `progress/day-split-alternation.md` for the
full record.
