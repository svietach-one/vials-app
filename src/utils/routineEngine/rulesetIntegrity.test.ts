/**
 * Integrity tests for src/constants/rulesets/actives.json.
 * The ruleset is hand-edited JSON — these tests catch structural mistakes
 * (dangling class refs, duplicate ids, invalid regex) before they reach the
 * engine at runtime.
 */

import activesRuleset from '@/constants/rulesets/actives.json';

type PairRuleSide = string | string[];

interface PairRule {
  id: string;
  a: PairRuleSide;
  b: PairRuleSide;
  scope: string;
  severity: string;
  resolutions: string[];
  exceptions?: { whenPotencyAtMost?: Record<string, string>; downgradeTo?: string }[];
  explanation: string;
  suggestion: string;
}

const CLASSES = activesRuleset.classes as Record<
  string,
  { matchers: { pattern: string; potency?: string }[]; negativePatterns?: string[] }
>;
const PAIR_RULES = activesRuleset.pairRules as PairRule[];
const LEGACY_KEY_MAP = activesRuleset.legacyKeyMap as Record<string, string>;

interface ClassProps {
  irritancy: number;
  irritancyByPotency?: Record<string, number>;
}
interface ClassStacking {
  maxPerPeriod: number;
  sharedCapWith?: string[];
}

const PROPS_BY_CLASS = Object.fromEntries(
  Object.entries(
    activesRuleset.classes as Record<string, { properties: ClassProps }>,
  ).map(([key, cls]) => [key, cls.properties]),
) as Record<string, ClassProps>;

const STACKING_BY_CLASS = Object.fromEntries(
  Object.entries(
    activesRuleset.classes as Record<string, { stacking?: ClassStacking }>,
  ).map(([key, cls]) => [key, cls.stacking]),
) as Record<string, ClassStacking | undefined>;

const POTENCIES = ['low', 'medium', 'high', 'rx'];

const CLASS_KEYS = Object.keys(CLASSES);
const VALID_SCOPES = ['same_period', 'same_day', 'anywhere'];
const VALID_SEVERITIES = ['avoid', 'caution'];
const VALID_RESOLUTIONS = [
  'separate_periods',
  'separate_days',
  'freeze_lower_priority',
  'keep_with_note',
];
const VALID_POTENCIES = ['low', 'medium', 'high', 'rx'];

function sideKeys(side: PairRuleSide): string[] {
  return Array.isArray(side) ? side : [side];
}

describe('actives.json ruleset integrity', () => {
  it('declares a version stamp', () => {
    expect(activesRuleset.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('compiles every matcher and negative pattern as a valid regex', () => {
    for (const [key, cls] of Object.entries(CLASSES)) {
      for (const matcher of cls.matchers) {
        expect(() => new RegExp(matcher.pattern, 'i')).not.toThrow();
        expect(matcher.pattern.length).toBeGreaterThan(0);
        if (matcher.potency !== undefined) {
          expect(VALID_POTENCIES).toContain(matcher.potency);
        }
      }
      for (const negative of cls.negativePatterns ?? []) {
        expect(() => new RegExp(negative, 'gi')).not.toThrow();
      }
      expect(cls.matchers.length).toBeGreaterThan(0);
      expect(key).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it('gives every pair rule a unique id', () => {
    const ids = PAIR_RULES.map((r) => r.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('references only existing classes from pair rule sides', () => {
    for (const rule of PAIR_RULES) {
      for (const key of [...sideKeys(rule.a), ...sideKeys(rule.b)]) {
        expect(CLASS_KEYS).toContain(key);
      }
    }
  });

  it('uses only known scope, severity, and resolution vocabulary', () => {
    for (const rule of PAIR_RULES) {
      expect(VALID_SCOPES).toContain(rule.scope);
      expect(VALID_SEVERITIES).toContain(rule.severity);
      expect(rule.resolutions.length).toBeGreaterThan(0);
      for (const resolution of rule.resolutions) {
        expect(VALID_RESOLUTIONS).toContain(resolution);
      }
    }
  });

  it('uses only valid potency bounds and sides in rule exceptions', () => {
    for (const rule of PAIR_RULES) {
      for (const exception of rule.exceptions ?? []) {
        for (const [side, potency] of Object.entries(exception.whenPotencyAtMost ?? {})) {
          expect(['a', 'b']).toContain(side);
          expect(VALID_POTENCIES).toContain(potency);
        }
      }
    }
  });

  it('never pairs a class with itself (self-conflicts are formulation-exempt)', () => {
    for (const rule of PAIR_RULES) {
      for (const aKey of sideKeys(rule.a)) {
        expect(sideKeys(rule.b)).not.toContain(aKey);
      }
    }
  });

  it('provides user-facing explanation and suggestion for every rule', () => {
    for (const rule of PAIR_RULES) {
      expect(rule.explanation.length).toBeGreaterThan(20);
      expect(rule.suggestion.length).toBeGreaterThan(20);
    }
  });

  it('declares only known skin concerns and valid preferred periods per class', () => {
    const VALID_CONCERNS = [
      'acne', 'dryness', 'wrinkles', 'sensitivity', 'redness', 'eczema',
      'hyperpigmentation', 'pores', 'dark_spots',
    ];
    const classes = activesRuleset.classes as Record<
      string,
      { concerns?: string[]; preferredPeriod?: string; allowedPeriods: string[] }
    >;
    for (const cls of Object.values(classes)) {
      for (const concern of cls.concerns ?? []) {
        expect(VALID_CONCERNS).toContain(concern);
      }
      if (cls.preferredPeriod !== undefined) {
        // A preferred period the class itself forbids would be a data bug
        expect(cls.allowedPeriods).toContain(cls.preferredPeriod);
      }
    }
  });

  it('declares structurally valid adaptation blocks on adapting classes', () => {
    const classes = activesRuleset.classes as Record<
      string,
      { adaptation?: { phases: { throughApplication?: number; afterApplication?: number; maxDaysPerWeek?: number }[] } }
    >;
    for (const [key, cls] of Object.entries(classes)) {
      if (!cls.adaptation) continue;
      const phases = cls.adaptation.phases;
      expect(phases.length).toBeGreaterThanOrEqual(2);
      // Every phase declares exactly one boundary; capped phases carry a cap
      for (const phase of phases.slice(0, -1)) {
        expect(phase.throughApplication).toBeGreaterThan(0);
        expect(phase.afterApplication).toBeUndefined();
        expect(phase.maxDaysPerWeek).toBeGreaterThan(0);
      }
      const last = phases[phases.length - 1];
      expect(last.afterApplication).toBeGreaterThan(0);
      expect(last.throughApplication).toBeUndefined();
      // Boundaries strictly increase so phase lookup is unambiguous
      const bounds = phases.slice(0, -1).map((p) => p.throughApplication as number);
      expect([...bounds].sort((a, b) => a - b)).toEqual(bounds);
      expect(key).toBeTruthy();
    }
    // The three research §2.6 adapting classes are declared
    expect(classes.retinoid.adaptation).toBeDefined();
    expect(classes.aha.adaptation).toBeDefined();
    expect(classes.benzoyl_peroxide.adaptation).toBeDefined();
  });

  it('maps every legacy key to an existing canonical class', () => {
    for (const [legacy, canonical] of Object.entries(LEGACY_KEY_MAP)) {
      expect(CLASS_KEYS).toContain(canonical);
      expect(CLASS_KEYS).not.toContain(legacy);
    }
  });

  it('includes the two 2026-07-04 domain rules with their decided severities', () => {
    const copper = PAIR_RULES.find((r) => r.id === 'rule_copper_peptides_acids');
    const vitc = PAIR_RULES.find((r) => r.id === 'rule_vitc_pure_acids');

    expect(copper?.severity).toBe('avoid');
    expect(sideKeys(copper?.a ?? '')).toContain('copper_peptides');
    expect(sideKeys(copper?.b ?? [])).toEqual(expect.arrayContaining(['aha', 'bha']));

    expect(vitc?.severity).toBe('caution');
    expect(sideKeys(vitc?.a ?? '')).toContain('vitamin_c_pure');
    expect(sideKeys(vitc?.b ?? [])).toEqual(expect.arrayContaining(['aha', 'bha']));
    expect(vitc?.exceptions?.[0]?.whenPotencyAtMost?.b).toBe('low');
  });
});

describe('actives.json — strong-active invariant (spec phase-01 §1.2)', () => {
  it('declares a stacking cap for exactly the strong actives (irritancy >= 3)', () => {
    // The invariant that makes isStrongActive structural: a cap exists because
    // a class is irritating, never because someone remembered to add one. No
    // exemption list — if this fails, fix the irritancy value or the block.
    for (const [key, cls] of Object.entries(PROPS_BY_CLASS)) {
      expect({ key, hasStacking: STACKING_BY_CLASS[key] !== undefined }).toEqual({
        key,
        hasStacking: cls.irritancy >= 3,
      });
    }
  });

  it('never shares a stacking cap with a mild class', () => {
    // A mild class in a strong class's sharedCapWith group would make the cap
    // admission-order dependent (report §7 assumption 8.2): the mild product
    // has no stacking block of its own to check, so it would block a later
    // strong partner while a strong-first ordering would not block it.
    for (const [key, stacking] of Object.entries(STACKING_BY_CLASS)) {
      for (const partner of stacking?.sharedCapWith ?? []) {
        expect({ key, partner, irritancy: PROPS_BY_CLASS[partner].irritancy }).toEqual({
          key,
          partner,
          irritancy: expect.any(Number),
        });
        expect(PROPS_BY_CLASS[partner].irritancy).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('resolves every irritancyByPotency entry to a valid level', () => {
    for (const [key, props] of Object.entries(PROPS_BY_CLASS)) {
      for (const [potency, level] of Object.entries(props.irritancyByPotency ?? {})) {
        expect({ key, potency, valid: POTENCIES.includes(potency) }).toEqual({
          key,
          potency,
          valid: true,
        });
        expect(level).toBeGreaterThanOrEqual(0);
        expect(level).toBeLessThanOrEqual(5);
      }
    }
  });
});

describe('actives.json — asserted compatible pairs (spec phase-01 §1.4)', () => {
  // pairRules has no positive-assertion syntax: a compatible pair is simply an
  // absent one. These lock the absences that are decisions rather than
  // oversights, so a future edit cannot quietly reintroduce a myth.
  const COMPATIBLE: [string, string][] = [
    ['vitamin_c_pure', 'niacinamide'], // the low-pH myth — retired 2026-07-17
    ['retinoid', 'niacinamide'],
    ['retinoid', 'peptide_signal'],
    ['retinoid', 'peptide_neuro'],
    ['vitamin_c_pure', 'peptide_signal'],
    ['azelaic_acid', 'retinoid'],
    ['azelaic_acid', 'vitamin_c_pure'],
    ['vitamin_c_derivative', 'niacinamide'],
    ['vitamin_c_derivative', 'aha'],
  ];

  it.each(COMPATIBLE)('treats %s + %s as compatible', (a, b) => {
    const hit = PAIR_RULES.find(
      (r) =>
        (sideKeys(r.a).includes(a) && sideKeys(r.b).includes(b)) ||
        (sideKeys(r.a).includes(b) && sideKeys(r.b).includes(a)),
    );
    expect(hit).toBeUndefined();
  });

  it('still conflicts vitamin C derivative with benzoyl peroxide — the one exception', () => {
    const hit = PAIR_RULES.find((r) => r.id === 'rule_vitc_derivative_bpo');
    expect(hit?.severity).toBe('caution');
  });
});
