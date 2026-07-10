import type { ProductShelfCardProps } from '@/components/product/ProductShelfCard';
import type { ActiveIngredientKey, Product, RoutineStep } from '@/types';

export function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Hydrabio H2O',
    brand: 'Bioderma',
    productType: 'cleanser',
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

export function makeRoutineStep(overrides: Partial<RoutineStep> = {}): RoutineStep {
  return {
    id: 'step-1',
    productType: 'cleanser',
    productId: 'p1',
    hidden: false,
    scheduledDays: [1, 3, 6],
    ...overrides,
  };
}

export function makeDefaultShelfCardProps(): ProductShelfCardProps {
  return {
    product: makeProduct(),
    isInRoutine: true,
    scheduleLabel: 'Mon • Wed • Sat',
    usageTime: 'both',
    onCardPress: jest.fn(),
    onEdit: jest.fn(),
    onAddToRoutine: jest.fn(),
    onRemoveFromRoutine: jest.fn(),
    onDelete: jest.fn(),
    onToggleHidden: jest.fn(),
  };
}

// ─── Multi-active-badges fixtures (docs/specs/multi-active-badges.md) ─────────

/**
 * Two confirmed active tags spanning two different badge categories
 * (bha = exfoliant, niacinamide = soothing) — Story 1 AC1.
 */
export function makeMultiActiveProduct(overrides: Partial<Product> = {}): Product {
  return makeProduct({
    activeTags: ['bha', 'niacinamide'],
    activeIngredients: [
      { key: 'bha', displayName: 'BHA' },
      { key: 'niacinamide', displayName: 'Niacinamide' },
    ],
    ...overrides,
  });
}

/**
 * `activeTags` is undefined so the card must fall back to reading the FULL
 * `activeIngredients` array (not just index 0) — Story 1 AC2.
 */
export function makeFallbackActiveProduct(overrides: Partial<Product> = {}): Product {
  return makeProduct({
    activeTags: undefined,
    activeIngredients: [
      { key: 'retinoid', displayName: 'Retinoids' },
      { key: 'ceramides', displayName: 'Ceramides' },
    ],
    ...overrides,
  });
}

/**
 * `activeTags` explicitly empty (user confirmed zero actives) while stale
 * `activeIngredients` data lingers from parsing — the empty confirmed array
 * must win and render zero active badges — Story 1 AC3.
 */
export function makeExplicitNoActivesProduct(overrides: Partial<Product> = {}): Product {
  return makeProduct({
    activeTags: [],
    activeIngredients: [{ key: 'bha', displayName: 'BHA' }],
    ...overrides,
  });
}

/**
 * Single active tag for isolating one category-color bucket at a time
 * (Story 2). `displayName` is irrelevant — labels come from the mocked
 * ACTIVE_INGREDIENT_LABELS map in the test file, not from this field.
 */
export function makeSingleActiveProduct(
  key: ActiveIngredientKey,
  overrides: Partial<Product> = {},
): Product {
  return makeProduct({
    activeTags: [key],
    activeIngredients: [{ key, displayName: key }],
    ...overrides,
  });
}

/**
 * 4 actives spanning all 3 hued categories plus the neutral "other" bucket —
 * Story 4 (many-actives / no "+N" overflow indicator).
 */
export function makeFourActiveProduct(overrides: Partial<Product> = {}): Product {
  const keys: ActiveIngredientKey[] = ['bha', 'niacinamide', 'ceramides', 'spf_filters'];
  return makeProduct({
    activeTags: keys,
    activeIngredients: keys.map((key) => ({ key, displayName: key })),
    ...overrides,
  });
}
