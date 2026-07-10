Status: READY_FOR_MERGE
Tech Design: docs/tech-design/my-shelf-filter-bottomsheet.md
Code: src/types/index.ts, src/constants/labels.ts, src/screens/CatalogScreen.tsx, src/screens/CatalogScreen.test.ts, src/components/catalog/CatalogFilterTrigger.tsx (new), src/components/catalog/FilterSheet.tsx (new), src/components/catalog/CatalogFilterHeader.tsx (deleted), package.json (jest.moduleFileExtensions), tests/routine-engine/today-screen.test.tsx

## Карточка задачи
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [x] QA tests (qa-lead)
- [x] Implementation (engineer) — test-infra issue root-caused and fixed by tech-lead + engineer follow-up
- [x] Architecture review (tech-lead) — ACCEPT

## Log

2026-07-06 — planner: spec + tech design created for FE-13 (My Shelf filter UI migration from
  the horizontal `CatalogFilterHeader` chip row to a categorized `FilterSheet` bottom sheet).
  Grounded against actual shipped code: `src/screens/CatalogScreen.tsx` (local `filterState`
  useState, no store — `applyFilters` and `hasActiveFilters` both live here), the sibling
  `progress/shelf-filtering.md` task (2026-06-27, tech-lead ACCEPTED) which originally shipped
  `CatalogFilterHeader.tsx` and the 3-value `BiomarkerTag` system this task retaxonomizes,
  `src/components/routine/AddToRoutineSheet.tsx` (bottom-sheet ref/present/dismiss pattern reused
  for `FilterSheet`), `src/types/index.ts` (`CatalogFilterState`/`BiomarkerTag` extended to
  `FunctionalBenefit`).

  Corrections made after reading actual code (not just the prior conversation's design draft):
  - `applyFilters`'s Gate 3 combines multiple selected biomarkers with **AND** semantics today
    (`CatalogScreen.tsx` lines 86-96) — an earlier draft of this design had incorrectly assumed
    OR. Fixed to preserve AND for `selectedBenefits`, documented as an explicit assumption since
    it's not the default a reader would assume for a "multi-select" filter.
  - The old `Hydration` biomarker matched on `ProductType` (`HYDRATION_TYPES` heuristic), not on
    `activeTags` — switching it to ingredient-based (`hyaluronic_acid`/`panthenol`/`ceramides`) is
    a deliberate behavior change for mechanism consistency across all 6 new benefit buckets, not
    an oversight; logged as an assumption.
  - The initial ingredient→benefit map orphaned `retinoid`, `retinol`, and `copper_peptides`
    (no bucket) and dropped `niacinamide` down to one bucket, versus full coverage under the old
    `ACTIVES_KEYS`/`SOOTHING_KEYS` lists. Fixed: retinoid/retinol → exfoliation, copper_peptides →
    barrier_repair, niacinamide → soothing + brightening (dual). No regression in filterable
    ingredient coverage versus the currently-shipped `shelf-filtering` task.

  No BLOCKED items. Both open technical questions (filter-state ownership, benefit taxonomy
  mapping) resolved as assumptions in the tech design — neither affects API, database, or
  migrations, so no product-owner sign-off was required before proceeding.

2026-07-06 — product owner: APPROVED. Cleared for qa-lead to write test blueprints for
  FE-13-1..FE-13-8.
2026-07-06 — qa-lead: 4 test blueprint files written under tests/my-shelf-filter-bottomsheet/
  (fixtures.ts, CatalogFilterTrigger.test.tsx, FilterSheet.test.tsx,
  CatalogScreen.integration.test.tsx) — 34 integration/component tests total. None of
  FE-13-1..FE-13-7 exist yet, so `npx tsc --noEmit` currently reports the expected TDD-red
  errors: "Cannot find module '@/components/catalog/FilterSheet'" / '.../CatalogFilterTrigger'
  and "'selectedBenefits' does not exist in type 'Partial<CatalogFilterState>'" — all three
  point directly at FE-13-1, FE-13-4, FE-13-5, confirming the tests target the right contract
  and introduce no unrelated compile errors (verified by grepping tsc output for this feature's
  files before writing this entry).

  Coverage:
  - CatalogFilterTrigger.test.tsx (7 tests): no badge at activeFilterCount=0, badge dot present
    at >0, onPress fires once, badge coexists with press handling. Defines a binding
    accessibility-label contract not spelled out in the tech design ("Open filters" / "Open
    filters, {n} active") since FilterSheetProps/CatalogFilterTriggerProps only specify the data
    shape, not screen-reader copy — documented at the top of the file as the contract FE-13-4
    must implement.
  - FilterSheet.test.tsx (18 tests): opening shows the committed selection not defaults (Story 1
    AC3), reopening after an abandoned uncommitted edit discards the draft and shows the last
    committed state, Product Type single-select incl. explicit deselect back to "All" (Story 2
    AC1), Functional Benefit multi-select independent of Product Type (Story 2 AC2), live Apply-
    button count updates pre-Apply (Story 2 AC4), AND semantics across multiple benefits proven
    with a case where OR would yield 2 and AND must yield 0 (Story 2 AC3), dismiss-without-Apply
    never calls onApply (Story 2 AC5), Clear All resets the draft without closing (Story 3 AC2),
    Apply commits + closes (Story 3 AC1), empty-result draft still allows Apply (spec §5). Uses
    the real `@/constants/labels` map (not mocked) so these tests double as a regression guard on
    FE-13-2's ingredient→benefit map, incl. the three corrected mappings from the tech design's
    Assumptions (retinoid/retinol→exfoliation, copper_peptides→barrier_repair, niacinamide→
    soothing+brightening).
  - CatalogScreen.integration.test.tsx (9 tests): full-screen wiring — trigger badge on/off,
    reopen-preserves-commit, Apply narrows the visible shelf list, dismiss-without-Apply leaves
    the list and badge untouched, Clear All + Apply restores the full catalog, both empty-state
    variants (regression on `hasActiveFilters` now reading `selectedBenefits`).

  Mock strategy: @gorhom/bottom-sheet is mocked with a custom BottomSheetModal stub that
  (a) always renders children regardless of the `visible` prop (matching the real library's
  present()/dismiss()-imperative model already used by AddToRoutineSheet — FilterSheet's own
  `visible`-driven internal effects are real and exercised normally), and (b) exposes a
  `testID="mock-bottom-sheet-backdrop"` Pressable that funnels into `onDismiss`, standing in for
  a real swipe-down/backdrop-tap so Story 2 AC5 is deterministically testable. AsyncStorage is
  mocked defensively in FilterSheet.test.tsx and CatalogScreen.integration.test.tsx in case
  FilterSheet's live-count import chain reaches `applyFilters` via `@/screens/CatalogScreen.tsx`
  (which imports `useProductsStore`, itself reading AsyncStorage on hydrate()) — FilterSheet's
  own props never require a store, this is purely a safety net.

  Deviation/blocker flagged for the engineer (not present in the tech design's task list):
  `tests/shelf-filtering/CatalogFilterHeader.integration.test.tsx` imports
  `@/components/catalog/CatalogFilterHeader`, which FE-13-7 deletes — that suite will fail to
  resolve once FE-13-7 lands and must be deleted by the engineer as part of that task.
  `tests/shelf-filtering/CatalogScreen.integration.test.tsx` also references the retired
  `selectedBiomarkers`/`Soothing`/`Actives`/`Hydration` vocabulary and will fail to compile once
  FE-13-1 lands (`CatalogFilterState` no longer has `selectedBiomarkers`) — the engineer should
  either delete it (fully superseded by this task's `tests/my-shelf-filter-bottomsheet/
  CatalogScreen.integration.test.tsx`, which covers the same default-render/search/PAO-chip
  ground under `FE13-CS-*`, plus everything shelf-filtering's biomarker-specific tests covered
  is retaxonomized here) or update it — flagging rather than silently deleting since the tech
  design's FE-13-7 scope only names `CatalogFilterHeader.tsx`, not its test file. No new spec/
  design BLOCKED items — this is a test-suite handoff note, not a product or architecture gap.

  Not written (explicitly out of this task's QA scope per .claude/rules/testing.md): unit tests
  for the extended `applyFilters` logic — those are FE-13-8, owned by engineer, co-located next
  to `CatalogScreen.tsx` or under `tests/shelf-filtering/` per the tech design's own instruction
  to check existing coverage there first.

  Next: engineer implements FE-13-1..FE-13-7 (and FE-13-8 unit tests) until this suite's 34
  tests + the existing suite pass, and retires/updates the two shelf-filtering test files
  flagged above.

2026-07-06 — engineer: implementation complete for FE-13-1..FE-13-8.
  - FE-13-1: `BiomarkerTag`/`selectedBiomarkers` replaced by `FunctionalBenefit`/
    `selectedBenefits` in src/types/index.ts.
  - FE-13-2: `FUNCTIONAL_BENEFIT_LABELS` + `FUNCTIONAL_BENEFIT_INGREDIENTS` added to
    src/constants/labels.ts, exactly matching the tech design's corrected map
    (retinoid/retinol -> exfoliation, copper_peptides -> barrier_repair, niacinamide ->
    soothing + brightening; spf_filters/spf_chemical intentionally uncovered).
  - FE-13-3: `applyFilters` in src/screens/CatalogScreen.tsx rewritten — Gate 3 now loops
    `selectedBenefits` against `FUNCTIONAL_BENEFIT_INGREDIENTS`, AND semantics preserved
    from the removed `ACTIVES_KEYS`/`SOOTHING_KEYS`/`HYDRATION_TYPES` special-cased blocks.
    `hasActiveFilters` updated to read `selectedBenefits`.
  - FE-13-4 / FE-13-5: `CatalogFilterTrigger.tsx` and `FilterSheet.tsx` created per the
    tech design's prop contracts (matches qa-lead's fixtures.ts exactly — tsc confirms).
    FilterSheet imports `applyFilters` back from `CatalogScreen.tsx` (circular import,
    anticipated by qa-lead's defensive AsyncStorage mock in FilterSheet.test.tsx) —
    resolves fine since the shared function is only invoked inside render, not at
    module-eval time.
  - FE-13-6 / FE-13-7: CatalogScreen.tsx wired to the new components; old
    `CatalogFilterHeader.tsx` deleted.
  - FE-13-8: rewrote the biomarker-specific cases in the co-located
    src/screens/CatalogScreen.test.ts (this file already existed pre-FE-13, holding the
    applyFilters unit tests from the shelf-filtering task) to the new benefit taxonomy,
    added explicit regression tests for the three corrected ingredient mappings and an
    AND-semantics test. All pass.

  `npx tsc --noEmit`: zero errors.

  Deviations found and fixed beyond the tech design's task list (logged per
  architecture-review.md's expectation that undocumented deviations need a log entry):
  - `tests/catalog/catalog-screen-hide-toggle.integration.test.tsx` directly
    `jest.mock('@/components/catalog/CatalogFilterHeader', ...)` — not flagged by
    qa-lead (whose note only covered the two files inside tests/shelf-filtering/).
    Deleting CatalogFilterHeader.tsx broke it. Fixed by swapping the mock to stub
    `CatalogFilterTrigger`/`FilterSheet` instead, matching how this same file already
    stubs `DeleteProductModal`/`RoutineSchedulerSheet`. Confirmed this file passed on
    the unmodified base commit (5eccee1) before this change, so this was a real
    regression I introduced and then fixed, not pre-existing.
  - `tests/shelf-filtering/PaoChip.integration.test.tsx` renders full `CatalogScreen`
    with a hand-rolled `@/constants/labels` mock that predates `FUNCTIONAL_BENEFIT_LABELS`
    — `FilterSheet.tsx`'s module-level `Object.keys(FUNCTIONAL_BENEFIT_LABELS)` crashed
    the whole suite. Fixed by stubbing `CatalogFilterTrigger`/`FilterSheet` in this file
    too (it doesn't test filters, only the PAO chip, so stubbing is correct and matches
    its existing DeleteProductModal/ProductActionSheet stubbing pattern).

  Pre-existing issues found during verification, NOT introduced by FE-13 and explicitly
  NOT fixed here (out of scope) — confirmed via `git stash` against unmodified base
  commit 5eccee1:
  - `tests/catalog/product-detail.test.tsx` and `tests/catalog/catalog-screen.test.tsx`
    already fail on the base commit (AsyncStorage native-module error and a
    `palette.cobaltTint` mock-completeness issue respectively) — unrelated to filters.
  - `tests/shelf-filtering/PaoChip.integration.test.tsx`'s actual assertions (after
    fixing the crash above) still fail: `PaoChip` is defined as a function inside
    `CatalogScreen.tsx` but is **never invoked anywhere in the render tree** — confirmed
    via `git show 5eccee1:src/screens/CatalogScreen.tsx` that this dead-code bug already
    existed on the base commit, predating FE-13. Flagging for a separate fix outside
    this task's scope; the PAO expiry chip currently never renders in the shipped app.

  Unresolved, blocking full green: `tests/my-shelf-filter-bottomsheet/FilterSheet.test.tsx`
  has 12/21 tests failing (all involving `getByText` queries into the real, unmocked
  `Button` component's rendered text — every FilterChip-based checkbox assertion passes).
  Root-caused partially via a scratch repro: this project's jest environment renders
  through what appears to be react-native-web (a plain `<Button>` compiles to a literal
  DOM `<button type="button">` with `userSelect`/CSS-var styles in the debug() dump), and
  the button's `Text` child appears to collapse into a raw text child of the `<button>`
  rather than a separately queryable Text host node, so `@testing-library/react-native`'s
  `getByText` can't find it even though the text is visibly present in `screen.debug()`.
  This is apparently the first test file in the repo to query text inside a real
  (unmocked) `Button`; every other test mocks `Button` to a plain `Pressable`, which
  doesn't hit this. Did not get to finish root-causing (jest/react-native-web config vs.
  something specific to `Button.tsx`) before handing off to tech-lead — flagging as an
  open item rather than guessing at a fix.

2026-07-06 — tech-lead: reviewed FE-13-1..FE-13-8 against
  docs/tech-design/my-shelf-filter-bottomsheet.md and .claude/rules/architecture-review.md.

  Design fidelity (all confirmed by direct file read): `FunctionalBenefit`/
  `CatalogFilterState`/`CATALOG_FILTER_DEFAULT` in src/types/index.ts, and
  `FUNCTIONAL_BENEFIT_LABELS`/`FUNCTIONAL_BENEFIT_INGREDIENTS` in
  src/constants/labels.ts, match the tech design verbatim, including all
  three corrected mappings (retinoid/retinol->exfoliation, copper_peptides->
  barrier_repair, niacinamide->soothing+brightening). CatalogScreen.tsx's
  `applyFilters` (Gate 3 loop), `activeFilterCount`, `hasActiveFilters`, and
  `sheetOpen`/`FilterSheet` wiring match FE-13-3/FE-13-6 exactly.
  CatalogFilterTrigger.tsx and FilterSheet.tsx match their prop contracts
  (`CatalogFilterTriggerProps`/`FilterSheetProps`) verbatim.
  CatalogFilterHeader.tsx confirmed deleted (`ls src/components/catalog/`);
  zero dangling references remain outside one intentional negative-test
  comment in tests/my-shelf-filter-bottomsheet/CatalogScreen.integration.test.tsx.
  `PaoChip`/`RoutineBadge` confirmed untouched, as scoped by FE-13-6.
  grep confirms zero remaining `BiomarkerTag`/`selectedBiomarkers` references
  anywhere in src/ or tests/.

  Layer separation / duplication: no AsyncStorage/fetch in either new file;
  no new Zustand store (local `useState`, per the tech design's Assumption);
  no hardcoded hex in CatalogFilterTrigger.tsx or FilterSheet.tsx (tokens
  only). `typography.label` already applies `textTransform: 'uppercase'`,
  so the spec's "PRODUCT TYPE"/"BENEFITS" all-caps requirement is satisfied
  despite the mixed-case JSX strings — not a deviation.

  Type safety: `npx tsc --noEmit` -> 0 errors (independently re-run).

  Test verification (independently re-run, all findings cross-checked
  against a `git worktree add --detach <tmp> 5eccee1` rather than
  `git stash`, to avoid touching the substantial unrelated uncommitted work
  already in this tree):
  - Root-caused the "jest still runs the broader suite" quirk precisely:
    `--testPathIgnorePatterns="worktrees"` combined with additional bare
    positional path args causes those args to be silently absorbed as MORE
    ignore patterns (an array-type CLI flag greedily consuming subsequent
    tokens), inverting intent — the named files get excluded from the run,
    not isolated. Confirmed via `--listTests` diffing. Workaround: run one
    path at a time, without the ignore-patterns flag, to get ground truth.
  - Confirmed claim (a) on base commit 5eccee1 (isolated worktree):
    tests/catalog/product-detail.test.tsx and tests/catalog/catalog-screen.test.tsx
    fail identically to HEAD (AsyncStorage native-module error /
    `palette.cobaltTint` mock-completeness error respectively) — pre-existing,
    unrelated to this task.
  - Confirmed claim (b): grepped both HEAD and base commit 5eccee1 for
    `<PaoChip` JSX call sites in CatalogScreen.tsx — zero in both. Pre-existing
    dead code, not introduced or newly broken here.
  - Root-caused claim (c) — tests/my-shelf-filter-bottomsheet/FilterSheet.test.tsx's
    12/21 failures — beyond the engineer's partial diagnosis. Not a general
    react-native-web rendering quirk: `src/components/ui/core/Button.jsx`
    (a plain react-dom design-reference stub — raw `<button>`, inline
    CSS-var styles, `{children}` rendered with no `<Text>` wrapper — git-tracked
    since commit 092f7e4, weeks before this task) sits alongside `Button.tsx`.
    Jest's default `moduleFileExtensions` (`["js","mjs","cjs","jsx","ts","tsx",...]`,
    confirmed via `jest --showConfig`) resolves `.jsx` before `.tsx`, so every
    *unmocked* `@/components/ui/core/Button` import under Jest silently
    resolves to the wrong file, and its raw string `children` inside a bare
    `<button>` isn't reachable by `getByText`. Confirmed from the failure
    output that every expected string (e.g. "Apply Filters (6 products)")
    is present verbatim in the rendered tree in every failing case — proving
    FilterSheet's own draftState/matchCount logic and wiring are 100% correct
    and this is a pure query-match failure, not a functional bug. Confirmed
    production is unaffected: metro.config.js's expo/metro-config `sourceExts`
    is `["ts","tsx","mjs","js","jsx",...]` (opposite order) — the real app
    correctly resolves `Button.tsx`. This is a Jest-only, repo-wide test-infra
    defect (24 shadow `.jsx`/`.prompt.md` files exist under src/components/ui/,
    all committed at 092f7e4); every other existing suite simply avoids it by
    mocking `Button` (confirmed a pre-existing defensive
    `jest.mock('@/components/ui/core/Button', ...)` already in
    tests/shelf-filtering/PaoChip.integration.test.tsx, predating this task).
    Not introduced by, or in scope for, my-shelf-filter-bottomsheet.
  - FE-13-8 unit tests (src/screens/CatalogScreen.test.ts) independently
    reviewed: thorough coverage of all 3 Assumption regression mappings, AND
    semantics, `activeTags: undefined` edge case, category+benefit
    combination; Arrange/Act/Assert, correctly co-located, no React import.
    All pass.
  - The two mid-task regression fixes (tests/catalog/catalog-screen-hide-toggle.integration.test.tsx,
    tests/shelf-filtering/PaoChip.integration.test.tsx) reviewed via `git diff`:
    minimal, mock-only, consistent with each file's own pre-existing
    stubbing conventions for other heavy components.

  Verdict: **ACCEPT — ready for human merge.** Non-blocking notes (do not
  gate this ACCEPT):
  - FilterSheet.test.tsx's 12/21 failures are a pre-existing, repo-wide
    Jest-config/test-infra defect unrelated to this task's logic (see
    root-cause above) — recommend a dedicated follow-up task to reorder
    package.json's `jest.moduleFileExtensions` to match metro.config.js
    (ts/tsx before js/jsx) and re-run the full suite once fixed, since that
    will newly exercise ~24 previously-shadowed real `ui/` components.
  - `PaoChip` dead code predates this task (confirmed on base commit
    5eccee1) — recommend a separate cleanup ticket (wire it into
    `ProductShelfCard`'s render, or delete it), not blocking this PR.
  - FilterSheet's main component function is ~122 lines — within the
    ~185-line precedent of `AddToRoutineSheet` it explicitly mirrors; no
    action needed.

2026-07-07 — engineer: applied the tech-lead's recommended `jest.moduleFileExtensions`
  fix in `package.json` (`["ts","tsx","js","mjs","cjs","jsx","json","node"]`) — moves
  `ts`/`tsx` ahead of `jsx` to match `metro.config.js`'s real resolution order, fixing
  the `Button.jsx`-shadowing bug the tech-lead root-caused. Note: kept `mjs` in its
  original relative position (after `js`, not moved to mirror metro's ordering exactly)
  — a first attempt that blindly copied metro's full extension order broke
  `@gorhom/bottom-sheet`'s transitive `react-native-is-edge-to-edge` dependency (an
  untranspiled `.mjs` file jumped ahead of the transpiled `.js` one), which surfaced as
  `src/screens/CatalogScreen.test.ts` failing to parse; reverted that specific
  repositioning and kept the fix minimal.

  As anticipated by the tech-lead's review (24 shadowed `ui/` components), the corrected
  fix un-shadowed several real components beyond `Button`, surfacing two additional
  pre-existing test failures unrelated to FE-13:
  - `tests/routine-engine/today-screen.test.tsx` asserted `button.props.disabled`, which
    is never set on a real RN `Pressable`'s host element (RN folds `disabled` into
    `accessibilityState.disabled` instead — confirmed by reading
    `node_modules/react-native/Libraries/Components/Pressable/Pressable.js`). Fixed the
    assertion to check `button.props.accessibilityState.disabled`. Test passes.
  - `tests/routine-engine/add-procedure-modal.test.tsx` (2 tests) — investigated at
    length; initially suspected the same class of bug (a `pressLogProcedure()` helper
    using `UNSAFE_getAllByProps({children: 'Log Procedure'})`, which also relied on the
    old web-stub `Button.jsx`'s text-collapsing behavior). Root-caused via a temporary,
    fully-reverted `console.log` in `handleSave` that the button press mechanics were
    never the problem — `handleSave` fires correctly either way. The actual failure:
    `handleSave`'s "date cannot be in the future" check does
    `new Date(isoDate) > new Date()` where `isoDate` is a bare `YYYY-MM-DD` string
    (parsed as UTC midnight) and the default `dateText` is today's LOCAL calendar date.
    Confirmed via an isolated `git worktree` at the unmodified base commit (5eccee1,
    zero of my changes) that this test fails there too, right now — a pre-existing,
    time-of-day-dependent timezone bug (triggers whenever local calendar day has rolled
    over ahead of UTC, which is the case at the moment of this session, right after the
    date changed to 2026-07-07 locally while UTC was still on 2026-07-06 evening), wholly
    unrelated to FE-13, Button shadowing, or the moduleFileExtensions fix. Reverted both
    my diagnostic changes (the temporary `console.log`, and an unnecessary
    `pressLogProcedure` edit) back to the committed originals — left as a pre-existing
    defect for a separate ticket, not fixed here (same treatment as the `PaoChip` item).

  Also incident during this work: an unrelated stray `git stash` entry
  (`WIP on feature-add-vial-ux: 76a4538`) got accidentally popped by a careless
  `git stash pop` while investigating the base-commit comparison, producing merge
  conflicts across 5 unrelated files. Fully untangled without data loss: resolved all
  conflicts back to the pre-pop state via `git checkout --ours`/`git rm --cached`,
  restored one file (`src/hooks/useRoutineLinking.ts`) that had been silently deleted by
  the bad merge, and left the original stash entry intact and undropped in the stash
  list for its rightful owner. Verified via full `git status` diff against the
  pre-incident state that nothing was lost.

  Full suite after all fixes: `npx tsc --noEmit` clean. Remaining failures, all
  confirmed pre-existing and out of scope for this task (verified against the
  unmodified base commit 5eccee1): `tests/catalog/catalog-screen.test.tsx`,
  `tests/catalog/product-detail.test.tsx`, `tests/routine-engine/add-procedure-modal.test.tsx`
  (see above), `tests/shelf-filtering/PaoChip.integration.test.tsx` (dead-code, per
  earlier log entry — explicitly deferred to a separate cleanup ticket per product
  owner's instruction). Everything in FE-13's own scope (`tests/my-shelf-filter-bottomsheet/*`,
  `src/screens/CatalogScreen.test.ts`) is green.

  Status: READY_FOR_MERGE.
