/**
 * Explore Composition flow — Shelf comparison (Story 6, 2026-08-26 decision
 * batch, FE-10). docs/tech-design/explore-composition.md §3 FE-10.
 *
 * Pure: filters `products` to the captured `category` only (spec §5 —
 * "nothing else, no corpus/aggregate data") and reuses the already-shipped
 * `resolveFromProduct → joinActiveKeys → buildCapabilities` pipeline plus
 * `tokenizeIngredientsText` for each same-category Shelf item's own stats —
 * no new detection logic anywhere in this file. Rendering/copy (including the
 * zero-items message) is intentionally left to the presentational component
 * (`CompositionComparisonMatrix.tsx`) — this module only returns raw numbers.
 *
 * Pure module: no React, no react-native, no store, no I/O
 * (.claude/rules/architecture-review.md §2).
 */
import type { ActiveIngredientKey, Product, ProductType } from '@/types';
import { buildCapabilities } from '@/utils/productProfile/capabilities';
import { joinActiveKeys } from '@/utils/productProfile/join';
import {
  resolveFromProduct,
  tokenizeIngredientsText,
  type ResolvedIngredients,
} from '@/utils/productProfile/resolve';

/**
 * This composition's own already-computed stats (FE-4/FE-14 compute these
 * once for the Functional Profile tags / ingredient list — never recomputed
 * here).
 */
export interface ThisCompositionStats {
  functionalTagCount: number;
  ingredientCount: number;
  activeKeys: ActiveIngredientKey[];
}

export interface ShelfComparisonResult {
  category: ProductType;
  /** Count of `productsStore` items matching `category` — the comparison population size. */
  sameCategoryCount: number;
  /**
   * Count of same-category items that "have ingredient data" — a non-null,
   * non-empty (after trim) `fullIngredientText` — the denominator for both
   * numeric averages below (2026-08-26 tech-lead fix). Distinct from
   * `sameCategoryCount`, which still reflects the full same-category
   * population and drives the Category row's "N on your Shelf" display.
   */
  sameCategoryWithDataCount: number;
  thisFunctionalTagCount: number;
  /** 0 when `sameCategoryWithDataCount` is 0 — the caller renders that as "no data available", not a real zero score. */
  shelfFunctionalTagAverage: number;
  thisIngredientCount: number;
  /** 0 when `sameCategoryWithDataCount` is 0 — same convention as the average above. */
  shelfIngredientCountAverage: number;
  thisActiveKeys: ActiveIngredientKey[];
  /** Count of same-category Shelf items sharing at least one active tag with this composition. */
  shelfActiveTagOverlapCount: number;
}

/** The same distinct-capability count already driving the Functional Profile tag list. */
function countFunctionalTags(resolved: ResolvedIngredients): number {
  const classFacts = joinActiveKeys(resolved.resolvedActiveKeys, resolved.potencyByKey);
  const capabilities = buildCapabilities(resolved.resolvedActiveKeys, classFacts);
  return Object.values(capabilities).filter((c) => c.score !== null && c.score > 0).length;
}

/** Non-null, non-empty (after trim) `fullIngredientText` — same convention used elsewhere for "is there real text here." */
function hasIngredientData(product: Product): boolean {
  return typeof product.fullIngredientText === 'string' && product.fullIngredientText.trim().length > 0;
}

/**
 * Builds the 4-parameter Shelf comparison for a captured composition.
 * `products` is filtered to `category` only (spec Story 6 AC2/AC7). A
 * same-category item with no recorded ingredient data (`fullIngredientText`
 * null, or empty/whitespace after trim) is excluded from the denominator of
 * both numeric averages — it is never averaged in as a real 0, since that
 * would silently drag the average toward zero over a population with no
 * actual data for it (2026-08-26 tech-lead fix; see
 * `sameCategoryWithDataCount` for how many items actually contributed).
 * `sameCategoryCount` (the full same-category population) is unaffected.
 */
export function buildShelfComparison(
  category: ProductType,
  thisComposition: ThisCompositionStats,
  products: Product[],
): ShelfComparisonResult {
  const sameCategoryProducts = products.filter((p) => p.productType === category);
  const sameCategoryCount = sameCategoryProducts.length;

  let shelfFunctionalTagAverage = 0;
  let shelfIngredientCountAverage = 0;
  let shelfActiveTagOverlapCount = 0;
  let sameCategoryWithDataCount = 0;

  if (sameCategoryCount > 0) {
    const thisActiveKeySet = new Set(thisComposition.activeKeys);
    let functionalTagTotal = 0;
    let ingredientCountTotal = 0;

    for (const product of sameCategoryProducts) {
      const resolved = resolveFromProduct(product);
      if (resolved.resolvedActiveKeys.some((key) => thisActiveKeySet.has(key))) {
        shelfActiveTagOverlapCount += 1;
      }

      if (!hasIngredientData(product)) {
        continue;
      }
      sameCategoryWithDataCount += 1;
      functionalTagTotal += countFunctionalTags(resolved);
      ingredientCountTotal += tokenizeIngredientsText(product.fullIngredientText ?? '').length;
    }

    if (sameCategoryWithDataCount > 0) {
      shelfFunctionalTagAverage = functionalTagTotal / sameCategoryWithDataCount;
      shelfIngredientCountAverage = ingredientCountTotal / sameCategoryWithDataCount;
    }
  }

  return {
    category,
    sameCategoryCount,
    sameCategoryWithDataCount,
    thisFunctionalTagCount: thisComposition.functionalTagCount,
    shelfFunctionalTagAverage,
    thisIngredientCount: thisComposition.ingredientCount,
    shelfIngredientCountAverage,
    thisActiveKeys: thisComposition.activeKeys,
    shelfActiveTagOverlapCount,
  };
}
