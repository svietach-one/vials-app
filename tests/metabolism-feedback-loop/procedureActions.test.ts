/**
 * Integration tests — src/domain/procedureActions.ts with REAL stores.
 * Spec stories 1-4. Storage is mocked at the module boundary; stores are
 * reset in beforeEach. The module does not exist yet (tests-first).
 */
import { makeCustomProcedureLog, makeProcedureLog, makeProfile, makeRehabProcedureLog } from './fixtures';

jest.mock('@/services/storage', () => ({
  ...jest.requireActual('@/services/storage'),
  loadJson: jest.fn(async (_k: string, fallback: unknown) => fallback),
  saveJson: jest.fn(async () => undefined),
}));

import { archiveProcedure, logProcedure, resetCalibration } from '@/domain/procedureActions';
import { useProceduresStore } from '@/store/proceduresStore';
import { useProfileStore } from '@/store/profileStore';
import { getTimelineConfig } from '@/utils/procedureLifespanHelpers';

const calib = () => useProfileStore.getState().profile?.individualDurationMonths ?? {};
const proc = (id: string) => useProceduresStore.getState().procedures.find((p) => p.id === id);

function seed(procs = [makeProcedureLog()], individual = {}) {
  useProfileStore.setState({ profile: makeProfile(individual), hydrated: true });
  useProceduresStore.setState({ procedures: procs, hydrated: true });
}

beforeEach(() => {
  jest.clearAllMocks();
  seed([]);
});

describe('archiveProcedure - skip', () => {
  it('archives without realDuration and leaves the baseline untouched when reportedMonths is null', () => {
    seed([makeProcedureLog()], { botox: { months: 5, samples: 2 } });

    const result = archiveProcedure('proc-botox-1', null);

    expect(result.status).toBe('skipped');
    expect(proc('proc-botox-1')?.status).toBe('archived');
    expect(proc('proc-botox-1')?.realDuration).toBeUndefined();
    expect(calib()).toEqual({ botox: { months: 5, samples: 2 } });
  });

  it('archives a custom procedure with no calibration even if a number is passed', () => {
    seed([makeCustomProcedureLog()]);

    const result = archiveProcedure('proc-custom-1', 3);

    expect(result.status).toBe('skipped');
    expect(proc('proc-custom-1')?.status).toBe('archived');
    expect(proc('proc-custom-1')?.realDuration).toBeUndefined();
    expect(calib()).toEqual({});
  });
});

describe('archiveProcedure - valid report', () => {
  it('averages against the clinical default on the first report and archives with realDuration', () => {
    seed([makeProcedureLog()]);

    const result = archiveProcedure('proc-botox-1', 4);

    expect(result).toEqual({ status: 'calibrated', from: 6, to: 5 });
    expect(proc('proc-botox-1')).toMatchObject({ status: 'archived', realDuration: 4 });
    expect(calib().botox).toEqual({ months: 5, samples: 1 });
  });

  it('follows the US-17 example 3.5 then 3.33 then 3.25 with samples 1, 2, 3', () => {
    seed(
      [makeProcedureLog({ id: 'a' }), makeProcedureLog({ id: 'b' }), makeProcedureLog({ id: 'c' })],
      { botox: { months: 4, samples: 0 } },
    );

    archiveProcedure('a', 3);
    expect(calib().botox?.months).toBeCloseTo(3.5, 2);
    expect(calib().botox?.samples).toBe(1);

    archiveProcedure('b', 3);
    expect(calib().botox?.months).toBeCloseTo(3.33, 2);
    expect(calib().botox?.samples).toBe(2);

    archiveProcedure('c', 3);
    expect(calib().botox?.months).toBeCloseTo(3.25, 2);
    expect(calib().botox?.samples).toBe(3);
  });

  it('calibrates a procedure archived during rehab', () => {
    seed([makeRehabProcedureLog()]);

    const result = archiveProcedure('proc-botox-rehab', 4);

    expect(result.status).toBe('calibrated');
    expect(proc('proc-botox-rehab')?.status).toBe('archived');
  });
});

describe('archiveProcedure - invalid report', () => {
  it.each([0, -2, 0.4, 60.5, Number.NaN])(
    'returns invalid and writes nothing for %p',
    (bad) => {
      seed([makeProcedureLog()], { botox: { months: 5, samples: 2 } });

      const result = archiveProcedure('proc-botox-1', bad);

      expect(result.status).toBe('invalid');
      expect(proc('proc-botox-1')).toEqual(makeProcedureLog());
      expect(calib()).toEqual({ botox: { months: 5, samples: 2 } });
    },
  );
});

describe('logProcedure - baseline snapshot', () => {
  it('stamps expectedMonths from the calibrated baseline on a new non-custom log', () => {
    seed([], { botox: { months: 5, samples: 2 } });

    logProcedure(makeProcedureLog({ id: 'new' }));

    expect(proc('new')?.expectedMonths).toBe(5);
    expect(getTimelineConfig(proc('new')!)).toMatchObject({
      totalEffectMonths: 5,
      rehabDays: 7,
    });
    expect(getTimelineConfig(proc('new')!).fadeTriggerMonth).toBeCloseTo(5 * (4 / 6), 5);
  });

  it('leaves the log unchanged when there is no calibration', () => {
    seed([]);

    logProcedure(makeProcedureLog({ id: 'new' }));

    expect(proc('new')).toEqual(makeProcedureLog({ id: 'new' }));
    expect(proc('new')?.expectedMonths).toBeUndefined();
    expect(getTimelineConfig(proc('new')!)).toMatchObject({ totalEffectMonths: 6, fadeTriggerMonth: 4 });
  });

  it('never stamps expectedMonths on a custom log', () => {
    seed([], { botox: { months: 5, samples: 2 } });

    logProcedure(makeCustomProcedureLog({ id: 'c' }));

    expect(proc('c')?.expectedMonths).toBeUndefined();
  });

  it('does not alter existing logs when the baseline later changes', () => {
    seed([], { botox: { months: 5, samples: 2 } });
    logProcedure(makeProcedureLog({ id: 'first' }));
    logProcedure(makeProcedureLog({ id: 'second' }));

    archiveProcedure('second', 1);

    expect(calib().botox?.months).not.toBe(5);
    expect(proc('first')?.expectedMonths).toBe(5);
  });
});

describe('resetCalibration', () => {
  it('removes only that key and keeps archived realDuration and existing logs', () => {
    seed(
      [makeProcedureLog({ id: 'done', status: 'archived', realDuration: 4, expectedMonths: 5 })],
      { botox: { months: 5, samples: 2 }, fillers: { months: 10, samples: 1 } },
    );

    resetCalibration('botox');

    expect(calib()).toEqual({ fillers: { months: 10, samples: 1 } });
    expect(proc('done')).toMatchObject({ realDuration: 4, expectedMonths: 5, status: 'archived' });
  });

  it('makes new logs use the clinical default again', () => {
    seed([], { botox: { months: 5, samples: 2 } });

    resetCalibration('botox');
    logProcedure(makeProcedureLog({ id: 'after' }));

    expect(proc('after')?.expectedMonths).toBeUndefined();
  });
});
