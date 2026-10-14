import { CLINICAL_RULES_DB } from '@/types';
import type { CalibrationEntry, ClinicalTimelineConfig, CosmeticProcedureKey } from '@/types';

/**
 * Pure maths for the metabolism feedback loop: a running average of the
 * effect durations the user reports, seeded by the clinical default. No React,
 * no stores — callers pass the current calibration map in and get a new one out.
 */

export const MIN_REPORTED_MONTHS = 0.5;
export const MAX_REPORTED_MONTHS = 60;

export type CalibrationMap = Partial<Record<CosmeticProcedureKey, CalibrationEntry>>;

export type ReportedMonthsResult =
  | { ok: true; months: number }
  | { ok: false; reason: 'not_a_number' | 'too_small' | 'too_large' };

/** Validates a user-reported effect duration (months) against the 0.5-60 bounds. */
export function validateReportedMonths(value: unknown): ReportedMonthsResult {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { ok: false, reason: 'not_a_number' };
  }
  if (value < MIN_REPORTED_MONTHS) return { ok: false, reason: 'too_small' };
  if (value > MAX_REPORTED_MONTHS) return { ok: false, reason: 'too_large' };
  return { ok: true, months: value };
}

/**
 * Parses free text typed into the month field (comma or dot decimal) and
 * validates it. Empty / non-numeric text is `not_a_number`.
 */
export function parseReportedMonthsText(text: string): ReportedMonthsResult {
  const normalized = text.trim().replace(',', '.');
  if (normalized === '') return { ok: false, reason: 'not_a_number' };
  return validateReportedMonths(Number(normalized));
}

/** The user's calibrated estimate for a procedure, or the clinical default. */
export function getBaselineMonths(key: CosmeticProcedureKey, individual: CalibrationMap): number {
  return individual[key]?.months ?? CLINICAL_RULES_DB[key].totalEffectMonths;
}

const roundTo2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Folds one reported duration into the running average.
 * new = (months * (samples + 1) + reported) / (samples + 2); samples += 1.
 * The baseline (calibrated or clinical default) counts as one prior sample, so
 * the very first report averages with the default. Returns a NEW map; an
 * invalid report returns the same map untouched.
 */
export function applyCalibrationSample(
  key: CosmeticProcedureKey,
  reported: number,
  individual: CalibrationMap,
): CalibrationMap {
  const checked = validateReportedMonths(reported);
  if (!checked.ok) return individual;
  const samples = individual[key]?.samples ?? 0;
  const baseline = getBaselineMonths(key, individual);
  const months = (baseline * (samples + 1) + checked.months) / (samples + 2);
  return { ...individual, [key]: { months: roundTo2(months), samples: samples + 1 } };
}

/**
 * Rescales a procedure timeline to a new total duration. The fade point keeps
 * its default fraction of the total; rehab days are medical and never scale.
 */
export function scaleTimelineConfig(
  base: ClinicalTimelineConfig,
  expectedMonths: number,
): ClinicalTimelineConfig {
  const fadeRatio = base.fadeTriggerMonth / base.totalEffectMonths;
  return {
    rehabDays: base.rehabDays,
    totalEffectMonths: expectedMonths,
    fadeTriggerMonth: expectedMonths * fadeRatio,
  };
}

/** One decimal, trailing ".0" kept (5 -> "5.0"). */
export function formatMonths(n: number): string {
  return n.toFixed(1);
}

/**
 * Month count for prose labels: at most one decimal, integers unchanged
 * (4 -> "4", 3.3333 -> "3.3", 4.04 -> "4"). Calibration makes lifespans
 * fractional, so raw interpolation would print "3.333333333333333".
 */
export function formatMonthsCompact(n: number): string {
  return String(Number(n.toFixed(1)));
}
