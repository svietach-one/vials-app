/**
 * Shared fixtures — `explore-composition` feature.
 * Spec: docs/specs/explore-composition.md
 * Tech design: docs/tech-design/explore-composition.md
 *
 * Written BEFORE any production code exists (qa-lead runs before engineer,
 * .claude/rules/agent-layer-protocol.md §12). Several imports below
 * (`WishlistEntry`, `resolveFromRawText`, the new screens/components) do not
 * exist yet — every test file that uses them is EXPECTED to fail to
 * compile/run until the corresponding FE-task lands, same convention as
 * tests/pregnancy-safety-handling/AddProcedureModal.pregnancy-enabled.test.tsx.
 *
 * Judgment calls made here that the tech design left unspecified (flagged to
 * engineer/tech-lead, not silently invented business behavior):
 *   1. `WishlistEntry` factory defaults `id`/`createdAt` the same way
 *      `Product` objects are built (caller-generated, full object passed to
 *      the store) — mirrors `productsStore.addProduct(product: Product)`'s
 *      existing convention, since FE-5 explicitly models wishlistStore.ts
 *      "mirroring productsStore.ts's pattern".
 *   2. `WishlistEntryCardProps` mirrors the sibling `WishlistProductCardProps`
 *      shape (entry + onCardPress + two action callbacks) — tech design FE-7
 *      says "sibling to, not shared with, WishlistProductCard.tsx" but does
 *      not give an exact prop list.
 *   3. `ExploreCompositionResultRouteParams` (rawIngredientsText + category)
 *      is this suite's contract for what the capture screen must hand to the
 *      result screen — the tech design's architecture diagram shows the data
 *      flow but not the exact param shape.
 *   4. **Story 9 (2026-08-27):** `WishlistEntryLike.notes` added, optional
 *      per FE-16 (`notes?: string | null`), defaulted to `null` here so every
 *      existing call site (`WishlistEntryCard.test.tsx`,
 *      `CatalogScreen.wishlist-entries.enabled.test.tsx`) keeps compiling/
 *      passing unmodified — none of them assert on its absence.
 */
import type { ActiveIngredientKey, Product, ProductType } from '@/types';
import type { ResolvedIngredients } from '@/utils/productProfile/resolve';

// ─── ResolvedIngredients (existing type, FE-3 will add resolveFromRawText) ────

export function makeResolvedIngredients(
  overrides: Partial<ResolvedIngredients> = {},
): ResolvedIngredients {
  return {
    resolvedActiveKeys: ['niacinamide'],
    unresolvedIngredientTokens: [],
    potencyByKey: {},
    positionByKey: {},
    ...overrides,
  };
}

// ─── WishlistEntry (new type, FE-5; `notes` added by Story 9's FE-16) ─────────

export interface WishlistEntryLike {
  id: string;
  brand: string | null;
  name: string | null;
  category: ProductType | null;
  rawIngredientsText: string;
  parsedIngredientIds: ActiveIngredientKey[];
  sourceFlow: 'explore_composition' | 'add_product';
  createdAt: string;
  notes?: string | null;
}

export function makeWishlistEntry(overrides: Partial<WishlistEntryLike> = {}): WishlistEntryLike {
  return {
    id: 'wishlist-entry-1',
    brand: 'Some Brand',
    name: 'Some Serum',
    category: 'serum',
    rawIngredientsText: 'Aqua, Niacinamide, Glycerin',
    parsedIngredientIds: ['niacinamide'],
    sourceFlow: 'explore_composition',
    createdAt: '2026-08-01T00:00:00.000Z',
    notes: null,
    ...overrides,
  };
}

// ─── Result-screen route params (this suite's contract, judgment call #3) ────

export interface ExploreCompositionResultRouteParamsLike {
  rawIngredientsText: string;
  category: ProductType | null;
}

export function makeExploreCompositionResultParams(
  overrides: Partial<ExploreCompositionResultRouteParamsLike> = {},
): ExploreCompositionResultRouteParamsLike {
  return {
    rawIngredientsText: 'Aqua, Niacinamide, Glycerin, Xanthan Weirdum',
    category: null,
    ...overrides,
  };
}

// ─── Minimal Product factory (owned/wishlist products already in productsStore) ──

export function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Hydra Boost Serum',
    brand: 'CeraVe',
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
  } as Product;
}

// ─── Navigation mock factory ────────────────────────────────────────────────────

export function makeNavigation(overrides: Record<string, unknown> = {}) {
  return {
    navigate: jest.fn(),
    goBack: jest.fn(),
    setOptions: jest.fn(),
    setParams: jest.fn(),
    ...overrides,
  } as unknown as never;
}
