import type { SeasonMask } from '@/constants/rulesets/rulesetTypes';
import type { UserProcedureLog } from '@/types';
import {
  buildEffectiveRuleset,
  buildRoutineContext,
  matchesComparator,
  resolveActiveProcedureRules,
} from '@/utils/routineEngine/context';
import { getSkincareDateString } from '@/utils/timeHelpers';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SEASON_MASK: SeasonMask = { season: 'summer', source: 'calendar' };

function makeProcedure(overrides: Partial<UserProcedureLog> = {}): UserProcedureLog {
  return {
    id: 'proc-1',
    procedureKey: 'chemical_peel_deep',
    datePerformed: '2026-07-04',
    status: 'rehab',
    deferralCount: 0,
    ...overrides,
  };
}

/** Noon UTC keeps elapsedDays' UTC-midnight diff stable regardless of runner TZ. */
function noonUtc(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00Z`);
}

const findRule = (
  rules: ReturnType<typeof buildEffectiveRuleset>['pairRules'],
  id: string,
) => rules.find((r) => r.id === id);

// ─── matchesComparator ──────────────────────────────────────────────────────

describe('matchesComparator', () => {
  it('matches boolean equality', () => {
    expect(matchesComparator(true, true)).toBe(true);
    expect(matchesComparator(false, true)).toBe(false);
  });

  it('matches numeric equality', () => {
    expect(matchesComparator(3, 3)).toBe(true);
    expect(matchesComparator(2, 3)).toBe(false);
  });

  it('evaluates comparator strings against numeric values', () => {
    expect(matchesComparator(3, '>=3')).toBe(true);
    expect(matchesComparator(2, '>=3')).toBe(false);
    expect(matchesComparator(1, '<3')).toBe(true);
    expect(matchesComparator(4, '<=4')).toBe(true);
    expect(matchesComparator(2, '=2')).toBe(true);
  });

  it('returns false for a missing value or a non-numeric comparator target', () => {
    expect(matchesComparator(undefined, '>=2')).toBe(false);
    expect(matchesComparator(true, '>=2')).toBe(false);
  });
});

// ─── buildEffectiveRuleset ──────────────────────────────────────────────────

describe('buildEffectiveRuleset', () => {
  it('applies no modifiers for a null phototype', () => {
    const result = buildEffectiveRuleset(null);
    expect(result.limits).toHaveLength(0);
    expect(result.mandates).toHaveLength(0);
    expect(findRule(result.pairRules, 'rule_vitc_pure_acids')?.severity).toBe('caution');
  });

  it('applies no modifiers for phototype 3 (baseline)', () => {
    const result = buildEffectiveRuleset(3);
    expect(result.limits).toHaveLength(0);
    expect(result.mandates).toHaveLength(0);
  });

  it('escalates a caution pair to avoid for high-melanin types when both sides are irritant', () => {
    // vitamin_c_pure (irr 3) × [aha 3, bha 3] — both sides meet irritancy >= 2
    const result = buildEffectiveRuleset(6);
    expect(findRule(result.pairRules, 'rule_vitc_pure_acids')?.severity).toBe('avoid');
  });

  it('does not escalate a caution pair when one side is below the irritancy threshold', () => {
    // vitamin_c_derivative (irr 1) × benzoyl_peroxide (irr 4) — the derivative
    // fails >= 2, so the pair stays caution even for phototype 6.
    const result = buildEffectiveRuleset(6);
    expect(findRule(result.pairRules, 'rule_vitc_derivative_bpo')?.severity).toBe('caution');
  });

  it('adds the exfoliant frequency cap for high-melanin types', () => {
    const result = buildEffectiveRuleset(4);
    expect(result.limits).toEqual([
      expect.objectContaining({
        maxDaysPerWeek: 1,
        reasonCode: 'phototype_pih_exfoliant_cap',
      }),
    ]);
  });

  it('adds the non-skippable SPF mandate for low-melanin types', () => {
    const result = buildEffectiveRuleset(2);
    expect(result.mandates).toEqual([
      expect.objectContaining({
        action: 'require',
        period: 'am',
        nonSkippable: true,
        reasonCode: 'phototype_uv_sensitivity_spf',
        condition: { planContainsProperty: 'photosensitizing' },
      }),
    ]);
    // Low-melanin types get no pair escalation.
    expect(findRule(result.pairRules, 'rule_vitc_pure_acids')?.severity).toBe('caution');
  });
});

// ─── resolveActiveProcedureRules ────────────────────────────────────────────

describe('resolveActiveProcedureRules', () => {
  it('returns every phase-active rule for a peel performed today', () => {
    // Arrange
    const procedures = [makeProcedure({ datePerformed: '2026-07-04' })];
    // Act
    const rules = resolveActiveProcedureRules(procedures, noonUtc('2026-07-04'));
    // Assert — freeze exfoliants, freeze aggressive classes, require SPF, prioritize barrier
    const reasons = rules.map((r) => r.reasonCode).sort();
    expect(reasons).toEqual([
      'peel_rehab_no_aggressive_actives',
      'peel_rehab_no_exfoliants',
      'peel_sos_recovery',
      'peel_spf_mandatory',
    ]);
  });

  it('resolves untilDate from the phase toDay offset', () => {
    const rules = resolveActiveProcedureRules(
      [makeProcedure({ datePerformed: '2026-07-04' })],
      noonUtc('2026-07-04'),
    );
    const spf = rules.find((r) => r.reasonCode === 'peel_spf_mandatory');
    expect(spf?.untilDate).toBe('2026-08-03'); // 2026-07-04 + 30 days
  });

  it('drops rules whose window has passed but keeps longer ones still active', () => {
    // Day 20: 14-day freezes are over, the 30-day SPF mandate is still live
    const rules = resolveActiveProcedureRules(
      [makeProcedure({ datePerformed: '2026-07-04' })],
      noonUtc('2026-07-24'),
    );
    const reasons = rules.map((r) => r.reasonCode);
    expect(reasons).toEqual(['peel_spf_mandatory']);
  });

  it('ignores procedures scoped to zones other than the face', () => {
    // Phase 1 routines are face routines — a neck-only peel constrains nothing
    const rules = resolveActiveProcedureRules(
      [makeProcedure({ affectedZones: ['neck'] })],
      noonUtc('2026-07-04'),
    );
    expect(rules).toHaveLength(0);
  });

  it('applies procedures whose zones include the face', () => {
    const rules = resolveActiveProcedureRules(
      [makeProcedure({ affectedZones: ['face', 'neck'] })],
      noonUtc('2026-07-04'),
    );
    expect(rules.length).toBeGreaterThan(0);
  });

  it('ignores archived procedures', () => {
    const rules = resolveActiveProcedureRules(
      [makeProcedure({ status: 'archived' })],
      noonUtc('2026-07-04'),
    );
    expect(rules).toHaveLength(0);
  });

  it('applies the custom_default profile with rehabEnd resolved from customRehabDays', () => {
    const rules = resolveActiveProcedureRules(
      [
        makeProcedure({
          id: 'c1',
          procedureKey: 'custom',
          customName: 'Deep laser',
          customRehabDays: 7,
          datePerformed: '2026-07-04',
        }),
      ],
      noonUtc('2026-07-06'),
    );
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(rule.procedureName).toBe('Deep laser');
      expect(rule.untilDate).toBe('2026-07-11'); // performed + 7
    }
  });

  it('produces no rules for a custom procedure with zero rehab days', () => {
    const rules = resolveActiveProcedureRules(
      [makeProcedure({ procedureKey: 'custom', customRehabDays: 0 })],
      noonUtc('2026-07-04'),
    );
    expect(rules).toHaveLength(0);
  });

  it('merges identical freezes from overlapping procedures, keeping the later end date', () => {
    // Two peels freezing exfoliants; the second ends later.
    const rules = resolveActiveProcedureRules(
      [
        makeProcedure({ id: 'a', datePerformed: '2026-07-04' }),
        makeProcedure({ id: 'b', datePerformed: '2026-07-08' }),
      ],
      noonUtc('2026-07-10'),
    );
    const exfoliantFreezes = rules.filter((r) => r.reasonCode === 'peel_rehab_no_exfoliants');
    expect(exfoliantFreezes).toHaveLength(1);
    expect(exfoliantFreezes[0].untilDate).toBe('2026-07-22'); // 2026-07-08 + 14
  });

  it('is deterministic — same input yields an equal result', () => {
    const procedures = [makeProcedure()];
    const a = resolveActiveProcedureRules(procedures, noonUtc('2026-07-05'));
    const b = resolveActiveProcedureRules(procedures, noonUtc('2026-07-05'));
    expect(a).toEqual(b);
  });
});

// ─── buildRoutineContext ────────────────────────────────────────────────────

describe('buildRoutineContext', () => {
  it('assembles date, phototype, season mask, procedure rules, and effective ruleset', () => {
    // Arrange
    const now = noonUtc('2026-07-04');
    // Act
    const context = buildRoutineContext({
      procedures: [makeProcedure({ datePerformed: '2026-07-04' })],
      profile: { fitzpatrick: 6 },
      seasonMask: SEASON_MASK,
      now,
    });
    // Assert
    expect(context.date).toBe(getSkincareDateString(now));
    expect(context.fitzpatrick).toBe(6);
    expect(context.seasonMask).toBe(SEASON_MASK);
    expect(context.procedureRules.length).toBeGreaterThan(0);
    expect(context.effectiveRuleset.limits.length).toBeGreaterThan(0);
  });
});
