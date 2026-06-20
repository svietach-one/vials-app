import { CLINICAL_RULES_DB } from '@/types';
import type { UserProcedureLog } from '@/types';

export type ComputedStatus = 'rehab' | 'active' | 'fading' | 'completed' | 'archived';

const MS_PER_DAY = 86_400_000;
const DAYS_PER_MONTH = 30.44;

/**
 * Derives the live status of a procedure from its datePerformed and the
 * CLINICAL_RULES_DB config.  The stored `proc.status` is only consulted to
 * detect the 'archived' terminal state — all other states are computed.
 */
export function computeStatus(proc: UserProcedureLog, now: Date): ComputedStatus {
  if (proc.status === 'archived') return 'archived';
  const config = CLINICAL_RULES_DB[proc.procedureKey];
  const elapsedDays = (now.getTime() - new Date(proc.datePerformed).getTime()) / MS_PER_DAY;
  const elapsedMonths = elapsedDays / DAYS_PER_MONTH;
  if (elapsedDays <= config.rehabDays) return 'rehab';
  if (elapsedMonths >= config.totalEffectMonths) return 'completed';
  if (elapsedMonths >= config.fadeTriggerMonth) return 'fading';
  return 'active';
}

/**
 * Returns a progress ratio in [0, 1] representing how far through the
 * total effect window the procedure is (capped at 1.0).
 */
export function getProgress(proc: UserProcedureLog, now: Date): number {
  const config = CLINICAL_RULES_DB[proc.procedureKey];
  const elapsedDays = (now.getTime() - new Date(proc.datePerformed).getTime()) / MS_PER_DAY;
  const elapsedMonths = elapsedDays / DAYS_PER_MONTH;
  return Math.min(elapsedMonths / config.totalEffectMonths, 1);
}
