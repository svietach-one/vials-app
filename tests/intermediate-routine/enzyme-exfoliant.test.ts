/**
 * Spec Story 4 (enzyme exfoliant as a weekly morning step) plus the
 * "Add anyway" override hole the planner's spike found (tech design FE-8).
 * Written against a DRAFT spec; the enzyme values (3 days, 12-ingredient
 * window, AM preference) are draft values awaiting post-MVP clinical review
 * (spec Q3), so each lives in ONE named constant below.
 */
import { reasonText } from '@/constants/decisionReasons';
import { ACTIVE_INGREDIENT_LABELS } from '@/constants/labels';
import type { FitzpatrickType, SkinGoal } from '@/types';
import { getActiveBadgeCategory } from '@/utils/activeBadges';
import { ACTIVES_GROUPS } from '@/components/addProduct/activesGroups';
import { getProductActiveKeys } from '@/utils/ingredientParser';
import { generatePlan } from '@/utils/routineEngine/generate';
import {
  buildSweepShelf,
  daysPerWeek,
    ENZYME_ID,
  ENZYME_TAG,
  gapKeys,
  ids,
  makeE4,
  makeEngineInput,
  makeEnzymePowder,
  makeProcedureLogForPeel,
  makeS3,
  makeSeasonMask,
  REASON,
  resetFixtureCounters,
  S3,
  shelfProduct,
  stepFor,
} from './fixtures';

/** Draft clinical values (spec Q3). Change here if the consultant changes them. */
const ENZYME_DAYS_NORMAL = 3;
const ENZYME_DAYS_CAPPED = 1;
const INGREDIENT_WINDOW = 12;

beforeEach(() => resetFixtureCounters());

function goal(primaryGoal: SkinGoal, secondaryGoal: SkinGoal | null = null) {
  return { fitzpatrick: null, concerns: [], primaryGoal, secondaryGoal };
}

/** An INCI list with `name` at 1-based `position` among 25 plausible fillers. */
function inciWith(name: string, position: number): string {
  const filler = Array.from({ length: 25 }, (_, i) => `Filler${i + 1}`);
  filler[position - 1] = name;
  return filler.join(', ');
}

describe('recognition (Story 4 AC1)', () => {
  it.each(['Papain', 'Bromelain', 'Subtilisin'])('reads %s at ingredient position 12 as an enzyme exfoliant', (enzyme) => {
    const keys = getProductActiveKeys({
      activeIngredients: [],
      fullIngredientText: inciWith(enzyme, INGREDIENT_WINDOW),
    });

    expect(keys).toContain(ENZYME_TAG);
  });

  it('does not read papain listed after the window (position 13) as an enzyme exfoliant', () => {
    const keys = getProductActiveKeys({
      activeIngredients: [],
      fullIngredientText: inciWith('Papain', INGREDIENT_WINDOW + 1),
    });

    expect(keys).not.toContain(ENZYME_TAG);
  });

  it('is recognised by tag alone, with the label "Enzyme Exfoliant", in the exfoliant badge bucket and a wizard group', () => {
    expect(ACTIVE_INGREDIENT_LABELS[ENZYME_TAG]).toBe('Enzyme Exfoliant');
    expect(getActiveBadgeCategory(ENZYME_TAG)).toBe('exfoliant');
    expect(ACTIVES_GROUPS.some((g) => g.keys.includes(ENZYME_TAG))).toBe(true);
  });
});

describe('the 12-ingredient window counting rule (owner/coordinator decision 2026-10-15)', () => {
  // A plain comma-separated list of top-level tokens, positions 1-based; a parenthesised
  // sub-ingredient does not take a position of its own; "Aqua" counts as position 1.
  const nested = (n: number) => `Base Blend (${Array.from({ length: n }, (_, i) => `Sub${i + 1}`).join(', ')})`;

  it('counts "Aqua" as position 1, so papain at position 12 is inside the window', () => {
    const text = ['Aqua', ...Array.from({ length: 10 }, (_, i) => `Filler${i + 2}`), 'Papain'].join(', ');

    expect(getProductActiveKeys({ activeIngredients: [], fullIngredientText: text })).toContain(ENZYME_TAG);
  });

  it('does not let a parenthesised sub-ingredient list push papain out of the window', () => {
    const text = ['Aqua', nested(8), ...Array.from({ length: 9 }, (_, i) => `Filler${i + 3}`), 'Papain'].join(', ');

    expect(getProductActiveKeys({ activeIngredients: [], fullIngredientText: text })).toContain(ENZYME_TAG);
  });

  it('reads papain at top-level position 13 as outside the window even with a nested list before it', () => {
    const text = ['Aqua', nested(3), ...Array.from({ length: 10 }, (_, i) => `Filler${i + 3}`), 'Papain'].join(', ');

    expect(getProductActiveKeys({ activeIngredients: [], fullIngredientText: text })).not.toContain(ENZYME_TAG);
  });
});

describe('scheduling on E4 at Balanced (Story 4 AC2-3)', () => {
  it.each(['spring', 'autumn', 'winter'] as const)(
    'keeps the plain cleanser daily and adds the powder after it on exactly 3 weekdays in the morning (%s)',
    (season) => {
      const plan = generatePlan(makeEngineInput(makeE4(), { seasonMask: makeSeasonMask(season) }));

      const cleanser = stepFor(plan, S3.cleanser, 'morning');
      const powder = stepFor(plan, ENZYME_ID, 'morning');
      expect(cleanser?.scheduledDays).toEqual([]);
      expect(powder).toBeDefined();
      expect(powder?.productType).toBe('peeling');
      expect(daysPerWeek(powder!)).toBe(ENZYME_DAYS_NORMAL);
      expect(ids(plan.periods.morning).indexOf(ENZYME_ID)).toBeGreaterThan(ids(plan.periods.morning).indexOf(S3.cleanser));
      expect(ids(plan.periods.evening)).not.toContain(ENZYME_ID);
    },
  );

  it('schedules the powder on 1 weekday in summer', () => {
    const plan = generatePlan(makeEngineInput(makeE4(), { seasonMask: makeSeasonMask('summer') }));

    expect(daysPerWeek(stepFor(plan, ENZYME_ID, 'morning')!)).toBe(ENZYME_DAYS_CAPPED);
  });

  it.each([4, 5, 6] as FitzpatrickType[])('schedules the powder on 1 weekday for Fitzpatrick type %i', (fitzpatrick) => {
    const plan = generatePlan(
      makeEngineInput(makeE4(), { profile: { fitzpatrick, concerns: [] } }),
    );

    expect(daysPerWeek(stepFor(plan, ENZYME_ID, 'morning')!)).toBe(ENZYME_DAYS_CAPPED);
  });

  it('recognises the powder from its ingredient list alone when it carries no tag', () => {
    const untagged = makeEnzymePowder({ activeTags: undefined, fullIngredientText: inciWith('Papain', 3) });

    const plan = generatePlan(makeEngineInput([...makeS3(), untagged]));

    expect(daysPerWeek(stepFor(plan, ENZYME_ID, 'morning')!)).toBe(ENZYME_DAYS_NORMAL);
  });

  it('treats papain listed beyond the window as an ordinary cleanser, not a weekly exfoliant', () => {
    const untagged = makeEnzymePowder({ activeTags: undefined, fullIngredientText: inciWith('Papain', INGREDIENT_WINDOW + 1) });

    const plan = generatePlan(makeEngineInput([...makeS3(), untagged]));

    expect(stepFor(plan, ENZYME_ID, 'morning')?.productType).not.toBe('peeling');
  });
});

describe('an enzyme powder is not the daily cleanse step (Story 4 AC4)', () => {
  it('a shelf whose only cleanser is the powder still raises both cleanser gaps', () => {
    const products = [makeEnzymePowder(), shelfProduct('c', 'Cream', 'moisturizer'), shelfProduct('s', 'SPF', 'spf')];

    const plan = generatePlan(makeEngineInput(products));

    expect(gapKeys(plan)).toEqual(expect.arrayContaining(['am:cleanser', 'pm:cleanser']));
  });
});

describe('only one enzyme product is scheduled (Story 4 AC5)', () => {
  it('schedules one of two powders and keeps the other in reserve as a duplicate role', () => {
    const second = makeEnzymePowder({ id: 'e4-enzyme-2', name: 'Pineapple Enzyme Mask Powder', addedAt: '2026-02-01' });
    const plan = generatePlan(makeEngineInput([...makeE4(), second]));

    const scheduled = [ENZYME_ID, second.id].filter((id) => ids(plan.periods.morning).includes(id));
    expect(scheduled).toHaveLength(1);
    const loser = [ENZYME_ID, second.id].find((id) => id !== scheduled[0])!;
    const row = plan.reserve.find((r) => r.productId === loser);
    expect(row?.reasonCode).toBe('duplicate_function');
    expect(reasonText(row!.reasonCode)).toBe('Another product already covers this role — kept in reserve.');
  });
});

describe('goal, procedure and style gates (Story 4 AC6-8)', () => {
  it.each([
    ['primary', goal('barrier_repair')],
    ['secondary', goal('maintenance', 'barrier_repair')],
  ])('defers the powder to reserve when barrier repair is the %s goal', (_label, profile) => {
    const plan = generatePlan(makeEngineInput(makeE4(), { profile }));

    const row = plan.reserve.find((r) => r.productId === ENZYME_ID);
    expect(row?.reasonCode).toBe(REASON('exfoliant_deferred_barrier_repair'));
    expect(reasonText(row!.reasonCode)).toBe('Repairing your barrier first — exfoliation is paused.');
    expect(ids(plan.periods.morning)).not.toContain(ENZYME_ID);
  });

  it('pauses the powder with its expiry date and never schedules it during peel rehab', () => {
    const plan = generatePlan(
      makeEngineInput(makeE4(), { procedures: [makeProcedureLogForPeel('2026-07-04')] }),
    );

    const frozen = plan.frozen.find((f) => f.productId === ENZYME_ID);
    expect(frozen?.reasonCode).toBe('peel_rehab_no_exfoliants');
    expect(frozen?.until).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect([...ids(plan.periods.morning), ...ids(plan.periods.evening)]).not.toContain(ENZYME_ID);
  });
});

describe('"Add anyway" on an enzyme product (Story 4 AC9, FE-8 override hole)', () => {
  it('lands in one period only, capped, when forced past the barrier-repair deferral', () => {
    const plan = generatePlan(
      makeEngineInput(makeE4(), { userOverrides: [ENZYME_ID], profile: goal('barrier_repair') }),
    );

    const inMorning = stepFor(plan, ENZYME_ID, 'morning');
    const inEvening = stepFor(plan, ENZYME_ID, 'evening');
    expect([inMorning, inEvening].filter(Boolean)).toHaveLength(1);
    const step = (inMorning ?? inEvening)!;
    expect(daysPerWeek(step)).toBeLessThanOrEqual(ENZYME_DAYS_NORMAL);
    expect(step.scheduledDays.length).toBeGreaterThan(0);
  });

  it('lands in one period only, capped, when a duplicate second powder is forced in', () => {
    const second = makeEnzymePowder({ id: 'e4-enzyme-2', name: 'Pineapple Enzyme Powder', addedAt: '2026-02-01' });
    const plan = generatePlan(makeEngineInput([...makeE4(), second], { userOverrides: [ENZYME_ID, second.id] }));

    for (const id of [ENZYME_ID, second.id]) {
      const periods = (['morning', 'evening'] as const).filter((p) => stepFor(plan, id, p));
      expect(periods.length).toBeLessThanOrEqual(1);
      for (const p of periods) {
        const step = stepFor(plan, id, p)!;
        expect(step.scheduledDays.length).toBeGreaterThan(0);
        expect(daysPerWeek(step)).toBeLessThanOrEqual(ENZYME_DAYS_NORMAL);
      }
    }
  });

  it('re-enters its preferred (morning) period, not the evening', () => {
    const plan = generatePlan(
      makeEngineInput(makeE4(), { userOverrides: [ENZYME_ID] }),
    );

    expect(stepFor(plan, ENZYME_ID, 'morning')).toBeDefined();
    expect(stepFor(plan, ENZYME_ID, 'evening')).toBeUndefined();
  });

  it('keeps the 1-day cap in summer even when forced in', () => {
    const plan = generatePlan(
      makeEngineInput(makeE4(), { userOverrides: [ENZYME_ID], seasonMask: makeSeasonMask('summer') }),
    );

    expect(daysPerWeek(stepFor(plan, ENZYME_ID, 'morning')!)).toBeLessThanOrEqual(ENZYME_DAYS_CAPPED);
  });
});

describe('safety locks hold on enzyme-salted shelves (Story 4 AC10)', () => {
  it('never schedules a retinoid, AHA or BHA product in the morning, and never asks for an exfoliant, over 300 seeded shelves', () => {
    const offences: string[] = [];
    let shelvesWithEnzyme = 0;
    for (let seed = 0; seed < 300; seed += 1) {
      const { input, tagsById } = buildSweepShelf(seed, { enzyme: true, salt: 4 });
      const plan = generatePlan(input);
      if ([...tagsById.values()].some((t) => t.includes(ENZYME_TAG))) shelvesWithEnzyme += 1;
      for (const step of plan.periods.morning) {
        const tags = tagsById.get(step.productId) ?? [];
        if (tags.some((t) => ['retinoid', 'aha', 'bha'].includes(t))) offences.push(`seed ${seed}: ${step.productId}`);
      }
      for (const p of plan.placeholders) {
        if (p.productTypes.includes('peeling')) offences.push(`seed ${seed}: exfoliant gap card`);
      }
    }
    expect(shelvesWithEnzyme).toBeGreaterThan(100);
    expect(offences).toEqual([]);
  });

  it('never schedules an enzyme product on more than 3 days, daily, or in both periods without an override', () => {
    const offences: string[] = [];
    for (let seed = 0; seed < 300; seed += 1) {
      const { input, tagsById } = buildSweepShelf(seed, { enzyme: true, salt: 5 });
      const plan = generatePlan({ ...input, userOverrides: undefined });
      const enzymeIds = [...tagsById.entries()].filter(([, t]) => t.includes(ENZYME_TAG)).map(([id]) => id);
      for (const id of enzymeIds) {
        const am = stepFor(plan, id, 'morning');
        const pm = stepFor(plan, id, 'evening');
        const isDaily = (s?: { scheduledDays: number[] }) => !!s && s.scheduledDays.length === 0;
        // Scope: products whose ONLY tag is the enzyme tag and whose type is the spec's own example
        // shape (cleanser/peeling). An enzyme serum/toner/cream/eye cream is a spec gap: does it fill
        // its format's slot or the exfoliate slot? (see report, finding on Story 4.)
        const type = input.products.find((p) => p.id === id)?.productType;
        if ((tagsById.get(id) ?? []).length !== 1 || (type !== 'cleanser' && type !== 'peeling')) continue;
        if (am && pm) offences.push(`seed ${seed}: ${id} in both periods`);
        if (isDaily(am) || isDaily(pm)) offences.push(`seed ${seed}: ${id} scheduled daily`);
        for (const s of [am, pm]) if (s && daysPerWeek(s) > ENZYME_DAYS_NORMAL) offences.push(`seed ${seed}: ${id} > 3 days`);
      }
    }
    expect(offences).toEqual([]);
  });
});
