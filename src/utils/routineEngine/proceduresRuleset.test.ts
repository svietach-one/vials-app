/**
 * Integrity tests for src/constants/rulesets/procedures.json.
 * Hand-edited JSON — these catch structural mistakes (unknown actions, bad
 * class/property/productType refs, rehabDays drift from CLINICAL_RULES_DB)
 * before the engine reads them at runtime.
 */

import activesRuleset from '@/constants/rulesets/actives.json';
import { PROCEDURES_RULESET } from '@/constants/rulesets/rulesetTypes';
import { CLINICAL_RULES_DB } from '@/types';

const CLASS_KEYS = Object.keys(activesRuleset.classes);

const VALID_ACTIONS = ['freeze', 'require', 'prioritize', 'limit'];
const VALID_PERIODS = ['am', 'pm'];
const VALID_PROPERTY_KEYS = [
  'photosensitizing',
  'exfoliating',
  'irritancy',
  'barrierRepair',
  'lowPh',
  'spf',
  'massageRequired',
];
const VALID_PRODUCT_TYPES = [
  'cleanser', 'toner', 'essence', 'serum', 'gel', 'moisturizer', 'oil', 'spf',
  'makeup_remover', 'peeling', 'ampoule', 'lotion', 'cream', 'eye_cream',
  'mask', 'balm', 'spot_treatment', 'other',
];

const PROCEDURES = PROCEDURES_RULESET.procedures;

/** Flattens a target selector into the property/class/productType refs it touches. */
function collectTargets(targets: {
  properties?: Record<string, unknown>;
  classes?: string[];
  productTypes?: string[];
  anyOf?: unknown[];
}): { properties: string[]; classes: string[]; productTypes: string[] } {
  const acc = { properties: [] as string[], classes: [] as string[], productTypes: [] as string[] };
  const walk = (t: typeof targets) => {
    if (t.properties) acc.properties.push(...Object.keys(t.properties));
    if (t.classes) acc.classes.push(...t.classes);
    if (t.productTypes) acc.productTypes.push(...t.productTypes);
    for (const nested of t.anyOf ?? []) walk(nested as typeof targets);
  };
  walk(targets);
  return acc;
}

describe('procedures.json ruleset integrity', () => {
  it('declares a version stamp', () => {
    expect(PROCEDURES_RULESET.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('defines every clinical procedure plus custom_default', () => {
    for (const key of Object.keys(CLINICAL_RULES_DB)) {
      expect(PROCEDURES).toHaveProperty(key);
    }
    expect(PROCEDURES).toHaveProperty('custom_default');
  });

  it('keeps predefined rehabDays consistent with CLINICAL_RULES_DB', () => {
    for (const [key, config] of Object.entries(CLINICAL_RULES_DB)) {
      expect(PROCEDURES[key].rehabDays).toBe(config.rehabDays);
    }
  });

  it('omits a static rehabDays for custom_default (resolved from the log)', () => {
    expect(PROCEDURES.custom_default.rehabDays).toBeUndefined();
  });

  it('uses only known action and period vocabulary', () => {
    for (const proc of Object.values(PROCEDURES)) {
      for (const rule of proc.productRules) {
        expect(VALID_ACTIONS).toContain(rule.action);
        if (rule.period !== undefined) expect(VALID_PERIODS).toContain(rule.period);
        expect(rule.reasonCode.length).toBeGreaterThan(0);
      }
    }
  });

  it('gives every product rule a valid day phase or the rehabEnd sentinel', () => {
    for (const proc of Object.values(PROCEDURES)) {
      for (const rule of proc.productRules) {
        expect(rule.phase.fromDay).toBeGreaterThanOrEqual(0);
        if (rule.phase.toDay === 'rehabEnd') {
          expect(rule.phase.fromDay).toBe(0);
        } else {
          expect(rule.phase.toDay).toBeGreaterThanOrEqual(rule.phase.fromDay);
        }
      }
    }
  });

  it('only ever uses the rehabEnd sentinel inside custom_default', () => {
    for (const [key, proc] of Object.entries(PROCEDURES)) {
      for (const rule of proc.productRules) {
        if (rule.phase.toDay === 'rehabEnd') expect(key).toBe('custom_default');
      }
    }
  });

  it('references only existing classes, known properties, and valid product types', () => {
    for (const proc of Object.values(PROCEDURES)) {
      for (const rule of proc.productRules) {
        const { properties, classes, productTypes } = collectTargets(rule.targets);
        for (const c of classes) expect(CLASS_KEYS).toContain(c);
        for (const p of properties) expect(VALID_PROPERTY_KEYS).toContain(p);
        for (const t of productTypes) expect(VALID_PRODUCT_TYPES).toContain(t);
      }
    }
  });

  it('restricts require mandates to a period', () => {
    for (const proc of Object.values(PROCEDURES)) {
      for (const rule of proc.productRules) {
        if (rule.action === 'require') expect(rule.period).toBeDefined();
      }
    }
  });
});
