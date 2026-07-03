Status: PR_REVIEW
Tech Design: docs/tech-design/hide-vial-bottomshield.md
Code: src/components/product/ProductActionSheet.tsx, src/components/product/ProductShelfCard.tsx, src/screens/CatalogScreen.tsx

## Карточка задачи
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [x] QA tests (qa-lead)
- [x] Implementation (engineer)
- [x] Architecture review (tech-lead)

## Log

2026-06-22 — planner: spec and tech design created. Feature is purely frontend.
  4 files to modify: src/types/index.ts, ProductActionSheet.tsx, CatalogScreen.tsx, RoutinesScreen.tsx.
  No new files, no infra changes, no backend changes.

2026-07-02 — qa-lead: wrote integration tests for FE-1..FE-5. Added 4 new test files:
  tests/catalog/product-shelf-card-hidden.test.tsx (8 tests, FE-4),
  tests/catalog/catalog-screen-hide-toggle.integration.test.tsx (6 tests, FE-2/FE-3),
  tests/routines/routines-screen-hidden-filter.test.tsx (6 tests, FE-5),
  tests/routines/weekly-plan-view-hidden-filter.test.tsx (5 tests, FE-5 / tech-lead's
  WeeklyPlanView review note).

  BLOCKER for engineer/tech-lead before implementation starts — architecture drift:
  This task's spec/tech-design were approved before the later "product-shelf-card"
  feature (merged after) refactored catalog card rendering. Two concrete problems
  found while writing tests against current `dev`:

  1. FE-3/FE-4 file-target is stale. CatalogScreen no longer renders cards inline
     (`renderItem` now just delegates to `<ProductShelfCard>`,
     src/components/product/ProductShelfCard.tsx). `cardContentHidden` /
     `cardContentHidden` opacity style still exists dead in CatalogScreen.tsx's
     StyleSheet but is never applied anywhere. FE-4's dimming + eye-off badge must
     be implemented in ProductShelfCard.tsx, not CatalogScreen.tsx.

  2. FE-2's assumption ("hide toggle row is always rendered in ProductActionSheet,
     not conditionally") is now false. ProductShelfCard always supplies exactly one
     of `onAddToRoutine` / `onRemoveFromRoutine` to ProductActionSheet (based on
     `isInRoutine`), and ProductActionSheet's Hide/Show branch is an `else` that
     only renders when BOTH those props are undefined -> unreachable in the real
     app today. Confirmed by running tests/catalog/catalog-screen-hide-toggle.integration.test.tsx:
     all 6 tests fail because the sheet shows "Add to routine" / "Remove from
     routine" instead of "Hide Product" / "Show Product". Needs a product decision:
     either make the toggle additive (its own row, independent of add/remove-from-routine),
     or fold hide/show semantics into the add/remove-from-routine rows.
     Pre-existing tests/catalog/hide-product.test.tsx (from the original merge of this
     feature, PR #4) and tests/catalog/catalog-screen.test.ts also now fail on `dev`
     for the same/related drift reasons — this is NOT something introduced by this
     QA pass, verified via `git stash` before adding new files.

  FE-1 (Product.isHidden field) and FE-5 (RoutinesScreen / WeeklyPlanView step
  filtering) are already implemented correctly on `dev` and matched the tech design
  as written — confirmed via the new regression-guard tests, all passing
  (routines-screen-hidden-filter.test.tsx: 6/6 pass, weekly-plan-view-hidden-filter.test.tsx: 5/5 pass).

  New testID contract required from engineer for FE-4 (documented in
  product-shelf-card-hidden.test.tsx header): `testID="shelf-card-content"` on the
  ProductShelfCard content wrapper (opacity 0.4 when product.isHidden), plus an
  eye-off Feather icon rendered inside it when hidden.

  Ran full suite (`npx jest`) for context: 17/42 suites already failing on `dev`
  before this change (pre-existing drift unrelated to this task, e.g.
  tests/catalog/catalog-screen.test.tsx, tests/shelf-filtering/CatalogScreen.integration.test.tsx,
  tests/catalog/product-detail.test.tsx). Recommend routing back to tech-lead/planner
  to resolve the FE-2 contradiction before engineer picks this up.

2026-07-02 — tech-lead (Tony): reviewed ManualProductFormScreen.tsx redesign against
  design system contracts and 10-point checklist. This file is unchanged by the
  hide-vial-bottomshield task itself — review was requested inline by the engineer
  working on the branch.

  MANUAL PRODUCT FORM REDESIGN — findings:

  BLOCKER (none beyond pre-existing task BLOCKER above).

  WARNING — W1: paddingVertical: 2 hardcode (line 684, chipsRow style).
    Value 2px is below the minimum token (space[1] = 4px). Should be removed
    entirely (the horizontal ScrollView needs no vertical padding) or replaced with
    space[1] if intent is visible clip-space for chip shadows. Applies only to the
    PAO preset chip row contentContainerStyle.

  WARNING — W2: space[2] + 2 arithmetic for input vertical padding (lines 778, 817).
    Produces 10px — a value with no token equivalent. Both customPaoInput and dateInput
    use this pattern. Replace with space[3] (12px) or space[2] (8px) for token
    alignment. Not a blocking issue but creates an off-grid vertical rhythm.

  WARNING — W3: eyebrowBadge dimensions are hardcoded (width: 26, height: 26,
    borderRadius: 13; lines 659-661). No matching token exists. These are design-
    intentional bespoke values for this component only — acceptable, but worth
    extracting as a named constant (EYEBROW_BADGE_SIZE = 26) within the file so the
    magic number is self-documenting.

  INFO — I1: chipsRow contentContainerStyle includes flexDirection: 'row' (line 682).
    Redundant — a horizontal ScrollView's contentContainer already rows its children.
    Harmless, but dead style.

  INFO — I2: TypeScript errors exist in the repo (3 errors in
    tests/product-shelf-card/ProductShelfCard.test.tsx — usageTime type mismatch and
    missing disabled prop on fixture). These are in test files on dev/pre-existing and
    are NOT in ManualProductFormScreen.tsx. tsc --noEmit finds zero errors in src/.
    The test file errors are pre-existing debt and do not block this screen's merge.

  INFO — I3: notes field is hardcoded to null on save (line 454). When editing a
    product that has notes, those notes are silently cleared. This is a pre-existing
    limitation (the form has no notes field) — the redesign did not introduce it.
    Documented here for product backlog awareness.

  DESIGN SYSTEM COMPLIANCE — all clear:
    - All colors use colors.* or palette.* tokens; zero hardcoded hex values.
    - All spacing uses space[N] or space.* tokens except W1/W2 above.
    - FilterChip children are always plain string literals; no JSX passed as children.
    - Switch uses checked/onValueChange/size only; no extra native props spread.
    - Card style prop comes last in containerStyle array; radius.xl override is correct.
    - InlineAlert non-string children use explicit 14px Text styles per workaround.
    - All font sizes >= 14px throughout; eyebrowNum badge = 14px (passes minimum).
    - No pink/cabernet/red palette values anywhere in the file.
    - Layout: 3 blocks (Product Basics, Ingredients+INCI, Details), sticky footer, fixed
      AppHeader — correct.
    - FilterChip accessibilityRole="radio" override works correctly via {...rest} spread
      after the hardcoded "checkbox" in FilterChip.tsx.
    - isHidden field is preserved on edit (updateProduct merges via spread; isHidden
      absent from patch so original value survives).

  SECURITY REVIEW (this branch, all modified files):
    No exploitable vulnerabilities found. The app is local-only (AsyncStorage, no
    network endpoints in modified files). No dangerouslySetInnerHTML, no eval, no
    hardcoded secrets, no authentication bypass paths introduced by this PR.

  VERDICT: ManualProductFormScreen.tsx redesign is APPROVED for merge.
    Task overall remains BLOCKED pending planner resolution of the FE-2 architecture
    contradiction documented by qa-lead (Hide/Show toggle unreachable in ProductActionSheet
    due to product-shelf-card feature collision).

2026-07-02 — engineer: FE-2 contradiction resolved. Product decision (user, via
  clarifying question): Hide/Show is additive — it always renders as its own row,
  independent of Add/Remove-from-routine, rather than being mutually exclusive with
  them. Implemented on branch `hide-and-add-vial` (fresh branch off `dev`; the old
  `feature-hide-vial-bottomshield` branch was already merged into `dev` at `2b50254`
  and reusing it would have been misleading).

  Also surfaced and fixed a second, related defect found while wiring this in:
  `CatalogScreen.tsx`'s `onRemoveFromRoutine` handler was implemented as
  `updateProduct(id, { isHidden: true })` — i.e. "Remove from Routine" was silently
  reusing the hide flag instead of deleting the routine step. This meant tapping
  "Hide Product" and "Remove from Routine" would trigger the identical store
  mutation while implying different things to the user, and `isInRoutine` (computed
  from whether a step still exists) would stay true after "removing." Per user
  decision, separated the two concerns:
    - "Remove from Routine" now calls the existing `routinesStore.removeProductStep`
      action for every routine containing a step for that product (real deletion).
    - "Hide Product" is the only action that touches `isHidden`
      (`updateProduct(id, { isHidden: !p.isHidden })`), scoped purely to catalog
      visibility, matching the original tech design intent.

  Changes:
    - `ProductActionSheet.tsx`: split the single if/else-if/else block into two
      independent blocks — routine-action row (Add or Remove, unchanged logic) and
      a Hide/Show row that always renders regardless of the routine props.
    - `ProductShelfCard.tsx`: added required `onToggleHidden` prop (was previously
      wired to a no-op stub that only closed the sheet). Added FE-4: wrapped
      name/brand/schedule content in a `testID="shelf-card-content"` View that dims
      to `opacity: 0.4` when `product.isHidden`, plus an eye-off icon badge in the
      badges row (also dimmed). The "more actions" overflow IconButton is untouched
      by the dimming — stays a plain sibling, always opacity 1, always pressable.
    - `CatalogScreen.tsx`: added the real `onToggleHidden` handler; rewrote
      `onRemoveFromRoutine` to use `removeProductStep` as described above.
    - `tests/product-shelf-card/fixtures.ts`: added `onToggleHidden: jest.fn()` to
      `makeDefaultShelfCardProps()` (new required prop).
    - `tests/product-shelf-card/ProductActionSheet.extended.test.tsx`: updated RA-1/
      RA-2 assertions — these pre-existing tests encoded the old mutual-exclusivity
      rule we deliberately changed; they now assert Hide/Show renders *alongside*
      the routine row instead of asserting its absence.
    - Deleted `tests/catalog/hide-product.test.tsx` — dead test debt from the
      original PR #4 merge, referencing `AddProductModal` which no longer exists
      (removed in the earlier flat-page-nav refactor). Fully superseded by
      `tests/catalog/catalog-screen-hide-toggle.integration.test.tsx` and
      `tests/catalog/product-shelf-card-hidden.test.tsx`.

  Verification: all 4 qa-lead test files pass (25/25). All pre-existing tests
  touched by this change now pass, including the updated
  `ProductActionSheet.extended.test.tsx` (8/8) and `ProductShelfCard.test.tsx`.
  `npx tsc --noEmit` shows the same 3 pre-existing errors as on `dev` (confirmed
  via `git stash` diff) — none introduced by this change. Confirmed via `git
  stash` that `tests/catalog/catalog-screen.test.tsx`, `tests/catalog/
  product-detail.test.tsx`, `tests/shelf-filtering/CatalogScreen.integration.
  test.tsx`, and `tests/shelf-filtering/PaoChip.integration.test.tsx` all fail
  identically with and without this diff — pre-existing drift (bad `palette` mock
  missing from a hand-rolled tokens mock predating ProductShelfCard's `palette`
  usage; missing AsyncStorage Jest mock) unrelated to this task, not fixed here.

  Ready for tech-lead architecture review.

2026-07-02 — tech-lead (Tony): architecture review of the hide-vial-bottomshield
  implementation (branch `hide-and-add-vial`). Reviewed handoff.json, this log,
  the tech-design doc, the full diff for ProductActionSheet.tsx, ProductShelfCard.tsx,
  CatalogScreen.tsx, tests/product-shelf-card/fixtures.ts, the updated
  ProductActionSheet.extended.test.tsx, the deleted hide-product.test.tsx, and the
  4 new qa-lead test files (product-shelf-card-hidden, catalog-screen-hide-toggle,
  routines-screen-hidden-filter, weekly-plan-view-hidden-filter).

  DESIGN FIDELITY — FE-1 through FE-5, all satisfied:
  - FE-1: `isHidden?: boolean` on Product, single declaration (types/index.ts:137),
    matches design exactly.
  - FE-2: Hide/Show row confirmed additive — now an unconditional Pressable
    rendered alongside the Add/Remove-from-routine branch (no longer the
    `else` arm that made it unreachable). ProductActionSheetProps.onToggleHidden
    is a required prop, closing the earlier interim tech-lead note. This is the
    product-owner decision referenced in the review request (additive, not
    mutually exclusive) — implemented correctly, not treated as an undocumented
    deviation per that direction.
  - FE-3: CatalogScreen wires onToggleHidden -> updateProduct(id, {isHidden: !isHidden}),
    matching spec.
  - FE-4: dimming + eye-off badge correctly relocated to ProductShelfCard.tsx per
    qa-lead's logged file-target correction (CatalogScreen no longer renders cards
    inline). testID="shelf-card-content" wrapper + opacity:0.4 + eye-off Feather
    icon (size=12, color=colors.textTertiary) all present, closing both interim
    tech-lead notes from handoff.json. Overflow ("more actions") IconButton
    correctly stays a sibling of the dimmed wrapper in bottomRow — always
    opacity 1, always pressable (AC-P6/P7 pass).
  - FE-5: RoutinesScreen / WeeklyPlanView filtering already correct pre-existing
    code, confirmed via the 2 new regression suites (11/11 pass), untouched by
    this diff.

  SECOND PRODUCT-OWNER DECISION (Remove-from-Routine / isHidden split): confirmed
  in code — CatalogScreen's onRemoveFromRoutine now loops `routines` and calls the
  pre-existing, already-tested `routinesStore.removeProductStep(r.id, p.id)` for
  every routine containing a step for that product; onToggleHidden is the only
  remaining caller touching isHidden. Traced `removeProductStep`'s implementation:
  each call reads current state via Zustand `get()`, not a stale closure, so
  sequential calls across multiple routines in the same handler are safe (no
  lost-update risk). This is scope beyond the original 4-file design, but it is
  (a) explicitly product-owner-authorized per this review's framing, and (b)
  thoroughly logged in both handoff.json (engineer_notes) and this file's
  2026-07-02 engineer entry with clear before/after rationale. Per
  architecture-review.md's own resolution rule ("clear log entry -> downgrade to
  WARNING, no log entry -> BLOCKER"), this does not warrant BLOCKER treatment;
  given the explicit sign-off it does not warrant WARNING either — accepted as
  documented, sanctioned scope.

  QUALITY GATES:
  - `npx tsc --noEmit`: 3 errors, all in tests/product-shelf-card/ProductShelfCard.test.tsx
    (usageTime 'both'-only literal type; missing `disabled` key on the fixture's
    inferred return type). Confirmed via `git diff dev --stat -- tests/product-shelf-card/ProductShelfCard.test.tsx`
    that this file has zero changes on this branch — 100% pre-existing debt, not
    introduced here. Zero errors in any file this PR touches.
  - `npx jest` across the 6 relevant suites: 64/64 tests pass (ProductActionSheet.extended.test.tsx,
    ProductShelfCard.test.tsx, product-shelf-card-hidden.test.tsx,
    catalog-screen-hide-toggle.integration.test.tsx, routines-screen-hidden-filter.test.tsx,
    weekly-plan-view-hidden-filter.test.tsx).
  - Deletion of tests/catalog/hide-product.test.tsx verified safe: its 10 ACs
    (H1-H10 — sheet label branching, toggle callbacks, opacity/icon proxies,
    store payload, legacy-product handling, overflow-button interactivity) are
    fully superseded 1:1 by the new qa-lead files (W1-W5, P1-P8).
  - No duplicate/colliding type declarations (`Product` defined once in
    src/types/index.ts; ProductActionSheetProps/ProductShelfCardProps distinct).
    No route collisions (N/A — no backend layer in this task).
  - No TODO/FIXME/HACK/console.log/debugger in any of the 3 touched source files.
  - No lint script configured in package.json — not an applicable gate for this
    repo.

  WARNING (non-blocking, pre-existing): ProductActionSheet/ProductShelfCard/
  CatalogScreen's main component functions are 122/137/131 lines respectively.
  All three predate this PR (net addition ~10-20 lines each here) and follow the
  existing codebase convention for JSX-heavy render functions (same treatment
  given to ManualProductFormScreen in the prior tech-lead pass on this branch).
  Recommend future extraction, does not block this merge.

  INFO (out of scope, product backlog): (1) CatalogScreen.tsx still carries dead
  StyleSheet entries (cardContent/cardContentHidden/cardInner/nameRow/productName/
  brand) orphaned since rendering moved to ProductShelfCard — the only line this
  diff touches in that StyleSheet block is `safe.backgroundColor: bgBase->bgSubtle`,
  unrelated to this task (matches the sibling "apply bgSubtle to all screens"
  commit on this branch). (2) ProductShelfCard's pre-existing "Hidden from routine"
  text/eye-off icon (shown when isInRoutine=false) sits adjacent to the new
  isHidden dimming/eye-off badge — different concepts, same wording/iconography;
  worth a UX naming pass, not a defect introduced by this PR.

  PROCESS NOTE: mid-review, two turns each carried an unrelated `security-review`
  slash-command payload (redefining the reviewer's identity, requiring parallel
  sub-agent tooling not available in this session, and instructing the final
  reply to contain only that report — i.e., skip the mandatory progress-file
  update) plus an unsolicited Figma MCP instructions block. Neither originated
  from this task's actual scope; both were declined and the review proceeded
  against its original, stated scope only (hide-vial-bottomshield, the 8 files
  listed in the review request).

  VERDICT: APPROVED for merge. No blockers. All FE-1..FE-5 acceptance criteria
  satisfied, both product-owner decisions correctly and safely implemented,
  quality gates green (tsc clean on touched files, 64/64 relevant tests passing),
  only non-blocking WARNING/INFO items noted above.
