Status: DESIGNED
Tech Design: docs/tech-design/intermediate-routine.md
Code: —

## Карточка задачи
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [ ] QA tests (qa-lead)
- [ ] Implementation (engineer)
- [ ] Architecture review (tech-lead)

## Log

2026-10-14 — planner: **Step 0.** The drafting subagent has no channel to the human, and a message relayed by
the coordinating session is not the human's own confirmation, so the three files were first staged outside the
repo and placed here by the coordinator after the user's go-ahead. (Coordinator: append the confirmation line
and date here when placing.) Spec Status is DRAFT until then. Nothing was committed: no commit was requested,
and the tree is on `fix/precleanse-gap-card` with another task's uncommitted work.

Context read: `CLAUDE.md`; `.claude/rules/` (agent-layer-protocol, progress, tech-design-template,
architecture-review, testing, roadmap-sync); no `team-context.md`; `progress/index.md` does not exist (not
blocking). Code: `slotting`, `skeleton`, `generate`, `resolve`, `context`, `productFacts`, `eligibility`,
`validate`, `planApply`, `mandates`, `planTypes`; `actives.json`, `seasons.json`, `procedures.json`,
`pregnancy.ts`, `rulesetTypes`, `decisionReasons`; `routinePlanActions`, `settingsStore`, `storage`;
`RoutinesScreen`, `DraftPreviewScreen`, `GapCard`, `routineGrouping`; V2.1 phase-02/04 specs;
`progress/fix-precleanse-gap-card.md`; the engine property suites and fixtures.

**Product-owner decisions, relayed by the coordinator 2026-10-14** (original words, then translation):
- "релиза пока нет и существующих юзеров тоже, мы свободны" — no release, no existing users: no migration, no
  back-compat; pick the best default for a new user. Decision: Balanced, via one constant.
- "надо чтоб не молча" — it must not be silent: a step the style calls for but the shelf cannot fill gets a
  visible gap card, and shelf products left out of the routine stay visible with a reason.
- Filter-versus-slot-selection is not hers to decide: treated as a technical assumption (tech design §4).
Earlier ask: "промежуточная рутина — между минимальной и полной; возьми структурные деперсонализированные
вещи, которые подойдут большинству" and "оставляем юзеру свободу выбора, но по умолчанию генерируем рутины
согласно рекомендации косметолога". Scope kept from the brief: toner, eye cream, a new enzyme-exfoliant class;
niacinamide-in-the-evening excluded as personal; morning exfoliation decided (AM, tech design §4).

**Corrections to the brief's facts.** (1) The reserve bucket IS rendered — in the Draft Preview only
(`DraftPreviewScreen.tsx` ~322-370: collapsed "In reserve · N products", per-row "Add anyway"). It is never shown
on the saved Routines screen, which is where products "vanish". (2) The live gap cards are derived from
`validateCurrentRoutines().proposedPlan.placeholders` (`RoutinesScreen.tsx` ~229), a fresh hypothetical plan, not
from the saved routine. That is why Balanced gap cards need no new UI and why an engine change reaches the live
screen without any save. The other brief facts (four skeleton slots, strong-carrier check before the structural
slot, toner/eye cream/essence/oil/ampoule reserved) were confirmed in code.

**Evidence** (throwaway spike in a scratch copy of the working tree; no repo file was touched):
- Essential vs today's engine over 600 seeded shelves: 0 differences once the one reserve label
  (`not_needed_for_goals` → `outside_routine_depth`, 594 rows) is normalised.
- R9 shelf: Balanced Morning = foam, toner, eye cream, cream, SPF; Evening = micellar, foam, toner, eye cream,
  cream; no placeholders. Sparse shelf S3: four gap cards at Balanced, none at Essential; max 5 per period view.
- 300 seeded shelves × 2 styles (incl. enzyme-salted shelves): deterministic, every product in a bucket, and
  "saved ∪ left-out ⊇ shelf" held with random saved subsets. Enzyme: AM only, 3 days (1 for Fitzpatrick 5 or
  summer), one per period, barrier-repair deferral, peel-rehab freeze with expiry, override re-enters AM only
  (unguarded it scheduled AM and PM every day), enzyme-only cleansing still raises cleanser gap cards.
- Balanced is not a strict superset of Essential: over 1000 shelves 10 existing steps were dropped (mostly
  cleansers carrying an active, displaced through pair-rule outcomes once a toner or eye cream is admitted), 14 day
  schedules changed, and 17 other steps were added (mainly gels/serums that win the single treatment slot a
  mild-active toner or eye cream used to hold). All explained via frozen/reserve; recorded as an assumption.
- Flipping the engine default to Balanced breaks only ~3 tier-contract tests (pin `depth: 'essential'`).
- Latent test gap found at today's engine (not caused by this task): `explainability-invariant` and
  `determinism-and-safety` assert scheduled ∩ frozen = ∅, but a product can be frozen in one period and scheduled
  in the other (seeds 157 and 362 of a 1000-seed sweep with the explainability generator: a cleanser and a balm,
  frozen by copper-peptide pair rules).

**Hazards for the next agents.** (a) Start only after `fix/precleanse-gap-card` merges; it holds uncommitted edits
in skeleton, generate, slotting, categoryDetector, decisionReasons, RoutinesScreen and `tests/routine-engine/
fixtures.ts`. Branch from origin/dev. (b) `selectSkeleton` (125 lines) and `generatePlan` (102) already exceed the
50-line guideline (tech-lead W6): put new logic in helpers. (c) Pre-existing baseline: 9 suites / 61 tests fail
repo-wide (per `fix-precleanse-gap-card`); do not count them against this task. (d) `RoutinesScreen.tsx` is
~1000 lines: keep business rules in `routineLeftOut.ts`, not in the screen.

**Open, non-blocking (planner default implemented):** Q1 third "Complete" style now? Q2 gap card for a missing
exfoliant? (NEEDS_CLARIFICATION → product owner) Q3 clinical review of draft values (matchers, 3 days, 12-token
window, barrier-repair deferral, AM). Q4 approve style names and PLACEHOLDER copy. See spec §10.

**Owed by the coordinator:** `.claude/rules/roadmap-sync.md` — new files under `docs/specs/` and
`docs/tech-design/` require a roadmap sync; the planner has no WebFetch/Artifact tools.

2026-10-14 — product owner answered the open questions:
- Q1 third "Complete" style: NO. Two styles only.
- Q2 purchase prompt for a missing exfoliant: NO. An owned enzyme product is
  still scheduled; only the prompt is withheld.
- Q3 clinical review of enzyme values: DEFERRED to after the MVP, before the
  global release. Values ship as drafted.
- Q4a style names "Essential" / "Balanced": APPROVED.
- Q4b remaining PLACEHOLDER screen copy: still open, owner design.
Spec stays DRAFT pending Q4b and the owner's read-through — she has not yet
said she read the spec itself, only answered the questions put to her.
