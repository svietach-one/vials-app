import { isNoticeDismissed, routineContentHash } from '@/utils/noticeDismissal';
import type { RoutineStep } from '@/types';

function makeStep(overrides: Partial<RoutineStep> = {}): RoutineStep {
  return {
    id: 'step-1',
    productType: 'serum',
    productId: 'p-1',
    hidden: false,
    scheduledDays: [],
    ...overrides,
  };
}

describe('routineContentHash', () => {
  it('returns the same hash when only step order changes within a period', () => {
    const a = routineContentHash(
      [makeStep({ id: 's1', productId: 'p-1' }), makeStep({ id: 's2', productId: 'p-2' })],
      [],
    );
    const b = routineContentHash(
      [makeStep({ id: 's2', productId: 'p-2' }), makeStep({ id: 's1', productId: 'p-1' })],
      [],
    );

    expect(a).toBe(b);
  });

  it('returns a different hash when a product is added to a period', () => {
    const before = routineContentHash([makeStep({ productId: 'p-1' })], []);
    const after = routineContentHash(
      [makeStep({ productId: 'p-1' }), makeStep({ id: 's2', productId: 'p-2' })],
      [],
    );

    expect(before).not.toBe(after);
  });

  it('returns a different hash when a step\'s scheduledDays change', () => {
    const before = routineContentHash([makeStep({ scheduledDays: [1, 4] })], []);
    const after = routineContentHash([makeStep({ scheduledDays: [2, 6] })], []);

    expect(before).not.toBe(after);
  });

  it('ignores hidden steps and steps with no productId', () => {
    const withHidden = routineContentHash(
      [makeStep({ productId: 'p-1' }), makeStep({ id: 's2', hidden: true, productId: 'p-2' })],
      [],
    );
    const withoutHidden = routineContentHash([makeStep({ productId: 'p-1' })], []);

    expect(withHidden).toBe(withoutHidden);
  });

  it('distinguishes morning-only from evening-only content', () => {
    const morningOnly = routineContentHash([makeStep({ productId: 'p-1' })], []);
    const eveningOnly = routineContentHash([], [makeStep({ productId: 'p-1' })]);

    expect(morningOnly).not.toBe(eveningOnly);
  });
});

describe('isNoticeDismissed', () => {
  it('stays hidden when the dismissed hash matches the current routine hash', () => {
    expect(isNoticeDismissed('hash-a', 'hash-a')).toBe(true);
  });

  it('reappears when the current routine hash no longer matches the dismissed one', () => {
    expect(isNoticeDismissed('hash-a', 'hash-b')).toBe(false);
  });

  it('is never dismissed when no dismissal was ever recorded', () => {
    expect(isNoticeDismissed(undefined, 'hash-a')).toBe(false);
  });
});
