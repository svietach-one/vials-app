/**
 * Balanced is NOT a strict superset of Essential (tech design §4, last
 * assumption; spike: 10 existing steps dropped, 17 others added over 1000
 * shelves). Because that is a deliberate property, the user-facing contract is
 * "no silent loss": whatever Essential scheduled and Balanced does not must be
 * accounted for in the Balanced plan AND visible in the Draft Preview diff.
 * Written against a DRAFT spec.
 */
import { ROUTINE_DEPTH_OPTIONS } from '@/constants/routineDepth';
import { generatePlan } from '@/utils/routineEngine/generate';
import { validateRoutines } from '@/utils/routineEngine/validate';
import {
  accountedIds,
  buildPromotionShapedShelf,
  buildSweepShelf,
  ids,
  resetFixtureCounters,
  routinesFromPlan,
} from './fixtures';

beforeEach(() => resetFixtureCounters());

type Dropped = { corpus: string; seed: number; period: 'morning' | 'evening'; productId: string };

function* corpora() {
  for (let seed = 0; seed < 1500; seed += 1) {
    yield { corpus: 'promotion', seed, balanced: buildPromotionShapedShelf(seed, 'balanced'), essential: buildPromotionShapedShelf(seed, 'essential') };
  }
  for (let seed = 0; seed < 1500; seed += 1) {
    yield { corpus: 'sweep', seed, balanced: buildSweepShelf(seed, 'balanced', { salt: 3 }), essential: buildSweepShelf(seed, 'essential', { salt: 3 }) };
  }
}

describe('a step that Essential schedules and Balanced does not', () => {
  const dropped: Dropped[] = [];
  const unexplained: string[] = [];
  const invisible: string[] = [];

  beforeAll(() => {
    resetFixtureCounters();
    for (const { corpus, seed, balanced, essential } of corpora()) {
      const balancedPlan = generatePlan(balanced.input);
      const essentialPlan = generatePlan(essential.input);
      for (const period of ['morning', 'evening'] as const) {
        const kept = new Set(ids(balancedPlan.periods[period]));
        for (const step of essentialPlan.periods[period]) {
          if (kept.has(step.productId)) continue;
          dropped.push({ corpus, seed, period, productId: step.productId });
          if (!accountedIds(balancedPlan).has(step.productId)) {
            unexplained.push(`${corpus} ${seed}: ${step.productId} left ${period} with no bucket`);
          }
          // What the user sees when she accepts the style switch with her Essential routine saved.
          const diff = validateRoutines(routinesFromPlan(essentialPlan), balanced.input).diff;
          const shown = diff.some(
            (d) => d.productId === step.productId && ['removed', 'frozen', 'moved'].includes(d.kind),
          );
          if (!shown) invisible.push(`${corpus} ${seed}: ${step.productId} dropped from ${period} but absent from the diff`);
        }
      }
    }
  });

  it('exists: Balanced really is not a superset (guards the claim in the tech design)', () => {
    expect(dropped.length).toBeGreaterThan(0);
  });

  it('is always accounted for in the Balanced plan (frozen, reserve, alternative, or the other period)', () => {
    expect(unexplained).toEqual([]);
  });

  it('is always visible in the Draft Preview diff against the saved Essential routine', () => {
    expect(invisible).toEqual([]);
  });
});

describe('style copy never promises that Balanced keeps everything Essential had', () => {
  it('does not describe Balanced as "Essential plus" or as containing all of Essential', () => {
    expect(ROUTINE_DEPTH_OPTIONS.balanced.sublabel).not.toMatch(/essential plus|everything|all of (your )?essential/i);
  });
});
