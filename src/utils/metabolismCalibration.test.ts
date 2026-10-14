import { CLINICAL_RULES_DB } from '@/types';
import type { CosmeticProcedureKey } from '@/types';
import {
  applyCalibrationSample,
  formatMonths,
  getBaselineMonths,
  parseReportedMonthsText,
  scaleTimelineConfig,
  validateReportedMonths,
} from './metabolismCalibration';

const KEYS = Object.keys(CLINICAL_RULES_DB) as CosmeticProcedureKey[];

describe('validateReportedMonths', () => {
  it.each([0.5, 1, 4.5, 60])('accepts %p as a valid duration', (value) => {
    expect(validateReportedMonths(value)).toEqual({ ok: true, months: value });
  });

  it.each([0, -3, 0.49])('rejects %p as too small', (value) => {
    expect(validateReportedMonths(value)).toEqual({ ok: false, reason: 'too_small' });
  });

  it('rejects values above 60 as too large', () => {
    expect(validateReportedMonths(60.5)).toEqual({ ok: false, reason: 'too_large' });
  });

  it.each([Number.NaN, Infinity, '4', null, undefined])('rejects %p as not a number', (value) => {
    expect(validateReportedMonths(value)).toEqual({ ok: false, reason: 'not_a_number' });
  });
});

describe('parseReportedMonthsText', () => {
  it.each([
    ['4.5', 4.5],
    [' 3 ', 3],
    ['2,5', 2.5],
  ])('parses %p as %p months', (text, months) => {
    expect(parseReportedMonthsText(text)).toEqual({ ok: true, months });
  });

  it.each(['', '   ', 'abc', '4 months'])('rejects %p as not a number', (text) => {
    expect(parseReportedMonthsText(text)).toEqual({ ok: false, reason: 'not_a_number' });
  });

  it('applies the range bounds to parsed text', () => {
    expect(parseReportedMonthsText('0.4')).toEqual({ ok: false, reason: 'too_small' });
    expect(parseReportedMonthsText('61')).toEqual({ ok: false, reason: 'too_large' });
  });
});

describe('getBaselineMonths', () => {
  it('returns the clinical default when there is no entry', () => {
    expect(getBaselineMonths('botox', {})).toBe(6);
  });

  it('returns the calibrated estimate when an entry exists', () => {
    expect(getBaselineMonths('botox', { botox: { months: 4.5, samples: 2 } })).toBe(4.5);
  });
});

describe('applyCalibrationSample', () => {
  it('averages the first report with the clinical default as one prior sample', () => {
    const result = applyCalibrationSample('botox', 4, {});

    expect(result.botox).toEqual({ months: 5, samples: 1 });
  });

  it('follows the US-17 example 3.5, 3.33, 3.25 with samples 1, 2, 3', () => {
    const first = applyCalibrationSample('botox', 3, { botox: { months: 4, samples: 0 } });
    const second = applyCalibrationSample('botox', 3, first);
    const third = applyCalibrationSample('botox', 3, second);

    expect(first.botox).toEqual({ months: 3.5, samples: 1 });
    expect(second.botox).toEqual({ months: 3.33, samples: 2 });
    expect(third.botox).toEqual({ months: 3.25, samples: 3 });
  });

  it('keeps other procedures untouched', () => {
    const input = { fillers: { months: 10, samples: 1 } };

    const result = applyCalibrationSample('botox', 4, input);

    expect(result.fillers).toBe(input.fillers);
  });

  it('does not mutate the input map or its entries', () => {
    const entry = { months: 5, samples: 2 };
    const input = { botox: entry };

    const result = applyCalibrationSample('botox', 3, input);

    expect(result).not.toBe(input);
    expect(input).toEqual({ botox: { months: 5, samples: 2 } });
    expect(entry).toEqual({ months: 5, samples: 2 });
  });

  it.each([0, -1, 0.4, 60.5, Number.NaN])('returns the same map for invalid report %p', (bad) => {
    const input = { botox: { months: 5, samples: 2 } };

    expect(applyCalibrationSample('botox', bad, input)).toBe(input);
  });

  it('rounds the stored estimate to two decimals', () => {
    const result = applyCalibrationSample('botox', 3, { botox: { months: 3.5, samples: 1 } });

    expect(result.botox?.months).toBe(3.33);
  });
});

describe('scaleTimelineConfig', () => {
  it.each(KEYS)('keeps rehab days and the fade ratio for %s', (key) => {
    const base = CLINICAL_RULES_DB[key];

    const scaled = scaleTimelineConfig(base, base.totalEffectMonths * 0.5);

    expect(scaled.rehabDays).toBe(base.rehabDays);
    expect(scaled.totalEffectMonths).toBeCloseTo(base.totalEffectMonths * 0.5, 10);
    expect(scaled.fadeTriggerMonth / scaled.totalEffectMonths).toBeCloseTo(
      base.fadeTriggerMonth / base.totalEffectMonths,
      10,
    );
  });

  it('scales botox from 6 to 5 months with the fade point at two thirds', () => {
    const scaled = scaleTimelineConfig(CLINICAL_RULES_DB.botox, 5);

    expect(scaled).toEqual({ rehabDays: 7, totalEffectMonths: 5, fadeTriggerMonth: 5 * (4 / 6) });
  });

  it('does not mutate the base config', () => {
    const base = { rehabDays: 7, totalEffectMonths: 6, fadeTriggerMonth: 4 };

    scaleTimelineConfig(base, 3);

    expect(base).toEqual({ rehabDays: 7, totalEffectMonths: 6, fadeTriggerMonth: 4 });
  });
});

describe('formatMonths', () => {
  it('keeps a trailing .0 for whole numbers', () => {
    expect(formatMonths(5)).toBe('5.0');
  });

  it('rounds to one decimal', () => {
    expect(formatMonths(3.33)).toBe('3.3');
  });
});
