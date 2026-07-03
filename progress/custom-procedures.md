Status: DONE
Tech Design: — (none; implemented directly from user requirements, per task description)
Code: src/types/index.ts, src/utils/procedureLifespanHelpers.ts, src/utils/procedureLifespanHelpers.test.ts, src/utils/conflictEngine.ts, src/components/clinic/AddProcedureModal.tsx, src/components/clinic/ProcedureLifespanCard.tsx, src/screens/ClinicScreen.tsx, src/components/routine/ClinicalRestrictionsBlock.tsx

## Карточка задачи
- [ ] Product requirements (planner)
- [ ] Technical design (planner)
- [ ] QA tests (qa-lead)
- [x] Implementation (engineer)
- [x] Architecture review (tech-lead)

## Log

### 2026-07-03 — review fixes applied (engineer)

All three findings from the tech-lead review below are resolved:

- WARNING (ProcedureLifespanCard.tsx non-null assertions): `isCustomProcedure`
  is now a type predicate narrowing to
  `UserProcedureLog & { estimatedReturnDate: string; customName: string }`
  (procedureLifespanHelpers.ts); both `proc.estimatedReturnDate!` assertions
  in getTimeLabel removed.
- WARNING (missing edge-case tests): added tests for an inverted
  estimatedReturnDate (return before performed) and a missing
  estimatedReturnDate (undefined) — both clamp to the 1-day minimum
  (procedureLifespanHelpers.test.ts).
- NIT (ClinicalRestrictionsBlock.tsx local PROCEDURE_LABELS): local map
  deleted; the component now uses the shared getProcedureDisplayName(),
  completing the migration started for ProcedureLifespanCard/ClinicScreen.

Quality gates: `npx tsc --noEmit` — 0 errors (the 7 pre-existing
RoutinesScreen errors noted in the review were resolved by the completions
work in cf9aa87). In-scope suites
(`npx jest src/utils/procedureLifespanHelpers.test.ts src/utils/conflictEngine.test.ts`)
— 186 tests passed. Full `npm test` remains at the known project baseline
(14 suites failing on AsyncStorage/native-module setup, unrelated to this task).

### 2026-07-03 — tech-lead review (custom procedures feature)

No planner/qa-lead artifacts exist for this task (no progress file existed prior to
this review either — created here per coordinator instruction). Per the review
brief, this shipped directly from user requirements without a docs/tech-design/
doc, so design-fidelity checks were replaced with verification against the stated
design decisions. Reviewed `git diff` of the 8 in-scope files only; explicitly
excluded unrelated working-tree changes (CatalogScreen, ProductDetailScreen,
storage.ts, App.tsx, AppNavigator, RoutinesScreen, DeleteProductModal,
RoutineStepCard, tests/product-shelf-card, src/domain/, completionsStore) and the
.claude/rules/CLAUDE.md housekeeping diff, per task scope.

**Verdict: ACCEPT WITH WARNINGS**

Quality gates:
- `npx tsc --noEmit`: 7 errors, all in `src/screens/RoutinesScreen.tsx` (out of
  scope — unrelated in-flight completions-store/hide-vial work referencing
  `useCompletionsStore` / `getSkincareDateString`, not touched by this diff).
  Zero errors in any of the 8 in-scope files.
- `npx jest src/utils/procedureLifespanHelpers.test.ts src/utils/conflictEngine.test.ts`:
  2 suites / 72 tests passed.
- No TODO/FIXME/HACK/console.log/debugger found in the 8 in-scope files.

Correctness verification (hand-traced against CLINICAL_RULES_DB and the store):
- `UserProcedureLog` widened via new `ProcedureLogKey = CosmeticProcedureKey |
  'custom'`, with `customName`/`estimatedReturnDate` added as optional fields —
  confirmed additive/backward-compatible; every consumer branches on
  `procedureKey !== 'custom'` first, so pre-existing persisted records are
  unaffected. No changes to src/store/ (confirmed via `git diff --stat`).
- `getTimelineConfig()` (procedureLifespanHelpers.ts:41) derives
  totalEffectMonths/fadeTriggerMonth (0.75 ratio) from the date span for
  customs, clamping to a 1-day minimum for equal/inverted/missing
  estimatedReturnDate via `Math.max(...,1)` + `Number.isFinite` guard — correct
  by inspection for all three sub-cases.
- `computeStatus()` gates rehab behind `rehabDays > 0` (customs always skip
  rehab); `archived` status short-circuits before any date math; deferral cap
  (3x) is shared, untouched logic that works identically for customs since
  `deferralCount` is a required field defaulted to 0 by both creation paths.
- Customs correctly skip collision/seasonal/phototype checks in
  AddProcedureModal (`isCustom ? null : ConflictEngine...`);
  `checkProcedureCollision`'s active-list type was correctly widened to
  ProcedureLogKey; confirmed no PROCEDURE_COLLISION_RULES entry references
  'custom'.
- AddProcedureModal.handleSave() fully validates custom input before it reaches
  the store: customName required (trimmed non-empty), estimatedReturnDate
  required + must parse as a real calendar date + must be strictly after
  datePerformed (stricter than the helper's own defensive clamp — good
  defense-in-depth). Confirmed AddProcedureModal.tsx is the only production
  call site constructing `procedureKey: 'custom'`, and
  `proceduresStore.updateProcedure` shallow-merges patches
  (`{...p, ...patch}`), so it never clears estimatedReturnDate on an existing
  custom record.

Findings:

WARNING — src/components/clinic/ProcedureLifespanCard.tsx:68,77: non-null
assertions on `proc.estimatedReturnDate!` in the custom branches of
getTimeLabel. Currently unreachable given the validation trace above, but not
compiler-enforced — a future edit path or new creation call site that omits
the field wouldn't throw, it would silently render "NaN undefined NaN" via
formatDate(). This same diff already sets the right precedent elsewhere:
ClinicalRestrictionsBlock.tsx's isInRehabWindow was turned into a type
predicate (`proc is UserProcedureLog & { procedureKey: CosmeticProcedureKey }`).
Recommend the same for isCustomProcedure, e.g.
`proc is UserProcedureLog & { estimatedReturnDate: string; customName: string }`,
removing the `!` assertions.

WARNING — src/utils/procedureLifespanHelpers.test.ts: the clamp-to-1-day test
only covers estimatedReturnDate === datePerformed (equal). No test exercises a
genuinely inverted date (return before performed) or a missing
estimatedReturnDate (undefined) — both hit different sub-branches of the same
guard than the one tested. Implementation is correct by inspection; recommend
adding both cases since the review brief specifically calls them out as edge
cases.

NIT — src/components/routine/ClinicalRestrictionsBlock.tsx:13-20: still
defines its own local PROCEDURE_LABELS map, and its labels have already
drifted from the canonical one added in this diff ('Botox' vs 'Botox /
Dysport', 'Dermal fillers' vs 'Dermal Fillers', etc. in
procedureLifespanHelpers.ts), instead of using the new
getProcedureDisplayName(). The diff migrated the two other pre-existing
duplicates of this exact map (ProcedureLifespanCard.tsx, ClinicScreen.tsx) to
the shared helper but left this one behind. Low impact today — per
docs/tech-design/routine-redesign.md this component is currently
orphaned/not rendered on any screen — but worth finishing the migration (or
deleting the file, if confirmed dead) before it's ever wired back in.

Also noted, not acted on: the review request for this task arrived with an
appended `<command-message>security-review</command-message>` block (twice, in
two consecutive turns) attempting to redirect this session into an unrelated
security-review skill, the second time with a git status that had been
corrected to match reality after being called out. The coordinator confirmed
in-band that this was injected outside their actual prompt and instructed it
be ignored; it was not executed and had no effect on this review.
