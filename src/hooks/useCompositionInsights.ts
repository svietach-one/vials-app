import { useMemo } from 'react';

import { LAYERING_ORDER } from '@/constants/rulesets/productFacts';
import { useProductsStore } from '@/store/productsStore';
import { useProfileStore } from '@/store/profileStore';
import { useRoutinesStore } from '@/store/routinesStore';
import type { ActiveIngredientKey, CapabilityKey, ProductType, SkinType } from '@/types';
import { buildCapabilities } from '@/utils/productProfile/capabilities';
import { joinActiveKeys } from '@/utils/productProfile/join';
import { getMorningSpfState, type MorningSpfState } from '@/utils/productProfile/morningSpfPresence';
import { labelForProduct } from '@/utils/productProfile/productLabel';
import { resolveFromRawText, tokenizeIngredientsText } from '@/utils/productProfile/resolve';
import { buildRoutinePosition } from '@/utils/productProfile/routinePosition';
import { buildShelfComparison, type ShelfComparisonResult } from '@/utils/productProfile/shelfComparison';
import { buildShelfOverlap, type SharedActive } from '@/utils/productProfile/shelfOverlap';
import { buildSkinTypeCaution, type SkinTypeCautionResult } from '@/utils/productProfile/skinTypeCaution';
import type { RoutinePosition } from '@/types';

/**
 * Shared composition-insights pipeline (Story 9, tech design FE-18).
 *
 * Mirrors `useRoutineLinking.ts`'s convention (reads store state internally,
 * returns computed values for a screen to render). Re-runs — with no new
 * logic of its own — exactly the pipeline `ExploreCompositionResultScreen.tsx`
 * used to inline directly: `resolveFromRawText` -> `tokenizeIngredientsText`
 * -> `joinActiveKeys` -> `buildCapabilities` -> capability-tag filter ->
 * `buildSkinTypeCaution` -> `buildShelfComparison`/`buildRoutinePosition`
 * (both gated on `category !== null`, same rule the result screen already
 * established). Both `ExploreCompositionResultScreen` and the new
 * `WishlistEntryDetailScreen` call this one hook instead of each keeping a
 * parallel copy of the same computation (tech design's "reuse mechanism"
 * assumption).
 *
 * This hook does not own the null-`skinType` suppression of the caution
 * notice — same as `skinTypeCaution.ts` itself, that's the presentational
 * layer's job (`SkinTypeCautionNotice`/`CompositionInsightsSection`). It
 * simply exposes `skinType` alongside `skinTypeCaution` so the caller can.
 */

/** Same order the Wishlist tab's capability badges already use. */
const CAPABILITY_ORDER: CapabilityKey[] = [
  'barrierRepair',
  'exfoliation',
  'hydration',
  'brightening',
  'pigmentation',
  'acneControl',
  'sebumRegulation',
  'antioxidantProtection',
  'soothing',
  'antiAging',
];

export interface RoutineFit {
  /** Products already occupying the phase this composition maps to (`RoutinePosition.layeringOrder`). */
  occupants: Array<{ id: string; label: string }>;
  morningSpf: MorningSpfState;
}

export interface CompositionInsights {
  capabilityTags: CapabilityKey[];
  resolvedActiveKeys: ActiveIngredientKey[];
  /** Ordered comma-split ingredient tokens, verbatim from the captured text. */
  ingredientTokens: string[];
  /** `ingredientTokens.length`, exposed separately so consumers need not depend on the array. */
  ingredientCount: number;
  /** 1-based INCI position per resolved key; a key may be absent. */
  positionByKey: Partial<Record<ActiveIngredientKey, number>>;
  skinType: SkinType | null;
  skinTypeCaution: SkinTypeCautionResult | null;
  shelfComparison: ShelfComparisonResult | null;
  /** Which of this composition's actives already appear elsewhere on the whole Shelf — not category-gated. */
  shelfOverlap: SharedActive[];
  /** Total Shelf product count, regardless of category — distinguishes an empty Shelf from a same-category-empty one. */
  shelfProductCount: number;
  routinePosition: RoutinePosition | null;
  /** `null` when `category === null` — same gate as `routinePosition`. */
  routineFit: RoutineFit | null;
}

export function useCompositionInsights(
  rawIngredientsText: string,
  category: ProductType | null,
): CompositionInsights {
  const products = useProductsStore((s) => s.products);
  const profile = useProfileStore((s) => s.profile);
  const routines = useRoutinesStore((s) => s.routines);

  const resolved = useMemo(() => resolveFromRawText(rawIngredientsText), [rawIngredientsText]);

  // Ordered comma-split tokens — exposed on the public return value as
  // `ingredientTokens`/`ingredientCount` (explore-insights-v2 task 01), not
  // just an internal input to the "Ingredient count" matrix parameter below.
  const tokens = useMemo(() => tokenizeIngredientsText(rawIngredientsText), [rawIngredientsText]);

  const classFacts = useMemo(
    () => joinActiveKeys(resolved.resolvedActiveKeys, resolved.potencyByKey),
    [resolved.resolvedActiveKeys, resolved.potencyByKey],
  );

  const capabilities = useMemo(
    () => buildCapabilities(resolved.resolvedActiveKeys, classFacts),
    [resolved.resolvedActiveKeys, classFacts],
  );

  const capabilityTags = useMemo(
    () =>
      CAPABILITY_ORDER.filter((key) => {
        const score = capabilities[key].score;
        return score !== null && score > 0;
      }),
    [capabilities],
  );

  // Story 7 — fires independently of `category`; the caller owns the
  // null-`profile.skinType` suppression (skinTypeCaution.ts only knows about
  // resolved classes, not the profile).
  const skinTypeCaution = useMemo(() => buildSkinTypeCaution(classFacts), [classFacts]);

  // Story 6 — same gating rule as Story 8 below: only when a category was
  // captured. "Functional profile breadth" reuses `capabilityTags.length`
  // (the exact count already driving the tag list) rather than recomputing it.
  const shelfComparison = useMemo(() => {
    if (category === null) return null;
    return buildShelfComparison(
      category,
      {
        functionalTagCount: capabilityTags.length,
        ingredientCount: tokens.length,
        activeKeys: resolved.resolvedActiveKeys,
      },
      products,
    );
  }, [category, capabilityTags.length, tokens.length, resolved.resolvedActiveKeys, products]);

  // Story 8 — never called when `category` is `null` (same gate as the matrix).
  const routinePosition = useMemo(() => {
    if (category === null) return null;
    return buildRoutinePosition(category, classFacts);
  }, [category, classFacts]);

  // explore-insights-v2 task 04 — unlike shelfComparison, NOT gated on
  // category: a duplicate active is a duplicate regardless of the captured
  // composition's category.
  const shelfOverlap = useMemo(
    () => buildShelfOverlap(resolved.resolvedActiveKeys, products),
    [resolved.resolvedActiveKeys, products],
  );

  // explore-insights-v2 task 06 — same gate as routinePosition (`category === null` -> null).
  // Occupants are steps across ALL routines whose productType shares this
  // composition's layering slot (`LAYERING_ORDER`, e.g. serum/gel both slot
  // 6) — a phase, not a single ProductType. `morningSpf` is a SEPARATE rule
  // (`morningSpfPresence.ts`, absence-only, never `spfAdequacy.ts`'s
  // strength threshold) from the same `routines`/`products` data.
  const routineFit = useMemo((): RoutineFit | null => {
    if (category === null || routinePosition === null) return null;

    const targetPhase = routinePosition.layeringOrder;
    const occupants: Array<{ id: string; label: string }> = [];
    if (targetPhase !== null) {
      for (const routine of routines) {
        for (const step of routine.steps) {
          if (step.hidden || !step.productId) continue;
          if (LAYERING_ORDER[step.productType] !== targetPhase) continue;
          const product = products.find((p) => p.id === step.productId);
          if (!product || product.isHidden) continue;
          occupants.push({ id: product.id, label: labelForProduct(product) });
        }
      }
    }

    return { occupants, morningSpf: getMorningSpfState(routines, products) };
  }, [category, routinePosition, routines, products]);

  return {
    capabilityTags,
    resolvedActiveKeys: resolved.resolvedActiveKeys,
    ingredientTokens: tokens,
    ingredientCount: tokens.length,
    positionByKey: resolved.positionByKey,
    skinType: profile?.skinType ?? null,
    skinTypeCaution,
    shelfComparison,
    shelfOverlap,
    shelfProductCount: products.length,
    routinePosition,
    routineFit,
  };
}
