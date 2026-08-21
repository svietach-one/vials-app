import type { Product } from '@/types';
import { resolveFromActiveKeys, resolveFromProduct } from '@/utils/productProfile/resolve';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Test Product',
    brand: 'Test Brand',
    productType: 'serum',
    imageUrl: null,
    activeIngredients: [],
    activeTags: [],
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

describe('resolveFromProduct — activeTags union fullIngredientText', () => {
  it('returns an empty resolved set and no unresolved tokens for a product with no tags or text', () => {
    const resolved = resolveFromProduct(makeProduct());

    expect(resolved.resolvedActiveKeys).toEqual([]);
    expect(resolved.unresolvedIngredientTokens).toEqual([]);
  });

  it('resolves a wizard-confirmed tag even with no ingredient text', () => {
    const resolved = resolveFromProduct(makeProduct({ activeTags: ['ceramides'] }));

    expect(resolved.resolvedActiveKeys).toEqual(['ceramides']);
    expect(resolved.unresolvedIngredientTokens).toEqual([]);
  });

  it('normalizes a legacy activeTags key to its canonical class', () => {
    const resolved = resolveFromProduct(makeProduct({ activeTags: ['retinol'] }));

    expect(resolved.resolvedActiveKeys).toEqual(['retinoid']);
  });

  it('drops an unknown activeTags key silently (not surfaced as an unresolved token)', () => {
    const resolved = resolveFromProduct(
      makeProduct({ activeTags: ['not_a_real_key' as never] }),
    );

    expect(resolved.resolvedActiveKeys).toEqual([]);
    expect(resolved.unresolvedIngredientTokens).toEqual([]);
  });

  it('unions activeTags and fullIngredientText matches without duplication', () => {
    const resolved = resolveFromProduct(
      makeProduct({
        activeTags: ['niacinamide'],
        fullIngredientText: 'Aqua, Niacinamide, Ceramide NP',
      }),
    );

    expect(resolved.resolvedActiveKeys).toEqual(['ceramides', 'niacinamide']);
  });

  it('surfaces a comma-token that matches no known class as an unresolved token', () => {
    const resolved = resolveFromProduct(
      makeProduct({ fullIngredientText: 'Niacinamide, Zzyxwvutplex' }),
    );

    expect(resolved.resolvedActiveKeys).toEqual(['niacinamide']);
    expect(resolved.unresolvedIngredientTokens).toEqual(['Zzyxwvutplex']);
  });

  it('records the strongest evidenced potency per resolved key', () => {
    const resolved = resolveFromProduct(
      makeProduct({ fullIngredientText: 'Ascorbic Acid' }),
    );

    expect(resolved.potencyByKey.vitamin_c_pure).toBe('high');
  });

  it('leaves potencyByKey empty for a class with no potency-declaring matcher (ceramides)', () => {
    const resolved = resolveFromProduct(
      makeProduct({ fullIngredientText: 'Ceramide NP' }),
    );

    expect(resolved.potencyByKey.ceramides).toBeUndefined();
  });

  it('defaults a wizard-confirmed tag with no INCI evidence to DEFAULT_TAG_POTENCY when its class differentiates by potency', () => {
    const resolved = resolveFromProduct(
      makeProduct({ activeTags: ['retinoid'], fullIngredientText: null }),
    );

    expect(resolved.potencyByKey.retinoid).toBe('high');
  });

  it('does not default a tag-only class with no potency-declaring matcher at all (ceramides)', () => {
    const resolved = resolveFromProduct(makeProduct({ activeTags: ['ceramides'] }));

    expect(resolved.potencyByKey.ceramides).toBeUndefined();
  });

  it('prefers INCI-evidenced potency over the tag default when both are present', () => {
    const resolved = resolveFromProduct(
      makeProduct({
        activeTags: ['retinoid'],
        fullIngredientText: 'Tretinoin',
      }),
    );

    expect(resolved.potencyByKey.retinoid).toBe('rx');
  });
});

describe('resolveFromActiveKeys — resolved-corpus entry point', () => {
  it('passes known keys through and reports no unresolved tokens (no free text to parse)', () => {
    const resolved = resolveFromActiveKeys(['niacinamide', 'ceramides']);

    expect(resolved.resolvedActiveKeys).toEqual(['ceramides', 'niacinamide']);
    expect(resolved.unresolvedIngredientTokens).toEqual([]);
  });

  it('defaults a resolved key with no independent potency evidence to DEFAULT_TAG_POTENCY when its class differentiates by potency (2026-08-06 fix)', () => {
    const resolved = resolveFromActiveKeys(['retinoid']);

    expect(resolved.potencyByKey.retinoid).toBe('high');
  });

  it('leaves potencyByKey unset for a resolved key with no potency-declaring matcher (ceramides)', () => {
    const resolved = resolveFromActiveKeys(['ceramides']);

    expect(resolved.potencyByKey.ceramides).toBeUndefined();
  });

  it('normalizes legacy keys supplied directly from the corpus', () => {
    const resolved = resolveFromActiveKeys(['vitamin_c']);

    expect(resolved.resolvedActiveKeys).toEqual(['vitamin_c_pure']);
  });

  it('drops an unknown key silently', () => {
    const resolved = resolveFromActiveKeys(['not_a_real_key' as never]);

    expect(resolved.resolvedActiveKeys).toEqual([]);
  });

  it('returns an empty resolved set for an empty input array', () => {
    const resolved = resolveFromActiveKeys([]);

    expect(resolved.resolvedActiveKeys).toEqual([]);
  });
});
