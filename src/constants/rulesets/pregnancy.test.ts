/**
 * Guards the clinical-sign-off gate on the pregnancy-safety-handling draft
 * ruleset: `getPregnancyRules()` must return real rules only while
 * PREGNANCY_SAFETY_ENABLED is true, and stay empty whenever it's false
 * (spec §10). Clinical sign-off landed 2026-07-30
 * (docs/specs/pregnancy-safety-handling.md §10) and the flag now ships
 * `true` — the "gating" block below mocks it back to `false` to keep
 * exercising the off-path in isolation, the same way the sibling
 * pregnancy-freeze-enabled/-disabled.test.ts suites do; it is no longer a
 * live guard-rail on the real default (that's now covered by "flag ships on"
 * below). The rule DATA tests further down are independent of the flag's
 * value either way. Mirrors src/constants/rulesets/proposedPairRules.test.ts's
 * guard-rail style.
 */

import { PREGNANCY_RULESET, getPregnancyRules } from '@/constants/rulesets/pregnancy';

describe('pregnancy ruleset gating', () => {
  it('flag ships on, post clinical sign-off (spec §10)', () => {
    // Arrange / Act / Assert — the real, unmocked module.
const { PREGNANCY_SAFETY_ENABLED } = require('@/constants/featureFlags');
    expect(PREGNANCY_SAFETY_ENABLED).toBe(true);
    expect(getPregnancyRules()).toEqual(PREGNANCY_RULESET.rules);
  });

  describe('when mocked off', () => {
    beforeEach(() => {
      jest.resetModules();
      jest.doMock('@/constants/featureFlags', () => ({
        ...jest.requireActual('@/constants/featureFlags'),
        PREGNANCY_SAFETY_ENABLED: false,
      }));
    });
    afterEach(() => jest.dontMock('@/constants/featureFlags'));

    it('returns a frozen empty array, not a mutable reference into PREGNANCY_RULESET', () => {
      // Act — re-require after the mock so this module resolves the mocked flag.
    const { getPregnancyRules: getPregnancyRulesMocked } = require('@/constants/rulesets/pregnancy');
      const result = getPregnancyRulesMocked();

      // Assert — flag-off callers can never accidentally read/mutate real rules
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });
});

describe('pregnancy ruleset data (PREGNANCY_RULESET)', () => {
  it('declares exactly two freeze rules, targeting retinoid and hydroquinone', () => {
    // Act / Assert
    expect(PREGNANCY_RULESET.rules).toHaveLength(2);
    const retinoid = PREGNANCY_RULESET.rules.find((r) => r.id === 'pregnancy_retinoid_freeze');
    const hydroquinone = PREGNANCY_RULESET.rules.find(
      (r) => r.id === 'pregnancy_hydroquinone_freeze',
    );
    expect(retinoid?.then.action).toBe('freeze');
    expect(retinoid?.then.targets).toEqual({ classes: ['retinoid'] });
    expect(hydroquinone?.then.action).toBe('freeze');
    expect(hydroquinone?.then.targets).toEqual({ classes: ['hydroquinone'] });
  });

  it('carries the pregnancy_blocked reason code on every rule, decoupled from the rule id', () => {
    // Act / Assert
    for (const rule of PREGNANCY_RULESET.rules) {
      expect(rule.reasonCode).toBe('pregnancy_blocked');
    }
  });

  it('gives every rule a non-empty, unique id', () => {
    // Act
    const ids = PREGNANCY_RULESET.rules.map((r) => r.id);

    // Assert
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.length).toBeGreaterThan(0);
  });

  it('does not declare a freeze for acids or benzoyl peroxide (spec §3 non-goals — reviewed, not silently omitted)', () => {
    // Act
    const allTargetedClasses = PREGNANCY_RULESET.rules.flatMap((r) => r.then.targets.classes ?? []);

    // Assert
    for (const excluded of ['aha', 'bha', 'pha', 'benzoyl_peroxide'] as const) {
      expect(allTargetedClasses).not.toContain(excluded);
    }
  });
});
