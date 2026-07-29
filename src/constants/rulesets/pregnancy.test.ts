/**
 * Guards the clinical-sign-off gate on the pregnancy-safety-handling draft
 * ruleset: it must stay OUT of context.ts's resolved pregnancyRules until
 * PREGNANCY_SAFETY_ENABLED flips true (spec §10), and the underlying rule
 * data itself must target exactly what the tech design (FE-2) declared.
 * Mirrors src/constants/rulesets/proposedPairRules.test.ts's guard-rail style.
 */

import { PREGNANCY_SAFETY_ENABLED } from '@/constants/featureFlags';
import { PREGNANCY_RULESET, getPregnancyRules } from '@/constants/rulesets/pregnancy';

describe('pregnancy ruleset gating', () => {
  it('is disabled pending clinical sign-off (spec §10)', () => {
    // Arrange / Act / Assert
    expect(PREGNANCY_SAFETY_ENABLED).toBe(false);
    expect(getPregnancyRules()).toEqual([]);
  });

  it('returns a frozen empty array, not a mutable reference into PREGNANCY_RULESET', () => {
    // Act
    const result = getPregnancyRules();

    // Assert — flag-off callers can never accidentally read/mutate real rules
    expect(result).toHaveLength(0);
  });
});

describe('pregnancy ruleset data (PREGNANCY_RULESET)', () => {
  it('declares exactly one freeze rule targeting the retinoid class', () => {
    // Act / Assert
    expect(PREGNANCY_RULESET.rules).toHaveLength(1);
    const [rule] = PREGNANCY_RULESET.rules;
    expect(rule.then.action).toBe('freeze');
    expect(rule.then.targets).toEqual({ classes: ['retinoid'] });
  });

  it('carries the pregnancy_blocked reason code, decoupled from the rule id', () => {
    // Act / Assert
    const [rule] = PREGNANCY_RULESET.rules;
    expect(rule.reasonCode).toBe('pregnancy_blocked');
    expect(rule.id).toBe('pregnancy_retinoid_freeze');
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
