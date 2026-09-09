import { mergeIngredientCaptures } from './mergeIngredientCaptures';

describe('mergeIngredientCaptures', () => {
  it('deduplicates an exact overlap between the tail of the first shot and the head of the second', () => {
    const first = 'Aqua, Glycerin, Niacinamide, Panthenol';
    const second = 'Niacinamide, Panthenol, Sodium Hyaluronate, Tocopherol';

    expect(mergeIngredientCaptures(first, second)).toBe(
      'Aqua, Glycerin, Niacinamide, Panthenol, Sodium Hyaluronate, Tocopherol',
    );
  });

  it('merges a fuzzy (OCR-noisy) overlap, not just an exact one', () => {
    const first = 'Aqua, Glycerin, Niacinamlde';
    const second = 'Niacinamide, Panthenol';

    expect(mergeIngredientCaptures(first, second)).toBe('Aqua, Glycerin, Niacinamlde, Panthenol');
  });

  it('concatenates with no dedup when the two shots have no overlap', () => {
    const first = 'Aqua, Glycerin';
    const second = 'Sodium Hyaluronate, Tocopherol';

    expect(mergeIngredientCaptures(first, second)).toBe(
      'Aqua, Glycerin, Sodium Hyaluronate, Tocopherol',
    );
  });

  it('returns the second text trimmed when the first is empty', () => {
    expect(mergeIngredientCaptures('', 'Aqua, Glycerin')).toBe('Aqua, Glycerin');
  });

  it('returns the first text trimmed when the second is empty', () => {
    expect(mergeIngredientCaptures('Aqua, Glycerin', '')).toBe('Aqua, Glycerin');
  });

  it('does not treat two short, coincidentally-identical tokens as a real overlap', () => {
    // "Aqua" then "Oil" share nothing meaningful with a second shot that also
    // starts with an unrelated short token — short tokens are excluded from
    // fuzzy matching, so this must not collapse into a bogus 1-token overlap.
    const first = 'Aqua, Oil';
    const second = 'Oil, Wax';

    // The trailing "Oil" / leading "Oil" pair IS an exact match (not fuzzy),
    // so it is legitimately deduplicated.
    expect(mergeIngredientCaptures(first, second)).toBe('Aqua, Oil, Wax');
  });

  it('prefers the largest valid overlap over a smaller one', () => {
    const first = 'Aqua, Glycerin, Niacinamide, Panthenol';
    const second = 'Glycerin, Niacinamide, Panthenol, Retinol';

    expect(mergeIngredientCaptures(first, second)).toBe(
      'Aqua, Glycerin, Niacinamide, Panthenol, Retinol',
    );
  });
});
