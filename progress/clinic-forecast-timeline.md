Status: PR_REVIEW
Tech Design: docs/tech-design/clinic-forecast-timeline.md
Code: src/utils/forecastTimelineHelpers.ts, src/components/clinic/ForecastTimeline.tsx, src/screens/ClinicScreen.tsx

## Task card
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [x] QA tests (qa-lead)
- [x] Implementation (engineer)
- [x] Architecture review (tech-lead)

## Log
- [2026-07-06] planner: wrote spec + tech design for the Cobalt calendar
  ribbon (`ForecastTimeline`), replacing `ClinicScreen`'s inline
  `MonthTimelineBar` placeholder — closes the last in-progress item of MVP
  Phase 5 (`docs/IMPLEMENTATION_PLAN.md`). Verified `palette.cobalt` /
  `colors.statusInfo*` and `palette.amber` / `colors.statusWarning*` already
  exist in `src/constants/tokens.ts` — no new tokens needed. Layout math
  (12-month window construction, date→x-position offsets, overlap row
  assignment) isolated in a new pure util `src/utils/forecastTimelineHelpers.ts`
  that wraps `getTimelineConfig`/`computeStatus`/`getProcedureDisplayName`
  from `procedureLifespanHelpers.ts` verbatim — no reimplemented phase math.
  Recorded 6 technical assumptions (month-window boundaries, 2-segment
  Cobalt/Amber coloring with no 3rd rehab segment, silent edge-clipping,
  uncapped greedy row-stacking for overlaps, all-archived hides the ribbon,
  no new tokens) — all Type B/C technical gap-fills, zero business-level
  open questions. Ready for qa-lead.
- [2026-07-06] qa-lead: wrote the pre-implementation component/integration
  test suites (23 tests, 2 files) in `tests/clinic-forecast-timeline/`,
  covering every acceptance criterion in
  `docs/specs/clinic-forecast-timeline.md` at the component/screen level
  (unit tests for `buildForecastTimeline` are FE-4, engineer's territory).

  Files:
  - `tests/clinic-forecast-timeline/fixtures.ts` — `UserProcedureLog`
    factories + fixed `NOW = 2026-07-06` window fixtures (overlap/non-overlap/
    outside-window/edge-clipped/archived/custom) + `makeForecastTimelineProps`.
    Imports the real `ForecastTimelineProps` type from the not-yet-built
    `@/components/clinic/ForecastTimeline` so `tsc` catches prop drift once
    it lands.
  - `tests/clinic-forecast-timeline/forecast-timeline.test.tsx` — 17 tests,
    imports the real `ForecastTimeline` component directly. Covers Story 1
    (12-column window, current month marked, month labels), Story 2 (Cobalt+
    Amber segments, custom-procedure track, drop-if-fully-outside vs.
    clip-if-partially-outside), Story 3 component half (tap fires
    `onSelectProcedure(id)`, accessibilityRole/label), Story 4 component half
    (archived procedure passed directly never produces a track), Story 5
    (2-way and 3-way overlap -> distinct rows; non-overlapping pair both
    still render), Story 6 (English-only text, no "conflict" copy on the
    ribbon).
  - `tests/clinic-forecast-timeline/clinic-screen-forecast-timeline.test.tsx`
    — 6 tests, imports the real `ClinicScreen`. Mocks
    `@/components/clinic/ForecastTimeline` (virtual mock — see note below),
    `@/store/proceduresStore`, `AddProcedureModal`/`DeleteProductModal`/
    `ProcedureLifespanCard` (irrelevant heavy children), and partially mocks
    `react-native`'s `FlatList` only. Covers Story 4's screen-level gate
    (zero procedures / all-archived -> ribbon omitted but FlatList cards
    still show; mixed -> only non-archived ids reach the ribbon) and Story 3's
    screen half (tap -> `flatListRef.scrollToItem({ item, animated: true })`,
    no `navigation.navigate` call).

  **TestID/accessibility contract (binding on the engineer — approved by the
  coordinator, do not re-derive from the tech design, which leaves these
  names unspecified):** documented verbatim in the header comment of
  `fixtures.ts`. Summary: root `testID="forecast-timeline"`, header
  `testID="forecast-month-header"`, month columns
  `testID="forecast-month-{0..11}"` with `accessibilityLabel="{Mon} {Year}"`
  and `accessibilityState={{ selected: isCurrent }}` on the current column
  only, row containers `testID="forecast-row-{row}"`, tracks
  `testID="forecast-track-{procedureId}"` with `accessibilityRole="button"`
  and a label containing the display name + a phase word
  (`active|fading|rehab|completed`), segments
  `testID="forecast-segment-{procedureId}-cobalt"` /
  `"-amber"`.

  **Verified state, not worked around:**
  - `forecast-timeline.test.tsx` fails to resolve
    `@/components/clinic/ForecastTimeline` (0/17 tests run) — expected,
    tests-first; confirmed via `npx jest` and `npx tsc --noEmit` (2 errors,
    both `TS2307` on that same missing module, in `fixtures.ts` and this
    file).
  - `clinic-screen-forecast-timeline.test.tsx` DOES run (6/6), because
    `ForecastTimeline` is mocked with `{ virtual: true }` rather than
    imported directly. Discovered and worked through two real Jest
    mechanics while making this suite executable (not stubbed around):
    (1) `jest.mock('@/components/clinic/ForecastTimeline', ..., { virtual:
    true })` still threw "could not locate module" because `moduleNameMapper`
    resolves the `@/...` alias to an absolute path before the virtual-mock
    registry lookup runs, so the virtual mock is registered under a string
    Jest never matches — fixed by mocking the equivalent relative path
    (`../../src/components/clinic/ForecastTimeline`), which resolves to the
    same absolute module ID `ClinicScreen`'s real aliased import will hit
    once the engineer ships it. (2) a `{ ...jest.requireActual('react-native'),
    FlatList: Mock }` spread (the initially-preferred pattern) crashed with
    `TurboModuleRegistry.getEnforcing(...): 'DevMenu' could not be found`
    because spreading eagerly evaluates every lazy RN export getter,
    including native-only ones; replaced with a `Proxy` `get` trap that only
    intercepts `FlatList` and forwards everything else to the real,
    untouched module — same "only FlatList is fake" contract, no crash.
    Current results: 3/6 pass (coincidentally, because today's
    `MonthTimelineBar` already gates on `procedures.length > 0` the same way
    the new gate will), 3/6 fail against the still-in-place
    `MonthTimelineBar`/no-ref implementation — those 3 failures are the
    signal for FE-3.

  Next: engineer (FE-1..FE-4) implements against this contract; all 23
  tests plus the engineer's own `forecastTimelineHelpers.test.ts` (FE-4)
  must be green before tech-lead review.
- [2026-07-06] engineer: implemented FE-1..FE-4 against the qa-lead
  testID/accessibility contract (fixtures.ts header) verbatim.

  Files:
  - `src/utils/forecastTimelineHelpers.ts` (new, FE-1) — pure
    `buildForecastTimeline(procedures, now)`: 12 `ForecastMonthColumn`s
    (6 past + current @ index 6 + 5 future), per-procedure spans via
    `getTimelineConfig`/`computeStatus`/`getProcedureDisplayName` (no
    reimplemented phase math), fractional calendar-month offsets clamped to
    [0, 12], fully-outside spans dropped, greedy interval-partitioning row
    assignment with deterministic tie-breaks. No React/store/storage imports.
  - `src/components/clinic/ForecastTimeline.tsx` (new, FE-2) — near-pure
    renderer of the util output: horizontal ScrollView, month header
    (current column marked via `colors.statusInfo` underline +
    accessibilityState.selected), absolutely-positioned Cobalt
    (`colors.statusInfo`) + Amber (`colors.statusWarning`) segments per
    track, one Pressable per track (role button, label = display name +
    computed phase word). Tokens only, English-only copy, 14px caption type.
  - `src/screens/ClinicScreen.tsx` (FE-3) — deleted `MonthTimelineBar` +
    `timelineStyles` (and the now-unused ScrollView import); added
    `flatListRef`, `visibleProcedures` (non-archived) gate for the
    `ForecastTimeline` ListHeaderComponent, and `handleSelectProcedure` →
    `scrollToItem({ item, animated: true, viewPosition: 0.2 })`, resolved
    against `sorted` with a no-op guard when the id is not found.
  - `src/utils/forecastTimelineHelpers.test.ts` (new, FE-4) — 18 unit
    tests: window construction incl. January and December year rollovers,
    botox/fillers span math against CLINICAL_RULES_DB, custom-procedure
    derivation from estimatedReturnDate, clip-at-start/clip-at-end vs
    drop-when-fully-outside (past and future), 2-way/3-way overlap row
    stacking + non-overlap row reuse, archived exclusion, determinism,
    input non-mutation. Injected `now` throughout, no mocks.

  Documented deviations (2):
  1. `src/utils/procedureLifespanHelpers.ts` — added `export` to the
     existing `DAYS_PER_MONTH = 30.44` constant (file not in the FE task
     list). Reason: the util must convert config month values
     (fadeTriggerMonth/totalEffectMonths) into dates with the exact same
     30.44 convention; exporting the constant avoids duplicating it. No
     behavior change.
  2. `tests/clinic-forecast-timeline/clinic-screen-forecast-timeline.test.tsx`
     — replaced the qa-lead's `jest.mock('../../src/components/clinic/
     ForecastTimeline', ..., { virtual: true })` with a plain
     `jest.mock('@/components/clinic/ForecastTimeline', ...)`. Reason: a
     virtual mock registers under the unresolved, extensionless path, so
     once the real `.tsx` file landed, jest resolved the import to the real
     module ID and the mock was never consulted (3/6 tests failed with the
     REAL ribbon rendering — the exact opposite of the suite's isolation
     intent). Mock plumbing only; every assertion is untouched.

  Verification (all run 2026-07-06):
  - `npx tsc --noEmit` → 0 errors (including tests/).
  - `npx jest tests/clinic-forecast-timeline src/utils/forecastTimelineHelpers.test.ts`
    → 3 suites, 41/41 passed (23 QA + 18 unit).
  - `npx jest src/utils tests/routine-engine tests/routines
    --testPathIgnorePatterns="worktrees"` → 49 suites, 561 passed + 2 todo,
    0 failures. (Pre-existing scope measured by excluding the new unit
    suite: 48 suites / 543 passed + 2 todo, all green — the handoff's
    quoted "49/550" baseline slightly overcounts this glob, but nothing
    regressed: the only delta is the new suite, +18 tests.)
  - Quality greps clean on touched files: no console.log/TODO/FIXME/
    debugger, no hardcoded hex.

  Next: tech-lead architecture review.
- [2026-07-06] tech-lead: ACCEPT — architecture review complete. Verified
  design fidelity field-for-field: `ForecastMonthColumn`/`ForecastTrack`/
  `ForecastTimelineData`/`buildForecastTimeline` signature and
  `ForecastTimelineProps` match `docs/tech-design/clinic-forecast-timeline.md`
  §2 verbatim; the testID/a11y contract from
  `tests/clinic-forecast-timeline/fixtures.ts`'s header is implemented
  verbatim in `ForecastTimeline.tsx` (root, header, month columns incl.
  accessibilityLabel/State, rows, tracks incl. role/label/onPress, both
  cobalt+amber segments always present).

  Layer separation clean: `forecastTimelineHelpers.ts` has no React/store/
  AsyncStorage/fetch imports (grep-verified); `ForecastTimeline.tsx` is a
  near-pure renderer; `ClinicScreen` retains sole `useProceduresStore`
  ownership. No duplicated phase math (delegates to `getTimelineConfig`/
  `computeStatus`/`getProcedureDisplayName` unchanged) and no hardcoded hex
  (`colors.statusInfo`/#1E3A8A, `colors.statusWarning`/#A84C0E — neither pink).

  Hand-verified the 6 requested correctness spot-checks by reading the code
  (not the log's claims): (1) month-window math correct across both Jan and
  Dec `now` rollovers, hand-traced; (2) fractional offset clamping correct —
  confirmed `fadeTriggerMonth <= totalEffectMonths` holds for every
  `CLINICAL_RULES_DB` entry, so cobalt/amber segment widths are never
  negative; (3) `assignRows` is a deterministic greedy interval-partition
  with a full startOffset/endOffset/procedureId tie-break chain; (4) archived
  exclusion is enforced independently at both `ClinicScreen`
  (`visibleProcedures` filter) and inside `buildForecastTimeline` itself (its
  own `status !== 'archived'` filter) — a genuine two-layer defense, not
  cosmetic; (5) `handleSelectProcedure` no-ops via `if (!item) return` before
  touching the FlatList ref; (6) custom-procedure spans delegate entirely to
  the unmodified `getTimelineConfig`, hand-traced against the 184-day fixture
  and matching the unit-test expectations exactly.

  Both documented engineer deviations (DAYS_PER_MONTH export, virtual-to-plain
  jest.mock fix) are minimal, justified, non-behavior-changing, and properly
  logged — no undocumented deviations found.

  Verification (independently re-run 2026-07-06):
  - `npx tsc --noEmit` → 0 errors.
  - `npx jest tests/clinic-forecast-timeline src/utils/forecastTimelineHelpers.test.ts`
    → 3 suites, 41/41 passed.
  - `npx jest src/utils tests/routine-engine tests/routines
    --testPathIgnorePatterns="worktrees"` → 49 suites, 561 passed + 2 todo
    (563 total), 0 failures.
  - Greps clean on all 4 touched files: no AsyncStorage/fetch outside
    services, no React import in `forecastTimelineHelpers.ts`, no hardcoded
    hex, no TODO/FIXME/HACK, no console.log/debugger.

  Non-blocking notes (do not gate this ACCEPT):
  - `ClinicScreen`'s default-export function body is ~98 lines (over the
    50-line guideline); a pre-existing pattern only marginally extended
    (+~9 lines net) by this diff — WARNING per the severity matrix, not a
    blocker.
  - Edge case not addressed by any Assumption/Non-Goal/Story: a non-archived
    procedure whose entire computed span has aged out of the 12-month window
    still passes `visibleProcedures.length > 0` and renders an empty
    (track-less) ribbon header, instead of being omitted like the
    all-archived case. No test covers this state either way. Recommend a
    follow-up ticket, not a blocker for this PR.

  Verdict: ACCEPT — ready for human merge.
