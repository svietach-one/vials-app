import { buildForecastTimeline } from '@/utils/forecastTimelineHelpers';
import type { ForecastTrack } from '@/utils/forecastTimelineHelpers';
import type { UserProcedureLog } from '@/types';

// Fixed injected "now" — never real dates. Window: Jan 2026 .. Dec 2026,
// current month (Jul 2026) at column index 6.
const NOW = new Date('2026-07-06T12:00:00');

function makeLog(overrides: Partial<UserProcedureLog> = {}): UserProcedureLog {
  return {
    id: 'proc-1',
    procedureKey: 'botox',
    datePerformed: '2026-06-01',
    status: 'active',
    deferralCount: 0,
    ...overrides,
  };
}

function trackFor(data: { tracks: ForecastTrack[] }, id: string): ForecastTrack {
  const track = data.tracks.find((t) => t.procedureId === id);
  if (!track) throw new Error(`expected a track for ${id}`);
  return track;
}

describe('buildForecastTimeline — month window construction', () => {
  it('builds exactly 12 columns, Jan through Dec 2026, for a mid-year now', () => {
    const data = buildForecastTimeline([], NOW);

    expect(data.months).toHaveLength(12);
    expect(data.months.map((m) => m.label)).toEqual([
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ]);
    expect(data.months.every((m) => m.year === 2026)).toBe(true);
  });

  it('marks only the current month (index 6) as isCurrent', () => {
    const data = buildForecastTimeline([], NOW);

    expect(data.months[6]).toMatchObject({ label: 'Jul', year: 2026, isCurrent: true });
    expect(data.months.filter((m) => m.isCurrent)).toHaveLength(1);
  });

  it('spans the year boundary backwards when now is in January', () => {
    const data = buildForecastTimeline([], new Date('2026-01-15T12:00:00'));

    expect(data.months[0]).toMatchObject({ label: 'Jul', year: 2025 });
    expect(data.months[5]).toMatchObject({ label: 'Dec', year: 2025 });
    expect(data.months[6]).toMatchObject({ label: 'Jan', year: 2026, isCurrent: true });
    expect(data.months[11]).toMatchObject({ label: 'Jun', year: 2026 });
  });

  it('spans the year boundary forwards when now is in December', () => {
    const data = buildForecastTimeline([], new Date('2025-12-10T12:00:00'));

    expect(data.months[0]).toMatchObject({ label: 'Jun', year: 2025 });
    expect(data.months[6]).toMatchObject({ label: 'Dec', year: 2025, isCurrent: true });
    expect(data.months[7]).toMatchObject({ label: 'Jan', year: 2026 });
    expect(data.months[11]).toMatchObject({ label: 'May', year: 2026 });
  });

  it('returns zero tracks and zero rows but a full month header for no procedures', () => {
    const data = buildForecastTimeline([], NOW);

    expect(data.tracks).toEqual([]);
    expect(data.rowCount).toBe(0);
    expect(data.months).toHaveLength(12);
  });
});

describe('buildForecastTimeline — span math from CLINICAL_RULES_DB', () => {
  it('positions a botox track at start=5.0 with fade and end per 4/6 effect months', () => {
    // botox: fadeTriggerMonth 4, totalEffectMonths 6 (x 30.44 days)
    const data = buildForecastTimeline([makeLog({ id: 'b', datePerformed: '2026-06-01' })], NOW);

    const track = trackFor(data, 'b');
    expect(track.startOffset).toBeCloseTo(5.0, 1); // Jun 1 = column 5
    expect(track.fadeOffset).toBeCloseTo(8.97, 1); // +121.76d ≈ Sep 30
    expect(track.endOffset).toBeCloseTo(10.97, 1); // +182.64d ≈ Nov 30
    expect(track.status).toBe('active');
    expect(track.displayName).toBe('Botox / Dysport');
  });

  it('clamps a fillers track whose fade and end both run past the window', () => {
    // fillers: fadeTriggerMonth 10, totalEffectMonths 12 — both beyond Dec 2026
    const data = buildForecastTimeline(
      [makeLog({ id: 'f', procedureKey: 'fillers', datePerformed: '2026-06-15' })],
      NOW,
    );

    const track = trackFor(data, 'f');
    expect(track.startOffset).toBeCloseTo(5.47, 1);
    expect(track.fadeOffset).toBe(12);
    expect(track.endOffset).toBe(12);
  });

  it('derives a custom procedure span from estimatedReturnDate, not the rules DB', () => {
    // 2026-05-01 → 2026-11-01 is 184 days; fade at 75% = +138d = Sep 16
    const data = buildForecastTimeline(
      [
        makeLog({
          id: 'c',
          procedureKey: 'custom',
          customName: 'Laser Resurfacing',
          datePerformed: '2026-05-01',
          estimatedReturnDate: '2026-11-01',
          customRehabDays: 5,
        }),
      ],
      NOW,
    );

    const track = trackFor(data, 'c');
    expect(track.startOffset).toBeCloseTo(4.0, 1);
    expect(track.fadeOffset).toBeCloseTo(8.5, 1);
    expect(track.endOffset).toBeCloseTo(10.0, 1);
    expect(track.displayName).toBe('Laser Resurfacing');
  });
});

describe('buildForecastTimeline — window clipping', () => {
  it('clips a track starting before the window to startOffset 0', () => {
    // fillers from Sep 2025 run 12 months → end ≈ Sep 2026, start 4 months pre-window
    const data = buildForecastTimeline(
      [makeLog({ id: 'early', procedureKey: 'fillers', datePerformed: '2025-09-01' })],
      NOW,
    );

    const track = trackFor(data, 'early');
    expect(track.startOffset).toBe(0);
    expect(track.endOffset).toBeCloseTo(8.0, 1);
    expect(track.endOffset).toBeLessThanOrEqual(12);
  });

  it('clips a track ending after the window to endOffset 12', () => {
    // smas_lifting: 18 effect months from Jun 2026 → ends far past Dec 2026
    const data = buildForecastTimeline(
      [makeLog({ id: 'late', procedureKey: 'smas_lifting', datePerformed: '2026-06-01' })],
      NOW,
    );

    const track = trackFor(data, 'late');
    expect(track.startOffset).toBeCloseTo(5.0, 1);
    expect(track.fadeOffset).toBe(12); // fade month 14 is also past the window
    expect(track.endOffset).toBe(12);
  });

  it('drops a procedure whose span ends before the window starts', () => {
    const data = buildForecastTimeline(
      [makeLog({ id: 'past', procedureKey: 'mechanical_facial', datePerformed: '2023-01-01' })],
      NOW,
    );

    expect(data.tracks).toEqual([]);
    expect(data.rowCount).toBe(0);
  });

  it('drops a procedure whose span starts after the window ends', () => {
    const data = buildForecastTimeline(
      [makeLog({ id: 'future', datePerformed: '2027-06-01' })],
      NOW,
    );

    expect(data.tracks).toEqual([]);
  });
});

describe('buildForecastTimeline — row assignment for overlaps', () => {
  it('places two time-overlapping procedures on two different rows', () => {
    const data = buildForecastTimeline(
      [
        makeLog({ id: 'a', datePerformed: '2026-06-01' }),
        makeLog({ id: 'b', procedureKey: 'fillers', datePerformed: '2026-06-15' }),
      ],
      NOW,
    );

    expect(trackFor(data, 'a').row).not.toBe(trackFor(data, 'b').row);
    expect(data.rowCount).toBe(2);
  });

  it('gives three mutually-overlapping procedures three distinct rows', () => {
    const data = buildForecastTimeline(
      [
        makeLog({ id: 'a', datePerformed: '2026-06-01' }),
        makeLog({ id: 'b', procedureKey: 'fillers', datePerformed: '2026-06-15' }),
        makeLog({ id: 'c', procedureKey: 'smas_lifting', datePerformed: '2026-06-20' }),
      ],
      NOW,
    );

    const rows = new Set(data.tracks.map((t) => t.row));
    expect(rows).toEqual(new Set([0, 1, 2]));
    expect(data.rowCount).toBe(3);
  });

  it('reuses a row for two procedures whose spans do not overlap', () => {
    // mechanical_facial ends ~Feb 2026; fillers start Nov 2026 — no overlap
    const data = buildForecastTimeline(
      [
        makeLog({ id: 'early', procedureKey: 'mechanical_facial', datePerformed: '2026-01-05' }),
        makeLog({ id: 'late', procedureKey: 'fillers', datePerformed: '2026-11-01' }),
      ],
      NOW,
    );

    expect(trackFor(data, 'early').row).toBe(0);
    expect(trackFor(data, 'late').row).toBe(0);
    expect(data.rowCount).toBe(1);
  });
});

describe('buildForecastTimeline — archived exclusion and determinism', () => {
  it('excludes archived procedures from the tracks', () => {
    const data = buildForecastTimeline(
      [
        makeLog({ id: 'archived', datePerformed: '2026-05-01', status: 'archived' }),
        makeLog({ id: 'active', datePerformed: '2026-06-01' }),
      ],
      NOW,
    );

    expect(data.tracks.map((t) => t.procedureId)).toEqual(['active']);
  });

  it('returns identical output for identical input (deterministic)', () => {
    const procedures = [
      makeLog({ id: 'a', datePerformed: '2026-06-01' }),
      makeLog({ id: 'b', procedureKey: 'fillers', datePerformed: '2026-06-15' }),
      makeLog({ id: 'c', procedureKey: 'custom', customName: 'Peel',
        datePerformed: '2026-05-01', estimatedReturnDate: '2026-11-01' }),
    ];

    const first = buildForecastTimeline(procedures, NOW);
    const second = buildForecastTimeline(procedures, NOW);

    expect(second).toEqual(first);
  });

  it('does not mutate the input procedures array', () => {
    const procedures = [
      makeLog({ id: 'b', procedureKey: 'fillers', datePerformed: '2026-06-15' }),
      makeLog({ id: 'a', datePerformed: '2026-06-01' }),
    ];
    const snapshot = JSON.parse(JSON.stringify(procedures));

    buildForecastTimeline(procedures, NOW);

    expect(procedures).toEqual(snapshot);
  });
});
