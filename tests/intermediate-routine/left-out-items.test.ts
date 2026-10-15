/**
 * "Not silent", direction 2: every owned, non-hidden shelf product that has no
 * non-hidden saved step (either routine, any weekday) is a row in the
 * "Not in your routine" list, with a reason (spec Story 4, G5, Q6).
 * Exercises the pure util `buildLeftOutItems(plan, products, routines)`
 * (tech design FE-7, signature and LeftOutItem shape pinned by the design).
 */
import type { Product, Routine } from '@/types';
import { generatePlan } from '@/utils/routineEngine/generate';
import { buildLeftOutItems, type LeftOutKind } from '@/utils/routineLeftOut';
import {
  buildSweepShelf,
  makeEngineInput,
  makeProcedureLogForPeel,
  makeR9,
  makeRng,
  makeRoutine,
  makeRoutineStep,
  makeS3,
  R9,
  resetFixtureCounters,
  routinesFromPlan,
  savedRoutinesFor,
  shelfProduct,
} from './fixtures';

beforeEach(() => resetFixtureCounters());

const kinds = (items: { kind: LeftOutKind }[]) => items.map((i) => i.kind);
const idsOf = (items: { productId: string }[]) => items.map((i) => i.productId);

describe('what is listed', () => {
  it('lists the toner and eye cream as ready, then the reserve products, when the saved routine holds only the core steps', () => {
    const products = makeR9();
    const saved = savedRoutinesFor(products, [R9.foam, R9.cream, R9.spf]);
    const plan = generatePlan(makeEngineInput(products));

    const items = buildLeftOutItems(plan, products, saved);

    expect(idsOf(items)).toEqual([R9.micellar, R9.toner, R9.eye, R9.essence, R9.oil, R9.ampoule]);
    expect(kinds(items)).toEqual(['ready', 'ready', 'ready', 'reserve', 'reserve', 'reserve']);
    expect(items.find((i) => i.productId === R9.essence)?.reasonCode).toBe('not_needed_for_goals');
  });

  it('lists a product whose only step was removed, as ready when the fresh plan schedules it (Q6)', () => {
    const products = makeS3();
    const plan = generatePlan(makeEngineInput(products));
    const saved = routinesFromPlan(plan).map((r) => ({ ...r, steps: r.steps.filter((s) => s.productId !== 's3-cream') }));

    const items = buildLeftOutItems(plan, products, saved);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ productId: 's3-cream', kind: 'ready' });
  });

  it('lists a product whose only step is hidden, as ready when the fresh plan schedules it (supersedes "hidden counts as saved")', () => {
    const products = makeS3();
    const plan = generatePlan(makeEngineInput(products));
    const saved = routinesFromPlan(plan).map((r) => ({
      ...r,
      steps: r.steps.map((s) => (s.productId === 's3-cream' ? { ...s, hidden: true } : s)),
    }));

    expect(buildLeftOutItems(plan, products, saved).map((i) => [i.productId, i.kind])).toEqual([['s3-cream', 'ready']]);
  });

  it('does NOT list a product with a visible step in only one period or on only some weekdays (the list is per product)', () => {
    const products = makeS3();
    const plan = generatePlan(makeEngineInput(products));
    const cream = products.find((p) => p.id === 's3-cream')!;
    const cleanser = products.find((p) => p.id === 's3-cleanser')!;
    const spf = products.find((p) => p.id === 's3-spf')!;
    const saved: Routine[] = [
      makeRoutine('morning', [makeRoutineStep(cleanser), makeRoutineStep(cream, { scheduledDays: [1] }), makeRoutineStep(spf)]),
      makeRoutine('evening', [makeRoutineStep(cleanser)]),
    ];

    expect(buildLeftOutItems(plan, products, saved)).toEqual([]);
  });

  it('lists a same-slot loser as an alternative (backup) when the winner is the saved step', () => {
    const products = [
      ...makeS3(),
      shelfProduct('t-a', 'Toner A', 'toner', { addedAt: '2026-02-01' }),
      shelfProduct('t-b', 'Toner B', 'toner', { addedAt: '2026-03-01' }),
    ];
    const plan = generatePlan(makeEngineInput(products));

    const items = buildLeftOutItems(plan, products, routinesFromPlan(plan));

    expect(kinds(items)).toEqual(['alternative']);
    expect(['t-a', 't-b']).toContain(items[0].productId);
  });

  it('lists a clinically frozen product as frozen with its expiry date', () => {
    const acid = shelfProduct('acid', 'AHA Serum', 'serum', { activeTags: ['aha'], usageTime: 'evening' });
    const products = [...makeS3(), acid];
    const plan = generatePlan(makeEngineInput(products, { procedures: [makeProcedureLogForPeel('2026-07-04')] }));

    const row = buildLeftOutItems(plan, products, routinesFromPlan(plan)).find((i) => i.productId === 'acid');

    expect(row?.kind).toBe('frozen');
    expect(row?.until).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('orders ready, then reserve, then frozen, then alternative', () => {
    const products = makeR9();
    const plan = generatePlan(makeEngineInput(products));
    const rank: Record<LeftOutKind, number> = { ready: 0, reserve: 1, frozen: 2, alternative: 3 };

    const order = kinds(buildLeftOutItems(plan, products, [])).map((k) => rank[k]);

    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});

describe('what is never listed', () => {
  it('skips a product hidden on the shelf', () => {
    const products = [...makeS3(), shelfProduct('hid', 'Hidden Toner', 'toner', { isHidden: true })];
    const plan = generatePlan(makeEngineInput(products));

    expect(idsOf(buildLeftOutItems(plan, products, []))).not.toContain('hid');
  });

  it('skips a wishlist product', () => {
    const products = [...makeS3(), shelfProduct('wish', 'Wishlist Toner', 'toner', { status: 'wishlist' })];
    const plan = generatePlan(makeEngineInput(products.filter((p) => p.status !== 'wishlist')));

    expect(idsOf(buildLeftOutItems(plan, products, []))).not.toContain('wish');
  });

  it('returns nothing when every shelf product is a visible saved step', () => {
    const products = makeS3();
    const plan = generatePlan(makeEngineInput(products));

    expect(buildLeftOutItems(plan, products, routinesFromPlan(plan))).toEqual([]);
  });
});

describe('accountability: non-hidden saved steps plus listed rows cover every owned, non-hidden shelf product (G5)', () => {
  it('holds over 300 seeded shelves with removed, hidden and wishlist products', () => {
    const offences: string[] = [];
    const seen: Record<LeftOutKind, number> = { ready: 0, reserve: 0, frozen: 0, alternative: 0 };

    for (let seed = 0; seed < 300; seed += 1) {
      const { input, shelf } = buildSweepShelf(seed, { salt: 6, wishlist: true });
      const plan = generatePlan(input);
      const rng = makeRng(seed * 31 + 5);

      const full = routinesFromPlan(plan);
      const saved: Routine[] = full.map((r) => ({
        ...r,
        steps: r.steps.flatMap((s) => {
          const roll = rng();
          if (roll < 0.25) return []; // removed
          if (roll < 0.4) return [{ ...s, hidden: true }]; // hidden
          if (roll < 0.5 && s.scheduledDays.length === 0) return [{ ...s, scheduledDays: [1, 3] }]; // some weekdays
          return [s];
        }),
      }));
      const visibleSaved = new Set(saved.flatMap((r) => r.steps.filter((s) => !s.hidden).map((s) => s.productId)));

      const items = buildLeftOutItems(plan, shelf, saved);
      const listed = idsOf(items);
      if (new Set(listed).size !== listed.length) offences.push(`seed ${seed}: product listed twice`);

      const scheduled = new Set([...plan.periods.morning, ...plan.periods.evening].map((s) => s.productId));
      const reserved = new Set(plan.reserve.map((r) => r.productId));
      const frozen = new Set(plan.frozen.map((f) => f.productId));
      const alts = new Set((plan.slotAlternatives ?? []).flatMap((a) => a.alternatives.map((s) => s.productId)));

      for (const p of shelf as Product[]) {
        const excluded = p.isHidden === true || p.status === 'wishlist';
        if (excluded) {
          if (listed.includes(p.id)) offences.push(`seed ${seed}: excluded ${p.id} listed`);
        } else if (visibleSaved.has(p.id)) {
          if (listed.includes(p.id)) offences.push(`seed ${seed}: visibly saved ${p.id} listed`);
        } else if (!listed.includes(p.id)) {
          offences.push(`seed ${seed}: ${p.id} (${p.productType}) is neither a visible saved step nor listed`);
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
