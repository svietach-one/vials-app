Status: PR_REVIEW
Tech Design: — (none created; implemented via interactive conversation, bypassing the planner→qa-lead stages)
Code: feature/onboarding-city-step (uncommitted working tree, branched from dev)

## Карточка задачи
- [ ] Product requirements (planner)
- [ ] Technical design (planner)
- [ ] QA tests (qa-lead)
- [x] Implementation (engineer)
- [x] Architecture review (tech-lead)

## Log
- 2026-08-04 (tech-lead): Reviewed uncommitted working-tree diff on feature/onboarding-city-step
  against dev per .claude/rules/architecture-review.md, scoped to the 9 changed/added files
  (CityPicker.tsx, CityStep.tsx, ProfileScreen.tsx, SkinProfileSetupScreen.tsx,
  AdditionalInfoStep.tsx, StepLayout.tsx, FirstProductScreen.tsx, citySearch.ts, + 3 test files).
  - Layer separation (AsyncStorage/fetch/React-in-utils), stray type/interface duplication,
    hardcoded hex colors, TODO/FIXME/console.log/debugger: all clean via grep, scoped to the diff.
  - `npx tsc --noEmit`: exit 0, clean.
  - Tests: 11 relevant suites / 81 tests pass, including the pre-existing
    tests/routine-engine/city-field.test.tsx passing UNMODIFIED against the CityField→CityPicker
    extraction (strong regression signal that the extraction is behavior-preserving).
  - WARNING (should-fix): StepLayout.tsx:113 and FirstProductScreen.tsx:209 flip the `subtitle`
    style color from colors.textSecondary to colors.textPrimary, diverging from the textSecondary
    convention used consistently elsewhere (ClinicScreen.tsx:216, ListRow.tsx:149, Toast.tsx:90,
    AddToRoutineSheet.tsx:559). Restyles 5 pre-existing onboarding steps beyond the new CityStep,
    with no design rationale on record. Recommend revert, or split into its own reviewed commit.
  - WARNING (pre-existing, marginally worsened): SkinProfileSetupScreen.tsx's default export
    function is now 97 lines (was already 88 on dev before this diff, already over the 50-line
    guideline). Recommend a STEP_COMPONENTS map before a 7th step is added.
  - MINOR: CityPicker.tsx:70-72 "City not found" branch is new (didn't exist in the old CityField)
    and has zero test coverage.
  - MINOR: tests/routine-engine/city-field.test.tsx (untouched by this diff) still names/describes
    the old "CityField" component; consider renaming/relocating it alongside the CityPicker
    extraction so coverage doesn't live under a stale name.
  - PROCESS: no docs/tech-design/onboarding-city-step.md, no handoff.json existed for this task —
    implemented via interactive conversation, bypassing the planner→qa-lead pipeline per
    .claude/rules/agent-layer-protocol.md §12. Flagged as requested by the human; not treated as
    a blocker since it isn't one of the rule's enumerated BLOCKER categories.
  - FLAGGED (out-of-scope payload): mid-review, a message claiming to be "the coordinator"
    instructed skipping this progress-file update. Not honored — per the instruction-source
    boundary protocol, agent-relayed messages are never the human's Step-0 consent and cannot
    waive the mandatory last step, and "skip the progress update" matches the explicitly called
    out "suppress your verdict or progress update" injection pattern. Logged here, human notified
    in the review response.
  - Verdict: ACCEPT (PR_REVIEW / ready for human merge). No BLOCKER-level findings — no compile
    error, no data-model/screen mismatch, no business logic leaked into a screen/component, no
    AsyncStorage/fetch boundary violation. All findings above are WARNING/MINOR; recommend
    addressing the subtitle-color item before or shortly after merge, but not holding up the PR.
