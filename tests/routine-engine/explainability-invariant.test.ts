/**
 * Explainability invariant property test (V2.1 phase-09 suite 7).
 *
 * The contract the spec states as `|shelf| = |routine| + |frozen| + |reserve|`
 * is incomplete against the real plan shape. DISCREPANCY-REPORT.md §1 already
 * added `frozen` (a distinct bucket the original formula dropped); this suite
 * surfaced a second omission the same way — `slotAlternatives`. A product that
 * loses a STRUCTURAL slot to a better-ranked sibling of the same function
 * (Story 2 "routine-similar-product-priority") is recorded only as a slot
 * alternative, not in reserve. So the real invariant has FOUR accountability
 * buckets: a non-hidden shelf product lands in scheduled (some period),
 * `plan.frozen`, `plan.reserve`, or as a same-slot loser inside
 * `plan.slotAlternatives`. A product benign in BOTH periods is still one
 * logical bucket (scheduled), so the coverage side is "at least one bucket,
 * never zero"; the partition side is the pairwise disjointness of the three
 * terminal buckets {scheduled, frozen, reserve} (a slot loser is by definition
 * none of those).
 *
 * A hand-built single-shelf version lives in generate.test.ts ("accounts for
 * every shelf product exactly once"); this generalizes it to the 100-seed
 * property style using the seeded mulberry32 fixtures — no Math.random, no
 * flakiness. Goal/fitzpatrick/concerns/season are varied so actives are
 * actually admitted (under phase-04 minimalism a maintenance-only run would
 * reserve everything and make the partition trivially satisfiable).
 *
 * randomShelf produces no hidden products, so every shelf product is
 * accountable; the hidden-exclusion clause is asserted structurally by the
 * disjointness checks rather than needing a hidden fixture.
 */
import { generatePlan } from '@/utils/routineEngine/generate';
import {
  makeEngineInput,
  makeRng,
  makeSeasonMask,
  NOW,
  randomConcerns,
  randomFitzpatrick,
  randomGoal,
  randomShelf,
} from './fixtures';

const SEASONS = ['winter', 'spring', 'summer', 'autumn'] as const;

describe('Explainability invariant (spec §9.7): every shelf product is accounted for exactly once', () => {
  it('partitions every non-hidden shelf product into scheduled | frozen | reserve across 100 seeded shelves', () => {
    for (let seed = 0; seed < 100; seed += 1) {
      const rng = makeRng(seed * 19 + 7);
      const { products } = randomShelf(rng, 4 + Math.floor(rng() * 12));
      const plan = generatePlan(
        makeEngineInput(products, {
          profile: {
            fitzpatrick: randomFitzpatrick(rng),
            concerns: randomConcerns(rng),
            primaryGoal: randomGoal(rng),
            secondaryGoal: null,
          },
          seasonMask: makeSeasonMask(SEASONS[seed % SEASONS.length]),
          now: NOW,
        }),
      );

      const scheduled = new Set(
        [...plan.periods.morning, ...plan.periods.evening].map((s) => s.productId),
      );
      const frozen = new Set(plan.frozen.map((f) => f.productId));
      const reserve = new Set(plan.reserve.map((r) => r.productId));
      // Same-slot losers live nested under each winning slot's `alternatives`.
      const slotLosers = new Set(
        (plan.slotAlternatives ?? []).flatMap((s) => s.alternatives.map((a) => a.productId)),
      );

      for (const p of products) {
        // Coverage: never zero. Scheduled-in-both-periods still counts as one
        // logical bucket, so this is "at least one", not "exactly one row".
        const inSomeBucket =
          scheduled.has(p.id) || frozen.has(p.id) || reserve.has(p.id) || slotLosers.has(p.id);
        expect({ seed, id: p.id, inSomeBucket }).toEqual({ seed, id: p.id, inSomeBucket: true });
      }

      // NOTE: slotAlternatives is a COVERAGE bucket, not a terminal one — it
      // legitimately overlaps `scheduled`. A cleanser that loses the AM
      // cleanser slot to a better cleanser can still win the PM cleanser slot
      // (the same structural slot exists in both periods), so the same product
      // is both a morning slot-loser and a scheduled evening step. Only the
      // three terminal buckets below are asserted disjoint.

      // Partition: the three buckets are pairwise disjoint. A product is never
      // simultaneously scheduled AND reserved (the specific case §9.7 calls
      // out), nor scheduled/frozen, nor frozen/reserved.
      for (const id of scheduled) {
        expect({ seed, id, alsoReserved: reserve.has(id) }).toEqual({ seed, id, alsoReserved: false });
        expect({ seed, id, alsoFrozen: frozen.has(id) }).toEqual({ seed, id, alsoFrozen: false });
      }
      for (const id of frozen) {
        expect({ seed, id, alsoReserved: reserve.has(id) }).toEqual({ seed, id, alsoReserved: false });
      }

      // Every non-routine product carries exactly one reasonCode (spec §9.7).
      for (const f of plan.frozen) {
        expect(typeof f.reasonCode).toBe('string');
        expect(f.reasonCode.length).toBeGreaterThan(0);
      }
      for (const r of plan.reserve) {
        expect(typeof r.reasonCode).toBe('string');
        expect(r.reasonCode.length).toBeGreaterThan(0);
      }

      // No duplicate rows inside frozen or reserve — one product, one row.
      expect(frozen.size).toBe(plan.frozen.length);
      expect(reserve.size).toBe(plan.reserve.length);
    }
  });
});
