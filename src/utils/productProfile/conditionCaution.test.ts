/**
 * Unit test — `conditionCaution.ts` (explore-fit-signals FE-3).
 * Spec: docs/specs/explore-fit-signals.md §4 Story 2
 * Tech design: docs/tech-design/explore-fit-signals.md §3 FE-3
 *
 * Pure logic only — no React, no react-native, no store (.claude/rules/testing.md).
 */
import { buildConditionCaution } from './conditionCaution';

describe('buildConditionCaution — no-op guarantee (US-27 parity)', () => {
  it('returns an empty array when skinConditions is empty, regardless of resolvedActiveKeys', () => {
    const findings = buildConditionCaution(['azelaic_acid', 'retinoid'], []);

    expect(findings).toEqual([]);
  });

  it('returns an empty array when resolvedActiveKeys is empty, regardless of skinConditions', () => {
    const findings = buildConditionCaution([], ['eczema']);

    expect(findings).toEqual([]);
  });
});

describe('buildConditionCaution — single condition, single tag match', () => {
  it('returns the verbatim eczema advisory message for azelaic acid — the real case that never trips the generic skin-type trigger', () => {
    const findings = buildConditionCaution(['azelaic_acid'], ['eczema']);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      tag: 'azelaic_acid',
      conditions: ['eczema'],
      conditionLabels: ['Eczema / atopic dermatitis'],
      severity: 'low',
    });
    expect(findings[0].message).toBe(
      'Azelaic acid is usually well tolerated on eczema-prone skin. Some people notice mild tingling at first — introducing it gradually helps.',
    );
  });

  it('returns one finding per matching tag when multiple actives trigger distinct advisories', () => {
    const findings = buildConditionCaution(['retinoid', 'azelaic_acid'], ['eczema']);

    expect(findings.map((f) => f.tag).sort()).toEqual(['azelaic_acid', 'retinoid'].sort());
  });

  it('never returns a finding for an active with no matching advisory tag under the selected condition', () => {
    const findings = buildConditionCaution(['niacinamide'], ['eczema']);

    expect(findings).toEqual([]);
  });

  it('never penalises an eczema noPenaltyTags active even if selected', () => {
    const findings = buildConditionCaution(['ceramides', 'panthenol', 'glycerin_class'], ['eczema']);

    expect(findings).toEqual([]);
  });
});

describe('buildConditionCaution — multiple conditions, same tag merges into one finding', () => {
  it('merges eczema and rosacea into one finding for a shared tag (retinoid), never one row per condition', () => {
    const findings = buildConditionCaution(['retinoid'], ['eczema', 'rosacea']);

    expect(findings).toHaveLength(1);
    expect(findings[0].tag).toBe('retinoid');
    expect(findings[0].conditions).toEqual(['eczema', 'rosacea']);
    expect(findings[0].conditionLabels).toEqual(['Eczema / atopic dermatitis', 'Rosacea']);
  });

  it('keeps the first-encountered (CONDITION_MODIFIERS order) message when both matching conditions carry equal severity', () => {
    const findings = buildConditionCaution(['retinoid'], ['eczema', 'rosacea']);

    expect(findings[0].severity).toBe('medium');
    expect(findings[0].message).toMatch(/eczema-prone skin/i);
  });
});

describe('buildConditionCaution — seborrheic dermatitis is a documented no-op (empty advisories table)', () => {
  it('never returns a finding for seborrheic_dermatitis regardless of resolvedActiveKeys', () => {
    const findings = buildConditionCaution(
      ['retinoid', 'aha', 'azelaic_acid', 'benzoyl_peroxide'],
      ['seborrheic_dermatitis'],
    );

    expect(findings).toEqual([]);
  });
});
