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
