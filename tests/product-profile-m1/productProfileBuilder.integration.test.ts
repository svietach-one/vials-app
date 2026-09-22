/**
 * Integration tests — Product Profile Milestone 1 builder pipeline
 * (docs/specs/2026-08-05-product-profile-m1.md, docs/tech-design/product-profile-m1.md).
 *
 * Exercises `buildProductProfileFromProduct` and `buildProductProfileFromActiveKeys`
 * end-to-end across all pipeline stages (resolve -> join -> capabilities ->
 * irritation -> sensitivity -> routinePosition -> orchestration), per
 * tech-design §1/§3. Both the module (`src/utils/productProfile/`) and the
 * `ProductProfile` types it returns (`src/types/index.ts` FE-1) do not exist
 * yet — this file is expected to fail `tsc`/fail to resolve until the
 * engineer lands FE-1..FE-7. That is the correct pre-implementation state.
 *
 * Covers:
 *   AC-1 (Story 1 AC1)  Populated profile: eligible periods, layering
 *                        position, irritation indicator, Barrier Repair /
 *                        Exfoliation capability data are all present and
 *                        never `undefined`.
 *   AC-2 (Story 1 AC2)  Zero-known-ingredient product -> capabilities never
 *                        report a false `0`/`false` claim; real
 *                        `insufficient_data`/`null` throughout.
 *   AC-3 (Story 1 AC3)  A product that does not qualify for Barrier Repair
 *                        still gets a real, deterministic `0` (not `null`)
 *                        when it HAS resolved ingredient data — the `0` vs
 *                        `null` distinction from spec §"insufficient-data
 *                        handling" / AC2 vs AC3.
 *   AC-4 (Story 1 AC4)  Disagreeing `preferredPeriod` across present classes
 *                        with no allowedPeriods-derived requirement resolves
 *                        to `null`, not a guessed winner.
 *   AC-5 (Story 2 AC1)  Unresolved INCI tokens surfaced via the raw-text
 *                        entry point.
 *   AC-6 (Story 2 AC2)  `unresolvedIngredientTokens` is `[]` via the
 *                        resolved-corpus entry point (no free text to parse).
 *   AC-7 (spec §3 Non-Goals) `sensitivityCompatibility.compatible` is `null`
 *                        this milestone — no numeric threshold is asserted.
 *   AC-8 (spec §9 / tech-design §2) Required fields are never `undefined`,
 *                        for both entry points, across all fixtures.
 *   AC-9 (tech-design FE-5 x §7) `overallConfidence` is `insufficient_data`
 *                        for EVERY profile this milestone, since
 *                        `sensitivityCompatibility` ships unconditionally
 *                        `insufficient_data` and is a required field folded
 *                        into the worst-tier rollup — documented as a
 *                        milestone-wide invariant, not a per-fixture signal.
 */

// `copper_peptides` is the ONLY class in this suite whose ruleset lookup is
// overridden: real actives.json data has no class with `preferredPeriod:
// 'pm'` today (verified against the JSON directly — every present
// `preferredPeriod` value in the current ruleset is 'am'), so the
// AM/PM-disagreement branch (tech-design FE-6 / spec §10) is unreachable
// with real data alone. This override exercises that branch without
// inventing a new class or corrupting any other fixture in this file (no
// other test in this suite resolves `copper_peptides`). `allowedPeriods`
// stays ['am','pm'] (a soft preference, NOT a hard single-period
// requirement) so the disagreement genuinely has no tie-breaker.
jest.mock('@/constants/rulesets/rulesetTypes', () => {
  const actual = jest.requireActual('@/constants/rulesets/rulesetTypes');
  return {
    ...actual,
    ACTIVES_RULESET: {
      ...actual.ACTIVES_RULESET,
      classes: {
        ...actual.ACTIVES_RULESET.classes,
        copper_peptides: {
          ...actual.ACTIVES_RULESET.classes.copper_peptides,
          preferredPeriod: 'pm',
        },
      },
    },
  };
});

import type { ProductType } from '@/types';
import {
  buildProductProfileFromActiveKeys,
  buildProductProfileFromProduct,
} from '@/utils/productProfile';
import {
  makeAmPreferringProduct,
  makeCeramidesOnlyProduct,
  makeOneResolvedOneGibberishProduct,
  makePmPreferringProduct,
  makeProduct,
  makeZeroActivesProduct,
} from './fixtures';

// All 18 ProductType values (src/types/index.ts). LAYERING_ORDER is typed as
// a full `Record<ProductType, number>` (see src/utils/routineEngine/slotting.ts,
// relocating per tech-design FE-2 with "zero behavior change"), so every one
// of these resolves to a real number today — the `layeringOrder: null`
// branch documented in `01-product-profile.md` §6 is not reachable via any
// current ProductType. Asserted here as a locked-in contract so a future
// change to a Partial<Record<...>> table is caught by this suite.
const ALL_PRODUCT_TYPES: ProductType[] = [
  'cleanser',
  'toner',
  'essence',
  'serum',
  'gel',
  'moisturizer',
  'oil',
  'spf',
  'makeup_remover',
  'peeling',
  'ampoule',
  'lotion',
  'cream',
  'eye_cream',
  'mask',
  'balm',
  'spot_treatment',
  'other',
];

// ── AC-1 / AC-8 — populated profile, required fields never undefined ──────

describe('buildProductProfileFromProduct — populated profile (ceramides only)', () => {
  it('resolves the ceramides class and reports Barrier Repair as a real deterministic score', () => {
    const profile = buildProductProfileFromProduct(makeCeramidesOnlyProduct());

    expect(profile.resolvedActiveKeys).toEqual(['ceramides']);
    expect(profile.capabilities.barrierRepair.score).not.toBeNull();
    expect(profile.capabilities.barrierRepair.score).toBeGreaterThan(0);
    expect(profile.capabilities.barrierRepair.confidence).toBe('deterministic');
    expect(profile.capabilities.barrierRepair.contributingClasses).toContain('ceramides');
  });

  it('reports Exfoliation as a real deterministic 0, not a null/insufficient claim (AC-3)', () => {
    const profile = buildProductProfileFromProduct(makeCeramidesOnlyProduct());

    expect(profile.capabilities.exfoliation.score).toBe(0);
    expect(profile.capabilities.exfoliation.confidence).toBe('deterministic');
  });

  it('never leaves a required top-level field undefined', () => {
    const profile = buildProductProfileFromProduct(makeCeramidesOnlyProduct());

    const requiredKeys: (keyof typeof profile)[] = [
      'productId',
      'productType',
      'brand',
      'name',
      'sourceInciText',
      'resolvedActiveKeys',
      'unresolvedIngredientTokens',
      'primaryFunctions',
      'capabilities',
      'irritation',
      'sensitivityCompatibility',
      'routinePosition',
      'builtAt',
      'builderVersion',
      'overallConfidence',
    ];
    for (const key of requiredKeys) {
      expect(profile[key]).not.toBeUndefined();
    }
  });

  it('reports eligible periods and a layering position for a real product type', () => {
    const profile = buildProductProfileFromProduct(makeCeramidesOnlyProduct({ productType: 'serum' }));

    expect(profile.routinePosition.eligiblePeriods.length).toBeGreaterThan(0);
    expect(profile.routinePosition.layeringOrder).not.toBeNull();
  });

  it.each(ALL_PRODUCT_TYPES)(
    'reports a numeric layeringOrder for product type "%s" (see ALL_PRODUCT_TYPES comment above)',
    (productType) => {
      const profile = buildProductProfileFromProduct(makeCeramidesOnlyProduct({ productType }));
      expect(typeof profile.routinePosition.layeringOrder).toBe('number');
    },
  );

  it('gives an irritation indicator (0-5 scale) rather than leaving it unset', () => {
    const profile = buildProductProfileFromProduct(makeCeramidesOnlyProduct());

    expect(profile.irritation.score).not.toBeNull();
    expect(profile.irritation.score).toBeGreaterThanOrEqual(0);
    expect(profile.irritation.score).toBeLessThanOrEqual(5);
  });
});

// ── AC-2 — insufficient-data path (zero resolvable active classes) ────────

describe('buildProductProfileFromProduct — zero resolvable active classes', () => {
  it('never asserts a false 0/false capability claim for Barrier Repair or Exfoliation', () => {
    const profile = buildProductProfileFromProduct(makeZeroActivesProduct());

    expect(profile.capabilities.barrierRepair.score).toBeNull();
    expect(profile.capabilities.barrierRepair.confidence).toBe('insufficient_data');
    expect(profile.capabilities.exfoliation.score).toBeNull();
    expect(profile.capabilities.exfoliation.confidence).toBe('insufficient_data');
  });

  it('reports zero resolved active keys and an empty unresolved-token list (no text to parse)', () => {
    const profile = buildProductProfileFromProduct(makeZeroActivesProduct());

    expect(profile.resolvedActiveKeys).toEqual([]);
    expect(profile.unresolvedIngredientTokens).toEqual([]);
  });

  it('reports irritation as null/insufficient_data rather than a guessed 0', () => {
    const profile = buildProductProfileFromProduct(makeZeroActivesProduct());

    expect(profile.irritation.score).toBeNull();
    expect(profile.irritation.confidence).toBe('insufficient_data');
  });

  it('still returns every required top-level field (never undefined) for the empty-data case', () => {
    const profile = buildProductProfileFromProduct(makeZeroActivesProduct());

    expect(profile.capabilities).toBeDefined();
    expect(profile.routinePosition).toBeDefined();
    expect(profile.sensitivityCompatibility).toBeDefined();
    expect(profile.primaryFunctions).toEqual([]);
  });
});

// ── AC-5 / AC-6 — unresolvedIngredientTokens behaviour per entry point ────

describe('unresolvedIngredientTokens — raw-INCI-text entry point', () => {
  it('surfaces a token that matches no actives.json class alongside a resolved one', () => {
    const profile = buildProductProfileFromProduct(makeOneResolvedOneGibberishProduct());

    expect(profile.resolvedActiveKeys).toEqual(['niacinamide']);
    expect(profile.unresolvedIngredientTokens.length).toBeGreaterThan(0);
    expect(
      profile.unresolvedIngredientTokens.some((token: string) =>
        token.toLowerCase().includes('zzyxwvutplex'),
      ),
    ).toBe(true);
  });
});

describe('unresolvedIngredientTokens — resolved-corpus entry point', () => {
  it('is empty when resolvedActiveKeys is supplied directly (no free text to parse)', () => {
    const profile = buildProductProfileFromActiveKeys({
      productId: 'corpus-1',
      productType: 'serum',
      brand: 'Corpus Brand',
      name: 'Corpus Serum',
      activeKeys: ['niacinamide'],
    });

    expect(profile.unresolvedIngredientTokens).toEqual([]);
    expect(profile.resolvedActiveKeys).toEqual(['niacinamide']);
  });

  it('is empty even when the supplied activeKeys array is itself empty', () => {
    const profile = buildProductProfileFromActiveKeys({
      productId: 'corpus-2',
      productType: 'serum',
      brand: 'Corpus Brand',
      name: 'Corpus Serum',
      activeKeys: [],
    });

    expect(profile.unresolvedIngredientTokens).toEqual([]);
    expect(profile.resolvedActiveKeys).toEqual([]);
  });
});

// ── AC-4 — disagreeing preferredPeriod resolves to null ────────────────────

describe('routinePosition.preferredPeriod — disagreement handling', () => {
  it('returns the single value when only one present class expresses a preference', () => {
    const profile = buildProductProfileFromProduct(makeAmPreferringProduct());

    expect(profile.routinePosition.preferredPeriod).toBe('AM');
  });

  it('returns null when two present classes disagree with no allowedPeriods requirement to break the tie', () => {
    const merged = makeProduct({
      activeTags: ['vitamin_c_pure', 'copper_peptides'], // AM (real) vs PM (mocked, see top-of-file jest.mock)
      fullIngredientText: null,
    });

    const profile = buildProductProfileFromProduct(merged);

    expect(profile.routinePosition.preferredPeriod).toBeNull();
    // Neither class has a single-period hard requirement (both allow am+pm),
    // so eligiblePeriods stays the full intersection — only preferredPeriod
    // collapses to null.
    expect(profile.routinePosition.eligiblePeriods.slice().sort()).toEqual(['AM', 'PM']);
  });

  it('marks routinePosition confidence as heuristic (not deterministic) when a disagreement had to be resolved', () => {
    const merged = makeProduct({
      activeTags: ['vitamin_c_pure', 'copper_peptides'],
      fullIngredientText: null,
    });

    const profile = buildProductProfileFromProduct(merged);

    expect(profile.routinePosition.confidence).toBe('heuristic');
  });

  it('sanity-checks the fixture pair individually still resolves to their own single preference', () => {
    const pmProfile = buildProductProfileFromProduct(makePmPreferringProduct());
    expect(pmProfile.routinePosition.preferredPeriod).toBe('PM');
  });
});

// ── AC-7 — sensitivityCompatibility ships null/insufficient_data this milestone ──

describe('sensitivityCompatibility — Milestone 1 placeholder (spec Non-Goals §3)', () => {
  it('reports compatible=null and thresholdUsed=null even for a well-resolved product', () => {
    const profile = buildProductProfileFromProduct(makeCeramidesOnlyProduct());

    expect(profile.sensitivityCompatibility.compatible).toBeNull();
    expect(profile.sensitivityCompatibility.thresholdUsed).toBeNull();
    expect(profile.sensitivityCompatibility.confidence).toBe('insufficient_data');
  });

  it('reports compatible=null for the zero-active-classes product too', () => {
    const profile = buildProductProfileFromProduct(makeZeroActivesProduct());

    expect(profile.sensitivityCompatibility.compatible).toBeNull();
  });

  it('does NOT assert any numeric irritation threshold anywhere on the object (deferred, spec §3/Q3)', () => {
    const profile = buildProductProfileFromProduct(makeCeramidesOnlyProduct());
    // Deliberately only checking shape/null-ness above — a numeric cutoff is
    // explicitly out of scope for Milestone 1 and must not be invented here.
    expect(profile.sensitivityCompatibility.thresholdUsed).toBeNull();
  });
});

// ── AC-9 — overallConfidence is insufficient_data for every profile this milestone ──

describe('overallConfidence — milestone-wide invariant', () => {
  it('is insufficient_data for a well-populated, fully-resolved product', () => {
    const profile = buildProductProfileFromProduct(makeCeramidesOnlyProduct());
    expect(profile.overallConfidence).toBe('insufficient_data');
  });

  it('is insufficient_data for the zero-active-classes product', () => {
    const profile = buildProductProfileFromProduct(makeZeroActivesProduct());
    expect(profile.overallConfidence).toBe('insufficient_data');
  });

  it('is insufficient_data via the resolved-corpus entry point too', () => {
    const profile = buildProductProfileFromActiveKeys({
      productId: 'corpus-3',
      productType: 'serum',
      brand: 'Corpus Brand',
      name: 'Corpus Serum',
      activeKeys: ['ceramides'],
    });
    expect(profile.overallConfidence).toBe('insufficient_data');
  });
});

// ── strengthsWeaknesses — always null this milestone ────────────────────────

describe('strengthsWeaknesses — Milestone 3 deferral', () => {
  it('is always null this milestone, regardless of how populated the profile is', () => {
    const populated = buildProductProfileFromProduct(makeCeramidesOnlyProduct());
    const empty = buildProductProfileFromProduct(makeZeroActivesProduct());

    expect(populated.strengthsWeaknesses).toBeNull();
    expect(empty.strengthsWeaknesses).toBeNull();
  });
});

// ── Entry-point identity fields pass through unchanged ──────────────────────

describe('identity fields pass through both entry points unchanged', () => {
  it('carries productId/productType/brand/name from the raw-INCI entry point', () => {
    const product = makeCeramidesOnlyProduct({
      id: 'identity-1',
      productType: 'cream',
      brand: 'Identity Brand',
      name: 'Identity Cream',
    });
    const profile = buildProductProfileFromProduct(product);

    expect(profile.productId).toBe('identity-1');
    expect(profile.productType).toBe('cream');
    expect(profile.brand).toBe('Identity Brand');
    expect(profile.name).toBe('Identity Cream');
    expect(profile.sourceInciText).toBe('Ceramide NP');
  });

  it('carries productId/productType/brand/name from the resolved-corpus entry point', () => {
    const profile = buildProductProfileFromActiveKeys({
      productId: 'identity-2',
      productType: 'toner',
      brand: 'Corpus Identity Brand',
      name: 'Corpus Identity Toner',
      activeKeys: ['niacinamide'],
    });

    expect(profile.productId).toBe('identity-2');
    expect(profile.productType).toBe('toner');
    expect(profile.brand).toBe('Corpus Identity Brand');
    expect(profile.name).toBe('Corpus Identity Toner');
    expect(profile.sourceInciText).toBeNull();
  });
});
