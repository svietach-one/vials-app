/**
 * Integration tests — V2.1 phase-06 (dynamic cycling resolved from shelf
 * composition). Exercises getDynamicCycleStatus / getDailyView together: the
 * rendered cycle phase degrades to recovery when its active is absent, and
 * dynamic mode reports itself unavailable when nothing cycles.
 */
import type { CycleState, UserProcedureLog } from '@/types';
import { getDailyView, getDynamicCycleStatus } from '@/utils/routineEngine/dailyView';
import { makeProduct, makeRoutine, makeRoutineStep, makeSeasonMask, NOW } from './fixtures';

function input(state: CycleState, procedures: UserProcedureLog[] = []) {
  return {
    procedures,
    profile: { fitzpatrick: null },
    seasonMask: makeSeasonMask(),
    cycle: { type: 'dynamic' as const, state },
    now: NOW,
  };
}

const at = (cyclePhaseIndex: 0 | 1 | 2 | 3): CycleState => ({
  cyclePhaseIndex,
  lastAppliedDate: null,
});

describe('phase-06 §6.1: dynamic cycle phase resolves against shelf composition', () => {
  it('runs the effective cycle exfoliation -> recovery -> recovery -> recovery on a retinoid-free shelf', () => {
    const aha = makeProduct({ activeTags: ['aha'] });
    const shelf = [aha];
    const phaseAt = (i: 0 | 1 | 2 | 3) => getDynamicCycleStatus(shelf, input(at(i))).phase;

    expect(phaseAt(0)).toBe('exfoliation'); // exfoliant present
    expect(phaseAt(1)).toBe('recovery'); // retinoid night, none on shelf → recovery
    expect(phaseAt(2)).toBe('recovery');
    expect(phaseAt(3)).toBe('recovery');
  });

  it('reports dynamic cycling unavailable when neither an exfoliant nor a retinoid is on the shelf', () => {
    const moisturizer = makeProduct({ productType: 'moisturizer' });
    const status = getDynamicCycleStatus([moisturizer], input(at(1)));

    expect(status.available).toBe(false);
    expect(status.reasonCode).toBe('dynamic_unavailable_no_actives');
    expect(status.phase).toBe('recovery'); // never an empty night
  });

  it('degrades retinoid night to recovery when the only retinoid is PAO-expired (eligibility, not mere presence)', () => {
    // Opened long ago with a short PAO → expired → not "on shelf" for cycling.
    const expiredRetinoid = makeProduct({
      activeTags: ['retinoid'],
      openedDate: '2025-01-01',
      paoMonths: 6,
    });
    const status = getDynamicCycleStatus([expiredRetinoid], input(at(1)));

    expect(status.phase).toBe('recovery');
    expect(status.available).toBe(false); // the expired retinoid does not count
  });

  it('degrades retinoid night to recovery when the retinoid is clinically frozen tonight', () => {
    const retinoid = makeProduct({ activeTags: ['retinoid'] });
    const peel: UserProcedureLog = {
      id: 'proc-1',
      procedureKey: 'chemical_peel_deep',
      datePerformed: '2026-07-04',
      status: 'rehab',
      deferralCount: 0,
    };
    const status = getDynamicCycleStatus([retinoid], input(at(1), [peel]));

    expect(status.phase).toBe('recovery'); // frozen retinoid cannot keep the night alive
  });

  it('restores the full cycle when a removed retinoid returns — the index never reset', () => {
    const retinoid = makeProduct({ activeTags: ['retinoid'] });
    const state = at(1); // retinoid night

    expect(getDynamicCycleStatus([], input(state)).phase).toBe('recovery'); // removed
    expect(getDynamicCycleStatus([retinoid], input(state)).phase).toBe('retinoid'); // re-added
    expect(state.cyclePhaseIndex).toBe(1); // resolution never mutates the index
  });

  it('feeds the resolved phase into getDailyView — an off-shelf retinoid night shows no cycled-out rows', () => {
    // With no retinoid on the shelf, retinoid night resolves to recovery, so an
    // exfoliant PM step is simply cycled out (recovery shows neither class).
    const aha = makeProduct({ activeTags: ['aha'] });
    const routines = [makeRoutine('evening', [makeRoutineStep(aha)])];
    const views = getDailyView(routines, [aha], input(at(1)));
    const evening = views.find((v) => v.timeOfDay === 'evening');

    // recovery night → the AHA is cycled out (not scheduled tonight), not shown.
    expect(evening?.steps.some((s) => s.productId === aha.id)).toBe(false);
    expect(evening?.cycledOut.some((c) => c.productId === aha.id)).toBe(true);
  });
});
