Status: PR_REVIEW
Tech Design: docs/tech-design/multi-active-badges.md
Code: src/types/index.ts (ActiveBadgeCategory type added); src/utils/activeBadges.ts (new — getProductActiveBadgeKeys, getActiveBadgeCategory); src/utils/activeBadges.test.ts (new, 26 unit tests); src/components/product/ProductShelfCard.tsx (badge-row rewrite, ACTIVE_CATEGORY_COLORS)

## Карточка задачи
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [x] QA tests (qa-lead)
- [x] Implementation (engineer)
- [x] Architecture review (tech-lead)

## Log

2026-07-06 — planner: spec + tech design created from a confirmed live bug
  (not hypothetical): `ProductShelfCard.tsx` lines 70-71 only ever surface
  `activeTags?.[0] ?? activeIngredients?.[0]?.key`, dropping every other
  active ingredient on multi-active products. Verified no upstream truncation
  — `CatalogScreen.renderItem` passes the full, unmodified `product` object
  as a prop, so the bug is 100% localized to those two lines.

  Grep confirmed the identical single-key pattern also exists in
  `src/components/routine/RoutineStepCard.tsx` (line 68) and
  `src/components/routine/ProductPickerCard.tsx` (line 46) — both explicitly
  out of scope for this task per the spec's Non-Goals, logged as an owned
  open question (owner: product owner) for a possible fast-follow.

  Category color scheme (exfoliant=amber, soothing/brightening=bottleGreen,
  hydrator=cobalt, other=neutral) is grounded in existing shipped code
  (`CatalogScreen`'s `ACTIVES_KEYS`/`SOOTHING_KEYS` constants) and
  `docs/PRD_Spec.md`'s documented "Actives=amber / Soothing=green /
  Hydration=cobalt" intent, rather than inventing a new taxonomy — this task
  is the first to render that documented intent as actual badge colors.
  `cabernet`/`red` were deliberately excluded from the badge palette because
  they already carry clinical-SOS/error meaning elsewhere in the app
  (`colors.statusSOS`, `colors.statusError`).

  Overflow decision: wrap (activate the already-present but previously dead
  `flexWrap: 'wrap'` on `badgesRow`), not a "+N" truncation indicator — see
  tech design Section 4 for the full justification.

  New pure logic lives in `src/utils/activeBadges.ts`
  (`getProductActiveKeys`, `getActiveBadgeCategory`) per the layer-separation
  rule in `architecture-review.md`; `ActiveBadgeCategory` type added to
  `src/types/index.ts` to avoid the duplicate-type-outside-types/index.ts
  check. No open questions block engineering — ready for qa-lead.
2026-07-06 — qa-lead: extended `tests/product-shelf-card/ProductShelfCard.test.tsx`
  + `tests/product-shelf-card/fixtures.ts` (existing 27-case suite untouched
  and still green) with component-level coverage for all 4 user stories in
  `docs/specs/multi-active-badges.md`. `tests/catalog/product-shelf-card-hidden.test.tsx`
  left untouched, re-ran green (8/8), confirmed no overlap.

  New assertions target the `active-badge-${key}` testID contract from the
  tech design (not yet implemented) — 10 new tests currently FAIL (red) as
  expected: multi-badge rendering (Story 1), the 4 category-color buckets
  read from real `palette` tokens, not hardcoded hex (Story 2), and the
  same-hue type-vs-active badge collision case (Story 3, mask+bha both
  amber-family). 4 new tests currently PASS pre-implementation as valid
  negative-space checks (zero-actives layout, no "+N" text, overflow button
  stays tappable) — these remain meaningful assertions after implementation
  too, not false-positives.

  One spec/tech-design discrepancy resolved in favor of the spec (which is
  authoritative for acceptance criteria): tech design FE-3 shorthand lists
  the 'other' category as "zinc600/zinc300"; spec Story 2 AC4 explicitly
  says "zinc border, black text, unchanged from today's single-badge look" —
  matching the current unmodified styles (`zinc300` border / `black` text).
  Tests assert the spec's explicit wording. Flag this for the engineer to
  reconcile when writing `ACTIVE_CATEGORY_COLORS.other` in ProductShelfCard.tsx.

  New fixtures added: `makeMultiActiveProduct`, `makeFallbackActiveProduct`,
  `makeExplicitNoActivesProduct`, `makeSingleActiveProduct(key)`,
  `makeFourActiveProduct` — all typed against `Product`/`ProductShelfCardProps`.
  `npx tsc --noEmit` clean for all touched files (pre-existing unrelated
  failures in `tests/my-shelf-filter-bottomsheet/` from a different,
  not-yet-implemented feature — untouched by this task).

  Per protocol, did NOT write `src/utils/activeBadges.test.ts` (FE-4, unit
  layer) or touch `src/utils/activeBadges.ts` / `ProductShelfCard.tsx` —
  those are the engineer's job next.
2026-07-06 — engineer: implemented FE-1..FE-4.

  DEVIATION from tech design, flagged for tech-lead: the tech design named
  the new function `getProductActiveKeys(product)`, but
  `src/utils/ingredientParser.ts` already exports a function with that exact
  name (used by `conflictEngine.ts` and `routineEngine/rehabFilter.ts`). It
  has different, broader semantics — it unions `activeIngredients` +
  `activeTags` + INCI-text-parsed keys and normalizes legacy keys, for
  conflict-detection purposes (safety-first). This task's function answers a
  narrower, display-only question (activeTags-wins-when-defined precedence,
  no INCI parsing, no legacy normalization) so a user's explicit "zero
  confirmed actives" renders zero badges. Reusing the identical name across
  two modules with different behavior risked a future accidental
  cross-import (e.g. badge row picking up INCI-parsed-but-unconfirmed
  actives, or the conflict engine missing INCI-derived actives). Renamed the
  new function to `getProductActiveBadgeKeys` in
  `src/utils/activeBadges.ts` and documented the distinction in a doc
  comment there. `getActiveBadgeCategory` kept the tech design's name
  (no collision). No test files needed changes for this — qa-lead's tests
  only assert on rendered output (testIDs/text/styles), never import the
  util module directly.

  `ActiveBadgeCategory` added to `src/types/index.ts` next to
  `ActiveIngredientKey` per FE-1. `CATEGORY_KEYS` in `activeBadges.ts` is the
  single source for both the category map and the fixed render-priority sort
  order (category-then-key), so the two never drift apart.

  `ProductShelfCard.tsx`: replaced the old `activeKey`/`activeLabel`
  index-[0] derivation with `getProductActiveBadgeKeys(product)` + a `.map()`
  rendering one outlined badge per key (`testID="active-badge-${key}"`,
  category border/text color, `ACTIVE_INGREDIENT_LABELS[key]`). Added
  `ACTIVE_CATEGORY_COLORS` as a sibling constant to `TYPE_COLORS`, using the
  spec's `other` = `palette.zinc300` border / `palette.black` text (per the
  corrected instruction — spec Story 2 AC4 is authoritative, matching
  today's unmodified single-badge look; not `zinc600`). `typeBadge`,
  `TYPE_COLORS`, `DEFAULT_TYPE_COLOR` left untouched. Existing
  `activeBadge`/`activeBadgeText` base styles kept as defaults (used as-is
  by the unrelated hidden eye-off badge); per-instance `borderColor`/`color`
  overrides are applied via array-style merge, no style structure change
  needed.

  Quality gates: `npx tsc --noEmit` — zero new errors; only the
  pre-existing, unrelated failures in `tests/my-shelf-filter-bottomsheet/`
  remain (confirmed identical to qa-lead's baseline). `npx jest
  tests/product-shelf-card tests/catalog/product-shelf-card-hidden.test.tsx
  src/utils/activeBadges.test.ts` — 4 suites / 87 tests, all green:
  `ProductShelfCard.test.tsx` 40/40 (27 pre-existing + 3 layout-stability +
  10 previously-red multi-active-badge assertions, all now passing; 4
  negative-space checks that were already green stayed green),
  `product-shelf-card-hidden.test.tsx` 8/8 (untouched sibling, unaffected),
  `ProductActionSheet.extended.test.tsx` 13/13 (pre-existing, incidentally
  matched by the directory glob, unaffected), `activeBadges.test.ts` 26/26
  (new unit tests: 7 precedence/dedup/order cases + 18 exhaustive
  per-key category-mapping cases + 1 "all 18 keys covered exactly once"
  completeness check).

  Ready for tech-lead review.
2026-07-06 — tech-lead: ACCEPT. Full review scope: docs/specs + docs/tech-design +
  src/types/index.ts (ActiveBadgeCategory only) + src/utils/activeBadges.ts(.test.ts) +
  ProductShelfCard.tsx diff + tests/product-shelf-card/*. (Out of scope, per explicit
  instruction: OcrScannerSheet.tsx, ProductDetailScreen.tsx, GenerateCard.tsx,
  OptimizeStrip.tsx, RehabWidget.tsx, inci-attribution-highlighting,
  tools/cosmetics_scraper/ — not touched by this review.)

  1. Fidelity: implementation matches docs/tech-design/multi-active-badges.md FE-1..FE-4
     precisely, including the fixed category-then-key sort order, the outlined-vs-solid
     badge recipe, and the spec-authoritative `other` = zinc300 border / black text
     (confirmed no "zinc600" residue anywhere in either doc — fully reconciled). Verified
     the one documented deviation myself: `grep -rn "getProductActiveKeys"` confirms it is
     already exported by src/utils/ingredientParser.ts:129 and consumed by
     conflictEngine.ts (lines 17/68/69/83/89) and routineEngine/rehabFilter.ts (lines
     10/104) for broader, safety-critical conflict detection (unions activeIngredients +
     activeTags + INCI-parsed + legacy-normalized keys) — materially different semantics
     from this task's narrower display-only precedence rule. The rename to
     `getProductActiveBadgeKeys` correctly avoids a same-name/different-behavior collision
     across modules and is documented in-code (activeBadges.ts doc comment) and in this
     log (engineer entry above) and handoff.json. Per architecture-review.md's
     troubleshooting rule, a logged deviation with a clear explanation downgrades to a
     WARNING, not a BLOCKER — and in this case the rename is simply the correct call, not
     merely tolerated.
  2. Layer separation: PASS. `grep "from 'react'\|from \"react-native\"\|from '@/store"
     src/utils/activeBadges.ts` — zero matches, pure logic module. `grep "AsyncStorage\|
     fetch(" src/components/product/ProductShelfCard.tsx` — zero matches.
  3. Duplication: PASS. `ActiveBadgeCategory` defined exactly once
     (src/types/index.ts:37), imported everywhere else. `grep "#[0-9a-fA-F]"
     ProductShelfCard.tsx` — zero matches; all colors are `palette.*` tokens
     (amber/amberLine, bottleGreen/bottleGreenLine, cobalt/cobaltLine, zinc300/black) —
     none pink.
  4. Type safety: `npx tsc --noEmit` run myself — exit 0, zero errors project-wide (no
     residual errors anywhere, including tests/my-shelf-filter-bottomsheet/).
  5. Tests: ran `npx jest tests/product-shelf-card tests/catalog/product-shelf-card-hidden.test.tsx
     src/utils/activeBadges.test.ts` myself (not trusting the reported figure) — 4 suites,
     87/87 passed, confirmed identical to the engineer's claim.
  6. Quality signals: no TODO/FIXME/HACK/console.log/debugger in any new or changed file.
     New functions in activeBadges.ts are 3 and 16 lines. Badge text still renders at
     `typography.bodySmall` (fontSize 14, the floor) via the unchanged base style object,
     just with a per-instance color override — no shrink. Non-blocking pre-existing note:
     `ProductShelfCard`'s component function is ~140 lines, but this task only replaced a
     ~7-line block with a ~15-line block — the >50-line shape predates this task and isn't
     newly introduced by it, so not held against this PR.
  7. Acceptance criteria: all 4 user stories in docs/specs/multi-active-badges.md have
     direct assertions in tests/product-shelf-card/ProductShelfCard.test.tsx's
     "Multi-active badges" blocks (Story 1: activeTags 2+/fallback/explicit-empty/
     no-actives, 4 tests; Story 2: all 4 category buckets incl. the vitamin-c-derivative
     exfoliant edge case, 5 tests; Story 3: solid-fill type badge + the same-hue-family
     mask/bha collision case named in the tech design's Assumptions, 2 tests; Story 4:
     4-actives-all-render + no "+N" text + overflow button still tappable at max badge
     width, 3 tests), backed by activeBadges.test.ts's exhaustive 18-key completeness
     check at the unit layer.

  No blockers. Verdict: ACCEPT — ready for PR_REVIEW / human merge.
