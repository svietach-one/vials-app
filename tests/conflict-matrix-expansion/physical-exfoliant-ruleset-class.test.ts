/**
 * FE-3 — `physical_exfoliant` as a real, matcher-less actives.json class.
 * Spec: docs/specs/vials-conflict-matrix-expansion.md
 * Tech design: docs/tech-design/vials-conflict-matrix-expansion.md §3, §4
 * ("physical_exfoliant becomes a real (matcher-less) actives.json class
 * rather than a second rule table").
 *
 * This is a QA-owned, independent lock on the same invariant the engineer's
 * co-located rulesetIntegrity.test.ts documents as a "named, documented
 * exemption": the class must exist so pairRules can reference it through the
 * one existing mechanism, but it must carry zero INCI matchers — an
 * ingredient label can never, on its own, cause this class to be attributed
 * to a product (FE-1/FE-2's isPhysicalExfoliant flag is the only source).
 *
 * Explicitly out of scope here: any pairRules severity involving
 * physical_exfoliant (FE-4, still blocked — see
 * progress/vials-conflict-matrix-expansion-handoff.json
 * still_blocked.bounded_decision_list). The last two tests below lock that
 * scope boundary without asserting any clinical claim.
 */
import activesRuleset from '@/constants/rulesets/actives.json';

interface RulesetClass {
  matchers: { pattern: string; potency?: string }[];
}
interface PairRuleSides {
  a: string | string[];
  b: string | string[];
}

const CLASSES = activesRuleset.classes as unknown as Record<string, RulesetClass>;
const PAIR_RULES = activesRuleset.pairRules as unknown as PairRuleSides[];

function sideKeys(side: string | string[]): string[] {
  return Array.isArray(side) ? side : [side];
}

describe('actives.json — physical_exfoliant class (FE-3)', () => {
  it('declares physical_exfoliant as a class', () => {
    expect(CLASSES.physical_exfoliant).toBeDefined();
  });

  it('gives physical_exfoliant zero INCI matchers — it must never regex-match ingredient text', () => {
    expect(CLASSES.physical_exfoliant.matchers).toEqual([]);
  });

  it('is the ONLY class with zero matchers — a named, singular exemption, not a blanket weakening', () => {
    // Every other class must still declare >=1 real matcher (the invariant
    // rulesetIntegrity.test.ts enforces today). If a future edit adds a
    // second matcher-less class without an equally deliberate review, this
    // test catches it independently of that engineer-owned suite.
    const zeroMatcherClasses = Object.entries(CLASSES)
      .filter(([, cls]) => cls.matchers.length === 0)
      .map(([key]) => key);

    expect(zeroMatcherClasses).toEqual(['physical_exfoliant']);
  });

  it('never pairs physical_exfoliant with itself in pairRules (self-conflicts stay formulation-exempt)', () => {
    for (const rule of PAIR_RULES) {
      if (sideKeys(rule.a).includes('physical_exfoliant')) {
        expect(sideKeys(rule.b)).not.toContain('physical_exfoliant');
      }
      if (sideKeys(rule.b).includes('physical_exfoliant')) {
        expect(sideKeys(rule.a)).not.toContain('physical_exfoliant');
      }
    }
  });

  it('carries no pairRules entries yet — FE-4 (severities for physical_exfoliant pairs) is still blocked', () => {
    const touchesExfoliant = PAIR_RULES.some(
      (rule) =>
        sideKeys(rule.a).includes('physical_exfoliant') ||
        sideKeys(rule.b).includes('physical_exfoliant'),
    );

    expect(touchesExfoliant).toBe(false);
  });
});
