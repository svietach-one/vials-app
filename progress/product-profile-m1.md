Status: PR_REVIEW
Tech Design: docs/tech-design/product-profile-m1.md
Code: src/types/index.ts (ProductProfile types, FE-1); src/constants/rulesets/productFacts.ts (new,
  FE-2); src/utils/routineEngine/slotting.ts, src/utils/routineEngine/productFacts.ts (FE-2 import
  update); src/utils/productProfile/resolve.ts, join.ts, capabilities.ts, irritation.ts,
  routinePosition.ts, index.ts (+ co-located *.test.ts for each, FE-3..FE-7); src/constants/labels.ts
  (CAPABILITY_LABELS); src/components/product/ProductInsightsPanel.tsx (new, FE-8);
  src/screens/ProductDetailScreen.tsx (FE-8 wiring)

## Карточка задачи
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [x] QA tests (qa-lead)
- [x] Implementation (engineer)
- [x] Architecture review (tech-lead)

## Log

- 2026-08-05 (planner): Milestone 1 scoped out of the locked `docs/tasks/product_profile/`
  design set (00-overview.md through 06-open-questions.md, all Status: LOCKED).
  Spec: docs/specs/2026-08-05-product-profile-m1.md. Tech design formalizes the
  builder pipeline (resolve → join → capabilities[barrierRepair,exfoliating only]
  → irritation → sensitivity[null] → routinePosition) plus the LAYERING_ORDER/
  RINSE_OFF_TYPES/DEFAULT_PERIOD_BY_TYPE relocation prerequisite (Q8) and the
  first UI surface on ProductDetailScreen. Verified against actual code
  (rulesetTypes.ts, productFacts.ts, slotting.ts, corpus/ProductRepository.ts) —
  confirmed no requirement-vs-preference field exists on ActiveClass (spec §10),
  builder must treat single-entry allowedPeriods as the de-facto hard constraint.
  Full capability set (Milestone 2), strengths/weaknesses synthesis (Milestone 3),
  and all Decision Engine stages (Milestones 4-7) are explicitly out of scope here.

- 2026-08-05 (qa-lead): Wrote pre-implementation integration/component test
  suite at tests/product-profile-m1/ (fixtures.ts, productProfileBuilder.
  integration.test.ts, ProductInsightsPanel.test.tsx). Both suites import
  not-yet-existing symbols (`ProductProfile`/`CapabilityKey`/etc. from
  `@/types` per FE-1, `@/utils/productProfile` per FE-3..FE-7,
  `@/components/product/ProductInsightsPanel` per FE-8) — confirmed via
  `npx tsc --noEmit` and `npx jest` that the only failures today are
  "module not found" / "no exported member", i.e. the suite is ready to run
  once the engineer lands the tech design's FE tasks.
  Coverage: productProfileBuilder.integration.test.ts exercises both entry
  points end-to-end against spec §4 Story 1 (AC1-AC4: populated profile
  fields never undefined, zero-active-classes insufficient-data path with no
  false 0/false claims, real deterministic 0 vs null distinction, disagreeing
  preferredPeriod -> null) and Story 2 (AC1-AC2: unresolvedIngredientTokens
  behavior per entry point), plus spec §3 Non-Goals (sensitivityCompatibility
  stays null/insufficient_data, no numeric threshold asserted) and two
  findings worth tech-lead/engineer attention: (1) no class in the current
  actives.json ships a 'pm' preferredPeriod, so the AM/PM-disagreement branch
  is only reachable today via a scoped jest.mock override of
  `copper_peptides.preferredPeriod` (documented inline, isolated to one test
  file); (2) `overallConfidence` is `'insufficient_data'` for EVERY profile
  this milestone (not just the empty-data case) because
  `sensitivityCompatibility` ships unconditionally `insufficient_data`
  (FE-5) and folds into the worst-tier rollup — asserted explicitly as a
  milestone-wide invariant so the panel/engineer don't mistakenly branch UI
  state on `overallConfidence`. ProductInsightsPanel.test.tsx defines the
  panel's prop contract (`profile: ProductProfile`, optional `isLoading`)
  and covers populated-state badges, the "not enough ingredient data" empty
  state, and absence of badges for null/insufficient_data and
  not-yet-modeled (8 of 10) capability keys. Unit tests for the pure pipeline
  stages (resolve/join/capabilities/irritation/routinePosition) are
  explicitly out of scope here per .claude/rules/testing.md — those are the
  engineer's job, co-located under src/utils/productProfile/*.test.ts.

- 2026-08-05 (engineer): Implemented FE-1 through FE-8 per the tech design, in
  order. FE-1: transcribed `ProductProfile` + nested types verbatim into
  src/types/index.ts (RoutinePosition uses its own literal `'AM'|'PM'` union,
  deliberately distinct from rulesetTypes.ts's lowercase `Period` — the two
  are different domains and index.ts must not import from rulesetTypes.ts).
  FE-2: relocated LAYERING_ORDER/RINSE_OFF_TYPES/DEFAULT_PERIOD_BY_TYPE into
  new src/constants/rulesets/productFacts.ts (data only); slotting.ts and
  routineEngine/productFacts.ts now import from there — mechanical move, zero
  logic change, confirmed by re-running slotting.test.ts/productFacts.test.ts
  unmodified (both green). FE-3: resolve.ts unions wizard-confirmed
  activeTags with ingredientParser.ts's parseActiveIngredientDetails
  (reused as-is, no new parsing logic); unresolvedIngredientTokens computed
  by re-running parseActiveIngredientDetails per comma-token (reuse, not
  reimplementation) — a token gated out of the whole-text parse by a
  position rule still counts as "known" here, since that's an attribution
  decision, not a matcher-table gap. join.ts is a pure activeKey ->
  ACTIVES_RULESET.classes[key] lookup. POTENCY_RANK duplication check
  (ingredientParser.ts vs routineEngine/resolve.ts): confirmed still
  unresolved, but productProfile's stage 1 doesn't need potency *comparison*
  — it only carries through the parser's already-resolved single potency per
  key — so no third copy was added and this prerequisite doesn't block M1.
  FE-4: capabilities.ts scores barrierRepair/exfoliation deterministically
  (score 0 when resolvedActiveKeys.length > 0 but no contributing class;
  null/insufficient_data only when resolvedActiveKeys is entirely empty —
  this distinction, not "any resolved class contributes," is what determines
  0 vs null, confirmed against spec's insufficient-data-handling section).
  The other 8 keys always ship null/insufficient_data/'Not modeled in
  Milestone 1'. FE-5: irritation.ts reuses rulesetTypes.ts's exported
  resolveIrritancy() per present class (max_of_present), confidence floor
  'heuristic'; sensitivityCompatibility ships the FE-5-specified
  unconditional insufficient_data/null shape. FE-6: routinePosition.ts
  intersects allowedPeriods across present classes (mirrors
  routineEngine/productFacts.ts's aggregateProperties narrowing — chose
  intersection over the "union" wording in 02-profile-builder.md §10 because
  the tech design explicitly specifies intersection and it matches the only
  real precedent in the codebase; see Note below); preferredPeriod merge
  handles single-period hard requirement, single-preference agreement, and
  disagreement -> null, exactly per spec §10's finding. FE-7: index.ts wires
  stages in order, overallConfidence = worst tier across all 10 capabilities
  + irritation + sensitivityCompatibility + routinePosition confidences
  (never an average) — verified this always yields insufficient_data this
  milestone (qa-lead's AC-9, plus a dedicated unit test). FE-8:
  ProductInsightsPanel (src/components/product/ProductInsightsPanel.tsx) —
  gates its empty-state on `resolvedActiveKeys.length === 0`, NOT on
  overallConfidence, per the qa-lead finding; capability badges render only
  when `score !== null && score > 0` (excludes both insufficient_data and a
  real deterministic 0). Wired into ProductDetailScreen.tsx via a
  `useMemo(() => buildProductInsightsProfile(product), [product])`
  (screen-level cache, no store, per tech-design Assumption 3); the builder
  call is wrapped try/catch, falling back to
  `buildProductProfileFromActiveKeys(..., activeKeys: [])` and an
  `if (__DEV__) console.warn(...)` on the (should-be-unreachable) catch path,
  matching the storage.ts/productFacts.ts convention (spec §5 error state).
  Added CAPABILITY_LABELS to src/constants/labels.ts (same pattern as the
  file's other *_LABELS records) for the panel's badge text.
  Unit tests: co-located src/utils/productProfile/{resolve,join,capabilities,
  irritation,routinePosition,index}.test.ts (98 tests total across all new +
  qa-lead suites), covering the zero-active-classes path, the 0-vs-null
  distinction, potency plumbing, the AM/PM disagreement branch (own scoped
  jest.mock, mirroring qa-lead's), and the layeringOrder-null fallback (via
  an explicit ProductType type-cast, since LAYERING_ORDER is currently a
  total Record<ProductType, number> — no real ProductType reaches that
  branch today, same documented situation as the disagreement branch).
  Status: `npx tsc --noEmit` clean. `npx jest --testPathIgnorePatterns=
  worktrees` — 10 failing suites / 81 failing tests, byte-for-byte identical
  to the pre-existing baseline (diffed FAIL suite lists before/after —
  identical set, all pre-existing incomplete `@/constants/tokens`
  jest.mock() fixtures in tests/catalog/* and others, unrelated to this
  task); all qa-lead + engineer product-profile-m1 suites green (8 suites,
  98 tests). No qa-lead assertion was found to be wrong — all matched the
  implementation as designed.
  Note for tech-lead: 02-profile-builder.md §10 says "union allowedPeriods"
  for eligiblePeriods while tech-design FE-6 says "intersection" — these
  conflict. Followed the tech design (intersection), since it was written
  against the real codebase and intersection is what
  routineEngine/productFacts.ts's aggregateProperties already does (a
  product is only safely usable in a period every present class allows).
  All test fixtures use classes with allowedPeriods=['am','pm'], so this
  choice isn't discriminated by any existing test — flagging for awareness,
  not as a defect.

- 2026-08-06 (tech-lead review — performed directly in the orchestrating
  session, not by the dedicated `tech-lead` subagent: that subagent correctly
  refused to proceed past its own Step 0 human-confirmation gate when the
  confirmation could only reach it secondhand via SendMessage relay from the
  session that spawned it, twice, by design — it will only accept a `y`/`yes`
  typed directly into its own context, which a background subagent can never
  receive through this harness's relay path. The human, informed of the
  deadlock, explicitly chose to have the review performed directly instead of
  leaving it blocked). **Verdict: APPROVED (PR_REVIEW).** No BLOCKERs.

  Verified independently, not just trusted from the engineer's self-report:
  - `npx tsc --noEmit`: clean.
  - Full suite (`npx jest --testPathIgnorePatterns=worktrees`): 10 failed
    suites / 81 failed tests. Confirmed byte-identical to the true baseline
    by `git stash push -u`-ing all product-profile-m1 files and re-running —
    same 5 suite names (tests/catalog/{add-product-hub,catalog-screen,
    catalog-screen-hide-toggle.integration,product-detail,
    product-shelf-card-hidden}.test.tsx plus 5 more outside tests/catalog
    with the same root cause) fail identically with the changes stashed out;
    all trace to an incomplete `@/constants/tokens` jest mock missing
    `palette.plumTint`/`goldenTint`/`shadow.sm` etc., pre-existing and
    unrelated to this task. `src/utils/productProfile/*` (8 suites) +
    `tests/product-profile-m1/*` (2 suites, already counted above): 8
    suites / 98 tests, all green.
  - Purity boundary (architecture-review.md §2): grepped
    `src/utils/productProfile/` for `from 'react'`/`AsyncStorage`/`fetch(` —
    zero matches. Clean.
  - `irritation.ts` calls `resolveIrritancy()` imported from
    `rulesetTypes.ts` — confirmed not reimplemented inline.
  - `capabilities.ts` never-silent-0 rule confirmed both directions: zero
    resolved active classes -> `score: null`/`insufficient_data`; resolved
    classes present but none contributing to a given capability -> real
    `score: 0`/`deterministic`. Distinct code paths, correctly separated.
  - FE-2 relocation: diffed the new `src/constants/rulesets/productFacts.ts`
    against the pre-move `LAYERING_ORDER`(slotting.ts)/`RINSE_OFF_TYPES`+
    `DEFAULT_PERIOD_BY_TYPE`(routineEngine/productFacts.ts) — values
    byte-identical. `slotting.ts` re-exports `LAYERING_ORDER` from the new
    location (no external consumer imported it from `slotting.ts` directly,
    so this is a defensive courtesy, not a requirement, but not wrong
    either). Ran `slotting.test.ts` + `routineEngine/productFacts.test.ts`
    directly: 47/47 passing, unmodified. Zero behavior change confirmed.
  - `ProductInsightsPanel.tsx` gates its empty-state on
    `profile.resolvedActiveKeys.length === 0`, not `overallConfidence` —
    read the component and `ProductInsightsPanel.test.tsx` together and
    confirmed the implementation actually satisfies the test's documented
    contract, not just that a matching test file exists.
  - `ProductProfile` and nested types in `src/types/index.ts` diffed
    field-for-field against `01-product-profile.md` §5 — verbatim match,
    scoped correctly to what M1 populates (`primaryFunctions: []`,
    `strengthsWeaknesses: null`).
  - No hardcoded hex colors in `ProductInsightsPanel.tsx` (tokens.ts only:
    `colors`/`palette`/`radius`/`space`/`typography`); `typography.bodySmall`
    is 14px, meets the CLAUDE.md minimum; no pink hues (`palette.plum` is
    the app's existing established brand accent, per prior Clinic-screen
    work, not a new pink introduction); no TODO/FIXME/HACK, no stray
    `console.log` (the one `console.warn` is `__DEV__`-guarded, matching
    convention); all new UI text is English.

  **Judgment call — union vs. intersection for `eligiblePeriods` (my own
  ruling, not a rubber stamp of the engineer's reasoning):** ruling for
  **intersection**, i.e. the implementation as built is correct-as-is, no
  fix required. `02-profile-builder.md` §10's literal "union" wording is
  itself the error, not a deliberate design choice the implementation should
  have followed: (1) it directly contradicts that same sentence's own
  "most restrictive wins" framing and the safety-conservative rationale used
  everywhere else in this design (Q1's `max_of_present`, Q4's naming); (2) a
  union would produce a false-safe claim — a product containing one class
  restricted to PM-only (e.g. a photosensitizing active) unioned with a
  class allowed AM+PM would report `eligiblePeriods: ['AM','PM']`, wrongly
  implying AM use is fine when one of its own ingredients is not AM-safe;
  (3) intersection is what the existing, safety-critical
  `routineEngine/productFacts.ts`'s `aggregateProperties` already does for
  the identical real-world question ("which periods can this product
  actually be used in"), and Product Profile is documented throughout as
  read-only over that same ruleset, not a divergent reinterpretation of it.
  Recommend a follow-up doc correction to `docs/tasks/product_profile/
  02-profile-builder.md` §10 so the source design stops contradicting
  itself — non-blocking, doc-only, does not require touching shipped code.

  **WARNING (non-blocking, per architecture-review.md's severity matrix):**
  `ProductInsightsPanel`'s main component function is ~70 lines (62-132),
  over the 50-line guideline. Recommend extracting the empty-state branch
  and the populated-state row list into small subcomponents in a future
  pass; does not block this merge.

  No other findings. Implementation matches the tech design and the locked
  source design set field-for-field and stage-for-stage; the engineer's own
  flagged discrepancy (union vs. intersection) was the only open item and is
  now resolved above.

- 2026-08-06 (follow-up diff review, at human request, after the above
  approval): **Status reverted PR_REVIEW -> BLOCKED.** A confirmed
  correctness/safety defect surfaced on a deeper pass that the architecture
  review did not trace: `resolve.ts`'s `resolveFromProduct` (lines 63-85)
  never applies the codebase's established `DEFAULT_TAG_POTENCY` fallback
  (`routineEngine/productFacts.ts` line 85/119: wizard-confirmed
  `activeTags` with no INCI evidence default to `'high'` potency —
  "unknown must not soften rules"). `potencyByKey` is only ever populated
  from `parsed` (INCI-derived) details, so a tag-only class gets
  `potency: undefined` through `join.ts` into `irritation.ts`, which then
  falls back to the flat `properties.irritancy` instead of
  `properties.irritancyByPotency`. Concretely: a product with a
  wizard-confirmed `retinoid` tag and no (or potency-inconclusive) INCI
  text shows `irritancy: 3` in the Product Profile (flat tier) instead of
  `4` (actives.json's `irritancyByPotency.high`/`rx`) — the exact same
  product the routine engine's own fact-builder would treat as tier 4.
  Untested by every suite in this task (resolve.test.ts, irritation.test.ts,
  qa-lead's suite) — no fixture exercises a tag-only potency-bearing class.
  Full findings filed via ReportFindings in the same session. Fix needed in
  `resolveFromProduct`: mirror `attributeClasses`'s
  `evidenced ?? (classHasPotency ? DEFAULT_TAG_POTENCY : undefined)` logic
  (importing the shared constant/helper rather than re-declaring it a third
  time, consistent with this task's own anti-duplication mandate) before
  this can return to PR_REVIEW.

- 2026-08-06 (fix, at human request). **Status: BLOCKED -> PR_REVIEW.**
  `DEFAULT_TAG_POTENCY` relocated from `routineEngine/productFacts.ts` into
  the shared `constants/rulesets/productFacts.ts` (same file/pattern as
  FE-2's LAYERING_ORDER/RINSE_OFF_TYPES move) so both
  `routineEngine/productFacts.ts`'s `attributeClasses` and
  `productProfile/resolve.ts`'s `resolveFromProduct` read one canonical
  constant instead of the productProfile side lacking it entirely.
  `resolveFromProduct` now defaults a tag-only class's potency to
  `DEFAULT_TAG_POTENCY` when that class has any potency-declaring matcher
  and no INCI-evidenced potency already won the slot (evidenced potency
  still takes precedence — verified by a dedicated test). Added 3 unit
  tests to resolve.test.ts (default applies for a potency-differentiated
  tag-only class; does not apply for a class with no potency-declaring
  matcher at all; INCI evidence still wins over the tag default) and one
  end-to-end regression test to index.test.ts asserting a tag-only
  wizard-confirmed retinoid now scores `irritation.score: 4` (was 3 before
  the fix, matching actives.json's `irritancyByPotency.high`).
  `npx tsc --noEmit` clean. Targeted suites (productProfile/*, the
  relocated-data routineEngine suites, tests/product-profile-m1/*): 10
  suites / 149 tests, all green (+4 new tests vs. the prior approved
  state). Full suite re-run: same 10 pre-existing failing suites / 81
  failing tests as the established baseline (1875 passed vs. 1871 before,
  the +4 new tests) — no regressions.
  **Scope note, not bundled into this fix:** the identical gap exists in
  `resolveFromActiveKeys` (entry point B, the corpus path) — a
  corpus-resolved key also has no independent potency evidence and today
  gets `potency: undefined` the same way tagKeys did before this fix, for
  the identical reason (a class confirmed present with no potency
  evidence should not silently soften downstream irritation reads).
  Deliberately left unfixed here since it wasn't part of what was
  reviewed/approved to fix — flagged for a follow-up decision.

- 2026-08-06 (follow-up fix, at human request). Extended the same
  `DEFAULT_TAG_POTENCY` treatment to `resolveFromActiveKeys` (entry point
  B, the corpus path), closing the sibling gap flagged above. Extracted
  the shared `applyTagPotencyDefaults(keys, potencyByKey)` helper out of
  `resolveFromProduct` so both entry points call one function instead of
  a second copy of the same loop — same anti-duplication principle this
  whole task exists to enforce, applied to the fix itself. Updated
  `resolveFromActiveKeys`'s doc comment (previously claimed "no potency
  evidence" unconditionally — no longer accurate). Updated
  resolve.test.ts's `resolveFromActiveKeys` suite: the old
  `potencyByKey: {}` assertion for `['niacinamide', 'ceramides']` no
  longer holds (niacinamide has a potency-declaring matcher, so it now
  gets `'high'`; ceramides still doesn't), replaced with 2 explicit tests
  (default applies for a potency-differentiated key; does not apply for
  ceramides). `npx tsc --noEmit` clean. `src/utils/productProfile/*` +
  `tests/product-profile-m1/*`: 8 suites / 104 tests, all green. Full
  suite: same 10 pre-existing failing suites / 81 failing tests as the
  established baseline (1877 passed vs. 1875 before this follow-up, +2 new
  tests) — no regressions. Both known potency-evidence gaps in this task
  are now closed.
