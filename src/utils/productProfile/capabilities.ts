/**
 * Product Profile builder — Stage 3: Capability Aggregation (Milestone 1 slice).
 * docs/tasks/product_profile/02-profile-builder.md §6,
 * docs/tasks/product_profile/03-capabilities.md §1–2.
 *
 * Only Barrier Repair and Exfoliation are scored this milestone — the two
 * capabilities with a single unambiguous boolean `actives.json` property
 * (`properties.barrierRepair` / `properties.exfoliating`), read directly, no
 * disagreeing taxonomy to choose between. The other 8 `CapabilityKey` values
 * ship as required-but-`insufficient_data` entries (spec §3 Non-Goals) —
 * Milestone 2 activates them against `03-capabilities.md`'s §0 interim
 * canonical source policy.
 *
 * Pure module: no React, no react-native, no store, no I/O.
 */
import type { ActiveIngredientKey, CapabilityKey, CapabilityScore } from '@/types';
import type { ClassFactsRecord } from '@/utils/productProfile/join';

/** All 10 capability keys — only the first two of this pair are scored in Milestone 1. */
const DETERMINISTIC_CAPABILITY_KEYS: readonly ('barrierRepair' | 'exfoliation')[] = [
  'barrierRepair',
  'exfoliation',
];

const ALL_CAPABILITY_KEYS: readonly CapabilityKey[] = [
  'hydration',
  'barrierRepair',
  'brightening',
  'pigmentation',
  'acneControl',
  'sebumRegulation',
  'antioxidantProtection',
  'soothing',
  'exfoliation',
  'antiAging',
];

const NOT_MODELED_CAVEAT = 'Not modeled in Milestone 1';

/**
 * Placeholder saturation constant (docs/tasks/product_profile/
 * 06-open-questions.md Q2): "3 contributing classes = fully saturated" is a
 * reasonable starting point, not a clinically validated cutoff — a product
 * decision deferred, not invented here.
 */
const SATURATION_COUNT = 3;

/** Per-capability boolean property this milestone reads directly off a class. */
const BOOLEAN_PROPERTY: Record<'barrierRepair' | 'exfoliation', 'barrierRepair' | 'exfoliating'> = {
  barrierRepair: 'barrierRepair',
  exfoliation: 'exfoliating',
};

function insufficientDataCapability(): CapabilityScore {
  return {
    score: null,
    confidence: 'insufficient_data',
    caveat: NOT_MODELED_CAVEAT,
    sourceRefs: [],
    contributingClasses: [],
  };
}

/**
 * Scores one of the two deterministic capabilities. `score: null` iff the
 * product has zero resolved active classes at all (true insufficient data —
 * we know nothing about this product's ingredients). A resolved product with
 * no *contributing* class for this specific capability gets a real
 * deterministic `0` — that is a claim ("this product does not support this
 * capability"), not a data gap (spec "insufficient-data handling").
 */
function scoreDeterministicCapability(
  key: 'barrierRepair' | 'exfoliation',
  hasAnyResolvedClass: boolean,
  classFacts: ClassFactsRecord[],
): CapabilityScore {
  if (!hasAnyResolvedClass) {
    return {
      score: null,
      confidence: 'insufficient_data',
      caveat: 'No resolved active classes to assess this capability from.',
      sourceRefs: [],
      contributingClasses: [],
    };
  }

  const property = BOOLEAN_PROPERTY[key];
  const contributingClasses: ActiveIngredientKey[] = classFacts
    .filter((record) => record.activeClass.properties[property] === true)
    .map((record) => record.key);

  return {
    score: Math.min(1, contributingClasses.length / SATURATION_COUNT),
    confidence: 'deterministic',
    sourceRefs: [`actives.json:properties.${property}`],
    contributingClasses,
  };
}

/**
 * Builds the full, required `capabilities` record (all 10 keys always
 * present, per spec §6) from the resolved active-class basis.
 */
export function buildCapabilities(
  resolvedActiveKeys: ActiveIngredientKey[],
  classFacts: ClassFactsRecord[],
): Record<CapabilityKey, CapabilityScore> {
  const hasAnyResolvedClass = resolvedActiveKeys.length > 0;

  const capabilities = {} as Record<CapabilityKey, CapabilityScore>;
  for (const key of ALL_CAPABILITY_KEYS) {
    capabilities[key] = insufficientDataCapability();
  }
  for (const key of DETERMINISTIC_CAPABILITY_KEYS) {
    capabilities[key] = scoreDeterministicCapability(key, hasAnyResolvedClass, classFacts);
  }
  return capabilities;
}
