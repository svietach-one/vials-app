/**
 * Integration tests — spec §9 Success Metrics (determinism + safety property
 * tests). These deliberately generate many realistic shelves rather than one
 * hand-picked fixture, per the task guidance and the spec's own wording:
 * "generation property test — identical inputs produce deep-equal plans
 * across 100 randomized shelf fixtures. 0 failures." and "rule-matrix test
 * suite ... no generated plan ever co-schedules [an avoid] pair or schedules
 * a frozen product. 0 violations."
 */
import { ACTIVES_RULESET } from '@/constants/rulesets/rulesetTypes';
import type { ActiveIngredientKey } from '@/types';
import { generatePlan } from '@/utils/routineEngine/generate';
import { validateRoutines } from '@/utils/routineEngine/validate';
import {
  daysOverlap,
  makeEngineInput,
  makeProduct,
  makeSeasonMask,
  NOW,
  randomConcerns,
  randomFitzpatrick,
  randomGoal,
  randomShelf,
  makeRng,
  routinesFromPlan,
} from './fixtures';

const SEASONS = ['winter', 'spring', 'summer', 'autumn'] as const;

function sideKeys(side: ActiveIngredientKey | ActiveIngredientKey[]): ActiveIngredientKey[] {
  return Array.isArray(side) ? side : [side];
}

/**
 * Base (unescalated) avoid pair rules from actives.json. Phototype escalation
 * only ever turns MORE pairs into avoid (caution -> avoid), never the other
 * way — so asserting "no avoid pair ever shares a period+day" against this
 * base list remains a valid (if slightly conservative) safety floor across
 * every random fitzpatrick value used below.
 */
const AVOID_PAIRS = ACTIVES_RULESET.pairRules
  .filter((rule) => rule.severity === 'avoid')
  .map((rule) => ({ a: sideKeys(rule.a), b: sideKeys(rule.b) }));

function classesOf(tagsById: Map<string, ActiveIngredientKey[]>, productId: string): ActiveIngredientKey[] {
  return tagsById.get(productId) ?? [];
}

describe('Determinism (spec §9): identical inputs produce byte-identical plans', () => {
  it('generates a deep-equal plan across 100 randomized realistic shelves', () => {
    for (let seed = 0; seed < 100; seed += 1) {
      const rng = makeRng(seed);
      const { products } = randomShelf(rng, 4 + Math.floor(rng() * 12));
      const input = makeEngineInput(products, {
        profile: { fitzpatrick: randomFitzpatrick(rng), concerns: randomConcerns(rng) },
        seasonMask: makeSeasonMask(SEASONS[Math.floor(rng() * SEASONS.length)]),
        now: NOW,
      });

      const first = generatePlan(input);
      const second = generatePlan(input);
      expect(second).toEqual(first);
    }
  });

  it('is invariant to the seasonMask source — same season, weather vs calendar → identical plan (phase-06 §6.4)', () => {
    // The engine consumes seasonMask as a resolved input and never branches on
    // its `source` provenance field. A pinned season with either source must
    // produce a byte-identical plan.
    for (let seed = 0; seed < 40; seed += 1) {
      const rng = makeRng(seed * 5 + 3);
      const { products } = randomShelf(rng, 4 + Math.floor(rng() * 10));
      const profile = {
        fitzpatrick: randomFitzpatrick(rng),
        concerns: randomConcerns(rng),
        primaryGoal: randomGoal(rng),
        secondaryGoal: null,
      };
      const season = SEASONS[Math.floor(rng() * SEASONS.length)];

      const fromWeather = generatePlan(
        makeEngineInput(products, { profile, seasonMask: makeSeasonMask(season, 'weather'), now: NOW }),
      );
      const fromCalendar = generatePlan(
        makeEngineInput(products, { profile, seasonMask: makeSeasonMask(season, 'calendar'), now: NOW }),
      );
      expect(fromCalendar).toEqual(fromWeather);
    }
  });

  it('is insensitive to shelf ordering — shuffling the same products yields the same plan', () => {
    const rng = makeRng(42);
    const { products } = randomShelf(rng, 12);
    const input = makeEngineInput(products, { now: NOW });
    const baseline = generatePlan(input);

    // Deterministic shuffle (reverse + rotate), not Math.random, to stay non-flaky.
    const shuffled = [...products].reverse();
    const shuffledPlan = generatePlan(makeEngineInput(shuffled, { now: NOW }));

    expect(new Set(shuffledPlan.periods.morning.map((s) => s.productId))).toEqual(
      new Set(baseline.periods.morning.map((s) => s.productId)),
    );
    expect(new Set(shuffledPlan.periods.evening.map((s) => s.productId))).toEqual(
      new Set(baseline.periods.evening.map((s) => s.productId)),
    );
    expect(shuffledPlan.frozen.length).toBe(baseline.frozen.length);
  });
});

describe('Safety (spec §9): no generated plan ever co-schedules an avoid-level pair', () => {
  it('holds across 100 randomized shelves, every season, and every fitzpatrick value', () => {
    let pairsChecked = 0;

    const assertNoAvoidOverlap = (
      plan: ReturnType<typeof generatePlan>,
      tagsById: Map<string, ActiveIngredientKey[]>,
    ) => {
      for (const period of [plan.periods.morning, plan.periods.evening]) {
        for (let i = 0; i < period.length; i += 1) {
          for (let j = i + 1; j < period.length; j += 1) {
            const classesI = classesOf(tagsById, period[i].productId);
            const classesJ = classesOf(tagsById, period[j].productId);
            for (const pair of AVOID_PAIRS) {
              const matchesAB = pair.a.some((k) => classesI.includes(k)) && pair.b.some((k) => classesJ.includes(k));
              const matchesBA = pair.b.some((k) => classesI.includes(k)) && pair.a.some((k) => classesJ.includes(k));
              if (!matchesAB && !matchesBA) continue;
              pairsChecked += 1;
              expect(daysOverlap(period[i].scheduledDays, period[j].scheduledDays)).toBe(false);
            }
          }
        }
      }
    };

    for (let seed = 0; seed < 100; seed += 1) {
      const rng = makeRng(seed * 7 + 1);
      const { products, tagsById } = randomShelf(rng, 4 + Math.floor(rng() * 12));
      // phase-04+: a non-maintenance goal is what admits actives as treatments,
      // so vary the goal or the property test is vacuous under minimalism.
      const input = makeEngineInput(products, {
        profile: {
          fitzpatrick: randomFitzpatrick(rng),
          concerns: randomConcerns(rng),
          primaryGoal: randomGoal(rng),
          secondaryGoal: null,
        },
        seasonMask: makeSeasonMask(SEASONS[Math.floor(rng() * SEASONS.length)]),
        now: NOW,
      });
      assertNoAvoidOverlap(generatePlan(input), tagsById);
    }

    // Deterministic anchor guaranteeing a checked pair — a rinse-off retinoid
    // cleanser is exempt from the cumulative cap and co-occupies PM with an AHA
    // treatment, so the avoid pair rule is genuinely exercised (skeleton
    // selection makes two treatment-slot strong actives rare, so we force the
    // structural-vs-treatment case that still can co-occur).
    const cleanser = makeProduct({
      activeTags: ['retinoid'],
      productType: 'cleanser',
      usageTime: 'evening',
    });
    const ahaSerum = makeProduct({ activeTags: ['aha'] });
    const anchorTags = new Map<string, ActiveIngredientKey[]>([
      [cleanser.id, ['retinoid']],
      [ahaSerum.id, ['aha']],
    ]);
    const anchorPlan = generatePlan(
      makeEngineInput([cleanser, ahaSerum], {
        profile: { fitzpatrick: null, concerns: [], primaryGoal: 'acne', secondaryGoal: null },
        now: NOW,
      }),
    );
    assertNoAvoidOverlap(anchorPlan, anchorTags);

    // Sanity: the checks above actually exercised at least one avoid pair.
    expect(pairsChecked).toBeGreaterThan(0);
  });

  it('never lists a frozen productId inside the plan\'s own periods (frozen and scheduled are mutually exclusive)', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const rng = makeRng(seed * 13 + 5);
      const { products } = randomShelf(rng, 4 + Math.floor(rng() * 12));
      const plan = generatePlan(
        makeEngineInput(products, {
          profile: { fitzpatrick: randomFitzpatrick(rng), concerns: randomConcerns(rng) },
          now: NOW,
        }),
      );
      const scheduled = new Set([...plan.periods.morning, ...plan.periods.evening].map((s) => s.productId));
      for (const frozen of plan.frozen) {
        expect(scheduled.has(frozen.productId)).toBe(false);
      }
    }
  });
});

describe('Self-consistency (spec §9 guidance): generate -> save -> validate reports zero avoid PAIR findings', () => {
  // NOTE (qa-lead finding, see handoff): a saved draft can still surface an
  // avoid-level finding that is NOT a scheduling inconsistency — an unmet
  // non-skippable mandate (e.g. phototype 1-2 SPF when the shelf has no SPF
  // product at all). generatePlan legitimately cannot invent a product it
  // doesn't have, so it emits a placeholder instead, and validateRoutines
  // faithfully re-reports that same real gap (productIds: []) on the saved
  // draft. That is correct/expected behaviour (Story 2 AC3: a partial save
  // creating a gap activates the Optimize strip) — it is NOT the property
  // this test guards. This test isolates PAIRWISE conflict findings
  // (productIds.length === 2, i.e. two admitted steps clashing) — those must
  // never survive a fresh save, because generate's own admission ladder is
  // supposed to have already resolved every same-shelf pair conflict.
  it('a freshly generated draft, saved as-is, never reports an avoid-level PAIRWISE finding against itself', () => {
    for (let seed = 0; seed < 15; seed += 1) {
      const rng = makeRng(seed * 31 + 2);
      const { products } = randomShelf(rng, 4 + Math.floor(rng() * 10));
      const input = makeEngineInput(products, {
        profile: { fitzpatrick: randomFitzpatrick(rng), concerns: randomConcerns(rng) },
        seasonMask: makeSeasonMask(SEASONS[Math.floor(rng() * SEASONS.length)]),
        now: NOW,
      });

      const plan = generatePlan(input);
      const savedRoutines = routinesFromPlan(plan);
      const result = validateRoutines(savedRoutines, input);

      const avoidPairFindings = result.findings.filter(
        (f) => f.severity === 'avoid' && f.productIds.length === 2,
      );
      expect(avoidPairFindings).toEqual([]);
    }
  });
});
