# Prompt for Claude Code — Engine 4.0 finalization

Paste below the line.

---

You already did the reconciliation pass on `docs/specs/engine 4.0/` and found Phases 8–10
are shipped (commit 9078369), pregnancy safety is partially shipped as an engine freeze,
and only goal-coverage hints are genuinely new. Your analysis was correct and is now the
agreed direction. Read `ENGINE_4.0_RECONCILIATION_AND_PHASE11_HANDOFF.md` — it captures
the final decisions, including the corrections you surfaced (per-goal attribution via
intersection, the shelf-level false-negative, `goalNeedsConfirmation` skip, reading
`frozenRows`/`getPregnancyRules()` instead of the transient `RoutinePlan.frozen`). Where
the older spec package disagrees with that handoff doc, the handoff doc wins; do not
implement the package's `skinGoals[]` field, `PREGNANCY_TIER_MAP`, or hand-authored
`GOAL_TAG_MAP`.

Do three things, in this order:

**1. Close the Phases 8–10 tech-lead review.** Test suites exist, so proceed. Actually walk
the checklist in §2 of the handoff doc (no-op guarantee for opted-out users, banned-phrase
lint coverage, no Cabernet/blocking), then tick the sign-off in
`progress/routine-engine-v2-2.md`. If anything fails the walk, stop and report it rather
than ticking.

**2. Extend the pregnancy freeze beyond retinoid (§4 of the handoff).** Hydroquinone is in
scope for this task, not deferred. Add `hydroquinone` to the `ActiveIngredientKey`
taxonomy and its parse/detection rule (the engine currently cannot see it at all), then add
it to the pregnancy freeze ruleset so `getPregnancyRules()`/`applyEligibilityGates` freeze
it like retinoid, surfacing `reasonCode: 'pregnancy_blocked'`. This also makes the shipped
`PREGNANCY_LABEL` hint ("retinoids and other restricted actives") honest — it currently
overpromises. For the exact restricted-active list, use the ACOG/AAD-level evidence base in
the package's `GOAL_COVERAGE_AND_PREGNANCY_SAFETY.md` §4, but treat salicylic-acid/BPO with
care since the engine can't read concentration — flag the final list for the same clinical
sign-off as `PRD_Spec.md` §6 rather than deciding the borderline classes yourself.

**3. Build the standing goal-coverage check (§3 of the handoff).** New Today-screen,
dismissible, non-blocking banner answering "does the saved routine still contain an active
that solves the user's stated goal?" Key correctness requirements, all from your own
verification:
- Resolve `resolveGoalContext()` **once** with the real goal pair, attribute per goal via
  `coverageClasses(g) = treatmentClassRanking ∩ ACTIVES_RULESET.goals[g]` — never resolve
  per goal in isolation (breaks the `barrier_repair` cross-goal modifier).
- Skip and never nag on: `maintenance` (empty goal list), `null` secondary, empty
  intersection (unaddressable-by-design), and `goalNeedsConfirmation === true` (goal was
  migration-derived, not user-chosen).
- For an uncovered goal, use two inputs already on `RoutinesScreen`: `frozenRows` (why an
  active is missing from the routine) **and** a shelf-level check over `products` +
  `getPregnancyRules()` (whether an owned goal-solving product would be safety-frozen). The
  shelf check is mandatory — `frozenRows` alone misses products gated out before they ever
  became steps, which is the dangerous false negative (pregnant user reported "goal not
  covered" → nudged toward a retinoid).
- Emit `safety_redirect` (Amber, with a mandatory "consider checking with your doctor or
  dermatologist" line) when the only goal-solving owned products would be safety-frozen;
  name the pregnancy-safe alternative classes instead of reporting the goal as uncovered.
  Otherwise emit a Cobalt nudge (owned-but-unscheduled vs. nothing-owned). Never Cabernet,
  never blocking.
- Extend the existing banned-phrase lint to the new templates; keep copy non-absolute and
  non-diagnostic.

Constraints: no new dependencies; engine/render-cycle only, never from a store; use
`primaryGoal`/`secondaryGoal` and `actives.json` `goals`; do not persist anything new.

If you hit a genuine spec gap or a case the handoff doc doesn't cover, flag it with the
specific file/line rather than guessing — same as you did on the reconciliation pass. Start
with step 1.
