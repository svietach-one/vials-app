/**
 * Shared fixtures for the vials-conflict-matrix-expansion QA suite.
 * Spec: docs/specs/vials-conflict-matrix-expansion.md
 * Tech design: docs/tech-design/vials-conflict-matrix-expansion.md
 *
 * Factory return types are annotated with the real domain/component prop
 * types (testing.md), so prop drift fails `tsc` rather than only the test
 * run. `makeProduct`'s `overrides` accepting `isPhysicalExfoliant` (FE-1) is
 * intentional: until that field lands on `Product`, this file — and every
 * test that imports it — fails to compile. That is the expected red state
 * for a QA suite written ahead of implementation.
 */
import type { ConflictWarningInlineProps } from '@/components/routine/ConflictWarningInline';
import type { ActiveIngredientKey, Product, RoutineStep } from '@/types';

let idCounter = 0;
const nextId = () => `cmex-${++idCounter}`;

export function makeProduct(
  keys: ActiveIngredientKey[] = [],
  overrides: Partial<Product> = {},
): Product {
  return {
    id: nextId(),
    name: `Product ${idCounter}`,
    brand: null,
    productType: 'serum',
    imageUrl: null,
    activeIngredients: keys.map((key) => ({ key, displayName: key })),
    fullIngredientText: null,
    usageTime: 'both',
    openBeautyFactsId: null,
    addedAt: '2026-01-01',
    notes: null,
    openedDate: null,
    paoMonths: null,
    spfValue: null,
    ...overrides,
  };
}

export function makeStep(productId: string, overrides: Partial<RoutineStep> = {}): RoutineStep {
  return {
    id: nextId(),
    productType: 'serum',
    productId,
    hidden: false,
    scheduledDays: [],
    ...overrides,
  };
}

/** Visible steps for one period — what ConflictWarningInline / detectConflicts actually take. */
export function makeVisibleSteps(products: Product[]): RoutineStep[] {
  return products.map((p) => makeStep(p.id, { productType: p.productType }));
}

export function makeConflictWarningInlineProps(
  overrides: Partial<ConflictWarningInlineProps> = {},
): ConflictWarningInlineProps {
  return {
    morningSteps: [],
    eveningSteps: [],
    products: [],
    skinConditions: [],
    ...overrides,
  };
}
