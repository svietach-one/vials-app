/**
 * `copper_peptides` is the ONLY class in this suite whose ruleset lookup is
 * overridden: real actives.json data has no class with `preferredPeriod:
 * 'pm'` today (every present `preferredPeriod` value in the current ruleset
 * is 'am'), so the AM/PM-disagreement branch (tech-design FE-6) is
 * unreachable with real data alone. Mirrors the same scoped override in
 * tests/product-profile-m1/productProfileBuilder.integration.test.ts — no
 * other test in this file resolves `copper_peptides`, so the override
 * doesn't disturb any other assertion here.
 */
jest.mock('@/constants/rulesets/rulesetTypes', () => {
  const actual = jest.requireActual('@/constants/rulesets/rulesetTypes');
  return {
    ...actual,
    ACTIVES_RULESET: {
      ...actual.ACTIVES_RULESET,
      classes: {
        ...actual.ACTIVES_RULESET.classes,
        copper_peptides: {
          ...actual.ACTIVES_RULESET.classes.copper_peptides,
          preferredPeriod: 'pm',
        },
      },
    },
  };
});

import type { ProductType } from '@/types';
import { joinActiveKeys } from '@/utils/productProfile/join';
import { buildRoutinePosition } from '@/utils/productProfile/routinePosition';

describe('buildRoutinePosition — zero resolved active classes', () => {
  it('falls back to the full am+pm band with no preference, confidence insufficient_data', () => {
    const position = buildRoutinePosition('serum', joinActiveKeys([]));

    expect(position.eligiblePeriods.slice().sort()).toEqual(['AM', 'PM']);
    expect(position.preferredPeriod).toBeNull();
    expect(position.confidence).toBe('insufficient_data');
  });

  it('still reports a productType-derived layeringOrder and rinseOff (ingredient-independent)', () => {
    const position = buildRoutinePosition('cleanser', joinActiveKeys([]));

    expect(position.layeringOrder).not.toBeNull();
    expect(position.rinseOff).toBe(true);
  });
});

describe('buildRoutinePosition — single present class', () => {
  it('collapses eligiblePeriods to the class hard requirement and treats it as the preferred period (aha: pm-only)', () => {
    const position = buildRoutinePosition('serum', joinActiveKeys(['aha']));

    expect(position.eligiblePeriods).toEqual(['PM']);
    expect(position.preferredPeriod).toBe('PM');
    expect(position.confidence).toBe('deterministic');
  });

  it('adopts a single class soft preference when both periods remain eligible (vitamin_c_pure -> am)', () => {
    const position = buildRoutinePosition('serum', joinActiveKeys(['vitamin_c_pure']));

    expect(position.eligiblePeriods.slice().sort()).toEqual(['AM', 'PM']);
    expect(position.preferredPeriod).toBe('AM');
    expect(position.confidence).toBe('deterministic');
  });

  it('reports null preferredPeriod when the single present class expresses no preference (azelaic_acid)', () => {
    const position = buildRoutinePosition('serum', joinActiveKeys(['azelaic_acid']));

    expect(position.preferredPeriod).toBeNull();
    expect(position.confidence).toBe('deterministic');
  });

  it("sanity-checks copper_peptides' own (mocked) pm preference resolves cleanly on its own", () => {
    const position = buildRoutinePosition('serum', joinActiveKeys(['copper_peptides']));

    expect(position.preferredPeriod).toBe('PM');
  });
});

describe('buildRoutinePosition — multiple present classes', () => {
  it('intersects allowedPeriods across present classes (aha pm-only ∩ ceramides am+pm -> pm)', () => {
    const position = buildRoutinePosition('serum', joinActiveKeys(['aha', 'ceramides']));

    expect(position.eligiblePeriods).toEqual(['PM']);
  });

  it('marks confidence heuristic and keeps preferredPeriod null when present classes disagree with no requirement to break the tie', () => {
    const position = buildRoutinePosition(
      'serum',
      joinActiveKeys(['vitamin_c_pure', 'copper_peptides']), // am (real) vs pm (mocked)
    );

    expect(position.preferredPeriod).toBeNull();
    expect(position.eligiblePeriods.slice().sort()).toEqual(['AM', 'PM']);
    expect(position.confidence).toBe('heuristic');
  });
});

describe('buildRoutinePosition — layeringOrder fallback', () => {
  it('returns null when the product type has no entry in the layering table', () => {
    // LAYERING_ORDER is currently a total Record<ProductType, number> (every
    // real ProductType resolves), so this exercises the defensive `?? null`
    // fallback directly via a type cast rather than a real, reachable
    // ProductType — the same documented situation as the AM/PM-disagreement
    // branch above.
    const position = buildRoutinePosition('not_a_real_type' as ProductType, joinActiveKeys([]));

    expect(position.layeringOrder).toBeNull();
  });
});
