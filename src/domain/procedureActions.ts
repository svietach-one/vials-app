import { useProceduresStore } from '@/store/proceduresStore';
import { useProfileStore } from '@/store/profileStore';
import type { CosmeticProcedureKey, UserProcedureLog } from '@/types';
import {
  applyCalibrationSample,
  getBaselineMonths,
  validateReportedMonths,
} from '@/utils/metabolismCalibration';

/**
 * Domain actions for the metabolism feedback loop. They span the procedures
 * and profile stores, so screens call these instead of composing store writes
 * (same convention as productActions.ts).
 */

export interface ArchiveResult {
  status: 'skipped' | 'calibrated' | 'invalid';
  /** Baseline (months) before this report; only on 'calibrated'. */
  from?: number;
  /** Baseline (months) after this report; only on 'calibrated'. */
  to?: number;
}

/**
 * Adds a procedure log. A pre-defined log is stamped with the user's current
 * calibrated baseline (`expectedMonths`) so later recalibration never shifts
 * it; with no calibration (or for custom logs) the field stays absent.
 */
export function logProcedure(log: UserProcedureLog): void {
  const individual = useProfileStore.getState().profile?.individualDurationMonths ?? {};
  const entry = log.procedureKey === 'custom' ? undefined : individual[log.procedureKey];
  const stamped = entry ? { ...log, expectedMonths: entry.months } : log;
  useProceduresStore.getState().addProcedure(stamped);
}

/**
 * Moves a procedure to history. With a valid reported duration (months) on a
 * pre-defined procedure it also stamps `realDuration` and folds the report
 * into the user's calibration. `null` or a custom procedure only archives;
 * an unknown id or an already-archived log is a no-op ('skipped'); an out-of-range report writes nothing ('invalid').
 */
export function archiveProcedure(id: string, reportedMonths: number | null): ArchiveResult {
  const { procedures, updateProcedure } = useProceduresStore.getState();
  const proc = procedures.find((p) => p.id === id);
  // Unknown id or already in history: a second report must never recalibrate or restamp.
  if (!proc || proc.status === 'archived') return { status: 'skipped' };

  if (reportedMonths === null || proc.procedureKey === 'custom') {
    updateProcedure(id, { status: 'archived' });
    return { status: 'skipped' };
  }

  const checked = validateReportedMonths(reportedMonths);
  if (!checked.ok) return { status: 'invalid' };

  return calibrateAndArchive(id, proc.procedureKey, checked.months);
}

function calibrateAndArchive(
  id: string,
  key: CosmeticProcedureKey,
  months: number,
): ArchiveResult {
  const { profile, updateProfile } = useProfileStore.getState();
  const individual = profile?.individualDurationMonths ?? {};
  const from = getBaselineMonths(key, individual);
  const next = applyCalibrationSample(key, months, individual);

  updateProfile({ individualDurationMonths: next });
  useProceduresStore.getState().updateProcedure(id, { status: 'archived', realDuration: months });
  return { status: 'calibrated', from, to: getBaselineMonths(key, next) };
}

/** Deletes one procedure's calibration; archived logs and existing logs are untouched. */
export function resetCalibration(key: CosmeticProcedureKey): void {
  const { profile, updateProfile } = useProfileStore.getState();
  const current = profile?.individualDurationMonths ?? {};
  if (current[key] === undefined) return;
  const { [key]: _removed, ...rest } = current;
  updateProfile({ individualDurationMonths: rest });
}
