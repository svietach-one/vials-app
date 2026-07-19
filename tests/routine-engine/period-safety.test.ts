/**
 * Period-safety property tests (V2.1 phase-02 §2.2 / phase-09 suite 3).
 *
 * The invariant under protection: no generated plan, for any input, places a
 * PM-only class family in the morning. The production guard has existed since
 * V2 (resolve.ts gates every relocation on periodsForProduct, and
 * productFacts intersects each class's allowedPeriods), but nothing in the
 * suite would have caught a regression in that aggregation until now.
 *
 * Under the 2026-07-17 §4.2 ruling the PM-only families are retinoid, AHA and
 * BHA — "no acid in AM, ever" is deliberately unconditional so it stays
 * property-testable without conditional states (a planned SPF step is not
 * verifiable protection on skin and cannot gate a safety exception).
 *
 * Deterministic: seeded mulberry32 shelves from fixtures.ts, pinned NOW and
 * seasonMask per iteration — no Math.random anywhere.
 */
import type { ActiveIngredientKey } from '@/types';
import { generatePlan } from '@/utils/routineEngine/generate';
import { getDailyView } from '@/utils/routineEngine/dailyView';
import {
  makeEngineInput,
  makeRng,
  makeSeasonMask,
  NOW,
  randomConcerns,
  randomFitzpatrick,
  randomShelf,
  routinesFromPlan,
} from './fixtures';

const SEASONS = ['winter', 'spring', 'summer', 'autumn'] as const;

/** The class families locked to PM by allowedPeriods (§4.2 ruling). */
const PM_ONLY_KEYS: ActiveIngredientKey[] = ['retinoid', 'retinol', 'aha', 'bha'];

function pmOnlyProductIds(tagsById: Map<string, ActiveIngredientKey[]>): Set<string> {
  const ids = new Set<string>();
  for (const [productId, tags] of tagsById) {
    if (tags.some((t) => PM_ONLY_KEYS.includes(t))) ids.add(productId);
  }
  return ids;
}

describe('Period safety: no retinoid, AHA, or BHA ever reaches an AM period', () => {
  it('holds across 100 seeded randomized shelves, every season and fitzpatrick', () => {
    for (let seed = 0; seed < 100; seed += 1) {
      const rng = makeRng(seed * 17 + 3);
      const { products, tagsById } = randomShelf(rng, 4 + Math.floor(rng() * 8));
      const forbidden = pmOnlyProductIds(tagsById);

      const plan = generatePlan(
        makeEngineInput(products, {
          profile: { fitzpatrick: randomFitzpatrick(rng), concerns: randomConcerns(rng) },
          seasonMask: makeSeasonMask(SEASONS[seed % SEASONS.length]),
        }),
      );

      for (const step of plan.periods.morning) {
        expect({ seed, productId: step.productId, inAm: forbidden.has(step.productId) }).toEqual({
          seed,
          productId: step.productId,
          inAm: false,
        });
      }
    }
  });

  it('holds when every PM-only product is user-pinned to morning usage', () => {
    // Adversarial shelf: usageTime "morning" on a retinoid/AHA/BHA product
    // makes its allowedPeriods intersection empty — the engine must freeze it
    // (no_allowed_period), never "rescue" it into AM.
    for (let seed = 0; seed < 25; seed += 1) {
      const rng = makeRng(seed * 29 + 11);
      const { products, tagsById } = randomShelf(rng, 6);
      const forbidden = pmOnlyProductIds(tagsById);
      const pinned = products.map((p) =>
        forbidden.has(p.id) ? { ...p, usageTime: 'morning' as const } : p,
      );

      const plan = generatePlan(makeEngineInput(pinned));

      const scheduled = new Set(
        [...plan.periods.morning, ...plan.periods.evening].map((s) => s.productId),
      );
      for (const id of forbidden) {
        expect({ seed, id, scheduled: scheduled.has(id) }).toEqual({ seed, id, scheduled: false });
        expect(plan.frozen.map((f) => f.productId)).toContain(id);
      }
    }
  });

  it('holds through the daily view — the rendered day never shows a PM-only class in AM', () => {
    // The plan is one layer; the day the user actually sees is another. Save
    // each generated plan as routines and render today's view over them.
    for (let seed = 0; seed < 25; seed += 1) {
      const rng = makeRng(seed * 41 + 7);
      const { products, tagsById } = randomShelf(rng, 8);
      const forbidden = pmOnlyProductIds(tagsById);
      const plan = generatePlan(makeEngineInput(products));

      const views = getDailyView(routinesFromPlan(plan), products, {
        procedures: [],
        profile: { fitzpatrick: null },
        seasonMask: makeSeasonMask(),
        now: NOW,
      });
      const morning = views.find((v) => v.timeOfDay === 'morning');
      for (const step of morning?.steps ?? []) {
        const inAm = step.productId !== null && forbidden.has(step.productId);
        expect({ seed, productId: step.productId, inAm }).toEqual({
          seed,
          productId: step.productId,
          inAm: false,
        });
      }
    }
  });
});
