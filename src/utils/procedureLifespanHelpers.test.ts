/**
 * Integration tests for procedureLifespanHelpers
 *
 * Verifies computeStatus() and getProgress() using concrete date arithmetic
 * against the CLINICAL_RULES_DB constants.
 *
 * CLINICAL_RULES_DB (relevant entries for these tests):
 *   botox:               rehabDays=7,  totalEffectMonths=6,  fadeTriggerMonth=4
 *   fillers:             rehabDays=14, totalEffectMonths=12, fadeTriggerMonth=10
 *   chemical_peel_deep:  rehabDays=14, totalEffectMonths=3,  fadeTriggerMonth=2
 *   mesotherapy:         rehabDays=5,  totalEffectMonths=6,  fadeTriggerMonth=5
 *   mechanical_facial:   rehabDays=3,  totalEffectMonths=1,  fadeTriggerMonth=1
 *   smas_lifting:        rehabDays=14, totalEffectMonths=18, fadeTriggerMonth=14
 *
 * Note on floating-point arithmetic: the source uses DAYS_PER_MONTH=30.44 internally.
 * When tests compute exactly N*DAYS_PER_MONTH*MS_PER_DAY and then divide back, floating-
 * point rounding can produce 5.9999... instead of 6.0. Tests that target boundary
 * transitions therefore add a small epsilon (0.05 months) to ensure they land
 * clearly on the correct side of the threshold, which reflects realistic usage.
 */

import {
  computeStatus,
  getProcedureDisplayName,
  getProgress,
  getTimelineConfig,
} from '@/utils/procedureLifespanHelpers';
import type { UserProcedureLog } from '@/types';

// ─── Factory ──────────────────────────────────────────────────────────────────

let _idCounter = 0;
function makeProc(
  overrides: Partial<UserProcedureLog> & Pick<UserProcedureLog, 'procedureKey' | 'datePerformed'>,
): UserProcedureLog {
  return {
    id: `proc-${++_idCounter}`,
    status: 'rehab',
    deferralCount: 0,
    realDuration: undefined,
    ...overrides,
  };
}

/** Returns a Date that is `days` calendar days after the given ISO date string */
function daysAfter(isoDate: string, days: number): Date {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Returns a Date that is approximately `months` months after the given ISO date string.
 * Uses 30.44 days/month (same constant as the source).
 * Add a small epsilon (+0.05 months) when you need to land clearly past a threshold.
 */
function monthsAfter(isoDate: string, months: number): Date {
  const DAYS_PER_MONTH = 30.44;
  const base = new Date(isoDate).getTime();
  return new Date(base + months * DAYS_PER_MONTH * 86_400_000);
}

// ─── computeStatus — botox (rehabDays=7, totalEffectMonths=6, fadeTriggerMonth=4) ──

describe('computeStatus — botox', () => {
  const DATE = '2026-01-01';

  it('should return rehab when elapsed days are within the rehabDays window (day 3)', () => {
    const proc = makeProc({ procedureKey: 'botox', datePerformed: DATE });
    const now = daysAfter(DATE, 3);

    expect(computeStatus(proc, now)).toBe('rehab');
  });

  it('should return rehab on exactly the last rehab day (day 7)', () => {
    const proc = makeProc({ procedureKey: 'botox', datePerformed: DATE });
    const now = daysAfter(DATE, 7);

    expect(computeStatus(proc, now)).toBe('rehab');
  });

  it('should return active when elapsed months are past rehab but before fadeTriggerMonth', () => {
    const proc = makeProc({ procedureKey: 'botox', datePerformed: DATE });
    // 2 months in — past 7-day rehab, before 4-month fade trigger
    const now = monthsAfter(DATE, 2);

    expect(computeStatus(proc, now)).toBe('active');
  });

  it('should return fading when elapsed months clearly reach the fadeTriggerMonth (4+ months)', () => {
    const proc = makeProc({ procedureKey: 'botox', datePerformed: DATE });
    // 4.1 months to land clearly past the fadeTriggerMonth=4 threshold
    const now = monthsAfter(DATE, 4.1);

    expect(computeStatus(proc, now)).toBe('fading');
  });

  it('should return fading when elapsed months are between fadeTriggerMonth and totalEffectMonths', () => {
    const proc = makeProc({ procedureKey: 'botox', datePerformed: DATE });
    const now = monthsAfter(DATE, 5);

    expect(computeStatus(proc, now)).toBe('fading');
  });

  it('should return completed when elapsed months clearly exceed totalEffectMonths (6+ months)', () => {
    const proc = makeProc({ procedureKey: 'botox', datePerformed: DATE });
    // 6.1 months to land clearly past the totalEffectMonths=6 threshold
    const now = monthsAfter(DATE, 6.1);

    expect(computeStatus(proc, now)).toBe('completed');
  });

  it('should return completed well past the totalEffectMonths window', () => {
    const proc = makeProc({ procedureKey: 'botox', datePerformed: DATE });
    const now = monthsAfter(DATE, 8);

    expect(computeStatus(proc, now)).toBe('completed');
  });

  it('should return archived regardless of elapsed time when stored status is archived', () => {
    const proc = makeProc({ procedureKey: 'botox', datePerformed: DATE, status: 'archived' });
    // Even if it is day 1, archived overrides everything
    const now = daysAfter(DATE, 1);

    expect(computeStatus(proc, now)).toBe('archived');
  });
});

// ─── computeStatus — fillers (rehabDays=14, totalEffectMonths=12, fadeTriggerMonth=10) ──

describe('computeStatus — fillers', () => {
  const DATE = '2026-01-01';

  it('should return rehab on day 10 (within 14-day rehab window)', () => {
    const proc = makeProc({ procedureKey: 'fillers', datePerformed: DATE });
    expect(computeStatus(proc, daysAfter(DATE, 10))).toBe('rehab');
  });

  it('should return active at 3 months (past 14-day rehab, before 10-month fade trigger)', () => {
    const proc = makeProc({ procedureKey: 'fillers', datePerformed: DATE });
    expect(computeStatus(proc, monthsAfter(DATE, 3))).toBe('active');
  });

  it('should return fading past the fadeTriggerMonth (10.1 months)', () => {
    const proc = makeProc({ procedureKey: 'fillers', datePerformed: DATE });
    // 10.1 to land clearly past fadeTriggerMonth=10
    expect(computeStatus(proc, monthsAfter(DATE, 10.1))).toBe('fading');
  });

  it('should return completed well past totalEffectMonths (13 months)', () => {
    const proc = makeProc({ procedureKey: 'fillers', datePerformed: DATE });
    expect(computeStatus(proc, monthsAfter(DATE, 13))).toBe('completed');
  });
});

// ─── computeStatus — chemical_peel_deep (rehabDays=14, totalEffectMonths=3, fadeTriggerMonth=2) ──

describe('computeStatus — chemical_peel_deep', () => {
  const DATE = '2026-03-01';

  it('should return rehab on day 7 (within 14-day rehab window)', () => {
    const proc = makeProc({ procedureKey: 'chemical_peel_deep', datePerformed: DATE });
    expect(computeStatus(proc, daysAfter(DATE, 7))).toBe('rehab');
  });

  it('should return active at 1 month (past 14-day rehab, before 2-month fade trigger)', () => {
    const proc = makeProc({ procedureKey: 'chemical_peel_deep', datePerformed: DATE });
    expect(computeStatus(proc, monthsAfter(DATE, 1))).toBe('active');
  });

  it('should return fading past the fadeTriggerMonth (2.1 months)', () => {
    const proc = makeProc({ procedureKey: 'chemical_peel_deep', datePerformed: DATE });
    expect(computeStatus(proc, monthsAfter(DATE, 2.1))).toBe('fading');
  });

  it('should return completed well past totalEffectMonths (3.1 months)', () => {
    const proc = makeProc({ procedureKey: 'chemical_peel_deep', datePerformed: DATE });
    expect(computeStatus(proc, monthsAfter(DATE, 3.1))).toBe('completed');
  });
});

// ─── computeStatus — mechanical_facial (rehabDays=3, totalEffectMonths=1, fadeTriggerMonth=1) ──

describe('computeStatus — mechanical_facial', () => {
  const DATE = '2026-06-01';

  it('should return rehab on day 1 (within 3-day rehab window)', () => {
    const proc = makeProc({ procedureKey: 'mechanical_facial', datePerformed: DATE });
    expect(computeStatus(proc, daysAfter(DATE, 1))).toBe('rehab');
  });

  it('should return completed past 1 month (fadeTriggerMonth equals totalEffectMonths, completed wins)', () => {
    // For mechanical_facial fadeTriggerMonth === totalEffectMonths === 1.
    // The source checks >= totalEffectMonths before >= fadeTriggerMonth, so completed wins.
    const proc = makeProc({ procedureKey: 'mechanical_facial', datePerformed: DATE });
    expect(computeStatus(proc, monthsAfter(DATE, 1.1))).toBe('completed');
  });
});

// ─── getProgress ──────────────────────────────────────────────────────────────

describe('getProgress', () => {
  const DATE = '2026-01-01';

  it('should return 0 at the moment of procedure (no time elapsed)', () => {
    const proc = makeProc({ procedureKey: 'botox', datePerformed: DATE });
    const now = new Date(DATE);

    const result = getProgress(proc, now);

    expect(result).toBeCloseTo(0, 5);
  });

  it('should return approximately 0.5 at half the botox total effect window (3 months)', () => {
    const proc = makeProc({ procedureKey: 'botox', datePerformed: DATE });
    const now = monthsAfter(DATE, 3); // totalEffectMonths = 6, so 3/6 = 0.5

    const result = getProgress(proc, now);

    expect(result).toBeCloseTo(0.5, 1);
  });

  it('should cap progress at 1 when elapsed months clearly exceed totalEffectMonths', () => {
    const proc = makeProc({ procedureKey: 'botox', datePerformed: DATE });
    const now = monthsAfter(DATE, 10); // well past the 6-month window

    const result = getProgress(proc, now);

    expect(result).toBe(1);
  });

  it('should return a value between 0 and 1 at the fade trigger month for botox (~0.67)', () => {
    const proc = makeProc({ procedureKey: 'botox', datePerformed: DATE });
    const now = monthsAfter(DATE, 4.1); // just past fadeTriggerMonth=4, totalEffectMonths=6

    const result = getProgress(proc, now);

    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
    expect(result).toBeCloseTo(4.1 / 6, 1);
  });

  it('should return a small positive value for a 1-day-old botox procedure', () => {
    const proc = makeProc({ procedureKey: 'botox', datePerformed: DATE });
    const now = daysAfter(DATE, 1);
    const DAYS_PER_MONTH = 30.44;
    const expected = (1 / DAYS_PER_MONTH) / 6;

    const result = getProgress(proc, now);

    expect(result).toBeCloseTo(expected, 4);
    expect(result).toBeGreaterThan(0);
  });

  it('should compute progress relative to totalEffectMonths for fillers (12 months)', () => {
    const proc = makeProc({ procedureKey: 'fillers', datePerformed: DATE });
    const now = monthsAfter(DATE, 6); // half of 12 months

    const result = getProgress(proc, now);

    expect(result).toBeCloseTo(0.5, 1);
  });

  it('should return progress greater than 0.66 at the fade trigger month for botox (4/6)', () => {
    const proc = makeProc({ procedureKey: 'botox', datePerformed: DATE });
    const now = monthsAfter(DATE, 4.1);

    const result = getProgress(proc, now);

    expect(result).toBeGreaterThan(0.66);
    expect(result).toBeLessThan(0.72);
  });
});

// ─── Custom procedures ────────────────────────────────────────────────────────
//
// Custom procedures have no CLINICAL_RULES_DB entry. Their timeline is derived
// from the span between datePerformed and estimatedReturnDate:
//   totalEffectMonths = spanDays / 30.44
//   fadeTriggerMonth  = totalEffectMonths * 0.75
//   rehabDays         = 0 (no clinical rehab rules)
//
// Fixture: performed 2026-01-01, return 2026-07-01 → 181-day span,
// fading threshold at 75% ≈ day 136.

const CUSTOM_PERFORMED = '2026-01-01';
const CUSTOM_RETURN = '2026-07-01';
const CUSTOM_SPAN_DAYS = 181;

function makeCustomProc(overrides: Partial<UserProcedureLog> = {}): UserProcedureLog {
  return makeProc({
    procedureKey: 'custom',
    customName: 'Laser Resurfacing',
    datePerformed: CUSTOM_PERFORMED,
    estimatedReturnDate: CUSTOM_RETURN,
    status: 'active',
    ...overrides,
  });
}

describe('getTimelineConfig — custom', () => {
  it('should derive totalEffectMonths from the performed-to-return date span', () => {
    const proc = makeCustomProc();

    const config = getTimelineConfig(proc);

    expect(config.totalEffectMonths).toBeCloseTo(CUSTOM_SPAN_DAYS / 30.44, 5);
  });

  it('should place the fade trigger at 75% of the derived lifespan', () => {
    const proc = makeCustomProc();

    const config = getTimelineConfig(proc);

    expect(config.fadeTriggerMonth).toBeCloseTo(config.totalEffectMonths * 0.75, 5);
  });

  it('should have no rehab window when the log carries no customRehabDays', () => {
    const proc = makeCustomProc();

    expect(getTimelineConfig(proc).rehabDays).toBe(0);
  });

  it('should use the user-resolved customRehabDays as the rehab window (FE-10)', () => {
    const proc = makeCustomProc({ customRehabDays: 7 });

    expect(getTimelineConfig(proc).rehabDays).toBe(7);
  });

  it('should clamp to a minimum 1-day span when the return date equals the performed date', () => {
    const proc = makeCustomProc({ estimatedReturnDate: CUSTOM_PERFORMED });

    const config = getTimelineConfig(proc);

    expect(config.totalEffectMonths).toBeCloseTo(1 / 30.44, 5);
  });

  it('should clamp to a minimum 1-day span when the return date is before the performed date', () => {
    const proc = makeCustomProc({ estimatedReturnDate: '2025-06-01' }); // before CUSTOM_PERFORMED

    const config = getTimelineConfig(proc);

    expect(config.totalEffectMonths).toBeCloseTo(1 / 30.44, 5);
  });

  it('should clamp to a minimum 1-day span when estimatedReturnDate is missing', () => {
    const proc = makeCustomProc({ estimatedReturnDate: undefined });

    const config = getTimelineConfig(proc);

    expect(config.totalEffectMonths).toBeCloseTo(1 / 30.44, 5);
  });

  it('should return the CLINICAL_RULES_DB config unchanged for pre-defined procedures', () => {
    const proc = makeProc({ procedureKey: 'botox', datePerformed: CUSTOM_PERFORMED });

    const config = getTimelineConfig(proc);

    expect(config).toEqual({ rehabDays: 7, totalEffectMonths: 6, fadeTriggerMonth: 4 });
  });
});

describe('computeStatus — custom', () => {
  it('should return active on day 1 when no recovery window was specified', () => {
    const proc = makeCustomProc();

    expect(computeStatus(proc, daysAfter(CUSTOM_PERFORMED, 1))).toBe('active');
  });

  it('should return rehab inside a user-resolved customRehabDays window (FE-10)', () => {
    const proc = makeCustomProc({ customRehabDays: 7 });

    expect(computeStatus(proc, daysAfter(CUSTOM_PERFORMED, 3))).toBe('rehab');
    expect(computeStatus(proc, daysAfter(CUSTOM_PERFORMED, 10))).toBe('active');
  });

  it('should return active before 75% of the lifespan (day 100 of 181)', () => {
    const proc = makeCustomProc();

    expect(computeStatus(proc, daysAfter(CUSTOM_PERFORMED, 100))).toBe('active');
  });

  it('should return fading past 75% of the lifespan (day 140 of 181)', () => {
    const proc = makeCustomProc();

    expect(computeStatus(proc, daysAfter(CUSTOM_PERFORMED, 140))).toBe('fading');
  });

  it('should return completed after the estimated return date (day 182 of 181)', () => {
    const proc = makeCustomProc();

    expect(computeStatus(proc, daysAfter(CUSTOM_PERFORMED, 182))).toBe('completed');
  });

  it('should return archived regardless of elapsed time when stored status is archived', () => {
    const proc = makeCustomProc({ status: 'archived' });

    expect(computeStatus(proc, daysAfter(CUSTOM_PERFORMED, 1))).toBe('archived');
  });
});

describe('getProgress — custom', () => {
  it('should return 0 at the moment of the procedure', () => {
    const proc = makeCustomProc();

    expect(getProgress(proc, new Date(CUSTOM_PERFORMED))).toBeCloseTo(0, 5);
  });

  it('should return approximately 0.5 halfway to the estimated return date', () => {
    const proc = makeCustomProc();
    const now = daysAfter(CUSTOM_PERFORMED, Math.round(CUSTOM_SPAN_DAYS / 2));

    expect(getProgress(proc, now)).toBeCloseTo(0.5, 1);
  });

  it('should cap progress at 1 past the estimated return date', () => {
    const proc = makeCustomProc();

    expect(getProgress(proc, daysAfter(CUSTOM_PERFORMED, 250))).toBe(1);
  });
});

describe('getProcedureDisplayName', () => {
  it('should return the user-provided name for custom procedures', () => {
    const proc = makeCustomProc();

    expect(getProcedureDisplayName(proc)).toBe('Laser Resurfacing');
  });

  it('should fall back to a generic label when a custom procedure has no name', () => {
    const proc = makeCustomProc({ customName: undefined });

    expect(getProcedureDisplayName(proc)).toBe('Custom procedure');
  });

  it('should return the catalog label for pre-defined procedures', () => {
    const proc = makeProc({ procedureKey: 'botox', datePerformed: CUSTOM_PERFORMED });

    expect(getProcedureDisplayName(proc)).toBe('Botox / Dysport');
  });
});
