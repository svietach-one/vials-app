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
 *   5. **explore-fit-signals (2026-09-14):** `makeGoalFitFinding`/
 *      `makeConditionCautionFinding` mirror `GoalFitFinding`/
 *      `ConditionCautionFinding` (tech design FE-1/FE-3) — types don't exist
 *      yet, same "expected to fail until the FE-task lands" convention as
 *      judgment call #1 above. `makeProfileLike`/`ProfileGoalConditionLike`
 *      give both result-screen test files one shared, typed shape for the
 *      `mockProfile` closure now that it must also carry `primaryGoal`/
 *      `secondaryGoal`/`skinConditions`, not just `skinType`.
 *   6. `collectRenderOrder` is a single depth-first walk that collects BOTH
 *      testID matches and exact-text matches into one ordered array — needed
 *      because the result-screen order spans one untagged section
 *      ("Functional profile", a plain text heading — `FunctionalProfileCard`
 *      carries no wrapper testID) and several testID-tagged ones
 *      (`detected-actives`, `skin-type-caution`, `goal-fit-card`,
 *      `composition-comparison-matrix`, `routine-placement`,
 *      `explore-result-disclaimer`). Two separate single-purpose collectors
 *      (as in tests/vials-eu-allergen-detection/fixtures.ts) would produce
 *      two independent arrays with no shared ordering signal between them.
 */
import type {
  ActiveIngredientKey,
  AdvisorySeverity,
  Product,
  ProductType,
  SkinConditionType,
  SkinGoal,
} from '@/types';
import type { ConditionCautionFinding } from '@/utils/productProfile/conditionCaution';
import type { GoalFitFinding } from '@/utils/productProfile/goalFit';
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

// ─── GoalFitFinding (new type, explore-fit-signals FE-1) ──────────────────────

export function makeGoalFitFinding(overrides: Partial<GoalFitFinding> = {}): GoalFitFinding {
  return {
    goal: 'acne',
    matchedKeys: ['niacinamide'],
    ...overrides,
  };
}

// ─── ConditionCautionFinding (new type, explore-fit-signals FE-3) ─────────────

export function makeConditionCautionFinding(
  overrides: Partial<ConditionCautionFinding> = {},
): ConditionCautionFinding {
  return {
    tag: 'azelaic_acid',
    conditions: ['eczema'],
    conditionLabels: ['Eczema / atopic dermatitis'],
    severity: 'low' as AdvisorySeverity,
    message:
      'Azelaic acid is usually well tolerated on eczema-prone skin. Some people notice mild tingling at first — introducing it gradually helps.',
    ...overrides,
  };
}

// ─── Profile-like fixture (primaryGoal/secondaryGoal/skinConditions reads, FE-5) ──
// Both `ExploreCompositionResultScreen.test.tsx` and
// `WishlistEntryDetailScreen.test.tsx` reassign a closure-captured
// `mockProfile` per test case (see each file's own `let mockProfile = ...`).
// This factory gives both files one shared, typed default shape so a new
// profile field added here (or by a future task) needs updating in one
// place, not two.

export interface ProfileGoalConditionLike {
  skinType: 'oily' | 'dry' | 'combination' | 'normal' | null;
  primaryGoal: SkinGoal;
  secondaryGoal: SkinGoal | null;
  skinConditions: SkinConditionType[];
}

export function makeProfileLike(
  overrides: Partial<ProfileGoalConditionLike> = {},
): ProfileGoalConditionLike {
  return {
    skinType: null,
    primaryGoal: 'maintenance',
    secondaryGoal: null,
    skinConditions: [],
    ...overrides,
  };
}

// ─── Render-tree order helper (judgment call #6) ───────────────────────────────

type RNTestNode =
  | {
      type?: string;
      props?: Record<string, unknown>;
      children?: (RNTestNode | string)[] | null;
    }
  | null
  | undefined;

/**
 * Depth-first collects, in true render order, every testID (from `testIds`)
 * and every exact-match text node (from `texts`) found in the tree, merged
 * into one array — so a testID-tagged section and a plain-text heading can be
 * asserted relative to each other without two separately-ordered lists.
 */
export function collectRenderOrder(
  node: RNTestNode,
  testIds: Set<string>,
  texts: Set<string>,
  acc: string[] = [],
): string[] {
  if (!node) return acc;
  const testID = node.props?.testID as string | undefined;
  if (testID && testIds.has(testID)) acc.push(testID);
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      if (typeof child === 'string') {
        if (texts.has(child)) acc.push(child);
      } else {
        collectRenderOrder(child, testIds, texts, acc);
      }
    }
  }
  return acc;
}
