/**
 * Fixtures for the metabolism-feedback-loop suite.
 *
 * Spec:        docs/specs/metabolism-feedback-loop.md
 * Tech design: docs/tech-design/metabolism-feedback-loop.md §2, §3 FE-5..FE-8
 *
 * Written tests-first: CalibrationEntry, UserProcedureLog.expectedMonths,
 * src/domain/procedureActions.ts, ProcedureDurationFeedbackModal and
 * CalibrationCard do not exist yet, so `tsc` and the suites fail until the
 * engineer implements them. That is expected at this pipeline stage.
 *
 * ── BINDING CONTRACT (engineer must implement exactly this) ──────────────
 *
 * Domain (src/domain/procedureActions.ts) — tech design §2:
 *   logProcedure(log): void              adds to proceduresStore; for non-custom
 *                                        logs stamps expectedMonths from
 *                                        getBaselineMonths ONLY when a
 *                                        calibration entry exists (else the
 *                                        field stays absent); custom: never.
 *   archiveProcedure(id, reportedMonths: number | null)
 *        -> { status: 'skipped' | 'calibrated' | 'invalid'; from?; to? }
 *        null / custom proc  -> archive, status 'skipped', no realDuration
 *        valid               -> archive + realDuration + calibration sample,
 *                               status 'calibrated', from = old baseline, to = new
 *        invalid (<0.5, >60, NaN, <=0) -> NO write at all, status 'invalid'
 *   resetCalibration(key): void          deletes that key's entry only.
 *   Stores are read through getState() (profileStore / proceduresStore).
 *
 * ProcedureDurationFeedbackModal (src/components/clinic/...):
 *   props { proc: UserProcedureLog | null;          // null hides the modal
 *           onConfirm: (reportedMonths: number | null) => void;
 *           onCancel: () => void }
 *   Radio rows (role "radio", matched by name): /about as expected/i,
 *   /different length/i, /skip/i. Skip is the default selection.
 *   "As expected" confirms with the lifespan of THIS log
 *   (getTimelineConfig(proc).totalEffectMonths); Skip confirms with null.
 *   The month Input (TID.input, keyboardType decimal-pad) renders ONLY while
 *   "A different length" is selected. Invalid/empty text -> Confirm has
 *   accessibilityState.disabled === true, onConfirm never fires, and an
 *   error text matching /0\.5.{1,3}60/ is visible (TID.error).
 *   Cancel button and backdrop call onCancel only.
 *
 * CalibrationCard (src/components/clinic/CalibrationCard.tsx):
 *   props { procedureKey: CosmeticProcedureKey;
 *           entry?: CalibrationEntry; onReset: () => void }
 *   Empty:  text "Using the clinical default (N months)." + info alert
 *           (TID.emptyAlert); no Reset button.
 *   Calibrated: default row, estimate row (formatMonths, e.g. "5.0 months"),
 *           Tag "1 report" / "N reports", Reset button -> Alert.alert(
 *           'Reset estimate?', msg, [Cancel, Reset]); the Reset button's
 *           onPress calls onReset().
 *
 * ClinicScreen: "Move to history" on non-custom -> modal (TID.modal) instead
 *   of archiving; Confirm -> archiveProcedure; calibrated -> Toast text
 *   "Estimate updated". Custom -> archive immediately, no modal.
 *   AddProcedureModal.onSave -> logProcedure.
 * ProcedureDetailScreen: CalibrationCard (TID.card) for non-custom procs only,
 *   fed from profile.individualDurationMonths; onReset -> resetCalibration.
 */
import type { CalibrationEntry, CosmeticProcedureKey, UserProcedureLog, UserProfile } from '@/types';
import type { ProcedureDurationFeedbackModalProps } from '@/components/clinic/ProcedureDurationFeedbackModal';
import type { CalibrationCardProps } from '@/components/clinic/CalibrationCard';

// ─── testID contract ─────────────────────────────────────────────────────────

export const TID = {
  modal: 'duration-feedback-modal',
  backdrop: 'duration-feedback-backdrop',
  input: 'duration-input',
  error: 'duration-error',
  confirm: 'duration-confirm',
  cancel: 'duration-cancel',
  card: 'calibration-card',
  defaultValue: 'calibration-default',
  estimateValue: 'calibration-estimate',
  reportsTag: 'calibration-reports-tag',
  emptyAlert: 'calibration-empty-alert',
  reset: 'calibration-reset',
} as const;

export const OPTION = {
  expected: /about as expected/i,
  different: /different length/i,
  skip: /skip/i,
} as const;

// ─── Domain fixtures ─────────────────────────────────────────────────────────

export function makeProfile(
  individualDurationMonths: Partial<Record<CosmeticProcedureKey, CalibrationEntry>> = {},
): UserProfile {
  return {
    id: 'local-user',
    gender: null,
    age: null,
    skinType: null,
    phototype: null,
    fitzpatrick: null,
    city: null,
    concerns: [],
    skinConditions: [],
    primaryGoal: 'maintenance',
    secondaryGoal: null,
    goalNeedsConfirmation: false,
    phototypeNeedsConfirmation: false,
    spfSensitivity: false,
    onboardingCompleted: true,
    individualDurationMonths,
    contributionConsent: { granted: false, timestamp: null },
    hormoneTherapy: false,
    pregnantOrBreastfeeding: false,
    sensitive: false,
  };
}

export function makeProcedureLog(overrides: Partial<UserProcedureLog> = {}): UserProcedureLog {
  return {
    id: 'proc-botox-1',
    procedureKey: 'botox',
    datePerformed: '2026-03-12',
    status: 'active',
    deferralCount: 0,
    ...overrides,
  };
}

export function makeCustomProcedureLog(overrides: Partial<UserProcedureLog> = {}): UserProcedureLog {
  return makeProcedureLog({
    id: 'proc-custom-1',
    procedureKey: 'custom',
    customName: 'Laser touch-up',
    customRehabDays: 3,
    estimatedReturnDate: '2026-09-12',
    ...overrides,
  });
}

export function makeRehabProcedureLog(overrides: Partial<UserProcedureLog> = {}): UserProcedureLog {
  return makeProcedureLog({ id: 'proc-botox-rehab', status: 'rehab', ...overrides });
}

// ─── Component prop factories (typed with the real prop types) ───────────────

export function makeDurationModalProps(
  overrides: Partial<ProcedureDurationFeedbackModalProps> = {},
): ProcedureDurationFeedbackModalProps {
  return {
    proc: makeProcedureLog(),
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
    ...overrides,
  };
}

export function makeCalibrationCardProps(
  overrides: Partial<CalibrationCardProps> = {},
): CalibrationCardProps {
  return {
    procedureKey: 'botox',
    entry: undefined,
    onReset: jest.fn(),
    ...overrides,
  };
}

// ─── Shared mock helpers ─────────────────────────────────────────────────────

/** Invalid month inputs the spec requires to be rejected (Story 1). */
export const INVALID_MONTH_TEXTS = ['0', '-3', '0.4', '60.5', 'abc'] as const;

// ─── Text helpers ────────────────────────────────────────────────────────────

type TextNode = { children?: unknown[] } | string | null | undefined;

/** Concatenated visible text of a rendered node (host Text or any wrapper). */
export function textOf(node: TextNode): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  return (node.children ?? []).map((c) => textOf(c as TextNode)).join('');
}

/** Literal string -> escaped RegExp; RegExp passes through. */
export function toRegExp(pattern: string | RegExp): RegExp {
  return typeof pattern === 'string'
    ? new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    : pattern;
}
