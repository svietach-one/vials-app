import {
  isStrongActive,
  resolveIrritancy,
  type ActiveProperties,
} from '@/constants/rulesets/rulesetTypes';

/**
 * The mild/strong boundary (spec phase-01 §1.2). These two functions are the
 * only definition of it — the stacking cap, the Phase 4 cumulative cap, and
 * Phase 5's break regression all key off them.
 */

const props = (overrides: Partial<ActiveProperties> = {}): ActiveProperties => ({
  irritancy: 0,
  ...overrides,
});

describe('resolveIrritancy', () => {
  it('returns the flat tier when the class declares no per-potency override', () => {
    expect(resolveIrritancy(props({ irritancy: 3 }), 'low')).toBe(3);
    expect(resolveIrritancy(props({ irritancy: 3 }), 'rx')).toBe(3);
  });

  it('prefers the per-potency override over the flat tier', () => {
    const retinoid = props({
      irritancy: 3,
      irritancyByPotency: { low: 3, medium: 3, high: 4, rx: 4 },
    });

    expect(resolveIrritancy(retinoid, 'low')).toBe(3);
    expect(resolveIrritancy(retinoid, 'medium')).toBe(3);
    expect(resolveIrritancy(retinoid, 'high')).toBe(4);
    expect(resolveIrritancy(retinoid, 'rx')).toBe(4);
  });

  it('falls back to the flat tier when the potency is unknown', () => {
    const retinoid = props({ irritancy: 3, irritancyByPotency: { high: 4 } });

    expect(resolveIrritancy(retinoid, undefined)).toBe(3);
  });

  it('falls back to the flat tier for a potency the override omits', () => {
    const retinoid = props({ irritancy: 3, irritancyByPotency: { high: 4 } });

    expect(resolveIrritancy(retinoid, 'low')).toBe(3);
  });

  it('treats a class with no irritancy declared at all as inert', () => {
    expect(resolveIrritancy({}, 'high')).toBe(0);
  });
});

describe('isStrongActive', () => {
  it('is false for the mild tiers (0-2)', () => {
    expect(isStrongActive(props({ irritancy: 0 }))).toBe(false);
    expect(isStrongActive(props({ irritancy: 1 }))).toBe(false);
    expect(isStrongActive(props({ irritancy: 2 }))).toBe(false);
  });

  it('is true from the strong tier up (3-5)', () => {
    expect(isStrongActive(props({ irritancy: 3 }))).toBe(true);
    expect(isStrongActive(props({ irritancy: 4 }))).toBe(true);
    expect(isStrongActive(props({ irritancy: 5 }))).toBe(true);
  });

  it('resolves strength at the given potency, not the flat tier', () => {
    // A class whose flat tier is mild but which escalates at high potency.
    const escalating = props({ irritancy: 2, irritancyByPotency: { high: 3 } });

    expect(isStrongActive(escalating, 'low')).toBe(false);
    expect(isStrongActive(escalating, 'high')).toBe(true);
  });
});
