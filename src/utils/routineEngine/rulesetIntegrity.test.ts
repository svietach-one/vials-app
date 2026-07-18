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

describe('actives.json — strong-active invariant (phase-01 §1.2, restated by phase-04)', () => {
  it('declares no per-class stacking caps — the cumulative rule owns strong actives', () => {
    // phase-04 (report §7 assumption 8.1): per-class stacking is subsumed by
    // the cumulative exposure cap, which applies to exactly the classes where
    // isStrongActive (irritancy >= 3) holds — derived, never declared. A
    // stray stacking block reintroduces a second cap vocabulary; delete it.
    for (const [key, stacking] of Object.entries(STACKING_BY_CLASS)) {
      expect({ key, hasStacking: stacking !== undefined }).toEqual({ key, hasStacking: false });
    }
  });

  it('keeps the strong boundary meaningful — both sides populated', () => {
    // The cumulative cap counts irritancy >= 3 carriers; the boundary is only
    // an invariant while classes actually sit on both sides of it.
    const strong = Object.values(PROPS_BY_CLASS).filter((p) => p.irritancy >= 3);
    const mild = Object.values(PROPS_BY_CLASS).filter((p) => p.irritancy < 3);
    expect(strong.length).toBeGreaterThan(0);
    expect(mild.length).toBeGreaterThan(0);
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

describe('actives.json — PM-only eligibility lock (§4.2 ruling, 2026-07-17)', () => {
  it('keeps retinoid, aha, and bha hard PM-only, and pha morning-safe', () => {
    // Ruling: pm_preferred was rejected. A planned SPF step is not verifiable
    // sun protection on skin, so it cannot gate a safety exception; "no acid
    // in AM, ever" stays unconditional and property-testable. Do not loosen
    // these without a new product ruling.
    const periods = activesRuleset.classes as Record<string, { allowedPeriods: string[] }>;
    expect(periods.retinoid.allowedPeriods).toEqual(['pm']);
    expect(periods.aha.allowedPeriods).toEqual(['pm']);
    expect(periods.bha.allowedPeriods).toEqual(['pm']);
    expect(periods.pha.allowedPeriods).toEqual(['am', 'pm']);
  });
});

describe('actives.json — base mandates block (spec phase-02 §2.1)', () => {
  interface RawMandate {
    id: string;
    if?: { planContainsProperty?: string };
    then: { action: string; targets?: { productTypes?: string[] }; period?: string };
    severity?: string;
    nonSkippable?: boolean;
    reasonCode: string;
  }
  const MANDATES = ((activesRuleset as { mandates?: RawMandate[] }).mandates ?? []);

  it('declares the unconditional SPF mandate with the decided shape', () => {
    const spf = MANDATES.find((m) => m.id === 'spf_photosensitizing');
    expect(spf).toEqual({
      id: 'spf_photosensitizing',
      if: { planContainsProperty: 'photosensitizing' },
      then: { action: 'require', targets: { productTypes: ['spf'] }, period: 'am' },
      severity: 'avoid',
      nonSkippable: false,
      reasonCode: 'spf_required_photosensitizing',
    });
  });

  it('gives every mandate a unique id, a known vocabulary, and a snake_case reason code', () => {
    const ids = MANDATES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of MANDATES) {
      expect(['freeze', 'require', 'prioritize', 'limit']).toContain(m.then.action);
      if (m.severity !== undefined) expect(['avoid', 'caution']).toContain(m.severity);
      if (m.then.period !== undefined) expect(['am', 'pm']).toContain(m.then.period);
      expect(m.reasonCode).toMatch(/^[a-z0-9]+(_[a-z0-9]+)*$/);
    }
  });
});

describe('actives.json — goals block (spec phase-03 §3.2)', () => {
  const GOALS = (activesRuleset as unknown as { goals: Record<string, string[]> }).goals;
  const ALL_GOALS = ['acne', 'pigmentation', 'aging', 'dehydration', 'barrier_repair', 'oil_control', 'maintenance'];

  it('declares every SkinGoal exactly once', () => {
    expect(Object.keys(GOALS).sort()).toEqual([...ALL_GOALS].sort());
  });

  it('references only existing classes, each at most once per goal', () => {
    for (const [goal, classes] of Object.entries(GOALS)) {
      for (const key of classes) {
        expect({ goal, key, exists: CLASS_KEYS.includes(key) }).toEqual({ goal, key, exists: true });
      }
      expect(new Set(classes).size).toBe(classes.length);
    }
  });

  it('keeps the maintenance treatment list deliberately empty', () => {
    expect(GOALS.maintenance).toEqual([]);
  });

  it('gates glycerin_class attribution by position — never bare presence', () => {
    // The Phase 1 deferral condition: without this gate the class attributes
    // to nearly every formula and flattens goal scoring.
    const glycerin = (activesRuleset as unknown as {
      classes: Record<string, { attribution?: { requireWithinPosition?: number } }>;
    }).classes.glycerin_class;
    expect(glycerin.attribution?.requireWithinPosition).toBeGreaterThan(0);
  });

  it('declares the trace-amount downgrade on the leave-on strong acids', () => {
    const classes = (activesRuleset as unknown as {
      classes: Record<string, { attribution?: { downgradeToLowAfterPosition?: number } }>;
    }).classes;
    for (const key of ['aha', 'bha', 'vitamin_c_pure']) {
      expect({ key, gated: classes[key].attribution?.downgradeToLowAfterPosition !== undefined })
        .toEqual({ key, gated: true });
    }
  });
});

describe('decision reason codes — closed vocabulary (phase-07 §7.1)', () => {
  const { REASON_TEXT } = require('@/constants/decisionReasons');
  const ENUM_CODES = new Set(Object.keys(REASON_TEXT));

  // Every reasonCode authored anywhere in the ruleset JSON.
  function jsonReasonCodes(): Set<string> {
    const codes = new Set<string>();
    const walk = (o: unknown) => {
      if (o && typeof o === 'object') {
        for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
          if (k === 'reasonCode' && typeof v === 'string') codes.add(v);
          else walk(v);
        }
      }
    };
    for (const r of [require('@/constants/rulesets/actives.json'),
                     require('@/constants/rulesets/procedures.json'),
                     require('@/constants/rulesets/seasons.json')]) walk(r);
    return codes;
  }

  it('has dictionary text for every code (satisfies guarantees non-empty)', () => {
    for (const [code, text] of Object.entries(REASON_TEXT)) {
      expect(typeof text).toBe('string');
      expect((text as string).length).toBeGreaterThan(0);
    }
  });

  it('includes every reasonCode authored in the ruleset JSON (forward, no orphan JSON code)', () => {
    for (const code of jsonReasonCodes()) {
      expect({ code, inEnum: ENUM_CODES.has(code) }).toEqual({ code, inEnum: true });
    }
  });

  it('never uses a pair-rule id (rule_*) as a reason code — reason codes are decoupled from ruleIds', () => {
    for (const code of ENUM_CODES) {
      expect(code.startsWith('rule_')).toBe(false);
    }
    // And every pairRule carries a reasonCode that is a valid enum member.
    for (const rule of PAIR_RULES as unknown as { id: string; reasonCode?: string }[]) {
      expect(rule.reasonCode).toBeDefined();
      expect(ENUM_CODES.has(rule.reasonCode as string)).toBe(true);
      expect((rule.reasonCode as string).startsWith('rule_')).toBe(false);
    }
  });

  it('is stable under a pairRule id rename — the reasonCode does not derive from the id', () => {
    // Two rules (retinol+aha, retinol+bha) share one reason code despite
    // distinct ids: proof the code is authored, not derived from the id.
    const byId = (id: string) =>
      (PAIR_RULES as unknown as { id: string; reasonCode: string }[]).find((r) => r.id === id);
    expect(byId('rule_retinol_aha')?.reasonCode).toBe(byId('rule_retinol_bha')?.reasonCode);
  });
});

describe('decision reason codes — engine-emitted literals are enum members (phase-07)', () => {
  const fs = require('fs');
  const path = require('path');
  const { REASON_TEXT } = require('@/constants/decisionReasons');
  const ENUM_CODES = new Set(Object.keys(REASON_TEXT));

  it('every reasonCode string literal emitted by engine source is in the enum', () => {
    const dir = path.join(__dirname);
    const files = fs.readdirSync(dir).filter((f: string) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
    const found = new Set<string>();
    for (const f of files) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      for (const m of src.matchAll(/reasonCode: '([a-z0-9_]+)'/g)) found.add(m[1]);
    }
    // adaptation_phase_N is synthesized via a template literal — assert its base.
    found.add('adaptation_phase_1');
    for (const code of found) {
      expect({ code, inEnum: ENUM_CODES.has(code) }).toEqual({ code, inEnum: true });
    }
  });
});

describe('engine determinism guard (phase-09 merge criterion)', () => {
  const fs = require('fs');
  const path = require('path');

  // The determinism property tests (tests/routine-engine/determinism-and-safety)
  // prove same-input → byte-identical output empirically. This guard closes the
  // other half statically: the engine must contain no non-deterministic source.
  // The project has no lint-rule infra for this, so it lives as a test the
  // engineer sees on every `npm test` run (spec phase-09 merge criteria).
  function engineSourceFiles(): string[] {
    const dir = path.join(__dirname);
    return fs
      .readdirSync(dir)
      .filter((f: string) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
      .map((f: string) => path.join(dir, f));
  }

  it('contains no Math.random anywhere in engine source', () => {
    for (const file of engineSourceFiles()) {
      const src = fs.readFileSync(file, 'utf8');
      expect({ file: path.basename(file), usesMathRandom: /Math\.random/.test(src) }).toEqual({
        file: path.basename(file),
        usesMathRandom: false,
      });
    }
  });

  it('reads "now" only from an injected parameter, never an ambient clock in a decision path', () => {
    // The one permitted ambient-clock read is generate.ts's `input.now ?? new
    // Date()` fallback, which immediately binds a single `now` threaded through
    // every downstream module — nothing else may call Date.now() or bare new
    // Date() to branch on. Guard the modules below generate.ts: they must
    // receive `now`, never mint one. (testing.md: inject the date.)
    for (const file of engineSourceFiles()) {
      const base = path.basename(file);
      if (base === 'generate.ts') continue; // the single injection boundary
      const src = fs.readFileSync(file, 'utf8');
      expect({ file: base, callsDateNow: /Date\.now\s*\(/.test(src) }).toEqual({
        file: base,
        callsDateNow: false,
      });
    }
  });

  // Object-iteration convention (unsorted-iteration half of the merge
  // criterion): the engine iterates objects only over fixed const maps whose key
  // set is authored, not data-derived (e.g. SKELETON_SLOTS, phototype
  // conjunctions), so insertion order is stable and iteration is deterministic.
  // A data-derived object keyed on productId/class *would* leak nondeterminism;
  // no such iteration exists today. This is enforced by convention + the
  // empirical shuffle-invariance test in determinism-and-safety, not a static
  // string match (which cannot distinguish the two cases without false
  // positives on the fixed-map iterations).
});
