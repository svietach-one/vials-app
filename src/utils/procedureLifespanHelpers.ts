import { CLINICAL_RULES_DB } from '@/types';
import type { ClinicalTimelineConfig, CosmeticProcedureKey, UserProcedureLog } from '@/types';

export type ComputedStatus = 'rehab' | 'active' | 'fading' | 'completed' | 'archived';

const MS_PER_DAY = 86_400_000;
const DAYS_PER_MONTH = 30.44;

/**
 * Fraction of a custom procedure's lifespan after which the "fading?" prompt
 * starts. Matches the pre-defined ratios in CLINICAL_RULES_DB, which cluster
 * between 0.67 (botox) and 0.83 (fillers, mesotherapy).
 */
const CUSTOM_FADE_TRIGGER_RATIO = 0.75;

export const PROCEDURE_LABELS: Record<CosmeticProcedureKey, string> = {
  botox: 'Botox / Dysport',
  fillers: 'Dermal Fillers',
  smas_lifting: 'SMAS Lifting',
  mesotherapy: 'Mesotherapy',
  chemical_peel_deep: 'Deep Chemical Peel',
  mechanical_facial: 'Mechanical Facial',
};

export function isCustomProcedure(proc: UserProcedureLog): boolean {
  return proc.procedureKey === 'custom';
}

/** Display name for any logged procedure, custom or pre-defined. */
export function getProcedureDisplayName(proc: UserProcedureLog): string {
  if (proc.procedureKey === 'custom') return proc.customName ?? 'Custom procedure';
  return PROCEDURE_LABELS[proc.procedureKey];
}

/**
 * Resolves the timeline config for any procedure. Pre-defined procedures read
 * CLINICAL_RULES_DB; custom procedures derive it dynamically from the span
 * between datePerformed and estimatedReturnDate (the 0% efficiency baseline).
 * Custom procedures have no clinical rehab rules, so rehabDays is 0.
 */
export function getTimelineConfig(proc: UserProcedureLog): ClinicalTimelineConfig {
  if (proc.procedureKey !== 'custom') return CLINICAL_RULES_DB[proc.procedureKey];
  const performed = new Date(proc.datePerformed).getTime();
  const returns = proc.estimatedReturnDate
    ? new Date(proc.estimatedReturnDate).getTime()
    : NaN;
  // Guard against missing/inverted dates so progress math never divides by zero
  const totalDays = Math.max(Number.isFinite(returns) ? (returns - performed) / MS_PER_DAY : 1, 1);
  const totalEffectMonths = totalDays / DAYS_PER_MONTH;
  return {
    rehabDays: 0,
    totalEffectMonths,
    fadeTriggerMonth: totalEffectMonths * CUSTOM_FADE_TRIGGER_RATIO,
  };
}

/**
 * Derives the live status of a procedure from its datePerformed and its
 * timeline config (static for pre-defined, date-derived for custom). The
 * stored `proc.status` is only consulted to detect the 'archived' terminal
 * state — all other states are computed.
 */
export function computeStatus(proc: UserProcedureLog, now: Date): ComputedStatus {
  if (proc.status === 'archived') return 'archived';
  const config = getTimelineConfig(proc);
  const elapsedDays = (now.getTime() - new Date(proc.datePerformed).getTime()) / MS_PER_DAY;
  const elapsedMonths = elapsedDays / DAYS_PER_MONTH;
  if (config.rehabDays > 0 && elapsedDays <= config.rehabDays) return 'rehab';
  if (elapsedMonths >= config.totalEffectMonths) return 'completed';
  if (elapsedMonths >= config.fadeTriggerMonth) return 'fading';
  return 'active';
}

/**
 * Returns a progress ratio in [0, 1] representing how far through the
 * total effect window the procedure is (capped at 1.0).
 */
export function getProgress(proc: UserProcedureLog, now: Date): number {
  const config = getTimelineConfig(proc);
  const elapsedDays = (now.getTime() - new Date(proc.datePerformed).getTime()) / MS_PER_DAY;
  const elapsedMonths = elapsedDays / DAYS_PER_MONTH;
  return Math.min(elapsedMonths / config.totalEffectMonths, 1);
}
