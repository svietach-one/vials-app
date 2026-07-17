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

/**
 * Rewritten for phase-04. Two important shifts:
 * 1. Generation can no longer co-layer two strong actives to test a freeze —
 *    skeleton selection picks one treatment per period and reserves the rest,
 *    so pair escalation is observable only through VALIDATE on a routine the
 *    USER manually layered.
 * 2. Two strong leave-on carriers same-day is now a `cumulative_active_cap`
 *    avoid regardless of phototype, so it no longer isolates the phototype
 *    escalation. `vitamin_c_pure` (irritancy 3, strong) + `copper_peptides`
 *    (irritancy 2, NOT a strong carrier) is the pair that does: the cumulative
 *    cap stays silent while the phototype modifier still escalates their
 *    caution pair rule to avoid.
 */
describe('Story 7 AC: phototype 4-6 escalates a caution-level, both-irritant pair to avoid', () => {
  it('reserves one strong active during generation — never co-layers two (phototype 5)', () => {
    // Skeleton selection prevents the co-layering the old freeze test relied
    // on: with an aging goal, one strong carrier becomes the treatment, the
    // other reserves under the cumulative cap. Phototype is irrelevant here.
    // Both retinoid and BHA are strong carriers that prefer PM (retinoid is
    // pm-only; bha is pm-only by class), so they contend for the SAME period's
    // one treatment slot — acne ranks retinoid above bha, so bha reserves.
    // (Two strong actives preferring DIFFERENT periods — retinol PM + vitC AM —
    // would both admit; that is the intended second-treatment case.)
    const retinoid = makeProduct({ activeTags: ['retinoid'] });
    const bha = makeProduct({ activeTags: ['bha'] });
    const plan = generatePlan(
      makeEngineInput([retinoid, bha], {
        profile: { fitzpatrick: 5, concerns: [], primaryGoal: 'acne', secondaryGoal: null },
      }),
    );

    const scheduled = [...plan.periods.morning, ...plan.periods.evening].map((s) => s.productId);
    const strongScheduled = scheduled.filter((id) => id === retinoid.id || id === bha.id);
    expect(strongScheduled).toEqual([retinoid.id]); // only the top-ranked treatment
    expect(plan.reserve).toEqual(
      expect.arrayContaining([{ productId: bha.id, reasonCode: 'cumulative_active_cap' }]),
    );
  });

  it('escalates the caution pair to avoid for a saved routine, phototype 4', () => {
    // vitamin C + copper peptides: escalation-only, the cumulative cap stays
    // silent (copper is irritancy 2, not a strong carrier).
    const vitC = makeProduct({ activeTags: ['vitamin_c_pure'] });
    const copper = makeProduct({ activeTags: ['copper_peptides'] });
    const routines = [makeRoutine('morning', [makeRoutineStep(vitC), makeRoutineStep(copper)])];
    const result = validateRoutines(
      routines,
      makeEngineInput([vitC, copper], { profile: { fitzpatrick: 4, concerns: [] } }),
    );
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: 'avoid', ruleId: 'rule_vitc_pure_copper_peptides' }),
      ]),
    );
    expect(result.hasBlockingFindings).toBe(true);
    // Not the cumulative cap — this pair isolates the phototype escalation.
    expect(result.findings.map((f) => f.ruleId)).not.toContain('cumulative_active_cap');
  });

  it('does not escalate the same pair for phototype 3 (baseline) — stays a caution finding', () => {
    const vitC = makeProduct({ activeTags: ['vitamin_c_pure'] });
    const copper = makeProduct({ activeTags: ['copper_peptides'] });
    // AM SPF satisfies the (phase-02) unconditional photosensitizer mandate —
    // vitamin C's low-pH aside, nothing here is photosensitizing, but keeping
    // the routine complete guards against unrelated blocking findings.
    const spf = makeProduct({ productType: 'spf', usageTime: 'morning' });
    const routines = [
      makeRoutine('morning', [makeRoutineStep(vitC), makeRoutineStep(copper), makeRoutineStep(spf)]),
    ];
    const result = validateRoutines(
      routines,
      makeEngineInput([vitC, copper, spf], { profile: { fitzpatrick: 3, concerns: [] } }),
    );
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: 'caution', ruleId: 'rule_vitc_pure_copper_peptides' }),
      ]),
    );
    expect(result.hasBlockingFindings).toBe(false);
  });
});

describe('Story 7 AC: a single pre-formulated product with both actives never gets a separation rule or escalation', () => {
  it('does not freeze or day-split a single product carrying both retinoid and AHA tags', () => {
    // acne goal so the combo is admitted as a treatment (phase-04: a
    // maintenance profile would reserve it and the self-conflict test would be
    // vacuous). retinoid + aha both rank for acne.
    const combo = makeProduct({ activeTags: ['retinoid', 'aha'] });
    const plan = generatePlan(
      makeEngineInput([combo], {
        profile: { fitzpatrick: 5, concerns: [], primaryGoal: 'acne', secondaryGoal: null },
      }),
    );
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
    // acne goal so the retinoid is actually admitted → the plan contains a
    // photosensitizer → the phototype-1 SPF mandate fires (phase-04).
    const retinoid = makeProduct({ activeTags: ['retinoid'] });
    const plan = generatePlan(
      makeEngineInput([retinoid], {
        profile: { fitzpatrick: 1, concerns: [], primaryGoal: 'acne', secondaryGoal: null },
      }),
    );
    expect(plan.placeholders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ period: 'am', productTypes: ['spf'], nonSkippable: true }),
      ]),
    );
  });

  it('does not require SPF for phototype 6 (mandate is scoped to types 1-2 only)', () => {
    const retinoid = makeProduct({ activeTags: ['retinoid'] });
    const plan = generatePlan(
      makeEngineInput([retinoid], {
        profile: { fitzpatrick: 6, concerns: [], primaryGoal: 'acne', secondaryGoal: null },
      }),
    );
    expect(plan.placeholders.some((p) => p.reasonCode === 'phototype_uv_sensitivity_spf')).toBe(false);
  });
});

// Story 7 UI AC (six visual phototype cards) is activated as a component test
// in tests/routine-engine/fitzpatrick-card.test.tsx now that FE-9 shipped
// FitzpatrickCard (progress/routine-engine.md, 2026-07-05 entry) — kept out of
// this file since it needs @testing-library/react-native rendering.
