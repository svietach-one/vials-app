/**
 * Integration test — ProductDetailScreen "Allergens" card (FE-7)
 * Spec: docs/specs/vials-eu-allergen-detection.md Story 3 acceptance criteria.
 * Tech design: docs/tech-design/vials-eu-allergen-detection.md FE-7.
 *
 * `src/utils/allergenDetector.ts` (FE-3) does not exist yet, so this whole suite is
 * EXPECTED TO FAIL TO RESOLVE until FE-3 lands (see ProductShelfCard.allergen-badge.test.tsx's
 * header for why mocking a not-yet-existing `@/` module fails to resolve at all), then
 * EXPECTED TO FAIL ASSERTIONS until FE-7 actually adds the card to ProductDetailScreen.tsx.
 *
 * The neutral one-liner copy asserted below ("Fragrance component regulated in the EU as a
 * potential allergen.") is the literal example quoted in the spec's Story 3 AC1 — adopted
 * verbatim as the binding contract for FE-3's shared copy constant, since the spec quotes it
 * exactly rather than leaving it open. The restricted-note copy is NOT quoted verbatim in the
 * spec (only paraphrased — "no longer permitted in new EU products"), so it is asserted by
 * regex/substring only, leaving the engineer wording freedom there.
 *
 * Mocking pattern mirrors tests/routine-engine/product-detail-vitc-infobox.test.tsx, the most
 * current ProductDetailScreen test in this repo (AppHeader-based, no navigation.setOptions).
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { Product } from '@/types';

import { collectTextOrder, NON_RESTRICTED_MATCH_A, NON_RESTRICTED_MATCH_B, RESTRICTED_MATCH_LILIAL } from './fixtures';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('@/components/product/DeleteProductModal', () => ({ DeleteProductModal: () => null }));
jest.mock('@/components/product/ProductActionSheet', () => ({ ProductActionSheet: () => null }));
jest.mock('@/components/routine/RemoveRoutineActionSheet', () => ({ RemoveRoutineActionSheet: () => null }));
jest.mock('@/components/routine/RoutineSchedulerSheet', () => ({ RoutineSchedulerSheet: () => null }));

jest.mock('@/store/routinesStore', () => ({
  useRoutinesStore: jest.fn((selector: any) => selector({ routines: [] })),
}));

let mockProducts: Product[] = [];
const mockUpdateProduct = jest.fn();

jest.mock('@/store/productsStore', () => ({
  useProductsStore: jest.fn((selector: any) =>
    selector({ products: mockProducts, updateProduct: mockUpdateProduct }),
  ),
}));

jest.mock('@/utils/allergenDetector', () => ({
  getProductAllergenMatches: jest.fn((product: any) => product.detectedAllergens ?? []),
  hasRestrictedAllergenMatch: jest.fn((matches: any[]) => matches.some((m: any) => m.restricted)),
}));

import ProductDetailScreen from '@/screens/ProductDetailScreen';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: 'p1',
    name: 'Rose Body Lotion',
    brand: 'Vials Lab',
    productType: 'lotion',
    imageUrl: null,
    activeIngredients: [],
    activeTags: [],
    fullIngredientText: 'Aqua, Glycerin, Linalool, Parfum',
    usageTime: 'both',
    openBeautyFactsId: null,
    addedAt: '2026-01-01',
    notes: null,
    openedDate: null,
    paoMonths: null,
    ...overrides,
  };
}

function renderScreen(productId: string) {
  return render(
    <ProductDetailScreen
      navigation={{ navigate: jest.fn(), goBack: jest.fn() } as any}
      route={{ params: { productId } } as any}
    />,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockProducts = [];
});

const NEUTRAL_ONE_LINER = 'Fragrance component regulated in the EU as a potential allergen.';
const RESTRICTED_NOTE_RE = /no longer permitted in new EU products/i;

// ── Story 3 AC1 — card lists every matched entry + shared neutral copy ───────

describe('Story 3 AC1 — "Allergens" card lists every matched entry with the shared neutral copy', () => {
  it('renders the "Allergens" card title when there is >=1 match', () => {
    mockProducts = [makeProduct({ id: 'p-match', detectedAllergens: [NON_RESTRICTED_MATCH_A] })];
    renderScreen('p-match');
    expect(screen.getByText('Allergens')).toBeTruthy();
  });

  it("lists every matched entry's canonical name", () => {
    mockProducts = [
      makeProduct({
        id: 'p-multi',
        detectedAllergens: [NON_RESTRICTED_MATCH_A, NON_RESTRICTED_MATCH_B],
      }),
    ];
    renderScreen('p-multi');
    expect(screen.getByText('Linalool')).toBeTruthy();
    expect(screen.getByText('Limonene')).toBeTruthy();
  });

  it('shows the shared neutral one-liner once per matched entry', () => {
    mockProducts = [
      makeProduct({
        id: 'p-multi',
        detectedAllergens: [NON_RESTRICTED_MATCH_A, NON_RESTRICTED_MATCH_B],
      }),
    ];
    renderScreen('p-multi');
    expect(screen.getAllByText(NEUTRAL_ONE_LINER)).toHaveLength(2);
  });
});

// ── Story 3 AC2 — absent entirely on zero matches ─────────────────────────────

describe('Story 3 AC2 — no "Allergens" card at all when there are zero matches', () => {
  it('does not render the "Allergens" title when detectedAllergens is empty', () => {
    mockProducts = [makeProduct({ id: 'p-none', detectedAllergens: [] })];
    renderScreen('p-none');
    expect(screen.queryByText('Allergens')).toBeNull();
  });

  it('does not render the "Allergens" title when fullIngredientText is null and there are zero matches', () => {
    mockProducts = [
      makeProduct({ id: 'p-null-inci', fullIngredientText: null, detectedAllergens: [] }),
    ];
    renderScreen('p-null-inci');
    expect(screen.queryByText('Allergens')).toBeNull();
  });
});

// ── Story 3 AC3 — restricted note ─────────────────────────────────────────────

describe('Story 3 AC3 — restricted entries additionally show the banned-in-new-products note', () => {
  it('shows the restricted note for a restricted:true entry', () => {
    mockProducts = [makeProduct({ id: 'p-restricted', detectedAllergens: [RESTRICTED_MATCH_LILIAL] })];
    renderScreen('p-restricted');
    expect(screen.getByText('Lilial')).toBeTruthy();
    expect(screen.getByText(RESTRICTED_NOTE_RE)).toBeTruthy();
  });

  it('does not show the restricted note for a product with only non-restricted matches', () => {
    mockProducts = [makeProduct({ id: 'p-ordinary', detectedAllergens: [NON_RESTRICTED_MATCH_A] })];
    renderScreen('p-ordinary');
    expect(screen.queryByText(RESTRICTED_NOTE_RE)).toBeNull();
  });

  it('shows the restricted note exactly once on a mixed product (one restricted + one non-restricted entry)', () => {
    mockProducts = [
      makeProduct({
        id: 'p-mixed',
        detectedAllergens: [NON_RESTRICTED_MATCH_A, RESTRICTED_MATCH_LILIAL],
      }),
    ];
    renderScreen('p-mixed');
    expect(screen.getAllByText(RESTRICTED_NOTE_RE)).toHaveLength(1);
  });
});

// ── Position — after "Active Ingredients", before "Full Ingredient List" ─────

describe('Position — after "Active Ingredients" and before "Full Ingredient List"', () => {
  it('renders the Allergens card title between the two existing card titles', () => {
    mockProducts = [makeProduct({ id: 'p-order', detectedAllergens: [NON_RESTRICTED_MATCH_A] })];
    const { toJSON } = renderScreen('p-order');

    const order = collectTextOrder(
      toJSON() as any,
      new Set(['Active Ingredients', 'Allergens', 'Full Ingredient List']),
    );
    expect(order).toEqual(['Active Ingredients', 'Allergens', 'Full Ingredient List']);
  });
});
