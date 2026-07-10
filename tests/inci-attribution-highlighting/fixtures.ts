/**
 * Fixtures for the inci-attribution-highlighting suite.
 *
 * Spec:        docs/specs/inci-attribution-highlighting.md
 * Tech design: docs/tech-design/inci-attribution-highlighting.md
 * Scope:       Stories 1 & 3 only (FE-1..FE-6) + FE-7 (OCR capture-only regression).
 *              Story 2 (image overlay / "View on label") is BLOCKED — no fixtures
 *              for bounding boxes / stored images are provided here on purpose.
 *
 * ── TestID / accessibility contract (picked by qa-lead — the tech design's FE-4
 *    left the anchor component unspecified; its own `grep -rn "detected"
 *    src/components/routine/ src/components/product/` locator returns ZERO
 *    hits against the real codebase as of 2026-07-06). The engineer MUST
 *    implement against this exact contract; see progress/inci-attribution-
 *    highlighting.md 2026-07-06 qa-lead log entries for the full gap writeup.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * AttributionTooltip (src/components/routine/AttributionTooltip.tsx — NEW, FE-3):
 *   - testID="attribution-tooltip"            root, only rendered when visible=true
 *   - testID="attribution-tooltip-backdrop"   press outside -> onClose()
 *   - testID="attribution-tooltip-close"      accessibilityRole="button",
 *     accessibilityLabel="Close" -> onClose()
 *   - testID="attribution-tooltip-header"     text = displayName
 *   - testID={`attribution-match-${index}`}       one wrapper per matches[index]
 *   - testID={`attribution-match-text-${index}`}  literal matched text, quoted,
 *     e.g. `Matched: "Betaine Salicylate"`
 *   - testID={`attribution-match-copy-${index}`}  override micro-copy OR generic
 *     fallback copy for that row (never both, never empty)
 *   - testID="attribution-no-matches"         shown instead of any match row when
 *     matches=[] — must render displayName + non-empty generic copy, never a raw
 *     error or blank body (spec Story 1, "never a raw error or empty state").
 *
 * Detected-active badge wiring (FE-4/FE-5) — bound to the two concrete, already-
 * shipped components identified by qa-lead as the real anchors (see gap note
 * above); NOT a new shared component, per tech design "same badge component as
 * FE-4":
 *   1. ProductDetailScreen.tsx "Active Ingredients" section (one Tag per
 *      activeTags[i]) — the product-detail ingredient summary from spec §5.
 *   2. RoutineStepCard.tsx `activeBadge` (single, first active tag) — the
 *      routine-surface badge, rendered on the same card as the conflict row.
 *
 *   Both sites, per active-ingredient badge with key `K`:
 *   - testID={`active-badge-${K}`}                    Pressable wrapper
 *   - accessibilityRole="button"
 *   - accessibilityLabel={`${ACTIVE_INGREDIENT_LABELS[K]} detected, tap for details`}
 *   - onPress opens AttributionTooltip with displayName = actives.json class
 *     displayName for K, matches = MatchedToken[] for K parsed from
 *     product.fullIngredientText
 *   - testID={`active-badge-alias-icon-${K}`}         only rendered when at least
 *     one MatchedToken for K has an aliasOverrides entry
 *   - accessibilityLabel="Detected via regional ingredient name" on that icon
 */

import type { ActiveIngredientKey, Product } from '@/types';

// ─── MatchedToken / ParsedActiveDetail fixtures ──────────────────────────────
//
// NOTE: `MatchedToken` and the `matches` field on `ParsedActiveDetail` do not
// exist in src/utils/ingredientParser.ts yet — they land with FE-1. Importing
// them here means `tsc` will fail loudly (expected, tests-first) until FE-1
// ships, and will catch any shape drift the moment it does.
import type { MatchedToken, ParsedActiveDetail } from '@/utils/ingredientParser';

export function makeMatchedToken(overrides: Partial<MatchedToken> = {}): MatchedToken {
  return {
    rawText: 'Salicylic Acid',
    matcherPattern: '\\bsalicylic\\s+acid\\b',
    ...overrides,
  };
}

/** The Western/expected term — no alias override registered. */
export const BHA_SALICYLIC_ACID_MATCH: MatchedToken = makeMatchedToken({
  rawText: 'Salicylic Acid',
  matcherPattern: '\\bsalicylic\\s+acid\\b',
});

/** The exact incident term (research incident, Korean Centella/Propolis product) — HAS an alias override. */
export const BHA_BETAINE_SALICYLATE_MATCH: MatchedToken = makeMatchedToken({
  rawText: 'Betaine Salicylate',
  matcherPattern: '\\bbetaine\\s+salicylate\\b',
});

/** The other confirmed regional alias from actives.json's bha class — HAS an alias override. */
export const BHA_WILLOW_BARK_MATCH: MatchedToken = makeMatchedToken({
  rawText: 'Willow Bark',
  matcherPattern: '\\b(salix\\s+alba|willow\\s+bark)\\b',
});

/** A different class entirely, used to assert "no override -> no icon" isn't class-wide. */
export const NIACINAMIDE_MATCH: MatchedToken = makeMatchedToken({
  rawText: 'Niacinamide',
  matcherPattern: '\\b(niacinamide|nicotinamide)\\b',
});

export function makeParsedActiveDetail(
  overrides: Partial<ParsedActiveDetail> = {},
): ParsedActiveDetail {
  return {
    key: 'bha',
    potency: 'high',
    matches: [BHA_SALICYLIC_ACID_MATCH],
    ...overrides,
  };
}

// ─── aliasOverrides.json fixture (mocked in tests, NOT the real FE-2 file) ──
//
// Deliberately scoped to just the two confirmed cases from the spec (§6 /
// incident writeup) so badge-wiring tests stay deterministic regardless of
// whatever else the engineer eventually seeds in the real
// src/constants/rulesets/aliasOverrides.json.

export const ALIAS_OVERRIDES_FIXTURE: Record<string, { microCopy: string }> = {
  '\\bbetaine\\s+salicylate\\b': {
    microCopy:
      'We found Betaine Salicylate. This is a gentle Korean form of BHA synthesized with moisturizing Betaine.',
  },
  '\\b(salix\\s+alba|willow\\s+bark)\\b': {
    microCopy:
      'We found Willow Bark. This is a natural, plant-derived source of the same BHA (salicylic acid) family.',
  },
};

// ─── AttributionTooltipProps factory (typed against the real, not-yet-built props) ──
//
// NOTE: src/components/routine/AttributionTooltip.tsx does not exist yet
// (FE-3). This import intentionally targets code that will fail to resolve
// until the engineer creates it — expected, tests-first, same pattern as
// tests/clinic-forecast-timeline/fixtures.ts.
import type { AttributionTooltipProps } from '@/components/routine/AttributionTooltip';

export function makeAttributionTooltipProps(
  overrides: Partial<AttributionTooltipProps> = {},
): AttributionTooltipProps {
  return {
    visible: true,
    onClose: jest.fn(),
    displayName: 'BHA (Salicylic Acid)',
    matches: [BHA_BETAINE_SALICYLATE_MATCH],
    ...overrides,
  };
}

// ─── Product factories (badge-wiring tests) ──────────────────────────────────

export function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Centella Propolis Ampoule',
    brand: 'Skin1004',
    productType: 'ampoule',
    imageUrl: null,
    activeIngredients: [],
    activeTags: [],
    fullIngredientText: null,
    usageTime: 'both',
    openBeautyFactsId: null,
    addedAt: '2026-01-01',
    notes: null,
    openedDate: null,
    paoMonths: null,
    isHidden: false,
    ...overrides,
  };
}

/** Reproduces the exact live-test incident: bha detected only via the alias term. */
export const INCIDENT_PRODUCT: Product = makeProduct({
  id: 'incident-product',
  activeTags: ['bha' as ActiveIngredientKey, 'niacinamide' as ActiveIngredientKey],
  fullIngredientText:
    'Water, Centella Asiatica Extract, Niacinamide, Betaine Salicylate, Propolis Extract',
});

/** A product where the Western/expected term fired — no alias, no icon expected. */
export const CANONICAL_TERM_PRODUCT: Product = makeProduct({
  id: 'canonical-term-product',
  activeTags: ['bha' as ActiveIngredientKey],
  fullIngredientText: 'Water, Salicylic Acid, Glycerin',
});

/** Both the canonical term and an alias fire for the same class (Story 1 AC4). */
export const MULTI_MATCH_PRODUCT: Product = makeProduct({
  id: 'multi-match-product',
  activeTags: ['bha' as ActiveIngredientKey],
  fullIngredientText: 'Water, Salicylic Acid, Willow Bark Extract, Glycerin',
});

/** activeTags confirmed via the wizard but no INCI text was ever captured — matches=[] edge case. */
export const NO_INCI_TEXT_PRODUCT: Product = makeProduct({
  id: 'no-inci-text-product',
  activeTags: ['bha' as ActiveIngredientKey],
  fullIngredientText: null,
});
