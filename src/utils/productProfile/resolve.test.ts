import type { Product } from '@/types';
import {
  resolveFromActiveKeys,
  resolveFromProduct,
  resolveFromRawText,
  tokenizeIngredientsText,
} from '@/utils/productProfile/resolve';

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

  it('records the 1-based comma-token position of a key resolved from fullIngredientText', () => {
    const resolved = resolveFromProduct(
      makeProduct({ fullIngredientText: 'Aqua, Niacinamide, Ceramide NP' }),
    );

    expect(resolved.positionByKey.niacinamide).toBe(2);
    expect(resolved.positionByKey.ceramides).toBe(3);
  });

  it('leaves a tag-only key (no source text evidence) absent from positionByKey', () => {
    const resolved = resolveFromProduct(
      makeProduct({ activeTags: ['ceramides'], fullIngredientText: 'Aqua, Niacinamide' }),
    );

    expect(resolved.positionByKey.ceramides).toBeUndefined();
    expect(resolved.positionByKey.niacinamide).toBe(2);
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

  it('returns an empty positionByKey — there is no source text to position against', () => {
    const resolved = resolveFromActiveKeys(['niacinamide', 'ceramides']);

    expect(resolved.positionByKey).toEqual({});
  });
});

describe('resolveFromRawText — Explore Composition entry point (no Product yet)', () => {
  it('returns an empty resolved set and no unresolved tokens for empty text', () => {
    const resolved = resolveFromRawText('');

    expect(resolved.resolvedActiveKeys).toEqual([]);
    expect(resolved.unresolvedIngredientTokens).toEqual([]);
  });

  it('resolves known-class tokens from raw INCI text', () => {
    const resolved = resolveFromRawText('Aqua, Niacinamide, Glycerin');

    expect(resolved.resolvedActiveKeys).toEqual(['glycerin_class', 'niacinamide']);
  });

  it('surfaces a comma-token that matches no known class as an unresolved token', () => {
    const resolved = resolveFromRawText('Niacinamide, Xanthan Weirdum');

    expect(resolved.resolvedActiveKeys).toEqual(['niacinamide']);
    expect(resolved.unresolvedIngredientTokens).toEqual(['Xanthan Weirdum']);
  });

  it('records the strongest evidenced potency per resolved key, same as resolveFromProduct', () => {
    const resolved = resolveFromRawText('Ascorbic Acid');

    expect(resolved.potencyByKey.vitamin_c_pure).toBe('high');
  });

  it('defaults a resolved key with no independent potency evidence to DEFAULT_TAG_POTENCY when its class differentiates by potency', () => {
    const resolved = resolveFromRawText('Retinol');

    expect(resolved.potencyByKey.retinoid).toBe('high');
  });

  it('leaves potencyByKey unset for a resolved key with no potency-declaring matcher (ceramides)', () => {
    const resolved = resolveFromRawText('Ceramide NP');

    expect(resolved.potencyByKey.ceramides).toBeUndefined();
  });

  it('has no activeTags-union step, unlike resolveFromProduct — only the raw text is ever consulted', () => {
    // Sanity check that this entry point takes a single string argument, not
    // a partial Product — there is nothing here that could union in a tag.
    const resolved = resolveFromRawText('Niacinamide');

    expect(resolved.resolvedActiveKeys).toEqual(['niacinamide']);
  });

  it('records a 1-based comma-token position per resolved key, matching comma order', () => {
    const resolved = resolveFromRawText('Aqua, Niacinamide, Ceramide NP');

    expect(resolved.positionByKey.niacinamide).toBe(2);
    expect(resolved.positionByKey.ceramides).toBe(3);
  });

  it('keeps the earliest position when a class matches at more than one comma-token', () => {
    // Both tokens are `retinoid` matchers (retinyl palmitate then retinol) —
    // earliest (position 2) must win, not the last match (position 3).
    const resolved = resolveFromRawText('Aqua, Retinyl Palmitate, Retinol');

    expect(resolved.positionByKey.retinoid).toBe(2);
  });
});

// 2026-08-26 decision batch, FE-9: shared tokenizer, promoted out of this
// module's own private findUnresolvedTokens so shelfComparison.ts and
// ExploreCompositionResultScreen.tsx stop each keeping a private copy.
describe('tokenizeIngredientsText — shared comma-split-trim-filter tokenizer (FE-9)', () => {
  it('splits on commas, trims whitespace, and drops empty tokens', () => {
    expect(tokenizeIngredientsText('Aqua, Niacinamide ,  Glycerin')).toEqual([
      'Aqua',
      'Niacinamide',
      'Glycerin',
    ]);
  });

  it('returns an empty array for empty text', () => {
    expect(tokenizeIngredientsText('')).toEqual([]);
  });

  it('drops a trailing empty token caused by a trailing comma', () => {
    expect(tokenizeIngredientsText('Aqua, Niacinamide,')).toEqual(['Aqua', 'Niacinamide']);
  });
});
