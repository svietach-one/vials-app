# Engine 4.0 — Reconciliation & Phase 11 Handoff

Status: FINAL DIRECTION — supersedes the Phase 11 design in the earlier
`engine 4.0` / routine-engine spec package where they conflict.
Date: 2026-07-25
Audience: the engineer/agent with repo access implementing this.

> This is the **one additional doc** requested — the earlier spec package is intentionally
> **not** rewritten. Where this doc and the package disagree, this doc wins. The package
> remains useful as background (evidence base, tone rules, test-matrix style), but its
> Phase 11 data model and pregnancy design are stale against shipped code — see below.

---

## 1. Reconciliation: what's already shipped (do NOT rebuild)

Verified against the branch (commit `9078369` and the pregnancy-safety lineage):

| Spec package item | Real status | Action |
|---|---|---|
| Phase 8 — skin-condition risk modifiers | **Shipped** (`skinConditionModifiers.ts`, `ConditionSelector`, tests) | Tech-lead review only (see §2) |
| Phase 9 — active-ingredient density insights | **Shipped** (`activeIngredientDensity.ts`, tests) | Tech-lead review only |
| Phase 10 — SPF adequacy | **Shipped** (`spfAdequacy.ts`, tests) | Tech-lead review only |
| Phase 11 — pregnancy/lactation safety guard | **Partially shipped** via engine-level freeze (`RoutineContext.pregnancyRules`, `eligibility.ts`, `pregnancy.ts`, `PREGNANCY_SAFETY_ENABLED`) — architecturally different from the package's `PREGNANCY_TIER_MAP`/`goalCoverage.ts` render-time design | Do NOT implement the package's tier map. Reuse the shipped freeze. Extend it (see §4). |
| Phase 11 — goal-coverage hints | **Genuinely unbuilt** — no `goal_not_covered`/`goalSatisfied`/banner concept anywhere in `src/` | Build it, per §3 |

The spec package's `skinGoals: SkinGoalType[]` field and its hand-authored `GOAL_TAG_MAP`
**must not be created** — the shipped model is `primaryGoal`/`secondaryGoal: SkinGoal` and
the goal→class mapping already exists in `actives.json` (`goals: Record<SkinGoal,
ActiveIngredientKey[]>`). The package's `skinIssues[]` open question is moot — that field
never existed; the real fields are `concerns: SkinConcern[]` (one-way migration seed into
`primaryGoal`, never re-derived live) and the goal pair.

---

## 2. Tech-lead review of Phases 8–10 (tests exist → proceed)

Product owner approved proceeding with the review now that test suites are in place. This
is a process gate, not new code. Reviewer should actually walk the checklist rather than
just tick it:
- Confirm the US-27-style no-op guarantee holds: users with no conditions/goals selected
  get byte-identical pre-feature engine output.
- Confirm the banned-phrase lint covers all three shipped features' message templates.
- Confirm no shipped warning renders in Cabernet or blocks saving.
- Then tick the sign-off in `progress/routine-engine-v2-2.md`.

---

## 3. NEW WORK — Standing Goal-Coverage Check

The one genuinely new surface. Everything below reflects the corrections found during code
verification — it is not the naive version from the spec package.

### 3.1 What it is
`resolveGoalContext()` selects a goal-solving active at **generation time**. Nothing
re-checks, after the user manually edits their routine or shelf, whether the *saved*
routine still contains an active that solves the stated goal. This check is the first
consumer of that standing question. Output: a Today-screen, dismissible, non-blocking
banner.

### 3.2 Source of truth for "what solves this goal" — with per-goal attribution
Do **not** call `resolveGoalContext()` per goal in isolation — the `barrier_repair`
irritancy-drop modifier applies across the *merged* pair, so isolated resolution would
falsely keep (e.g.) retinoid for `aging` when `secondary: barrier_repair` should have
dropped it.

Resolve **once** with the real `(primaryGoal, secondaryGoal)` pair, then attribute per
goal by intersecting with each goal's raw class list:

```
coverageClasses(g) = treatmentClassRanking  ∩  ACTIVES_RULESET.goals[g]
```

This preserves every modifier and still tells you *which* goal is uncovered (needed to
name it in the banner).

### 3.3 Cases that must NOT nag (all fall out of the intersection approach)
- **`maintenance`**: `goals['maintenance']` is `[]` → intersection empty → the treatment
  slot is deliberately empty by design. Never report as uncovered.
- **`secondaryGoal === null`**: skipped (`if (!goal) continue;`).
- **Empty intersection from a modifier** (e.g. `barrier_repair` wiped everything solving
  `aging`): this is "unaddressable by design," NOT "uncovered." Must not nag. Spec this
  explicitly.
- **`goalNeedsConfirmation === true`**: the goal was heuristically derived from `concerns`
  via `migrations.ts`, not user-chosen. Do **not** nag about coverage of a goal the user
  never picked. Skip until confirmed.

### 3.4 The two questions — and the false-negative trap
Reading `frozenRows` alone is insufficient and produces the exact dangerous false
negative. `RoutinePlan.frozen` is transient (never persisted; discarded after
`applyRoutinePlan`), so it can't be read from a saved routine — but `RoutinesScreen`
already computes, every Today render, `frozenRows: Map<routineId, FrozenStepView[]>` (and a
flattened `allFrozen`) via `getDailyView`/`dailyView.ts`, and `FrozenStepView.reasonCode`
is `'pregnancy_blocked'` for the safety source. Reuse those — no new gate run, no new
persistence.

**But** `frozenRows` only contains products that became *steps* in the saved routine. If a
restricted product was gated out at `applyEligibilityGates` **before** it ever became a
step (pregnant user, `aging` goal, owns a retinol that never entered the routine), it is in
neither the steps nor `frozenRows` — indistinguishable from "not owned." Naive check →
"aging not covered" → nudges her toward the retinoid. This is the failure the whole feature
exists to prevent.

So there are two distinct questions, needing two distinct inputs (both already in scope on
`RoutinesScreen`, neither needs persistence):

| Question | Input |
|---|---|
| "Why is this active missing from my routine?" | `frozenRows` (already available) |
| "Is this goal genuinely uncovered, or uncoverable-for-safety-reasons?" | `products` (the shelf) + `getPregnancyRules()`, evaluated over owned products |

### 3.5 Decision logic per stated, confirmed, non-maintenance goal `g`
1. `classes = coverageClasses(g)`. If empty → skip (unaddressable/maintenance, §3.3).
2. If any scheduled routine step's product has a class in `classes` **and** is not frozen →
   **covered**, no banner.
3. Else, check the shelf: does the user own a product whose class ∈ `classes`?
   - Owned, and that product's class is matched by `getPregnancyRules()` (i.e. it would be
     safety-frozen) → **`safety_redirect`**: name the pregnancy-safe alternative classes
     for `g` (from `classes` minus the frozen ones) and emit the **mandatory professional-
     redirect line**. Never report `g` as "nothing owned."
   - Owned but simply not scheduled → **Cobalt "on shelf, not in routine"** nudge.
   - Not owned at all → **softest Cobalt "nothing yet"** note.
4. Never block, never Cabernet. Goal-coverage nudges are Cobalt; the pregnancy
   safety_redirect line is the one place this feature cautions (Amber) and must carry the
   professional redirect.

### 3.6 Tone / compliance (unchanged from package US-26)
No absolute/prohibitive language; non-diagnostic; safety paths frame restricted actives as
"usually set aside during pregnancy" and defer to a professional. Extend the existing
banned-phrase lint to the new templates.

---

## 4. NEW WORK — Extend the pregnancy freeze beyond retinoid

Per product-owner decision, hydroquinone (and other restricted actives) come **into scope
in this task**, not a deferred ticket.

Current shipped freeze covers **retinoid only** (`pregnancy.ts:26-30`); the file's own
header notes hydroquinone "the engine cannot see it. A separate ticket." That ticket is now
this task.

- Add `hydroquinone` to the active-ingredient taxonomy (`ActiveIngredientKey` + its
  detection/parse rule) so the engine can see it at all — it currently cannot.
- Add it (and any other clearly-consensus restricted actives the reviewer confirms) to the
  pregnancy freeze ruleset so `getPregnancyRules()`/`applyEligibilityGates` freeze it the
  same way retinoid is frozen, surfacing `reasonCode: 'pregnancy_blocked'`.
- **This fixes a live overpromise bug:** the shipped `PREGNANCY_LABEL` hint already tells
  users "we'll flag retinoids **and other restricted actives**," which today is false —
  only retinoids are flagged. Expanding the freeze makes the shipped copy honest. (If the
  reviewer decides to scope hydroquinone-only for now, the alternative honest fix is to
  narrow the hint text to "retinoids" — but the chosen direction is to expand the engine,
  so the hint can stay.)
- Evidence base for which actives belong in the freeze: the ingredient-tier research in the
  spec package's `GOAL_COVERAGE_AND_PREGNANCY_SAFETY.md` §4 (ACOG/AAD-level consensus:
  retinoids and hydroquinone are the high-consensus restricted set; salicylic-acid/BPO
  nuance is concentration-dependent and the engine can't read concentration — treat with
  the reviewer's guidance, don't hard-freeze a whole class the app can't dose-distinguish).
- Route the final freeze list through the same clinical sign-off as `PRD_Spec.md` §6.

---

## 5. Constraints (carry over from the package)

- No new npm/expo dependencies.
- Everything runs in the component render cycle / existing engine stages — never from a
  store.
- Nothing here blocks saving or renders Cabernet, except that the freeze itself (existing
  behavior) legitimately removes products from a generated routine — that's shipped
  behavior, not new.
- Do not introduce `skinGoals[]`. Do not author a new `GOAL_TAG_MAP`. Use `primaryGoal`/
  `secondaryGoal` and `actives.json` `goals`.
- Sequence: (a) close Phases 8–10 review; (b) extend the freeze (§4) — it's a dependency of
  the goal-coverage `safety_redirect` path; (c) build goal-coverage (§3) on top.
