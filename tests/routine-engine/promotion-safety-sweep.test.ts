/**
 * Promotion-focused property sweep (tech-lead re-review 2026-10-14, W4).
 *
 * Widening `RANDOM_PRODUCT_TYPES` was NOT enough: run against the pre-fix
 * engine, `determinism-and-safety`, `explainability-invariant` and
 * `seasonal-masks` all still passed, so the only guard on the pair-rule bypass
 * was a single hand-written regression case. This sweep is shaped so the fill
 * is always in play — a pre_cleanse step on every shelf, 2-5 cleansers, and
 * active-bearing products to collide with — which reproduces the original
 * BLOCKER within ~1,000 seeds.
 */
import type { ActiveIngredientKey, FitzpatrickType, Product, SkinGoal } from '@/types';
import { generatePlan } from '@/utils/routineEngine/generate';
import { validateRoutines } from '@/utils/routineEngine/validate';
import {
  makeEngineInput,
  makeProduct,
  makeRng,
  makeSeasonMask,
  NOW,
  resetFixtureCounters,
  routinesFromPlan,
} from './fixtures';

const TAGS: ActiveIngredientKey[] = [
  'retinoid', 'aha', 'bha', 'pha', 'vitamin_c_pure', 'vitamin_c_derivative',
  'niacinamide', 'benzoyl_peroxide', 'azelaic_acid', 'copper_peptides',
  'ceramides', 'hyaluronic_acid', 'panthenol', 'cica',
];
const GOALS: SkinGoal[] = [
  'maintenance', 'acne', 'pigmentation', 'aging', 'dehydration', 'barrier_repair', 'oil_control',
];
const FITZ: (FitzpatrickType | null)[] = [null, 1, 2, 3, 4, 5, 6];
const SEASONS = ['winter', 'spring', 'summer', 'autumn'] as const;
const USAGE = ['morning', 'evening', 'both', 'both', 'both'] as const;
const OTHER_TYPES = ['serum', 'serum', 'gel', 'cream', 'toner', 'essence', 'moisturizer', 'lotion', 'balm'] as const;

const SEEDS = 1500;

/** Evening cleanser steps the admission ladder never admitted — i.e. the ones
 *  `fillPreCleanseGapFromAlternatives` promoted out of `slotAlternatives`. */
function promotedCleansers(plan: ReturnType<typeof generatePlan>) {
  const admittedPm = new Set(
    plan.decisions.filter((d) => d.action === 'admit' && d.period === 'pm').map((d) => d.productId),
  );
  return plan.periods.evening.filter(
    (s) => s.productType === 'cleanser' && !admittedPm.has(s.productId),
  );
}

function buildShelf(seed: number): { products: Product[]; profile: Parameters<typeof makeEngineInput>[1] } {
  const rng = makeRng(seed * 104729 + 7);
  const pick = <T,>(a: readonly T[]): T => a[Math.floor(rng() * a.length)];
  const tags = (max: number): ActiveIngredientKey[] => {
    const out: ActiveIngredientKey[] = [];
    const n = Math.floor(rng() * (max + 1));
    for (let i = 0; i < n; i += 1) {
      const t = pick(TAGS);
      if (!out.includes(t)) out.push(t);
    }
    return out;
  };

  const products: Product[] = [];
  let id = 0;
  const add = (productType: Product['productType'], activeTags: ActiveIngredientKey[], usageTime: Product['usageTime']) =>
    products.push(
      makeProduct({
        id: `p${id++}`,
        name: `P${id}`,
        productType,
        activeTags,
        usageTime,
        addedAt: `2026-0${1 + Math.floor(rng() * 6)}-${String(1 + Math.floor(rng() * 27)).padStart(2, '0')}`,
      }),
    );

  add('makeup_remover', [], 'both'); // guarantees a pre_cleanse step, so the fill is always reachable
  const cleansers = 2 + Math.floor(rng() * 4);
  for (let i = 0; i < cleansers; i += 1) add('cleanser', tags(2), pick(USAGE));
  const others = 1 + Math.floor(rng() * 4);
  for (let i = 0; i < others; i += 1) add(pick(OTHER_TYPES), tags(2), pick(USAGE));

  return {
    products,
    profile: {
      now: NOW,
      profile: {
        fitzpatrick: pick(FITZ),
        concerns: [],
        primaryGoal: pick(GOALS),
        secondaryGoal: null,
      },
      seasonMask: makeSeasonMask(pick(SEASONS)),
    },
  };
}

describe('promoted cleansers never introduce a conflict the plan itself would flag', () => {
  beforeEach(() => resetFixtureCounters());

  it(`holds across ${SEEDS} promotion-shaped shelves, and promotion actually fires`, () => {
    let runsWithPromotion = 0;
    const offenders: string[] = [];

    for (let seed = 0; seed < SEEDS; seed += 1) {
      const { products, profile } = buildShelf(seed);
      const input = makeEngineInput(products, profile);
      const plan = generatePlan(input);

      const promoted = promotedCleansers(plan);
      if (promoted.length === 0) continue;
      runsWithPromotion += 1;

      const promotedIds = new Set(promoted.map((s) => s.productId));
      // Evening only: the fill never touches the morning period, and the same
      // product can legitimately be an ordinary AM admission while being a
      // promoted PM step. Without this filter the sweep reports pre-existing
      // morning findings as promotion damage (seed 306 is one such shelf).
      const bad = validateRoutines(routinesFromPlan(plan), input).findings.filter(
        (f) => f.routineId === 'routine-evening' && f.productIds.some((p) => promotedIds.has(p)),
      );
      if (bad.length > 0) {
        offenders.push(
          `seed ${seed}: ${bad.map((f) => `${f.severity}:${f.reasonCode}:${f.productIds.join('&')}`).join(', ')}`,
        );
      }
    }

    // Guard against the sweep silently going vacuous if selection changes.
    expect(runsWithPromotion).toBeGreaterThan(50);
    expect(offenders).toEqual([]);
  });
});
