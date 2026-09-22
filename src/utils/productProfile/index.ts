/**
 * Product Profile builder — orchestration (FE-7).
 * docs/tasks/product_profile/02-profile-builder.md §3,
 * docs/tech-design/product-profile-m1.md §1–§2.
 *
 * Two entry points converge into one internal pipeline after stage 1:
 *   resolve (1) -> join (2) -> capabilities (3) -> irritation (5) ->
 *   sensitivity (6) -> routinePosition (7) -> this module's rollup.
 * Stage 4 (primary functions ranking) and stage 8 (strengths/weaknesses
 * synthesis) are Milestone 2/3 (spec Non-Goals §3) — `primaryFunctions`
 * stays `[]` and `strengthsWeaknesses` stays `null` here.
 *
 * Pure, synchronous, no `now` dependency. Never throws for a well-typed
 * `Product`/input; a malformed input (missing `productId`) throws
 * `TypeError` at the call boundary, same convention as other
 * `routineEngine/` entry points.
 *
 * Pure module: no React, no react-native, no store, no I/O
 * (.claude/rules/architecture-review.md §2).
 */
import type {
  ActiveIngredientKey,
  Product,
  ProductProfile,
  ProductType,
  ProfileConfidence,
} from '@/types';
import { buildCapabilities } from '@/utils/productProfile/capabilities';
import { buildIrritationProfile, buildSensitivityCompatibility } from '@/utils/productProfile/irritation';
import { joinActiveKeys } from '@/utils/productProfile/join';
import { resolveFromActiveKeys, resolveFromProduct, type ResolvedIngredients } from '@/utils/productProfile/resolve';
import { buildRoutinePosition } from '@/utils/productProfile/routinePosition';

export const BUILDER_VERSION = '1.0.0';

const CONFIDENCE_RANK: Record<ProfileConfidence, number> = {
  deterministic: 0,
  heuristic: 1,
  insufficient_data: 2,
};

/** Worst tier among the given confidence values — never an average (spec §7). */
function worstConfidence(values: ProfileConfidence[]): ProfileConfidence {
  return values.reduce<ProfileConfidence>(
    (worst, value) => (CONFIDENCE_RANK[value] > CONFIDENCE_RANK[worst] ? value : worst),
    'deterministic',
  );
}

interface Identity {
  productId: string;
  productType: ProductType;
  brand: string | null;
  name: string;
}

function assertValidIdentity(identity: Identity): void {
  if (!identity.productId) {
    throw new TypeError('buildProductProfile: productId is required');
  }
}

function buildFromResolved(
  identity: Identity,
  sourceInciText: string | null,
  resolved: ResolvedIngredients,
): ProductProfile {
  assertValidIdentity(identity);

  const classFacts = joinActiveKeys(resolved.resolvedActiveKeys, resolved.potencyByKey);
  const capabilities = buildCapabilities(resolved.resolvedActiveKeys, classFacts);
  const irritation = buildIrritationProfile(classFacts);
  const sensitivityCompatibility = buildSensitivityCompatibility();
  const routinePosition = buildRoutinePosition(identity.productType, classFacts);

  const overallConfidence = worstConfidence([
    ...Object.values(capabilities).map((c) => c.confidence),
    irritation.confidence,
    sensitivityCompatibility.confidence,
    routinePosition.confidence,
  ]);

  return {
    productId: identity.productId,
    productType: identity.productType,
    brand: identity.brand,
    name: identity.name,
    sourceInciText,
    resolvedActiveKeys: resolved.resolvedActiveKeys,
    unresolvedIngredientTokens: resolved.unresolvedIngredientTokens,
    primaryFunctions: [], // stage 4 — Milestone 2 (05-roadmap.md)
    capabilities,
    irritation,
    sensitivityCompatibility,
    routinePosition,
    strengthsWeaknesses: null, // stage 8 — Milestone 3
    builtAt: new Date().toISOString(),
    builderVersion: BUILDER_VERSION,
    overallConfidence,
  };
}

/** Entry point A — raw INCI text path (e.g. `ProductForm`'s manual-save flow). */
export function buildProductProfileFromProduct(product: Product): ProductProfile {
  const identity: Identity = {
    productId: product.id,
    productType: product.productType,
    brand: product.brand,
    name: product.name,
  };
  const resolved = resolveFromProduct(product);
  return buildFromResolved(identity, product.fullIngredientText ?? null, resolved);
}

export interface BuildFromActiveKeysInput {
  productId: string;
  productType: ProductType;
  brand: string | null;
  name: string;
  activeKeys: ActiveIngredientKey[];
}

/** Entry point B — resolved corpus path (already-parsed `activeKeys`). */
export function buildProductProfileFromActiveKeys(input: BuildFromActiveKeysInput): ProductProfile {
  const identity: Identity = {
    productId: input.productId,
    productType: input.productType,
    brand: input.brand,
    name: input.name,
  };
  const resolved = resolveFromActiveKeys(input.activeKeys);
  return buildFromResolved(identity, null, resolved);
}
