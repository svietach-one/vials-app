/**
 * "Not silent", direction 2: every shelf product that is not a saved step is a
 * row in the "Not in your routine" list, with a reason (spec Story 5, G5).
 * Exercises the pure util `buildLeftOutItems(plan, products, routines)`
 * (tech design FE-9) over REAL generated plans.
 *
 * ASSUMED interface (tech design pins the name and arguments, not the item shape):
 *   buildLeftOutItems(plan: RoutinePlan, products: Product[], routines: Routine[]): LeftOutItem[]
 *   LeftOutItem = { productId: string; kind: 'ready'|'reserve'|'frozen'|'alternative';
 *                   reasonCode: DecisionReasonCode | null; until?: string }
 *   ordered ready -> reserve -> frozen -> alternative, shelf order within a kind.
 * Written against a DRAFT spec.
 */
import type { Product, Routine } from '@/types';
import { generatePlan } from '@/utils/routineEngine/generate';
import { buildLeftOutItems, type LeftOutKind } from '@/utils/routineLeftOut';
import {
  buildSweepShelf,
  DEPTHS,
  makeDepthInput,
  makeProcedureLogForPeel,
  makeR9,
  makeRng,
  makeRoutine,
  makeRoutineStep,
  makeS3,
  R9,
  REASON,
  resetFixtureCounters,
  routinesFromPlan,
  shelfProduct,
} from './fixtures';

beforeEach(() => resetFixtureCounters());

const kinds = (items: { kind: LeftOutKind }[]) => items.map((i) => i.kind);
const idsOf = (items: { productId: string }[]) => items.map((i) => i.productId);

describe('what is listed after the user saved one style and the plan is another', () => {
  it('lists the toner and eye cream as ready, then the reserve products, when an Essential routine is saved and the plan is Balanced', () => {
    const products = makeR9();
    const saved = routinesFromPlan(generatePlan(makeDepthInput(products, 'essential')));
    const plan = generatePlan(makeDepthInput(products, 'balanced'));

    const items = buildLeftOutItems(plan, products, saved);

    expect(idsOf(items)).toEqual([R9.toner, R9.eye, R9.essence, R9.oil, R9.ampoule]);
    expect(kinds(items)).toEqual(['ready', 'ready', 'reserve', 'reserve', 'reserve']);
    expect(items.find((i) => i.productId === R9.essence)?.reasonCode).toBe('not_needed_for_goals');
  });

  it('does not list a product that still has a saved step, even though the new plan would drop it (nothing changes until the user saves)', () => {
    const products = makeR9();
    const saved = routinesFromPlan(generatePlan(makeDepthInput(products, 'balanced')));
    const plan = generatePlan(makeDepthInput(products, 'essential'));

    const items = buildLeftOutItems(plan, products, saved);

    expect(idsOf(items)).not.toContain(R9.toner);
    expect(idsOf(items)).not.toContain(R9.eye);
  });

  it('after the Essential draft is saved, shows the toner and eye cream as reserve rows carrying the style reason', () => {
    const products = makeR9();
    const plan = generatePlan(makeDepthInput(products, 'essential'));

    const items = buildLeftOutItems(plan, products, routinesFromPlan(plan));

    const toner = items.find((i) => i.productId === R9.toner);
    const eye = items.find((i) => i.productId === R9.eye);
    expect(toner?.kind).toBe('reserve');
    expect(toner?.reasonCode).toBe(REASON('outside_routine_depth'));
    expect(eye?.reasonCode).toBe(REASON('outside_routine_depth'));
  });
});

describe('row kinds', () => {
  it('lists a same-slot loser as an alternative (backup) when the winner is the saved step', () => {
    const products = [
      ...makeS3(),
      shelfProduct('t-a', 'Toner A', 'toner', { addedAt: '2026-02-01' }),
      shelfProduct('t-b', 'Toner B', 'toner', { addedAt: '2026-03-01' }),
    ];
    const plan = generatePlan(makeDepthInput(products, 'balanced'));

    const items = buildLeftOutItems(plan, products, routinesFromPlan(plan));

    expect(kinds(items)).toEqual(['alternative']);
    expect(['t-a', 't-b']).toContain(items[0].productId);
  });

  it('lists a clinically frozen product as frozen with its expiry date', () => {
    const acid = shelfProduct('acid', 'AHA Serum', 'serum', { activeTags: ['aha'], usageTime: 'evening' });
    const products = [...makeS3(), acid];
    const plan = generatePlan(
      makeDepthInput(products, 'balanced', { procedures: [makeProcedureLogForPeel('2026-07-04')] }),
    );

    const items = buildLeftOutItems(plan, products, routinesFromPlan(plan));

    const row = items.find((i) => i.productId === 'acid');
    expect(row?.kind).toBe('frozen');
    expect(row?.until).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('lets "ready" outrank "reserve" and "frozen" outrank "alternative" in the list order', () => {
    const products = makeR9();
    const plan = generatePlan(makeDepthInput(products, 'balanced'));

    const order = kinds(buildLeftOutItems(plan, products, []));

    const rank: Record<LeftOutKind, number> = { ready: 0, reserve: 1, frozen: 2, alternative: 3 };
    expect(order.map((k) => rank[k])).toEqual([...order.map((k) => rank[k])].sort((a, b) => a - b));
  });
});

describe('what is never listed', () => {
  it('skips a product the user hid', () => {
    const hidden = shelfProduct('hid', 'Hidden Toner', 'toner', { isHidden: true });
    const products = [...makeS3(), hidden];
    const plan = generatePlan(makeDepthInput(products, 'balanced'));

    expect(idsOf(buildLeftOutItems(plan, products, []))).not.toContain('hid');
  });

  it('skips a product whose only saved step is hidden', () => {
    const toner = shelfProduct('t', 'Toner', 'toner');
    const products = [...makeS3(), toner];
    const plan = generatePlan(makeDepthInput(products, 'balanced'));
    const routines: Routine[] = [makeRoutine('morning', [makeRoutineStep(toner, { hidden: true })])];

    expect(idsOf(buildLeftOutItems(plan, products, routines))).not.toContain('t');
  });

  it('returns nothing when every shelf product is a saved step', () => {
    const products = makeS3();
    const plan = generatePlan(makeDepthInput(products, 'essential'));

    expect(buildLeftOutItems(plan, products, routinesFromPlan(plan))).toEqual([]);
  });
});

describe('accountability: saved steps plus left-out rows cover every non-hidden shelf product (G5)', () => {
  it.each(DEPTHS)('%s: holds over 300 seeded shelves with random saved subsets and hidden steps', (depth) => {
    const offences: string[] = [];
    const seen: Record<LeftOutKind, number> = { ready: 0, reserve: 0, frozen: 0, alternative: 0 };

    for (let seed = 0; seed < 300; seed += 1) {
      const { input } = buildSweepShelf(seed, depth, { salt: 6 });
      const products: Product[] = input.products;
      const plan = generatePlan(input);
      const rng = makeRng(seed * 31 + 5);

      const full = routinesFromPlan(plan);
      const saved: Routine[] = full.map((r) => ({ ...r, steps: r.steps.filter(() => rng() < 0.6) }));
      for (const p of products) {
        if (rng() < 0.1) saved[0].steps.push(makeRoutineStep(p, { hidden: true, id: `hid-${seed}-${p.id}` }));
      }
      const savedIds = new Set(saved.flatMap((r) => r.steps.map((s) => s.productId)));

      const items = buildLeftOutItems(plan, products, saved);
      const listed = idsOf(items);
      if (new Set(listed).size !== listed.length) offences.push(`seed ${seed}: product listed twice`);

      const scheduled = new Set([...plan.periods.morning, ...plan.periods.evening].map((s) => s.productId));
      const reserved = new Set(plan.reserve.map((r) => r.productId));
      const frozen = new Set(plan.frozen.map((f) => f.productId));
      const alts = new Set((plan.slotAlternatives ?? []).flatMap((a) => a.alternatives.map((s) => s.productId)));

      for (const p of products) {
        if (p.isHidden) {
          if (listed.includes(p.id)) offences.push(`seed ${seed}: hidden ${p.id} listed`);
          continue;
        }
        if (savedIds.has(p.id)) {
          if (listed.includes(p.id)) offences.push(`seed ${seed}: saved ${p.id} listed`);
        } else if (!listed.includes(p.id)) {
          offences.push(`seed ${seed}: ${p.id} (${p.productType}) is neither saved nor listed`);
        }
      }
      for (const item of items) {
        seen[item.kind] += 1;
        const ok =
          (item.kind === 'ready' && scheduled.has(item.productId)) ||
          (item.kind === 'reserve' && reserved.has(item.productId)) ||
          (item.kind === 'frozen' && frozen.has(item.productId)) ||
          (item.kind === 'alternative' && alts.has(item.productId));
        // The util's documented fallback (reserve / not_needed_for_goals) must be unreachable.
        if (!ok) offences.push(`seed ${seed}: ${item.productId} listed as ${item.kind} but the plan says otherwise`);
      }
    }

    expect(offences).toEqual([]);
    expect(seen.ready).toBeGreaterThan(100);
    expect(seen.reserve).toBeGreaterThan(100);
    expect(seen.frozen).toBeGreaterThan(0);
    expect(seen.alternative).toBeGreaterThan(0);
  });
});
