/**
 * Shared fixtures — EU Fragrance Allergen Detection
 * Spec: docs/specs/vials-eu-allergen-detection.md
 * Tech design: docs/tech-design/vials-eu-allergen-detection.md
 *   (FE-2 DetectedAllergenMatch / Product.detectedAllergens / Product.allergenListVersion,
 *    FE-4 AllergenBadge, FE-5/FE-6 wiring, FE-7 ProductDetailScreen "Allergens" card)
 *
 * `DetectedAllergenMatch` is a type-only import, so its absence from
 * `src/types/index.ts` today (pre-FE-2) does not break these fixtures at Jest
 * runtime (babel strips `import type` entirely) — it DOES fail `npx tsc
 * --noEmit`, which is the expected/correct red signal until FE-2 lands. Same
 * pattern as tests/conflict-matrix-expansion's not-yet-shipped
 * `isPhysicalExfoliant` field.
 */
import type { ProductShelfCardProps } from '@/components/product/ProductShelfCard';
import type { DetectedAllergenMatch, Product } from '@/types';

// ─── Allergen match fixtures ────────────────────────────────────────────────────
// Canonical names mirror the two restricted seed entries named explicitly in the
// tech design (Lilial, Lyral/HICC) and two ordinary EU Annex III names
// (Linalool, Limonene) for the non-restricted cases — content-verification of
// the real 26-entry seed is FE-1/FE-9's scope (engineer), not this suite's.

export const NON_RESTRICTED_MATCH_A: DetectedAllergenMatch = { canonical: 'Linalool', restricted: false };
export const NON_RESTRICTED_MATCH_B: DetectedAllergenMatch = { canonical: 'Limonene', restricted: false };
export const RESTRICTED_MATCH_LILIAL: DetectedAllergenMatch = { canonical: 'Lilial', restricted: true };
export const RESTRICTED_MATCH_LYRAL: DetectedAllergenMatch = { canonical: 'Lyral (HICC)', restricted: true };

export function makeAllergenMatch(overrides: Partial<DetectedAllergenMatch> = {}): DetectedAllergenMatch {
  return { ...NON_RESTRICTED_MATCH_A, ...overrides };
}

// ─── Product fixture ─────────────────────────────────────────────────────────────

export function makeProduct(overrides: Partial<Product> = {}): Product {
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

// ─── ProductShelfCard prop factory ───────────────────────────────────────────────

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

// ─── Render-tree order helpers ───────────────────────────────────────────────────
// Used to assert relative render order (e.g. the "Allergens" card between
// "Active Ingredients" and "Full Ingredient List", or the allergen badge
// rendering AFTER the existing zap actives badge) without asserting exact
// pixel layout.

type RNTestNode =
  | {
      type?: string;
      props?: Record<string, unknown>;
      children?: (RNTestNode | string)[] | null;
    }
  | null
  | undefined;

/** Depth-first collects, in render order, the testIDs (from `ids`) found in the tree. */
export function collectTestIdOrder(node: RNTestNode, ids: Set<string>, acc: string[] = []): string[] {
  if (!node) return acc;
  const testID = node.props?.testID as string | undefined;
  if (testID && ids.has(testID)) acc.push(testID);
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      if (typeof child !== 'string') collectTestIdOrder(child, ids, acc);
    }
  }
  return acc;
}

/** Depth-first collects, in render order, any exact-match strings (from `targets`) found as text content. */
export function collectTextOrder(node: RNTestNode, targets: Set<string>, acc: string[] = []): string[] {
  if (!node) return acc;
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      if (typeof child === 'string') {
        if (targets.has(child)) acc.push(child);
      } else {
        collectTextOrder(child, targets, acc);
      }
    }
  }
  return acc;
}
