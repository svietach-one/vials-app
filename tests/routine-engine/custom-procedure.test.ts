/**
 * Integration tests — Story 3: Custom procedure with symptom presets
 * Spec: docs/specs/2026-07-04-routine-engine.md §4 Story 3
 *
 * The four preset tiles and the "no rehab window given" inline validation
 * live in AddProcedureModal (FE-9, shipped) and are covered separately in
 * tests/routine-engine/add-procedure-modal.test.tsx. What IS
 * engine-testable: once a custom UserProcedureLog carries a resolved
 * `customRehabDays` (0 / 3 / 7 / custom manual value), the daily view and
 * generate entry points must apply (or skip) the `custom_default` freeze
 * profile exactly as the presets intend.
 */
import { getDailyView } from '@/utils/routineEngine/dailyView';
import { generatePlan } from '@/utils/routineEngine/generate';
import {
  makeEngineInput,
  makeProcedureLog,
  makeProduct,
  makeRoutine,
  makeRoutineStep,
  NOW,
  resetFixtureCounters,
} from './fixtures';

beforeEach(() => resetFixtureCounters());

describe('Story 3 AC: a saved custom-procedure preset drives the custom_default freeze window', () => {
  it('"Redness / Peeling" (3 days) freezes exfoliating and high-irritancy products for the resolved window', () => {
    const aha = makeProduct({ activeTags: ['aha'] }); // exfoliating: true -> custom_default target
    const retinoid = makeProduct({ activeTags: ['retinoid'] }); // irritancy 3 -> also matches
    const custom = makeProcedureLog({
      procedureKey: 'custom',
      customName: 'Micro-needling',
      customRehabDays: 3,
      datePerformed: '2026-07-04', // day 0 == NOW
    });

    const plan = generatePlan(makeEngineInput([aha, retinoid], { procedures: [custom] }));

    expect(plan.frozen.map((f) => f.productId).sort()).toEqual([aha.id, retinoid.id].sort());
    expect(plan.frozen.every((f) => f.reasonCode === 'custom_rehab_conservative')).toBe(true);
    expect(plan.frozen.every((f) => f.until === '2026-07-07')).toBe(true);
  });

  it('"Trauma / Laser" (7 days) keeps the freeze active on day 6 and lifts it by day 7 with zero store mutation between renders', () => {
    const aha = makeProduct({ activeTags: ['aha'] });
    const cleanser = makeProduct({ productType: 'cleanser' });
    const routines = [makeRoutine('evening', [makeRoutineStep(cleanser), makeRoutineStep(aha)])];
    const custom = makeProcedureLog({
      procedureKey: 'custom',
      customName: 'Laser resurfacing',
      customRehabDays: 7,
      datePerformed: '2026-06-27', // NOW (07-04) is day 7 -> exactly at the boundary
    });

    const dayAt = (now: Date) =>
      getDailyView(routines, [cleanser, aha], {
        procedures: [custom],
        profile: { fitzpatrick: null },
        seasonMask: { season: 'spring', source: 'calendar' },
        now,
      })[0];

    const day6 = dayAt(new Date('2026-07-03T12:00:00Z'));
    expect(day6.steps.map((s) => s.productId)).toEqual([cleanser.id]);
    expect(day6.frozen).toHaveLength(1);

    const day7 = dayAt(NOW); // day offset 7 -> half-open window [0,7) has ended
    expect(day7.steps.map((s) => s.productId)).toEqual([cleanser.id, aha.id]);
    expect(day7.frozen).toHaveLength(0);
    // Same routines array, no rerender-order dependency — the two calls above
    // never mutated `routines` between them.
    expect(routines[0].steps.map((s) => s.productId)).toEqual([cleanser.id, aha.id]);
  });

  it('"Light Care" (0 days) applies no product freezes at all', () => {
    const aha = makeProduct({ activeTags: ['aha'] });
    const custom = makeProcedureLog({
      procedureKey: 'custom',
      customName: 'Light facial',
      customRehabDays: 0,
      datePerformed: '2026-07-04',
    });
    const plan = generatePlan(makeEngineInput([aha], { procedures: [custom] , profile: { fitzpatrick: null, concerns: [], primaryGoal: 'pigmentation', secondaryGoal: null } }));
    expect(plan.frozen).toHaveLength(0);
    expect(plan.periods.evening.map((s) => s.productId)).toEqual([aha.id]);
  });

  it('a manual "Custom" rehab-days entry (e.g. 10 days) resolves the same way as a preset', () => {
    const bha = makeProduct({ activeTags: ['bha'] });
    const custom = makeProcedureLog({
      procedureKey: 'custom',
      customName: 'Custom recovery',
      customRehabDays: 10,
      datePerformed: '2026-07-04',
    });
    const plan = generatePlan(makeEngineInput([bha], { procedures: [custom] }));
    expect(plan.frozen).toEqual([
      expect.objectContaining({ productId: bha.id, until: '2026-07-14' }),
    ]);
  });
});

// Story 3 UI ACs are activated now that FE-9 shipped (progress/routine-engine.md,
// 2026-07-05 "SURROUNDING UX" entry):
// - preset tiles + inline validation -> tests/routine-engine/add-procedure-modal.test.tsx
// - dimmed "Paused until" rows -> tests/routine-engine/routines-screen-paused-rows.test.tsx
// Kept out of this file since they need @testing-library/react-native rendering.
