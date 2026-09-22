/**
 * Product Profile builder — Stage 3: Capability Aggregation.
 * docs/tasks/product_profile/02-profile-builder.md §6,
 * docs/tasks/product_profile/03-capabilities.md §1–2, §0a.
 *
 * Milestone 1 scored Barrier Repair and Exfoliation — the two capabilities
 * with a single unambiguous boolean `actives.json` property, no disagreeing
 * taxonomy to choose between.
 *
 * Milestone 2 (2026-08-06 reconciliation) activates four more — Hydration,
 * Brightening, Pigmentation, Soothing — against `03-capabilities.md`'s §0
 * interim canonical source policy and §0a's double-counting rule. These
 * ship `heuristic`, not `deterministic` (other taxonomies in the codebase
 * still disagree with the chosen source — see §0), and every one of them
 * carries `03-capabilities.md`'s "approved for testing, pending
 * dermatologist sign-off (PRD_Spec.md §6)" caveat — none of this is a
 * final clinical decision.
 *
 * Acne Control stays unimplemented per the standing hold in
 * `03-capabilities.md` §0a — the niacinamide double-counting exclusion
 * there is a clinical judgment call, not yet confirmed.
 *
 * The remaining 4 (Sebum Regulation, Antioxidant Protection, Anti-aging —
 * plus Acne Control above) ship as required-but-`insufficient_data`
 * entries (spec §3 Non-Goals).
 *
 * Pure module: no React, no react-native, no store, no I/O.
 */
import type { ActiveIngredientKey, CapabilityKey, CapabilityScore } from '@/types';
import type { ClassFactsRecord } from '@/utils/productProfile/join';

/** The two capabilities read directly off a single boolean `actives.json` property. */
const DETERMINISTIC_CAPABILITY_KEYS: readonly ('barrierRepair' | 'exfoliation')[] = [
  'barrierRepair',
  'exfoliation',
];

type MembershipCapabilityKey = 'hydration' | 'brightening' | 'pigmentation' | 'soothing';

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

const CLINICAL_REVIEW_CAVEAT_SUFFIX =
  'pending dermatologist sign-off — PRD_Spec.md §6. Not a final clinical decision.';

/**
 * Fixed ingredient-key membership per reconciled capability
 * (docs/tasks/product_profile/03-capabilities.md §3/§4/§5/§9, 2026-08-06).
 * Each list is `actives.json`'s `concerns`/`goals` membership for that
 * capability, adjusted per §0a's double-counting rule where applicable.
 */
const MEMBERSHIP_CAPABILITY_SOURCES: Record<
  MembershipCapabilityKey,
  { keys: readonly ActiveIngredientKey[]; sourceRef: string; caveat: string }
> = {
  // concerns:dryness — a strict superset of goals.dehydration (adds panthenol),
  // verified across all 20 actives.json classes; §3.
  hydration: {
    keys: ['hyaluronic_acid', 'glycerin_class', 'ceramides', 'panthenol'],
    sourceRef: 'actives.json:concerns.dryness',
    caveat: `Reconciled from actives.json concerns:dryness (2026-08-06); ${CLINICAL_REVIEW_CAVEAT_SUFFIX}`,
  },
  // goals.pigmentation with retinoid excluded — already credited via Acne
  // Control/Anti-aging/Exfoliation, and unsupported by retinoid's own
  // concerns field (§0a, §4).
  brightening: {
    keys: ['vitamin_c_pure', 'vitamin_c_derivative', 'azelaic_acid', 'aha', 'niacinamide'],
    sourceRef: 'actives.json:goals.pigmentation',
    caveat: `Reconciled from actives.json goals.pigmentation with retinoid excluded per §0a (2026-08-06); ${CLINICAL_REVIEW_CAVEAT_SUFFIX}`,
  },
  // Carried forward from Brightening, byte-identical — option (a), a "no
  // evidence to diverge yet" call, not a "clinically identical" one. See
  // §5's open item on whether retinoid should eventually differ here.
  pigmentation: {
    keys: ['vitamin_c_pure', 'vitamin_c_derivative', 'azelaic_acid', 'aha', 'niacinamide'],
    sourceRef: 'actives.json:goals.pigmentation',
    caveat: `Reconciled from actives.json goals.pigmentation with retinoid excluded, copied from Brightening per §5 option (a) (2026-08-06); ${CLINICAL_REVIEW_CAVEAT_SUFFIX}`,
  },
  // concerns:redness — confirmed as the exact intersection of actives.json
  // and labels.ts with zero divergence; activeBadges.ts's peptide swap-in
  // and skinConditionModifiers.ts's ceramides/glycerin_class addition were
  // both reviewed and explicitly rejected (§9).
  soothing: {
    keys: ['cica', 'panthenol', 'niacinamide', 'azelaic_acid'],
    sourceRef: 'actives.json:concerns.redness',
    caveat: `Reconciled from actives.json concerns:redness (2026-08-06); ${CLINICAL_REVIEW_CAVEAT_SUFFIX}`,
  },
};

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
 * Scores one of the four reconciled membership-based capabilities.
 * `score: null` iff the product has zero resolved active classes at all
 * (true insufficient data). A resolved product with no contributing class
 * for this specific capability gets a real `heuristic` `0` — a claim, not a
 * data gap — same convention as {@link scoreDeterministicCapability}.
 */
function scoreMembershipCapability(
  source: { keys: readonly ActiveIngredientKey[]; sourceRef: string; caveat: string },
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

  const contributingClasses: ActiveIngredientKey[] = classFacts
    .filter((record) => source.keys.includes(record.key))
    .map((record) => record.key);

  return {
    score: Math.min(1, contributingClasses.length / SATURATION_COUNT),
    confidence: 'heuristic',
    caveat: source.caveat,
    sourceRefs: [source.sourceRef],
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
  for (const key of Object.keys(MEMBERSHIP_CAPABILITY_SOURCES) as MembershipCapabilityKey[]) {
    capabilities[key] = scoreMembershipCapability(
      MEMBERSHIP_CAPABILITY_SOURCES[key],
      hasAnyResolvedClass,
      classFacts,
    );
  }
  return capabilities;
}
