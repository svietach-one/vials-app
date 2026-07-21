/**
 * Shared fixtures — FE-13 My Shelf filter bottom sheet.
 *
 * IMPORTANT (expected TDD "red" state): `FunctionalBenefit`,
 * `CatalogFilterState.selectedBenefits`, `FilterSheetProps`, and
 * `CatalogFilterTriggerProps` do not exist in the codebase yet — FE-13-1
 * (types), FE-13-4 (CatalogFilterTrigger.tsx) and FE-13-5 (FilterSheet.tsx)
 * are unimplemented as of this writing (docs/tech-design/my-shelf-filter-bottomsheet.md).
 * The imports below will fail to resolve ("Cannot find module") until the
 * engineer completes those tasks. That failure is the correct starting point
 * for this task, not a bug in this fixture file — see progress/my-shelf-filter-bottomsheet.md.
 */
import type { CatalogFilterState, Product } from '@/types';
import { CATALOG_FILTER_DEFAULT } from '@/types';
import type { FilterSheetProps } from '@/components/catalog/FilterSheet';
import type { CatalogFilterTriggerProps } from '@/components/catalog/CatalogFilterTrigger';

// ── Product factory ───────────────────────────────────────────────────────────

export function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p-default',
    name: 'Default Product',
    brand: 'Brand',
    productType: 'serum',
    imageUrl: null,
    activeIngredients: [],
    activeTags: [],
    fullIngredientText: null,
    usageTime: 'morning',
    openBeautyFactsId: null,
    addedAt: '2026-01-01',
    notes: null,
    openedDate: null,
    paoMonths: null,
    ...overrides,
  };
}

// ── Filter-state factory ──────────────────────────────────────────────────────

export function makeFilterState(overrides: Partial<CatalogFilterState> = {}): CatalogFilterState {
  return {
    ...CATALOG_FILTER_DEFAULT,
    ...overrides,
  };
}

// ── Component prop factories (annotated with the real prop types per
//    .claude/rules/testing.md, so prop drift fails tsc, not just the test run) ──

export function makeFilterSheetProps(overrides: Partial<FilterSheetProps> = {}): FilterSheetProps {
  return {
    visible: true,
    initialState: makeFilterState(),
    onApply: () => {},
    onClose: () => {},
    ...overrides,
  };
}

export function makeCatalogFilterTriggerProps(
  overrides: Partial<CatalogFilterTriggerProps> = {},
): CatalogFilterTriggerProps {
  return {
    activeFilterCount: 0,
    onPress: () => {},
    ...overrides,
  };
}

// ── Ingredient -> benefit coverage fixtures ───────────────────────────────────
//
// Mirrors the FUNCTIONAL_BENEFIT_INGREDIENTS map fixed in the tech design's
// Assumptions section exactly, so tests double as a regression guard for the
// three corrected mappings (retinoid/retinol -> exfoliation, copper_peptides ->
// barrier_repair, niacinamide -> soothing + brightening):
//
//   hydration:      hyaluronic_acid, panthenol, ceramides
//   exfoliation:    aha, bha, pha, retinoid, retinol
//   soothing:       cica, panthenol, azelaic_acid, niacinamide
//   anti_acne:      benzoyl_peroxide, azelaic_acid, bha
//   barrier_repair: ceramides, cica, copper_peptides, panthenol
//   brightening:    vitamin_c_pure, vitamin_c_derivative, vitamin_c, niacinamide, azelaic_acid

export const RETINOID_SERUM = makeProduct({
  id: 'p-retinoid',
  name: 'Retinoid Renewal Serum',
  productType: 'serum',
  activeTags: ['retinoid'],
});

export const NIACINAMIDE_SERUM = makeProduct({
  id: 'p-niacinamide',
  name: 'Niacinamide 10% Serum',
  productType: 'serum',
  activeTags: ['niacinamide'],
});

export const HYALURONIC_MOISTURIZER = makeProduct({
  id: 'p-hyaluronic',
  name: 'Hyaluronic Acid Moisturizer',
  productType: 'moisturizer',
  activeTags: ['hyaluronic_acid'],
});

export const PLAIN_MOISTURIZER = makeProduct({
  id: 'p-plain-moisturizer',
  name: 'Fragrance-Free Moisturizer',
  productType: 'moisturizer',
  activeTags: [],
});

export const COPPER_PEPTIDE_CLEANSER = makeProduct({
  id: 'p-copper',
  name: 'Copper Peptide Repair Cleanser',
  productType: 'cleanser',
  activeTags: ['copper_peptides'],
});

export const UNTAGGED_SPF = makeProduct({
  id: 'p-spf',
  name: 'Mineral SPF50',
  productType: 'spf',
  activeTags: [],
});

/** Full 6-product catalog used across FilterSheet + CatalogScreen suites. */
export const BENEFIT_COVERAGE_PRODUCTS: Product[] = [
  RETINOID_SERUM,
  NIACINAMIDE_SERUM,
  HYALURONIC_MOISTURIZER,
  PLAIN_MOISTURIZER,
  COPPER_PEPTIDE_CLEANSER,
  UNTAGGED_SPF,
];
