/**
 * Pre-cleanse slot ruling (deviation-by-ruling 2026-07-19): a surfactant-based
 * makeup/SPF remover (micellar water, cleansing oil/balm) is NOT a standalone
 * cleanse. It occupies a distinct PM-only `pre_cleanse` slot ordered before the
 * cleanse step, never satisfies the cleanse slot itself, and requires a gentle
 * rinse-off cleanser after it. See docs/specs/routine-engine-v2.1/phase-04-*.
 *
 * These are the ruling's three acceptance scenarios, exercised end-to-end
 * through generatePlan.
 */
import { generatePlan } from '@/utils/routineEngine/generate';
import { makeEngineInput, makeProduct, NOW, resetFixtureCounters } from './fixtures';

beforeEach(() => resetFixtureCounters());

const ids = (steps: { productId: string }[]) => steps.map((s) => s.productId);

describe('pre_cleanse slot: micellar water is a pre-cleanse, not a cleanse', () => {
  it('micellar-only shelf → no AM cleanse; PM shows micellar + a cleanser placeholder', () => {
    const micellar = makeProduct({ name: 'Micellar Water', productType: 'makeup_remover' });
    const plan = generatePlan(makeEngineInput([micellar], { now: NOW }));

    // AM has no cleanse step — the makeup remover never fills it, and it is PM-only.
    expect(ids(plan.periods.morning)).not.toContain(micellar.id);
    expect(plan.periods.morning).toHaveLength(0);

    // PM schedules the micellar as the pre-cleanse step…
    expect(ids(plan.periods.evening)).toContain(micellar.id);

    // …and the cleanse slot is unmet: a placeholder demands a gentle cleanser.
    expect(plan.placeholders).toContainEqual(
      expect.objectContaining({
        period: 'pm',
        productTypes: ['cleanser'],
        reasonCode: 'pre_cleanse_requires_followup',
      }),
    );
  });

  it('micellar + gentle foam cleanser → PM: micellar then foam; AM: foam only; no placeholder', () => {
    const micellar = makeProduct({ name: 'Micellar Water', productType: 'makeup_remover' });
    const foam = makeProduct({ name: 'Gentle Foaming Cleanser', productType: 'cleanser' });
    const plan = generatePlan(makeEngineInput([micellar, foam], { now: NOW }));

    // PM carries both, micellar (pre_cleanse) ordered before foam (cleanse).
    const pm = ids(plan.periods.evening);
    expect(pm).toContain(micellar.id);
    expect(pm).toContain(foam.id);
    expect(pm.indexOf(micellar.id)).toBeLessThan(pm.indexOf(foam.id));

    // AM has the rinse-off cleanser only — the makeup remover is PM-only.
    expect(ids(plan.periods.morning)).toEqual([foam.id]);

    // The cleanse slot is satisfied by the foam, so no follow-up placeholder.
    expect(plan.placeholders.map((p) => p.reasonCode)).not.toContain('pre_cleanse_requires_followup');
  });

  it('a "Micellar Cleansing Water" mistyped as cleanser in the DB is reclassified', () => {
    // Same behavior as scenario 1 despite the wrong productType.
    const mistyped = makeProduct({ name: 'Micellar Cleansing Water', productType: 'cleanser' });
    const plan = generatePlan(makeEngineInput([mistyped], { now: NOW }));

    expect(plan.periods.morning).toHaveLength(0);
    expect(ids(plan.periods.evening)).toContain(mistyped.id);
    // Reclassified → the scheduled step reads as a makeup remover, not a cleanser.
    expect(plan.periods.evening.find((s) => s.productId === mistyped.id)?.productType).toBe(
      'makeup_remover',
    );
    expect(plan.placeholders).toContainEqual(
      expect.objectContaining({
        period: 'pm',
        productTypes: ['cleanser'],
        reasonCode: 'pre_cleanse_requires_followup',
      }),
    );
  });
});
