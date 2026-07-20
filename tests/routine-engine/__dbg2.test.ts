import { generatePlan } from '@/utils/routineEngine/generate';
import { makeEngineInput, makeProduct, NOW } from './fixtures';

it('dbg: micellar + BHA cleanser + retinoid', () => {
  const micellar = makeProduct({ name: 'Micellar Water', productType: 'makeup_remover' });
  const bhaCleanser = makeProduct({ name: 'BHA Cleanser', productType: 'cleanser', activeTags: ['bha'] });
  const retinoid = makeProduct({ name: 'Retinoid Serum', activeTags: ['retinoid'] });
  const plan = generatePlan(
    makeEngineInput([micellar, bhaCleanser, retinoid], {
      now: NOW,
      profile: { fitzpatrick: null, concerns: [], primaryGoal: 'aging', secondaryGoal: null },
    }),
  );
  console.log('PM steps:', JSON.stringify(plan.periods.evening.map(s => ({id:s.productId, type:s.productType, days:s.scheduledDays, note:s.stepNote})), null, 2));
  console.log('placeholders:', JSON.stringify(plan.placeholders));
  console.log('frozen:', JSON.stringify(plan.frozen));
});
