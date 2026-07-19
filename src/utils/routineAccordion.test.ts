import {
  buildRoutineRows,
  getInitialAccordionState,
  mergeReorderedSteps,
  resolveDragResult,
  routineRowKey,
  type RoutineRow,
} from '@/utils/routineAccordion';
import type { RoutineStep } from '@/types';

/**
 * Unit tests — routine accordion + drag logic (img-03). Dates are injected,
 * never read from the clock (testing.md).
 */

function makeStep(id: string): RoutineStep {
  return { id, productType: 'serum', productId: `prod-${id}`, hidden: false, scheduledDays: [] };
}

function at(hour: number): Date {
  return new Date(2026, 6, 19, hour, 0, 0);
}

describe('getInitialAccordionState', () => {
  it('expands Morning and collapses Evening before 15:00', () => {
    expect(getInitialAccordionState(at(9))).toEqual({ morning: true, evening: false });
  });

  it('expands Evening and collapses Morning from 15:00 onward', () => {
    expect(getInitialAccordionState(at(15))).toEqual({ morning: false, evening: true });
  });

  it('treats 14:59 as morning and 23:00 as evening', () => {
    expect(getInitialAccordionState(new Date(2026, 6, 19, 14, 59))).toEqual({
      morning: true,
      evening: false,
    });
    expect(getInitialAccordionState(at(23))).toEqual({ morning: false, evening: true });
  });
});

describe('buildRoutineRows', () => {
  it('emits a section header per period followed by its steps when expanded', () => {
    const rows = buildRoutineRows([makeStep('a')], [makeStep('b')], {
      morning: true,
      evening: true,
    });

    expect(rows.map((r) => r.kind)).toEqual(['section', 'step', 'section', 'step']);
    expect(rows[0]).toMatchObject({ period: 'morning', count: 1, expanded: true });
    expect(rows[2]).toMatchObject({ period: 'evening', count: 1, expanded: true });
  });

  it('omits a collapsed section’s steps but keeps its header and count', () => {
    const rows = buildRoutineRows([makeStep('a'), makeStep('a2')], [makeStep('b')], {
      morning: false,
      evening: true,
    });

    expect(rows.map((r) => r.kind)).toEqual(['section', 'section', 'step']);
    // The collapsed header still reports how many steps it holds.
    expect(rows[0]).toMatchObject({ period: 'morning', count: 2, expanded: false });
  });

  it('still emits both headers when a period has no steps', () => {
    const rows = buildRoutineRows([], [], { morning: true, evening: true });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.kind === 'section')).toBe(true);
  });
});

describe('routineRowKey', () => {
  it('keys section rows by period and step rows by step id', () => {
    expect(routineRowKey({ kind: 'section', period: 'morning', count: 0, expanded: true })).toBe(
      'section-morning',
    );
    expect(routineRowKey({ kind: 'step', period: 'morning', step: makeStep('s9') })).toBe('s9');
  });
});

describe('resolveDragResult', () => {
  const amHeader: RoutineRow = { kind: 'section', period: 'morning', count: 2, expanded: true };
  const pmHeader: RoutineRow = { kind: 'section', period: 'evening', count: 1, expanded: true };

  it('returns the new per-period order for a valid within-section reorder', () => {
    const s1 = makeStep('s1');
    const s2 = makeStep('s2');
    const p1 = makeStep('p1');

    const result = resolveDragResult([
      amHeader,
      { kind: 'step', period: 'morning', step: s2 },
      { kind: 'step', period: 'morning', step: s1 },
      pmHeader,
      { kind: 'step', period: 'evening', step: p1 },
    ]);

    expect(result?.morning.map((s) => s.id)).toEqual(['s2', 's1']);
    expect(result?.evening.map((s) => s.id)).toEqual(['p1']);
  });

  it('rejects a cross-section drag (morning step dropped under Evening)', () => {
    const result = resolveDragResult([
      amHeader,
      pmHeader,
      { kind: 'step', period: 'morning', step: makeStep('s1') },
    ]);

    expect(result).toBeNull();
  });

  it('rejects a step dragged above the first section header', () => {
    const result = resolveDragResult([
      { kind: 'step', period: 'morning', step: makeStep('s1') },
      amHeader,
    ]);

    expect(result).toBeNull();
  });

  it('returns empty periods when there are only headers', () => {
    expect(resolveDragResult([amHeader, pmHeader])).toEqual({ morning: [], evening: [] });
  });
});

describe('mergeReorderedSteps', () => {
  it('writes the reordered visible steps back into their original slots', () => {
    const hidden = { ...makeStep('h1'), hidden: true };
    const all = [makeStep('s1'), hidden, makeStep('s2')];

    const merged = mergeReorderedSteps(all, [makeStep('s2'), makeStep('s1')]);

    // Visible positions (0 and 2) take the new order; the hidden step stays put.
    expect(merged?.map((s) => s.id)).toEqual(['s2', 'h1', 's1']);
  });

  it('returns null when the visible subset does not line up with the full list', () => {
    const all = [makeStep('s1')];
    expect(mergeReorderedSteps(all, [makeStep('s1'), makeStep('sX')])).toBeNull();
  });

  it('is a no-op ordering when nothing moved', () => {
    const all = [makeStep('s1'), makeStep('s2')];
    const merged = mergeReorderedSteps(all, [makeStep('s1'), makeStep('s2')]);
    expect(merged?.map((s) => s.id)).toEqual(['s1', 's2']);
  });
});
