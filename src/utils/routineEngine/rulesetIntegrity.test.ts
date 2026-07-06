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
