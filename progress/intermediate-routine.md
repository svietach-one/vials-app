Status: PR_REVIEW
Tech Design: docs/tech-design/intermediate-routine.md
Code:
  - engine: src/utils/routineEngine/{slotting,skeleton,resolve,planApply}.ts, src/constants/decisionReasons.ts, src/constants/rulesets/actives.json (+version 2026-10-15), src/utils/ingredientParser.ts (splitInciTopLevel), src/utils/productForm/categoryDetector.ts
  - new: src/utils/{productOwnership,routineLeftOut,gapDismissal}.ts, src/constants/routineScreenCopy.ts, src/components/routine/LeftOutSection.tsx
  - wiring: src/domain/routinePlanActions.ts, src/store/settingsStore.ts, src/types/index.ts, src/constants/labels.ts, src/utils/activeBadges.ts, src/components/addProduct/activesGroups.ts, src/components/routine/{GapCard,RoutineStepActionSheet,RoutineCalendarView,DraftPreviewScreen}.tsx, src/screens/RoutinesScreen.tsx
  - tests: co-located *.test.ts next to each util; tests/routine-engine/{generate,determinism-and-safety,explainability-invariant,draft-preview-sheet}.test.ts(x) (rewritten), relocation-single-outcome.test.ts (new), fixtures.ts (sweep weights)
  - docs: docs/specs/routine-engine-v2.1/phase-04-skeleton-buildup.md (amended)

## Карточка задачи
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [x] QA tests (qa-lead)
- [x] Implementation (engineer)
- [x] Architecture review (tech-lead) — ACCEPTED 2026-10-15 (0 BLOCKER, 7 WARNING, 6 NIT)

## Log

(Entries dated 2026-10-14 describe the retired two-style design and are kept as history. The 2026-10-15 entry at the
end supersedes them. QA is unticked again because the existing suite targets the retired design.)

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

2026-10-14 — qa-lead: **QA tests written against a DRAFT spec** (status not flipped; the product owner confirmed
the test plan herself but has not said she read or approved the spec). Written BEFORE any production code.
Files: `tests/intermediate-routine/` — `fixtures.ts`, `balanced-plan`, `gap-cards`, `enzyme-exfoliant`,
`left-out-items`, `balanced-vs-essential`, `determinism-and-safety`, `essential-regression` (+ `golden/`),
`LeftOutSection.test.tsx`, `draft-preview-style-control.test.tsx`, `routine-depth-store`, `routines-screen.test.tsx`.
- Essential oracle: `golden/essential-plans.golden.json` (600 stored input+plan cases) captured from the engine at
  commit 5ed283f335eb7b7e7a61f3d39821178c76a502da (origin/dev, clean tree) before any change; regenerate only
  deliberately via `REGENERATE_ESSENTIAL_GOLDEN=1 npx jest tests/intermediate-routine/golden`.
- Run state today: new suites fail for the right reason (missing module `@/constants/routineDepth`,
  `@/utils/routineLeftOut`, `@/components/routine/LeftOutSection`, or missing Balanced/enzyme behaviour). Tests that
  already pass are regression guards and must stay green. `tsc` errors are confined to the new tests and each is a
  reference to an interface the engineer still owes (list in the QA report / handoff JSON).
- Interfaces the tech design did not pin, assumed by the tests: see `progress/intermediate-routine-handoff.json`
  `qa.assumed_interfaces`. Engineer: match them or push back in this log.
- Pre-existing engine quirk found (not caused by this task): a slot's own current product can appear in its
  `slotAlternatives` (28 of 1092 alternatives on a 600-shelf corpus) — a no-op "Change". Not asserted.

2026-10-14 — Balanced sublabel reworded at the owner's request ("adequate wording"): no longer promises a superset of Essential. Still PLACEHOLDER copy pending design (Q4b).

2026-10-15 — planner: **REVISION — one routine, no style.** Spec and tech design revised in place (not restarted);
progress and handoff updated. Nothing committed. Spec Status stays DRAFT.

**Authorization, stated accurately.** The coordinating session relayed three messages as the product owner's own
in-session words (Russian originals are quoted in spec "Revision 2026-10-15"): (1) drop the style switch, ship one
mode, the fuller one; (2) "the user removes anything extra herself"; (3) mid-task, her answer to "is a removed step
resurrected?" — removal only in edit mode, regeneration shows the step again. The planner has no channel to the human
and cannot verify any of this; it treated the relay as the task brief, edited only tracked docs and progress files in
the working tree (reversible with `git checkout -- docs progress`), and did not flip DRAFT. Step 0's "wait for the
human's confirmation" was therefore NOT satisfied by the planner itself: the owner's approval is her review of this
diff, which must happen before the engineer starts.

**Deleted from the docs** (nothing existed in `src/` — the style concept was never implemented; HEAD holds only docs
and QA tests): the style type, the persisted setting and its setter, the engine input, the Draft Preview control, the
`outside_routine_depth` reason, G6 (the minimal style equals today's engine), the golden Essential corpus requirement,
the non-superset assumption, the engine-default-flip note, the `DEPTH_EXTRA_SLOTS`/`slotAtDepth` design, the
`computeOverrideHash` note, decision Q4a (recorded as MOOT) and Q1. The copy module is renamed (the style-named module
becomes `src/constants/leftOutCopy.ts`, export `LEFT_OUT_COPY`). **Kept** (owner decisions, unchanged in spirit): never
omit silently (scheduled or a gap card); shelf products that miss the routine stay visible with a reason; no purchase
prompt for an enzyme exfoliant, an owned one is still scheduled; clinical review of enzyme values deferred to after
the MVP as named constants; no migration, no users; remaining copy is PLACEHOLDER (Q4b). New: Story 5 (trimming), the
gap-card independence guarantee, the wishlist boundary (FE-3), the calendar gate (FE-9), the planApply comment fix
(DOC-2). Tech design is 147 lines, five sections.

**Verified against the code (answers to the three design questions):**
1. *Is a removed or hidden step resurrected?* Only by an explicit user action. Validation (`validateCurrentRoutines`
   → `validateRoutines`) is a pure read and `generatePlan(input)` ignores saved steps (`validate.ts:203`). The only
   writers of plan-derived steps are Draft Preview save (`handleCommitDraft` → `applyRoutinePlan` →
   `buildStepsFromPlan`, the single UI caller) and Reset all; `useRoutineLinking` is dead code. In
   `buildStepsFromPlan`: a REMOVED step (`removeProductStep`, or `removeStepFromDay` on the last weekday) is simply
   absent, so a planned product gets a fresh step (new id, plan's days); a HIDDEN step whose product is planned keeps
   its id and pin but is written `hidden:false` with the plan's days (un-hidden); a hidden step whose product is NOT
   planned stays hidden untouched; per-weekday removal is reset to the plan's days. Both already match her intent;
   NO behaviour change is needed. Correction to older notes (including the code comment): "hidden steps survive the
   rewrite untouched" is true only when the plan does not schedule the product; no test pinned the planned case
   (`planApply.test.ts` only covers the unplanned one). DOC-2 fixes the comment; the unit tests are specified.
   Edit-mode gate: the list view is ALREADY gated (`RoutineProductCard.handlePress` opens the action sheet only when
   `editMode`; Pause/Schedule icons render only in edit mode). NOT gated: (a) Calendar view — `IdentityCell` →
   `openStepSheetForProduct` → `RoutineStepActionSheet` offers Remove/Hide with no edit-mode check → FE-9 adds
   `allowRemoval`; (b) `OrphanedSlotCard` "Pause" (legacy step whose product is gone), left as is; (c) removal on other
   screens with no edit mode (shelf card `onRemoveFromRoutine`, `ProductDetailScreen` `RemoveRoutineActionSheet`,
   `DuplicateSlotResolutionSheet`, delete-product cascade), left as is — recorded as Q7 for the owner.
2. *Does a removed toner step make the gap card reappear on every render?* Her suspicion is CONFIRMED for removal:
   gap cards come from the plan, which is built from shelf + profile + procedures + overrides only; a card is raised
   only when no eligible, non-strong, period-allowed shelf product fills the slot (`structuralGapPlaceholders`). An
   owned toner keeps the slot filled whether or not the saved routine has the step, so removal neither raises nor
   clears a card (and a gap card is not a step, so there is nothing to remove). It surfaces as "Ready to add" in the
   new list and as `added` in the draft diff. The one stale-vs-saved filter that exists is
   `isFollowupAlreadyPresent` in `routineGrouping.ts`, for the pre-cleanse follow-up only.
   **Case that remains, escalated as Q5:** a card also stands when the shelf cannot supply the step for reasons the
   user chose — no toner/eye cream ever owned (S3), toner deleted, or hidden on the shelf (hidden products are dropped
   silently by `generate.ts`/`eligibility.ts`, so hiding the only toner raises the cards and lists nothing). With the
   style switch gone nothing in the app clears those cards. Options A/B/C with trade-offs are in spec §10 Q5. The
   planner did not choose and built nothing; **NEEDS_CLARIFICATION → product owner, BLOCKING for gap-card dismissal
   only** (FE-1…FE-9 do not depend on it). Overall status is DESIGNED, not BLOCKED, because the question gates only an
   additive, not-yet-designed sub-feature; the DRAFT gate holds the engineer until she has answered or deferred it.
3. *Does a removed step for an owned product show in "Not in your routine"?* Proposal written into the spec (Q6, owner
   confirms at review): YES. Listed iff the product is owned, not hidden on the shelf, and has no non-hidden saved step
   in either routine on any weekday — so removed AND hidden-step products are listed ("Ready to add" when the plan
   would schedule them again), per product, not per period or weekday. This supersedes the earlier "a hidden step
   counts as saved" (which left the product visible nowhere) and needs no record of removals. Trade-off and
   alternatives are in spec Q6.

**Findings beyond the brief.** (a) Wishlist-status products live in `productsStore.products` and the engine has no
`status` check (`buildEngineInputFromStores` passes everything), so a wishlist toner would suppress the toner gap
card and be listed as "Ready to add"; FE-3 filters them at the domain boundary (assumption recorded; veto at review).
(b) The `normalizeProductType` guards must not pull hair/lip products into the enzyme class (FE-5 skips such names).
(c) `fix/precleanse-gap-card` is merged (PR #60, 5ed283f is an ancestor of HEAD): the old hazard (a) above no longer
applies.

**QA rework required BEFORE the engineer starts** (qa-lead owns this; planner wrote no tests). Suite
`tests/intermediate-routine/` (commit b44d909) targets the retired design:
- Delete (style-only): `balanced-vs-essential.test.ts`, `essential-regression.test.ts`, `golden/` (the golden corpus and
  its generator), `routine-depth-store.test.ts`, `draft-preview-style-control.test.tsx`. `essential-regression` passes
  today and would fail by design once the engine changes, so it must go first.
- Rework (drop the style dimension): `fixtures.ts` (remove the style type, `DEPTHS`, `makeDepthInput`, the style
  parameter of the shelf builders, `normaliseEssentialPlan`; keep R9/S3/E4, sweeps and safety checkers; add shelves
  with removed/hidden steps), `balanced-plan.test.ts` (drop the Essential cases; rename, e.g. `routine-plan.test.ts`),
  `gap-cards.test.ts`, `enzyme-exfoliant.test.ts`, `determinism-and-safety.test.ts`, `left-out-items.test.ts` (new
  membership rule), `LeftOutSection.test.tsx` (copy from `@/constants/leftOutCopy` / `LEFT_OUT_COPY`),
  `routines-screen.test.tsx` (no style wiring).
- Add: Story 5 — list view offers no Remove/Hide with edit mode off; Calendar sheet omits Remove/Hide with edit mode
  off (`allowRemoval`); removal then revalidation leaves stored routines identical; save restores the step iff planned;
  gap cards unchanged by removal; wishlist products excluded at `buildEngineInputFromStores`.
- Interfaces now pinned by the design: `buildLeftOutItems(plan, products, routines): LeftOutItem[]`; `LeftOutItem`
  `{productId, kind, reasonCode, until?}`; `LeftOutSection` props `{items, products, onAdd(productId), onReview()}`;
  `LEFT_OUT_COPY {leftOutHeader(n), readyToAdd, backup, addAction, reviewAction}`; `RoutineStepActionSheet.allowRemoval`.

**Hazards for the next agents (updated).** (a) `selectSkeleton` (125 lines) and `generatePlan` (118) exceed the
50-line guideline: do not grow them — extract the override block before adding the exfoliant call. (b) Measure the
test baseline first (`progress/known-test-failures.md` is dated 2026-07-17; the older "9 suites / 61 tests" figure is
unverified). (c) `RoutinesScreen.tsx` is ~1080 lines: keep rules in `routineLeftOut.ts`. (d) Slot losers: any late
promotion must pass `findViolationsAgainst` and be pruned from `slotAlternatives`; this task adds none.

**Open:** Q5 (BLOCKING for gap-card dismissal only) and Q4b (design) are unresolved; Q6 and Q7 are proposals the owner
confirms at review. **Owed by the coordinator:** roadmap sync per `.claude/rules/roadmap-sync.md` (spec and tech design
materially edited; the planner has no WebFetch/Artifact tools).

2026-10-15 (second pass) — planner: **OWNER ANSWERS APPLIED + calendar discoverability.** Spec and tech design revised
again in place (the tech design is 147 lines, five sections); nothing committed; spec Status stays DRAFT (she answered the
review questions but has not said she read the whole spec). This entry SUPERSEDES the Q5/Q6/Q7 handling above.
Provenance: the coordinator relayed the answers as the owner's decisions in this session (only the calendar requirement
came with her words, quoted in Russian in the spec's revision note); the planner cannot verify them, so her read-through of
this diff stays the gate before the engineer starts.

**Decisions applied.** Q5 = option B: "Not for me" on the toner and eye-cream gap cards ONLY, hiding that card until the next
save; cleanser, moisturiser, SPF, pre-cleanse follow-up and mandate cards have none. Q6 = YES: a product removed on purpose is
listed (owned, not hidden on the shelf, no non-hidden step in either routine on any weekday); the known trade-off (the list
cannot tell "removed on purpose" from "never added") is recorded in spec §5 and §10. Q7 = YES: Remove/Hide only in edit mode
in the calendar too (FE-9). Wishlist = YES: owned-only engine input (FE-3). New requirement: calendar discoverability
(Story 7, FE-10): caption + highlight on the product column.

**"Until next save" design (spec Story 6, tech design FE-11/12, assumption 7).** State: `AppSettings.dismissedGapCards`, at
most four keys (`am|pm` x `toner|eye_cream`), persisted through the existing settings blob (`dismissedBanners` is the
precedent; the field is added to `pickSettings`, defaults merge on hydrate, no migration). "Next save" = a Draft Preview save
(`applyRoutinePlan`) clears the keys of the periods it wrote (both / Morning only / Evening only); "Reset all" clears both.
Manual add/remove/hide/reorder, shelf edits, period/day switches and restarts do NOT clear it. Orchestration is in
`src/domain/routinePlanActions.ts`; pure logic in `src/utils/gapDismissal.ts` (`gapDismissKey`, `visibleGaps`,
`keysAfterSave`); no AsyncStorage outside `services/storage.ts`. The filter runs AFTER the engine's dedupe, so the plan, the
Draft Preview and the left-out list are unchanged, and only the generic `toner_recommended`/`eye_cream_recommended`
survivors are dismissible (a mandate or follow-up card that wins the (period, type) dedupe never is). It is not a
tombstone store: keys are per period and type, never per product or step, and none survives a save. A dismissed card is the
user's explicit choice, not an app omission, so "never silent" holds (stated in the spec). Rejected alternatives: screen
state (returns on every restart), `routineNoticeDismissedAt` (verified: `routineContentHash` changes on any add/remove/
reschedule and does not change on a no-op save), `dismissedBanners` (permanent, no removal action), trackingStore.
Derived (vetoable): available with edit mode on or off, because a card is a prompt, not a step.

**Calendar behaviour (spec Story 7, FE-9/FE-10).** `RoutineCalendarView` stays presentational and gets an optional
`editMode` prop (default false). Edit mode off: neutral caption that says rows open details and points at the pencil; NO
highlight (it would promise editing the sheet will not offer); a tap opens `RoutineStepActionSheet` with only "View product
details" and "Edit product" (both act on the product). Edit mode on: caption "Tap a product to edit or remove it." and the
identity column in `colors.statusInfoTint`/`statusInfoLine` (the plum tints read pink); the sheet shows all four rows.
No caption/highlight in the empty state. The existing row label `<name>, open actions` is kept (a green test needs it) with
a per-mode `accessibilityHint`. One refinement of the coordinator's suggestion: the view-mode caption also says rows are
tappable, otherwise a pencil-only hint would hide that they are. The stale "Read-only" header comment is fixed under DOC-2.

**Existing test interaction.** `tests/product-images/RoutineCalendarView.test.tsx`: 9 pass, 2 fail (run today). The 2
failures are empty-state copy drift (it expects "No products scheduled this month." but the `EmptyState` renders a title
"No products scheduled" plus a description). FE-10 does not touch the empty branch, so it neither fixes nor worsens them; it
must keep the 9 green ones green (the label above; no extra "Morning"/"Evening" text or sun/moon icons). Baseline not fixed.

**Status re-evaluation.** Nothing is BLOCKED: no Type A gap remains (Q5 decided; Q4b is PLACEHOLDER copy owned by design and
non-blocking by convention). Overall status DESIGNED. Gates before the engineer starts: the owner's read-through (DRAFT) and
the QA rework below.

**Newly contradictory or changed (all reconciled in the docs).** (1) The copy module is renamed again: `routineScreenCopy.ts`
exporting `LEFT_OUT_COPY` (same shape the QA assumed), `GAP_DISMISS_COPY`, `CALENDAR_HINT_COPY` (the old name,
`leftOutCopy.ts`, was in my previous report). (2) The "never silent" rule now has one stated exception (an explicit
dismissal). (3) The non-goal "no dismissed-steps store" now needs the card-vs-step clarification (added). (4) The old Story 2
AC "a gap card behaves exactly as with edit mode off" is reworded (a card now has "Not for me", identical in both modes).
(5) The assumption "dismissals are the persistence the owner declined" was wrong once Q5=B; reworded (she declined remembering
REMOVALS). (6) Story numbers: 1 toner/eye cream, 2 gaps, 3 enzyme, 4 left-out, 5 trim, 6 dismissal, 7 calendar, 8 safety.
(7) `currentOverrideHash` would have counted wishlist ids while the engine ignores them: FE-3 hashes owned ids too.
(8) Calendar removal acts on the product's FIRST visible step (morning before evening), and its "this weekday only"
confirmation names today's weekday: unchanged, now easier to reach (spec §5; not fixed). (9) The calendar's existing 10-12px
labels pre-date the 14px minimum; untouched, the new caption is 14px. (10) The last visible sheet row loses its divider.

**QA rework (updates the list above).** Delete/rework as before; the copy import is now `@/constants/routineScreenCopy`.
Add: Story 6 (dismissal state, restart persistence, per-period clearing by `applyRoutinePlan` scope and Reset all, not by manual
edits, non-dismissible cards, plan unchanged); Story 7 (caption and row hint per mode, empty state; the highlight is a
visual state, so qa-lead pins a testID in the feature fixtures and the engineer matches it); wishlist exclusion at
`buildEngineInputFromStores`, `validateCurrentRoutines` and `generateDraftPlan` (one input); `allowRemoval`.
**Owed by the coordinator:** roadmap sync (spec/tech design materially edited again); no WebFetch/Artifact tools here.

2026-10-15 — product owner approved the spec ("одобряю спеку, запускай qa-lead").
Spec Status DRAFT -> APPROVED. Open items that do NOT block: Q4b placeholder
screen copy (design-owned); clinical review of the enzyme values (after the
MVP, before the global release). Next: qa-lead reworks the tests written for the
retired two-mode design, then engineer. Roadmap sync still owed.

2026-10-15 — qa-lead: **QA tests rewritten for the single-mode design** (spec APPROVED 2026-10-15; product owner
confirmed the delta plan herself, "Да, писать тесты"). Written BEFORE any production code.
- Deleted (retired two-mode design): `balanced-vs-essential`, `essential-regression`, `golden/` (3 MB JSON + generator),
  `routine-depth-store`, `draft-preview-style-control`.
- Reworked: `fixtures.ts` (no style dimension; wishlist/hidden salting; owned-only sweep input), `routine-plan`
  (was `balanced-plan`), `gap-cards`, `enzyme-exfoliant`, `left-out-items`, `LeftOutSection`, `determinism-and-safety`,
  `routines-screen`.
- New: `trimming` (Story 5, real stores), `draft-summary` (Story 5 AC5), `gap-dismissal` (Story 6),
  `step-action-sheet` (allowRemoval), `calendar-hints` (Story 7), `wishlist-exclusion` (Story 2 AC6, FE-3).
- Owner rulings applied: (1) Story 1 AC3 "a swap never offers the scheduled product" is tested strictly in
  `routine-plan.test.ts` and FAILS until the engine root cause is fixed (today the engine can list a slot's own
  product among its alternatives: e.g. sweep seed 9, salt 8). (2) Story 5 AC5: the draft summary must always name
  re-added steps, including a one-weekday removal and a hidden-step un-hide, and must not drop its other lines to
  the 3-line cap; tested through `buildDraftSummaryLines`. (3) "First 12 ingredients" = plain comma list of top-level
  tokens, 1-based; a parenthesised sub-ingredient takes no position; "Aqua" is position 1 (12-vs-13 boundary kept).
  (4) Mild-active toner/eye cream: neither outcome asserted.
- Right-reason failures only: missing modules (`@/constants/routineScreenCopy`, `@/utils/routineLeftOut`,
  `@/utils/productOwnership`, `@/utils/gapDismissal`, `@/components/routine/LeftOutSection`) or missing behaviour.
  Passing tests are regression guards (balm routing, precedence, determinism/safety, trimming store behaviour).
  `tsc` errors are confined to `tests/intermediate-routine/` and each is an interface the engineer owes
  (handoff JSON `qa.owed_interfaces`).
- Assumed interfaces the design does not pin: handoff JSON `qa.assumed_interfaces`. Engineer: match them or push back here.

2026-10-15 — tech design amended (third planner pass) for two owner rulings on
qa-lead findings. Spec unchanged (the ACs already existed).
- FE-13 (Story 1 AC3, a swap never offers the scheduled product): fix in the
  engine. Planner MEASURED the cause on 6,000 seeded shelves: it is NOT the
  suspected day-split cleansers (9 of 349 offenders) but a product relocated by
  a `separate_periods` rule being attempted twice in the target period
  (`retryRelocatedInAm`). Same cause also double-scheduled a product in 17
  period views (duplicate step id on save), co-scheduled one avoid-level pair
  and produced 12 spurious "scheduled and frozen" records — a pre-existing
  engine defect on dev, wider than the 2.5% self-offer symptom. Prototype ~12
  lines in resolve.ts changes 343/6,000 plans (5.7%), 0 unaccounted products,
  43 existing engine suites green. Re-measure after FE-1/FE-2.
- FE-14 (Story 5 AC5, summary names re-added steps): improve the summary.
  `buildDraftSummaryLines(plan, diff, products, routines?)` with a new pure
  `findReaddedProductIds`; the "N product(s) added" line sits outside the cap
  of 3 and last (max 4 lines). `computeDiff` is unchanged. The existing test
  "never emits more than three lines" pins the old cap and must be replaced.
  Signature matches what qa-lead's draft-summary.test.ts assumed.
Phase map: A FE-1-3, B FE-4-6, C FE-7-10, D FE-11-12, E FE-13-14.

2026-10-15 — engineer: **Implementation done (phases A, A2, B, C, D, E, Final), one local commit per phase, nothing pushed.**
Commits: f3b42da (A), e7c6391 (A2), 6306790 (B), 156fddf (C), c100d52 (D), 0135f0b (E), final commit (sweeps + log).
Authorisation: product owner approved the plan herself ("Да, начинать") and confirmed any-format enzyme extraction; the coordinator decided the
reorders (FE-7 into A, FE-13 as A2), leave duplicate FrozenItem rows, legacy summary path keeps the cap, acid-toner test fix by qa-lead, global paren-aware
tokenizer (condition: no existing suite may shift), strong+enzyme keeps the 2-day cap, hydrate sanitising.

**Deviations from the tech design (all deliberate):**
1. FE-6: the enzyme cap (3 days) applies to NON-strong carriers only (`isEnzymeExfoliant`). The design said "BEFORE its isStrongCarrier return", which would have
   loosened an AHA/BHA product that also lists papain from the acids' 2-night cap to 3. Safety beats the letter; the strong path is unchanged and pinned by a test.
2. FE-7 moved into phase A and FE-13 became A2 (coordinator-approved): four QA suites import `routineLeftOut` at file level, and phase A widens the FE-13 exposure.
3. FE-11: `settingsStore.hydrate` and `dismissGapCard` accept only the four known keys (`GAP_DISMISS_KEYS`, `sanitizeDismissedKeys`) so "at most four keys" holds against
   corrupt stored data. Not in the design.
4. FE-14: `buildDraftSummaryLines` WITHOUT `routines` keeps today's diff-based "added" line inside the cap of 3 (the old "never emits more than three lines" test is kept for
   that legacy path and renamed); with `routines` the added line is computed from them, outside the cap, last (max 4 lines).
5. FE-4: INCI "position" now counts TOP-LEVEL ingredients (a parenthesised sub-list is one position) for EVERY class, not only the enzyme (one definition of position).
   The 47 ingredient/attribution/product-profile suites (634 tests) were run right after the change, before anything else, and none shifted.
6. FE-4: the wizard group for the new key is its own "Enzymes" group (amber), not folded into "Acids".
7. Wishlist weighting was NOT added to `tests/routine-engine/fixtures.ts`: the engine has no status check (the owned-only filter is at the store boundary, FE-3), so an
   engine-level sweep cannot exercise it. `tests/intermediate-routine` covers it end to end.

**FE-13 (safety-relevant engine fix) — measured effect**, 6,000 seeded shelves (3,000 QA sweep with wishlist salting + 3,000 promotion-shaped), per-period views:
| | alternatives | self-offered | duplicate alternatives | product scheduled twice in a period | scheduled-and-frozen records | avoid pairs | unaccounted |
|---|---|---|---|---|---|---|---|
| dev engine before this task | 10,525 | 296 | 110 | 17 | 34 | 0 | 0 |
| after toner/eye cream slots, before FE-13 | 12,186 | 368 | 123 | 19 | 47 | 0 | 0 |
| after FE-13 | 11,697 | 0 | 0 | 0 | 35 | 0 | 0 |
458 of 6,000 plans (7.6%) differ from the pre-FE-13 output. The 35 remaining scheduled-and-frozen records are legitimate (frozen in one period, scheduled in the other):
the strict per-period property "a freeze decision for period P means the product is not scheduled in P" finds 12 violations before FE-13 and 0 after (441 freezes).
Failing-first repros (shrunk from failing seeds) are in `resolve.test.ts` and `tests/routine-engine/relocation-single-outcome.test.ts` (all 4 red before the fix).
**Known pre-existing, left as is (coordinator ruling):** 24 of 6,000 shelves (17 on dev before this task) have a product with two `FrozenItem` rows (frozen in both periods;
`FrozenItem` has no period field). Not the same defect as FE-13. It would trip `frozen.size === plan.frozen.length` in `explainability-invariant` if that sweep were widened, so its seed count stays at 100.

**Old/new assertions for tech-lead (tests/routine-engine/generate.test.ts)** — new values derived from the spec (G2 shape: toner is a structural slot in both periods, no
eye cream owned => a gap in both periods), NOT copied from engine output; each was shown to go red when the behaviour is reverted:
- "builds a minimal goal-driven routine…" -> "builds a goal-driven routine from a realistic shelf: structural slots incl. toner, one treatment per period".
  OLD AM [cleanser, vitC, moisturizer, spf], PM [cleanser, retinoid, moisturizer], toner expected in `reserve` as not_needed_for_goals.
  NEW AM [cleanser, toner, vitC, moisturizer, spf], PM [cleanser, toner, retinoid, moisturizer], `reserve` == [], placeholders == [am:eye_cream, pm:eye_cream], rulesetVersion '2026-10-15'.
  Mutation: dropping toner/eye_cream from SKELETON_SLOTS or from REQUIRED_SLOTS turns it red.
- "maintenance goal -> minimal routine…" -> "maintenance goal -> structural routine incl. toner; actives, serums, essence and oil in reserve as not_needed_for_goals".
  OLD `morning.length <= 3`, `evening.length <= 2`, retinoid and vitC reserved. NEW exact lists AM [cleanser, toner, moisturizer, spf], PM [cleanser, toner, moisturizer];
  retinoid, vitC, both HA serums, essence, oil reserved (exactly 6 rows) and the toner NOT reserved. Mutation: dropping toner from SKELETON_SLOTS turns it red.
- "orders an all-gaps morning cleanse -> moisturise -> protect, not SPF first" -> "...cleanse -> tone -> eye -> moisturise -> protect...".
  OLD ['cleanser','moisturizer','spf']; NEW ['cleanser','toner','eye_cream','moisturizer','spf']. Mutation: dropping toner/eye_cream from REQUIRED_SLOTS turns it red.
Also tightened (not loosened): `skeleton.test.ts` niacinamide case now asserts `reserve` is EMPTY and all three are candidates (its title always said "no reserve", the old assertion only
checked no cap reserve); `draft-preview-sheet.test.tsx` "caps the summary lines at 3" (a regex that allowed up to four rows) is now an exact four-line, ordered assertion;
the product-level "scheduled and frozen are mutually exclusive" checks in `determinism-and-safety` and `explainability-invariant` became the per-period freeze property plus
hard-gate disjointness (150 seeds, with procedures and pregnancy, non-vacuity guarded). Version literal assertions updated to '2026-10-15' (kept as literals).

**QA suite findings (not worked around):**
- `tests/intermediate-routine/routines-screen.test.tsx` "records the morning toner key when its card is dismissed" assumes the toner card is the FIRST "Not for me" button on screen.
  On S3 the eye-cream card attaches to the existing "Moisturize" group and renders before the toner card, which has no real "Tone" group and so renders in the trailing block
  (spec §5, unchanged `attachPlaceholderGaps`). The assumption "toner precedes eye cream in build order" holds for the PLAN's placeholders, not for the screen's DOM order.
  The implementation is correct (it records the key of the card whose button was pressed); the test must pick the toner card's button instead of index 0. Left red.
- The strong-acid test goal (`acne` -> `pigmentation`) was fixed by qa-lead in f2cfe1a.

**Other notes.** `selectSkeleton` went from 125 to 96 lines (override block and exfoliant selection extracted); `generatePlan` untouched; `resolvePeriods` extracted run creation. Known engine
behaviours worth a clinical/product look later, not changed: a mild-active toner/eye cream now stays out of the single treatment slot (a gel or serum may win it); an enzyme toner or cream
leaves its format slot (accepted by the owner). Roadmap sync still owed by the coordinator.

2026-10-15 — tech-lead: **Architecture review of origin/dev..73cfc19: ACCEPT -> PR_REVIEW. No BLOCKER; 7 WARNING, 6 NIT.**
Read-only; Step 0 human confirmation not obtainable inside the subagent run. Reviewed on a git-archive snapshot.
Gates re-run independently: tsc 0 errors; jest 3,247 passed / 61 failed in 9 suites; the 61 are the identical test names that fail on origin/dev 5ed283f (re-run there). The engineer's 62nd failure was qa-lead's test bug, fixed in 73cfc19.
FE-13 re-measured with an INDEPENDENT generator (6,000 single-active + 6,000 adversarial multi-active shelves): self-offered alternatives 145/248 (dev) -> 245/382 (without FE-13) -> 0/0; duplicate alternatives 21/66 -> 38/94 -> 0/0; double-scheduled 0/9 -> 2/11 -> 0/0; per-period freeze violations 0/5 -> 0/5 -> 0/0; unaccounted 0 throughout; 0/12,000 non-deterministic; relocate confirmed non-terminal (making it terminal strands 152/152 ping-ponged products). Failing-first confirmed. The planner's co-scheduled avoid pair REPRODUCED in two shapes: (a) fixed by FE-13 (phase A made it reachable), (b) PRE-EXISTING on dev through the cycle-split path (resolve.ts:578-579, seed 3080), NOT fixed by FE-13 -> separate task.
Test rewrites are spec-derived; mutation checks go red. The per-period freeze property is logically WEAKER than the old scheduled-and-frozen-is-empty check (the old one was not a real invariant); its PAO half is vacuous; it does not go red with FE-13 reverted at the committed seeds — FE-13's real guards are the dedicated repro tests.
Tokenizer: whole-corpus diff (21,084 products) changes attribution of 52 (0.25%), 15 potency shifts all low->high (conservative); enzyme attribution unchanged.
WARNINGS: W1 enzyme carrier in a toner/cream format displaces the user's plain toner/moisturiser (skeleton.ts:240, resolve.ts:602); W2 splitInciTopLevel docstring false for an unclosed '(' (ingredientParser.ts:107), untested; W3 pre-existing cycle-split avoid pair (separate task, roadmap blocker candidate); W4 test-integrity claims overstated; W5 new/grown >50-line functions (buildCappedSummaryLines 67, LeftOutSection 57, RoutinesScreen +29); W6 PHA toner now scheduled daily AM+PM (deferred clinical review); W7 no device QA.
Clean: persistence, non-dismissible cards, wishlist exclusion, UI constraints (cobalt not plum, >=14px, one copy module, every reason code has text), layering greps, earlier PR #60 invariants.

2026-10-16 — engineer: **Tech-lead W1, W2, W4 fixed** (owner decision; W3, W5, W6, W7 and the NITs untouched). One local commit each, nothing pushed.
- **W1 (f9586db)** An enzyme cream/toner no longer displaces the user's plain one. APPROACH differs from the suggested key change in resolve.ts's same-slot cap: `normalizeProductType`
  (the single normalisation entry point) now reads a NON-strong enzyme carrier of ANY format as a `peeling`; the skeleton extracts only products read as peelings. Why not the cap key:
  `PlannedStep.slotIndex` is the slot identity for far more than the cap (Draft Preview `oldSteps`/`alternativesBySlot`, `applySlotAlternativeSwap`, `validate`, the saved-routine duplicate-slot
  warning), so an enzyme cream and a plain cream would still collide in all of them (a duplicate-slot warning on the saved screen, a Change swap hitting the wrong step); a retyped product has its own
  slot for every consumer. Kept: any-format extraction, <=3 days, morning preferred, one per period, strong carriers that also list an enzyme stay in their format (treatment rules).
  [Correction 2026-10-16, see W-C below] A makeup remover and an SPF that list an enzyme now keep their function and are NOT extracted — this is a BEHAVIOUR CHANGE from 6626804, where the skeleton
  extracted both as exfoliants (capped at 3 days); it is in the safe direction (an SPF is never turned into a weekly exfoliant) and narrower than the owner's literal "any format".
  Consequence to know: on the Routines screen an enzyme cream/toner now sits under the "Exfoliate" group header (and under that heading in the Draft Preview) — there is no peeling badge (as an enzyme
  cleanser already did); the shelf, badges and product detail read the raw product and are unchanged. Manual adds: `AddToRoutineSheet` persisted the normalised `peeling`, but three raw-type writers
  (Catalog, Product detail and the Routines screen's own scheduler, all through `RoutineSchedulerSheet`) persisted the RAW type — fixed at the sink in 8d796e8 (W-A).
  Repros (tests/routine-engine/enzyme-format-slot.test.ts): BEFORE — plain cream older + enzyme cream newer: plain cream absent from the morning, no gap card; toner variant with the enzyme toner OLDER: the enzyme toner was never scheduled as an exfoliant
  and was offered as a "Change" for the plain toner (the plain toner itself is displaced only when the enzyme toner is NEWER). AFTER — plain cream/toner scheduled every day in both periods, enzyme product morning-only on <=3 days, no toner/moisturiser gap card. Also a per-format accounted-for table
  and a 400-shelf enzyme-salted property. Corpus re-measured with enzyme salting (6,000 shelves), BEFORE -> AFTER: self-offered 0 -> 0; duplicate alternatives 0 -> 0; double-scheduled views 0 -> 0;
  per-period freeze violations 0 -> 0; scheduled-and-frozen records 36 -> 36; avoid pairs 0 -> 0; unaccounted 0 -> 0; non-deterministic plans 0 -> 0; alternatives 11,213 -> 11,117.
- **W2 (3d84d31)** `splitInciTopLevel` falls back to the plain comma split when a parenthesis is still open at the end (all-or-nothing); a stray ")" is unchanged; docstring states the real rules.
  Failing-first tests: the exact tech-lead string, the enzyme first-12 window with an unclosed group, and the all-or-nothing case. The 47 ingredient/attribution/product-profile suites shifted nowhere.
- **W4** comment in `tests/routine-engine/determinism-and-safety.test.ts` reworded (no assertion changed). The similar sentence in `explainability-invariant.test.ts` ("this is what the relocation fix restored")
  has the same overstatement and was left alone (out of scope).
- Unexpected: `tests/routine-engine/add-procedure-modal.test.tsx` (2 tests) started failing when the clock reached 2026-10-16 — it fails identically on the committed HEAD, so it is clock-dependent
  and not caused by this work; it is a new member of the red set that is not in the 9-suite baseline.

2026-10-16 — tech-lead: **Re-review of 6626804..faa73ef (W1 f9586db, W2 3d84d31, W4 41044b5, log faa73ef): ACCEPT, stays PR_REVIEW. 0 BLOCKER, 3 WARNING, 6 NIT.**
Read-only; Step 0 human confirmation not obtainable inside the subagent run. Reproduced on git-archive snapshots. tsc 0 errors. jest 3,284 pass / 61 fail in 9 suites outside the clock window.
W1: both repros fixed on the tech-lead's own shelves (3 attribution paths x 4 cream formats x both age orders, toner both orders). The engineer's rejection of the cap-key change is CORRECT and his approach better: with the tech-lead's own suggestion patched in, the saved plan raised a false duplicate-slot notice, Draft Preview marked an unchanged step "changed" and offered Change on both cards, and a swap replaced the ENZYME step with the spare cream.
FE-13 on an independent generator, 20,000 shelves x 2 salting modes: self-offered, duplicate alternatives, double-scheduled, per-period freeze violations, unaccounted, non-deterministic, avoid pairs, cap pairs all 0 -> 0. Plain product displaced by an enzyme add-on 1,160 -> 13 of 15,818 (all peeling-slot contests, 12 with a forced-in peeling). Shelves with no enzyme carrier 14,835/14,835 byte-identical. Phase 9: 0 violations over 2,160 shelves.
Differential over 21,084 corpus rows x 18 types: only enzyme carriers change (39 x 13 formats); strong carriers never retyped outside cleanser/other; pre-test false negatives 0.
W2: corpus attribution shifts vs split(',') 52 -> 24 (0.25% -> 0.11%), all conservative; unclosed-paren rows differing from legacy 28 -> 0 of 509.
W4: comment-only; wording accurate.
WARNINGS: W-A RoutineSchedulerSheet is fed the RAW product.productType by ProductDetailScreen:522, CatalogScreen:188/371, RoutinesScreen:531/999 (reproduced with the real store); W-B enzyme-format-slot.test.ts:107-141 does not assert its title; W-C tech design FE-5/FE-6 + assumptions stale, the owner's "ANY format" rule narrowed for SPF/makeup remover (a change from 6626804, not "kept"), the W1 log entry misdescribes repro 2's BEFORE state and the "peeling label".
NITS: N1 explainability-invariant.test.ts:97-98 overstatement; N2 ENZYME_WORD duplicates the ruleset matcher, strong predicate copied a 4th time; N3 docstrings in categoryDetector.ts; N4 enzyme SPF/remover can still displace the plain one (pre-existing, 0/684 corpus SPFs); N5 slot-2 contests and one-enzyme-per-period broken by relocation (4/20,000); N6 findSubstitute raw types (no caller).
UNRELATED, PRE-EXISTING: tests/routine-engine/add-procedure-modal.test.tsx (2 tests) fails on origin/dev 5ed283f, 6626804 and HEAD alike while the local calendar date is ahead of UTC (00:00-02:00 CEST daily; confirmed by timezone matrix). Cause: AddProcedureModal.tsx:83 (local date) + dateInput.ts:19 (date-only ISO) + AddProcedureModal.tsx:209 (new Date(isoDate) > new Date() compares UTC midnight with now), so "today" is rejected as "in the future". A real user-facing bug for UTC+ users; separate task, roadmap blocker candidate.

2026-10-16 — engineer: **Tech-lead re-review items W-A, W-B, W-C, N1 done** (one local commit each, nothing pushed).
- **W-A (8d796e8)** `RoutineSchedulerSheet` is the sink for five call sites that pass the RAW `product.productType` (ProductDetailScreen:522, CatalogScreen:188/371, RoutinesScreen:531/999). Instead of patching each
  call site, the sheet resolves the type from the product it is scheduling (`normalizeProductType`, falling back to the prop when the product is not in the store), the guard the engine and AddToRoutineSheet use.
  Failing-first with the real stores (tests/routine-engine/scheduler-sheet-normalized-type.test.tsx): BEFORE the enzyme cream got `moisturizer` steps in both periods (engine writes `peeling`), and micellar water typed as a
  cleanser got `cleanser` steps (so the "already did" claim held for AddToRoutineSheet only, not for this sheet); AFTER `peeling` and `makeup_remover`. A plain cream stays `moisturizer`.
- **W-B (0ea3676)** The 400-seed test was retitled for what it checks (accountability, one outcome per period, no self-offer) and a real non-interference property was added: removing the enzyme-only extras from a
  shelf changes no other step and no gap card (SPF, makeup remover and shelves with another peeling excluded; salted products carry no other active, because an enzyme product's PHA/copper peptides legitimately interact
  through the pair rules — the first version without that restriction failed on exactly those). Mutation: with the pre-W1 categoryDetector.ts and skeleton.ts restored, the new test and the three repros fail; the retitled
  accountability test stays green (as it must).
- **W-C** Dated revision note added to docs/tech-design/intermediate-routine.md (147 lines); the log corrections above (SPF/makeup remover behaviour change, repro 2 BEFORE state, "Exfoliate" header instead of a badge,
  the three raw-type writers). The tech-lead's verdict block is untouched.
- **N1** the comment in explainability-invariant.test.ts no longer credits the relocation fix (the property holds with or without FE-13; its guards are relocation-single-outcome.test.ts and resolve.test.ts).

2026-10-16 — product owner: remove the "Not in your routine" block from the Routines screen; keep it on the generation page only. Done in RoutinesScreen (the render and the useMemo that built the items); the screen test now asserts the block is ABSENT. The Draft Preview already shows "Paused until ..." rows and a collapsed "In reserve · N" with "Add anyway", so nothing set aside is silent there. `buildLeftOutItems` / `LeftOutSection` / their tests are kept but unused by any screen - open question for the owner: render LeftOutSection inside the Draft Preview, or delete it.
Also fixed on request the same day: (1) the gap card with two actions squeezed its copy into a few letters (stacked layout, 4f3cd10); (2) a closed orange "Ingredient conflict" notice reappeared after a Morning/Evening switch - the dismissal hash was scoped to the open tab and weekday (664b8dc); (3) the radio ring sat between a label and its sublabel ("Reset all") instead of beside the label (7760ed9).

2026-10-16 — tech-lead: **Review of faa73ef..299e5b8 (engineer W-A/W-B/W-C/N1: 8d796e8, 0ea3676, ff76814, 6f890e0; owner-testing fixes: 4f3cd10, 664b8dc, 7760ed9, 094872c, 299e5b8): ACCEPT, stays PR_REVIEW. 0 BLOCKER, 5 WARNING, 9 NIT.**
Read-only; Step 0 human confirmation not obtainable inside the subagent run; nothing written to the repo. Reproduced on git-archive snapshots. tsc 0 errors (also at each of the 8 intermediate commits, so history is bisectable). jest 3,297 pass / 61 fail in 9 suites; the 61 are the identical test names that fail on origin/dev 5ed283f. Push state at review time: the local origin/feature/intermediate-routine ref was 4f3cd10; 664b8dc, 7760ed9, 094872c, 299e5b8 were unpushed.
Engineer fixes. W-A verified failing-first on the faa73ef sheet (enzyme cream persisted moisturizer, micellar water cleanser; after: peeling / makeup_remover). The sink covers SIX call sites: the five listed plus src/screens/ManualProductFormScreen.tsx:1213 (a just-added product is already in the store). AddToRoutineSheet normalises itself; the only other hand-appender is the unused src/hooks/useRoutineLinking.ts. W-B: seeds 68/205/216/353 reproduced; each is a copper_peptide_acid_conflict day-split caused by the enzyme product's OWN PHA/BHA/copper peptide, not a slot displacement, so the exclusion is legitimate; the invariant holds with 0 violations in 13,054 shelves (20,000 seeds) when every enzyme-tagged product is pure, and with W1 reverted the same all-pure property fails on 133 of 643 shelves. W-C accurate except "never displaces" and the writer count. N1 comment-only.
WARNINGS. W1 (664b8dc): the conflict dismissal key is the rule id only (ConflictWarningInline.tsx:319) and the new hash is whole-routine, so a dismissal now also covers a DIFFERENT product pair of the same rule on another weekday (repro: Monday retinol1+AHA1, Thursday retinol2+AHA2, rule_retinol_aha - hidden on HEAD, visible on faa73ef). Per-card conflict markers and the Optimize strip are independent of dismissals. A dismissed advisory now re-surfaces after any edit anywhere (over-show, safe direction); advisory rows had the same Morning/Evening ping-pong before and it is fixed. Follow-up: key conflict dismissals by sorted product pair + a test. W2 (4f3cd10): the two-action fix verified with RN 0.86.3's vendored Yoga (old layout squeezes copy to 2-57px at 390-430pt; stacked gives the full row, 218-328px at 320-430pt, no overflow to 2x font). The single-action branch is unchanged from origin/dev and collapses to ~0px at 2x font on 360-390pt; the cheap fix is `const stacked = true` (GapCard.tsx:41). No layout test (testing.md forbids style asserts): device QA at 320dp and at the Largest font is the only guard. W3 (0ea3676): the committed salting purifies only the salted third, so the property is red on 4 of 2,552 shelves at 4,000 seeds and 21 of 12,766 at 20,000; purify every enzyme-tagged product in saltedShelf. W4 (094872c): the owner asked it to REMAIN on the generation page; it was never there; the Draft Preview shows paused rows and the collapsed "In reserve · N" with "Add anyway", so nothing is silent; the left-out code is unreachable debt (owner: delete). W5 records: 299e5b8 was not logged (below); the tech design FE-7/FE-8 and its wiring diagram still describe the removed Routines-screen wiring; "three raw-type writers" is four screens / six sites.
NITS. RadioOptionGroup ring offset is a fixed 2.5px (drifts under Dynamic Type); ConflictWarningInline routineHash is optional (absence restores the tab-scoped bug); notice test 3 pins "every weekday" only when today is not Monday; the routines-screen absent-block test has no positive control; useRoutineLinking.ts is dead and appends raw-typed steps; the property test asserts its guard before its offences; stale comments in routinePlanActions.ts:83, productOwnership.ts:9, routineLeftOut.ts:7; the tech-design note "never displaces" overstates; handoff JSON still says phase engineer / IN_PROGRESS.
Scope. 664b8dc, 7760ed9 and 299e5b8 are pre-existing defects found in owner testing, not part of this task's design; kept on the branch at the owner's request (small, isolated, cherry-pickable, tested) and listed in the PR description as unrelated fixes. 4f3cd10 and 094872c belong to the task.
Record of 299e5b8: upsertProductStep appended every new manual step at the end, so SPF, then toner, then moisturizer left the SPF mid-routine. The new pure src/utils/stepInsertion.ts insertStepByLayering puts the new step before the first existing step with a higher LAYERING_ORDER index, else at the end; existing steps are never re-sorted, hidden steps count for position, an unknown legacy type degrades to append, replaceProductStep / existing-step upsert / buildStepsFromPlan are unaffected. Tests: src/utils/stepInsertion.test.ts, tests/routine-step-grouping/manualAddOrder.test.ts (2 of 3 fail on the old append).
Owner-visible trade-offs: a product removed on purpose is no longer listed on the saved Routines screen (only the Draft Preview shows what a plan sets aside); a conflict dismissal now follows the whole routine, not the open tab or weekday.
Owner decision recorded (2026-10-16): "In reserve" on the generation page IS what she meant; the unused left-out code is to be deleted after this review. Open: key conflict dismissals by product pair (W1)? make the single-action gap card stacked too (W2)?

