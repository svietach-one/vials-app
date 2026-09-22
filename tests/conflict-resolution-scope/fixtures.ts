/**
 * Shared fixtures for the conflict-resolution-scope QA suite (qa-lead).
 * Spec: docs/specs/conflict-resolution-scope.md
 * Tech design: docs/tech-design/conflict-resolution-scope.md
 *
 * Same factory shapes as tests/conflict-matrix-expansion/fixtures.ts, kept
 * local to this folder on purpose — this suite has no dependency on another
 * task's fixture file staying stable, and this task's pair (niacinamide +
 * peptide_signal) is unrelated to that suite's retinoid/acid/vitamin-C
 * fixtures.
 */
import type { ActiveIngredientKey, Product, RoutineStep } from '@/types';

let idCounter = 0;
const nextId = () => `crs-${++idCounter}`;

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

/** Escapes a string for safe use inside a `new RegExp(...)` text match. */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
