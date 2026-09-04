import { ACTIVES_RULESET } from '@/constants/rulesets/rulesetTypes';
import { TRANSITION_PRECEDENCE, TRANSITION_RULES } from '@/constants/rulesets/stepTransitions';

describe('TRANSITION_RULES keys', () => {
  it('has exactly the four documented classes', () => {
    expect(Object.keys(TRANSITION_RULES).sort()).toEqual(
      ['benzoyl_peroxide', 'hyaluronic_acid', 'retinoid', 'spf_filters'].sort(),
    );
  });

  it('every key is a real class key in actives.json — a typo would silently never fire', () => {
    for (const key of Object.keys(TRANSITION_RULES)) {
      expect(ACTIVES_RULESET.classes[key as keyof typeof ACTIVES_RULESET.classes]).toBeDefined();
    }
  });

  it('retinoid carries a before rule (dry_skin), not an after rule', () => {
    expect(TRANSITION_RULES.retinoid?.before).toEqual({ kind: 'note', text: 'dry_skin' });
    expect(TRANSITION_RULES.retinoid?.after).toBeUndefined();
  });

  it('benzoyl_peroxide carries an after rule (until_dry)', () => {
    expect(TRANSITION_RULES.benzoyl_peroxide?.after).toEqual({ kind: 'note', text: 'until_dry' });
  });

  it('hyaluronic_acid carries an after rule (immediate)', () => {
    expect(TRANSITION_RULES.hyaluronic_acid?.after).toEqual({ kind: 'note', text: 'immediate' });
  });

  it('spf_filters carries an after rule (before_sun) — fires for mineral filters too, no discriminator exists', () => {
    expect(TRANSITION_RULES.spf_filters?.after).toEqual({ kind: 'note', text: 'before_sun' });
  });

  it('no other active class (aha, vitamin_c_pure, etc.) is present — they resolve to none', () => {
    for (const key of ['aha', 'bha', 'pha', 'azelaic_acid', 'vitamin_c_pure', 'vitamin_c_derivative']) {
      expect(TRANSITION_RULES[key as keyof typeof TRANSITION_RULES]).toBeUndefined();
    }
  });
});

describe('TRANSITION_PRECEDENCE', () => {
  it('ranks dry_skin above until_dry above immediate', () => {
    expect(TRANSITION_PRECEDENCE.indexOf('dry_skin')).toBeLessThan(TRANSITION_PRECEDENCE.indexOf('until_dry'));
    expect(TRANSITION_PRECEDENCE.indexOf('until_dry')).toBeLessThan(TRANSITION_PRECEDENCE.indexOf('immediate'));
  });
});
