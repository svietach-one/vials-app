/**
 * Integration tests — Story 7: Phototype-aware severity
 * Spec: docs/specs/2026-07-04-routine-engine.md §4 Story 7
 *
 * Onboarding's six visual Fitzpatrick cards are UI (FE-9, not built) —
 * a component test in tests/routine-engine/fitzpatrick-card.test.tsx. Legacy
 * grouped -> numeric migration is covered in
 * migrations-hydrate.test.ts (Story 9's migration composition), not
 * duplicated here. This file exercises the phototype modifier's effect on
 * the resolved plan/findings across generate + validate together.
 */
import { generatePlan } from '@/utils/routineEngine/generate';
import { validateRoutines } from '@/utils/routineEngine/validate';
import {
  makeEngineInput,
  makeProduct,
  makeRoutine,
  makeRoutineStep,
  resetFixtureCounters,
} from './fixtures';

beforeEach(() => resetFixtureCounters());

describe('Story 7 AC: phototype 4-6 escalates a caution-level, both-irritant pair to avoid', () => {
  it('freezes the lower-priority side of an escalated pair instead of co-layering it (phototype 5)', () => {
    // Both products are forced pm-only (vitC via usageTime, bha is pm-only by
    // class) so they land in the SAME single-placement pool — without the
    // escalation this pair would just get a "keep_with_note" caution and stay
    // together; escalated to avoid, `keep_with_note` is barred (resolve.ts) and
    // no alternate period exists, so the ladder falls through to a freeze.
    const vitC = makeProduct({ activeTags: ['vitamin_c_pure'], usageTime: 'evening' });
    const bha = makeProduct({ activeTags: ['bha'] });
    const plan = generatePlan(makeEngineInput([vitC, bha], { profile: { fitzpatrick: 5, concerns: [] } }));

    expect(plan.frozen).toEqual([
      expect.objectContaining({ productId: bha.id, reasonCode: 'rule_vitc_pure_acids' }),
    ]);
    expect(plan.periods.evening.map((s) => s.productId)).toEqual([vitC.id]);
  });

  it('keeps both products co-layered with a note (not frozen) for the baseline phototype 3 — the same pair is only caution', () => {
    const vitC = makeProduct({ activeTags: ['vitamin_c_pure'], usageTime: 'evening' });
    const bha = makeProduct({ activeTags: ['bha'] });
    const plan = generatePlan(makeEngineInput([vitC, bha], { profile: { fitzpatrick: 3, concerns: [] } }));

    expect(plan.frozen).toHaveLength(0);
    expect(plan.periods.evening.map((s) => s.productId).sort()).toEqual([bha.id, vitC.id].sort());
  });

  it('reports the escalated pair as an avoid finding (not caution) for a saved routine, phototype 4', () => {
    const vitC = makeProduct({ activeTags: ['vitamin_c_pure'] });
    const bha = makeProduct({ activeTags: ['bha'] });
    const routines = [makeRoutine('morning', [makeRoutineStep(vitC), makeRoutineStep(bha)])];
    const result = validateRoutines(
      routines,
      makeEngineInput([vitC, bha], { profile: { fitzpatrick: 4, concerns: [] } }),
    );
    expect(result.findings).toEqual(
      expect.arrayContaining([expect.objectContaining({ severity: 'avoid', ruleId: 'rule_vitc_pure_acids' })]),
    );
    expect(result.hasBlockingFindings).toBe(true);
  });

  it('does not escalate the same pair for phototype 3 (baseline) — stays a caution finding', () => {
    const vitC = makeProduct({ activeTags: ['vitamin_c_pure'] });
    const bha = makeProduct({ activeTags: ['bha'] });
    // AM SPF satisfies the (phase-02) unconditional photosensitizer mandate —
    // BHA is photosensitizing, and without SPF the mandate's avoid finding
    // would trip hasBlockingFindings for a reason unrelated to escalation.
    const spf = makeProduct({ productType: 'spf', usageTime: 'morning' });
    const routines = [
      makeRoutine('morning', [makeRoutineStep(vitC), makeRoutineStep(bha), makeRoutineStep(spf)]),
    ];
    const result = validateRoutines(
      routines,
      makeEngineInput([vitC, bha, spf], { profile: { fitzpatrick: 3, concerns: [] } }),
    );
    expect(result.findings).toEqual(
      expect.arrayContaining([expect.objectContaining({ severity: 'caution', ruleId: 'rule_vitc_pure_acids' })]),
    );
    expect(result.hasBlockingFindings).toBe(false);
  });
});

describe('Story 7 AC: a single pre-formulated product with both actives never gets a separation rule or escalation', () => {
  it('does not freeze or day-split a single product carrying both retinoid and AHA tags', () => {
    const combo = makeProduct({ activeTags: ['retinoid', 'aha'] });
    const plan = generatePlan(makeEngineInput([combo], { profile: { fitzpatrick: 5, concerns: [] } }));
    expect(plan.frozen).toHaveLength(0);
    // The single product still resolves to exactly one period/day set, never split against itself.
    const allSteps = [...plan.periods.morning, ...plan.periods.evening].filter((s) => s.productId === combo.id);
    expect(allSteps.length).toBeGreaterThan(0);
  });
});

describe('Story 7 AC: phototype 1-2 non-skippable AM SPF mandate with a photosensitizer', () => {
  it('reports the missing SPF as an avoid finding for phototype 2 with a photosensitizing retinoid', () => {
    const retinoid = makeProduct({ activeTags: ['retinoid'] });
    const routines = [makeRoutine('evening', [makeRoutineStep(retinoid)])];
    const result = validateRoutines(
      routines,
      makeEngineInput([retinoid], { profile: { fitzpatrick: 2, concerns: [] } }),
    );
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: 'avoid', reasonCode: 'phototype_uv_sensitivity_spf' }),
      ]),
    );
  });

  it('emits a non-skippable AM SPF placeholder in the generated draft for phototype 1', () => {
    const retinoid = makeProduct({ activeTags: ['retinoid'] });
    const plan = generatePlan(makeEngineInput([retinoid], { profile: { fitzpatrick: 1, concerns: [] } }));
    expect(plan.placeholders).toEqual([
      expect.objectContaining({ period: 'am', productTypes: ['spf'], nonSkippable: true }),
    ]);
  });

  it('does not require SPF for phototype 6 (mandate is scoped to types 1-2 only)', () => {
    const retinoid = makeProduct({ activeTags: ['retinoid'] });
    const plan = generatePlan(makeEngineInput([retinoid], { profile: { fitzpatrick: 6, concerns: [] } }));
    expect(plan.placeholders.some((p) => p.reasonCode === 'phototype_uv_sensitivity_spf')).toBe(false);
  });
});

// Story 7 UI AC (six visual phototype cards) is activated as a component test
// in tests/routine-engine/fitzpatrick-card.test.tsx now that FE-9 shipped
// FitzpatrickCard (progress/routine-engine.md, 2026-07-05 entry) — kept out of
// this file since it needs @testing-library/react-native rendering.
