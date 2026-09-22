/**
 * Shared fixtures — Product Profile Milestone 1 (docs/specs/2026-08-05-product-profile-m1.md).
 *
 * `makeProduct` is annotated against the real `Product` type so prop drift
 * fails `tsc`, not just the test run (.claude/rules/testing.md).
 *
 * `ProductProfile` and its nested types do not exist yet — they land with
 * FE-1 (docs/tech-design/product-profile-m1.md §3). Importing them here is
 * intentional and expected to fail `tsc` until the engineer lands FE-1; that
 * is the correct pre-implementation state for this suite.
 */
import type {
  ActiveIngredientKey,
  CapabilityKey,
  CapabilityScore,
  Product,
  ProductProfile,
} from '@/types';

// ─── Product factory ────────────────────────────────────────────────────────

export function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Test Product',
    brand: 'Test Brand',
    productType: 'serum',
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
    ...overrides,
  };
}

// ─── Story 1 AC1 — populated profile (Barrier Repair, no Exfoliation) ──────

/**
 * `activeTags` AND `fullIngredientText` both resolve to `ceramides` only, so
 * this fixture produces the same result regardless of which source the
 * builder's raw-INCI entry point (`buildProductProfileFromProduct`) prefers
 * — the tech design does not pin activeTags-vs-fullIngredientText precedence,
 * so the fixture is deliberately unambiguous on that point.
 *
 * `ceramides` (actives.json): properties.barrierRepair=true, exfoliating=false,
 * irritancy=0, allowedPeriods=['am','pm'], no preferredPeriod.
 */
export function makeCeramidesOnlyProduct(overrides: Partial<Product> = {}): Product {
  return makeProduct({
    activeTags: ['ceramides'],
    fullIngredientText: 'Ceramide NP',
    ...overrides,
  });
}

// ─── Story 1 AC2 — insufficient-data path (zero resolvable actives) ────────

/**
 * No active tags, no ingredient text at all — the "resolves to zero known
 * active classes" case from spec §4 Story 1 AC2. Must never surface a false
 * `0`/`false` capability claim.
 */
export function makeZeroActivesProduct(overrides: Partial<Product> = {}): Product {
  return makeProduct({
    activeTags: [],
    fullIngredientText: null,
    ...overrides,
  });
}

// ─── Story 2 AC1 — one resolvable INCI term + one gibberish token ──────────

/**
 * Deliberately only two comma-separated tokens: "Niacinamide" (matches the
 * `niacinamide` class matcher `\b(niacinamide|nicotinamide)\b`) and
 * "Zzyxwvutplex" (matches no class in actives.json). No filler tokens like
 * "Aqua" — the ruleset has no water/base class, so any extra filler token
 * would itself land in `unresolvedIngredientTokens` and muddy the assertion.
 * `activeTags` is deliberately left unset (undefined) so this fixture only
 * exercises the raw-INCI-text resolution path.
 */
export function makeOneResolvedOneGibberishProduct(overrides: Partial<Product> = {}): Product {
  return makeProduct({
    activeTags: undefined,
    fullIngredientText: 'Niacinamide, Zzyxwvutplex',
    ...overrides,
  });
}

// ─── Story 1 AC4 / spec §10 — disagreeing preferredPeriod ──────────────────

/**
 * `vitamin_c_pure` real ruleset data: allowedPeriods=['am','pm'],
 * preferredPeriod='am' (a soft preference — allowedPeriods has 2 entries,
 * so this is NOT a hard single-period requirement).
 */
export function makeAmPreferringProduct(overrides: Partial<Product> = {}): Product {
  return makeProduct({
    activeTags: ['vitamin_c_pure'],
    fullIngredientText: 'Ascorbic Acid',
    ...overrides,
  });
}

/**
 * `copper_peptides` real ruleset data: allowedPeriods=['am','pm'],
 * preferredPeriod='am' (also a soft preference). The productProfileBuilder
 * integration suite mocks ONLY this class's `preferredPeriod` to 'pm' for
 * its disagreement test (see that file's top-of-file `jest.mock`), since no
 * class in the current ruleset ships a 'pm' preferredPeriod today — see that
 * test file's comment for the full rationale. This fixture's `activeTags`
 * stay real; only the ruleset lookup is overridden for that one test.
 */
export function makePmPreferringProduct(overrides: Partial<Product> = {}): Product {
  return makeProduct({
    activeTags: ['copper_peptides'],
    fullIngredientText: 'Copper Tripeptide-1',
    ...overrides,
  });
}

// ─── ProductProfile factory (for ProductInsightsPanel render tests) ───────

export const ALL_CAPABILITY_KEYS: CapabilityKey[] = [
  'hydration',
  'barrierRepair',
  'brightening',
  'pigmentation',
  'acneControl',
  'sebumRegulation',
  'antioxidantProtection',
  'soothing',
  'exfoliation',
  'antiAging',
];

export function makeInsufficientCapability(
  overrides: Partial<CapabilityScore> = {},
): CapabilityScore {
  return {
    score: null,
    confidence: 'insufficient_data',
    caveat: 'Not modeled in Milestone 1',
    sourceRefs: [],
    contributingClasses: [],
    ...overrides,
  };
}

export function makeEmptyCapabilities(): Record<CapabilityKey, CapabilityScore> {
  return ALL_CAPABILITY_KEYS.reduce((acc, key) => {
    acc[key] = makeInsufficientCapability();
    return acc;
  }, {} as Record<CapabilityKey, CapabilityScore>);
}

export function makeDeterministicCapability(
  score: number,
  contributingClasses: ActiveIngredientKey[],
  sourceRefs: string[],
): CapabilityScore {
  return {
    score,
    confidence: 'deterministic',
    sourceRefs,
    contributingClasses,
  };
}

/**
 * Full `ProductProfile` factory for component-level tests that render the
 * panel directly from a known profile shape, independent of the builder
 * pipeline (the pipeline itself is covered end-to-end by
 * `productProfileBuilder.integration.test.ts`).
 *
 * NOTE: `overallConfidence` defaults to `'insufficient_data'` here because
 * that is what the REAL builder always produces this milestone —
 * `sensitivityCompatibility` ships with `confidence: 'insufficient_data'`
 * unconditionally (tech-design FE-5, spec Non-Goals §3), and
 * `overallConfidence` is the worst tier among all required fields
 * (`01-product-profile.md` §7). This is true even for a fully-populated,
 * well-resolved product — see the "always insufficient_data this milestone"
 * test in the integration suite. Do NOT use `overallConfidence` alone to
 * decide the panel's empty-state branch in fixtures/tests below.
 */
export function makeProductProfile(overrides: Partial<ProductProfile> = {}): ProductProfile {
  return {
    productId: 'profile-1',
    productType: 'serum',
    brand: 'Test Brand',
    name: 'Test Serum',
    sourceInciText: null,
    resolvedActiveKeys: [],
    unresolvedIngredientTokens: [],
    primaryFunctions: [],
    capabilities: makeEmptyCapabilities(),
    irritation: {
      score: null,
      photosensitizing: false,
      lowPh: false,
      aggregationMethod: 'max_of_present',
      confidence: 'insufficient_data',
      sourceRefs: [],
      caveat: 'No resolved active classes to assess irritation from.',
    },
    sensitivityCompatibility: {
      compatible: null,
      thresholdUsed: null,
      confidence: 'insufficient_data',
      sourceRefs: [],
      caveat: 'Sensitivity threshold not yet clinically defined (spec §3/Q3).',
    },
    routinePosition: {
      eligiblePeriods: [],
      preferredPeriod: null,
      layeringOrder: null,
      rinseOff: false,
      confidence: 'insufficient_data',
      sourceRefs: [],
    },
    strengthsWeaknesses: null,
    builtAt: '2026-08-05T00:00:00.000Z',
    builderVersion: '1.0.0',
    overallConfidence: 'insufficient_data',
    ...overrides,
  };
}

/**
 * A fully-populated profile: one resolved class (`ceramides`), Barrier
 * Repair scored deterministically above zero, Exfoliation scored a real
 * deterministic zero (not null — `ceramides` doesn't exfoliate, and that is
 * a genuine claim per spec §"insufficient-data handling", not a data gap).
 */
export function makePopulatedProfile(overrides: Partial<ProductProfile> = {}): ProductProfile {
  return makeProductProfile({
    resolvedActiveKeys: ['ceramides'],
    capabilities: {
      ...makeEmptyCapabilities(),
      barrierRepair: makeDeterministicCapability(
        0.33,
        ['ceramides'],
        ['actives.json:properties.barrierRepair'],
      ),
      exfoliation: makeDeterministicCapability(0, [], ['actives.json:properties.exfoliating']),
    },
    irritation: {
      score: 0,
      photosensitizing: false,
      lowPh: false,
      aggregationMethod: 'max_of_present',
      confidence: 'heuristic',
      sourceRefs: ['actives.json:classes.ceramides.properties.irritancy'],
    },
    routinePosition: {
      eligiblePeriods: ['AM', 'PM'],
      preferredPeriod: null,
      layeringOrder: 6,
      rinseOff: false,
      confidence: 'deterministic',
      sourceRefs: ['constants/rulesets/productFacts.ts:LAYERING_ORDER'],
    },
    ...overrides,
  });
}
