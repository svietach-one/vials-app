import { generatePlan } from '@/utils/routineEngine/generate';
import { applySlotAlternativeSwap } from '@/utils/routineEngine/planApply';
import { validateRoutines } from '@/utils/routineEngine/validate';
import { makeEngineInput, makeProduct, NOW, resetFixtureCounters, routinesFromPlan } from '../routine-engine/fixtures';

beforeEach(() => resetFixtureCounters());

describe('pre_cleanse gap fill never bypasses the pair-rule ladder', () => {
  it('does not promote an alternative cleanser onto a night where it conflicts at avoid level', () => {
    const products = [
      makeProduct({ id: 'micellar', name: 'Micellar Water', productType: 'makeup_remover', addedAt: '2026-01-01' }),
      makeProduct({ id: 'glycolic_wash', name: 'Glycolic Wash', productType: 'cleanser', activeTags: ['aha'], addedAt: '2026-06-01' }),
      makeProduct({ id: 'pha_wash', name: 'PHA Wash', productType: 'cleanser', activeTags: ['pha'], addedAt: '2026-02-01' }),
      makeProduct({ id: 'cu_moist', name: 'Copper Peptide Moisturiser', productType: 'moisturizer', activeTags: ['copper_peptides'], addedAt: '2026-01-15' }),
    ];
    const input = makeEngineInput(products, { now: NOW });
    const plan = generatePlan(input);

    const conflicts = validateRoutines(routinesFromPlan(plan), input).findings.filter((f) => f.ruleId);
    expect(conflicts).toEqual([]);
  });
});

describe('a promoted alternative is no longer offered as a swap target', () => {
  it('no Draft Preview swap can duplicate a product already scheduled in the period', () => {
    const products = [
      makeProduct({ id: 'micellar', name: 'Micellar Water', productType: 'makeup_remover' }),
      makeProduct({ id: 'acid', name: 'BHA Cleanser', productType: 'cleanser', activeTags: ['bha'] }),
      makeProduct({ id: 'plain', name: 'Gentle Gel Cleanser', productType: 'cleanser' }),
      makeProduct({ id: 'retinoid', name: 'Retinoid Serum', activeTags: ['retinoid'] }),
    ];
    const plan = generatePlan(makeEngineInput(products, {
      now: NOW, profile: { fitzpatrick: null, concerns: [], primaryGoal: 'aging', secondaryGoal: null },
    }));

    for (const entry of plan.slotAlternatives ?? []) {
      const scheduled = plan.periods[entry.period].map((s) => s.productId);
      expect(entry.alternatives.map((a) => a.productId).filter((id) => scheduled.includes(id))).toEqual([]);
      for (const alt of entry.alternatives) {
        const ids = applySlotAlternativeSwap(plan, entry.winnerProductId, alt.productId).periods[entry.period].map((s) => s.productId);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });
});
