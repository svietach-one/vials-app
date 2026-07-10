Status: PR_REVIEW
Tech Design: docs/tech-design/inci-attribution-highlighting.md
Code: FE-1, FE-2, FE-3, FE-4, FE-5, FE-6, FE-7 complete (Story 2 out of scope, BLOCKED)

## Карточка задачи
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [x] QA tests (qa-lead)
- [x] Implementation (engineer)
- [x] Architecture review (tech-lead)

## Log

2026-07-06 — planner: spec + tech design created from a live user-test incident
  (Korean Centella/Propolis product: engine correctly matched "Betaine Salicylate"
  as BHA, user didn't recognize the term, missed it in a long INCI block, assumed
  the app glitched). Scope split in two:
  - Stories 1 & 3 (matched-token tooltip + alias badge indicator): fully designed,
    no persistence changes, ready for qa-lead / engineer.
  - Story 2 (image overlay / "View on label"): BLOCKED. Requires a product-owner
    decision on whether to override the existing "images are never stored"
    constraint from docs/specs/ocr-scanner.md to persist scanned label photos +
    OCR word bounding boxes. See docs/specs/inci-attribution-highlighting.md
    Section 10, Open Question 1. No implementation tasks scheduled for Story 2
    until this is resolved.
  Grounded against actual shipped code: src/utils/ingredientParser.ts
  (parseActiveIngredientDetails currently returns {key, potency} only, no matched
  substring), src/constants/rulesets/actives.json (bha class confirmed to have
  the exact betaine salicylate / salix alba matchers from the incident), and
  src/components/product/OcrScannerSheet.tsx (tesseract.js already computes
  result.data.words internally but the current implementation discards it,
  forwarding only result.data.text).

2026-07-06 — product owner: APPROVED. Story 2 block (image overlay, no-persistence
  constraint) confirmed correct as scoped — no override to docs/specs/ocr-scanner.md
  granted at this time. Stories 1 and 3 cleared for development. Handoff to
  qa-lead to write integration/E2E test blueprints for FE-1..FE-6 (Stories 1 & 3)
  and FE-7 (OCR word-capture only, no persistence, no assertions on Story 2 UI).

2026-07-06 — qa-lead: DESIGN-FIDELITY GAP #1 (FE-4 anchor component). The tech
  design's FE-4 instructs locating "the existing detected-active badge" via
  `grep -rn "detected" src/components/routine/ src/components/product/` — run
  verbatim against the current tree, this returns ZERO hits. No component in
  the shipped codebase has "detected"/tappable-badge semantics today. To avoid
  inventing a new shared component the tech design never scoped, qa-lead bound
  the FE-4/FE-5 test suite to the two real, concrete analogs already in
  production: (1) ProductDetailScreen.tsx's "Active Ingredients" Tag list
  (matches spec §5's "product-detail ingredient summary" almost verbatim), and
  (2) RoutineStepCard.tsx's single `activeBadge` (rendered on the same card as
  the existing conflict row — the real routine-surface analog; ConflictWarningInline
  only renders an aggregate InlineAlert per rule, with no per-ingredient badge
  to wire). See tests/inci-attribution-highlighting/fixtures.ts header for the
  full binding testID/accessibility contract. Engineer: implement FE-4/FE-5
  against these two components, not a new one, unless tech-lead directs
  otherwise during review.

2026-07-06 — qa-lead: DESIGN-FIDELITY GAP #2 (AttributionTooltipProps missing a
  properties/description source). Spec Story 1 AC3 requires the tooltip to
  "fall back to the class's existing displayName plus its generic
  properties-derived description" when no alias override exists. The tech
  design's AttributionTooltipProps is `{ visible, onClose, displayName,
  matches }` only — no field carries the actives.json class's `properties`
  (photosensitizing/exfoliating/irritancy/barrierRepair) or any pre-written
  description string needed to synthesize that generic fallback copy. qa-lead's
  AttributionTooltip.test.tsx therefore asserts fallback-vs-override behaviour
  structurally (via testID rows `attribution-match-copy-{i}`: non-empty,
  present, and never containing override-specific wording) rather than
  asserting exact fallback wording, since the tech design does not specify
  where that copy is sourced from. Engineer: either extend
  AttributionTooltipProps to carry enough class data to synthesize this copy,
  or extend the tooltip to import the class definition directly from
  actives.json by displayName/key — flag the chosen approach in this log so
  tech-lead can verify it against the (silent) design gap rather than treating
  it as an undocumented deviation.

2026-07-06 — qa-lead: QA tests complete for Stories 1 & 3 + FE-7. Delivered
  (all under tests/inci-attribution-highlighting/):
  - fixtures.ts — binding testID/accessibility contract for AttributionTooltip
    and the two badge-wiring anchors (see Gap #1 above), MatchedToken/
    ParsedActiveDetail fixtures for the bha class (salicylic acid / betaine
    salicylate / willow bark), an aliasOverrides.json fixture scoped to the
    two confirmed incident aliases, and Product fixtures reproducing the
    live-test incident.
  - AttributionTooltip.test.tsx — Story 1, all 4 ACs + dismiss behaviour +
    empty-matches defensive case. Written test-first against FE-3, which does
    not exist yet — confirmed via `npx tsc --noEmit` and `npx jest` that the
    only failures are module-not-found on `@/components/routine/
    AttributionTooltip` (expected, same pattern as
    tests/clinic-forecast-timeline/fixtures.ts).
  - DetectedActiveBadgeWiring.test.tsx — FE-4 (tap badge -> tooltip opens with
    correct MatchedToken[]) and FE-5 (alias icon shown/hidden) against
    ProductDetailScreen and RoutineStepCard (see Gap #1). Written test-first
    against FE-1/FE-2/FE-3, none of which exist yet — confirmed the only
    failure is module-not-found on `@/constants/rulesets/aliasOverrides.json`
    at the jest.mock() registration line (verified `{ virtual: true }` does
    not help here: this project's jest config, moduleNameMapper `@/*` +
    react-native's custom resolver, cannot resolve a virtual mock through the
    `@/` alias for a file that isn't on disk — confirmed by direct
    reproduction, not assumed). Once FE-1/FE-2/FE-3/FE-4/FE-5 land, this plain
    jest.mock() will transparently pick up the real file with no test change.
  - OcrScannerSheet.wordsRegression.test.tsx — FE-7 regression. Runs GREEN
    right now against the already-shipped OcrScannerSheet.tsx (4/4 passing),
    confirming the planned additive `words` field on the OCR_RESULT message
    is safe before FE-7 is even implemented.
  Explicitly NOT written (per scope): src/utils/ingredientParser.test.ts
  (FE-6, engineer-owned unit tests). Required coverage for the engineer:
  single matcher fires (one MatchedToken); multiple matchers of the same
  class fire on different substrings (multiple MatchedTokens retained, not
  just the strongest-potency one — mirrors AttributionTooltip.test.tsx's
  Story 1 AC4 fixture data); negative-pattern-stripped text produces no
  match/no token; matcherPattern is used verbatim (the exact regex source
  string) as the aliasOverrides.json lookup key, including for the two
  confirmed bha aliases (betaine salicylate, salix alba|willow bark); legacy
  call sites (parseActiveIngredientsFromInci, getProductActiveKeys) remain
  unaffected since they only ever read `.key`.
  No Story 2 (image overlay / "View on label") assertions anywhere, per scope.
  Quality gates run: `npx tsc --noEmit` and `npx jest tests/inci-attribution-
  highlighting/` — failure profile confirmed to be exactly the 4 expected
  pre-implementation gaps (FE-1 `MatchedToken`/`matches`, FE-2 aliasOverrides.json,
  FE-3 AttributionTooltip module) plus 4/4 passing on the FE-7 regression suite.
  Handoff -> engineer.

2026-07-06 — engineer: implementation complete for Stories 1 & 3 + FE-7 (Story 2
  remains BLOCKED, no tasks scheduled per tech design).
  New files:
  - src/components/routine/AttributionTooltip.tsx (FE-3) — implements exactly
    the testID/accessibility contract from tests/inci-attribution-highlighting/
    fixtures.ts. Resolves Gap #2 (fallback-vs-override copy source) by having
    the tooltip import getAliasMicroCopy() directly from the new
    src/utils/attributionLookup.ts, rather than extending AttributionTooltipProps
    — kept the props shape exactly as designed ({visible, onClose, displayName,
    matches}); the tooltip resolves its own copy per match.
  - src/utils/attributionLookup.ts (new, pure util) — getMatchesForKey(),
    hasAliasOverride(), getAliasMicroCopy(). Shared by AttributionTooltip and
    both badge-wiring sites so the alias-detection logic exists exactly once.
  - src/constants/rulesets/aliasOverrides.json (FE-2) — seeded with the two
    confirmed incident aliases (betaine salicylate, salix alba/willow bark),
    copy verbatim from the spec's incident writeup.
  Modified:
  - src/utils/ingredientParser.ts (FE-1) — CompiledMatcher now carries the
    source `pattern` string; parseActiveIngredientDetails switched from
    `.test()` to `.exec()` per matcher and returns `matches: MatchedToken[]`
    per class (one entry per firing matcher, not just the strongest-potency
    one — confirmed by the new "retains a MatchedToken for every matcher"
    unit test).
  - src/utils/ingredientParser.test.ts (FE-6) — added the coverage qa-lead
    specified: single matcher, multiple matchers of one class, matcherPattern
    verbatim as regex source, negative-pattern suppression, and a regression
    check that parseActiveIngredientsFromInci/getProductActiveKeys (which only
    read `.key`) are unaffected.
  - src/screens/ProductDetailScreen.tsx (FE-4/FE-5) — resolves Gap #1: wired
    against the real "Active Ingredients" Tag list (not a nonexistent shared
    badge component). Each tag is now a Pressable (`active-badge-{key}`)
    opening AttributionTooltip; alias icon shown per qa-lead's contract.
  - src/components/routine/RoutineStepCard.tsx (FE-4/FE-5) — same wiring
    against the existing single `activeBadge`, per Gap #1. Local
    `attributionVisible` state; tooltip rendered alongside both the
    isEditMode and normal-mode return branches (existing conflict/adaptation
    rows unmodified).
  - src/components/product/OcrScannerSheet.tsx (FE-7) — WebView HTML now maps
    `result.data.words` (tesseract.js's existing internal bbox output) into
    `{text, x0, y0, x1, y1}` and includes it as an additive `words` field on
    the OCR_RESULT message; `WebViewMsg` type extended to document it. RN-side
    `onResult` call signature and behavior are unchanged (single `text` arg)
    — words is read but not persisted or consumed anywhere yet, matching the
    Story 2 BLOCKED status.
  Quality gates: `npx tsc --noEmit` — 0 errors attributable to this task (the
  only tsc errors in the repo are pre-existing, in the unrelated
  my-shelf-filter-bottomsheet feature's tests). `npx jest tests/inci-
  attribution-highlighting/ src/utils/ingredientParser.test.ts
  --testPathIgnorePatterns="worktrees"` — 73/73 passing (0 modified from
  qa-lead's original assertions). Full suite run the same way: 7 pre-existing
  failing suites (my-shelf-filter-bottomsheet, shelf-filtering, catalog-screen/
  product-detail — AsyncStorage native-module + palette import issues),
  confirmed via `git stash` to fail identically before this task's changes;
  none touch inci-attribution-highlighting files.
  Handoff -> tech-lead.

2026-07-06 — tech-lead: ARCHITECTURE REVIEW — VERDICT: ACCEPT (PR_REVIEW, ready for
  human merge). Reviewed all 8 changed/new files against docs/tech-design/
  inci-attribution-highlighting.md's FE-1..FE-7 task list.

  Design fidelity: both qa-lead-logged gaps independently re-verified, not taken
  on faith. Gap #1 (FE-4's `grep -rn "detected" src/components/routine/
  src/components/product/` locator) re-run myself — confirmed zero hits against
  the current tree. Binding to ProductDetailScreen.tsx's "Active Ingredients"
  Tag list + RoutineStepCard.tsx's `activeBadge` is the only choice consistent
  with spec Section 5's actual entry-point language ("existing 'detected
  active' badges... equivalent badges on the product detail screen's
  ingredient summary") — this corrects a broken tech-design locator, it is not
  an implementation shortcut. Gap #2 (AttributionTooltipProps fallback-copy
  source): confirmed the shipped props interface is byte-identical to the tech
  design's API contract ({visible, onClose, displayName, matches}); the
  engineer's src/utils/attributionLookup.ts resolves the gap as a new pure
  util the tooltip imports, without touching the props shape. Both gaps have
  clear, dated explanations in this log per architecture-review.md Section 6
  -> downgraded to non-blocking, not BLOCKERs.

  Layer separation: `grep -n "from 'react'" src/utils/attributionLookup.ts`
  and a react-native import grep both return empty — confirmed pure util, zero
  React/react-native imports. `grep -n "AsyncStorage\|fetch(" ` across all 8
  task files returns empty — no direct storage/network access introduced.

  Duplication check: aliasOverrides.json ships as a raw JSON lookup, typed
  inline in attributionLookup.ts (`Record<string, { microCopy: string }>`)
  rather than a named interface in src/constants/rulesets/rulesetTypes.ts
  alongside ActivesRuleset/ProcedureRuleset/SeasonRuleset. This matches the
  tech design's literal API contract exactly and the shape is not duplicated
  anywhere. Non-blocking observation: rulesetIntegrity.test.ts does not cover
  aliasOverrides.json the way it covers the other three rulesets — reasonable
  given aliasOverrides.json's much simpler single-shape lookup, but flagging
  as a low-priority follow-up for full consistency.

  Quality gates — ran myself, did not take the engineer's log on faith:
  `npx tsc --noEmit` -> 0 errors (repo-wide, clean). `npx jest tests/inci-
  attribution-highlighting/ src/utils/ingredientParser.test.ts
  --testPathIgnorePatterns="worktrees"` -> 4 suites, 73/73 passed. Matches the
  engineer's reported numbers exactly.

  Code smells in the 8 task files: no console.log/debugger, no TODO/FIXME/
  HACK. One hardcoded color (AttributionTooltip.tsx's `rgba(9, 9, 11, 0.5)`
  backdrop) — verified this exact literal (only alpha varies) is already used
  identically in BottomSheet.tsx, DeleteProductModal.tsx, RemoveStepModal.tsx,
  ProductActionSheet.tsx, and OcrScannerSheet.tsx, and tokens.ts has no
  equivalent token anywhere in the codebase — pre-existing repo convention,
  not a new violation; worth a dedicated tokens.ts follow-up across all six
  call sites, out of scope here. One function over 50 lines: AttributionTooltip's
  render body (~56 lines) — new file, fully attributable to this task;
  recommend extracting the per-match row into a subcomponent as a follow-up,
  non-blocking. RoutineStepCard.tsx/ProductDetailScreen.tsx's overall component
  sizes (~198/~262 lines) pre-date this task by a wide margin; this diff added
  ~20-30 lines to each, not a material worsening.

  Story 2 (image overlay) confirmed correctly unimplemented: no bbox/image
  fields added to src/types/index.ts; OcrScannerSheet's new `words` field is
  captured but consumed by nobody (ManualProductFormScreen.handleOcrResult
  signature is still `(text: string)`); no "View on label" UI exists in src/
  anywhere (only referenced in test-file header comments documenting it as
  explicitly out of scope).

  One minor product-fidelity note (non-blocking, already surfaced by qa-lead
  as Gap #2): the shipped GENERIC_FALLBACK_COPY is a static sentence, not
  literally the class-properties-derived description spec Story 1 AC3
  envisions. It satisfies the hard "never a raw error/empty state"
  requirement and qa-lead's tests were deliberately written to assert this
  structurally rather than on exact wording. Recommend a follow-up to
  synthesize richer fallback copy from the class's actives.json properties.

  No BLOCKERs found. Handoff -> none (ready for human PR merge).
