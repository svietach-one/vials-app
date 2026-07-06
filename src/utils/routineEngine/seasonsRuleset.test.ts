/**
 * Integrity tests for src/constants/rulesets/seasons.json.
 * Hand-edited JSON — these catch structural mistakes (unknown seasons/actions,
 * duplicate ids, an inverted hysteresis band) before the engine reads them.
 */

import activesRuleset from '@/constants/rulesets/actives.json';
import { SEASONS_RULESET } from '@/constants/rulesets/rulesetTypes';

const CLASS_KEYS = Object.keys(activesRuleset.classes);

const VALID_SEASONS = ['winter', 'spring', 'summer', 'autumn'];
const VALID_ACTIONS = ['freeze', 'require', 'prioritize', 'limit'];
const VALID_PERIODS = ['am', 'pm'];
const VALID_SEVERITIES = ['avoid', 'caution'];
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

const RULES = SEASONS_RULESET.rules;

describe('seasons.json ruleset integrity', () => {
  it('declares a version stamp', () => {
    expect(SEASONS_RULESET.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('gives every rule a unique id', () => {
    const ids = RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('targets only valid seasons and non-empty season lists', () => {
    for (const rule of RULES) {
      expect(rule.seasons.length).toBeGreaterThan(0);
      for (const season of rule.seasons) expect(VALID_SEASONS).toContain(season);
    }
  });

  it('uses only known action, period, and severity vocabulary', () => {
    for (const rule of RULES) {
      expect(VALID_ACTIONS).toContain(rule.then.action);
      if (rule.then.period !== undefined) expect(VALID_PERIODS).toContain(rule.then.period);
      if (rule.severity !== undefined) expect(VALID_SEVERITIES).toContain(rule.severity);
      expect(rule.reasonCode.length).toBeGreaterThan(0);
    }
  });

  it('references only existing classes, known properties, and valid product types', () => {
    for (const rule of RULES) {
      const targets = rule.then.targets ?? {};
      for (const c of targets.classes ?? []) expect(CLASS_KEYS).toContain(c);
      for (const p of Object.keys(targets.properties ?? {})) {
        expect(VALID_PROPERTY_KEYS).toContain(p);
      }
      for (const t of targets.productTypes ?? []) expect(VALID_PRODUCT_TYPES).toContain(t);
    }
  });

  it('defines a valid hysteresis band (cold threshold below warm threshold)', () => {
    const { coldBelowC, warmAboveC } = SEASONS_RULESET.climate.thresholds;
    expect(coldBelowC).toBeLessThan(warmAboveC);
  });

  it('defines positive weather cadence and staleness windows', () => {
    expect(SEASONS_RULESET.climate.checkIntervalDays).toBeGreaterThan(0);
    expect(SEASONS_RULESET.climate.staleAfterDays).toBeGreaterThan(
      SEASONS_RULESET.climate.checkIntervalDays,
    );
  });
});
