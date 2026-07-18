import type { CycleState } from '@/types';
import {
  CYCLE_PHASES,
  DYNAMIC_UNAVAILABLE_REASON,
  INITIAL_CYCLE_STATE,
  checkInCycle,
  getCyclePhaseForTonight,
  isCheckedInToday,
  isDynamicCyclingAvailable,
  resolveCyclePhase,
} from '@/utils/routineEngine/cycleState';

const NOON = new Date('2026-07-04T12:00:00');

describe('CYCLE_PHASES', () => {
  it('is the fixed 4-night loop: exfoliation, retinoid, recovery, recovery', () => {
    expect(CYCLE_PHASES).toEqual(['exfoliation', 'retinoid', 'recovery', 'recovery']);
  });
});

describe('getCyclePhaseForTonight', () => {
  it('starts a fresh cycle on exfoliation night', () => {
    expect(getCyclePhaseForTonight(INITIAL_CYCLE_STATE)).toBe('exfoliation');
  });

  it('maps both trailing indices to recovery', () => {
    expect(getCyclePhaseForTonight({ cyclePhaseIndex: 2, lastAppliedDate: null })).toBe('recovery');
    expect(getCyclePhaseForTonight({ cyclePhaseIndex: 3, lastAppliedDate: null })).toBe('recovery');
  });

  it('is date-independent — a missed night leaves the pending phase pending', () => {
    // State last touched days ago still reports the same pending phase
    const stale: CycleState = { cyclePhaseIndex: 1, lastAppliedDate: '2026-06-20' };
    expect(getCyclePhaseForTonight(stale)).toBe('retinoid');
  });
});

describe('checkInCycle', () => {
  it('advances the phase and stamps the skincare date on a first check-in', () => {
    const result = checkInCycle(INITIAL_CYCLE_STATE, NOON);
    expect(result.advanced).toBe(true);
    expect(result.state).toEqual({ cyclePhaseIndex: 1, lastAppliedDate: '2026-07-04' });
  });

  it('is idempotent per skincare day — a second tap returns the same reference', () => {
    const first = checkInCycle(INITIAL_CYCLE_STATE, NOON);
    const second = checkInCycle(first.state, new Date('2026-07-04T22:00:00'));
    expect(second.advanced).toBe(false);
    expect(second.state).toBe(first.state);
  });

  it('treats 03:59 as the previous skincare day (04:00 boundary)', () => {
    // Checked in on the evening of the 4th; 03:00 on the 5th is still the 4th
    const evening = checkInCycle(INITIAL_CYCLE_STATE, NOON);
    const lateNight = checkInCycle(evening.state, new Date('2026-07-05T03:00:00'));
    expect(lateNight.advanced).toBe(false);
  });

  it('advances again on the next skincare day', () => {
    const day1 = checkInCycle(INITIAL_CYCLE_STATE, NOON);
    const day2 = checkInCycle(day1.state, new Date('2026-07-05T12:00:00'));
    expect(day2.advanced).toBe(true);
    expect(day2.state.cyclePhaseIndex).toBe(2);
  });

  it('wraps from the last recovery night back to exfoliation', () => {
    const result = checkInCycle({ cyclePhaseIndex: 3, lastAppliedDate: '2026-07-03' }, NOON);
    expect(result.state.cyclePhaseIndex).toBe(0);
  });

  it('pauses on missed nights — a gap never skips a phase', () => {
    // Last check-in June 20; two weeks later the pending phase advances by exactly one
    const stale: CycleState = { cyclePhaseIndex: 1, lastAppliedDate: '2026-06-20' };
    const result = checkInCycle(stale, NOON);
    expect(result.state.cyclePhaseIndex).toBe(2);
  });
});

describe('isCheckedInToday', () => {
  it('reports true only for the current skincare day', () => {
    const state: CycleState = { cyclePhaseIndex: 1, lastAppliedDate: '2026-07-04' };
    expect(isCheckedInToday(state, NOON)).toBe(true);
    expect(isCheckedInToday(state, new Date('2026-07-05T12:00:00'))).toBe(false);
    expect(isCheckedInToday(INITIAL_CYCLE_STATE, NOON)).toBe(false);
  });
});

describe('resolveCyclePhase (phase-06 §6.1)', () => {
  const both = new Set(['exfoliant', 'retinoid']);
  const idx = (cyclePhaseIndex: 0 | 1 | 2 | 3): CycleState => ({ cyclePhaseIndex, lastAppliedDate: null });

  it('returns the raw phase when its class is available', () => {
    expect(resolveCyclePhase(idx(0), both)).toBe('exfoliation');
    expect(resolveCyclePhase(idx(1), both)).toBe('retinoid');
  });

  it('degrades an exfoliation night to recovery when no exfoliant is available', () => {
    expect(resolveCyclePhase(idx(0), new Set(['retinoid']))).toBe('recovery');
  });

  it('degrades a retinoid night to recovery when no retinoid is available', () => {
    expect(resolveCyclePhase(idx(1), new Set(['exfoliant']))).toBe('recovery');
  });

  it('leaves recovery nights untouched regardless of the shelf', () => {
    expect(resolveCyclePhase(idx(2), new Set())).toBe('recovery');
    expect(resolveCyclePhase(idx(3), both)).toBe('recovery');
  });

  it('does not touch cyclePhaseIndex — the raw phase is preserved so returning a product restores the cycle', () => {
    // Same state, empty shelf → recovery; refill the shelf → the full phase is back.
    const state = idx(1);
    expect(resolveCyclePhase(state, new Set())).toBe('recovery');
    expect(resolveCyclePhase(state, both)).toBe('retinoid');
    expect(state.cyclePhaseIndex).toBe(1); // never mutated
  });
});

describe('isDynamicCyclingAvailable (phase-06 §6.1)', () => {
  it('is true when an exfoliant or a retinoid is available', () => {
    expect(isDynamicCyclingAvailable(new Set(['exfoliant']))).toBe(true);
    expect(isDynamicCyclingAvailable(new Set(['retinoid']))).toBe(true);
  });

  it('is false when neither cycle class is available', () => {
    expect(isDynamicCyclingAvailable(new Set())).toBe(false);
    expect(isDynamicCyclingAvailable(new Set(['moisturizer']))).toBe(false);
  });

  it('exposes a stable reason code for the unavailable case', () => {
    expect(DYNAMIC_UNAVAILABLE_REASON).toBe('dynamic_unavailable_no_actives');
  });
});
