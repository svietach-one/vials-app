import type { AddProductDraft } from '../../types';
import { formReducer, initialDraft } from './formReducer';
import { buildProductFromDraft, buildSuggestPayload } from './saveProduct';

function completedDraft(overrides: Partial<AddProductDraft> = {}): AddProductDraft {
  const base = [
    { type: 'SET_BRAND', value: 'CeraVe', source: 'typed' } as const,
    { type: 'SET_NAME', value: 'Foaming Cleanser', source: 'typed' } as const,
    { type: 'SET_CATEGORY', value: 'cleanser', source: 'manual' } as const,
    { type: 'SET_PAO', months: 12 } as const,
  ].reduce(formReducer, initialDraft());
  return { ...base, ...overrides };
}

describe('buildProductFromDraft', () => {
  it('maps a completed draft onto the Product shape with injected id and timestamp', () => {
    const draft = completedDraft({
      barcode: '3337875597197',
      inciRaw: 'Aqua, Niacinamide',
      activeIngredientKeys: ['niacinamide'],
      isOpened: true,
      openedDate: '2026-07-01',
    });

    const product = buildProductFromDraft(draft, 'id-1', '2026-07-11T10:00:00.000Z');

    expect(product).toMatchObject({
      id: 'id-1',
      name: 'Foaming Cleanser',
      brand: 'CeraVe',
      productType: 'cleanser',
      activeTags: ['niacinamide'],
      fullIngredientText: 'Aqua, Niacinamide',
      addedAt: '2026-07-11T10:00:00.000Z',
      openedDate: '2026-07-01',
      paoMonths: 12,
      barcode: '3337875597197',
      source: 'user_local',
    });
    expect(product.activeIngredients).toEqual([
      { key: 'niacinamide', displayName: 'Niacinamide' },
    ]);
  });

  it('nulls openedDate when the product was never marked opened', () => {
    const product = buildProductFromDraft(
      completedDraft({ openedDate: '2026-07-01', isOpened: false }),
      'id-1',
      '2026-07-11T10:00:00.000Z',
    );

    expect(product.openedDate).toBeNull();
  });

  it('throws when called before the draft passed canSave', () => {
    const draft = { ...completedDraft(), productType: null };

    expect(() => buildProductFromDraft(draft, 'id-1', '2026-07-11T10:00:00.000Z')).toThrow();
  });
});

describe('buildSuggestPayload — privacy boundary', () => {
  it('contains exactly the shareable fields and nothing else', () => {
    const draft = completedDraft({
      barcode: '3337875597197',
      inciRaw: 'Aqua, Niacinamide',
      isOpened: true,
      openedDate: '2026-07-01',
    });

    const payload = buildSuggestPayload(draft);

    expect(payload).toEqual({
      brand: 'CeraVe',
      name: 'Foaming Cleanser',
      productType: 'cleanser',
      barcode: '3337875597197',
      inciRaw: 'Aqua, Niacinamide',
      status: 'pending',
    });
    // The structural guarantee: no key beyond the six declared ones, so
    // openedDate/isOpened/paoMonths can never reach the network layer.
    expect(Object.keys(payload).sort()).toEqual(
      ['barcode', 'brand', 'inciRaw', 'name', 'productType', 'status'].sort(),
    );
  });

  it('passes null barcode and inciRaw through as optional server-side fields', () => {
    const payload = buildSuggestPayload(completedDraft());

    expect(payload.barcode).toBeNull();
    expect(payload.inciRaw).toBeNull();
  });
});
