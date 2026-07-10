import type { CyclePhaseIndex, CycleState } from '@/types';
import { getSkincareDateString } from '@/utils/timeHelpers';

/**
 * Dynamic 4-day skin-cycling state machine (research §1.4). Pure and
 * deterministic: driven exclusively by check-ins, never by the calendar. A
 * missed night pauses the cycle — the uncompleted phase carries forward to
 * the next check-in, so actives are never applied out of order after a gap
 * and drift always degrades toward more recovery (the safe direction).
 */

export type CyclePhase = 'exfoliation' | 'retinoid' | 'recovery';

/** The fixed 4-night loop. */
export const CYCLE_PHASES: readonly CyclePhase[] = [
  'exfoliation',
  'retinoid',
  'recovery',
  'recovery',
];

/** Fresh state: tonight is exfoliation night, nothing checked in yet. */
export const INITIAL_CYCLE_STATE: CycleState = {
  cyclePhaseIndex: 0,
  lastAppliedDate: null,
};

/**
 * The phase to perform "tonight". Pause-on-miss semantics make this
 * date-independent: the pending phase stays pending until a check-in
 * completes it.
 */
export function getCyclePhaseForTonight(state: CycleState): CyclePhase {
  return CYCLE_PHASES[state.cyclePhaseIndex];
}

/** True when a check-in was already recorded for the current skincare day. */
export function isCheckedInToday(state: CycleState, now: Date = new Date()): boolean {
  return state.lastAppliedDate === getSkincareDateString(now);
}

/**
 * Records a "Complete My Routine" check-in: completes tonight's phase and
 * advances the loop. Idempotent per skincare day (04:00 boundary) — a second
 * tap the same day returns the SAME state reference and reports
 * advanced: false. No retroactive backfill (research §1.4).
 */
export function checkInCycle(
  state: CycleState,
  now: Date = new Date(),
): { state: CycleState; advanced: boolean } {
  if (isCheckedInToday(state, now)) return { state, advanced: false };

  return {
    state: {
      cyclePhaseIndex: ((state.cyclePhaseIndex + 1) % CYCLE_PHASES.length) as CyclePhaseIndex,
      lastAppliedDate: getSkincareDateString(now),
    },
    advanced: true,
  };
}
