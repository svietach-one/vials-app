/**
 * Product Profile builder — Stage 7: Routine Position.
 * docs/tasks/product_profile/02-profile-builder.md §10,
 * docs/tech-design/product-profile-m1.md FE-6.
 *
 * Reads the relocated `LAYERING_ORDER`/`RINSE_OFF_TYPES` data
 * (`src/constants/rulesets/productFacts.ts`, FE-2) instead of importing
 * `routineEngine/`-private files, per the binding rule in
 * `02-profile-builder.md` §10.
 *
 * Pure module: no React, no react-native, no store, no I/O.
 */
import { LAYERING_ORDER, RINSE_OFF_TYPES } from '@/constants/rulesets/productFacts';
import type { Period as RulesetPeriod } from '@/constants/rulesets/rulesetTypes';
import type { ProductType, RoutinePosition } from '@/types';
import type { ClassFactsRecord } from '@/utils/productProfile/join';

const PERIOD_LABEL: Record<RulesetPeriod, 'AM' | 'PM'> = { am: 'AM', pm: 'PM' };
const ALL_PERIODS: RulesetPeriod[] = ['am', 'pm'];

/**
 * Intersection of `allowedPeriods` across all present classes — mirrors
 * `routineEngine/productFacts.ts`'s `aggregateProperties` narrowing (a
 * product is only safely usable in a period every present class allows).
 * Present classes act as constraints, not additive options: with zero
 * present classes there is nothing constraining the band, so it starts (and
 * stays) at the full am+pm set.
 */
function intersectAllowedPeriods(classFacts: ClassFactsRecord[]): RulesetPeriod[] {
  let periods = ALL_PERIODS;
  for (const { activeClass } of classFacts) {
    periods = periods.filter((p) => activeClass.allowedPeriods.includes(p));
  }
  return periods;
}

/**
 * Merge rule for disagreeing `preferredPeriod` values (spec §10 finding — no
 * requirement-vs-preference field exists on `ActiveClass` beyond
 * `allowedPeriods` itself):
 * - A single-period `eligiblePeriods` result is the de-facto hard
 *   requirement and wins outright (mirrors
 *   `routineEngine/slotting.ts`'s `preferredPeriodFor`'s "only allowed
 *   period" case).
 * - Otherwise, if every present class with a `preferredPeriod` agrees, that
 *   value wins.
 * - Otherwise (zero preferences, or two+ disagreeing preferences with no
 *   allowedPeriods-derived requirement to break the tie): `null` — never a
 *   guessed priority order (01-product-profile.md §6, tech-design
 *   Assumption 2).
 */
function mergePreferredPeriod(
  eligiblePeriods: RulesetPeriod[],
  classFacts: ClassFactsRecord[],
): { preferredPeriod: 'AM' | 'PM' | null; disagreed: boolean } {
  if (eligiblePeriods.length === 1) {
    return { preferredPeriod: PERIOD_LABEL[eligiblePeriods[0]], disagreed: false };
  }

  const preferences = new Set(
    classFacts
      .map((record) => record.activeClass.preferredPeriod)
      .filter((p): p is RulesetPeriod => p !== undefined),
  );

  if (preferences.size === 0) return { preferredPeriod: null, disagreed: false };
  if (preferences.size === 1) {
    return { preferredPeriod: PERIOD_LABEL[[...preferences][0]], disagreed: false };
  }
  return { preferredPeriod: null, disagreed: true };
}

export function buildRoutinePosition(
  productType: ProductType,
  classFacts: ClassFactsRecord[],
): RoutinePosition {
  const eligiblePeriodsRaw = intersectAllowedPeriods(classFacts);
  const eligiblePeriods = eligiblePeriodsRaw.map((p) => PERIOD_LABEL[p]);
  const { preferredPeriod, disagreed } = mergePreferredPeriod(eligiblePeriodsRaw, classFacts);

  const layeringOrder = LAYERING_ORDER[productType] ?? null;
  const rinseOff = RINSE_OFF_TYPES.includes(productType);

  if (classFacts.length === 0) {
    return {
      eligiblePeriods,
      preferredPeriod,
      layeringOrder,
      rinseOff,
      confidence: 'insufficient_data',
      sourceRefs: [],
      caveat: 'No resolved active classes to derive eligible/preferred periods from.',
    };
  }

  const sourceRefs = ['constants/rulesets/productFacts.ts:LAYERING_ORDER'];
  if (disagreed) {
    const disagreeingKeys = classFacts
      .filter((r) => r.activeClass.preferredPeriod !== undefined)
      .map((r) => r.key)
      .join(', ');
    return {
      eligiblePeriods,
      preferredPeriod,
      layeringOrder,
      rinseOff,
      confidence: 'heuristic',
      sourceRefs,
      caveat: `preferredPeriod disagreement among present classes (${disagreeingKeys}) resolved to null — no allowedPeriods-derived requirement to break the tie.`,
    };
  }

  return {
    eligiblePeriods,
    preferredPeriod,
    layeringOrder,
    rinseOff,
    confidence: 'deterministic',
    sourceRefs,
  };
}
