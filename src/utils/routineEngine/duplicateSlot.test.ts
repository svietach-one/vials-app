import type { Product, RoutineStep, UserProcedureLog } from '@/types';
import { buildRoutineContext, type RoutineContext } from '@/utils/routineEngine/context';
import {
  findSameSlotStep,
  findSlotDuplicateGroups,
  rankSlotGroup,
} from '@/utils/routineEngine/duplicateSlot';
import { buildShelfFacts } from '@/utils/routineEngine/productFacts';

const NOW = new Date('2026-07-04T12:00:00Z');

let idCounter = 0;
function makeProduct(overrides: Partial<Product> = {}): Product {
  idCounter += 1;
  return {
    id: `p${idCounter}`,
    name: `Product ${idCounter}`,
    brand: null,
    productType: 'moisturizer',
    imageUrl: null,
    activeIngredients: [],
    fullIngredientText: null,
    usageTime: 'both',
    openBeautyFactsId: null,
    addedAt: '2026-01-01',
    notes: null,
    openedDate: null,
    paoMonths: null,
    ...overrides,
  };
}

function makeStep(overrides: Partial<RoutineStep> = {}): RoutineStep {
  return {
    id: `s${Math.random()}`,
    productType: 'moisturizer',
    productId: null,
    hidden: false,
    scheduledDays: [],
    ...overrides,
  };
}

function makeContext(
  options: { procedures?: UserProcedureLog[]; fitzpatrick?: 1 | 2 | 3 | 4 | 5 | 6 | null } = {},
): RoutineContext {
  return buildRoutineContext({
    procedures: options.procedures ?? [],
    profile: { fitzpatrick: options.fitzpatrick ?? null },
    seasonMask: { season: 'spring', source: 'calendar' },
    now: NOW,
  });
}

beforeEach(() => {
  idCounter = 0;
});

describe('findSameSlotStep', () => {
  it('returns the existing step sharing the same layering slot', () => {
    const existing = makeStep({ productType: 'moisturizer', productId: 'existing-id' });
    const result = findSameSlotStep([existing], 'moisturizer');
    expect(result).toBe(existing);
  });

  it('matches across productTypes that share one slot (cream/lotion/moisturizer)', () => {
    const existing = makeStep({ productType: 'cream', productId: 'existing-id' });
    const result = findSameSlotStep([existing], 'lotion');
    expect(result).toBe(existing);
  });

  it('excludes the given productId — an exact re-add is never a conflict', () => {
    const existing = makeStep({ productType: 'moisturizer', productId: 'same-id' });
    const result = findSameSlotStep([existing], 'moisturizer', 'same-id');
    expect(result).toBeNull();
  });

  it('returns null when nothing shares the slot', () => {
    const existing = makeStep({ productType: 'serum', productId: 'existing-id' });
    const result = findSameSlotStep([existing], 'moisturizer');
    expect(result).toBeNull();
  });

  it('ignores hidden steps', () => {
    const existing = makeStep({ productType: 'moisturizer', productId: 'existing-id', hidden: true });
    const result = findSameSlotStep([existing], 'moisturizer');
    expect(result).toBeNull();
  });

  it('exempts the "other" slot — two "other" products never conflict', () => {
    const existing = makeStep({ productType: 'other', productId: 'existing-id' });
    const result = findSameSlotStep([existing], 'other');
    expect(result).toBeNull();
  });
});

describe('findSlotDuplicateGroups', () => {
  it('groups 2+ steps sharing a slot', () => {
    const a = makeStep({ productType: 'moisturizer', productId: 'a' });
    const b = makeStep({ productType: 'cream', productId: 'b' });
    const groups = findSlotDuplicateGroups([a, b]);
    expect(groups).toEqual([[a, b]]);
  });

  it('does not group a single occupant of a slot', () => {
    const a = makeStep({ productType: 'moisturizer', productId: 'a' });
    const b = makeStep({ productType: 'serum', productId: 'b' });
    expect(findSlotDuplicateGroups([a, b])).toEqual([]);
  });

  it('skips hidden and productId-null steps', () => {
    const a = makeStep({ productType: 'moisturizer', productId: 'a' });
    const hidden = makeStep({ productType: 'moisturizer', productId: 'b', hidden: true });
    const empty = makeStep({ productType: 'moisturizer', productId: null });
    expect(findSlotDuplicateGroups([a, hidden, empty])).toEqual([]);
  });

  it('exempts the "other" slot from grouping', () => {
    const a = makeStep({ productType: 'other', productId: 'a' });
    const b = makeStep({ productType: 'other', productId: 'b' });
    expect(findSlotDuplicateGroups([a, b])).toEqual([]);
  });

  it('returns one group per distinct slot when multiple slots each have duplicates', () => {
    const a = makeStep({ productType: 'moisturizer', productId: 'a' });
    const b = makeStep({ productType: 'lotion', productId: 'b' });
    const c = makeStep({ productType: 'spf', productId: 'c' });
    const d = makeStep({ productType: 'spf', productId: 'd' });
    const groups = findSlotDuplicateGroups([a, b, c, d]);
    expect(groups).toHaveLength(2);
    expect(groups).toEqual(expect.arrayContaining([[a, b], [c, d]]));
  });
});

describe('rankSlotGroup', () => {
  it('ranks the higher-scoring (concern-matching) product first', () => {
    const matching = makeProduct({ activeTags: ['benzoyl_peroxide'], addedAt: '2026-01-01' });
    const other = makeProduct({ activeTags: ['ceramides'], addedAt: '2026-06-01' });
    const group = [
      makeStep({ productType: 'serum', productId: matching.id }),
      makeStep({ productType: 'serum', productId: other.id }),
    ];
    const products = [matching, other];
    const facts = buildShelfFacts(products, NOW);
    const ranked = rankSlotGroup(group, products, facts, makeContext(), ['acne']);
    expect(ranked.map((p) => p.id)).toEqual([matching.id, other.id]);
  });

  it('breaks equal scores by newer addedAt first', () => {
    const older = makeProduct({ addedAt: '2026-01-01' });
    const newer = makeProduct({ addedAt: '2026-06-01' });
    const group = [
      makeStep({ productType: 'moisturizer', productId: older.id }),
      makeStep({ productType: 'moisturizer', productId: newer.id }),
    ];
    const products = [older, newer];
    const facts = buildShelfFacts(products, NOW);
    const ranked = rankSlotGroup(group, products, facts, makeContext(), []);
    expect(ranked.map((p) => p.id)).toEqual([newer.id, older.id]);
  });

  it('drops a group member missing from the products list instead of crashing', () => {
    const known = makeProduct();
    const group = [
      makeStep({ productType: 'moisturizer', productId: known.id }),
      makeStep({ productType: 'moisturizer', productId: 'ghost-id' }),
    ];
    const facts = buildShelfFacts([known], NOW);
    const ranked = rankSlotGroup(group, [known], facts, makeContext(), []);
    expect(ranked).toEqual([known]);
  });

  it('is deterministic given the same inputs', () => {
    const a = makeProduct({ activeTags: ['retinoid'], addedAt: '2026-03-01' });
    const b = makeProduct({ activeTags: ['aha'], addedAt: '2026-02-01' });
    const group = [
      makeStep({ productType: 'serum', productId: a.id }),
      makeStep({ productType: 'serum', productId: b.id }),
    ];
    const products = [a, b];
    const facts = buildShelfFacts(products, NOW);
    const context = makeContext();
    const first = rankSlotGroup(group, products, facts, context, ['acne']).map((p) => p.id);
    const second = rankSlotGroup(group, products, facts, context, ['acne']).map((p) => p.id);
    expect(first).toEqual(second);
  });
});
