import {
  buildRehabNotices,
  getRehabDays,
} from '@/utils/routineEngine/rehabFilter';
import type { UserProcedureLog } from '@/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeProcedure(overrides: Partial<UserProcedureLog> = {}): UserProcedureLog {
  return {
    id: 'proc-1',
    procedureKey: 'custom',
    customName: 'Home peel',
    customRehabDays: 7,
    datePerformed: '2026-07-01',
    status: 'rehab',
    deferralCount: 0,
    ...overrides,
  };
}

// ─── getRehabDays ─────────────────────────────────────────────────────────────

describe('getRehabDays', () => {
  it('reads customRehabDays for custom procedures and defaults to 0 when absent', () => {
    expect(getRehabDays(makeProcedure({ customRehabDays: 3 }))).toBe(3);
    expect(getRehabDays(makeProcedure({ customRehabDays: undefined }))).toBe(0);
  });

  it('reads CLINICAL_RULES_DB for pre-defined procedures', () => {
    expect(getRehabDays(makeProcedure({ procedureKey: 'botox' }))).toBe(7);
    expect(getRehabDays(makeProcedure({ procedureKey: 'chemical_peel_deep' }))).toBe(14);
  });
});

// ─── buildRehabNotices ────────────────────────────────────────────────────────

describe('buildRehabNotices', () => {
  it('returns no notices when nothing is in a rehab window', () => {
    expect(buildRehabNotices([], new Date('2026-07-04T12:00:00Z'))).toEqual([]);
  });

  it('emits one notice per procedure with the acute restrictions during the disrupted phase', () => {
    // Botox rehab = 7 days; disrupted while currentDay <= ceil(7/2) = 4.
    const botox = makeProcedure({
      id: 'b1',
      procedureKey: 'botox',
      customName: undefined,
      customRehabDays: undefined,
      datePerformed: '2026-07-01',
    });

    const notices = buildRehabNotices([botox], new Date('2026-07-02T12:00:00Z')); // day 2

    expect(notices).toHaveLength(1);
    expect(notices[0].procedureName).toBe('Botox / Dysport');
    expect(notices[0].currentDay).toBe(2);
    expect(notices[0].barrierStatus).toBe('disrupted');
    expect(notices[0].restrictions).toContain('Stay upright for 4 hours');
  });

  it('drops the restrictions once the barrier is only sensitive (second half of the window)', () => {
    const botox = makeProcedure({
      id: 'b1',
      procedureKey: 'botox',
      customName: undefined,
      customRehabDays: undefined,
      datePerformed: '2026-07-01',
    });

    const notices = buildRehabNotices([botox], new Date('2026-07-06T12:00:00Z')); // day 6 of 7

    expect(notices).toHaveLength(1);
    expect(notices[0].barrierStatus).toBe('sensitive');
    expect(notices[0].restrictions).toEqual([]);
  });

  it('keeps two different procedures as two separate notices (one per procedure)', () => {
    const botox = makeProcedure({
      id: 'b1',
      procedureKey: 'botox',
      customName: undefined,
      customRehabDays: undefined,
      datePerformed: '2026-07-01',
    });
    const fillers = makeProcedure({
      id: 'f1',
      procedureKey: 'fillers',
      customName: undefined,
      customRehabDays: undefined,
      datePerformed: '2026-07-01',
    });

    const notices = buildRehabNotices([botox, fillers], new Date('2026-07-02T12:00:00Z'));

    expect(notices).toHaveLength(2);
    expect(notices.map((n) => n.procedureName).sort()).toEqual(['Botox / Dysport', 'Dermal Fillers']);
  });

  it('merges procedures that share identical restrictions and timeframe into one notice', () => {
    const botoxA = makeProcedure({
      id: 'a',
      procedureKey: 'botox',
      customName: undefined,
      customRehabDays: undefined,
      datePerformed: '2026-07-01',
    });
    const botoxB = makeProcedure({
      id: 'b',
      procedureKey: 'botox',
      customName: undefined,
      customRehabDays: undefined,
      datePerformed: '2026-07-01',
    });

    const notices = buildRehabNotices([botoxA, botoxB], new Date('2026-07-02T12:00:00Z'));

    expect(notices).toHaveLength(1);
    expect(notices[0].key).toBe('a+b');
    expect(notices[0].procedureName).toBe('Botox / Dysport');
  });

  it('does NOT merge two different procedures that share a window length once both are in the sensitive phase', () => {
    // fillers and smas_lifting both have a 14-day window. Past day 7 both are
    // sensitive with empty restrictions, so without procedureKey in the merge
    // signature they would wrongly fuse into one "Dermal Fillers + SMAS
    // Lifting" card.
    const fillers = makeProcedure({
      id: 'f1',
      procedureKey: 'fillers',
      customName: undefined,
      customRehabDays: undefined,
      datePerformed: '2026-07-01',
    });
    const smas = makeProcedure({
      id: 's1',
      procedureKey: 'smas_lifting',
      customName: undefined,
      customRehabDays: undefined,
      datePerformed: '2026-07-01',
    });

    const notices = buildRehabNotices([fillers, smas], new Date('2026-07-08T12:00:00Z')); // day 8 of 14

    expect(notices).toHaveLength(2);
    expect(notices.every((n) => n.barrierStatus === 'sensitive')).toBe(true);
    expect(notices.map((n) => n.procedureName).sort()).toEqual(['Dermal Fillers', 'SMAS Lifting']);
  });

  it('never attaches clinical restrictions to a custom procedure', () => {
    // makeProcedure defaults to a custom procedure in its acute phase (day 1).
    const notices = buildRehabNotices([makeProcedure()], new Date('2026-07-01T12:00:00Z'));

    expect(notices).toHaveLength(1);
    expect(notices[0].barrierStatus).toBe('disrupted');
    expect(notices[0].restrictions).toEqual([]);
  });
});
